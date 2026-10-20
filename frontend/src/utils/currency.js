/**
 * Gestionnaire dynamique de devises pour le SaaS.
 * Supporte : KMF (Comores), EUR (€), FCFA (XOF), USD ($).
 */

export const CURRENCIES = [
  { code: "KMF", label: "Franc Comorien (KMF)", symbol: "KMF" },
  { code: "EUR", label: "Euro (€)", symbol: "€" },
  { code: "FCFA", label: "Franc CFA (FCFA)", symbol: "FCFA" },
  { code: "USD", label: "Dollar US ($)", symbol: "$" },
];

export const getCurrencySymbol = (devise) => {
  let d = devise;
  if (!d) {
    try {
      const cached = JSON.parse(localStorage.getItem("cached_boutique") || "{}");
      d = cached.devise;
    } catch (e) {}
  }
  if (!d) d = "KMF";

  const clean = String(d).trim().toUpperCase();
  if (clean === "EUR" || clean === "€") return "€";
  if (clean === "USD" || clean === "$") return "$";
  if (clean === "FCFA" || clean === "XOF") return "FCFA";
  if (clean === "KMF" || clean === "FC") return "KMF";
  return d;
};

export const formatPrice = (amount, devise) => {
  const symbol = getCurrencySymbol(devise);
  const num = Number(amount || 0);
  
  // Pour KMF et FCFA, les montants n'ont généralement pas de centimes
  const maxDecimals = (symbol === "KMF" || symbol === "FCFA") ? 0 : 2;
  const formatted = num.toLocaleString("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
  });

  if (symbol === "$") return `$${formatted}`;
  return `${formatted} ${symbol}`;
};

// Alias de compatibilité
export const fcfa = (amount, devise) => formatPrice(amount, devise);
