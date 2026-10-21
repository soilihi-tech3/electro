/**
 * UnitechPay Webhook Handler
 * Documentation officielle: https://pay.unitech.sn/documentation/
 *
 * Événements écoutés :
 *   - payment_completed / payment_success : Paiement réussi
 *   - payment_failed : Paiement échoué
 *   - payment_expired : Paiement expiré
 */

const express = require("express");
const { Order, Boutique, Product, OrderItem, Notification, User } = require("../models");
const { broadcast } = require("../utils/broadcaster");
const {
  envoyerConfirmationCommande,
  envoyerNotificationAdminNouvelleCommande
} = require("../services/emailService");
const { clearCachePattern } = require("../config/cache");
const { verifyWebhookSignature } = require("../services/unitechPayService");

const router = express.Router();

router.post("/", async (req, res) => {
  console.log("📩 [UnitechPay Webhook] Notification reçue:", JSON.stringify(req.body, null, 2));

  const body = req.body || {};
  const event = body.event || "";
  const status = body.status || "";
  const reference = body.reference || "";
  const paymentMethod = body.method || "UnitechPay";

  // 1. Vérification de la signature HMAC (si configurée)
  const apiKey = (process.env.UNITECH_API_KEY || "").trim();
  if (apiKey) {
    const isValid = verifyWebhookSignature({
      rawBody: req.rawBody,
      headers: req.headers,
      body,
      apiKey
    });

    if (!isValid) {
      console.warn("⚠️ [UnitechPay Webhook] Signature invalide ou absente.");
      // On continue en environnement de test si nécessaire mais on loggue
      if (process.env.NODE_ENV === "production" && body.signature) {
        return res.status(401).json({ error: "Invalid signature" });
      }
    } else {
      console.log("🔐 [UnitechPay Webhook] Signature HMAC vérifiée avec succès.");
    }
  }

  // 2. Vérification des événements de succès
  const isSuccess = event === "payment_completed" || event === "payment_success" || status === "completed";
  const isFailed = event === "payment_failed" || event === "payment_expired" || status === "failed";

  if (!isSuccess && !isFailed) {
    console.log(`ℹ️ [UnitechPay Webhook] Événement ignoré: ${event} / statut: ${status}`);
    return res.status(200).json({ received: true });
  }

  try {
    // 3. Recherche de la commande associée via reference (stockée dans stripeSessionId ou notes)
    let order = null;
    if (reference) {
      order = await Order.findOne({
        where: { stripeSessionId: reference },
        include: [
          { model: User, as: "client", attributes: ["id", "nom", "email", "telephone"] },
          { model: OrderItem, as: "items", include: [{ model: Product, as: "product" }] }
        ]
      });
    }

    // Fallback: si pas trouvé par stripeSessionId, rechercher si la référence ou description contient l'ID
    if (!order && body.description) {
      const match = String(body.description).match(/Commande\s*#?(\d+)/i);
      if (match && match[1]) {
        order = await Order.findByPk(match[1], {
          include: [
            { model: User, as: "client", attributes: ["id", "nom", "email", "telephone"] },
            { model: OrderItem, as: "items", include: [{ model: Product, as: "product" }] }
          ]
        });
      }
    }

    if (!order) {
      console.warn(`⚠️ [UnitechPay Webhook] Commande introuvable pour référence: ${reference}`);
      return res.status(200).json({ received: true, note: "Order not found" });
    }

    // Si paiement échoué
    if (isFailed) {
      if (order.statut === "en_attente_paiement") {
        await order.update({
          statut: "annulee",
          statutPaiement: "echec"
        });
        console.log(`❌ [UnitechPay Webhook] Commande #${order.id} marquée comme échouée.`);
      }
      return res.status(200).json({ received: true });
    }

    // 4. Paiement validé avec succès
    if (order.statutPaiement === "paye" || (order.statut !== "en_attente_paiement" && order.statut !== "en_attente")) {
      console.log(`ℹ️ [UnitechPay Webhook] Commande #${order.id} déjà traitée (statut: ${order.statut}, paiement: ${order.statutPaiement})`);
      return res.status(200).json({ received: true });
    }

    const effectiveMethod = paymentMethod.toLowerCase().includes("wave")
      ? "wave"
      : paymentMethod.toLowerCase().includes("orange")
      ? "orange"
      : "unitechpay";

    const isRecharge = order.typeVente === "recharge_mobile" || (order.notes && order.notes.includes("Recharge"));
    const nextStatut = isRecharge ? "recuperee" : "en_attente";

    await order.update({
      statut: nextStatut,
      statutPaiement: "paye",
      moyenPaiement: effectiveMethod,
      stripeSessionId: reference || order.stripeSessionId
    });

    const cmdNum = "COM-B" + String(order.id).padStart(3, "0");
    const boutiqueObj = await Boutique.findByPk(order.boutiqueId);

    // Notifications
    if (isRecharge) {
      // Déclencher l'envoi direct de crédit Reloadly
      const { dispatchRechargeIfEligible } = require("../services/reloadlyService");
      dispatchRechargeIfEligible(order, boutiqueObj).catch((err) => console.error("⚠️ [Reloadly Unitech Error]:", err.message));

      Notification.create({
        userId: order.clientId,
        boutiqueId: order.boutiqueId,
        orderId: order.id,
        title: "Recharge crédit envoyée ! 📲",
        message: `Votre recharge de crédit mobile via ${paymentMethod} a été validée et transférée avec succès (#${cmdNum}).`,
        type: "order"
      }).catch(() => {});

      Notification.create({
        userId: null,
        boutiqueId: order.boutiqueId,
        orderId: order.id,
        title: `Nouvelle Recharge Crédit Mobile (${paymentMethod})`,
        message: `Paiement ${paymentMethod} confirmé pour la recharge #${cmdNum} (${body.amount || order.total} XOF).`,
        type: "order"
      }).catch(() => {});
    } else {
      Notification.create({
        userId: order.clientId,
        boutiqueId: order.boutiqueId,
        orderId: order.id,
        title: "Paiement validé",
        message: `Le paiement de votre commande #${cmdNum} via ${paymentMethod} a été validé avec succès.`,
        type: "order"
      }).catch(() => {});

      Notification.create({
        userId: null,
        boutiqueId: order.boutiqueId,
        orderId: order.id,
        title: `Paiement ${paymentMethod} reçu`,
        message: `Paiement UnitechPay confirmé pour la commande #${cmdNum} (${body.amount || order.total} XOF).`,
        type: "order"
      }).catch(() => {});
    }

    // Déstockage si articles physiques présents (hors recharge)
    if (!isRecharge && order.items && order.items.length > 0) {
      for (const item of order.items) {
        if (item.product && item.product.stock !== null && item.product.stock !== undefined) {
          const newStock = Math.max(0, item.product.stock - item.quantite);
          await item.product.update({ stock: newStock }).catch(() => {});
        }
      }
    }

    clearCachePattern("/api/store").catch(() => {});
    broadcast("order_updated", {
      orderId: order.id,
      statut: nextStatut,
      clientId: order.clientId,
      boutiqueId: order.boutiqueId
    });

    // Email admin
    const adminEmail = boutiqueObj?.emailContact || process.env.BREVO_SENDER_EMAIL;
    if (adminEmail) {
      const originUrl = process.env.FRONTEND_URL || "https://electro.vercel.app";
      envoyerNotificationAdminNouvelleCommande(
        adminEmail,
        order,
        boutiqueObj?.nom || "Electro Pro",
        originUrl
      ).catch(() => {});
    }

    // Email client
    const customerEmail = order.client?.email;
    if (customerEmail) {
      envoyerConfirmationCommande(
        customerEmail,
        order,
        boutiqueObj?.nom || "Electro Pro"
      ).catch(() => {});
    }

    console.log(`✅ [UnitechPay Webhook] Commande #${order.id} validée avec succès via ${paymentMethod} (Réf: ${reference})`);
    return res.status(200).json({ received: true });

  } catch (err) {
    console.error("❌ [UnitechPay Webhook] Erreur lors du traitement:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
