const express = require("express");
const { Op } = require("sequelize");
const { sequelize, Product, Category, Order, OrderItem, Review, User, Notification, Famille, RechargePlan, Marque } = require("../models");
const { authenticate, requireRole, loadBoutique } = require("../middleware/auth");
const { cacheMiddleware, clearCachePattern } = require("../config/cache");
const { sendOrderConfirmationEmail, sendOrderStatusEmail } = require("../services/email.service");
const { sendReloadlyLowBalanceAlert } = require("../services/emailService");
const { broadcast, addClient, removeClient } = require("../utils/broadcaster");
const { getReloadlyBalance } = require("../services/reloadlyService");

const {
  createWavePayment,
  createOrangePayment,
  createIntlPayment
} = require("../services/unitechPayService");

function getUnitechApiKey(boutique) {
  return (boutique?.unitechApiKey || process.env.UNITECH_API_KEY || "").trim();
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

// GET /api/store/:slug and /api/store/:slug/boutique -> infos publiques de la boutique (cached 15s)
router.get(["/:slug", "/:slug/boutique"], loadBoutique, cacheMiddleware(15), (req, res) => {
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
    modesPaiement: b.modesPaiement || { especes: true, mvola: true, holam: true, carte: false, wave: true, orange: true }
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

    // Ne pas afficher sur le site les produits marqués "visibleEnLigne: false"
    where.visibleEnLigne = { [Op.ne]: false };

    const products = await Product.findAll({
      where,
      attributes: { exclude: ["dernierPrix"] },
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
      where: { 
        id: req.params.id, 
        boutiqueId: req.boutique.id,
        visibleEnLigne: { [Op.ne]: false }
      },
      attributes: { exclude: ["dernierPrix"] },
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

    // Vérifier si le mode de paiement sélectionné est activé par la boutique
    const boutiqueModes = req.boutique.modesPaiement || {};
    if (moyenPaiement === "wave" && boutiqueModes.wave === false) {
      await t.rollback();
      return res.status(400).json({ message: "Le paiement par Wave est temporairement désactivé pour cette boutique." });
    }
    if (moyenPaiement === "orange" && boutiqueModes.orange === false) {
      await t.rollback();
      return res.status(400).json({ message: "Le paiement par Orange Money est temporairement désactivé pour cette boutique." });
    }
    if (moyenPaiement === "carte" && boutiqueModes.carte === false) {
      await t.rollback();
      return res.status(400).json({ message: "Le paiement par Carte bancaire est temporairement désactivé pour cette boutique." });
    }
    if (moyenPaiement === "especes" && boutiqueModes.especes === false) {
      await t.rollback();
      return res.status(400).json({ message: "Le paiement en espèces est temporairement désactivé pour cette boutique." });
    }
    if (moyenPaiement === "mvola" && boutiqueModes.mvola === false) {
      await t.rollback();
      return res.status(400).json({ message: "Le paiement par MVola est temporairement désactivé pour cette boutique." });
    }
    if ((moyenPaiement === "wero" || moyenPaiement === "holam") && boutiqueModes.holam === false) {
      await t.rollback();
      return res.status(400).json({ message: "Le paiement par Wero est temporairement désactivé pour cette boutique." });
    }

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
    
    // Notifications automatiques (seulement si la commande n'est pas en attente de paiement en ligne)
    if (statutInit !== "en_attente_paiement") {
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
    }

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

// POST /api/store/:slug/orders/:id/payment-reference (Associer la référence UnitechPay à la commande)
router.post("/:slug/orders/:id/payment-reference", loadBoutique, authenticate, async (req, res, next) => {
  try {
    const { reference } = req.body;
    if (!reference) return res.status(400).json({ message: "Référence requise" });
    const order = await Order.findOne({
      where: { id: req.params.id, boutiqueId: req.boutique.id }
    });
    if (!order) return res.status(404).json({ message: "Commande introuvable" });
    await order.update({ stripeSessionId: reference });
    return res.json({ success: true, orderId: order.id, reference });
  } catch (err) { next(err); }
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
    if (order.statut !== "en_attente_paiement" && order.statutPaiement === "paye") {
      return res.json({ verified: true, order });
    }

    const isRecharge = order.typeVente === "recharge_mobile";
    const nextStatut = isRecharge ? "recuperee" : "en_attente";
    let receiptUrl = order.receiptUrl || null;
    let isPaymentValid = false;

    // CAS 1: STRIPE (CARTE BANCAIRE)
    if (order.moyenPaiement === "carte") {
      if (!order.stripeSessionId) {
        return res.status(400).json({ message: "Pas de session Stripe associée" });
      }

      const stripeSecretKey = getStripeSecretKey(req.boutique);
      if (!stripeSecretKey) {
        return res.status(400).json({ message: "Clé Stripe non configurée" });
      }

      const stripe = require("stripe")(stripeSecretKey);
      const session = await stripe.checkout.sessions.retrieve(order.stripeSessionId);

      if (session && session.payment_status === "paid") {
        isPaymentValid = true;
        try {
          if (session.payment_intent) {
            const pi = await stripe.paymentIntents.retrieve(session.payment_intent, { expand: ["latest_charge"] });
            if (pi.latest_charge && pi.latest_charge.receipt_url) {
              receiptUrl = pi.latest_charge.receipt_url;
            }
          }
        } catch (e) {}
      }
    } 
    // CAS 2: UNITECHPAY (WAVE & ORANGE MONEY)
    else if (order.moyenPaiement === "wave" || order.moyenPaiement === "orange" || order.moyenPaiement === "unitechpay" || order.moyenPaiement === "paytech") {
      // Redirection après succès de paiement Wave / Orange Money
      isPaymentValid = true;
    }

    if (isPaymentValid) {
      await order.update({ 
        statut: nextStatut, 
        statutPaiement: "paye",
        receiptUrl: receiptUrl
      });

      const cmdNum = "COM-B" + String(order.id).padStart(3, "0");
      
      if (isRecharge) {
        // Déclencher l'envoi automatique de crédit télécom Reloadly (Comores Telecom / Telma)
        const { dispatchRechargeIfEligible } = require("../services/reloadlyService");
        dispatchRechargeIfEligible(order, req.boutique).catch((err) => console.error("⚠️ [Reloadly Verify Error]:", err.message));

        Notification.create({
          userId: order.clientId, boutiqueId: order.boutiqueId, orderId: order.id,
          title: "Recharge crédit envoyée ! 📲",
          message: `Votre paiement a été validé et la recharge #${cmdNum} est confirmée.`,
          type: "order"
        }).catch(() => {});
        Notification.create({
          userId: null, boutiqueId: order.boutiqueId, orderId: order.id,
          title: "Nouvelle Recharge Crédit Mobile",
          message: `Le paiement pour la recharge #${cmdNum} a été confirmé via ${order.moyenPaiement}.`,
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
          message: `Le paiement pour la commande #${cmdNum} a été confirmé via ${order.moyenPaiement}.`,
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
    }

    return res.json({ verified: isPaymentValid, order });
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

    // ── UnitechPay : Wave & Orange Money (Sénégal) ─────────────────────────
    if (effectiveMoyen === "wave" || effectiveMoyen === "orange" || effectiveMoyen === "unitechpay" || effectiveMoyen === "paytech") {
      try {
        const boutiqueModes = req.boutique.modesPaiement || {};
        if (effectiveMoyen === "wave" && boutiqueModes.wave === false) {
          return res.status(400).json({ message: "Le paiement par Wave est actuellement désactivé pour cette boutique." });
        }
        if (effectiveMoyen === "orange" && boutiqueModes.orange === false) {
          return res.status(400).json({ message: "Le paiement par Orange Money est actuellement désactivé pour cette boutique." });
        }

        const apiKey = getUnitechApiKey(req.boutique);
        if (!apiKey) {
          return res.status(400).json({ message: "La clé UnitechPay (UNITECH_API_KEY) n'est pas configurée. Veuillez contacter l'administrateur." });
        }

        const frontUrl = process.env.FRONTEND_URL || (originUrl.includes("localhost") ? "https://electro.vercel.app" : originUrl);
        const successUrl = `${frontUrl}/confirmation/${order.id}?success=true`;
        const cancelUrl = `${frontUrl}/confirmation/${order.id}?canceled=true`;
        const customerNumber = req.user?.telephone || req.body?.phone || req.body?.customerNumber || "770000000";
        const description = `Commande #${order.id} - ${req.boutique.nom}`;
        const amount = Math.round(Number(order.total));

        let result = null;
        try {
          if (effectiveMoyen === "orange") {
            result = await createOrangePayment({
              amount,
              customerNumber,
              description,
              successUrl,
              cancelUrl,
              apiKey
            });
          } else {
            // Wave par défaut
            result = await createWavePayment({
              amount,
              customerNumber,
              description,
              successUrl,
              cancelUrl,
              apiKey
            });
          }

          if (result && result.success && result.data) {
            const paymentUrl = result.data.payment_url || result.data.deep_links?.MAXIT || result.data.deep_links?.OM;
            const reference = result.data.reference || `TXN-${order.id}-${Date.now()}`;

            // Sauvegarde de la référence unique UnitechPay pour réconciliation webhook
            await order.update({ stripeSessionId: reference });
            return res.json({ url: paymentUrl, reference });
          }
        } catch (serverErr) {
          console.warn("⚠️ UnitechPay server call blocked (Imunify360 or network), using client-side direct initiation:", serverErr.message);
          // Si le serveur cloud Render est bloqué par Imunify360 bot-protection,
          // on bascule immédiatement sur l'initiation directe côté client (qui a une IP résidentielle et CORS autorisé)
          return res.json({
            clientInitiated: true,
            action: effectiveMoyen === "orange" ? "create_orange_om" : "create_wave_payment",
            endpoint: "https://api.unitech.sn/api.php",
            orderId: order.id,
            apiKey,
            payload: {
              amount,
              customer_number: String(customerNumber || "").replace(/[^0-9]/g, ""),
              description,
              callback_success: successUrl,
              callback_cancel: cancelUrl
            }
          });
        }

        // Si le résultat n'est pas un succès
        console.error("❌ UnitechPay API Error:", result);
        return res.status(400).json({ message: "Erreur UnitechPay: " + (result?.message || "Impossible de générer le lien de paiement.") });
      } catch (err) {
        console.error("❌ UnitechPay Exception:", err);
        return res.status(500).json({ message: "Erreur lors de la création du paiement UnitechPay: " + err.message });
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

    // Vérifier si le module rechargeCredit est activé
    if (req.boutique.modulesActifs && req.boutique.modulesActifs.rechargeCredit === false) {
      return res.status(403).json({ message: "Le service de recharge de crédit mobile est actuellement désactivé pour cette boutique." });
    }

    // Vérifier la disponibilité du mode de paiement sélectionné
    const boutiqueModes = req.boutique.modesPaiement || {};
    if (moyenPaiement === "wave" && boutiqueModes.wave === false) {
      return res.status(400).json({ message: "Le paiement par Wave est temporairement indisponible." });
    }
    if (moyenPaiement === "orange" && boutiqueModes.orange === false) {
      return res.status(400).json({ message: "Le paiement par Orange Money est temporairement indisponible." });
    }
    if (moyenPaiement === "carte" && boutiqueModes.carte === false) {
      return res.status(400).json({ message: "Le paiement par Carte bancaire est temporairement indisponible." });
    }

    // ── Vérification préalable du solde Reloadly pour NE PAS débiter le client si le solde est épuisé ──
    const reloadlyId = (req.boutique.reloadlyClientId || process.env.RELOADLY_CLIENT_ID || "").trim();
    const reloadlySecret = (req.boutique.reloadlyClientSecret || process.env.RELOADLY_CLIENT_SECRET || "").trim();
    const isSandbox = (process.env.RELOADLY_SANDBOX === "true" || req.boutique.reloadlySandbox === true);

    if (reloadlyId && reloadlySecret && !isSandbox) {
      try {
        const balanceInfo = await getReloadlyBalance(reloadlyId, reloadlySecret, isSandbox);
        if (balanceInfo.success && balanceInfo.balance <= 0.10) {
          console.warn(`🚨 [Solde Reloadly Épuisé] Solde actuel: ${balanceInfo.balance} ${balanceInfo.currencyCode}. Annulation de la session pour protéger le client.`);

          // Alerter immédiatement l'administrateur par email
          const adminEmail = req.boutique.emailContact || process.env.BREVO_SENDER_EMAIL || "soilihiabdou99@gmail.com";
          sendReloadlyLowBalanceAlert({
            adminEmail,
            balance: balanceInfo.balance,
            currency: balanceInfo.currencyCode,
            attemptedPhone: `+${cleanPhone}`,
            amountKmf: operatorName || "",
            boutiqueNom: req.boutique.nom || "EasyMarket"
          }).catch(() => {});

          return res.status(503).json({
            code: "RECHARGE_MAINTENANCE",
            message: "Le service de recharge est momentanément en maintenance. Veuillez réessayer dans quelques minutes."
          });
        }
      } catch (checkErr) {
        console.warn("⚠️ Impossible de vérifier le solde Reloadly en direct:", checkErr.message);
      }
    }

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

    // ── UnitechPay : Wave & Orange Money (Recharge Mobile) ─────────────────
    if (moyenPaiement === "wave" || moyenPaiement === "orange" || moyenPaiement === "unitechpay" || moyenPaiement === "paytech") {
      try {
        const apiKey = getUnitechApiKey(req.boutique);
        if (!apiKey) {
          return res.status(400).json({ message: "La clé UnitechPay (UNITECH_API_KEY) n'est pas configurée. Veuillez contacter l'administrateur." });
        }

        const frontUrl = process.env.FRONTEND_URL || (originUrl.includes("localhost") ? "https://electro.vercel.app" : originUrl);
        const successUrl = `${frontUrl}/recharge-mobile?status=success&phone=${encodeURIComponent(cleanPhone.replace(/^269/, ""))}&order_id=${order.id}`;
        const cancelUrl = `${frontUrl}/recharge-mobile?status=canceled`;
        const description = `Recharge Crédit Mobile ${operatorName || "Comores"} (+${cleanPhone})`;
        const amountXof = Math.round(Number(amountEur) * 655);

        let result = null;
        try {
          if (moyenPaiement === "orange") {
            result = await createOrangePayment({
              amount: amountXof,
              customerNumber: cleanPhone,
              description,
              successUrl,
              cancelUrl,
              apiKey
            });
          } else {
            result = await createWavePayment({
              amount: amountXof,
              customerNumber: cleanPhone,
              description,
              successUrl,
              cancelUrl,
              apiKey
            });
          }

          if (result && result.success && result.data) {
            const paymentUrl = result.data.payment_url || result.data.deep_links?.MAXIT || result.data.deep_links?.OM;
            const reference = result.data.reference || `RECHARGE-${order.id}-${Date.now()}`;

            await order.update({ stripeSessionId: reference });
            return res.json({ url: paymentUrl, reference, orderId: order.id });
          }
        } catch (serverErr) {
          console.warn("⚠️ UnitechPay Recharge server call blocked (Imunify360 or network), using client-side direct initiation:", serverErr.message);
          return res.json({
            clientInitiated: true,
            action: moyenPaiement === "orange" ? "create_orange_om" : "create_wave_payment",
            endpoint: "https://api.unitech.sn/api.php",
            orderId: order.id,
            apiKey,
            payload: {
              amount: amountXof,
              customer_number: cleanPhone,
              description,
              callback_success: successUrl,
              callback_cancel: cancelUrl
            }
          });
        }

        // Si le résultat n'est pas un succès
        console.error("❌ UnitechPay Recharge API Error:", result);
        return res.status(400).json({ message: "Erreur UnitechPay: " + (result?.message || "Impossible de générer le lien de recharge.") });
      } catch (err) {
        console.error("❌ UnitechPay Recharge Exception:", err);
        return res.status(500).json({ message: "Erreur lors de la création du lien de paiement UnitechPay: " + err.message });
      }
    }

    const stripeSecretKey = getStripeSecretKey(req.boutique);
    if (!stripeSecretKey || (!stripeSecretKey.startsWith("sk_") && !stripeSecretKey.startsWith("rk_"))) {
      return res.status(400).json({ message: "La boutique n'a pas configuré son paiement Stripe." });
    }
    const stripe = require("stripe")(stripeSecretKey);

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

// --- RECHARGE PLANS & STATUS ROUTES ---

// GET /api/store/:slug/recharge-status (Vérifie si le service est actif et si le solde est suffisant)
router.get("/:slug/recharge-status", loadBoutique, async (req, res) => {
  try {
    const isModuleActive = req.boutique.modulesActifs?.rechargeCredit !== false;
    if (!isModuleActive) {
      return res.json({ available: false, inMaintenance: true, message: "Le service de recharge est momentanément désactivé." });
    }

    const reloadlyId = (req.boutique.reloadlyClientId || process.env.RELOADLY_CLIENT_ID || "").trim();
    const reloadlySecret = (req.boutique.reloadlyClientSecret || process.env.RELOADLY_CLIENT_SECRET || "").trim();
    const isSandbox = (process.env.RELOADLY_SANDBOX === "true" || req.boutique.reloadlySandbox === true);

    if (reloadlyId && reloadlySecret && !isSandbox) {
      const balanceInfo = await getReloadlyBalance(reloadlyId, reloadlySecret, isSandbox);
      if (balanceInfo.success && balanceInfo.balance <= 0.10) {
        return res.json({
          available: false,
          inMaintenance: true,
          balance: balanceInfo.balance,
          currency: balanceInfo.currencyCode,
          message: "Le service de recharge est momentanément en maintenance. Veuillez réessayer dans quelques minutes."
        });
      }
    }

    return res.json({ available: true, inMaintenance: false });
  } catch (err) {
    return res.json({ available: true, inMaintenance: false });
  }
});

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
