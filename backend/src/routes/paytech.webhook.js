/**
 * PayTech IPN (Instant Payment Notification) Webhook Handler
 * Documentation: https://doc.intech.sn/doc_paytech.php
 *
 * PayTech envoie un POST sur ipn_url avec les champs suivants :
 *   - type_event     : "sale_complete"
 *   - ref_command    : Référence unique de la commande
 *   - item_name      : Nom du produit
 *   - item_price     : Prix
 *   - currency       : Devise (xof, etc.)
 *   - command_name   : Description commande
 *   - token          : Token de la transaction PayTech
 *   - env            : "test" | "prod"
 *   - payment_method : "Wave" | "Orange Money" | ...
 *   - client_phone   : Numéro du client (peut être vide)
 *   - api_key_sha256     : SHA256 de votre clé API (pour vérification)
 *   - api_secret_sha256  : SHA256 de votre clé secrète (pour vérification)
 *   - custom_field   : La chaîne custom que vous avez envoyée (JSON sérialisé)
 *
 * SÉCURITÉ : On vérifie api_key_sha256 et api_secret_sha256 pour s'assurer
 * que la requête vient bien de PayTech.
 */

const express = require("express");
const crypto = require("crypto");
const {
  Order, Boutique, Product, OrderItem, Notification, User
} = require("../models");
const { broadcast } = require("../utils/broadcaster");
const {
  envoyerConfirmationCommande,
  envoyerNotificationAdminNouvelleCommande
} = require("../services/emailService");
const { clearCachePattern } = require("../config/cache");

const router = express.Router();

/**
 * Vérifie que les SHA256 reçus correspondent bien à nos clés API PayTech.
 * Selon la doc PayTech : api_key_sha256 = sha256(API_KEY), api_secret_sha256 = sha256(API_SECRET)
 */
function verifyPaytechSignature(body, apiKey, apiSecret) {
  const receivedKeyHash = body.api_key_sha256;
  const receivedSecretHash = body.api_secret_sha256;

  if (!receivedKeyHash || !receivedSecretHash) return false;

  const expectedKeyHash = crypto
    .createHash("sha256")
    .update(apiKey)
    .digest("hex");

  const expectedSecretHash = crypto
    .createHash("sha256")
    .update(apiSecret)
    .digest("hex");

  return (
    receivedKeyHash === expectedKeyHash &&
    receivedSecretHash === expectedSecretHash
  );
}

/**
 * POST /api/webhooks/paytech
 * IPN PayTech — notification de paiement réussi (Wave, Orange Money, etc.)
 */
router.post("/", async (req, res) => {
  console.log("📩 [PayTech IPN] Notification reçue:", JSON.stringify(req.body, null, 2));

  const body = req.body;

  // ── 1. Vérifier que c'est bien un événement de vente complète ─────────────
  if (body.type_event !== "sale_complete") {
    console.log(`[PayTech IPN] Événement ignoré: ${body.type_event}`);
    return res.status(200).json({ received: true });
  }

  // ── 2. Lire les clés PayTech depuis l'env (fallback global) ──────────────
  const apiKey    = process.env.PAYTECH_API_KEY;
  const apiSecret = process.env.PAYTECH_API_SECRET;

  if (!apiKey || !apiSecret) {
    console.error("❌ [PayTech IPN] Clés PayTech non configurées dans .env");
    return res.status(500).json({ error: "PayTech keys not configured" });
  }

  // ── 3. Vérification de signature ─────────────────────────────────────────
  if (!verifyPaytechSignature(body, apiKey, apiSecret)) {
    console.error("❌ [PayTech IPN] Signature invalide — requête rejetée.");
    return res.status(401).json({ error: "Invalid PayTech signature" });
  }

  // ── 4. Extraire les données de la notification ───────────────────────────
  const refCommand   = body.ref_command;   // Notre ref_command envoyée lors de la demande
  const token        = body.token;          // Token PayTech de la transaction
  const paymentMethod = body.payment_method || "PayTech";
  const currency     = body.currency || "xof";
  const itemPrice    = body.item_price;
  const customField  = body.custom_field;

  // custom_field contient nos métadonnées (boutiqueId, userId, orderId, type, etc.)
  let customData = {};
  try {
    customData = customField ? JSON.parse(customField) : {};
  } catch (e) {
    console.warn("[PayTech IPN] custom_field non parseable:", customField);
  }

  const { boutiqueId, userId, orderId, type, phone, operatorName } = customData;

  try {
    // ── 5. CAS : RECHARGE MOBILE ──────────────────────────────────────────
    if (type === "recharge_mobile") {
      let boutiqueObj = null;
      if (boutiqueId) boutiqueObj = await Boutique.findByPk(boutiqueId);

      let existingOrder = orderId ? await Order.findByPk(orderId) : null;

      if (existingOrder) {
        // Mise à jour de la commande si elle est encore en attente
        if (existingOrder.statut === "en_attente_paiement") {
          await existingOrder.update({
            statut: "recuperee",
            statutPaiement: "paye",
            stripeSessionId: token, // On réutilise ce champ pour stocker le token PayTech
            moyenPaiement: paymentMethod.toLowerCase().includes("wave")
              ? "wave"
              : paymentMethod.toLowerCase().includes("orange")
              ? "orange"
              : "paytech"
          });

          const cmdNum = "COM-B" + String(existingOrder.id).padStart(3, "0");

          if (userId) {
            Notification.create({
              userId: Number(userId),
              boutiqueId: Number(boutiqueId),
              orderId: existingOrder.id,
              title: `Recharge crédit envoyée ! 📲`,
              message: `Votre recharge de crédit mobile (${operatorName || ""}) via ${paymentMethod} a été confirmée pour le ${phone} (#${cmdNum}).`,
              type: "order"
            }).catch(() => {});
          }

          Notification.create({
            userId: null,
            boutiqueId: Number(boutiqueId),
            orderId: existingOrder.id,
            title: `Recharge Mobile confirmée (${paymentMethod})`,
            message: `Paiement ${paymentMethod} confirmé. Recharge pour le numéro ${phone}.`,
            type: "order"
          }).catch(() => {});

          clearCachePattern("/api/store").catch(() => {});
          broadcast("order_updated", {
            orderId: existingOrder.id,
            statut: "recuperee",
            clientId: userId,
            boutiqueId
          });

          // Email admin
          const adminEmail = boutiqueObj?.emailContact || process.env.BREVO_SENDER_EMAIL;
          if (adminEmail) {
            const originUrl = process.env.FRONTEND_URL || "http://localhost:5173";
            envoyerNotificationAdminNouvelleCommande(
              adminEmail, existingOrder, boutiqueObj?.nom || "EasyMarket", originUrl
            ).catch(() => {});
          }

          // Email client
          if (userId) {
            const userObj = await User.findByPk(userId);
            if (userObj?.email) {
              envoyerConfirmationCommande(
                userObj.email, existingOrder, boutiqueObj?.nom || "EasyMarket"
              ).catch(() => {});
            }
          }

          console.log(`✅ [PayTech IPN] Recharge Mobile ${phone} validée (#${existingOrder.id}) via ${paymentMethod}`);
        } else {
          console.log(`[PayTech IPN] Commande #${existingOrder.id} déjà traitée (statut: ${existingOrder.statut})`);
        }
      } else {
        // Créer une nouvelle commande si elle n'existe pas encore
        const newOrder = await Order.create({
          boutiqueId: boutiqueId ? Number(boutiqueId) : 1,
          clientId: userId ? Number(userId) : null,
          total: Number(itemPrice),
          sousTotal: Number(itemPrice),
          fraisLivraison: 0,
          statut: "recuperee",
          statutPaiement: "paye",
          typeVente: "recharge_mobile",
          moyenPaiement: paymentMethod.toLowerCase().includes("wave")
            ? "wave"
            : paymentMethod.toLowerCase().includes("orange")
            ? "orange"
            : "paytech",
          stripeSessionId: token,
          notes: `Recharge Crédit Mobile ${operatorName || ""} pour le numéro ${phone} via ${paymentMethod}`
        });

        const cmdNum = "COM-B" + String(newOrder.id).padStart(3, "0");

        if (userId) {
          Notification.create({
            userId: Number(userId), boutiqueId: Number(boutiqueId), orderId: newOrder.id,
            title: "Recharge crédit envoyée ! 📲",
            message: `Recharge ${operatorName || ""} confirmée via ${paymentMethod} pour le ${phone} (#${cmdNum}).`,
            type: "order"
          }).catch(() => {});
        }

        clearCachePattern("/api/store").catch(() => {});
        broadcast("order_created", {
          orderId: newOrder.id, statut: "recuperee", clientId: userId, boutiqueId
        });

        console.log(`✅ [PayTech IPN] Nouvelle recharge Mobile enregistrée (#${newOrder.id}) via ${paymentMethod}`);
      }

      return res.status(200).json({ received: true });
    }

    // ── 6. CAS : COMMANDE BOUTIQUE CLASSIQUE ─────────────────────────────
    // On retrouve la commande via orderId dans custom_field ou via ref_command
    let order = null;
    if (orderId) {
      order = await Order.findByPk(orderId, {
        include: [
          { model: User, as: "client", attributes: ["id", "nom", "email", "telephone"] },
          { model: OrderItem, as: "items", include: [{ model: Product, as: "product" }] }
        ]
      });
    }

    // Fallback: chercher par ref_command (stripeSessionId contient notre ref)
    if (!order && refCommand) {
      order = await Order.findOne({
        where: { stripeSessionId: refCommand },
        include: [
          { model: User, as: "client", attributes: ["id", "nom", "email", "telephone"] },
          { model: OrderItem, as: "items", include: [{ model: Product, as: "product" }] }
        ]
      });
    }

    if (!order) {
      console.warn(`[PayTech IPN] Commande introuvable pour ref_command: ${refCommand}, orderId: ${orderId}`);
      return res.status(200).json({ received: true }); // On retourne 200 pour éviter les retries PayTech
    }

    if (order.statut !== "en_attente_paiement") {
      console.log(`[PayTech IPN] Commande #${order.id} déjà traitée (statut: ${order.statut})`);
      return res.status(200).json({ received: true });
    }

    await order.update({
      statut: "en_attente",
      statutPaiement: "paye",
      stripeSessionId: token, // Token PayTech
      moyenPaiement: paymentMethod.toLowerCase().includes("wave")
        ? "wave"
        : paymentMethod.toLowerCase().includes("orange")
        ? "orange"
        : "paytech"
    });

    const cmdNum = "COM-B" + String(order.id).padStart(3, "0");
    const boutiqueObj = await Boutique.findByPk(order.boutiqueId);

    Notification.create({
      userId: order.clientId, boutiqueId: order.boutiqueId, orderId: order.id,
      title: "Paiement validé",
      message: `Le paiement de votre commande #${cmdNum} via ${paymentMethod} a été validé avec succès.`,
      type: "order"
    }).catch(() => {});

    Notification.create({
      userId: null, boutiqueId: order.boutiqueId, orderId: order.id,
      title: `Paiement ${paymentMethod} reçu`,
      message: `Le paiement pour la commande #${cmdNum} a été confirmé via PayTech (${paymentMethod}).`,
      type: "order"
    }).catch(() => {});

    clearCachePattern("/api/store").catch(() => {});
    broadcast("order_updated", {
      orderId: order.id, statut: "en_attente", clientId: order.clientId, boutiqueId: order.boutiqueId
    });

    // Email admin
    const adminEmail = boutiqueObj?.emailContact || process.env.BREVO_SENDER_EMAIL;
    if (adminEmail) {
      const originUrl = process.env.FRONTEND_URL || "http://localhost:5173";
      envoyerNotificationAdminNouvelleCommande(
        adminEmail, order, boutiqueObj?.nom || "EasyMarket", originUrl
      ).catch(() => {});
    }

    // Email client
    const customerEmail = order.client?.email;
    if (customerEmail) {
      envoyerConfirmationCommande(
        customerEmail, order, boutiqueObj?.nom || "EasyMarket"
      ).catch(() => {});
    }

    console.log(`✅ [PayTech IPN] Commande #${order.id} validée via ${paymentMethod} (token: ${token})`);
    return res.status(200).json({ received: true });

  } catch (err) {
    console.error("❌ [PayTech IPN] Erreur lors du traitement:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
