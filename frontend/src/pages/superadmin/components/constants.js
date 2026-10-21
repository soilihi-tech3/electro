import { formatPrice } from "../../../utils/currency.js";
export const fcfa = (n) => formatPrice(n);

export const DEFAULT_MODULES = {
  vente: true,
  ventesHistorique: true,
  achats: true,
  fournisseurs: true,
  unites: true,
  homeBanners: true,
  sideBanners: true,
  commandes: true,
  categories: true,
  produits: true,
  employes: true,
  parametres: true,
  commanderWhatsapp: true,
  rechargeCredit: true
};

export const MODULE_LABELS = [
  { key: "rechargeCredit", label: "Recharge Crédit Mobile", desc: "Permet aux clients d'acheter et d'envoyer du crédit mobile en temps réel par Carte, Wave et Orange Money" },
  { key: "vente", label: "Vente Directe (POS Caisse)", desc: "Gestion des ventes comptoir et encaissement direct" },
  { key: "ventesHistorique", label: "Historique des Ventes", desc: "Consultation du journal des ventes et reçus" },
  { key: "achats", label: "Achats & Stocks", desc: "Approvisionnements, entrées de stock et coût d'achat" },
  { key: "fournisseurs", label: "Fournisseurs", desc: "Gestion des partenaires et fiches fournisseurs" },
  { key: "unites", label: "Unités de vente", desc: "Configuration des unités (Kg, Litre, Pièce, Carton...)" },
  { key: "homeBanners", label: "Home Banners (Slider)", desc: "Bannières principales défilantes de la page d'accueil" },
  { key: "sideBanners", label: "Home Side Banners", desc: "Bannières promotionnelles secondaires" },
  { key: "commandes", label: "Gestion des Commandes", desc: "Suivi, validation et attribution des commandes en ligne" },
  { key: "categories", label: "Catégories", desc: "Gestion des rayons et catégories de produits" },
  { key: "produits", label: "Catalogue Produits", desc: "Gestion des fiches produits, prix et stocks" },
  { key: "employes", label: "Équipe & Rôles", desc: "Gestion des comptes administrateurs, employés et des droits d'accès" },
  { key: "parametres", label: "Paramètres Boutique", desc: "Configuration générale, logos, bannières et informations de la boutique" },
  { key: "commanderWhatsapp", label: "Commander via WhatsApp", desc: "Permet aux clients d'envoyer l'intégralité de leur panier via WhatsApp tout en enregistrant la commande dans la base de données" }
];
