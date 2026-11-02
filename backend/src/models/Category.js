const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Category = sequelize.define("Category", {
  boutiqueId: { type: DataTypes.INTEGER, allowNull: false },
  nom: { type: DataTypes.STRING(100), allowNull: false },
  famille: { type: DataTypes.STRING(100), defaultValue: "Alimentation" },
  imageUrl: { type: DataTypes.TEXT("long"), allowNull: true },
  creeParId: { type: DataTypes.INTEGER, allowNull: true, field: "cree_par_id" },
  creeParNom: { type: DataTypes.STRING(150), allowNull: true, field: "cree_par_nom" },
}, { tableName: "categories" });

module.exports = Category;
