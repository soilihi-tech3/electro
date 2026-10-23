const crypto = require("crypto");

const UNITECH_BASE_URL = "https://api.unitech.sn/api.php";

/**
 * Effectue un appel authentifié à l'API UnitechPay
 */
async function unitechRequest({ action, data = null, method = "POST", apiKey = null }) {
  const key = (apiKey || process.env.UNITECH_API_KEY || "").trim();
  if (!key) {
    throw new Error("Clé API UnitechPay (UNITECH_API_KEY) non configurée.");
  }

  const url = `${UNITECH_BASE_URL}?action=${action}`;
  const options = {
    method,
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7"
    },
    signal: AbortSignal.timeout(25000)
  };

  if (method === "POST" && data) {
    options.body = JSON.stringify(data);
  }

  const response = await fetch(url, options);
  const result = await response.json().catch(() => ({}));

  if (!response.ok || result.success === false) {
    const errorMsg = result.message || `Erreur HTTP ${response.status} de l'API UnitechPay`;
    const err = new Error(errorMsg);
    err.status = response.status;
    err.details = result;
    throw err;
  }

  return result;
}

/**
 * 1. Créer une session de paiement Wave (Sénégal)
 * Endpoint: POST /api.php?action=create_wave_payment
 */
async function createWavePayment({ amount, customerNumber, description, successUrl, cancelUrl, apiKey = null }) {
  const cleanPhone = String(customerNumber || "").replace(/[^0-9]/g, "");
  return await unitechRequest({
    action: "create_wave_payment",
    method: "POST",
    apiKey,
    data: {
      amount: Math.round(Number(amount)),
      customer_number: cleanPhone,
      description: description || "Paiement Wave",
      callback_success: successUrl,
      callback_cancel: cancelUrl
    }
  });
}

/**
 * 2. Créer un paiement Orange Money (Sénégal)
 * Endpoint: POST /api.php?action=create_orange_om ou create_orange_maxit
 */
async function createOrangePayment({ amount, customerNumber, description, successUrl, cancelUrl, apiKey = null }) {
  const cleanPhone = String(customerNumber || "").replace(/[^0-9]/g, "");
  return await unitechRequest({
    action: "create_orange_om",
    method: "POST",
    apiKey,
    data: {
      amount: Math.round(Number(amount)),
      customer_number: cleanPhone,
      description: description || "Paiement Orange Money",
      callback_success: successUrl,
      callback_cancel: cancelUrl
    }
  });
}

/**
 * 3. Créer un paiement International (Côte d'Ivoire, Togo, Burkina Faso, Bénin)
 * Endpoint: POST /api.php?action=create_intl_payment
 */
async function createIntlPayment({ country, operator, amount, customerNumber, customerName, description, successUrl, cancelUrl, apiKey = null }) {
  return await unitechRequest({
    action: "create_intl_payment",
    method: "POST",
    apiKey,
    data: {
      country,
      operator,
      amount: Math.round(Number(amount)),
      customer_number: String(customerNumber || "").replace(/[^0-9]/g, ""),
      customer_name: customerName || "Client",
      description: description || "Paiement International",
      callback_success: successUrl,
      callback_cancel: cancelUrl
    }
  });
}

/**
 * 4. Consulter les soldes marchand
 * Endpoint: GET /api.php?action=balance
 */
async function getBalance(apiKey = null) {
  return await unitechRequest({
    action: "balance",
    method: "GET",
    apiKey
  });
}

/**
 * 5. Vérifier la signature HMAC-SHA256 du webhook UnitechPay
 * Supporte :
 *  - En-tête HTTP (X-UnitechPay-Signature ou x-unitechpay-signature)
 *  - Signature canonique dans le corps (event|reference|amount|status|signed_at)
 */
function verifyWebhookSignature({ rawBody, headers = {}, body = {}, apiKey = null }) {
  const key = (apiKey || process.env.UNITECH_API_KEY || "").trim();
  if (!key) return false;

  // Méthode 1 : Vérification via en-tête HTTP
  const headerSig = headers["x-unitechpay-signature"] || headers["X-UnitechPay-Signature"] || headers["HTTP_X_UNITECHPAY_SIGNATURE"];
  if (headerSig && rawBody) {
    const expected = crypto.createHmac("sha256", key).update(rawBody).digest("hex");
    if (crypto.timingSafeEqual(Buffer.from(headerSig), Buffer.from(expected))) {
      return true;
    }
  }

  // Méthode 2 : Vérification canonique du body (CDN-proof documentée par UnitechPay)
  const bodySig = body.signature;
  if (bodySig) {
    const signed = `${body.event || ""}|${body.reference || ""}|${body.amount || ""}|${body.status || ""}|${body.signed_at || ""}`;
    const expected = crypto.createHmac("sha256", key).update(signed).digest("hex");
    if (bodySig === expected) {
      return true;
    }
  }

  return false;
}

/**
 * 6. Configurer l'URL de webhook auprès d'UnitechPay
 * Endpoint: POST /api.php?action=configure_webhook
 */
async function configureWebhook({ webhookUrl, events = null, apiKey = null }) {
  const data = { webhook_url: webhookUrl };
  if (Array.isArray(events)) data.events = events;
  return await unitechRequest({
    action: "configure_webhook",
    method: "POST",
    apiKey,
    data
  });
}

module.exports = {
  createWavePayment,
  createOrangePayment,
  createIntlPayment,
  getBalance,
  configureWebhook,
  verifyWebhookSignature,
  unitechRequest
};

