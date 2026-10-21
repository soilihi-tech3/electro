const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Boutique = sequelize.define("Boutique", {
  nom: { type: DataTypes.STRING(150), allowNull: false },
  slug: { type: DataTypes.STRING(150), allowNull: false, unique: true },
  logoUrl: { type: DataTypes.TEXT("long") },
  couleurPrincipale: { type: DataTypes.STRING(20), defaultValue: "#1F4D3A" },
  formuleAbonnement: {
    type: DataTypes.STRING(50),
    defaultValue: "standard",
  },
  statut: { type: DataTypes.ENUM("active", "suspendue"), defaultValue: "active" },
  devise: { type: DataTypes.STRING(20), defaultValue: "KMF" },
  fraisLivraison: { type: DataTypes.STRING(255), defaultValue: "1000" },
  zonesLivraison: { type: DataTypes.STRING(255), defaultValue: "" },
  telephone: { type: DataTypes.STRING(20) },
  telephone2: { type: DataTypes.STRING(20) },
  adresse: { type: DataTypes.STRING(255) },
  adresse2: { type: DataTypes.STRING(255) },
  adresseRetrait: { type: DataTypes.TEXT },
  emailContact: { type: DataTypes.STRING(150) },
  aProposText: { type: DataTypes.TEXT },
  aProposImageUrl: { type: DataTypes.TEXT("long") },
  horairesOuverture: { type: DataTypes.STRING(255), defaultValue: "Tous les jours de 08h30 à 23h00" },
  facebookUrl: { type: DataTypes.STRING(255), defaultValue: "" },
  instagramUrl: { type: DataTypes.STRING(255), defaultValue: "" },
  tiktokUrl: { type: DataTypes.STRING(255), defaultValue: "" },
  whatsappNumber: { type: DataTypes.STRING(50), defaultValue: "" },
  bannerSlides: { type: DataTypes.JSON, defaultValue: [] },
  sideBanners: { type: DataTypes.JSON, defaultValue: [] },
  modulesActifs: {
    type: DataTypes.JSON,
    defaultValue: {
      vente: true,
      ventesHistorique: true,
      achats: true,
      fournisseurs: true,
      unites: true,
      homeBanners: true,
      sideBanners: true,
      commandes: true,
      rechargeCredit: true
    }
  },
  modesPaiement: {
    type: DataTypes.JSON,
    defaultValue: {
      especes: true,
      mvola: true,
      holam: true,
      carte: false,
      wave: true,    // Wave via PayTech
      orange: true   // Orange Money via PayTech
    }
  },
  customDomain: { type: DataTypes.STRING(255), allowNull: true },
  stripePublishableKey: { type: DataTypes.STRING(255), allowNull: true, field: "stripe_publishable_key" },
  stripeSecretKey: { type: DataTypes.STRING(255), allowNull: true, field: "stripe_secret_key" },
  stripeAccountId: { type: DataTypes.STRING(255), allowNull: true, field: "stripe_account_id" },
  stripeOnboardingComplete: { type: DataTypes.BOOLEAN, defaultValue: false, field: "stripe_onboarding_complete" },
  // PayDunya (ancien — conservé pour compatibilité)
  paydunyaMasterKey: { type: DataTypes.STRING(255), allowNull: true },
  paydunyaPrivateKey: { type: DataTypes.STRING(255), allowNull: true },
  paydunyaToken: { type: DataTypes.STRING(255), allowNull: true },
  // PayTech — Wave & Orange Money (ancien)
  paytechApiKey:    { type: DataTypes.STRING(255), allowNull: true, field: "paytech_api_key" },
  paytechApiSecret: { type: DataTypes.STRING(255), allowNull: true, field: "paytech_api_secret" },
  // UnitechPay — Wave & Orange Money (nouveau)
  unitechApiKey:        { type: DataTypes.STRING(255), allowNull: true, field: "unitech_api_key" },
  // Reloadly — Envoi direct automatique crédit télécom
  reloadlyClientId:     { type: DataTypes.STRING(255), allowNull: true, field: "reloadly_client_id" },
  reloadlyClientSecret: { type: DataTypes.STRING(255), allowNull: true, field: "reloadly_client_secret" },
  reloadlySandbox:      { type: DataTypes.BOOLEAN, defaultValue: false, field: "reloadly_sandbox" },
  // DingConnect — Envoi direct automatique alternatif via Ding API
  dingApiKey:           { type: DataTypes.STRING(255), allowNull: true, field: "ding_api_key" }
}, { tableName: "boutiques" });

module.exports = Boutique;
