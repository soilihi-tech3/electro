const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Product = sequelize.define("Product", {
  boutiqueId: { type: DataTypes.INTEGER, allowNull: false },
  categoryId: { type: DataTypes.INTEGER, allowNull: false },
  nom: { type: DataTypes.STRING(150), allowNull: false },
  description: { type: DataTypes.TEXT },
  prix: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  prixPromo: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  enPromo: { type: DataTypes.BOOLEAN, defaultValue: false },
  dateExpiration: { type: DataTypes.DATEONLY, allowNull: true },
  famille: { type: DataTypes.STRING(100), defaultValue: "Alimentation" },
  poids: { type: DataTypes.STRING(50), defaultValue: "1" },
  unite: { type: DataTypes.STRING(50) },
  stock: { type: DataTypes.INTEGER, defaultValue: 0 },
  seuilAlerte: { type: DataTypes.INTEGER, defaultValue: 5 },
  coutAchat: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  fournisseurId: { type: DataTypes.INTEGER, allowNull: true },
  imageUrl: { type: DataTypes.TEXT("long"), allowNull: true },
  imageUrl2: { type: DataTypes.TEXT("long"), allowNull: true },
  ventesCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  isNouveau: { type: DataTypes.BOOLEAN, defaultValue: false },
  noteEtoiles: { type: DataTypes.DECIMAL(2, 1), defaultValue: 5.0 },
  etat: { type: DataTypes.STRING(20), defaultValue: "neuf" }, // 'neuf' | 'occasion'
  marqueId: { type: DataTypes.INTEGER, allowNull: true, field: "marque_id" },
}, { tableName: "products" });

module.exports = Product;
