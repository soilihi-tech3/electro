const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

function parseJsonSafe(raw, fallback) {
  if (!raw) return fallback;
  if (typeof raw === "object") return raw;
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw);
      return typeof p === "string" ? JSON.parse(p) : p;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

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
  visibleEnLigne: { type: DataTypes.BOOLEAN, defaultValue: true, field: "visible_en_ligne" },
  dernierPrix: { type: DataTypes.DECIMAL(10, 2), allowNull: true, field: "dernier_prix" }, // Prix plancher de négociation caisse
  variantesCouleurs: {
    type: DataTypes.JSON,
    allowNull: true,
    field: "variantes_couleurs",
    get() {
      const raw = this.getDataValue("variantesCouleurs");
      const parsed = parseJsonSafe(raw, []);
      return Array.isArray(parsed) ? parsed : [];
    },
    set(val) {
      this.setDataValue("variantesCouleurs", typeof val === "string" ? val : JSON.stringify(val ?? []));
    }
  },
  variantesOptions: {
    type: DataTypes.JSON,
    allowNull: true,
    field: "variantes_options",
    get() {
      const raw = this.getDataValue("variantesOptions");
      const parsed = parseJsonSafe(raw, { titre: "Option", options: [] });
      if (Array.isArray(parsed)) {
        return { titre: "Option", options: parsed };
      }
      if (parsed && typeof parsed === "object") {
        return {
          titre: parsed.titre || "Option",
          options: Array.isArray(parsed.options) ? parsed.options : []
        };
      }
      return { titre: "Option", options: [] };
    },
    set(val) {
      this.setDataValue("variantesOptions", typeof val === "string" ? val : JSON.stringify(val ?? { titre: "Option", options: [] }));
    }
  },
  galeriePhotos: {
    type: DataTypes.JSON,
    allowNull: true,
    field: "galerie_photos",
    get() {
      const raw = this.getDataValue("galeriePhotos");
      const parsed = parseJsonSafe(raw, []);
      return Array.isArray(parsed) ? parsed : [];
    },
    set(val) {
      this.setDataValue("galeriePhotos", typeof val === "string" ? val : JSON.stringify(val ?? []));
    }
  },
  creeParId: { type: DataTypes.INTEGER, allowNull: true, field: "cree_par_id" },
  creeParNom: { type: DataTypes.STRING(150), allowNull: true, field: "cree_par_nom" },
  modifieParId: { type: DataTypes.INTEGER, allowNull: true, field: "modifie_par_id" },
  modifieParNom: { type: DataTypes.STRING(150), allowNull: true, field: "modifie_par_nom" },
}, { tableName: "products" });

module.exports = Product;
