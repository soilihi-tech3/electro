/**
 * Service d'intégration DingConnect API (Ding)
 * Permet l'envoi direct et instantané de crédit mobile aux Comores (Comores Telecom Huri & Telma Yas)
 * via le compte DingConnect du commerçant dès confirmation du paiement client.
 *
 * Documentation : https://www.dingconnect.com
 */

const DING_BASE_URL = "https://api.dingconnect.com/api/V1";

/**
 * Récupère les informations d'un numéro et les produits compatibles sur DingConnect
 */
async function lookupDingAccount(phone, apiKey) {
  const cleanPhone = String(phone || "").replace(/[^0-9]/g, "");
  const fullPhone = cleanPhone.startsWith("269") ? `+${cleanPhone}` : `+269${cleanPhone}`;

  try {
    const res = await fetch(`${DING_BASE_URL}/AccountLookup`, {
      method: "POST",
      headers: {
        "api_key": apiKey.trim(),
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({ AccountNumber: fullPhone }),
      signal: AbortSignal.timeout(15000)
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ResultCode === 1) {
      return data.Item || data;
    }
    return null;
  } catch (err) {
    console.error("⚠️ [DingConnect AccountLookup Error]:", err.message);
    return null;
  }
}

/**
 * Récupère les produits disponibles pour les Comores
 */
async function getComorosProducts(apiKey) {
  try {
    const res = await fetch(`${DING_BASE_URL}/GetProducts?countryIsos=KM`, {
      method: "GET",
      headers: {
        "api_key": apiKey.trim(),
        "Accept": "application/json"
      },
      signal: AbortSignal.timeout(15000)
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data.Items) {
      return data.Items;
    }
    return [];
  } catch (err) {
    console.error("⚠️ [DingConnect GetProducts Error]:", err.message);
    return [];
  }
}

/**
 * Détermine le SkuCode et le SendValue optimaux pour les Comores sur DingConnect
 */
function resolveComorosSkuAndSendValue(cleanPhone, amountKmf, amountEur) {
  const local = cleanPhone.startsWith("269") ? cleanPhone.slice(3) : cleanPhone;
  const isHuri = local.startsWith("3"); // Les numéros Comores Telecom / Huri commencent par 3

  if (isHuri) {
    if (amountKmf <= 1000) return { skuCode: "O5KM51809", sendValue: 2.99 };
    if (amountKmf <= 2000) return { skuCode: "O5KM63313", sendValue: 5.98 };
    if (amountKmf <= 5000) return { skuCode: "O5KM41603", sendValue: 14.95 };
    if (amountKmf <= 10000) return { skuCode: "O5KM89834", sendValue: 29.90 };
    return { skuCode: "O5KM37448", sendValue: 44.85 };
  } else {
    // Telma (Yas) Comores : Produit flexible 2FKMKM27699 (Min 2 USD)
    const calcUsd = Math.max(2, Math.round(((Number(amountKmf) || 1000) / 334.45) * 100) / 100);
    return { skuCode: "2FKMKM27699", sendValue: calcUsd };
  }
}

/**
 * Envoie instantanément le crédit télécom au destinataire aux Comores via DingConnect
 * @param {Object} params
 * @param {string} params.phone - Numéro comorien (ex: "+2693326532" ou "3326532")
 * @param {number} params.amountKmf - Montant en KMF
 * @param {number} params.amountEur - Montant payé en EUR
 * @param {number|string} params.orderId - Identifiant de la commande
 * @param {string} [params.apiKey] - Clé API DingConnect
 */
async function sendDingAirtimeTopup({ phone, amountKmf, amountEur, orderId, apiKey }) {
  const key = (apiKey || process.env.DING_API_KEY || "").trim();

  if (!key) {
    return {
      success: false,
      reason: "DING_NOT_CONFIGURED",
      message: "Clé API DingConnect non configurée (DING_API_KEY manquante)."
    };
  }

  const cleanPhone = String(phone || "").replace(/[^0-9]/g, "");
  const fullPhone = cleanPhone.startsWith("269") ? `+${cleanPhone}` : `+269${cleanPhone}`;

  try {
    const { skuCode, sendValue } = resolveComorosSkuAndSendValue(cleanPhone, amountKmf, amountEur);

    const payload = {
      SkuCode: skuCode,
      SendValue: sendValue,
      AccountNumber: fullPhone,
      DistributorRef: `EASY-${orderId || Date.now()}`,
      ValidateOnly: false
    };

    console.log(`📡 [DingConnect] Envoi de recharge vers ${fullPhone} (Commande #${orderId})...`);

    const res = await fetch(`${DING_BASE_URL}/SendTransfer`, {
      method: "POST",
      headers: {
        "api_key": key,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20000)
    });

    const result = await res.json().catch(() => ({}));

    // DingConnect renvoie ResultCode: 1 en cas de succès
    if (res.ok && (result.ResultCode === 1 || result.TransferRecord?.TransferId)) {
      const transferId = result.TransferRecord?.TransferId?.TransferRef || result.TransferRecord?.TransferId || "OK";
      console.log(`✅ [DingConnect] Crédit envoyé avec succès au ${fullPhone} ! Réf Ding: ${transferId}`);
      return {
        success: true,
        transactionId: transferId,
        provider: result.TransferRecord?.ProviderCode || "DingConnect",
        data: result
      };
    } else {
      const errorMsg = result.ErrorCodes?.map(e => e.Code).join(", ") || result.Message || `Erreur DingConnect (${res.status})`;
      console.error("❌ [DingConnect] Échec du transfert:", errorMsg, result);
      return {
        success: false,
        reason: "DING_TRANSFER_FAILED",
        message: errorMsg
      };
    }
  } catch (error) {
    console.error("❌ [DingConnect Exception]:", error.message);
    return {
      success: false,
      reason: "EXCEPTION",
      message: error.message
    };
  }
}

module.exports = {
  sendDingAirtimeTopup,
  lookupDingAccount,
  getComorosProducts
};
