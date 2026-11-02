const express = require("express");
const bcrypt = require("bcryptjs");
const { Op } = require("sequelize");
const { sequelize, Product, Category, Order, OrderItem, User, Boutique, Notification, Review, Famille, Fournisseur, UniteVente, Achat, Marque } = require("../models");
const { authenticate, requireRole, requireOwnBoutique } = require("../middleware/auth");
const { getCache, setCache, clearCachePattern } = require("../config/cache");
const { broadcast } = require("../utils/broadcaster");
const { sendOrderStatusEmail } = require("../services/email.service");

const router = express.Router();

function purgeCache() {
  clearCachePattern("/api/store").catch(() => {});
  clearCachePattern("store").catch(() => {});
  clearCachePattern("/api/boutique").catch(() => {});
  clearCachePattern("admin:").catch(() => {});
}

router.use(authenticate, requireRole("admin", "employe"), requireOwnBoutique);

function requirePerm(...permKeys) {
  return (req, res, next) => {
    if (req.user.role === "admin" || req.user.role === "super_admin") {
      return next();
    }
    const perms = Array.isArray(req.user.permissions) ? req.user.permissions : [];
    const flattened = permKeys.flat();
    const hasAny = flattened.some(key => perms.includes(key));
    if (hasAny) {
      return next();
    }
    return res.status(403).json({
      message: "Action non autorisée. Vous ne possédez pas les autorisations nécessaires pour cette opération."
    });
  };
}

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

    // ── DASHBOARD ADMINISTRATEUR 100% DYNAMIQUE ──
    const periode = req.query.periode || "7d"; // "today" | "7d" | "30d" | "month" | "year" | "all"
    const now = new Date();

    const orders = await Order.findAll({
      where: { boutiqueId, statut: { [Op.ne]: "annulee" } },
      include: [
        { model: OrderItem, as: "items", include: [{ model: Product, as: "product" }] },
        { model: User, as: "client", attributes: ["id", "nom", "telephone"] }
      ],
      order: [["createdAt", "DESC"]]
    });

    // Filtre de la période sélectionnée
    const isWithinPeriod = (createdAt) => {
      if (!createdAt) return false;
      const d = new Date(createdAt);
      if (periode === "today") {
        return d.toDateString() === now.toDateString();
      }
      if (periode === "7d") {
        const limit = new Date(now);
        limit.setDate(limit.getDate() - 7);
        return d >= limit;
      }
      if (periode === "30d") {
        const limit = new Date(now);
        limit.setDate(limit.getDate() - 30);
        return d >= limit;
      }
      if (periode === "month") {
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      }
      if (periode === "year") {
        return d.getFullYear() === now.getFullYear();
      }
      return true; // "all"
    };

    const filteredOrders = orders.filter(o => isWithinPeriod(o.createdAt));
    const activeOrders = filteredOrders.length > 0 ? filteredOrders : orders;

    // Métriques Financières
    const chiffreAffaires = filteredOrders.reduce((s, o) => s + Number(o.total || 0), 0);
    const chiffreAffairesGlobal = orders.reduce((s, o) => s + Number(o.total || 0), 0);

    const beneficeNet = filteredOrders.reduce((s, o) => {
      return s + (o.items || []).reduce((ss, it) => ss + (Number(it.prixUnitaire) - (it.product ? Number(it.product.coutAchat || 0) : 0)) * (it.quantite || 1), 0);
    }, 0);

    const nbCommandes = filteredOrders.length;
    const nbCommandesGlobal = orders.length;
    const panierMoyen = nbCommandes > 0 ? Math.round(chiffreAffaires / nbCommandes) : 0;

    // Créances & Reste à recouvrer
    const creances = orders.filter(o => Number(o.montantRestant || 0) > 0);
    const resteARecouvrerTotal = creances.reduce((s, o) => s + Number(o.montantRestant || 0), 0);
    const nbVentesCredit = creances.length;

    // 1. Évolution réelle du Chiffre d'Affaires
    let evolutionCA = [];
    const dayNames = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
    const monthNames = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];

    if (periode === "today") {
      // Blocs horaires d'aujourd'hui
      for (let h = 8; h <= 20; h += 2) {
        const hLabel = `${String(h).padStart(2, "0")}h`;
        const nextH = h + 2;
        const matching = orders.filter(o => {
          if (!o.createdAt) return false;
          const od = new Date(o.createdAt);
          return od.toDateString() === now.toDateString() && od.getHours() >= h && od.getHours() < nextH;
        });
        const ca = matching.reduce((s, o) => s + Number(o.total || 0), 0);
        evolutionCA.push({
          jour: hLabel,
          dateLabel: `${hLabel} - ${String(nextH).padStart(2, "0")}h`,
          ca,
          nb: matching.length
        });
      }
    } else if (periode === "month") {
      const curYear = now.getFullYear();
      const curMonth = now.getMonth();
      const daysCount = new Date(curYear, curMonth + 1, 0).getDate();
      for (let dNum = 1; dNum <= daysCount; dNum++) {
        const dateStr = `${curYear}-${String(curMonth + 1).padStart(2, "0")}-${String(dNum).padStart(2, "0")}`;
        const matching = orders.filter(o => o.createdAt && o.createdAt.toISOString().substring(0, 10) === dateStr);
        const ca = matching.reduce((s, o) => s + Number(o.total || 0), 0);
        evolutionCA.push({
          jour: String(dNum),
          dateLabel: `${dNum} ${monthNames[curMonth]}`,
          ca,
          nb: matching.length
        });
      }
    } else if (periode === "year" || (periode === "all" && orders.length > 50)) {
      const curYear = now.getFullYear();
      for (let m = 0; m < 12; m++) {
        const mStr = `${curYear}-${String(m + 1).padStart(2, "0")}`;
        const matching = orders.filter(o => o.createdAt && o.createdAt.toISOString().substring(0, 7) === mStr);
        const ca = matching.reduce((s, o) => s + Number(o.total || 0), 0);
        evolutionCA.push({
          jour: monthNames[m],
          dateLabel: `${monthNames[m]} ${curYear}`,
          ca,
          nb: matching.length
        });
      }
    } else {
      // 7 jours par défaut (ou 30 jours)
      const countDays = periode === "30d" ? 30 : 7;
      for (let i = countDays - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().substring(0, 10);
        const matching = orders.filter(o => o.createdAt && o.createdAt.toISOString().substring(0, 10) === dateStr);
        const ca = matching.reduce((s, o) => s + Number(o.total || 0), 0);
        evolutionCA.push({
          jour: countDays <= 7 ? dayNames[d.getDay()] : `${d.getDate()}/${d.getMonth() + 1}`,
          dateLabel: `${d.getDate()} ${monthNames[d.getMonth()]}`,
          ca,
          nb: matching.length
        });
      }
    }

    // 2. Répartition réelle des Modes de Paiement
    const payMap = {
      cash: { name: "Espèces (Cash)", value: 0, montant: 0, fill: "#10B981" },
      mobile: { name: "Mobile Money (MVola/Orange)", value: 0, montant: 0, fill: "#F59E0B" },
      carte: { name: "Carte Bancaire / Stripe", value: 0, montant: 0, fill: "#06B6D4" },
      wero: { name: "Wero", value: 0, montant: 0, fill: "#8B5CF6" },
      autre: { name: "Autre moyen", value: 0, montant: 0, fill: "#94A3B8" }
    };
    (filteredOrders.length > 0 ? filteredOrders : orders).forEach(o => {
      const mp = (o.moyenPaiement || "cash").toLowerCase();
      const tot = Number(o.total || 0);
      if (mp === "cash" || mp === "especes") {
        payMap.cash.value += 1;
        payMap.cash.montant += tot;
      } else if (["mvola", "orange", "wave", "telma", "airtel"].includes(mp)) {
        payMap.mobile.value += 1;
        payMap.mobile.montant += tot;
      } else if (["stripe", "carte", "card", "visa", "mastercard"].includes(mp)) {
        payMap.carte.value += 1;
        payMap.carte.montant += tot;
      } else if (mp === "wero") {
        payMap.wero.value += 1;
        payMap.wero.montant += tot;
      } else {
        payMap.autre.value += 1;
        payMap.autre.montant += tot;
      }
    });
    const repartitionPaiements = Object.values(payMap).filter(p => p.value > 0);
    if (repartitionPaiements.length === 0) {
      repartitionPaiements.push({ name: "Espèces (Cash)", value: 1, montant: 0, fill: "#10B981" });
    }

    // 3. Répartition réelle des Canaux de Vente
    let posCount = 0, posCA = 0;
    let webCount = 0, webCA = 0;
    let recCount = 0, recCA = 0;
    (filteredOrders.length > 0 ? filteredOrders : orders).forEach(o => {
      const isRecharge = o.typeVente === "recharge_mobile" || o.notes?.includes("recharge_mobile");
      const isPOS = !isRecharge && (o.typeVente === "vente_directe" || o.modeLivraison === "retrait");
      const tot = Number(o.total || 0);
      if (isRecharge) {
        recCount += 1; recCA += tot;
      } else if (isPOS) {
        posCount += 1; posCA += tot;
      } else {
        webCount += 1; webCA += tot;
      }
    });
    const repartitionCanaux = [
      { name: "Vente Directe (POS)", count: posCount, montant: posCA, fill: "#10B981" },
      { name: "Commande en Ligne", count: webCount, montant: webCA, fill: "#3B82F6" },
      { name: "Recharge Mobile", count: recCount, montant: recCA, fill: "#F59E0B" }
    ].filter(c => c.count > 0);

    // 4. Classement Réel des Vendeurs / Employés
    const empMap = {};
    (filteredOrders.length > 0 ? filteredOrders : orders).forEach(o => {
      const empName = o.creeParNom || "Caisse Principale";
      if (!empMap[empName]) {
        empMap[empName] = { nom: empName, nbVentes: 0, totalCA: 0 };
      }
      empMap[empName].nbVentes += 1;
      empMap[empName].totalCA += Number(o.total || 0);
    });
    const topEmployes = Object.values(empMap).sort((a, b) => b.totalCA - a.totalCA).slice(0, 5);

    // 5. Dernières Ventes Récentes (Live feed)
    const dernieresVentes = orders.slice(0, 6).map(o => ({
      id: o.id,
      clientNom: o.client?.nom || o.nomClient || "Client Achat direct",
      telephone: o.client?.telephone || o.telephoneClient || "",
      total: Number(o.total || 0),
      moyenPaiement: o.moyenPaiement || "cash",
      statut: o.statut,
      statutPaiement: o.statutPaiement || (Number(o.montantRestant || 0) > 0 ? "partiel" : "paye"),
      montantRestant: Number(o.montantRestant || 0),
      dateEcheance: o.dateEcheance,
      createdAt: o.createdAt,
      typeVente: o.typeVente,
      itemsCount: o.items?.length || 1,
      vendeur: o.creeParNom || "anicha"
    }));

    // Clients & Produits
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

    const noteMoyenneGlobale = totalReviews > 0 ? Number((sumNotes / totalReviews).toFixed(1)) : 5.0;

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

    const valeurStockVente = produits.reduce((sum, p) => sum + (Number(p.stock || 0) * Number(p.prixPromo || p.prix || 0)), 0);
    const valeurStockAchat = produits.reduce((sum, p) => sum + (Number(p.stock || 0) * Number(p.coutAchat || 0)), 0);
    const totalVentesCount = prodsWithStats.reduce((sum, p) => sum + Number(p.ventesCount || 0), 0);

    res.json({
      isEmploye: false,
      periode,
      chiffreAffaires,
      chiffreAffairesGlobal,
      beneficeNet,
      valeurStockVente,
      valeurStockAchat,
      totalVentesCount,
      nbCommandes,
      nbCommandesGlobal,
      panierMoyen,
      totalClients,
      totalReviews,
      noteMoyenneGlobale,
      resteARecouvrerTotal,
      nbVentesCredit,
      evolutionCA,
      repartitionPaiements,
      repartitionCanaux,
      topEmployes,
      dernieresVentes,
      stockFaibleCount: stockFaible.length,
      stockFaibleList: stockFaible,
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
    const cacheKey = `admin:familles:${req.boutiqueId}`;
    const cached = await getCache(cacheKey);
    if (cached) return res.json(cached);

    let list = await Famille.findAll({ where: { boutiqueId: req.boutiqueId } });
    if (list.length === 0) {
      const defaults = [
        { nom: "Alimentation", boutiqueId: req.boutiqueId },
        { nom: "Cosmétique", boutiqueId: req.boutiqueId },
        { nom: "Maison & Entretien", boutiqueId: req.boutiqueId }
      ];
      await Famille.bulkCreate(defaults);
      list = await Famille.findAll({ where: { boutiqueId: req.boutiqueId } });
    }
    await setCache(cacheKey, list, 300);
    res.json(list);
  } catch (err) { next(err); }
});

router.post("/familles", async (req, res, next) => {
  try {
    const fam = await Famille.create({ ...req.body, boutiqueId: req.boutiqueId });
    purgeCache();
    res.status(201).json(fam);
  } catch (err) { next(err); }
});

router.put("/familles/:id", async (req, res, next) => {
  try {
    const fam = await Famille.findOne({ where: { id: req.params.id, boutiqueId: req.boutiqueId } });
    if (!fam) return res.status(404).json({ message: "Famille introuvable." });
    await fam.update(req.body);
    purgeCache();
    res.json(fam);
  } catch (err) { next(err); }
});

router.delete("/familles/:id", async (req, res, next) => {
  try {
    const fam = await Famille.findOne({ where: { id: req.params.id, boutiqueId: req.boutiqueId } });
    if (!fam) return res.status(404).json({ message: "Famille introuvable." });
    await fam.destroy();
    purgeCache();
    res.json({ message: "Famille supprimée." });
  } catch (err) { next(err); }
});

/* ---------------------- CATÉGORIES ---------------------- */

router.get("/categories", async (req, res, next) => {
  try {
    const cacheKey = `admin:categories:${req.boutiqueId}`;
    const cached = await getCache(cacheKey);
    if (cached) return res.json(cached);

    const categories = await Category.findAll({ where: { boutiqueId: req.boutiqueId } });
    await setCache(cacheKey, categories, 300);
    res.json(categories);
  } catch (err) { next(err); }
});

router.post("/categories", requirePerm("gerer_categories"), async (req, res, next) => {
  try {
    const cat = await Category.create({ ...req.body, boutiqueId: req.boutiqueId });
    purgeCache();
    broadcast("category_updated", { boutiqueId: req.boutiqueId });
    res.status(201).json(cat);
  } catch (err) { next(err); }
});

router.put("/categories/:id", requirePerm("gerer_categories"), async (req, res, next) => {
  try {
    const cat = await Category.findOne({ where: { id: req.params.id, boutiqueId: req.boutiqueId } });
    if (!cat) return res.status(404).json({ message: "Catégorie introuvable." });
    await cat.update(req.body);
    purgeCache();
    broadcast("category_updated", { categoryId: cat.id, boutiqueId: req.boutiqueId });
    res.json(cat);
  } catch (err) { next(err); }
});

router.delete("/categories/:id", requirePerm("gerer_categories"), async (req, res, next) => {
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
    const isPos = req.query.pos === "true";
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : null;
    const page = req.query.page ? Math.max(1, parseInt(req.query.page, 10)) : 1;
    const search = (req.query.search || "").trim();
    const categoryId = req.query.categoryId || null;
    const cacheKey = `admin:products:${req.boutiqueId}:${isPos ? "pos" : "all"}:${limit || "nolim"}:${page}:${search}:${categoryId || "all"}`;

    const cached = await getCache(cacheKey);
    if (cached) {
      res.setHeader("X-Cache", "HIT");
      return res.json(cached);
    }

    const where = { boutiqueId: req.boutiqueId };
    if (search) {
      where[Op.or] = [
        { nom: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } }
      ];
    }
    if (categoryId) {
      where.categoryId = categoryId;
    }

    const options = {
      where,
      order: [["createdAt", "DESC"]]
    };

    if (isPos) {
      options.attributes = [
        "id", "nom", "prix", "prixPromo", "coutAchat", "stock", "seuilAlerte", 
        "unite", "imageUrl", "categoryId", "famille", "visibleEnLigne", "etat", "marqueId",
        "dernierPrix", "enPromo", "poids", "variantesCouleurs", "variantesOptions"
      ];
      options.include = [
        { model: Category, attributes: ["id", "nom"] },
        { model: Marque, as: "marque", attributes: ["id", "nom"] }
      ];
    } else {
      options.include = [
        Category, 
        { model: Fournisseur, as: "fournisseur" }, 
        { model: Marque, as: "marque" }
      ];
    }

    if (limit && limit > 0) {
      options.limit = limit;
      options.offset = (page - 1) * limit;
      const { count, rows } = await Product.findAndCountAll(options);
      const result = {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
        products: rows
      };
      await setCache(cacheKey, result, 120);
      res.setHeader("X-Cache", "MISS");
      return res.json(result);
    }

    const products = await Product.findAll(options);
    await setCache(cacheKey, products, 120);
    res.setHeader("X-Cache", "MISS");
    res.json(products);
  } catch (err) { next(err); }
});

router.post("/products", requirePerm("gerer_produits"), async (req, res, next) => {
  try {
    const product = await Product.create({ 
      ...req.body, 
      boutiqueId: req.boutiqueId,
      creeParId: req.user.id,
      creeParNom: req.user.nom || req.user.email
    });

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
        notes: "Création initiale de la fiche produit",
        creeParId: req.user.id,
        creeParNom: req.user.nom || req.user.email
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

router.put("/products/:id", requirePerm("gerer_produits"), async (req, res, next) => {
  try {
    const product = await Product.findOne({ where: { id: req.params.id, boutiqueId: req.boutiqueId } });
    if (!product) return res.status(404).json({ message: "Produit introuvable." });

    const ancienStock = Number(product.stock || 0);
    const nouveauStock = req.body.stock !== undefined ? Number(req.body.stock) : ancienStock;

    // Si le stock augmente, créer automatiquement un enregistrement d'approvisionnement / achat
    if (nouveauStock > ancienStock) {
      const diff = nouveauStock - ancienStock;
      const unitPrice = Number(req.body.coutAchat !== undefined ? req.body.coutAchat : (product.coutAchat || 0));
      await Achat.create({
        boutiqueId: req.boutiqueId,
        productId: product.id,
        fournisseurId: req.body.fournisseurId || product.fournisseurId || null,
        quantite: diff,
        prixAchatUnitaire: unitPrice,
        totalAchat: diff * unitPrice,
        notes: "Réapprovisionnement automatique via mise à jour du produit",
        creeParId: req.user.id,
        creeParNom: req.user.nom || req.user.email
      }).catch(() => {});
    }

    await product.update({
      ...req.body,
      modifieParId: req.user.id,
      modifieParNom: req.user.nom || req.user.email
    });

    const fullProduct = await Product.findByPk(product.id, {
      include: [Category, { model: Fournisseur, as: "fournisseur" }, { model: Marque, as: "marque" }]
    });

    purgeCache();
    broadcast("product_updated", { productId: product.id, boutiqueId: req.boutiqueId });
    res.json(fullProduct);
  } catch (err) { next(err); }
});

router.delete("/products/:id", requirePerm("gerer_produits"), async (req, res, next) => {
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
    const isDevis = req.query.typeDocument === "devis";
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : null;
    const page = req.query.page ? Math.max(1, parseInt(req.query.page, 10)) : 1;
    const cacheKey = `admin:orders:${req.boutiqueId}:${req.user.id}:${req.query.typeDocument || "all"}:${req.query.statut || "all"}:${req.query.statutPaiement || "all"}:${limit || "nolim"}:${page}`;

    const cached = await getCache(cacheKey);
    if (cached) {
      res.setHeader("X-Cache", "HIT");
      return res.json(cached);
    }

    const where = { boutiqueId: req.boutiqueId };

    if (isDevis) {
      where.typeDocument = "devis";
    } else {
      where.statut = { [Op.notIn]: ["en_attente_paiement", "devis"] };
      where.typeDocument = { [Op.ne]: "devis" };
      if (req.query.statut) where.statut = req.query.statut;
      if (req.query.statutPaiement && req.query.statutPaiement !== "tous") where.statutPaiement = req.query.statutPaiement;
      if (req.query.typeDocument && req.query.typeDocument !== "tous") where.typeDocument = req.query.typeDocument;
    }

    // Filtrage pour les employés : ne voir que ce qui lui a été attribué ou créé par lui,
    // sauf s'il possède la permission explicite "voir_toutes_ventes" ou est administrateur.
    if (req.user.role === "employe") {
      const perms = Array.isArray(req.user.permissions) ? req.user.permissions : [];
      if (!perms.includes("voir_toutes_ventes")) {
        where[Op.or] = [
          { employeAssigneId: req.user.id },
          { creeParId: req.user.id }
        ];
      }
    }

    const options = {
      where,
      include: [
        { model: OrderItem, as: "items", include: [{ model: Product, as: "product" }] }, 
        { model: User, as: "client", attributes: ["nom", "telephone"] },
        { model: User, as: "employeAssigne", attributes: ["id", "nom", "role"] }
      ],
      order: [["createdAt", "DESC"]]
    };

    if (limit && limit > 0) {
      options.limit = limit;
      options.offset = (page - 1) * limit;
      const { count, rows } = await Order.findAndCountAll(options);
      const result = {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
        orders: rows
      };
      await setCache(cacheKey, result, 60);
      res.setHeader("X-Cache", "MISS");
      return res.json(result);
    }

    const orders = await Order.findAll(options);
    await setCache(cacheKey, orders, 60);
    res.setHeader("X-Cache", "MISS");
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

router.put("/orders/:id", async (req, res, next) => {
  try {
    const order = await Order.findOne({
      where: { id: req.params.id, boutiqueId: req.boutiqueId },
      include: [{ model: OrderItem, as: "items" }]
    });
    if (!order) return res.status(404).json({ message: "Commande/Vente introuvable." });

    const { 
      moyenPaiement, adresseLivraison, notesAdmin, statut,
      statutPaiement, montantRecu, montantRestant, dateEcheance,
      versementComplementaire
    } = req.body;

    // Vérification des droits pour les employés
    if (req.user.role === "employe") {
      const perms = Array.isArray(req.user.permissions) ? req.user.permissions : [];
      if (versementComplementaire !== undefined && Number(versementComplementaire) > 0) {
        if (!perms.includes("encaisser_paiement")) {
          return res.status(403).json({ message: "Vous n'avez pas l'autorisation d'encaisser un paiement." });
        }
      } else {
        if (!perms.includes("modifier_vente") && !perms.includes("gerer_commandes")) {
          return res.status(403).json({ message: "Vous n'avez pas l'autorisation de modifier cette commande ou vente." });
        }
      }
    }

    const updates = {};
    if (moyenPaiement !== undefined) updates.moyenPaiement = moyenPaiement;
    if (adresseLivraison !== undefined) updates.adresseLivraison = adresseLivraison;
    if (statut !== undefined) updates.statut = statut;
    if (dateEcheance !== undefined) updates.dateEcheance = dateEcheance;

    // Enregistrement d'un versement complémentaire (règlement dette / acompte)
    if (versementComplementaire !== undefined && Number(versementComplementaire) > 0) {
      const vers = Number(versementComplementaire);
      const total = Number(order.total || 0);
      const ancienRecu = Number(order.montantRecu || 0);
      const nouveauRecu = ancienRecu + vers;
      const nouveauRestant = Math.max(0, total - nouveauRecu);
      const nouvelleMonnaie = nouveauRecu > total ? (nouveauRecu - total) : 0;

      updates.montantRecu = nouveauRecu;
      updates.montantRestant = nouveauRestant;
      updates.monnaieRendue = nouvelleMonnaie;
      updates.statutPaiement = nouveauRestant <= 0 ? "paye" : "partiel";
      
      const dateNow = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
      const versementNote = `Versement de ${vers} effectué le ${dateNow} par ${req.user.nom || req.user.email}`;
      updates.notesAdmin = order.notesAdmin ? `${order.notesAdmin}\n${versementNote}` : versementNote;
    } else {
      if (notesAdmin !== undefined) updates.notesAdmin = notesAdmin;
      if (montantRecu !== undefined) updates.montantRecu = Number(montantRecu);
      if (montantRestant !== undefined) updates.montantRestant = Number(montantRestant);
      if (statutPaiement !== undefined) updates.statutPaiement = statutPaiement;
    }

    updates.modifieParId = req.user.id;
    updates.modifieParNom = req.user.nom || req.user.email;

    await order.update(updates);

    const fullOrder = await Order.findByPk(order.id, {
      include: [
        { model: OrderItem, as: "items", include: [{ model: Product, as: "product" }] },
        { model: User, as: "client", attributes: ["nom", "telephone"] },
        { model: User, as: "employeAssigne", attributes: ["id", "nom", "role"] }
      ]
    });

    purgeCache();
    broadcast("order_updated", { orderId: order.id, boutiqueId: req.boutiqueId });
    res.json(fullOrder);
  } catch (err) { next(err); }
});

router.delete("/orders/:id", async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const order = await Order.findOne({
      where: { id: req.params.id, boutiqueId: req.boutiqueId },
      include: [{ model: OrderItem, as: "items" }],
      transaction: t
    });
    if (!order) {
      await t.rollback();
      return res.status(404).json({ message: "Commande/Vente introuvable." });
    }

    if (req.user.role === "employe") {
      const perms = Array.isArray(req.user.permissions) ? req.user.permissions : [];
      if (order.typeDocument === "devis") {
        if (!perms.includes("gerer_devis") && !perms.includes("supprimer_vente")) {
          await t.rollback();
          return res.status(403).json({ message: "Vous n'avez pas l'autorisation de supprimer ce devis." });
        }
      } else {
        if (!perms.includes("supprimer_vente")) {
          await t.rollback();
          return res.status(403).json({ message: "Vous n'avez pas l'autorisation de supprimer une vente." });
        }
      }
    }

    // Si la commande n'était ni annulée ni un devis, réinjecter les articles en stock
    if (order.statut !== "annulee" && order.typeDocument !== "devis" && order.items && order.items.length > 0) {
      for (const item of order.items) {
        const prod = await Product.findByPk(item.productId, { transaction: t });
        if (prod) {
          prod.stock = (prod.stock || 0) + item.quantite;
          prod.ventesCount = Math.max(0, (prod.ventesCount || 0) - item.quantite);
          await prod.save({ transaction: t });
        }
      }
    }

    await OrderItem.destroy({ where: { orderId: order.id }, transaction: t });
    await order.destroy({ transaction: t });

    await t.commit();
    purgeCache();
    broadcast("order_deleted", { orderId: req.params.id, boutiqueId: req.boutiqueId });
    broadcast("product_updated", { boutiqueId: req.boutiqueId });

    res.json({ message: "Vente/Commande supprimée avec succès." });
  } catch (err) {
    if (t && !t.finished) await t.rollback();
    next(err);
  }
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

router.post("/clients", requirePerm("gerer_clients"), async (req, res, next) => {
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

router.put("/clients/:id", requirePerm("gerer_clients"), async (req, res, next) => {
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

router.patch("/clients/:id/status", requirePerm("gerer_clients"), async (req, res, next) => {
  try {
    const client = await User.findOne({ where: { id: req.params.id, role: "client" } });
    if (!client) return res.status(404).json({ message: "Client introuvable." });

    const nouveauStatut = client.statut === "actif" ? "suspendu" : "actif";
    await client.update({ statut: nouveauStatut });
    res.json({ id: client.id, nom: client.nom, statut: client.statut });
  } catch (err) { next(err); }
});

router.delete("/clients/:id", requirePerm("gerer_clients"), async (req, res, next) => {
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

    let cleanModesPaiement = boutique.modesPaiement;
    if (modesPaiement !== undefined) {
      let parsedModes = modesPaiement;
      if (typeof parsedModes === "string") {
        try { parsedModes = JSON.parse(parsedModes); } catch (e) { parsedModes = {}; }
      }
      if (parsedModes && typeof parsedModes === "object") {
        cleanModesPaiement = {
          especes: parsedModes.especes !== undefined ? !!parsedModes.especes : true,
          mvola: parsedModes.mvola !== undefined ? !!parsedModes.mvola : true,
          holam: parsedModes.holam !== undefined ? !!parsedModes.holam : true,
          carte: parsedModes.carte !== undefined ? !!parsedModes.carte : false,
          wave: parsedModes.wave !== undefined ? !!parsedModes.wave : false,
          orange: parsedModes.orange !== undefined ? !!parsedModes.orange : false
        };
      }
    }

    if (cleanModesPaiement) {
      boutique.set("modesPaiement", cleanModesPaiement);
      boutique.changed("modesPaiement", true);
    }

    await boutique.update({ 
      nom, logoUrl, couleurPrincipale, devise: devise || boutique.devise || "KMF", fraisLivraison, zonesLivraison, 
      bannerSlides, sideBanners, telephone, telephone2, adresse, adresse2, adresseRetrait, 
      emailContact, aProposText, aProposImageUrl, horairesOuverture, facebookUrl, instagramUrl, 
      tiktokUrl, whatsappNumber, modesPaiement: cleanModesPaiement, modulesActifs,
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
    const { items, clientNom, clientTelephone, moyenPaiement, typeDocument, montantRecu, monnaieRendue, montantRestant, dateEcheance, statutPaiement } = req.body;
    if (!items || !items.length) {
      return res.status(400).json({ message: "Le panier de vente est vide." });
    }

    const isDevis = typeDocument === "devis";

    if (req.user.role === "employe") {
      const perms = Array.isArray(req.user.permissions) ? req.user.permissions : [];
      if (isDevis) {
        if (!perms.includes("gerer_devis") && !perms.includes("gerer_caisse")) {
          return res.status(403).json({ message: "Vous n'avez pas l'autorisation d'émettre des devis." });
        }
      } else {
        if (!perms.includes("gerer_caisse")) {
          return res.status(403).json({ message: "Vous n'avez pas l'autorisation d'utiliser la caisse enregistreuse." });
        }
      }
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

    // Calcul sous-total et vérification des prix
    let sousTotal = 0;
    for (const it of items) {
      const p = await Product.findOne({ where: { id: it.productId, boutiqueId: req.boutiqueId } });
      if (!p) return res.status(404).json({ message: `Produit ID ${it.productId} introuvable.` });
      const basePrix = p.enPromo && p.prixPromo ? Number(p.prixPromo) : Number(p.prix);
      const prixEffectif = (it.prixUnitaire && Number(it.prixUnitaire) > 0) ? Number(it.prixUnitaire) : basePrix;
      it.prixUnitaire = prixEffectif;
      sousTotal += prixEffectif * it.quantite;
    }

    const mRecu = Number(montantRecu !== undefined ? montantRecu : sousTotal);
    const mRendue = Number(monnaieRendue || 0);
    const mRestant = Number(montantRestant !== undefined ? montantRestant : Math.max(0, sousTotal - mRecu));
    
    let computedStatutPaiement = "paye";
    if (isDevis) {
      computedStatutPaiement = "non_paye";
    } else if (statutPaiement) {
      computedStatutPaiement = statutPaiement;
    } else if (mRestant > 0) {
      computedStatutPaiement = mRecu > 0 ? "partiel" : "non_paye";
    }

    // Création de la commande ou du devis
    const order = await Order.create({
      boutiqueId: req.boutiqueId,
      clientId: client.id,
      statut: isDevis ? "en_attente" : "recuperee",
      typeDocument: isDevis ? "devis" : "vente_directe",
      modeLivraison: "retrait",
      adresseLivraison: isDevis ? "Devis / Facture Proforma" : "Achat direct en boutique",
      moyenPaiement: isDevis ? "devis" : (moyenPaiement || "cash"),
      statutPaiement: computedStatutPaiement,
      typeVente: isDevis ? "devis" : "vente_directe",
      employeAssigneId: req.user.id,
      creeParId: req.user.id,
      creeParNom: req.user.nom || req.user.email,
      sousTotal,
      fraisLivraison: 0,
      total: sousTotal,
      montantRecu: mRecu,
      monnaieRendue: mRendue,
      montantRestant: mRestant,
      dateEcheance: dateEcheance ? new Date(dateEcheance) : null
    });

    // Enregistrement des items et décrémentation des stocks (uniquement si vente réelle, pas pour un devis !)
    for (const it of items) {
      await OrderItem.create({
        orderId: order.id,
        productId: it.productId,
        quantite: it.quantite,
        prixUnitaire: it.prixUnitaire
      });

      if (!isDevis) {
        const p = await Product.findByPk(it.productId);
        if (p) {
          p.stock = Math.max(0, p.stock - it.quantite);
          p.ventesCount = (p.ventesCount || 0) + it.quantite;

          // Décrémenter le stock spécifique de la variante couleur si renseignée
          if (it.selectedColor && it.selectedColor.nom && Array.isArray(p.variantesCouleurs)) {
            p.variantesCouleurs = p.variantesCouleurs.map(vc => {
              if (vc && vc.nom && vc.nom.toLowerCase().trim() === it.selectedColor.nom.toLowerCase().trim()) {
                const curStock = (vc.stock !== undefined && vc.stock !== "") ? Number(vc.stock) : p.stock;
                return { ...vc, stock: Math.max(0, curStock - it.quantite) };
              }
              return vc;
            });
          }

          // Décrémenter le stock spécifique de la variante option si renseignée
          if (it.selectedOption && it.selectedOption.nom && p.variantesOptions) {
            const rawOpt = p.variantesOptions;
            if (rawOpt && typeof rawOpt === "object") {
              const optList = Array.isArray(rawOpt.options) ? rawOpt.options : (Array.isArray(rawOpt) ? rawOpt : []);
              const updatedOptions = optList.map(vo => {
                if (vo && vo.nom && vo.nom.toLowerCase().trim() === it.selectedOption.nom.toLowerCase().trim()) {
                  const curStock = (vo.stock !== undefined && vo.stock !== "") ? Number(vo.stock) : p.stock;
                  return { ...vo, stock: Math.max(0, curStock - it.quantite) };
                }
                return vo;
              });
              p.variantesOptions = Array.isArray(rawOpt.options) ? { ...rawOpt, options: updatedOptions } : updatedOptions;
            }
          }

          await p.save();
        }
      }
    }

    // Sauvegarder les variantes dans les notes pour la traçabilité & facture
    const variantNotes = items
      .filter(it => it.variantLabel)
      .map(it => `${it.nom || `Produit #${it.productId}`} (${it.variantLabel}) x${it.quantite}`)
      .join(", ");
    if (variantNotes) {
      order.notes = order.notes ? `${order.notes} | ${variantNotes}` : variantNotes;
      await order.save();
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
    if (!isDevis) {
      broadcast("product_updated", { boutiqueId: req.boutiqueId });
    }

    res.status(201).json(fullOrder);
  } catch (err) { next(err); }
});

// Modification complète d'une vente directe (panier, quantités, articles, stocks recalculés)
router.put("/ventes/directe/:id", requirePerm("modifier_vente"), async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const order = await Order.findOne({
      where: { id: req.params.id, boutiqueId: req.boutiqueId },
      include: [{ model: OrderItem, as: "items" }],
      transaction: t
    });
    if (!order) {
      await t.rollback();
      return res.status(404).json({ message: "Vente introuvable." });
    }

    const { items, clientNom, clientTelephone, moyenPaiement, montantRecu, monnaieRendue, montantRestant, dateEcheance, statutPaiement } = req.body;
    if (!items || !items.length) {
      await t.rollback();
      return res.status(400).json({ message: "Le panier de vente ne peut pas être vide." });
    }

    // 1. Réintégrer les anciens stocks si ce n'était pas un devis
    if (order.typeDocument !== "devis" && order.items && order.items.length > 0) {
      for (const oldIt of order.items) {
        const p = await Product.findByPk(oldIt.productId, { transaction: t });
        if (p) {
          p.stock = (p.stock || 0) + oldIt.quantite;
          p.ventesCount = Math.max(0, (p.ventesCount || 0) - oldIt.quantite);
          await p.save({ transaction: t });
        }
      }
    }

    // 2. Supprimer les anciens items
    await OrderItem.destroy({ where: { orderId: order.id }, transaction: t });

    // 3. Calculer les nouveaux totaux et vérifier les produits
    let sousTotal = 0;
    for (const it of items) {
      const p = await Product.findOne({ where: { id: it.productId, boutiqueId: req.boutiqueId }, transaction: t });
      if (!p) {
        await t.rollback();
        return res.status(404).json({ message: `Produit ID ${it.productId} introuvable.` });
      }
      const basePrix = p.enPromo && p.prixPromo ? Number(p.prixPromo) : Number(p.prix);
      const prixEffectif = (it.prixUnitaire && Number(it.prixUnitaire) > 0) ? Number(it.prixUnitaire) : basePrix;
      it.prixUnitaire = prixEffectif;
      sousTotal += prixEffectif * it.quantite;

      // Décrémenter les stocks (global + variantes)
      if (order.typeDocument !== "devis") {
        p.stock = Math.max(0, (p.stock || 0) - it.quantite);
        p.ventesCount = (p.ventesCount || 0) + it.quantite;

        if (it.selectedColor && it.selectedColor.nom && Array.isArray(p.variantesCouleurs)) {
          p.variantesCouleurs = p.variantesCouleurs.map(vc => {
            if (vc && vc.nom && vc.nom.toLowerCase().trim() === it.selectedColor.nom.toLowerCase().trim()) {
              const curStock = (vc.stock !== undefined && vc.stock !== "") ? Number(vc.stock) : p.stock;
              return { ...vc, stock: Math.max(0, curStock - it.quantite) };
            }
            return vc;
          });
        }

        if (it.selectedOption && it.selectedOption.nom && p.variantesOptions) {
          const rawOpt = p.variantesOptions;
          if (rawOpt && typeof rawOpt === "object") {
            const optList = Array.isArray(rawOpt.options) ? rawOpt.options : (Array.isArray(rawOpt) ? rawOpt : []);
            const updatedOptions = optList.map(vo => {
              if (vo && vo.nom && vo.nom.toLowerCase().trim() === it.selectedOption.nom.toLowerCase().trim()) {
                const curStock = (vo.stock !== undefined && vo.stock !== "") ? Number(vo.stock) : p.stock;
                return { ...vo, stock: Math.max(0, curStock - it.quantite) };
              }
              return vo;
            });
            p.variantesOptions = Array.isArray(rawOpt.options) ? { ...rawOpt, options: updatedOptions } : updatedOptions;
          }
        }

        await p.save({ transaction: t });
      }

      await OrderItem.create({
        orderId: order.id,
        productId: it.productId,
        quantite: it.quantite,
        prixUnitaire: it.prixUnitaire
      }, { transaction: t });
    }

    // 4. Mettre à jour le client
    if (clientTelephone || clientNom) {
      if (order.clientId) {
        const cl = await User.findByPk(order.clientId, { transaction: t });
        if (cl) {
          if (clientNom) cl.nom = clientNom;
          if (clientTelephone) cl.telephone = clientTelephone;
          await cl.save({ transaction: t });
        }
      }
    }

    const mRecu = Number(montantRecu !== undefined ? montantRecu : sousTotal);
    const mRendue = Number(monnaieRendue !== undefined ? monnaieRendue : (mRecu > sousTotal ? mRecu - sousTotal : 0));
    const mRestant = Number(montantRestant !== undefined ? montantRestant : Math.max(0, sousTotal - mRecu));
    
    let computedStatutPaiement = "paye";
    if (order.typeDocument === "devis") {
      computedStatutPaiement = "non_paye";
    } else if (statutPaiement) {
      computedStatutPaiement = statutPaiement;
    } else if (mRestant > 0) {
      computedStatutPaiement = mRecu > 0 ? "partiel" : "non_paye";
    }

    await order.update({
      sousTotal,
      total: sousTotal,
      moyenPaiement: moyenPaiement || order.moyenPaiement,
      montantRecu: mRecu,
      monnaieRendue: mRendue,
      montantRestant: mRestant,
      statutPaiement: computedStatutPaiement,
      dateEcheance: dateEcheance ? new Date(dateEcheance) : null,
      modifieParId: req.user.id,
      modifieParNom: req.user.nom || req.user.email
    }, { transaction: t });

    await t.commit();

    const fullOrder = await Order.findByPk(order.id, {
      include: [
        { model: OrderItem, as: "items", include: [{ model: Product, as: "product" }] },
        { model: User, as: "client", attributes: ["nom", "telephone"] },
        { model: User, as: "employeAssigne", attributes: ["nom"] }
      ]
    });

    purgeCache();
    broadcast("order_updated", { orderId: order.id, boutiqueId: req.boutiqueId });
    broadcast("product_updated", { boutiqueId: req.boutiqueId });
    res.json(fullOrder);
  } catch (err) {
    if (t && !t.finished) await t.rollback();
    next(err);
  }
});

// Conversion d'un devis en vente directe réelle avec débit de stock
router.post("/ventes/devis/:id/convertir", requirePerm("gerer_devis", "gerer_caisse"), async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const order = await Order.findOne({
      where: { id: req.params.id, boutiqueId: req.boutiqueId, typeDocument: "devis" },
      include: [{ model: OrderItem, as: "items" }],
      transaction: t
    });
    if (!order) {
      await t.rollback();
      return res.status(404).json({ message: "Devis introuvable ou déjà converti." });
    }

    // Décrémenter les stocks des produits
    for (const item of order.items) {
      const prod = await Product.findByPk(item.productId, { transaction: t });
      if (prod) {
        prod.stock = Math.max(0, (prod.stock || 0) - item.quantite);
        prod.ventesCount = (prod.ventesCount || 0) + item.quantite;
        await prod.save({ transaction: t });
      }
    }

    await order.update({
      typeDocument: "vente_directe",
      typeVente: "vente_directe",
      statut: "recuperee",
      moyenPaiement: req.body.moyenPaiement || "cash",
      adresseLivraison: "Converti depuis Devis - Achat direct en boutique",
      modifieParId: req.user.id,
      modifieParNom: req.user.nom || req.user.email
    }, { transaction: t });

    await t.commit();
    purgeCache();
    broadcast("order_updated", { orderId: order.id, boutiqueId: req.boutiqueId });
    broadcast("product_updated", { boutiqueId: req.boutiqueId });

    const fullOrder = await Order.findByPk(order.id, {
      include: [
        { model: OrderItem, as: "items", include: [{ model: Product, as: "product" }] },
        { model: User, as: "client", attributes: ["nom", "telephone"] },
        { model: User, as: "employeAssigne", attributes: ["nom"] }
      ]
    });
    res.json(fullOrder);
  } catch (err) {
    if (t && !t.finished) await t.rollback();
    next(err);
  }
});

/* ---------------------- GESTION DES FOURNISSEURS ---------------------- */

router.get("/fournisseurs", async (req, res, next) => {
  try {
    const cacheKey = `admin:fournisseurs:${req.boutiqueId}`;
    const cached = await getCache(cacheKey);
    if (cached) return res.json(cached);

    const list = await Fournisseur.findAll({ 
      where: { boutiqueId: req.boutiqueId },
      order: [["createdAt", "DESC"]]
    });
    await setCache(cacheKey, list, 300);
    res.json(list);
  } catch (err) { next(err); }
});

router.post("/fournisseurs", requirePerm("gerer_fournisseurs"), async (req, res, next) => {
  try {
    const fourn = await Fournisseur.create({ ...req.body, boutiqueId: req.boutiqueId });
    purgeCache();
    res.status(201).json(fourn);
  } catch (err) { next(err); }
});

router.put("/fournisseurs/:id", requirePerm("gerer_fournisseurs"), async (req, res, next) => {
  try {
    const fourn = await Fournisseur.findOne({ where: { id: req.params.id, boutiqueId: req.boutiqueId } });
    if (!fourn) return res.status(404).json({ message: "Fournisseur introuvable." });
    await fourn.update(req.body);
    purgeCache();
    res.json(fourn);
  } catch (err) { next(err); }
});

router.delete("/fournisseurs/:id", requirePerm("gerer_fournisseurs"), async (req, res, next) => {
  try {
    const fourn = await Fournisseur.findOne({ where: { id: req.params.id, boutiqueId: req.boutiqueId } });
    if (!fourn) return res.status(404).json({ message: "Fournisseur introuvable." });
    await fourn.destroy();
    purgeCache();
    res.json({ message: "Fournisseur supprimé." });
  } catch (err) { next(err); }
});

/* ---------------------- GESTION DES UNITÉS DE VENTE ---------------------- */

router.get("/unites", async (req, res, next) => {
  try {
    const cacheKey = `admin:unites:${req.boutiqueId}`;
    const cached = await getCache(cacheKey);
    if (cached) return res.json(cached);

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
    await setCache(cacheKey, list, 300);
    res.json(list);
  } catch (err) { next(err); }
});

router.post("/unites", requirePerm("gerer_unites"), async (req, res, next) => {
  try {
    const unite = await UniteVente.create({ ...req.body, boutiqueId: req.boutiqueId });
    purgeCache();
    res.status(201).json(unite);
  } catch (err) { next(err); }
});

router.put("/unites/:id", requirePerm("gerer_unites"), async (req, res, next) => {
  try {
    const unite = await UniteVente.findOne({ where: { id: req.params.id, boutiqueId: req.boutiqueId } });
    if (!unite) return res.status(404).json({ message: "Unité introuvable." });
    await unite.update(req.body);
    purgeCache();
    res.json(unite);
  } catch (err) { next(err); }
});

router.delete("/unites/:id", requirePerm("gerer_unites"), async (req, res, next) => {
  try {
    const unite = await UniteVente.findOne({ where: { id: req.params.id, boutiqueId: req.boutiqueId } });
    if (!unite) return res.status(404).json({ message: "Unité introuvable." });
    await unite.destroy();
    purgeCache();
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

router.post("/achats", requirePerm("gerer_achats"), async (req, res, next) => {
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
      notes: notes || "",
      creeParId: req.user.id,
      creeParNom: req.user.nom || req.user.email
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

router.put("/achats/:id", requirePerm("gerer_achats"), async (req, res, next) => {
  try {
    const achat = await Achat.findOne({ where: { id: req.params.id, boutiqueId: req.boutiqueId } });
    if (!achat) return res.status(404).json({ message: "Achat introuvable." });

    const { fournisseurId, quantite, prixAchatUnitaire, notes } = req.body;
    const oldQty = Number(achat.quantite) || 0;
    const newQty = quantite !== undefined ? Number(quantite) : oldQty;
    const diffQty = newQty - oldQty;

    const unitPrice = prixAchatUnitaire !== undefined ? Number(prixAchatUnitaire) : (Number(achat.prixAchatUnitaire) || 0);

    await achat.update({
      fournisseurId: fournisseurId !== undefined ? (fournisseurId ? Number(fournisseurId) : null) : achat.fournisseurId,
      quantite: newQty,
      prixAchatUnitaire: unitPrice,
      totalAchat: newQty * unitPrice,
      notes: notes !== undefined ? notes : achat.notes,
      modifieParId: req.user.id,
      modifieParNom: req.user.nom || req.user.email
    });

    // Ajuster le stock du produit si la quantité a changé
    if (diffQty !== 0 && achat.productId) {
      const prod = await Product.findByPk(achat.productId);
      if (prod) {
        prod.stock = Math.max(0, (prod.stock || 0) + diffQty);
        if (unitPrice > 0) prod.coutAchat = unitPrice;
        await prod.save();
        purgeCache();
        broadcast("product_updated", { productId: prod.id, boutiqueId: req.boutiqueId });
      }
    }

    const fullAchat = await Achat.findByPk(achat.id, {
      include: [
        { model: Product, as: "product" },
        { model: Fournisseur, as: "fournisseur" }
      ]
    });
    res.json(fullAchat);
  } catch (err) { next(err); }
});

router.delete("/achats/:id", requirePerm("gerer_achats"), async (req, res, next) => {
  try {
    const achat = await Achat.findOne({ where: { id: req.params.id, boutiqueId: req.boutiqueId } });
    if (!achat) return res.status(404).json({ message: "Achat introuvable." });

    // Réduire le stock du produit de la quantité achetée supprimée
    if (achat.productId && achat.quantite > 0) {
      const prod = await Product.findByPk(achat.productId);
      if (prod) {
        prod.stock = Math.max(0, (prod.stock || 0) - Number(achat.quantite));
        await prod.save();
        purgeCache();
        broadcast("product_updated", { productId: prod.id, boutiqueId: req.boutiqueId });
      }
    }

    await achat.destroy();
    res.json({ message: "Achat supprimé avec succès." });
  } catch (err) { next(err); }
});

/* ---------------------- GESTION DES MARQUES ---------------------- */

router.get("/marques", async (req, res, next) => {
  try {
    const cacheKey = `admin:marques:${req.boutiqueId}`;
    const cached = await getCache(cacheKey);
    if (cached) return res.json(cached);

    const list = await Marque.findAll({
      where: { boutiqueId: req.boutiqueId },
      include: [{ model: Product, as: "produits", attributes: ["id"] }],
      order: [["nom", "ASC"]]
    });
    await setCache(cacheKey, list, 300);
    res.json(list);
  } catch (err) { next(err); }
});

router.post("/marques", requirePerm("gerer_marques"), async (req, res, next) => {
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

router.put("/marques/:id", requirePerm("gerer_marques"), async (req, res, next) => {
  try {
    const marque = await Marque.findOne({ where: { id: req.params.id, boutiqueId: req.boutiqueId } });
    if (!marque) return res.status(404).json({ message: "Marque introuvable." });
    await marque.update(req.body);
    purgeCache();
    broadcast("boutique_updated", { boutiqueId: req.boutiqueId });
    res.json(marque);
  } catch (err) { next(err); }
});

router.delete("/marques/:id", requirePerm("gerer_marques"), async (req, res, next) => {
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

/* ---------------------- BILAN FINANCIER & STATISTIQUES AVANCÉES ---------------------- */

router.get("/bilan", async (req, res, next) => {
  try {
    const boutiqueId = req.boutiqueId;

    if (req.user.role === "employe") {
      const perms = Array.isArray(req.user.permissions) ? req.user.permissions : [];
      if (!perms.includes("voir_bilan")) {
        return res.status(403).json({ message: "Accès refusé au bilan financier." });
      }
    }

    const { period, periode, startDate, endDate, annee, mois, employeId } = req.query;
    const activePeriod = period || periode;

    let dateFilter = {};
    const now = new Date();

    if (startDate && endDate) {
      dateFilter = { [Op.between]: [new Date(startDate), new Date(endDate)] };
    } else if (annee && annee !== "toutes") {
      const yr = parseInt(annee, 10);
      if (mois && mois !== "tous" && mois !== "") {
        const m = parseInt(mois, 10) - 1;
        const start = new Date(yr, m, 1, 0, 0, 0);
        const end = new Date(yr, m + 1, 0, 23, 59, 59);
        dateFilter = { [Op.between]: [start, end] };
      } else {
        const start = new Date(yr, 0, 1, 0, 0, 0);
        const end = new Date(yr, 11, 31, 23, 59, 59);
        dateFilter = { [Op.between]: [start, end] };
      }
    } else if (activePeriod === "today") {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      dateFilter = { [Op.between]: [start, end] };
    } else if (activePeriod === "week") {
      const start = new Date(now);
      start.setDate(now.getDate() - 7);
      dateFilter = { [Op.gte]: start };
    } else if (activePeriod === "month") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFilter = { [Op.gte]: start };
    } else if (activePeriod === "year") {
      const start = new Date(now.getFullYear(), 0, 1);
      dateFilter = { [Op.gte]: start };
    }

    const orderWhere = {
      boutiqueId,
      statut: { [Op.notIn]: ["annulee", "devis", "en_attente_paiement"] },
      typeDocument: { [Op.ne]: "devis" },
      moyenPaiement: { [Op.ne]: "devis" }
    };
    if (dateFilter[Op.between] || dateFilter[Op.gte]) {
      orderWhere.createdAt = dateFilter;
    }
    if (employeId && employeId !== "tous") {
      orderWhere[Op.or] = [
        { employeAssigneId: employeId },
        { creeParId: employeId }
      ];
    } else if (req.user.role === "employe") {
      const perms = Array.isArray(req.user.permissions) ? req.user.permissions : [];
      if (!perms.includes("voir_toutes_ventes")) {
        orderWhere[Op.or] = [
          { employeAssigneId: req.user.id },
          { creeParId: req.user.id }
        ];
      }
    }

    const orders = await Order.findAll({
      where: orderWhere,
      include: [
        { model: OrderItem, as: "items", include: [{ model: Product, as: "product" }] },
        { model: User, as: "employeAssigne", attributes: ["id", "nom", "email"] }
      ],
      order: [["createdAt", "ASC"]]
    });

    const achatWhere = { boutiqueId };
    if (dateFilter[Op.between] || dateFilter[Op.gte]) {
      achatWhere.createdAt = dateFilter;
    }
    const achats = await Achat.findAll({
      where: achatWhere,
      include: [{ model: Product, as: "product" }],
      order: [["createdAt", "ASC"]]
    });

    const totalCA = orders.reduce((s, o) => s + Number(o.total || 0), 0);
    const totalAchats = achats.reduce((s, a) => s + Number(a.totalAchat || 0), 0);

    let totalEncaisse = 0;
    let totalCredit = 0;

    orders.forEach(o => {
      const tot = Number(o.total || 0);
      if (o.statutPaiement === "paye") {
        totalEncaisse += tot;
      } else if (o.statutPaiement === "partiel") {
        const recu = Number(o.montantRecu || 0);
        const restant = Number(o.montantRestant || Math.max(0, tot - recu));
        totalEncaisse += recu;
        totalCredit += restant;
      } else {
        totalCredit += tot;
      }
    });

    // Coût d'achat des produits vendus (COGS)
    let totalCoutVendus = 0;
    const productStats = {};
    const employeStats = {};

    orders.forEach(o => {
      const empName = o.employeAssigne?.nom || o.creeParNom || "Comptoir / Magasin";
      if (!employeStats[empName]) {
        employeStats[empName] = {
          nom: empName,
          nbVentes: 0,
          ventesCount: 0,
          totalCA: 0,
          ca: 0,
          totalEncaisse: 0,
          totalCredit: 0,
          resteAPayer: 0,
          benefice: 0
        };
      }
      employeStats[empName].nbVentes += 1;
      employeStats[empName].ventesCount += 1;
      const orderAmount = Number(o.total || 0);
      employeStats[empName].totalCA += orderAmount;
      employeStats[empName].ca += orderAmount;

      if (o.statutPaiement === "paye") {
        employeStats[empName].totalEncaisse += orderAmount;
      } else if (o.statutPaiement === "partiel") {
        const recu = Number(o.montantRecu || 0);
        const restant = Number(o.montantRestant || Math.max(0, orderAmount - recu));
        employeStats[empName].totalEncaisse += recu;
        employeStats[empName].totalCredit += restant;
        employeStats[empName].resteAPayer += restant;
      } else {
        employeStats[empName].totalCredit += orderAmount;
        employeStats[empName].resteAPayer += orderAmount;
      }

      let orderCout = 0;
      o.items?.forEach(it => {
        const cout = (it.product ? Number(it.product.coutAchat || 0) : 0) * it.quantite;
        const venteTotal = Number(it.prixUnitaire || 0) * it.quantite;
        totalCoutVendus += cout;
        orderCout += cout;

        const pId = it.productId;
        const pNom = it.product?.nom || `Produit #${pId}`;
        if (!productStats[pId]) {
          productStats[pId] = { id: pId, nom: pNom, quantite: 0, ca: 0, marge: 0 };
        }
        productStats[pId].quantite += it.quantite;
        productStats[pId].ca += venteTotal;
        productStats[pId].marge += (venteTotal - cout);
      });

      employeStats[empName].benefice += (Number(o.total || 0) - orderCout);
    });

    const margeBrute = totalCA - totalCoutVendus;
    const beneficeNet = totalCA - totalAchats;

    // Timeline pour Recharts (par date)
    const timelineMap = {};
    orders.forEach(o => {
      const d = new Date(o.createdAt).toISOString().slice(0, 10);
      if (!timelineMap[d]) timelineMap[d] = { date: d, ca: 0, depenses: 0, benefice: 0 };
      timelineMap[d].ca += Number(o.total || 0);
    });
    achats.forEach(a => {
      const d = new Date(a.createdAt).toISOString().slice(0, 10);
      if (!timelineMap[d]) timelineMap[d] = { date: d, ca: 0, depenses: 0, benefice: 0 };
      timelineMap[d].depenses += Number(a.totalAchat || 0);
    });

    const timeline = Object.values(timelineMap)
      .map(t => ({
        ...t,
        achats: t.depenses,
        benefice: t.ca - t.depenses
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    res.json({
      kpis: {
        totalCA,
        totalEncaisse,
        totalCredit,
        totalAchats,
        cogsVentes: totalCoutVendus,
        margeBrute,
        beneficeNet,
        nombreCommandes: orders.length,
        nombreAchats: achats.length
      },
      timeline,
      employeeStats: Object.values(employeStats),
      topProducts: Object.values(productStats).sort((a, b) => b.ca - a.ca).slice(0, 10)
    });
  } catch (err) { next(err); }
});

module.exports = router;
