const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Marque = sequelize.define("Marque", {
  boutiqueId: { type: DataTypes.INTEGER, allowNull: false },
  nom: { type: DataTypes.STRING(100), allowNull: false },
  logoUrl: { type: DataTypes.TEXT("long"), allowNull: true },
  description: { type: DataTypes.TEXT, allowNull: true }
}, { 
  tableName: "marques",
  timestamps: true 
});

module.exports = Marque;
