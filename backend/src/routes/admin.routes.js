const express = require("express");
const bcrypt = require("bcryptjs");
const { Op } = require("sequelize");
const { sequelize, Product, Category, Order, OrderItem, User, Boutique, Notification, Review, Famille, Fournisseur, UniteVente, Achat, Marque } = require("../models");
const { authenticate, requireRole, requireOwnBoutique } = require("../middleware/auth");
const { clearCachePattern } = require("../config/cache");
const { broadcast } = require("../utils/broadcaster");
const { sendOrderStatusEmail } = require("../services/email.service");

const router = express.Router();

function purgeCache() {
  clearCachePattern("/api/store").catch(() => {});
  clearCachePattern("store").catch(() => {});
  clearCachePattern("/api/boutique").catch(() => {});
}

router.use(authenticate, requireRole("admin", "employe"), requireOwnBoutique);

async function checkExpirationNotification(product, boutiqueId) {
  // Désactivé car les accessoires électriques et matériel n'expirent pas
  return;
}

/* ---------------------- TABLEAU DE BORD ---------------------- */

// DELETE /api/admin/cleanup - Nettoyage de la base de données
router.post("/cleanup", async (req, res, next) => {
  try {
    const { tables } = req.body;
    if (!tables || !Array.isArray(tables)) return res.status(400).json({ message: "Tables non spécifiées." });

    const boutiqueId = req.boutiqueId;

    // We must handle deletions safely and carefully.
    if (tables.includes("commandes")) {
      const orders = await Order.findAll({ where: { boutiqueId }, attributes: ["id"] });
      const orderIds = orders.map(o => o.id);
      if (orderIds.length > 0) {
        await OrderItem.destroy({ where: { orderId: orderIds } });
      }
      await Order.destroy({ where: { boutiqueId } });
    }
    if (tables.includes("achats")) {
      await Achat.destroy({ where: { boutiqueId } });
    }
    if (tables.includes("produits")) {
      const products = await Product.findAll({ where: { boutiqueId }, attributes: ["id"] });
      const productIds = products.map(p => p.id);
      if (productIds.length > 0) {
        await Review.destroy({ where: { productId: productIds } });
        await Achat.destroy({ where: { productId: productIds } });
      }
      await Product.destroy({ where: { boutiqueId } });
    }
    if (tables.includes("categories")) {
      await Category.destroy({ where: { boutiqueId } });
    }
    if (tables.includes("clients")) {
      await User.destroy({ where: { boutiqueId, role: "client" } });
    }
    if (tables.includes("fournisseurs")) {
      await Fournisseur.destroy({ where: { boutiqueId } });
    }

    purgeCache();
    broadcast("boutique_updated", { boutiqueId });

    res.json({ message: "Nettoyage effectué avec succès." });
  } catch (error) {
    next(error);
  }
});

router.get("/dashboard", async (req, res, next) => {
  try {
    const boutiqueId = req.boutiqueId;
    const isEmploye = req.user.role === "employe";

    // Mes commandes assignées à cet employé / utilisateur
    const mesCommandes = await Order.findAll({
      where: { boutiqueId, employeAssigneId: req.user.id },
      include: [
        { model: OrderItem, as: "items", include: [{ model: Product, as: "product" }] },
        { model: User, as: "client", attributes: ["nom", "telephone"] }
      ],
      order: [["createdAt", "DESC"]]
    });

    const mesCommandesLivrees = mesCommandes.filter(c => c.statut === "livree");
    const monChiffreAffaires = mesCommandes.filter(c => c.statut !== "annulee").reduce((sum, c) => sum + Number(c.total), 0);
    const mesCommandesEnCours = mesCommandes.filter(c => ["en_attente", "validee", "en_preparation", "en_livraison"].includes(c.statut));

    // Si c'est un employé, on lui retourne son tableau de bord d'activités personnel uniquement !
    if (isEmploye) {
      return res.json({
        isEmploye: true,
        monChiffreAffaires,
        nbMesCommandes: mesCommandes.length,
        nbMesCommandesLivrees: mesCommandesLivrees.length,
        nbMesCommandesEnCours: mesCommandesEnCours.length,
        mesCommandes
      });
    }

    // Pour les Administrateurs : vue d'ensemble globale de la boutique
    const orders = await Order.findAll({
      where: { boutiqueId, statut: { [Op.ne]: "annulee" } },
      include: [{ model: OrderItem, as: "items", include: [{ model: Product, as: "product" }] }],
    });

    const chiffreAffaires = orders.reduce((s, o) => s + Number(o.total), 0);
    const beneficeNet = orders.reduce((s, o) => {
      return s + o.items.reduce((ss, it) => ss + (Number(it.prixUnitaire) - (it.product ? Number(it.product.coutAchat) : 0)) * it.quantite, 0);
    }, 0);

    const nbCommandes = await Order.count({ where: { boutiqueId } });
    const totalClients = await User.count({ 
      where: { 
        role: "client",
        [Op.or]: [
          { boutiqueId },
          { boutiqueId: null }
        ]
      } 
    });
    
    const produits = await Product.findAll({ 
      where: { boutiqueId }, 
      include: [
        Category,
        { model: Review, as: "avis" }
      ] 
    });
    
    const categories = await Category.findAll({ where: { boutiqueId } });
    const stockFaible = produits.filter((p) => p.stock <= p.seuilAlerte);

    // Total avis & Note moyenne
    let totalReviews = 0;
    let sumNotes = 0;

    const prodsWithStats = produits.map((p) => {
      const pAvis = p.avis || [];
      const pNbAvis = pAvis.length;
      const pSumNotes = pAvis.reduce((s, r) => s + r.note, 0);
      const pNoteMoyenne = pNbAvis > 0 ? Number((pSumNotes / pNbAvis).toFixed(1)) : 5.0;

      totalReviews += pNbAvis;
      sumNotes += pSumNotes;

      return {
        id: p.id,
        nom: p.nom,
        prix: p.prix,
        prixPromo: p.prixPromo,
        imageUrl: p.imageUrl,
        ventesCount: p.ventesCount || 0,
        stock: p.stock,
        categoryName: p.Category?.nom || "Non classé",
        noteMoyenne: pNoteMoyenne,
        nbAvis: pNbAvis
      };
    });

    const noteMoyenneGlobale = totalReviews > 0 ? Number((sumNotes / totalReviews).toFixed(1)) : 4.9;

    // Top 7 & Flop 7 Produits
    const sortedProds = [...prodsWithStats].sort((a, b) => b.ventesCount - a.ventesCount);
    const top7Produits = sortedProds.slice(0, 7);
    const flop7Produits = [...prodsWithStats].sort((a, b) => a.ventesCount - b.ventesCount).slice(0, 7);

    // Top & Flop Catégories
    const categoryStats = categories.map(c => {
      const prodsInCat = prodsWithStats.filter(p => p.categoryName === c.nom);
      return {
        id: c.id,
        name: c.nom,
        count: prodsInCat.length,
        ventes: prodsInCat.reduce((s, p) => s + p.ventesCount, 0)
      };
    });

    const topCategories = [...categoryStats].sort((a, b) => b.ventes - a.ventes);
    const flopCategories = [...categoryStats].sort((a, b) => a.ventes - b.ventes);

    const panierMoyen = nbCommandes > 0 ? Math.round(chiffreAffaires / nbCommandes) : 0;
    const valeurStockVente = produits.reduce((sum, p) => sum + (Number(p.stock || 0) * Number(p.prixPromo || p.prix || 0)), 0);
    const valeurStockAchat = produits.reduce((sum, p) => sum + (Number(p.stock || 0) * Number(p.coutAchat || 0)), 0);
    const totalVentesCount = prodsWithStats.reduce((sum, p) => sum + Number(p.ventesCount || 0), 0);

    // Expirations désactivées pour électricité et matériel
    const produitsExpirant = [];

    res.json({
      isEmploye: false,
      chiffreAffaires,
      beneficeNet,
      valeurStockVente,
      valeurStockAchat,
      totalVentesCount,
      nbCommandes,
      panierMoyen,
      totalClients,
      totalReviews,
      noteMoyenneGlobale,
      stockFaibleCount: stockFaible.length,
      stockFaibleList: stockFaible,
      produitsExpirantCount: produitsExpirant.length,
      produitsExpirantList: produitsExpirant,
      topProduits: top7Produits,
      top7Produits,
      flop7Produits,
      categoryStats,
      topCategories,
      flopCategories,
      totalProduits: produits.length,
      totalCategories: categories.length,
      mesCommandes
    });
  } catch (err) { next(err); }
});

/* ---------------------- FAMILLES DE PRODUITS ---------------------- */

router.get("/familles", async (req, res, next) => {
  try {
    const list = await Famille.findAll({ where: { boutiqueId: req.boutiqueId } });
    if (list.length === 0) {
      const defaults = [
        { nom: "Alimentation", boutiqueId: req.boutiqueId },
        { nom: "Cosmétique", boutiqueId: req.boutiqueId },
        { nom: "Maison & Entretien", boutiqueId: req.boutiqueId }
      ];
      await Famille.bulkCreate(defaults);
      return res.json(await Famille.findAll({ where: { boutiqueId: req.boutiqueId } }));
    }
    res.json(list);
  } catch (err) { next(err); }
});

router.post("/familles", async (req, res, next) => {
  try {
    const fam = await Famille.create({ ...req.body, boutiqueId: req.boutiqueId });
    res.status(201).json(fam);
  } catch (err) { next(err); }
});

router.put("/familles/:id", async (req, res, next) => {
  try {
    const fam = await Famille.findOne({ where: { id: req.params.id, boutiqueId: req.boutiqueId } });
    if (!fam) return res.status(404).json({ message: "Famille introuvable." });
    await fam.update(req.body);
    res.json(fam);
  } catch (err) { next(err); }
});

router.delete("/familles/:id", async (req, res, next) => {
  try {
    const fam = await Famille.findOne({ where: { id: req.params.id, boutiqueId: req.boutiqueId } });
    if (!fam) return res.status(404).json({ message: "Famille introuvable." });
    await fam.destroy();
    res.json({ message: "Famille supprimée." });
  } catch (err) { next(err); }
});

/* ---------------------- CATÉGORIES ---------------------- */

router.get("/categories", async (req, res, next) => {
  try {
    res.json(await Category.findAll({ where: { boutiqueId: req.boutiqueId } }));
  } catch (err) { next(err); }
});

router.post("/categories", async (req, res, next) => {
  try {
    const cat = await Category.create({ ...req.body, boutiqueId: req.boutiqueId });
    purgeCache();
    broadcast("category_updated", { boutiqueId: req.boutiqueId });
    res.status(201).json(cat);
  } catch (err) { next(err); }
});

router.put("/categories/:id", async (req, res, next) => {
  try {
    const cat = await Category.findOne({ where: { id: req.params.id, boutiqueId: req.boutiqueId } });
    if (!cat) return res.status(404).json({ message: "Catégorie introuvable." });
    await cat.update(req.body);
    purgeCache();
    broadcast("category_updated", { categoryId: cat.id, boutiqueId: req.boutiqueId });
    res.json(cat);
  } catch (err) { next(err); }
});

router.delete("/categories/:id", async (req, res, next) => {
  try {
    const cat = await Category.findOne({ where: { id: req.params.id, boutiqueId: req.boutiqueId } });
    if (!cat) return res.status(404).json({ message: "Catégorie introuvable." });
    await cat.destroy();
    purgeCache();
    broadcast("category_updated", { boutiqueId: req.boutiqueId });
    res.json({ message: "Catégorie supprimée." });
  } catch (err) { next(err); }
});

/* ---------------------- PRODUITS (catalogue) ---------------------- */

router.get("/products", async (req, res, next) => {
  try {
    res.json(await Product.findAll({ 
      where: { boutiqueId: req.boutiqueId }, 
      include: [Category, { model: Fournisseur, as: "fournisseur" }, { model: Marque, as: "marque" }], 
      order: [["createdAt", "DESC"]] 
    }));
  } catch (err) { next(err); }
});

router.post("/products", async (req, res, next) => {
  try {
    const product = await Product.create({ ...req.body, boutiqueId: req.boutiqueId });

    // Auto-enregistrement dans la table des Achats / Approvisionnements
    if (product.stock > 0 || Number(product.coutAchat) > 0 || product.fournisseurId) {
      const qty = product.stock || 1;
      const unitPrice = Number(product.coutAchat) || 0;
      await Achat.create({
        boutiqueId: req.boutiqueId,
        productId: product.id,
        fournisseurId: product.fournisseurId || null,
        quantite: qty,
        prixAchatUnitaire: unitPrice,
        totalAchat: qty * unitPrice,
        notes: "Création initiale de la fiche produit"
      }).catch(() => {});
    }

    const fullProduct = await Product.findByPk(product.id, {
      include: [Category, { model: Fournisseur, as: "fournisseur" }, { model: Marque, as: "marque" }]
    });

    purgeCache();
    broadcast("product_updated", { productId: product.id, boutiqueId: req.boutiqueId });
    res.status(201).json(fullProduct);
  } catch (err) { next(err); }
});

router.put("/products/:id", async (req, res, next) => {
  try {
    const product = await Product.findOne({ where: { id: req.params.id, boutiqueId: req.boutiqueId } });
    if (!product) return res.status(404).json({ message: "Produit introuvable." });

    await product.update(req.body);

    const fullProduct = await Product.findByPk(product.id, {
      include: [Category, { model: Fournisseur, as: "fournisseur" }, { model: Marque, as: "marque" }]
    });

    purgeCache();
    broadcast("product_updated", { productId: product.id, boutiqueId: req.boutiqueId });
    res.json(fullProduct);
  } catch (err) { next(err); }
});

router.delete("/products/:id", async (req, res, next) => {
  try {
    const product = await Product.findOne({ where: { id: req.params.id, boutiqueId: req.boutiqueId } });
    if (!product) return res.status(404).json({ message: "Produit introuvable." });
    await product.destroy();
    purgeCache();
    broadcast("product_updated", { productId: req.params.id, boutiqueId: req.boutiqueId });
    res.json({ message: "Produit supprimé." });
  } catch (err) { 
    if (err.name === 'SequelizeForeignKeyConstraintError') {
      return res.status(400).json({ message: "Impossible de supprimer ce produit car il est lié à des commandes, des achats ou des avis existants. Veuillez plutôt le modifier pour le rendre indisponible ou masquer." });
    }
    next(err); 
  }
});

/* ---------------------- COMMANDES ---------------------- */

router.get("/orders", async (req, res, next) => {
  try {
    const where = { 
      boutiqueId: req.boutiqueId,
      statut: { [Op.ne]: "en_attente_paiement" }
    };
    if (req.query.statut) where.statut = req.query.statut;
    const orders = await Order.findAll({
      where,
      include: [
        { model: OrderItem, as: "items", include: [{ model: Product, as: "product" }] }, 
        { model: User, as: "client", attributes: ["nom", "telephone"] },
        { model: User, as: "employeAssigne", attributes: ["id", "nom", "role"] }
      ],
      order: [["createdAt", "DESC"]],
    });
    res.json(orders);
  } catch (err) { next(err); }
});

router.patch("/orders/:id/status", async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const order = await Order.findOne({
      where: { id: req.params.id, boutiqueId: req.boutiqueId },
      include: [{ model: OrderItem, as: "items" }],
      transaction: t
    });
    if (!order) {
      await t.rollback();
      return res.status(404).json({ message: "Commande introuvable." });
    }

    if (["annulee", "livree", "recuperee"].includes(order.statut)) {
      await t.rollback();
      return res.status(400).json({ message: "Cette commande est déjà " + (order.statut === "annulee" ? "annulée" : "terminée") + ". Son statut ne peut plus être modifié." });
    }

    const newStatut = req.body.statut;
    await order.update({ statut: newStatut }, { transaction: t });

    if (newStatut === "annulee" && order.items && order.items.length > 0) {
      for (const item of order.items) {
        const prod = await Product.findByPk(item.productId, { transaction: t });
        if (prod) {
          await prod.update({
            stock: (prod.stock || 0) + item.quantite,
            ventesCount: Math.max(0, (prod.ventesCount || 0) - item.quantite)
          }, { transaction: t });
        }
      }
    }

    await t.commit();

    purgeCache();

    // Notifier le client de la mise à jour du statut
    const cmdNum = "COM-B" + String(order.id).padStart(3, "0");
    const labels = {
      en_attente: "En attente",
      validee: "Confirmée",
      en_preparation: "En préparation",
      pret_retrait: "Prête à récupérer en boutique",
      en_livraison: "En cours de livraison",
      recuperee: "Récupérée en boutique",
      livree: "Livrée",
      annulee: "Annulée"
    };
    const statutTxt = labels[newStatut] || newStatut;

    Notification.create({
      userId: order.clientId, boutiqueId: order.boutiqueId, orderId: order.id,
      title: "Mise à jour de votre commande",
      message: `Votre commande #${cmdNum} est maintenant : ${statutTxt}.`,
      type: "status"
    }).catch(() => {});

    broadcast("order_updated", { orderId: order.id, statut: newStatut, clientId: order.clientId, boutiqueId: order.boutiqueId });
    if (newStatut === "annulee") {
      broadcast("product_updated", { boutiqueId: order.boutiqueId });
    }

    User.findByPk(order.clientId).then(clientUser => {
      if (clientUser && clientUser.email) {
        Boutique.findByPk(order.boutiqueId).then(b => {
          sendOrderStatusEmail(clientUser.email, clientUser.nom, order, newStatut, b?.nom || "Marché Vert").catch(() => {});
        }).catch(() => {});
      }
    }).catch(() => {});

    res.json(order);
  } catch (err) {
    if (t && !t.finished) {
      await t.rollback();
    }
    next(err);
  }
});

router.patch("/orders/:id/assign", async (req, res, next) => {
  try {
    const order = await Order.findOne({ where: { id: req.params.id, boutiqueId: req.boutiqueId } });
    if (!order) return res.status(404).json({ message: "Commande introuvable." });
    const empId = req.body.employeId || null;
    await order.update({ employeAssigneId: empId });

    if (empId) {
      const cmdNum = "COM-B" + String(order.id).padStart(3, "0");
      Notification.create({
        userId: empId, boutiqueId: order.boutiqueId, orderId: order.id,
        title: "Nouvelle commande assignée",
        message: `La commande #${cmdNum} vous a été attribuée.`,
        type: "order"
      }).catch(() => {});
    }

    broadcast("order_updated", { orderId: order.id, employeId: empId, boutiqueId: order.boutiqueId });
    res.json(order);
  } catch (err) { next(err); }
});

/* ---------------------- GESTION DES UTILISATEURS (ADMINS & EMPLOYÉS) ---------------------- */

router.get("/employees", requireRole("admin"), async (req, res, next) => {
  try {
    const users = await User.findAll({ 
      where: { boutiqueId: req.boutiqueId, role: { [Op.in]: ["admin", "employe"] } }, 
      attributes: { exclude: ["motDePasseHash"] },
      order: [["createdAt", "DESC"]]
    });
    res.json(users);
  } catch (err) { next(err); }
});

router.post("/employees", requireRole("admin"), async (req, res, next) => {
  try {
    const { nom, email, telephone, motDePasse, role, permissions } = req.body;
    const cleanEmail = email ? String(email).trim().toLowerCase() : null;
    const cleanPhone = telephone ? String(telephone).trim() : null;

    if (!nom || (!cleanEmail && !cleanPhone)) {
      return res.status(400).json({ message: "Le nom et au moins un email ou téléphone sont requis." });
    }

    const { Op } = require("sequelize");
    const whereCond = [];
    if (cleanEmail) whereCond.push({ email: cleanEmail });
    if (cleanPhone) whereCond.push({ telephone: cleanPhone });

    const existant = await User.findOne({ where: { [Op.or]: whereCond } });
    if (existant) return res.status(409).json({ message: "Un compte existe déjà avec cet email ou téléphone." });

    const userRole = role === "admin" ? "admin" : "employe";
    const userPermissions = userRole === "admin" 
      ? ["voir_dashboard", "gerer_banners", "gerer_categories", "gerer_produits", "gerer_commandes", "gerer_parametres", "gerer_utilisateurs"]
      : (permissions || []);

    const rawPassword = motDePasse && motDePasse.trim() ? motDePasse.trim() : Math.random().toString(36).slice(-8) + "A1!";
    const motDePasseHash = await bcrypt.hash(rawPassword, 10);

    const user = await User.create({
      nom: nom.trim(),
      email: cleanEmail,
      telephone: cleanPhone,
      motDePasseHash,
      permissions: userPermissions,
      role: userRole,
      boutiqueId: req.boutiqueId,
      statut: "actif",
      mustChangePassword: true,
      isEmailVerified: true
    });

    if (cleanEmail) {
      const { envoyerEmailCreationCompte } = require("../services/emailService");
      Boutique.findByPk(req.boutiqueId).then(b => {
        envoyerEmailCreationCompte(cleanEmail, user.nom, cleanEmail || cleanPhone, cleanPhone, rawPassword, userRole, b?.nom || "Marché Vert").catch(() => {});
      }).catch(() => {});
    }

    res.status(201).json({ 
      id: user.id, nom: user.nom, email: user.email, telephone: user.telephone, 
      role: user.role, permissions: user.permissions, statut: user.statut,
      generatedPassword: rawPassword,
      mustChangePassword: true
    });
  } catch (err) { next(err); }
});

router.put("/employees/:id", requireRole("admin"), async (req, res, next) => {
  try {
    const targetUser = await User.findOne({ 
      where: { id: req.params.id, boutiqueId: req.boutiqueId, role: { [Op.in]: ["admin", "employe"] } } 
    });
    if (!targetUser) return res.status(404).json({ message: "Utilisateur introuvable." });

    const { nom, email, telephone, motDePasse, role, permissions, statut } = req.body;
    if (targetUser.id === req.user.id && statut === "suspendu") {
      return res.status(400).json({ message: "Vous ne pouvez pas suspendre votre propre compte administrateur." });
    }

    if (nom) targetUser.nom = nom;
    if (email) targetUser.email = email;
    if (telephone !== undefined) targetUser.telephone = telephone;
    if (statut) targetUser.statut = statut;
    
    if (role) {
      targetUser.role = role === "admin" ? "admin" : "employe";
    }

    if (targetUser.role === "admin") {
      targetUser.permissions = ["voir_dashboard", "gerer_banners", "gerer_categories", "gerer_produits", "gerer_commandes", "gerer_parametres", "gerer_utilisateurs"];
    } else if (permissions !== undefined) {
      targetUser.permissions = permissions;
    }

    if (motDePasse && motDePasse.trim()) {
      targetUser.motDePasseHash = await bcrypt.hash(motDePasse.trim(), 10);
    }

    await targetUser.save();
    res.json({ 
      id: targetUser.id, nom: targetUser.nom, email: targetUser.email, telephone: targetUser.telephone, 
      role: targetUser.role, permissions: targetUser.permissions, statut: targetUser.statut 
    });
  } catch (err) { next(err); }
});

router.patch("/employees/:id/status", requireRole("admin"), async (req, res, next) => {
  try {
    const targetUser = await User.findOne({ 
      where: { id: req.params.id, boutiqueId: req.boutiqueId, role: { [Op.in]: ["admin", "employe"] } } 
    });
    if (!targetUser) return res.status(404).json({ message: "Utilisateur introuvable." });
    
    if (targetUser.id === req.user.id) {
      return res.status(400).json({ message: "Vous ne pouvez pas suspendre votre propre compte administrateur." });
    }

    const nouveauStatut = targetUser.statut === "actif" ? "suspendu" : "actif";
    await targetUser.update({ statut: nouveauStatut });
    res.json(targetUser);
  } catch (err) { next(err); }
});

router.delete("/employees/:id", requireRole("admin"), async (req, res, next) => {
  try {
    const targetUser = await User.findOne({ 
      where: { id: req.params.id, boutiqueId: req.boutiqueId, role: { [Op.in]: ["admin", "employe"] } } 
    });
    if (!targetUser) return res.status(404).json({ message: "Utilisateur introuvable." });

    if (targetUser.id === req.user.id) {
      return res.status(400).json({ message: "Vous ne pouvez pas supprimer votre propre compte." });
    }

    // Vérifier si l'utilisateur possède des opérations (commandes passées ou assignées)
    const hasClientOrders = await Order.count({ where: { clientId: targetUser.id } });
    const hasAssignedOrders = await Order.count({ where: { employeAssigneId: targetUser.id } });

    if (hasClientOrders > 0 || hasAssignedOrders > 0) {
      return res.status(400).json({ 
        message: "Impossible de supprimer cet utilisateur car il possède déjà des opérations enregistrées (commandes passées ou ventes gérées). Vous devez plutôt le suspendre.",
        canSuspend: true
      });
    }

    await targetUser.destroy();
    res.json({ message: "Utilisateur supprimé avec succès." });
  } catch (err) { next(err); }
});

/* ---------------------- GESTION DES CLIENTS ---------------------- */

router.get("/clients", async (req, res, next) => {
  try {
    const clients = await User.findAll({
      where: { role: "client", isEmailVerified: true },
      attributes: { exclude: ["motDePasseHash"] },
      order: [["createdAt", "DESC"]]
    });
    res.json(clients);
  } catch (err) { next(err); }
});

router.post("/clients", async (req, res, next) => {
  try {
    const { nom, email, telephone, motDePasse } = req.body;
    const cleanEmail = email ? String(email).trim().toLowerCase() : null;
    const cleanPhone = telephone ? String(telephone).trim() : null;

    if (!nom || !cleanPhone || !motDePasse) {
      return res.status(400).json({ message: "Le nom, le numéro de téléphone et le mot de passe sont requis." });
    }

    const existant = await User.findOne({ 
      where: { [Op.or]: [{ telephone: cleanPhone }, ...(cleanEmail ? [{ email: cleanEmail }] : [])] } 
    });
    if (existant) return res.status(409).json({ message: "Un compte client existe déjà avec ce téléphone ou cet e-mail." });

    const motDePasseHash = await bcrypt.hash(motDePasse, 10);
    const client = await User.create({
      nom: nom.trim(),
      email: cleanEmail,
      telephone: cleanPhone,
      motDePasseHash,
      role: "client",
      statut: "actif",
      isEmailVerified: true
    });

    res.status(201).json({
      id: client.id, nom: client.nom, email: client.email, telephone: client.telephone,
      role: client.role, statut: client.statut, isEmailVerified: client.isEmailVerified
    });
  } catch (err) { next(err); }
});

router.put("/clients/:id", async (req, res, next) => {
  try {
    const client = await User.findOne({ where: { id: req.params.id, role: "client" } });
    if (!client) return res.status(404).json({ message: "Client introuvable." });

    const { nom, email, telephone, motDePasse, statut } = req.body;
    if (nom) client.nom = nom.trim();
    if (email !== undefined) client.email = email ? String(email).trim().toLowerCase() : null;
    if (telephone !== undefined) client.telephone = telephone ? String(telephone).trim() : null;
    if (statut) client.statut = statut;

    if (motDePasse && motDePasse.trim()) {
      client.motDePasseHash = await bcrypt.hash(motDePasse.trim(), 10);
    }

    await client.save();
    res.json({
      id: client.id, nom: client.nom, email: client.email, telephone: client.telephone,
      role: client.role, statut: client.statut, isEmailVerified: client.isEmailVerified
    });
  } catch (err) { next(err); }
});

router.patch("/clients/:id/status", async (req, res, next) => {
  try {
    const client = await User.findOne({ where: { id: req.params.id, role: "client" } });
    if (!client) return res.status(404).json({ message: "Client introuvable." });

    const nouveauStatut = client.statut === "actif" ? "suspendu" : "actif";
    await client.update({ statut: nouveauStatut });
    res.json({ id: client.id, nom: client.nom, statut: client.statut });
  } catch (err) { next(err); }
});

router.delete("/clients/:id", async (req, res, next) => {
  try {
    const client = await User.findOne({ where: { id: req.params.id, role: "client" } });
    if (!client) return res.status(404).json({ message: "Client introuvable." });

    // Vérifier si le client possède des commandes enregistrées
    const hasOrders = await Order.count({ where: { clientId: client.id } });
    if (hasOrders > 0) {
      return res.status(400).json({ 
        message: "Impossible de supprimer ce client car il possède déjà des commandes enregistrées. Vous devez plutôt le suspendre.",
        canSuspend: true
      });
    }

    await client.destroy();
    res.json({ message: "Compte client supprimé avec succès." });
  } catch (err) { next(err); }
});


/* ---------------------- PARAMÈTRES BOUTIQUE ---------------------- */

router.get("/boutique", async (req, res, next) => {
  try {
    res.json(await Boutique.findByPk(req.boutiqueId));
  } catch (err) { next(err); }
});

router.put("/boutique", requireRole("admin"), async (req, res, next) => {
  try {
    const boutique = await Boutique.findByPk(req.boutiqueId);
    const { 
      nom, logoUrl, couleurPrincipale, devise, fraisLivraison, zonesLivraison, 
      bannerSlides, sideBanners, telephone, telephone2, adresse, adresse2, adresseRetrait, 
      emailContact, aProposText, aProposImageUrl, horairesOuverture, facebookUrl, instagramUrl, 
      tiktokUrl, whatsappNumber, modesPaiement, modulesActifs,
      customDomain, stripePublishableKey, stripeSecretKey, stripeAccountId,
      paydunyaMasterKey, paydunyaPrivateKey, paydunyaToken,
      unitechApiKey, reloadlyClientId, reloadlyClientSecret, reloadlySandbox, dingApiKey
    } = req.body;

    let targetCustomDomain = boutique.customDomain;
    if (customDomain !== undefined) {
      const formattedDomain = customDomain ? customDomain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '') : null;
      if (formattedDomain && formattedDomain !== boutique.customDomain) {
        const existant = await Boutique.findOne({ where: { customDomain: formattedDomain, id: { [Op.ne]: boutique.id } } });
        if (existant) {
          return res.status(409).json({ message: "Ce nom de domaine personnalisé est déjà utilisé par une autre boutique." });
        }
      }
      targetCustomDomain = formattedDomain || null;
    }

    await boutique.update({ 
      nom, logoUrl, couleurPrincipale, devise: devise || boutique.devise || "KMF", fraisLivraison, zonesLivraison, 
      bannerSlides, sideBanners, telephone, telephone2, adresse, adresse2, adresseRetrait, 
      emailContact, aProposText, aProposImageUrl, horairesOuverture, facebookUrl, instagramUrl, 
      tiktokUrl, whatsappNumber, modesPaiement, modulesActifs,
      customDomain: targetCustomDomain,
      ...(stripePublishableKey !== undefined && { stripePublishableKey }),
      ...(stripeSecretKey !== undefined && { stripeSecretKey }),
      ...(stripeAccountId !== undefined && { stripeAccountId }),
      ...(paydunyaMasterKey !== undefined && { paydunyaMasterKey }),
      ...(paydunyaPrivateKey !== undefined && { paydunyaPrivateKey }),
      ...(paydunyaToken !== undefined && { paydunyaToken }),
      ...(unitechApiKey !== undefined && { unitechApiKey }),
      ...(reloadlyClientId !== undefined && { reloadlyClientId }),
      ...(reloadlyClientSecret !== undefined && { reloadlyClientSecret }),
      ...(reloadlySandbox !== undefined && { reloadlySandbox }),
      ...(dingApiKey !== undefined && { dingApiKey })
    });
    purgeCache();
    broadcast("boutique_updated", { boutiqueId: req.boutiqueId });
    res.json(boutique);
  } catch (err) { next(err); }
});

/* ---------------------- VENTE DIRECTE (POS CAISSE) ---------------------- */

router.post("/ventes/directe", async (req, res, next) => {
  try {
    const { items, clientNom, clientTelephone, moyenPaiement } = req.body;
    if (!items || !items.length) {
      return res.status(400).json({ message: "Le panier de vente est vide." });
    }

    // Client par défaut ou client renseigné
    let client = null;
    if (clientTelephone || clientNom) {
      const emailGuest = `client_${Date.now()}@marche-vert.local`;
      [client] = await User.findOrCreate({
        where: { telephone: clientTelephone || "non_renseigne", boutiqueId: req.boutiqueId },
        defaults: {
          nom: clientNom || "Client comptoir",
          email: emailGuest,
          motDePasseHash: "guest_cashier",
          role: "client"
        }
      });
    } else {
      [client] = await User.findOrCreate({
        where: { email: `comptoir_${req.boutiqueId}@marche-vert.local` },
        defaults: {
          nom: "Client comptoir",
          telephone: "00000000",
          motDePasseHash: "guest_cashier",
          role: "client",
          boutiqueId: req.boutiqueId
        }
      });
    }

    // Calcul sous-total et vérification des stocks
    let sousTotal = 0;
    for (const it of items) {
      const p = await Product.findOne({ where: { id: it.productId, boutiqueId: req.boutiqueId } });
      if (!p) return res.status(404).json({ message: `Produit ID ${it.productId} introuvable.` });
      const prixEffectif = p.enPromo && p.prixPromo ? Number(p.prixPromo) : Number(p.prix);
      it.prixUnitaire = prixEffectif;
      sousTotal += prixEffectif * it.quantite;
    }

    // Création de la commande directe (statut "recuperee" / effectuée)
    const order = await Order.create({
      boutiqueId: req.boutiqueId,
      clientId: client.id,
      statut: "recuperee",
      modeLivraison: "retrait",
      adresseLivraison: "Achat direct en boutique / comptoir",
      moyenPaiement: moyenPaiement || "cash",
      typeVente: "vente_directe",
      employeAssigneId: req.user.id,
      sousTotal,
      fraisLivraison: 0,
      total: sousTotal
    });

    // Enregistrement des items et décrémentation directe des stocks
    for (const it of items) {
      await OrderItem.create({
        orderId: order.id,
        productId: it.productId,
        quantite: it.quantite,
        prixUnitaire: it.prixUnitaire
      });

      const p = await Product.findByPk(it.productId);
      if (p) {
        p.stock = Math.max(0, p.stock - it.quantite);
        p.ventesCount = (p.ventesCount || 0) + it.quantite;
        await p.save();
      }
    }

    const fullOrder = await Order.findByPk(order.id, {
      include: [
        { model: OrderItem, as: "items", include: [{ model: Product, as: "product" }] },
        { model: User, as: "client", attributes: ["nom", "telephone"] },
        { model: User, as: "employeAssigne", attributes: ["nom"] }
      ]
    });

    purgeCache();
    broadcast("order_created", { orderId: order.id, clientId: client.id, boutiqueId: req.boutiqueId });
    broadcast("product_updated", { boutiqueId: req.boutiqueId });

    res.status(201).json(fullOrder);
  } catch (err) { next(err); }
});

/* ---------------------- GESTION DES FOURNISSEURS ---------------------- */

router.get("/fournisseurs", async (req, res, next) => {
  try {
    const list = await Fournisseur.findAll({ 
      where: { boutiqueId: req.boutiqueId },
      order: [["createdAt", "DESC"]]
    });
    res.json(list);
  } catch (err) { next(err); }
});

router.post("/fournisseurs", requireRole("admin", "employe"), async (req, res, next) => {
  try {
    const fourn = await Fournisseur.create({ ...req.body, boutiqueId: req.boutiqueId });
    res.status(201).json(fourn);
  } catch (err) { next(err); }
});

router.put("/fournisseurs/:id", requireRole("admin", "employe"), async (req, res, next) => {
  try {
    const fourn = await Fournisseur.findOne({ where: { id: req.params.id, boutiqueId: req.boutiqueId } });
    if (!fourn) return res.status(404).json({ message: "Fournisseur introuvable." });
    await fourn.update(req.body);
    res.json(fourn);
  } catch (err) { next(err); }
});

router.delete("/fournisseurs/:id", requireRole("admin"), async (req, res, next) => {
  try {
    const fourn = await Fournisseur.findOne({ where: { id: req.params.id, boutiqueId: req.boutiqueId } });
    if (!fourn) return res.status(404).json({ message: "Fournisseur introuvable." });
    await fourn.destroy();
    res.json({ message: "Fournisseur supprimé." });
  } catch (err) { next(err); }
});

/* ---------------------- GESTION DES UNITÉS DE VENTE ---------------------- */

router.get("/unites", async (req, res, next) => {
  try {
    let list = await UniteVente.findAll({ where: { boutiqueId: req.boutiqueId } });
    if (list.length === 0) {
      const defaults = [
        { nom: "Kilogramme", abbreviation: "Kg", boutiqueId: req.boutiqueId },
        { nom: "Litre", abbreviation: "Litre", boutiqueId: req.boutiqueId },
        { nom: "Pièce / Unité", abbreviation: "Pièce", boutiqueId: req.boutiqueId },
        { nom: "Carton", abbreviation: "Carton", boutiqueId: req.boutiqueId },
        { nom: "Sac", abbreviation: "Sac", boutiqueId: req.boutiqueId },
        { nom: "Bouteille", abbreviation: "Bouteille", boutiqueId: req.boutiqueId },
        { nom: "Paquet / Pack", abbreviation: "Paquet", boutiqueId: req.boutiqueId }
      ];
      await UniteVente.bulkCreate(defaults);
      list = await UniteVente.findAll({ where: { boutiqueId: req.boutiqueId } });
    }
    res.json(list);
  } catch (err) { next(err); }
});

router.post("/unites", requireRole("admin", "employe"), async (req, res, next) => {
  try {
    const unite = await UniteVente.create({ ...req.body, boutiqueId: req.boutiqueId });
    res.status(201).json(unite);
  } catch (err) { next(err); }
});

router.put("/unites/:id", requireRole("admin", "employe"), async (req, res, next) => {
  try {
    const unite = await UniteVente.findOne({ where: { id: req.params.id, boutiqueId: req.boutiqueId } });
    if (!unite) return res.status(404).json({ message: "Unité introuvable." });
    await unite.update(req.body);
    res.json(unite);
  } catch (err) { next(err); }
});

router.delete("/unites/:id", requireRole("admin"), async (req, res, next) => {
  try {
    const unite = await UniteVente.findOne({ where: { id: req.params.id, boutiqueId: req.boutiqueId } });
    if (!unite) return res.status(404).json({ message: "Unité introuvable." });
    await unite.destroy();
    res.json({ message: "Unité supprimée." });
  } catch (err) { next(err); }
});

/* ---------------------- GESTION DES ACHATS & APPROVISIONNEMENTS ---------------------- */

router.get("/achats", async (req, res, next) => {
  try {
    const list = await Achat.findAll({
      where: { boutiqueId: req.boutiqueId },
      include: [
        { model: Product, as: "product" },
        { model: Fournisseur, as: "fournisseur" }
      ],
      order: [["createdAt", "DESC"]]
    });
    res.json(list);
  } catch (err) { next(err); }
});

router.post("/achats", requireRole("admin", "employe"), async (req, res, next) => {
  try {
    const { productId, fournisseurId, quantite, prixAchatUnitaire, notes } = req.body;
    const prod = await Product.findOne({ where: { id: productId, boutiqueId: req.boutiqueId } });
    if (!prod) return res.status(404).json({ message: "Produit introuvable." });

    const qty = Number(quantite) || 1;
    const unitPrice = Number(prixAchatUnitaire) || 0;
    const totalAchat = qty * unitPrice;

    const achat = await Achat.create({
      boutiqueId: req.boutiqueId,
      productId: prod.id,
      fournisseurId: fournisseurId || null,
      quantite: qty,
      prixAchatUnitaire: unitPrice,
      totalAchat,
      notes: notes || ""
    });

    // Mise à jour automatique du stock et du prix/coût d'achat du produit
    prod.stock = (prod.stock || 0) + qty;
    if (unitPrice > 0) {
      prod.coutAchat = unitPrice;
    }
    await prod.save();
    purgeCache();
    broadcast("product_updated", { productId: prod.id, boutiqueId: req.boutiqueId });

    const fullAchat = await Achat.findByPk(achat.id, {
      include: [
        { model: Product, as: "product" },
        { model: Fournisseur, as: "fournisseur" }
      ]
    });

    res.status(201).json(fullAchat);
  } catch (err) { next(err); }
});

/* ---------------------- GESTION DES MARQUES ---------------------- */

router.get("/marques", async (req, res, next) => {
  try {
    const list = await Marque.findAll({
      where: { boutiqueId: req.boutiqueId },
      include: [{ model: Product, as: "produits", attributes: ["id"] }],
      order: [["nom", "ASC"]]
    });
    res.json(list);
  } catch (err) { next(err); }
});

router.post("/marques", requireRole("admin", "employe"), async (req, res, next) => {
  try {
    const { nom, logoUrl, description } = req.body;
    if (!nom || !nom.trim()) return res.status(400).json({ message: "Le nom de la marque est requis." });
    const marque = await Marque.create({
      nom: nom.trim(),
      logoUrl: logoUrl || null,
      description: description || null,
      boutiqueId: req.boutiqueId
    });
    purgeCache();
    broadcast("boutique_updated", { boutiqueId: req.boutiqueId });
    res.status(201).json(marque);
  } catch (err) { next(err); }
});

router.put("/marques/:id", requireRole("admin", "employe"), async (req, res, next) => {
  try {
    const marque = await Marque.findOne({ where: { id: req.params.id, boutiqueId: req.boutiqueId } });
    if (!marque) return res.status(404).json({ message: "Marque introuvable." });
    await marque.update(req.body);
    purgeCache();
    broadcast("boutique_updated", { boutiqueId: req.boutiqueId });
    res.json(marque);
  } catch (err) { next(err); }
});

router.delete("/marques/:id", requireRole("admin"), async (req, res, next) => {
  try {
    const marque = await Marque.findOne({ where: { id: req.params.id, boutiqueId: req.boutiqueId } });
    if (!marque) return res.status(404).json({ message: "Marque introuvable." });
    await Product.update({ marqueId: null }, { where: { marqueId: marque.id, boutiqueId: req.boutiqueId } });
    await marque.destroy();
    purgeCache();
    broadcast("boutique_updated", { boutiqueId: req.boutiqueId });
    res.json({ message: "Marque supprimée avec succès." });
  } catch (err) { next(err); }
});

module.exports = router;
