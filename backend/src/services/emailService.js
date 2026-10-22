require("dotenv").config();
const { BrevoClient } = require("@getbrevo/brevo");
const nodemailer = require("nodemailer");
const { renderTemplate } = require("../utils/templateEngine");
const { EmailLog } = require("../models");
const { getCache, setCache } = require("../config/cache");

// Singleton client Brevo
let brevoClientInstance = null;
function getBrevoClient() {
  const apiKey = (process.env.BREVO_API_KEY || process.env.SENDINBLUE_API_KEY || "").trim();
  if (!apiKey) return null;

  if (!brevoClientInstance) {
    brevoClientInstance = new BrevoClient({ apiKey });
  }
  return brevoClientInstance;
}

/**
 * Enregistrement du log d'email en base de données (emails_log)
 */
async function logEmailSent(email, type, statut, errorMessage = null) {
  try {
    await EmailLog.create({
      email,
      type,
      statut,
      error_message: errorMessage
    });
  } catch (err) {
    console.error("⚠️ [EMAIL LOG ERROR] Impossible d'enregistrer le log d'email:", err.message);
  }
}

/**
 * Comptabiliser les envois quotidiens dans Redis (quota 300/jour Brevo gratuit)
 */
async function trackDailyQuota() {
  try {
    const todayStr = new Date().toISOString().split("T")[0];
    const redisKey = `emails_sent_today:${todayStr}`;
    const currentCount = (await getCache(redisKey)) || 0;
    const newCount = Number(currentCount) + 1;
    await setCache(redisKey, newCount, 86400);

    if (newCount === 250) {
      console.warn(`⚠️ [BREVO QUOTA ALERT] Approche du quota quotidien Brevo : ${newCount}/300 emails envoyés aujourd'hui (${todayStr}).`);
    } else if (newCount >= 300) {
      console.error(`🚨 [BREVO QUOTA EXCEEDED] Quota quotidien de 300 emails Brevo atteint pour aujourd'hui (${todayStr}) !`);
    }
  } catch (e) {
    // Ne pas bloquer si Redis indisponible
  }
}

/**
 * Fonction cœur d'envoi d'e-mail via l'API REST Brevo (HTTPS port 443)
 */
async function sendEmailCore({ to, subject, html, type = "general" }) {
  if (!to) {
    console.warn("⚠️ [EMAIL SERVICE] Destinataire manquant.");
    return false;
  }

  const apiKey = (process.env.BREVO_API_KEY || process.env.SENDINBLUE_API_KEY || "").trim();
  const senderEmail = (process.env.BREVO_SENDER_EMAIL || "soilihiabdou99@gmail.com").trim();
  const senderName = (process.env.BREVO_SENDER_NAME || "EasyMarket").trim();

  // Version texte brut pour maximiser la délivrabilité
  const textContent = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]*>?/gm, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // 1. Envoi prioritaire via l'API REST Brevo (HTTPS 443 - Garanti sans blocage Render)
  if (apiKey) {
    try {
      // Appel direct HTTPS REST API v3 Brevo
      const res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "accept": "application/json",
          "api-key": apiKey,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          sender: { name: senderName, email: senderEmail },
          replyTo: { name: senderName, email: senderEmail },
          to: [{ email: to }],
          subject,
          htmlContent: html,
          textContent: textContent
        }),
        signal: AbortSignal.timeout(12000) // Timeout de 12 secondes max pour ne jamais bloquer Render
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        console.log(`✉️ [BREVO REST API 100% HTTPS] E-mail "${type}" envoyé avec succès à ${to} (MessageId: ${data.messageId || 'OK'})`);
        await trackDailyQuota();
        await logEmailSent(to, type, "succes");
        return true;
      } else {
        const errorDetail = data?.message || data?.error || JSON.stringify(data);
        console.error(`❌ [BREVO REST API ERROR] Statut HTTP ${res.status} pour ${to}:`, errorDetail);
        await logEmailSent(to, type, "echec", `HTTP ${res.status}: ${errorDetail}`);
      }
    } catch (err) {
      console.error(`❌ [BREVO REST API EXCEPTION] Erreur requête HTTPS à ${to}:`, err.message);
      await logEmailSent(to, type, "echec", err.message);
    }
  } else {
    console.warn("⚠️ [EMAIL SERVICE] BREVO_API_KEY absente des variables d'environnement.");
  }

  // 2. Fallback SMTP (UNIQUEMENT EN DÉVELOPPEMENT LOCAL, JAMAIS SUR RENDER)
  const isProduction = process.env.NODE_ENV === "production" || process.env.RENDER;
  if (!isProduction && process.env.GMAIL_USER && process.env.GMAIL_APP_PASS) {
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.GMAIL_USER.trim(),
          pass: process.env.GMAIL_APP_PASS.trim()
        }
      });
      
      const info = await transporter.sendMail({
        from: process.env.GMAIL_USER.trim(),
        to,
        subject,
        html,
        text: textContent
      });
      
      console.log(`✉️ [GMAIL SMTP LOCAL SUCCESS] E-mail "${type}" envoyé à ${to} (MessageId: ${info.messageId})`);
      await logEmailSent(to, type, "succes");
      return true;
    } catch (err) {
      console.error(`❌ [GMAIL SMTP ERROR] Échec d'envoi à ${to} :`, err.message);
      await logEmailSent(to, type, "echec", err.message);
    }
  }

  // 3. Fallback Mode Dev / Logs (Si les APIs et SMTP échouent)
  console.log("\n=================== ✉️ EMAIL TRANSACTIONNEL (DEV LOG FALLBACK) ===================");
  console.log(`Type         : ${type}`);
  console.log(`Destinataire : ${to}`);
  console.log(`Sujet        : ${subject}`);
  console.log("--------------------------------------------------------------------------");
  console.log(textContent.substring(0, 300) + "...");
  console.log("==========================================================================\n");

  return false;
}

/**
 * 1. Envoie un e-mail OTP avec le code à 6 chiffres
 */
async function envoyerOTP(email, code, nomUtilisateur = "Client") {
  try {
    const html = renderTemplate("otp.html", {
      nom: nomUtilisateur || "Client",
      code,
      appName: process.env.BREVO_SENDER_NAME || "EasyMarket"
    });

    const subject = `${code} est votre code de vérification — EasyMarket`;
    return await sendEmailCore({ to: email, subject, html, type: "otp" });
  } catch (err) {
    console.error("❌ [EMAIL OTP ERROR]:", err.message);
    return false;
  }
}

/**
 * 2. Envoie une confirmation de commande avec calcul exact du total et lien direct de suivi
 */
async function envoyerConfirmationCommande(email, commande, boutiqueNom = "EasyMarket") {
  try {
    const plainOrder = commande && typeof commande.get === "function" ? commande.get({ plain: true }) : (commande || {});
    const rawId = plainOrder.id || plainOrder.orderId || 0;
    const cmdId = "COM-B" + String(rawId).padStart(3, "0");

    const itemsListHtml = (plainOrder.items || []).map(it => {
      const nomProd = it.product?.nom || it.nomProduit || 'Produit';
      const qty = Number(it.quantite || 1);
      const unitPrice = Number(it.prixUnitaire || it.prix || 0);
      const itemTotal = unitPrice * qty;
      return `
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #EDF2F7; font-weight: 600;">${nomProd}</td>
          <td style="padding: 10px 0; border-bottom: 1px solid #EDF2F7; text-align: center;">x${qty}</td>
          <td style="padding: 10px 0; border-bottom: 1px solid #EDF2F7; text-align: right; font-weight: 700;">${itemTotal.toLocaleString('fr-FR')} €</td>
        </tr>
      `;
    }).join("");

    const clientNom = plainOrder.client?.nom || plainOrder.nomClient || "Cher Client";
    const totalValue = plainOrder.total !== undefined ? Number(plainOrder.total) : ((Number(plainOrder.sousTotal) || 0) + (Number(plainOrder.fraisLivraison) || 0));
    const totalFormatted = totalValue.toLocaleString('fr-FR');
    
    const baseUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const suiviUrl = rawId ? `${baseUrl}/mes-commandes?orderId=${rawId}` : `${baseUrl}/mes-commandes`;

    const isRecharge = plainOrder.typeVente === 'recharge_mobile' || (plainOrder.notes && plainOrder.notes.includes("recharge_mobile"));
    if (isRecharge) {
      const phoneMatch = (plainOrder.notes || "").match(/\+?\d{7,15}/);
      const kmfMatch = (plainOrder.notes || "").match(/(\d[\d\s]*)\s*KMF/i);
      const phone = phoneMatch ? phoneMatch[0] : (plainOrder.client?.telephone || "Non renseigné");
      const kmf = kmfMatch ? kmfMatch[1].trim() + " KMF" : "";

      const htmlRecharge = `
      <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #f8fafc; border-radius: 16px;">
        <div style="background: #0284C7; padding: 20px; border-radius: 12px; text-align: center; color: #ffffff; margin-bottom: 20px;">
          <h2 style="margin: 0; font-size: 20px;">Votre Recharge est confirmée</h2>
          <p style="margin: 6px 0 0; opacity: 0.9; font-size: 14px;">${boutiqueNom}</p>
        </div>
        <div style="background: #ffffff; padding: 24px; border-radius: 12px; border: 1px solid #e2e8f0;">
          <p style="font-size: 15px; color: #1e293b; margin-top: 0;">Bonjour <strong>${clientNom}</strong>,</p>
          <p style="font-size: 15px; color: #1e293b;">Votre achat de crédit mobile a été traité avec succès. <strong>Le crédit sera disponible instantanément</strong> sur le téléphone du destinataire.</p>
          <div style="background: #f1f5f9; padding: 16px; border-radius: 10px; margin: 18px 0; border-left: 4px solid #0284C7;">
            <div style="font-size: 14px; color: #475569; margin-bottom: 6px;">N° de Commande : <strong style="color: #0F172A;">#${cmdId}</strong></div>
            <div style="font-size: 14px; color: #475569; margin-bottom: 6px;">N° Destinataire : <strong style="color: #0F172A;">${phone}</strong></div>
            ${kmf ? `<div style="font-size: 14px; color: #475569; margin-bottom: 6px;">Valeur du crédit : <strong style="color: #0284C7;">${kmf}</strong></div>` : ''}
            <div style="font-size: 14px; color: #475569;">Total Réglé : <strong style="color: #0F172A;">${totalFormatted} €</strong></div>
          </div>
          <div style="text-align: center; margin-top: 24px;">
            <a href="${suiviUrl}" style="background: #0284C7; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 30px; font-weight: bold; font-size: 14px; display: inline-block;">Voir mon reçu sur le site</a>
          </div>
          <p style="font-size: 11px; color: #94a3b8; text-align: center; margin-top: 30px;">Ceci est un e-mail automatique, merci de ne pas y répondre. Vous recevez ce message car vous avez effectué un achat sur ${boutiqueNom}.</p>
        </div>
      </div>
      `;
      const subject = `Confirmation de votre Recharge Mobile #${cmdId} - ${boutiqueNom}`;
      return await sendEmailCore({ to: email, subject, html: htmlRecharge, type: "confirmation_recharge" });
    }

    const modeLiv = plainOrder.modeLivraison === 'domicile' ? 'Livraison à domicile' : 'Retrait en boutique';
    let moyenPaiement = plainOrder.moyenPaiement || 'Standard';
    if (moyenPaiement.toLowerCase() === 'cash' || moyenPaiement.toLowerCase() === 'especes' || moyenPaiement.toLowerCase() === 'espèces') {
      moyenPaiement = 'Paiement à la livraison / retrait';
    } else if (moyenPaiement.toLowerCase() === 'carte' || moyenPaiement.toLowerCase() === 'wero') {
      moyenPaiement = 'Paiement en ligne (Carte)';
    }

    const html = renderTemplate("confirmation-commande.html", {
      nom: clientNom,
      commandeId: cmdId,
      boutiqueNom: boutiqueNom || "EasyMarket",
      itemsHtml: itemsListHtml,
      total: totalFormatted,
      modeLivraison: modeLiv,
      moyenPaiement,
      suiviUrl
    });

    const subject = `Confirmation de votre Commande #${cmdId} - ${boutiqueNom}`;
    return await sendEmailCore({ to: email, subject, html, type: "confirmation_commande" });
  } catch (err) {
    console.error("❌ [EMAIL CONFIRMATION ERROR]:", err.message);
    return false;
  }
}

/**
 * Envoie un e-mail à l'administrateur lorsqu'une nouvelle commande est passée
 */
async function envoyerNotificationAdminNouvelleCommande(adminEmail, commande, boutiqueNom = "EasyMarket", baseUrl = "") {
  try {
    const plainOrder = commande && typeof commande.get === "function" ? commande.get({ plain: true }) : (commande || {});
    const rawId = plainOrder.id || plainOrder.orderId || 0;
    const cmdId = "COM-B" + String(rawId).padStart(3, "0");
    const clientNom = plainOrder.client?.nom || plainOrder.nomClient || "Client";
    const totalValue = plainOrder.total !== undefined ? Number(plainOrder.total) : ((Number(plainOrder.sousTotal) || 0) + (Number(plainOrder.fraisLivraison) || 0));
    const totalFormatted = totalValue.toLocaleString('fr-FR');
    
    const isPaid = plainOrder.statutPaiement === 'paye';
    const isCard = plainOrder.moyenPaiement === 'carte' || plainOrder.moyenPaiement === 'wero';
    const paymentMethodDisplay = isCard ? 'Paiement en ligne (Carte/Wero)' : 'Paiement à la livraison/retrait';
    const paymentStatusDisplay = isPaid ? '<strong style="color: #059669;">✅ DÉJÀ PAYÉ</strong>' : '<strong style="color: #D97706;">⏳ NON PAYÉ (À encaisser)</strong>';

    const originUrl = baseUrl || process.env.FRONTEND_URL || "http://localhost:5173";
    const adminUrl = `${originUrl}/admin/commandes`;

    const isRecharge = plainOrder.typeVente === 'recharge_mobile' || (plainOrder.notes && plainOrder.notes.includes("recharge_mobile"));
    let rechargeDetailsHtml = '';
    
    if (isRecharge) {
      const phoneMatch = (plainOrder.notes || "").match(/\+?\d{7,15}/);
      const kmfMatch = (plainOrder.notes || "").match(/(\d[\d\s]*)\s*KMF/i);
      const phone = phoneMatch ? phoneMatch[0] : (plainOrder.client?.telephone || "Non renseigné");
      const kmf = kmfMatch ? kmfMatch[1].trim() + " KMF" : "";

      rechargeDetailsHtml = `
        <div style="background: #E0F2FE; border-left: 4px solid #0284C7; padding: 12px; margin-top: 12px; border-radius: 6px;">
          <div style="font-size: 14px; color: #0369A1; margin-bottom: 6px;"><strong>📱 Service de Recharge Mobile</strong></div>
          <div style="font-size: 14px; color: #0F172A; margin-bottom: 4px;">N° Destinataire : <strong>${phone}</strong></div>
          ${kmf ? `<div style="font-size: 14px; color: #0F172A;">Valeur envoyée : <strong style="color: #0284C7;">${kmf}</strong></div>` : ''}
        </div>
      `;
    }

    const html = `
      <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #f8fafc; border-radius: 16px;">
        <div style="background: ${isRecharge ? '#0284C7' : '#163424'}; padding: 20px; border-radius: 12px; text-align: center; color: #ffffff; margin-bottom: 20px;">
          <h2 style="margin: 0; font-size: 20px;">${isRecharge ? 'Nouvelle Recharge Mobile' : 'Nouvelle Commande Reçue'}</h2>
          <p style="margin: 6px 0 0; opacity: 0.9; font-size: 14px;">${boutiqueNom}</p>
        </div>
        <div style="background: #ffffff; padding: 24px; border-radius: 12px; border: 1px solid #e2e8f0;">
          <p style="font-size: 15px; color: #1e293b; margin-top: 0;">Un achat vient d'être effectué sur votre boutique par le client <strong>${clientNom}</strong>.</p>
          <div style="background: #f1f5f9; padding: 16px; border-radius: 10px; margin: 18px 0;">
            <div style="font-size: 14px; color: #475569; margin-bottom: 6px;">Client : <strong style="color: #163424;">${clientNom}</strong></div>
            <div style="font-size: 14px; color: #475569; margin-bottom: 6px;">N° de Commande : <strong style="color: #163424;">#${cmdId}</strong></div>
            <div style="font-size: 14px; color: #475569; margin-bottom: 6px;">Montant Total : <strong style="color: #163424;">${totalFormatted} €</strong></div>
            <div style="font-size: 14px; color: #475569; margin-bottom: 6px;">Méthode : <strong>${paymentMethodDisplay}</strong></div>
            <div style="font-size: 14px; color: #475569; margin-bottom: 6px;">Statut : ${paymentStatusDisplay}</div>
            ${isRecharge ? rechargeDetailsHtml : `<div style="font-size: 14px; color: #475569;">Mode de Livraison : <strong>${plainOrder.modeLivraison === 'domicile' ? 'Livraison à domicile' : 'Retrait en boutique'}</strong></div>`}
          </div>
          <div style="text-align: center; margin-top: 24px;">
            <a href="${adminUrl}" style="background: ${isRecharge ? '#0284C7' : '#2D8653'}; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 30px; font-weight: bold; font-size: 14px; display: inline-block;">Gérer la commande dans l'Admin</a>
          </div>
          <p style="font-size: 11px; color: #94a3b8; text-align: center; margin-top: 30px;">Ceci est une notification automatique de votre boutique.</p>
        </div>
      </div>
    `;

    const subject = `${isRecharge ? '[Recharge Mobile]' : '[Nouvelle Commande]'} #${cmdId} de ${clientNom} (${totalFormatted} EUR) - ${boutiqueNom}`;
    return await sendEmailCore({ to: adminEmail, subject, html, type: "admin_notification" });
  } catch (err) {
    console.error("❌ [EMAIL ADMIN NOTIFICATION ERROR]:", err.message);
    return false;
  }
}

/**
 * 3. Envoie une notification de changement de statut de commande
 */
async function envoyerChangementStatut(email, commande, ancienStatut, nouveauStatut, boutiqueNom = "EasyMarket") {
  try {
    const plainOrder = commande && typeof commande.get === "function" ? commande.get({ plain: true }) : (commande || {});
    const rawId = plainOrder.id || plainOrder.orderId || 0;
    const cmdId = "COM-B" + String(rawId).padStart(3, "0");

    const statusLabels = {
      en_attente: "En attente de confirmation",
      validee: "Confirmée",
      en_preparation: "En cours de préparation",
      pret_retrait: "Prête à récupérer en boutique",
      en_livraison: "En cours de livraison",
      recuperee: "Récupérée",
      livree: "Livrée",
      annulee: "Annulée"
    };

    const statusTitle = statusLabels[nouveauStatut] || nouveauStatut;
    const clientNom = plainOrder.client?.nom || plainOrder.nomClient || "Cher Client";

    const baseUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const suiviUrl = rawId ? `${baseUrl}/mes-commandes?orderId=${rawId}` : `${baseUrl}/mes-commandes`;

    const html = renderTemplate("changement-statut.html", {
      nom: clientNom,
      commandeId: cmdId,
      nouveauStatut: statusTitle,
      boutiqueNom: boutiqueNom || "EasyMarket",
      suiviUrl
    });

    const subject = `Mise à jour Commande #${cmdId} : ${statusTitle} — ${boutiqueNom}`;
    return await sendEmailCore({ to: email, subject, html, type: "statut_commande" });
  } catch (err) {
    console.error("❌ [EMAIL STATUT ERROR]:", err.message);
    return false;
  }
}

/**
 * 4. Envoie un e-mail de réinitialisation de mot de passe
 */
async function envoyerResetMotDePasse(email, resetUrl, nomUtilisateur = "Client") {
  try {
    const html = renderTemplate("reset-password.html", {
      nom: nomUtilisateur || "Client",
      resetUrl,
      appName: process.env.BREVO_SENDER_NAME || "EasyMarket"
    });

    const subject = `Réinitialisation de votre mot de passe — EasyMarket`;
    return await sendEmailCore({ to: email, subject, html, type: "reset_password" });
  } catch (err) {
    console.error("❌ [EMAIL RESET PASSWORD ERROR]:", err.message);
    return false;
  }
}

/**
 * 5. Envoie un e-mail de création de compte avec identifiants temporaires
 */
async function envoyerEmailCreationCompte(email, nomUtilisateur, identifiant, telephone, tempPassword, role, boutiqueNom = "EasyMarket") {
  try {
    const roleLabel = role === "admin" ? "Administrateur" : "Employé";
    const baseUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const connUrl = `${baseUrl}/connexion`;

    const html = `
      <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #f8fafc; border-radius: 16px;">
        <div style="background: #163424; padding: 24px; border-radius: 12px; text-align: center; color: #ffffff; margin-bottom: 20px;">
          <h2 style="margin: 0; font-size: 22px;">Bienvenue sur ${boutiqueNom}</h2>
          <p style="margin: 8px 0 0; opacity: 0.9; font-size: 14px;">Votre compte ${roleLabel} a été créé avec succès</p>
        </div>
        <div style="background: #ffffff; padding: 28px; border-radius: 12px; border: 1px solid #e2e8f0;">
          <p style="font-size: 15px; color: #1e293b; margin-top: 0;">Bonjour <strong>${nomUtilisateur}</strong>,</p>
          <p style="font-size: 14px; color: #475569; line-height: 1.6;">
            Un compte vous a été attribué sur la plateforme <strong>${boutiqueNom}</strong> avec le rôle de <strong>${roleLabel}</strong>. Voici vos identifiants de connexion :
          </p>
          <div style="background: #f1f5f9; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #2D8653;">
            ${email ? `<div style="font-size: 14px; color: #475569; margin-bottom: 8px;"><strong>Adresse E-mail :</strong> <span style="color: #1e293b; font-family: monospace; font-size: 15px;">${email}</span></div>` : ''}
            ${telephone ? `<div style="font-size: 14px; color: #475569; margin-bottom: 8px;"><strong>Téléphone :</strong> <span style="color: #1e293b; font-family: monospace; font-size: 15px;">${telephone}</span></div>` : ''}
            <div style="font-size: 14px; color: #475569;"><strong>Mot de passe générique :</strong> <span style="color: #163424; font-family: monospace; font-size: 16px; font-weight: bold; background: #e2e8f0; padding: 2px 8px; border-radius: 6px;">${tempPassword}</span></div>
          </div>
          <p style="font-size: 13px; color: #b45309; background: #fef3c7; padding: 12px 14px; border-radius: 8px; font-weight: 600;">
            Important : Lors de votre 1ère connexion, un changement de mot de passe vous sera automatiquement demandé pour sécuriser votre compte.
          </p>
          <div style="text-align: center; margin-top: 28px;">
            <a href="${connUrl}" style="background: #2D8653; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 30px; font-weight: bold; font-size: 15px; display: inline-block;">Se connecter à mon compte</a>
          </div>
        </div>
      </div>
    `;

    const subject = `Vos identifiants de connexion — ${boutiqueNom}`;
    return await sendEmailCore({ to: email, subject, html, type: "creation_compte" });
  } catch (err) {
    console.error("❌ [EMAIL CREATION COMPTE ERROR]:", err.message);
    return false;
  }
}

/**
 * Alerte l'administrateur lorsque le solde Reloadly est épuisé ou insuffisant
 */
let lastLowBalanceAlertAt = 0;
async function sendReloadlyLowBalanceAlert({ adminEmail, balance = 0, currency = "USD", attemptedPhone = "", amountKmf = "", boutiqueNom = "EasyMarket" }) {
  try {
    const now = Date.now();
    // Limite d'envoi : max 1 alerte toutes les 15 minutes
    if (now - lastLowBalanceAlertAt < 15 * 60 * 1000) {
      console.log("ℹ️ [Alerte Solde Reloadly] Alerte déjà envoyée récemment (moins de 15 min), envoi différé.");
      return false;
    }
    lastLowBalanceAlertAt = now;

    const to = adminEmail || process.env.BREVO_SENDER_EMAIL || "soilihiabdou99@gmail.com";
    const subject = `🚨 [URGENT] Solde Recharge Mobile Épuisé (${balance} ${currency}) - ${boutiqueNom}`;
    const html = `
      <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #fef2f2; border-radius: 16px; border: 1px solid #fecaca;">
        <div style="background: #dc2626; padding: 20px; border-radius: 12px; text-align: center; color: #ffffff; margin-bottom: 20px;">
          <h2 style="margin: 0; font-size: 20px;">⚠️ Solde Reloadly Épuisé (0.00 $)</h2>
          <p style="margin: 6px 0 0; opacity: 0.9; font-size: 14px;">Action requise : rechargez votre compte Reloadly</p>
        </div>
        <div style="background: #ffffff; padding: 24px; border-radius: 12px; border: 1px solid #e2e8f0;">
          <p style="font-size: 15px; color: #1e293b; margin-top: 0;">
            Un client a tenté d'acheter une recharge de crédit${amountKmf ? ' de <strong>' + amountKmf + ' KMF</strong>' : ''}${attemptedPhone ? ' pour le numéro <strong>' + attemptedPhone + '</strong>' : ''}, mais l'achat a été bloqué pour protéger le client car votre solde Reloadly est actuellement à <strong>${balance} ${currency}</strong>.
          </p>
          <div style="background: #f8fafc; padding: 16px; border-radius: 10px; margin: 18px 0; border-left: 4px solid #dc2626;">
            <div style="font-size: 14px; color: #475569; margin-bottom: 6px;">Solde Actuel Reloadly : <strong style="color: #dc2626; font-size: 16px;">${balance} ${currency}</strong></div>
            <div style="font-size: 14px; color: #475569; margin-bottom: 6px;">Protection Client : <strong style="color: #16a34a;">Le client n'a PAS été débité</strong></div>
            <div style="font-size: 14px; color: #475569;">Message affiché au client : <em>"Le service de recharge est momentanément en maintenance. Veuillez réessayer dans quelques minutes."</em></div>
          </div>
          <p style="font-size: 14px; color: #334155; line-height: 1.5;">
            Pour réactiver immédiatement les ventes de crédit mobile, connectez-vous sur votre tableau de bord Reloadly et déposez des fonds dans votre portefeuille (Wallet) :
          </p>
          <div style="text-align: center; margin-top: 24px; margin-bottom: 12px;">
            <a href="https://dashboard.reloadly.com/wallet" style="background: #dc2626; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 30px; font-weight: bold; font-size: 14px; display: inline-block;">Recharger mon Wallet Reloadly (Dashboard)</a>
          </div>
        </div>
      </div>
    `;

    return await sendEmailCore({ to, subject, html, type: "reloadly_low_balance_alert" });
  } catch (err) {
    console.error("❌ [EMAIL LOW BALANCE ALERT ERROR]:", err.message);
    return false;
  }
}

module.exports = {
  envoyerOTP,
  envoyerConfirmationCommande,
  envoyerNotificationAdminNouvelleCommande,
  envoyerChangementStatut,
  envoyerResetMotDePasse,
  envoyerEmailCreationCompte,
  sendReloadlyLowBalanceAlert,
  sendEmailCore,
  // Alias de rétrocompatibilité
  sendMail: ({ to, subject, html }) => sendEmailCore({ to, subject, html, type: "legacy" }),
  sendOtpEmail: (email, name, code) => envoyerOTP(email, code, name),
  sendOrderConfirmationEmail: (email, name, order, boutiqueName) => {
    const plainOrder = order && typeof order.get === "function" ? order.get({ plain: true }) : (order || {});
    return envoyerConfirmationCommande(email, { ...plainOrder, client: { nom: name } }, boutiqueName);
  },
  sendOrderStatusEmail: (email, name, order, newStatus, boutiqueName) => {
    const plainOrder = order && typeof order.get === "function" ? order.get({ plain: true }) : (order || {});
    return envoyerChangementStatut(email, { ...plainOrder, client: { nom: name } }, null, newStatus, boutiqueName);
  }
};
