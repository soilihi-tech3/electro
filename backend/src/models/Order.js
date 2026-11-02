const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Order = sequelize.define("Order", {
  boutiqueId: { type: DataTypes.INTEGER, allowNull: false },
  clientId: { type: DataTypes.INTEGER, allowNull: false },
  statut: {
    type: DataTypes.STRING(50),
    defaultValue: "en_attente",
  },
  modeLivraison: { type: DataTypes.ENUM("domicile", "retrait"), defaultValue: "domicile" },
  adresseLivraison: { type: DataTypes.STRING(255), allowNull: true },
  moyenPaiement: { type: DataTypes.STRING(50), defaultValue: "cash" },
  typeVente: { type: DataTypes.STRING(30), defaultValue: "commande_enligne" },
  employeAssigneId: { type: DataTypes.INTEGER, allowNull: true },
  stripeSessionId: { type: DataTypes.STRING(255), allowNull: true, field: "stripe_session_id" },
  statutPaiement: { type: DataTypes.STRING(50), defaultValue: "non_paye", field: "statut_paiement" },
  receiptUrl: { type: DataTypes.STRING(500), allowNull: true, field: "receipt_url" },
  sousTotal: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  fraisLivraison: { type: DataTypes.STRING(255), defaultValue: "0" },
  total: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  notes: { type: DataTypes.TEXT, allowNull: true },
  typeDocument: { type: DataTypes.STRING(30), defaultValue: "commande", field: "type_document" }, // 'commande' | 'vente_directe' | 'devis'
  montantRecu: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0, field: "montant_recu" },
  monnaieRendue: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0, field: "monnaie_rendue" },
  montantRestant: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0, field: "montant_restant" },
  dateEcheance: { type: DataTypes.DATEONLY, allowNull: true, field: "date_echeance" },
  creeParId: { type: DataTypes.INTEGER, allowNull: true, field: "cree_par_id" },
  creeParNom: { type: DataTypes.STRING(150), allowNull: true, field: "cree_par_nom" },
  modifieParId: { type: DataTypes.INTEGER, allowNull: true, field: "modifie_par_id" },
  modifieParNom: { type: DataTypes.STRING(150), allowNull: true, field: "modifie_par_nom" },
}, { tableName: "orders" });

module.exports = Order;
