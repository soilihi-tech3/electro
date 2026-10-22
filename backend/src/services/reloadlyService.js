/**
 * Service d'intégration Reloadly Airtime API
 * Permet l'envoi direct et instantané de crédit mobile aux Comores (Comores Telecom Huri & Telma Yas)
 * sans intervention humaine dès confirmation du paiement client.
 *
 * Documentation : https://developers.reloadly.com
 */

const RELOADLY_AUTH_URL = "https://auth.reloadly.com/oauth/token";

let cachedToken = null;
let tokenExpiresAt = 0;

/**
 * Récupère ou rafraîchit le token OAuth2 Reloadly
 */
async function getReloadlyToken(clientId, clientSecret, isSandbox = false) {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt - 60000) {
    return cachedToken;
  }

  const id = (clientId || process.env.RELOADLY_CLIENT_ID || "").trim();
  const secret = (clientSecret || process.env.RELOADLY_CLIENT_SECRET || "").trim();

  if (!id || !secret) {
    throw new Error("Identifiants Reloadly manquants (RELOADLY_CLIENT_ID et RELOADLY_CLIENT_SECRET).");
  }

  const audience = isSandbox ? "https://topups-sandbox.reloadly.com" : "https://topups.reloadly.com";

  const response = await fetch(RELOADLY_AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({
      client_id: id,
      client_secret: secret,
      grant_type: "client_credentials",
      audience
    }),
    signal: AbortSignal.timeout(15000)
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.access_token) {
    throw new Error(data.message || `Erreur d'authentification Reloadly (${response.status})`);
  }

  cachedToken = data.access_token;
  tokenExpiresAt = now + ((data.expires_in || 3600) * 1000);
  return cachedToken;
}

let cachedBalanceData = null;
let balanceExpiresAt = 0;

/**
 * Récupère le solde du portefeuille Reloadly (avec cache 30s)
 */
async function getReloadlyBalance(clientId, clientSecret, isSandbox = false) {
  const now = Date.now();
  if (cachedBalanceData && now < balanceExpiresAt) {
    return cachedBalanceData;
  }

  try {
    const token = await getReloadlyToken(clientId, clientSecret, isSandbox);
    const baseUrl = isSandbox ? "https://topups-sandbox.reloadly.com" : "https://topups.reloadly.com";

    const res = await fetch(`${baseUrl}/accounts/balance`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/com.reloadly.topups-v1+json"
      },
      signal: AbortSignal.timeout(10000)
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && typeof data.balance === "number") {
      cachedBalanceData = {
        success: true,
        balance: data.balance,
        currencyCode: data.currencyCode || "USD"
      };
      balanceExpiresAt = now + 30000; // cache 30 secondes
      return cachedBalanceData;
    }

    return {
      success: false,
      balance: 0,
      currencyCode: "USD",
      error: data.message || `Status ${res.status}`
    };
  } catch (err) {
    return {
      success: false,
      balance: 0,
      currencyCode: "USD",
      error: err.message
    };
  }
}

/**
 * Détecte l'opérateur aux Comores (Huri vs Telma) à partir du numéro
 */
async function autoDetectOperator(cleanPhone, token, isSandbox = false) {
  const baseUrl = isSandbox ? "https://topups-sandbox.reloadly.com" : "https://topups.reloadly.com";
  const url = `${baseUrl}/operators/auto-detect/phone/${cleanPhone}?isoCode=KM`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/com.reloadly.topups-v1+json"
    },
    signal: AbortSignal.timeout(15000)
  });

  const data = await res.json().catch(() => ({}));
  if (res.ok && data.operatorId) {
    return data;
  }
  return null;
}

/**
 * Envoie instantanément le crédit télécom au destinataire aux Comores
 * @param {Object} params
 * @param {string} params.phone - Numéro comorien (ex: "3326532" ou "+2693326532")
 * @param {number} params.amountKmf - Montant en Francs Comoriens (KMF)
 * @param {number} params.amountEur - Montant payé en Euros (€)
 * @param {number|string} params.orderId - Identifiant de la commande
 * @param {Object} [params.boutique] - Objet boutique optionnel
 */
async function sendAirtimeTopup({ phone, amountKmf, amountEur, orderId, boutique = null }) {
  const cleanPhone = String(phone || "").replace(/[^0-9]/g, "");
  // Extraction des 7 chiffres locaux (retire 269 ou 00269)
  const localNumber = cleanPhone.startsWith("269") ? cleanPhone.slice(3) : cleanPhone;

  const clientId = boutique?.reloadlyClientId || process.env.RELOADLY_CLIENT_ID;
  const clientSecret = boutique?.reloadlyClientSecret || process.env.RELOADLY_CLIENT_SECRET;
  const isSandbox = (process.env.RELOADLY_SANDBOX === "true" || boutique?.reloadlySandbox === true);

  if (!clientId || !clientSecret) {
    console.warn("⚠️ [Reloadly] Clés non configurées (RELOADLY_CLIENT_ID). Envoi direct différé.");
    return {
      success: false,
      reason: "RELOADLY_NOT_CONFIGURED",
      message: "Clés d'API Reloadly non configurées sur le serveur."
    };
  }

  try {
    const token = await getReloadlyToken(clientId, clientSecret, isSandbox);

    // 1. Détection automatique de l'opérateur (Comores Telecom Huri ou Telma)
    let operator = await autoDetectOperator(localNumber, token, isSandbox).catch(() => null);

    const baseUrl = isSandbox ? "https://topups-sandbox.reloadly.com" : "https://topups.reloadly.com";

    // Préparation de la requête de recharge
    const payload = {
      amount: Number(amountKmf || 1000),
      useLocalAmount: true,
      customIdentifier: `REC-${orderId || Date.now()}`,
      recipientPhone: {
        countryCode: "KM",
        number: localNumber
      }
    };

    if (operator && operator.operatorId) {
      payload.operatorId = operator.operatorId;
    } else {
      // Opérateurs officiels Comores sur Reloadly (779 = Comores Telecom Huri, 784 = Telma Yas)
      const isTelma = localNumber.startsWith("4");
      payload.operatorId = isTelma ? 784 : 779;
    }

    const res = await fetch(`${baseUrl}/topups`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/com.reloadly.topups-v1+json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20000)
    });

    const result = await res.json().catch(() => ({}));

    if (res.ok && (result.status === "SUCCESSFUL" || result.transactionId)) {
      console.log(`✅ [Reloadly] Crédit ${amountKmf} KMF envoyé avec succès au +269${localNumber} ! Transaction ID: ${result.transactionId}`);
      return {
        success: true,
        transactionId: result.transactionId,
        operatorName: result.operatorName || operator?.name || "Comores",
        deliveredAmount: result.deliveredAmount || amountKmf,
        deliveredCurrency: result.deliveredAmountCurrencyCode || "KMF",
        data: result
      };
    } else {
      console.error("❌ [Reloadly] Échec de la recharge automatique:", result);
      return {
        success: false,
        reason: result.code || "TOPUP_FAILED",
        message: result.message || "Erreur lors du transfert de crédit Reloadly."
      };
    }
  } catch (error) {
    console.error("❌ [Reloadly Exception]:", error.message);
    return {
      success: false,
      reason: "EXCEPTION",
      message: error.message
    };
  }
}

/**
const { sendDingAirtimeTopup } = require("./dingConnectService");

/**
 * Traite une commande de recharge mobile et déclenche l'envoi direct (DingConnect ou Reloadly)
 */
async function dispatchRechargeIfEligible(order, boutiqueObj = null) {
  if (!order) return;
  const isRecharge = order.typeVente === "recharge_mobile" || (order.notes && order.notes.includes("Recharge"));
  if (!isRecharge) return;

  // Éviter d'envoyer deux fois si déjà envoyé
  if (
    order.notes &&
    (order.notes.includes("[RELOADLY AUTOMATIQUE: ENVOYÉ") ||
     order.notes.includes("[DING AUTOMATIQUE: ENVOYÉ") ||
     order.notes.includes("[AIRTIME AUTOMATIQUE: ENVOYÉ"))
  ) {
    return;
  }

  const notes = order.notes || "";
  const phoneMatch = notes.match(/\+?(269\d{7}|\d{7})/);
  const phone = phoneMatch ? phoneMatch[0] : "";
  const kmfMatch = notes.match(/(\d[\d\s]*)\s*KMF/i);
  const amountKmf = kmfMatch ? Number(kmfMatch[1].replace(/\s/g, "")) : 1000;

  if (!phone) {
    console.warn("⚠️ [Airtime Dispatch] Numéro de téléphone introuvable dans la commande #" + order.id);
    return;
  }

  const reloadlyId = (boutiqueObj?.reloadlyClientId || process.env.RELOADLY_CLIENT_ID || "").trim();
  const dingKey = (boutiqueObj?.dingApiKey || process.env.DING_API_KEY || "").trim();

  // 1. Priorité Reloadly si configuré
  if (reloadlyId) {
    console.log(`🚀 [Airtime Dispatch] Tentative d'envoi via Reloadly API...`);
    const res = await sendAirtimeTopup({
      phone,
      amountKmf,
      amountEur: order.total,
      orderId: order.id,
      boutique: boutiqueObj
    });

    if (res && res.success) {
      const updatedNotes = `${order.notes || ""} | [RELOADLY AUTOMATIQUE: ENVOYÉ - TransID: ${res.transactionId}]`;
      await order.update({ notes: updatedNotes }).catch(() => {});
      return res;
    } else {
      console.warn("⚠️ [Reloadly Échec ou sans solde, repli sur Ding si dispo]:", res?.message);
    }
  }

  // 2. Repli / Utilisation de DingConnect si configuré
  if (dingKey) {
    console.log(`🚀 [Airtime Dispatch] Tentative d'envoi via DingConnect API...`);
    const dingRes = await sendDingAirtimeTopup({
      phone,
      amountKmf,
      amountEur: order.total,
      orderId: order.id,
      apiKey: dingKey
    });

    if (dingRes && dingRes.success) {
      const updatedNotes = `${order.notes || ""} | [DING AUTOMATIQUE: ENVOYÉ - Ref: ${dingRes.transactionId}]`;
      await order.update({ notes: updatedNotes }).catch(() => {});
      return dingRes;
    } else {
      console.warn("⚠️ [DingConnect Échec]:", dingRes?.message);
    }
  }

  console.warn("⚠️ [Airtime Dispatch] Ni DingConnect ni Reloadly ne sont configurés. La recharge reste en attente de validation manuelle.");
}

module.exports = {
  sendAirtimeTopup,
  dispatchRechargeIfEligible,
  getReloadlyToken,
  getReloadlyBalance,
  autoDetectOperator
};

