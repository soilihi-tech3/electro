const sequelize = require("../config/database");
const Boutique = require("./Boutique");
const User = require("./User");
const Category = require("./Category");
const Product = require("./Product");
const Order = require("./Order");
const OrderItem = require("./OrderItem");
const Review = require("./Review");
const Notification = require("./Notification");
const Famille = require("./Famille");
const Fournisseur = require("./Fournisseur");
const UniteVente = require("./UniteVente");
const Achat = require("./Achat");
const Marque = require("./Marque");
const RechargePlan = require("./RechargePlan")(sequelize);

// --- Associations ---

Boutique.hasMany(Famille, { foreignKey: "boutiqueId" });
Famille.belongsTo(Boutique, { foreignKey: "boutiqueId" });

Boutique.hasMany(Fournisseur, { foreignKey: "boutiqueId" });
Fournisseur.belongsTo(Boutique, { foreignKey: "boutiqueId" });

Boutique.hasMany(UniteVente, { foreignKey: "boutiqueId" });
UniteVente.belongsTo(Boutique, { foreignKey: "boutiqueId" });

Boutique.hasMany(Marque, { foreignKey: "boutiqueId" });
Marque.belongsTo(Boutique, { foreignKey: "boutiqueId" });

Marque.hasMany(Product, { foreignKey: "marqueId", as: "produits" });
Product.belongsTo(Marque, { foreignKey: "marqueId", as: "marque" });

Boutique.hasMany(User, { foreignKey: "boutiqueId" });
User.belongsTo(Boutique, { foreignKey: "boutiqueId" });

Boutique.hasMany(Category, { foreignKey: "boutiqueId" });
Category.belongsTo(Boutique, { foreignKey: "boutiqueId" });

Boutique.hasMany(Product, { foreignKey: "boutiqueId" });
Product.belongsTo(Boutique, { foreignKey: "boutiqueId" });

Category.hasMany(Product, { foreignKey: "categoryId" });
Product.belongsTo(Category, { foreignKey: "categoryId" });

Boutique.hasMany(Order, { foreignKey: "boutiqueId" });
Order.belongsTo(Boutique, { foreignKey: "boutiqueId" });

User.hasMany(Order, { foreignKey: "clientId", as: "commandesClient" });
Order.belongsTo(User, { foreignKey: "clientId", as: "client" });

User.hasMany(Order, { foreignKey: "employeAssigneId", as: "commandesAssignees" });
Order.belongsTo(User, { foreignKey: "employeAssigneId", as: "employeAssigne" });

Order.hasMany(OrderItem, { foreignKey: "orderId", as: "items" });
OrderItem.belongsTo(Order, { foreignKey: "orderId" });

Product.hasMany(OrderItem, { foreignKey: "productId" });
OrderItem.belongsTo(Product, { foreignKey: "productId", as: "product" });

Product.hasMany(Review, { foreignKey: "productId", as: "avis" });
Review.belongsTo(Product, { foreignKey: "productId" });

User.hasMany(Review, { foreignKey: "userId" });
Review.belongsTo(User, { foreignKey: "userId", as: "auteur" });

Fournisseur.hasMany(Product, { foreignKey: "fournisseurId", as: "produits" });
Product.belongsTo(Fournisseur, { foreignKey: "fournisseurId", as: "fournisseur" });

User.hasMany(Notification, { foreignKey: "userId" });
Notification.belongsTo(User, { foreignKey: "userId" });

Boutique.hasMany(Achat, { foreignKey: "boutiqueId" });
Achat.belongsTo(Boutique, { foreignKey: "boutiqueId" });

Product.hasMany(Achat, { foreignKey: "productId", as: "achats" });
Achat.belongsTo(Product, { foreignKey: "productId", as: "product" });

Fournisseur.hasMany(Achat, { foreignKey: "fournisseurId", as: "achats" });
Achat.belongsTo(Fournisseur, { foreignKey: "fournisseurId", as: "fournisseur" });

const EmailLog = require("./EmailLog");

Boutique.hasMany(RechargePlan, { foreignKey: "boutiqueId" });
RechargePlan.belongsTo(Boutique, { foreignKey: "boutiqueId" });

module.exports = { 
  sequelize, Boutique, User, Category, Product, Order, OrderItem, 
  Review, Notification, Famille, Fournisseur, UniteVente, Achat, Marque, EmailLog, RechargePlan 
};

