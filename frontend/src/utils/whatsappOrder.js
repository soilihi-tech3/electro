import api, { SLUG } from "../api";
import { formatPrice } from "./currency.js";

export function formatWhatsAppOrderMessage({ boutique, user, cart, subtotal, fraisLivraison, total, orderNumber, form = {} }) {
  const storeName = boutique?.nom || "la boutique";
  const clientName = user?.nom || "Client";
  
  const dateStr = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  let text = `Bonjour *${storeName}* !\n\n`;
  text += `*NOUVELLE COMMANDE* ${orderNumber ? `(#${orderNumber})` : ""}\n`;
  text += `-----------------------------------\n`;
  text += `*Informations du client :*\n`;
  text += `- Nom : ${clientName}\n`;
  if (user?.telephone) text += `- Téléphone : ${user.telephone}\n`;
  if (user?.email) text += `- Email : ${user.email}\n`;
  text += `- Date : ${dateStr}\n\n`;

  text += `*Mode de livraison :*\n`;
  if (form.modeLivraison === "retrait") {
    text += `- Retrait en boutique (Gratuit)\n`;
    text += `- Point de retrait : ${boutique?.adresseRetrait || boutique?.adresse || "Boutique"}\n\n`;
  } else {
    text += `- Livraison à domicile\n`;
    text += `- Adresse : ${form.adresseLivraison || user?.adresse || "Non précisée"}\n\n`;
  }

  if (form.moyenPaiement) {
    const paymentLabels = {
      cash: "Paiement à la livraison (Espèces)",
      mvola: "MVola",
      holam: "Wero",
      carte: "Carte bancaire / En ligne",
      whatsapp: "Paiement / Validation sur WhatsApp"
    };
    text += `*Moyen de paiement sélectionné :*\n`;
    text += `- ${paymentLabels[form.moyenPaiement] || form.moyenPaiement}\n\n`;
  }

  text += `*Détail des articles commandés :*\n`;

  cart.forEach((l, index) => {
    const prix = l.product.prixPromo || l.product.prix;
    const itemTotal = prix * l.quantite;
    const itemTotalFormatted = formatPrice(itemTotal, boutique?.devise);
    const unitPriceFormatted = formatPrice(prix, boutique?.devise);
    
    text += `${index + 1}. *${l.product.nom}*\n`;
    text += `   • Quantité : ${l.quantite} ${l.product.unite || "article(s)"}\n`;
    text += `   • Prix unitaire : ${unitPriceFormatted}\n`;
    text += `   • Total ligne : ${itemTotalFormatted}\n`;
  });

  const subtotalFormatted = formatPrice(subtotal, boutique?.devise);
  const totalFormatted = formatPrice(total || subtotal, boutique?.devise);

  text += `\n*Résumé financier :*\n`;
  text += `- Sous-total : ${subtotalFormatted}\n`;
  if (fraisLivraison !== undefined && fraisLivraison !== 0 && fraisLivraison !== "0") {
    const fraisFormatted = isNaN(Number(fraisLivraison)) ? fraisLivraison : formatPrice(fraisLivraison, boutique?.devise);
    text += `- Frais de livraison : ${fraisFormatted}\n`;
  }
  text += `- *Total Général : ${totalFormatted}*\n\n`;

  if (form.moyenPaiement === "wero" || form.moyenPaiement === "holam" || form.moyenPaiement === "mvola") {
    const methode = (form.moyenPaiement === "mvola") ? "MVola" : "Wero";
    text += `Voici ma commande payée par ${methode}. Vous trouverez ci-joint la capture de la transaction !`;
  } else {
    text += `Merci de bien vouloir confirmer la réception et le traitement de ma commande !`;
  }

  return text;
}

export async function processWhatsAppOrder({ boutique, user, cart, subtotal, fraisLivraison, total, form = {}, clearCart, showToast, navigate }) {
  const rawWaNum = boutique?.whatsappNumber || boutique?.telephone || "";
  const cleanWaNum = rawWaNum.replace(/[^0-9]/g, "");

  if (!cleanWaNum) {
    if (showToast) showToast("Le numéro WhatsApp de la boutique n'est pas configuré.", "error", "WhatsApp indisponible");
    return false;
  }

  try {
    let orderNumber = null;
    let createdOrder = null;

    // Open blank window immediately to prevent popup blocker blocking window.open after async fetch
    const targetUrlBase = `https://wa.me/${cleanWaNum}`;

    // Save order into database silently or via API so Admin sees it in dashboard!
    if (user) {
      try {
        const items = cart.map((l) => ({ productId: l.product.id, quantite: l.quantite }));
        const orderData = {
          items,
          modeLivraison: form.modeLivraison || "domicile",
          adresseLivraison: form.adresseLivraison || user.adresse || "Commande WhatsApp",
          moyenPaiement: form.moyenPaiement || "whatsapp"
        };
        const res = await api.post(`/store/${SLUG}/orders`, orderData);
        createdOrder = res.data;
        orderNumber = "COM-B" + String(res.data.id).padStart(3, "0");
      } catch (err) {
        console.warn("⚠️ Impossible d'enregistrer la commande WhatsApp dans la DB :", err.message);
      }
    }

    // Format WhatsApp message
    const message = formatWhatsAppOrderMessage({
      boutique,
      user,
      cart,
      subtotal,
      fraisLivraison: fraisLivraison || "0",
      total: total || subtotal,
      orderNumber,
      form
    });

    const waUrl = `${targetUrlBase}?text=${encodeURIComponent(message)}`;

    // Clear cart and open WhatsApp directly in new tab or location
    if (clearCart) clearCart();
    
    // Redirect to WhatsApp directly
    window.location.href = waUrl;

    return true;
  } catch (err) {
    console.error("Erreur lors de l'envoi de la commande via WhatsApp:", err);
    if (showToast) showToast("Erreur lors du traitement de la commande WhatsApp.", "error");
    return false;
  }
}
