const bcrypt = require("bcryptjs");
const { Boutique, User, Category, Product, Order, OrderItem, Review, Marque } = require("./models");

/**
 * Insère les données de démonstration et tous les comptes utilisateurs de manière sécurisée et répétable.
 */
async function runSeed() {
  console.log("Initialisation et vérification des données de démonstration dans la base de données...");

  const hash = (pw) => bcrypt.hashSync(pw, 10);

  // --- 1. Super Admin plateforme ---
  await User.findOrCreate({
    where: { email: "superadmin@boutique-saas.com" },
    defaults: {
      nom: "Super Admin",
      email: "superadmin@boutique-saas.com",
      motDePasseHash: hash("SuperAdmin123!"),
      role: "super_admin",
    }
  });

  // --- 2. Bannières Slider de la boutique ---
  const bannerSlides = [
    {
      id: 1,
      title: "Électricité, Électronique & Matériel Pro",
      subtitle: "Large gamme d'accessoires électriques, prises, disjoncteurs et câblage haute sécurité.",
      imageUrl: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1600&q=80",
      buttonText: "Découvrir le catalogue",
      linkUrl: "/catalogue"
    },
    {
      id: 2,
      title: "Climatisation & Ventilation Haute Performance",
      subtitle: "Climatiseurs split Inverter et ventilateurs puissants pour un confort thermique optimal.",
      imageUrl: "https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=1600&q=80",
      buttonText: "Voir les climatiseurs",
      linkUrl: "/catalogue"
    },
    {
      id: 3,
      title: "Outillage & Équipements de Construction",
      subtitle: "Tout pour vos chantiers, installations électriques et travaux de bâtiment.",
      imageUrl: "https://images.unsplash.com/photo-1504917599217-d4dc5ebe6122?auto=format&fit=crop&w=1600&q=80",
      buttonText: "Commander maintenant",
      linkUrl: "/catalogue"
    }
  ];

  // --- 3. Boutique de démonstration ---
  const [boutique] = await Boutique.findOrCreate({
    where: { slug: "electro-pro" },
    defaults: {
      nom: "ElectroMat Pro",
      slug: "electro-pro",
      logoUrl: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=200&q=80",
      couleurPrincipale: "#1565C0",
      devise: "KMF",
      formuleAbonnement: "commission",
      fraisLivraison: 1500,
      zonesLivraison: "Moroni, Mitsamiouli, Foumbouni, Grand Comore, Régions",
      bannerSlides: bannerSlides
    }
  });

  // --- 3.b Marques Référencées ---
  const marquesData = [
    { nom: "Schneider Electric", description: "Spécialiste mondial de la gestion de l'énergie et de la distribution électrique." },
    { nom: "Legrand", description: "Leader des infrastructures électriques et réseaux d'information du bâtiment." },
    { nom: "Philips", description: "Éclairage LED innovant, ampoules et projecteurs basse consommation." },
    { nom: "Panasonic", description: "Climatisation réversible et ventilation haute performance." },
    { nom: "Bosch", description: "Outillage électroportatif professionnel et technologies de construction." }
  ];

  const marquesMap = {};
  for (const m of marquesData) {
    const [mObj] = await Marque.findOrCreate({
      where: { nom: m.nom, boutiqueId: boutique.id },
      defaults: { ...m, boutiqueId: boutique.id }
    });
    marquesMap[m.nom] = mObj;
  }

  // --- 4. Comptes Administrateur, Employés & Client ---
  const usersToSeed = [
    { email: "superadmin@boutique-saas.com", nom: "Super Admin", role: "super_admin", pw: "SuperAdmin123!" },
    { email: "admin@electro-pro.com", nom: "Karim Said (Admin)", role: "admin", boutiqueId: boutique.id, pw: "Admin123!" },
    { email: "technicien@electro-pro.com", nom: "Ibrahim Ali", role: "employe", boutiqueId: boutique.id, pw: "Employe123!", permissions: ["voir_dashboard", "gerer_categories", "gerer_produits", "gerer_commandes"] },
    { email: "vendeur@electro-pro.com", nom: "Fatima Mohamed", role: "employe", boutiqueId: boutique.id, pw: "Employe123!", permissions: ["voir_dashboard", "gerer_commandes"] },
    { email: "client@example.com", nom: "Salim Ahmed", role: "client", pw: "Client123!" },
  ];

  let emp2 = null;
  let clientUser = null;

  for (const u of usersToSeed) {
    let usr = await User.findOne({ where: { email: u.email } });
    if (!usr) {
      usr = await User.create({
        nom: u.nom,
        email: u.email,
        motDePasseHash: hash(u.pw),
        role: u.role,
        boutiqueId: u.boutiqueId || null,
        permissions: u.permissions || null
      });
    } else {
      usr.motDePasseHash = hash(u.pw);
      usr.role = u.role;
      if (u.boutiqueId) usr.boutiqueId = u.boutiqueId;
      if (u.permissions) usr.permissions = u.permissions;
      await usr.save();
    }
    if (u.email === "vendeur@electro-pro.com") emp2 = usr;
    if (u.email === "client@example.com") clientUser = usr;
  }

  // --- 5. Catégories ---
  const catList = [
    { nom: "Climatisation & Froid", famille: "electronique", imageUrl: "https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=400&q=80" },
    { nom: "Ventilation", famille: "electronique", imageUrl: "https://images.unsplash.com/photo-1618220179428-22790b461013?auto=format&fit=crop&w=400&q=80" },
    { nom: "Éclairage & Ampoules", famille: "electricite", imageUrl: "https://images.unsplash.com/photo-1507668077129-56e32842fceb?auto=format&fit=crop&w=400&q=80" },
    { nom: "Prises & Interrupteurs", famille: "electricite", imageUrl: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=400&q=80" },
    { nom: "Câbles & Protection", famille: "electricite", imageUrl: "https://images.unsplash.com/photo-1544724569-5f546fd6f2b5?auto=format&fit=crop&w=400&q=80" },
    { nom: "Outillage & Construction", famille: "construction", imageUrl: "https://images.unsplash.com/photo-1504917599217-d4dc5ebe6122?auto=format&fit=crop&w=400&q=80" },
  ];

  const cats = {};
  for (const c of catList) {
    const [catObj] = await Category.findOrCreate({
      where: { nom: c.nom, boutiqueId: boutique.id },
      defaults: { ...c, boutiqueId: boutique.id }
    });
    cats[c.nom] = catObj;
  }

  // --- 6. Produits ---
  const produitsData = [
    {
      nom: "Climatiseur Split 12000 BTU Inverter", cat: "Climatisation & Froid", marque: "Panasonic", etat: "neuf", prix: 185000, prixPromo: 169000, unite: "unité", stock: 12, seuilAlerte: 3, coutAchat: 140000, ventesCount: 8,
      description: "Climatiseur Split haute efficacité énergétique A++, gaz écologique R32, télécommande incluse et mode silencieux.",
      imageUrl: "https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=600&q=80",
      imageUrl2: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=600&q=80"
    },
    {
      nom: "Ventilateur sur Pied Turbo 16\" Silencieux", cat: "Ventilation", marque: "Panasonic", etat: "neuf", prix: 18500, prixPromo: 15900, unite: "pièce", stock: 35, seuilAlerte: 8, coutAchat: 11000, ventesCount: 24,
      description: "Ventilateur robuste à 3 vitesses, oscillation 90 degrés, hauteur réglable et consommation réduite.",
      imageUrl: "https://images.unsplash.com/photo-1618220179428-22790b461013?auto=format&fit=crop&w=600&q=80",
      imageUrl2: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=600&q=80"
    },
    {
      nom: "Ventilateur Plafonnier 3 Pales 56\"", cat: "Ventilation", marque: "Panasonic", etat: "occasion", prix: 24500, unite: "unité", stock: 20, seuilAlerte: 5, coutAchat: 17000, ventesCount: 15,
      description: "Brasseur d'air plafonnier ultra puissant avec régulateur mural 5 vitesses (Occasion bon état vérifiée).",
      imageUrl: "https://images.unsplash.com/photo-1507668077129-56e32842fceb?auto=format&fit=crop&w=600&q=80",
      imageUrl2: "https://images.unsplash.com/photo-1544724569-5f546fd6f2b5?auto=format&fit=crop&w=600&q=80"
    },
    {
      nom: "Lot de 5 Ampoules LED 15W E27 Blanc Chaud", cat: "Éclairage & Ampoules", marque: "Philips", etat: "neuf", prix: 6500, prixPromo: 5500, unite: "lot", stock: 60, seuilAlerte: 15, coutAchat: 3500, ventesCount: 42,
      description: "Ampoules LED ultra économiques équivalent 100W, longue durée de vie 25 000 heures.",
      imageUrl: "https://images.unsplash.com/photo-1507668077129-56e32842fceb?auto=format&fit=crop&w=600&q=80",
      imageUrl2: "https://images.unsplash.com/photo-1544724569-5f546fd6f2b5?auto=format&fit=crop&w=600&q=80"
    },
    {
      nom: "Projecteur LED Extérieur 50W IP66", cat: "Éclairage & Ampoules", marque: "Philips", etat: "neuf", prix: 14000, unite: "pièce", stock: 25, seuilAlerte: 5, coutAchat: 9000, ventesCount: 11,
      description: "Projecteur LED étanche en aluminium pour cour, jardin et façades de bâtiment.",
      imageUrl: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=600&q=80",
      imageUrl2: "https://images.unsplash.com/photo-1507668077129-56e32842fceb?auto=format&fit=crop&w=600&q=80"
    },
    {
      nom: "Prise Murale Étanche 16A 2P+T", cat: "Prises & Interrupteurs", marque: "Legrand", etat: "neuf", prix: 2500, unite: "pièce", stock: 80, seuilAlerte: 20, coutAchat: 1400, ventesCount: 65,
      description: "Prise murale avec clapet de protection IP55 conforme aux normes de sécurité internationales.",
      imageUrl: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=600&q=80",
      imageUrl2: "https://images.unsplash.com/photo-1544724569-5f546fd6f2b5?auto=format&fit=crop&w=600&q=80"
    },
    {
      nom: "Multiprise Parafoudre 6 Prises + 2 Ports USB", cat: "Prises & Interrupteurs", marque: "Legrand", etat: "occasion", prix: 8500, prixPromo: 7200, unite: "pièce", stock: 30, seuilAlerte: 8, coutAchat: 4800, ventesCount: 19,
      description: "Protection contre les surtensions, câble renforcé 2 mètres et interrupteur lumineux (Occasion reconditionnée).",
      imageUrl: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=600&q=80",
      imageUrl2: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=600&q=80"
    },
    {
      nom: "Rouleau Câble Électrique TH 2.5mm² (100m)", cat: "Câbles & Protection", marque: "Schneider Electric", etat: "neuf", prix: 28000, unite: "rouleau", stock: 18, seuilAlerte: 5, coutAchat: 21000, ventesCount: 14,
      description: "Fil conducteur cuivre rigide standard pour prises de courant et installations domestiques.",
      imageUrl: "https://images.unsplash.com/photo-1544724569-5f546fd6f2b5?auto=format&fit=crop&w=600&q=80",
      imageUrl2: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=600&q=80"
    },
    {
      nom: "Disjoncteur Différentiel 32A Monophasé", cat: "Câbles & Protection", marque: "Schneider Electric", etat: "neuf", prix: 9500, unite: "pièce", stock: 40, seuilAlerte: 10, coutAchat: 6200, ventesCount: 22,
      description: "Disjoncteur de protection magnétothermique 32A courbe C pour tableau électrique.",
      imageUrl: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=600&q=80",
      imageUrl2: "https://images.unsplash.com/photo-1544724569-5f546fd6f2b5?auto=format&fit=crop&w=600&q=80"
    },
    {
      nom: "Perceuse Visseuse Sans Fil 18V avec Coffret", cat: "Outillage & Construction", marque: "Bosch", etat: "occasion", prix: 45000, prixPromo: 39500, unite: "coffret", stock: 15, seuilAlerte: 4, coutAchat: 28000, ventesCount: 9,
      description: "Perceuse percussion sans fil 18V avec 2 batteries et chargeur rapide (Occasion reconditionnée pro).",
      imageUrl: "https://images.unsplash.com/photo-1504917599217-d4dc5ebe6122?auto=format&fit=crop&w=600&q=80",
      imageUrl2: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=600&q=80"
    }
  ];

  const { clearCachePattern } = require("./config/cache");

  const produits = {};
  const nbProduitsExistant = await Product.count({ where: { boutiqueId: boutique.id } });
  
  if (nbProduitsExistant === 0) {
    for (const p of produitsData) {
      const { cat, marque, ...rest } = p;
      const catObj = cats[cat];
      const marqueObj = marquesMap[marque];
      const prodObj = await Product.create({ 
        ...rest, 
        boutiqueId: boutique.id, 
        categoryId: catObj ? catObj.id : null,
        marqueId: marqueObj ? marqueObj.id : null
      });
      produits[p.nom] = prodObj;
    }
  } else {
    // Si produits déjà existants, s'assurer que marqueId et etat sont renseignés
    for (const p of produitsData) {
      const prodObj = await Product.findOne({ where: { nom: p.nom, boutiqueId: boutique.id } });
      if (prodObj) {
        const marqueObj = marquesMap[p.marque];
        await prodObj.update({
          marqueId: prodObj.marqueId || (marqueObj ? marqueObj.id : null),
          etat: prodObj.etat || p.etat || "neuf"
        });
        produits[p.nom] = prodObj;
      }
    }
  }

  // --- 7. Avis & Commandes ---
  const firstProd = produits["Climatiseur Split 12000 BTU Inverter"] || Object.values(produits)[0];
  if (firstProd && clientUser) {
    await Review.findOrCreate({
      where: { productId: firstProd.id, userId: clientUser.id },
      defaults: { productId: firstProd.id, userId: clientUser.id, note: 5, commentaire: "Produit de qualité supérieure, refroidit très rapidement !" }
    });
  }

  const nbOrders = await Order.count({ where: { boutiqueId: boutique.id } });
  if (nbOrders === 0 && firstProd && clientUser && emp2) {
    const order = await Order.create({
      boutiqueId: boutique.id,
      clientId: clientUser.id,
      statut: "en_livraison",
      modeLivraison: "domicile",
      adresseLivraison: "Moroni Centre, Comores",
      moyenPaiement: "cash",
      employeAssigneId: emp2.id,
      sousTotal: Number(firstProd.prixPromo || firstProd.prix),
      fraisLivraison: 1500,
      total: Number(firstProd.prixPromo || firstProd.prix) + 1500,
    });

    await OrderItem.create({
      orderId: order.id,
      productId: firstProd.id,
      quantite: 1,
      prixUnitaire: Number(firstProd.prixPromo || firstProd.prix)
    });
  }

  // Purge du cache d'API pour forcer l'affichage immédiat des nouveaux produits
  await clearCachePattern("cache:/api/store").catch(() => {});

  console.log("Seed exécuté avec succès : comptes et produits insérés dans la base de données !");
}

module.exports = runSeed;

if (require.main === module) {
  const sequelize = require("./config/database");
  sequelize.sync().then(runSeed).then(() => process.exit(0));
}

