const express = require("express");
const { Op } = require("sequelize");
const { sequelize, Product, Category, Order, OrderItem, Review, User, Notification, Famille, RechargePlan, Marque } = require("../models");
const { authenticate, requireRole, loadBoutique } = require("../middleware/auth");
const { cacheMiddleware, clearCachePattern } = require("../config/cache");
const { sendOrderConfirmationEmail, sendOrderStatusEmail } = require("../services/email.service");
const { broadcast, addClient, removeClient } = require("../utils/broadcaster");

/**
 * Crée un lien de paiement PayTech (Wave, Orange Money, etc.)
 * Selon la doc officielle : https://doc.intech.sn/doc_paytech.php
 * POST https://paytech.sn/api/payment/request-payment
 * Headers: API_KEY, API_SECRET
 * Body: item_name, item_price, currency, ref_command, command_name, env,
 *       ipn_url, success_url, cancel_url, custom_field, target_payment (optionnel)
 * Response: { success: 1, token, redirect_url, redirectUrl }
 */
async function createPaytechPaymentLink({ apiKey, apiSecret, payload }) {
  const response = await fetch("https://paytech.sn/api/payment/request-payment", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "API_KEY": apiKey,
      "API_SECRET": apiSecret
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  // La doc PayTech précise : vérifier que success === 1 (strictement)
  if (data.success === 1 || data.success === true) {
    return { success: true, url: data.redirect_url || data.redirectUrl, token: data.token };
  }
  return { success: false, error: JSON.stringify(data) };
}

function getPaytechKeys(boutique) {
  // Priorité aux clés de la boutique, fallback sur les variables d'env globales
  return {
    apiKey:    boutique?.paytechApiKey    || process.env.PAYTECH_API_KEY,
    apiSecret: boutique?.paytechApiSecret || process.env.PAYTECH_API_SECRET,
    env:       process.env.PAYTECH_ENV    || "test"  // "test" ou "prod"
  };
}

const router = express.Router({ mergeParams: true });

function getStripeSecretKey(boutique) {
  const bKey = boutique?.stripeSecretKey;
  if (bKey && (bKey.startsWith("sk_") || bKey.startsWith("rk_"))) {
    return bKey;
  }
  return process.env.STRIPE_SECRET_KEY;
}

// GET /api/store/:slug/realtime/events - SSE Stream for real-time app updates
router.get("/:slug/realtime/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const keepAlive = setInterval(() => {
    res.write(":\n\n");
  }, 15000);

  addClient(res);

  req.on("close", () => {
    clearInterval(keepAlive);
    removeClient(res);
  });
});

// GET /api/store/:slug/manifest.json -> Dynamic PWA Manifest with custom store name and logo
router.get("/:slug/manifest.json", loadBoutique, (req, res) => {
  const b = req.boutique;
  const name = b.nom || "Marché Vert";
  const logo = b.logoUrl || "https://images.unsplash.com/photo-1543083477-4f785aeafaa9?auto=format&fit=crop&w=512&h=512&q=80";

  res.json({
    short_name: name,
    name: `${name} - Boutique & Vente Directe`,
    icons: [
      { src: logo, sizes: "192x192", type: "image/png", purpose: "any maskable" },
      { src: logo, sizes: "512x512", type: "image/png", purpose: "any maskable" }
    ],
    start_url: "/",
    background_color: "#163424",
    theme_color: "#163424",
    display: "standalone",
    orientation: "portrait-primary",
    description: `Application e-commerce et caisse POS pour ${name}.`
  });
});

// GET /api/store/:slug and /api/store/:slug/boutique -> infos publiques de la boutique (cached 300)
router.get(["/:slug", "/:slug/boutique"], loadBoutique, cacheMiddleware(300), (req, res) => {
  const b = req.boutique;
  res.json({
    id: b.id, nom: b.nom, slug: b.slug, logoUrl: b.logoUrl,
    couleurPrincipale: b.couleurPrincipale, fraisLivraison: b.fraisLivraison,
    zonesLivraison: b.zonesLivraison, bannerSlides: b.bannerSlides || [],
    sideBanners: b.sideBanners || [],
    telephone: b.telephone,
    telephone2: b.telephone2,
    adresse: b.adresse,
    adresse2: b.adresse2,
    adresseRetrait: b.adresseRetrait || "",
    emailContact: b.emailContact,
    aProposText: b.aProposText,
    aProposImageUrl: b.aProposImageUrl,
    horairesOuverture: b.horairesOuverture || "Tous les jours de 08h30 à 23h00",
    facebookUrl: b.facebookUrl || "",
    instagramUrl: b.instagramUrl || "",
    tiktokUrl: b.tiktokUrl || "",
    whatsappNumber: b.whatsappNumber || "",
    modulesActifs: b.modulesActifs || { vente: true, ventesHistorique: true, achats: true, fournisseurs: true, unites: true, homeBanners: true, sideBanners: true, commandes: true },
    modesPaiement: b.modesPaiement || { especes: true, mvola: true, holam: true, carte: false }
  });
});

// GET /api/store/:slug/familles (cached 10 min)
router.get("/:slug/familles", loadBoutique, cacheMiddleware(600), async (req, res, next) => {
  try {
    const list = await Famille.findAll({ where: { boutiqueId: req.boutique.id } });
    if (list.length === 0) {
      const defaults = [
        { nom: "Alimentation", boutiqueId: req.boutique.id },
        { nom: "Cosmétique", boutiqueId: req.boutique.id },
        { nom: "Maison & Entretien", boutiqueId: req.boutique.id }
      ];
      await Famille.bulkCreate(defaults);
      return res.json(await Famille.findAll({ where: { boutiqueId: req.boutique.id } }));
    }
    res.json(list);
  } catch (err) { next(err); }
});

// GET /api/store/:slug/categories (cached 10 min)
router.get("/:slug/categories", loadBoutique, cacheMiddleware(600), async (req, res, next) => {
  try {
    const categories = await Category.findAll({ where: { boutiqueId: req.boutique.id } });
    res.json(categories);
  } catch (err) { next(err); }
});

// GET /api/store/:slug/marques (cached 5 min)
router.get("/:slug/marques", loadBoutique, cacheMiddleware(300), async (req, res, next) => {
  try {
    const marques = await Marque.findAll({ 
      where: { boutiqueId: req.boutique.id },
      order: [["nom", "ASC"]]
    });
    res.json(marques);
  } catch (err) { next(err); }
});

// GET /api/store/:slug/products?categoryId=&famille=&search=&promo=true&etat=&marqueId= (cached 2 min)
router.get("/:slug/products", loadBoutique, cacheMiddleware(120), async (req, res, next) => {
  try {
    const where = { boutiqueId: req.boutique.id };
    if (req.query.categoryId) where.categoryId = req.query.categoryId;
    if (req.query.etat) where.etat = req.query.etat; // 'neuf' | 'occasion'
    if (req.query.marqueId) where.marqueId = req.query.marqueId;

    const stripAccents = (str) => (str || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

    if (req.query.famille) {
      const famRaw = req.query.famille.trim();
      const famClean = stripAccents(famRaw);
      const searchConditions = [
        { famille: { [Op.like]: `%${famRaw}%` } },
        { famille: { [Op.like]: `%${famClean}%` } },
        { '$Category.famille$': { [Op.like]: `%${famRaw}%` } },
        { '$Category.famille$': { [Op.like]: `%${famClean}%` } },
        { '$Category.nom$': { [Op.like]: `%${famRaw}%` } },
        { '$Category.nom$': { [Op.like]: `%${famClean}%` } },
        { nom: { [Op.like]: `%${famRaw}%` } },
        { nom: { [Op.like]: `%${famClean}%` } }
      ];
      if (where[Op.or]) {
        where[Op.and] = [{ [Op.or]: searchConditions }];
      } else {
        where[Op.or] = searchConditions;
      }
    }

    if (req.query.search) {
      const qRaw = req.query.search.trim();
      const qClean = stripAccents(qRaw);
      const searchConditions = [
        { nom: { [Op.like]: `%${qRaw}%` } },
        { nom: { [Op.like]: `%${qClean}%` } },
        { famille: { [Op.like]: `%${qRaw}%` } },
        { famille: { [Op.like]: `%${qClean}%` } },
        { '$Category.nom$': { [Op.like]: `%${qRaw}%` } },
        { '$Category.nom$': { [Op.like]: `%${qClean}%` } },
        { '$Category.famille$': { [Op.like]: `%${qRaw}%` } },
        { '$Category.famille$': { [Op.like]: `%${qClean}%` } },
        { '$marque.nom$': { [Op.like]: `%${qRaw}%` } },
        { '$marque.nom$': { [Op.like]: `%${qClean}%` } }
      ];
      if (where[Op.or]) {
        where[Op.and] = [{ [Op.or]: searchConditions }];
      } else {
        where[Op.or] = searchConditions;
      }
    }

    if (req.query.promo === "true") where.prixPromo = { [Op.ne]: null };

    const products = await Product.findAll({
      where,
      include: [
        { model: Category }, 
        { model: Marque, as: "marque", attributes: ["id", "nom", "logoUrl"], required: false },
        { model: Review, as: "avis", where: { statut: "publie" }, required: false }
      ],
      order: [["createdAt", "DESC"]],
    });
    res.json(products);
  } catch (err) { next(err); }
});

// GET /api/store/:slug/products/:id
router.get("/:slug/products/:id", loadBoutique, cacheMiddleware(120), async (req, res, next) => {
  try {
    const product = await Product.findOne({
      where: { id: req.params.id, boutiqueId: req.boutique.id },
      include: [
        { model: Category },
        { model: Marque, as: "marque", attributes: ["id", "nom", "logoUrl", "description"], required: false },
        { model: Review, as: "avis", where: { statut: "publie" }, required: false, include: [{ model: User, as: "auteur", attributes: ["nom"] }] },
      ],
    });
    if (!product) return res.status(404).json({ message: "Produit introuvable." });
    res.json(product);
  } catch (err) { next(err); }
});

// POST /api/store/:slug/products/:id/reviews  (client connecté — commande récupérée/livrée requise)
router.post("/:slug/products/:id/reviews", loadBoutique, authenticate, requireRole("client"), async (req, res, next) => {
  try {
    const { note, commentaire, orderId } = req.body;
    if (!note || note < 1 || note > 5) return res.status(400).json({ message: "La note doit être comprise entre 1 et 5." });

    const product = await Product.findOne({ where: { id: req.params.id, boutiqueId: req.boutique.id } });
    if (!product) return res.status(404).json({ message: "Produit introuvable." });

    // Vérifier que le client a une commande contenant ce produit avec le statut 'recuperee' ou 'livree'
    const orderWhere = {
      clientId: req.user.id,
      boutiqueId: req.boutique.id,
      statut: { [Op.in]: ["recuperee", "livree"] }
    };
    if (orderId) {
      orderWhere.id = orderId;
    }

    const eligibleOrder = await Order.findOne({
      where: orderWhere,
      include: [{
        model: OrderItem,
        as: "items",
        where: { productId: product.id },
        required: true
      }]
    });

    if (!eligibleOrder) {
      return res.status(403).json({
        message: "Vous ne pouvez laisser un avis que pour les produits d'une commande récupérée ou livrée."
      });
    }

    // Vérifier si un avis existe déjà pour cet utilisateur et ce produit
    const existingReview = await Review.findOne({
      where: { productId: product.id, userId: req.user.id }
    });

    let review;
    if (existingReview) {
      await existingReview.update({ note, commentaire, statut: "publie" });
      review = existingReview;
    } else {
      review = await Review.create({ productId: product.id, userId: req.user.id, note, commentaire });
    }

    broadcast("product_updated", { productId: product.id });
    res.status(201).json(review);
  } catch (err) { next(err); }
});

// POST /api/store/:slug/orders  (client connecté) — création de commande
router.post("/:slug/orders", loadBoutique, authenticate, requireRole("client"), async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const { items, modeLivraison, adresseLivraison, moyenPaiement } = req.body;
    if (!items || !items.length) {
      await t.rollback();
      return res.status(400).json({ message: "Le panier est vide." });
    }
    if (modeLivraison === "domicile" && !adresseLivraison) {
      await t.rollback();
      return res.status(400).json({ message: "Une adresse de livraison est requise." });
    }

    let sousTotal = 0;
    const lignesAvecPrix = [];
    for (const item of items) {
      const product = await Product.findOne({ where: { id: item.productId, boutiqueId: req.boutique.id }, transaction: t, lock: t.LOCK.UPDATE });
      if (!product) { await t.rollback(); return res.status(404).json({ message: `Produit ${item.productId} introuvable.` }); }
      if (product.stock < item.quantite) { await t.rollback(); return res.status(409).json({ message: `Stock insuffisant pour ${product.nom}.` }); }

      const prixUnitaire = product.prixPromo || product.prix;
      sousTotal += prixUnitaire * item.quantite;
      lignesAvecPrix.push({ product, quantite: item.quantite, prixUnitaire });
    }

    const fraisLivraison = modeLivraison === "domicile" ? Number(req.boutique.fraisLivraison) : 0;
    
    // Si paiement en ligne (carte Stripe, Wave/Orange PayTech), mettre en attente de paiement
    // pour que create-checkout-session puisse retrouver la commande via statut: "en_attente_paiement"
    const statutInit = (moyenPaiement === "carte" || moyenPaiement === "wave" || moyenPaiement === "orange" || moyenPaiement === "paytech")
      ? "en_attente_paiement"
      : "en_attente";

    if (moyenPaiement === "carte") {
      const stripeSecretKey = getStripeSecretKey(req.boutique);
      if (!stripeSecretKey || (!stripeSecretKey.startsWith("sk_") && !stripeSecretKey.startsWith("rk_"))) {
        await t.rollback();
        return res.status(400).json({ message: "Ce mode de paiement n'est pas encore configuré par la boutique. Veuillez en choisir un autre." });
      }
    }

    const order = await Order.create({
      boutiqueId: req.boutique.id, clientId: req.user.id, statut: statutInit,
      modeLivraison, adresseLivraison, moyenPaiement, sousTotal, fraisLivraison,
      total: sousTotal + fraisLivraison,
    }, { transaction: t });

    for (const ligne of lignesAvecPrix) {
      await OrderItem.create({ orderId: order.id, productId: ligne.product.id, quantite: ligne.quantite, prixUnitaire: ligne.prixUnitaire }, { transaction: t });
      await ligne.product.update({ stock: ligne.product.stock - ligne.quantite, ventesCount: ligne.product.ventesCount + ligne.quantite }, { transaction: t });
    }

    await t.commit();
    const complete = await Order.findByPk(order.id, {
      include: [
        { model: User, as: "client", attributes: ["id", "nom", "email", "telephone"] },
        { model: OrderItem, as: "items", include: [{ model: Product, as: "product" }] }
      ]
    });
    
    // Notifications automatiques
    const cmdNum = "COM-B" + String(order.id).padStart(3, "0");
    const totalFormateeur = Number(sousTotal + fraisLivraison).toFixed(2);
    Notification.create({
      userId: req.user.id, boutiqueId: req.boutique.id, orderId: order.id,
      title: "Commande enregistrée",
      message: `Votre commande #${cmdNum} (${totalFormateeur} €) a été enregistrée avec succès.`,
      type: "order"
    }).catch(() => {});

    Notification.create({
      userId: null, boutiqueId: req.boutique.id, orderId: order.id,
      title: "Nouvelle commande reçue !",
      message: `Nouvelle commande #${cmdNum} reçue de ${req.user.nom} (${totalFormateeur} €).`,
      type: "order"
    }).catch(() => {});

    const { envoyerNotificationAdminNouvelleCommande, envoyerConfirmationCommande } = require("../services/emailService");
    const originUrl = req.headers.origin || process.env.FRONTEND_URL || "http://localhost:5173";

    if (statutInit !== "en_attente_paiement") {
      // Notification e-mail transactionnelle au client
      if (req.user.email) {
        envoyerConfirmationCommande(req.user.email, complete, req.boutique.nom).catch((err) => console.error("⚠️ Email confirmation client non envoyé:", err.message));
      }

      // Notification e-mail transactionnelle à l'administrateur de la boutique
      const adminEmail = req.boutique.emailContact || process.env.BREVO_SENDER_EMAIL;
      if (adminEmail) {
        envoyerNotificationAdminNouvelleCommande(adminEmail, complete, req.boutique.nom, originUrl).catch((err) => console.error("⚠️ Email notification admin non envoyé:", err.message));
      }
    }

    clearCachePattern("/api/store").catch(() => {});
    broadcast("order_created", { orderId: order.id, clientId: req.user.id, boutiqueId: req.boutique.id });
    broadcast("product_updated", { boutiqueId: req.boutique.id });

    res.status(201).json(complete);
  } catch (err) {
    if (t && !t.finished) {
      await t.rollback();
    }
    next(err);
  }
});
// POST /api/store/:slug/orders/:id/verify-payment (Vérifier le paiement Stripe côté serveur si le webhook est en retard)
router.post("/:slug/orders/:id/verify-payment", loadBoutique, authenticate, async (req, res, next) => {
  try {
    const order = await Order.findOne({
      where: { id: req.params.id, boutiqueId: req.boutique.id, clientId: req.user.id },
      include: [{ model: OrderItem, as: "items", include: [{ model: Product, as: "product" }] }]
    });

    if (!order) return res.status(404).json({ message: "Commande introuvable" });
    
    // Si la commande est déjà validée (ex: par le webhook), on ne fait rien.
    if (order.statut !== "en_attente_paiement") {
      return res.json({ verified: true, order });
    }

    if (!order.stripeSessionId) {
      return res.status(400).json({ message: "Pas de session Stripe associée" });
    }

    const stripeSecretKey = getStripeSecretKey(req.boutique);
    const stripe = require("stripe")(stripeSecretKey);

    const session = await stripe.checkout.sessions.retrieve(order.stripeSessionId);

    if (session.payment_status === "paid") {
      let receiptUrl = null;
      try {
        if (session.payment_intent) {
          const pi = await stripe.paymentIntents.retrieve(session.payment_intent, { expand: ["latest_charge"] });
          if (pi.latest_charge && pi.latest_charge.receipt_url) {
            receiptUrl = pi.latest_charge.receipt_url;
          }
        }
      } catch (e) {}

      const nextStatut = order.typeVente === "recharge_mobile" ? "recuperee" : "en_attente";
      await order.update({ 
        statut: nextStatut, 
        statutPaiement: "paye",
        receiptUrl: receiptUrl
      });

      const cmdNum = "COM-B" + String(order.id).padStart(3, "0");
      
      if (order.typeVente === "recharge_mobile") {
        Notification.create({
          userId: order.clientId, boutiqueId: order.boutiqueId, orderId: order.id,
          title: "Recharge crédit envoyée ! 📲",
          message: `Votre paiement a été validé et la recharge #${cmdNum} est confirmée.`,
          type: "order"
        }).catch(() => {});
        Notification.create({
          userId: null, boutiqueId: order.boutiqueId, orderId: order.id,
          title: "Nouvelle Recharge Crédit Mobile",
          message: `Le paiement pour la recharge #${cmdNum} a été confirmé via Stripe.`,
          type: "order"
        }).catch(() => {});
        
        // Notification email pour l'admin
        const { envoyerNotificationAdminNouvelleCommande, envoyerConfirmationCommande } = require("../services/emailService");
        const adminEmail = req.boutique.emailContact || process.env.BREVO_SENDER_EMAIL;
        if (adminEmail) {
          const originUrl = req.headers.origin || process.env.FRONTEND_URL || "http://localhost:5173";
          envoyerNotificationAdminNouvelleCommande(adminEmail, order, req.boutique.nom, originUrl).catch((err) => console.error("⚠️ Email notification admin non envoyé (verify-payment):", err.message));
        }

        // Notification email pour le client
        if (req.user && req.user.email) {
           envoyerConfirmationCommande(req.user.email, order, req.boutique.nom).catch((err) => console.error("⚠️ Email confirmation client non envoyé:", err.message));
        }
      } else {
        Notification.create({
          userId: order.clientId, boutiqueId: order.boutiqueId, orderId: order.id,
          title: "Paiement validé",
          message: `Le paiement de votre commande #${cmdNum} a été validé avec succès.`,
          type: "order"
        }).catch(() => {});

        Notification.create({
          userId: null, boutiqueId: order.boutiqueId, orderId: order.id,
          title: "Paiement en ligne reçu",
          message: `Le paiement pour la commande #${cmdNum} a été confirmé via Stripe/Wero.`,
          type: "order"
        }).catch(() => {});
        
        // Notification email pour l'admin
        const { envoyerNotificationAdminNouvelleCommande, envoyerConfirmationCommande } = require("../services/emailService");
        const adminEmail = req.boutique.emailContact || process.env.BREVO_SENDER_EMAIL;
        const originUrl = req.headers.origin || process.env.FRONTEND_URL || "http://localhost:5173";
        if (adminEmail) {
          envoyerNotificationAdminNouvelleCommande(adminEmail, order, req.boutique.nom, originUrl).catch((err) => console.error("⚠️ Email notification admin non envoyé (verify-payment):", err.message));
        }

        // Notification email pour le client
        if (req.user && req.user.email) {
           envoyerConfirmationCommande(req.user.email, order, req.boutique.nom).catch((err) => console.error("⚠️ Email confirmation client non envoyé:", err.message));
        }
      }

      clearCachePattern("/api/store").catch(() => {});
      broadcast("order_updated", { orderId: order.id, statut: nextStatut, clientId: order.clientId, boutiqueId: order.boutiqueId });
      
      return res.json({ verified: true, order });
    }

    res.json({ verified: false, order });
  } catch (err) {
    console.error("Erreur verify-payment:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// PATCH /api/store/:slug/orders/:id/switch-to-cash (Passer une commande en attente de paiement au cash)
router.patch("/:slug/orders/:id/switch-to-cash", loadBoutique, authenticate, async (req, res, next) => {
  try {
    const order = await Order.findOne({
      where: { id: req.params.id, boutiqueId: req.boutique.id, clientId: req.user.id }
    });

    if (!order) return res.status(404).json({ message: "Commande introuvable" });
    if (order.statut !== "en_attente_paiement") {
      return res.status(400).json({ message: "Le paiement de cette commande ne peut plus être modifié." });
    }

    await order.update({
      moyenPaiement: "cash",
      statut: "en_attente" // Repasse en attente classique
    });

    const cmdNum = "COM-B" + String(order.id).padStart(3, "0");
    
    Notification.create({
      userId: order.clientId, boutiqueId: order.boutiqueId, orderId: order.id,
      title: "Mode de paiement modifié",
      message: `Votre commande #${cmdNum} a été modifiée en paiement à la livraison.`,
      type: "order"
    }).catch(() => {});

    Notification.create({
      userId: null, boutiqueId: order.boutiqueId, orderId: order.id,
      title: "Nouvelle commande",
      message: `La commande #${cmdNum} est passée en paiement à la livraison et attend votre confirmation.`,
      type: "order"
    }).catch(() => {});

    clearCachePattern("/api/store").catch(() => {});
    broadcast("order_updated", { orderId: order.id, statut: "en_attente", clientId: order.clientId, boutiqueId: order.boutiqueId });
    
    // Si on veut envoyer l'e-mail à l'admin, on pourrait le faire ici, 
    // car il n'avait peut-être pas été averti du succès du paiement.

    res.json(order);
  } catch (err) {
    next(err);
  }
});

// POST /api/store/:slug/create-checkout-session (Stripe pour Carte/Wero + PayTech pour Wave/Orange Money)
router.post("/:slug/create-checkout-session", loadBoutique, authenticate, async (req, res, next) => {
  try {
    // moyenPaiement peut être passé depuis le frontend pour forcer le routage PayTech
    const { orderId, moyenPaiement: moyenPaiementOverride } = req.body;
    if (!orderId) return res.status(400).json({ message: "L'ID de la commande est requis." });

    const order = await Order.findOne({
      where: { id: orderId, boutiqueId: req.boutique.id, clientId: req.user.id, statut: "en_attente_paiement" },
      include: [
        { model: User, as: "client", attributes: ["email", "nom"] },
        { model: OrderItem, as: "items", include: [{ model: Product, as: "product" }] }
      ]
    });

    if (!order) return res.status(404).json({ message: "Commande introuvable ou déjà payée." });

    const userEmail = order.client?.email || req.user?.email || undefined;
    const originUrl = req.headers.origin || process.env.FRONTEND_URL || "http://localhost:5173";

    // Utiliser le moyenPaiement envoyé depuis le frontend en priorité, sinon celui de la commande
    const effectiveMoyen = moyenPaiementOverride || order.moyenPaiement;

    // Si moyenPaiement a changé (ex: le client a choisi wave au checkout), mettre à jour la commande
    if (moyenPaiementOverride && moyenPaiementOverride !== order.moyenPaiement) {
      await order.update({ moyenPaiement: moyenPaiementOverride });
      order.moyenPaiement = moyenPaiementOverride;
    }

    // ── PayTech : Wave & Orange Money ────────────────────────────────────────
    if (effectiveMoyen === "wave" || effectiveMoyen === "orange" || effectiveMoyen === "paytech") {
      try {
        const { apiKey, apiSecret, env } = getPaytechKeys(req.boutique);

        if (!apiKey || !apiSecret) {
          return res.status(400).json({ message: "Les clés PayTech ne sont pas configurées. Veuillez contacter l'administrateur." });
        }

        // ref_command doit être unique — on utilise l'ID de commande préfixé
        const refCommand = `ORDER-${order.id}-${Date.now()}`;

        // custom_field : nos métadonnées renvoyées dans l'IPN
        const customField = JSON.stringify({
          boutiqueId: req.boutique.id,
          userId: req.user.id,
          orderId: order.id,
          type: order.typeVente || "boutique"
        });

        const backendUrl = process.env.BACKEND_URL || process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT || 4000}`;
        // Pour PayTech, utiliser FRONTEND_URL depuis l'env (ne jamais utiliser localhost car PayTech le rejette)
        const paytechFrontUrl = process.env.FRONTEND_URL || (originUrl.includes("localhost") ? "https://comoresbiachara.site" : originUrl);

        const payload = {
          item_name: `Commande #${order.id} - ${req.boutique.nom}`,
          item_price: Math.round(Number(order.total)), // En XOF
          currency: "XOF",
          ref_command: refCommand,
          command_name: `Paiement commande #${order.id} sur ${req.boutique.nom}`,
          env: env,
          ipn_url: `${backendUrl}/api/webhooks/paytech`,
          success_url: `${paytechFrontUrl}/confirmation/${order.id}?success=true`,
          cancel_url: `${paytechFrontUrl}/confirmation/${order.id}?canceled=true`,
          custom_field: customField
        };

        // Cibler un moyen de paiement spécifique si demandé
        // Valeurs exactes acceptées par PayTech :
        // Wave, Wave CI, Orange Money, Orange Money CI, Orange Money ML, etc.
        if (effectiveMoyen === "wave") payload.target_payment = "Wave";
        if (effectiveMoyen === "orange") payload.target_payment = "Orange Money";

        const result = await createPaytechPaymentLink({ apiKey, apiSecret, payload });

        if (result.success) {
          // On stocke le ref_command dans stripeSessionId pour retrouver la commande dans l'IPN
          await order.update({ stripeSessionId: refCommand });
          return res.json({ url: result.url });
        } else {
          console.error("PayTech Error:", result.error);
          return res.status(400).json({ message: "Erreur PayTech: " + result.error });
        }
      } catch (err) {
        console.error("PayTech Error:", err);
        return res.status(500).json({ message: "Erreur lors de la création du lien PayTech." });
      }
    }

    const stripeSecretKey = getStripeSecretKey(req.boutique);
    if (!stripeSecretKey || (!stripeSecretKey.startsWith("sk_") && !stripeSecretKey.startsWith("rk_"))) {
      return res.status(400).json({ message: "La boutique n'a pas configuré ses paiements par carte/wero." });
    }

    const stripe = require("stripe")(stripeSecretKey);

    let line_items = [];
    if (order.typeVente === "recharge_mobile") {
      line_items = [{
        price_data: {
          currency: "eur",
          product_data: { name: order.notes || "Recharge Crédit Mobile" },
          unit_amount: Math.round(Number(order.total) * 100),
        },
        quantity: 1
      }];
    } else {
      line_items = order.items.map(item => {
        const img = item.product?.imageUrl;
        const validImage = (img && typeof img === "string" && img.startsWith("http") && img.length <= 2048) ? [img] : [];
        return {
          price_data: {
            currency: "eur", // Wero / Stripe nécessite obligatoirement de l'Euro
            product_data: {
              name: item.product.nom,
              images: validImage,
            },
            unit_amount: Math.round(Number(item.prixUnitaire) * 100),
          },
          quantity: item.quantite,
        };
      });
    }

    if (Number(order.fraisLivraison) > 0) {
      line_items.push({
        price_data: {
          currency: "eur",
          product_data: { name: "Frais de livraison" },
          unit_amount: Math.round(Number(order.fraisLivraison) * 100),
        },
        quantity: 1,
      });
    }

    // Paramètres Stripe Connect si un Account ID est défini
    const stripeConfig = {};
    if (req.boutique.stripeAccountId && !req.boutique.stripeSecretKey) {
      stripeConfig.stripeAccount = req.boutique.stripeAccountId;
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      customer_email: userEmail,
      line_items,
      mode: "payment",
      success_url: `${originUrl}/confirmation/${order.id}?success=true`,
      cancel_url: `${originUrl}/confirmation/${order.id}?canceled=true`,
      metadata: { boutiqueId: req.boutique.id, userId: req.user.id, orderId: order.id }
    }, stripeConfig);

    // Mettre à jour l'ID de session dans la base
    await order.update({ stripeSessionId: session.id });

    res.json({ url: session.url });
  } catch (err) { next(err); }
});

// POST /api/store/:slug/create-recharge-session (Paiement direct carte Stripe pour Recharge Crédit Mobile - Authentifié)
router.post("/:slug/create-recharge-session", loadBoutique, authenticate, async (req, res, next) => {
  try {
    const { operatorName, phone, amountEur, moyenPaiement = "carte" } = req.body;
    if (!phone || !amountEur) {
      return res.status(400).json({ message: "Numéro de téléphone et montant requis." });
    }

    const cleanPhone = String(phone).replace(/\D/g, "");
    if (cleanPhone.length !== 10 || !cleanPhone.startsWith("269")) {
      return res.status(400).json({ message: "Numéro invalide. Format attendu: 7 chiffres aux Comores (ex: +2693326532)." });
    }

    const stripeSecretKey = getStripeSecretKey(req.boutique);
    if (!stripeSecretKey || (!stripeSecretKey.startsWith("sk_") && !stripeSecretKey.startsWith("rk_"))) {
      return res.status(400).json({ message: "La boutique n'a pas configuré son paiement Stripe." });
    }

    const stripe = require("stripe")(stripeSecretKey);
    const originUrl = req.headers.origin || process.env.FRONTEND_URL || "http://localhost:5173";

    const order = await Order.create({
      boutiqueId: req.boutique.id,
      clientId: req.user.id,
      statut: "en_attente_paiement",
      typeVente: "recharge_mobile",
      moyenPaiement: moyenPaiement,
      total: amountEur,
      sousTotal: amountEur,
      fraisLivraison: 0,
      notes: `Recharge Crédit Mobile ${operatorName} pour le numéro +${cleanPhone}`
    });

    if (moyenPaiement === "wero" || moyenPaiement === "holam") {
      return res.json({ orderId: order.id, order });
    }

    // ── PayTech : Wave & Orange Money (Recharge Mobile) ──────────────────────
    if (moyenPaiement === "wave" || moyenPaiement === "orange" || moyenPaiement === "paytech") {
      try {
        const { apiKey, apiSecret, env } = getPaytechKeys(req.boutique);

        if (!apiKey || !apiSecret) {
          return res.status(400).json({ message: "Les clés PayTech ne sont pas configurées. Veuillez contacter l'administrateur." });
        }

        const refCommand = `RECHARGE-${order.id}-${Date.now()}`;

        // custom_field : métadonnées pour l'IPN
        const customField = JSON.stringify({
          boutiqueId: req.boutique.id,
          userId: req.user ? req.user.id : null,
          orderId: order.id,
          type: "recharge_mobile",
          phone: `+${cleanPhone}`,
          operatorName: operatorName || ""
        });

        const backendUrl = process.env.BACKEND_URL || process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT || 4000}`;
        // Pour PayTech, utiliser FRONTEND_URL depuis l'env (ne jamais utiliser localhost car PayTech le rejette)
        const paytechFrontUrl = process.env.FRONTEND_URL || (originUrl.includes("localhost") ? "https://comoresbiachara.site" : originUrl);

        const payload = {
          item_name: `Recharge Crédit Mobile ${operatorName || "Comores"} (+${cleanPhone})`,
          item_price: Math.round(Number(amountEur) * 655), // Conversion EUR → XOF (1 EUR ≈ 655 XOF)
          currency: "XOF",
          ref_command: refCommand,
          command_name: `Recharge mobile ${cleanPhone} via ${req.boutique.nom}`,
          env: env,
          ipn_url: `${backendUrl}/api/webhooks/paytech`,
          success_url: `${paytechFrontUrl}/recharge-mobile?status=success&phone=${encodeURIComponent(cleanPhone.replace(/^269/, ""))}&order_id=${order.id}`,
          cancel_url: `${paytechFrontUrl}/recharge-mobile?status=canceled`,
          custom_field: customField
        };

        // Cibler le moyen de paiement Wave ou Orange Money
        // Valeurs exactes acceptées par PayTech :
        // Wave, Wave CI, Orange Money, Orange Money CI, Orange Money ML, etc.
        if (moyenPaiement === "wave") payload.target_payment = "Wave";
        if (moyenPaiement === "orange") payload.target_payment = "Orange Money";

        const result = await createPaytechPaymentLink({ apiKey, apiSecret, payload });

        if (result.success) {
          await order.update({ stripeSessionId: refCommand });
          return res.json({ url: result.url });
        } else {
          console.error("PayTech Recharge Error:", result.error);
          return res.status(400).json({ message: "Erreur PayTech: " + result.error });
        }
      } catch (err) {
        console.error("PayTech Recharge Error:", err);
        return res.status(500).json({ message: "Erreur lors de la création du lien de paiement PayTech." });
      }
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      customer_email: req.user?.email || undefined,
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: `Recharge Crédit Mobile - ${operatorName || 'Comores'} (+${cleanPhone})`,
              description: `Envoi direct de crédit mobile à destination EXCLUSIVE du numéro +${cleanPhone}.`,
            },
            unit_amount: Math.round(Number(amountEur) * 100),
          },
          quantity: 1,
        }
      ],
      mode: "payment",
      success_url: `${originUrl}/recharge-mobile?status=success&phone=${encodeURIComponent(cleanPhone.replace(/^269/, ''))}&order_id=${order.id}`,
      cancel_url: `${originUrl}/recharge-mobile?status=canceled`,
      metadata: { 
        boutiqueId: req.boutique.id, 
        userId: req.user ? req.user.id : null,
        type: "recharge_mobile", 
        phone: `+${cleanPhone}`, 
        operatorName,
        orderId: order.id
      }
    });

    await order.update({ stripeSessionId: session.id });

    res.json({ url: session.url });
  } catch (err) { next(err); }
});

// GET /api/store/:slug/orders/mine  (client connecté)
router.get("/:slug/orders/mine", loadBoutique, authenticate, requireRole("client"), async (req, res, next) => {
  try {
    const orders = await Order.findAll({
      where: { boutiqueId: req.boutique.id, clientId: req.user.id },
      include: [{ model: OrderItem, as: "items", include: [{ model: Product, as: "product" }] }],
      order: [["createdAt", "DESC"]],
    });
    res.json(orders);
  } catch (err) { next(err); }
});

// PATCH /api/store/:slug/orders/:id/cancel (client connecté — annuler commande si non livrée)
router.patch("/:slug/orders/:id/cancel", loadBoutique, authenticate, requireRole("client"), async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const order = await Order.findOne({
      where: { id: req.params.id, clientId: req.user.id, boutiqueId: req.boutique.id },
      include: [{ model: OrderItem, as: "items" }],
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    if (!order) {
      await t.rollback();
      return res.status(404).json({ message: "Commande introuvable." });
    }

    if (["livree", "recuperee", "en_livraison", "annulee"].includes(order.statut)) {
      await t.rollback();
      return res.status(400).json({
        message: "Impossible d'annuler cette commande car elle est déjà en cours de livraison, livrée ou déjà annulée."
      });
    }

    await order.update({ statut: "annulee" }, { transaction: t });

    // Restituer le stock pour chaque article
    if (order.items && order.items.length > 0) {
      for (const item of order.items) {
        const prod = await Product.findByPk(item.productId, { transaction: t, lock: t.LOCK.UPDATE });
        if (prod) {
          await prod.update({
            stock: (prod.stock || 0) + item.quantite,
            ventesCount: Math.max(0, (prod.ventesCount || 0) - item.quantite)
          }, { transaction: t });
        }
      }
    }

    await t.commit();

    if (req.user.email) {
      sendOrderStatusEmail(req.user.email, req.user.nom, order, "annulee", req.boutique.nom).catch(() => {});
    }

    clearCachePattern("/api/store").catch(() => {});
    broadcast("order_updated", { orderId: order.id, statut: "annulee", clientId: req.user.id, boutiqueId: req.boutique.id });
    broadcast("product_updated", { boutiqueId: req.boutique.id });

    res.json({ message: "Votre commande a été annulée avec succès.", order });
  } catch (err) {
    await t.rollback();
    next(err);
  }
});

// --- RECHARGE PLANS ROUTES ---

// GET /api/store/:slug/recharge-plans
router.get("/:slug/recharge-plans", loadBoutique, async (req, res, next) => {
  try {
    const plans = await RechargePlan.findAll({
      where: { boutiqueId: req.boutique.id, active: true },
      order: [["orderIndex", "ASC"], ["eur", "ASC"]]
    });
    res.json(plans);
  } catch (error) {
    next(error);
  }
});

// GET /api/store/:slug/admin/recharge-plans
router.get("/:slug/admin/recharge-plans", loadBoutique, authenticate, requireRole("super_admin", "admin", "employe"), async (req, res, next) => {
  try {
    const plans = await RechargePlan.findAll({
      where: { boutiqueId: req.boutique.id },
      order: [["orderIndex", "ASC"], ["eur", "ASC"]]
    });
    res.json(plans);
  } catch (error) {
    next(error);
  }
});

// POST /api/store/:slug/admin/recharge-plans
router.post("/:slug/admin/recharge-plans", loadBoutique, authenticate, requireRole("super_admin", "admin", "employe"), async (req, res, next) => {
  try {
    const plan = await RechargePlan.create({
      ...req.body,
      boutiqueId: req.boutique.id
    });
    res.status(201).json(plan);
  } catch (error) {
    next(error);
  }
});

// PUT /api/store/:slug/admin/recharge-plans/:id
router.put("/:slug/admin/recharge-plans/:id", loadBoutique, authenticate, requireRole("super_admin", "admin", "employe"), async (req, res, next) => {
  try {
    const plan = await RechargePlan.findOne({ where: { id: req.params.id, boutiqueId: req.boutique.id } });
    if (!plan) return res.status(404).json({ message: "Plan non trouvé" });
    await plan.update(req.body);
    res.json(plan);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/store/:slug/admin/recharge-plans/:id
router.delete("/:slug/admin/recharge-plans/:id", loadBoutique, authenticate, requireRole("super_admin", "admin", "employe"), async (req, res, next) => {
  try {
    const plan = await RechargePlan.findOne({ where: { id: req.params.id, boutiqueId: req.boutique.id } });
    if (!plan) return res.status(404).json({ message: "Plan non trouvé" });
    await plan.destroy();
    res.json({ message: "Plan supprimé" });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
