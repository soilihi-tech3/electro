import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";
import { Zap, CheckCircle2, CreditCard, Lock, AlertCircle, Info, ArrowRight, UserCheck, Smartphone } from "lucide-react";
import api, { SLUG } from "../../api";
import { useCart } from "../../context/CartContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { MessageCircle } from "lucide-react";
import { WeroLogo, OnlinePaymentBadges } from "../../components/PaymentLogos";

// Logos Wave et Orange Money inline (SVG/images)
const WaveLogo = () => (
  <img
    src="https://paytech.sn/assets/srcs/img/wave-logo.png"
    alt="Wave"
    style={{ height: 28, objectFit: "contain" }}
    onError={(e) => { e.target.style.display = "none"; }}
  />
);

const OrangeMoneyLogo = () => (
  <img
    src="https://paytech.sn/assets/srcs/img/orange-money-logo.png"
    alt="Orange Money"
    style={{ height: 28, objectFit: "contain" }}
    onError={(e) => { e.target.style.display = "none"; }}
  />
);

const OPERATORS = [
  {
    id: "comores_telecom",
    name: "Comores Telecom (Huri)",
    color: "#0284C7",
    bg: "#E0F2FE",
    prefixDigit: "3",
    sampleNumber: "3326532",
    logo: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRwXCzHPxEU7yFGviVbPuXzSwtISwrgUsYltf6K2OdEbg&s=10",
    description: "Puces Huri Comores Telecom (numéros commençant par 3)",
    recharges: [
      { eur: 1.70, kmf: 500, label: "500 KMF (1 115 FCFA)", popular: false },
      { eur: 3.20, kmf: 1000, label: "1 000 KMF (2 100 FCFA)", popular: true },
      { eur: 6.30, kmf: 2000, label: "2 000 KMF (4 130 FCFA)", popular: true },
      { eur: 9.40, kmf: 3000, label: "3 000 KMF (6 160 FCFA)", popular: false },
      { eur: 15.50, kmf: 5000, label: "5 000 KMF (10 160 FCFA)", popular: true },
      { eur: 30.50, kmf: 10000, label: "10 000 KMF (20 000 FCFA)", popular: false },
      { eur: 45.00, kmf: 15000, label: "15 000 KMF (29 500 FCFA)", popular: false }
    ]
  },
  {
    id: "yas",
    name: "YAS (Telma) Comores",
    color: "#E11D48",
    bg: "#FFE4E6",
    prefixDigit: "4",
    sampleNumber: "4326532",
    logo: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRHntdwTjQynlyFFXrmTp9qv9tpNuYIARtdazD377Rv4g&s=10",
    description: "Puces Yas Telma (numéros commençant par 4)",
    recharges: [
      { eur: 3.00, kmf: 1000, label: "1 000 KMF (1 970 FCFA)", popular: false },
      { eur: 5.90, kmf: 2000, label: "2 000 KMF (3 870 FCFA)", popular: true },
      { eur: 8.70, kmf: 3000, label: "3 000 KMF (5 700 FCFA)", popular: false },
      { eur: 14.50, kmf: 5000, label: "5 000 KMF (9 510 FCFA)", popular: true },
      { eur: 28.50, kmf: 10000, label: "10 000 KMF (18 700 FCFA)", popular: false },
      { eur: 42.50, kmf: 15000, label: "15 000 KMF (27 880 FCFA)", popular: false }
    ]
  }
];

export default function RechargeMobile() {
  const { showToast } = useCart();
  const { user, boutique } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const statusParam = searchParams.get("status");
  const phoneParam = searchParams.get("phone");
  const orderIdParam = searchParams.get("order_id");

  const [operator, setOperator] = useState(OPERATORS[0]); // Comores Telecom par défaut
  const [phone, setPhone] = useState("");

  const defaultModes = { holam: true, carte: true, wave: true, orange: true };
  const modesPaiement = { ...defaultModes, ...(boutique?.modesPaiement || {}) };
  const weroAvailable = !!modesPaiement.holam;
  const carteAvailable = !!modesPaiement.carte;
  const waveAvailable = !!modesPaiement.wave;
  const orangeAvailable = !!modesPaiement.orange;
  const isModuleActive = boutique?.modulesActifs?.rechargeCredit !== false;

  // Sélection du moyen de paiement par défaut
  const defaultPayment = waveAvailable ? "wave" : orangeAvailable ? "orange" : carteAvailable ? "carte" : "wero";
  const [moyenPaiement, setMoyenPaiement] = useState(defaultPayment);

  useEffect(() => {
    const isCurrentValid =
      (moyenPaiement === "wave" && waveAvailable) ||
      (moyenPaiement === "orange" && orangeAvailable) ||
      (moyenPaiement === "carte" && carteAvailable) ||
      (moyenPaiement === "wero" && weroAvailable);
    if (!isCurrentValid) {
      if (waveAvailable) setMoyenPaiement("wave");
      else if (orangeAvailable) setMoyenPaiement("orange");
      else if (carteAvailable) setMoyenPaiement("carte");
      else if (weroAvailable) setMoyenPaiement("wero");
    }
  }, [waveAvailable, orangeAvailable, carteAvailable, weroAvailable, moyenPaiement]);

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentModalData, setPaymentModalData] = useState(null);

  const [dbPlans, setDbPlans] = useState([]);
  const [maintenanceInfo, setMaintenanceInfo] = useState(null);

  useEffect(() => {
    const fetchPlansAndStatus = async () => {
      try {
        const [plansRes, statusRes] = await Promise.all([
          api.get(`/store/${SLUG}/recharge-plans`).catch(() => ({ data: [] })),
          api.get(`/store/${SLUG}/recharge-status`).catch(() => ({ data: { available: true } }))
        ]);
        if (plansRes?.data) setDbPlans(plansRes.data);
        if (statusRes?.data?.inMaintenance) {
          setMaintenanceInfo(statusRes.data.message || "Le service de recharge est momentanément en maintenance. Veuillez réessayer dans quelques minutes.");
        } else {
          setMaintenanceInfo(null);
        }
      } catch (err) {
        console.error("Erreur lors de la récupération des forfaits de recharge", err);
      }
    };
    fetchPlansAndStatus();
  }, []);

  // Selection
  const [selectedRecharge, setSelectedRecharge] = useState(OPERATORS[0].recharges[0]);

  const getRechargesFor = (opId) => {
    const dbOp = opId === "comores_telecom" ? "hury" : "telma";
    const opPlans = dbPlans.filter(p => p.operator === dbOp);
    if (opPlans.length > 0) return opPlans;
    return OPERATORS.find(o => o.id === opId).recharges;
  };

  useEffect(() => {
    // Si les forfaits changent et que selectedRecharge n'est plus valide ou qu'on vient de charger
    const plans = getRechargesFor(operator.id);
    if (plans.length > 0) {
      setSelectedRecharge(plans[0]);
    }
  }, [operator, dbPlans]);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (statusParam === "success") {
      const verify = async () => {
        if (orderIdParam) {
          try {
            await api.post(`/store/${SLUG}/orders/${orderIdParam}/verify-payment`);
          } catch (e) {}
        }
        showToast(`Paiement réussi ! Crédit envoyé direct au +269 ${phoneParam || ""}`, "success", "Félicitations");
        // Nettoyer les paramètres d'URL pour éviter que le message ne réapparaisse à chaque rafraîchissement/render
        navigate(location.pathname, { replace: true });
      };
      verify();
    } else if (statusParam === "canceled") {
      showToast("Paiement de la recharge annulé.", "info");
      navigate(location.pathname, { replace: true });
    }
  }, [statusParam, phoneParam, orderIdParam, showToast, navigate, location.pathname]);

  const handlePhoneChange = (e) => {
    const rawVal = e.target.value.replace(/\D/g, "");
    if (rawVal.length > 7) return; // BLOQUER STRICTEMENT À 7 CHIFFRES

    setPhone(rawVal);
    setErrorMsg("");

    // Auto-sélection opérateur selon le 1er chiffre
    if (rawVal.startsWith("3")) {
      setOperator(OPERATORS[0]); // Comores Telecom (3)
    } else if (rawVal.startsWith("4")) {
      setOperator(OPERATORS[1]); // Yas (4)
    }
  };

  const handleOperatorSelect = (op) => {
    setOperator(op);
    setSelectedRecharge(op.recharges[0]);
    if (phone && !phone.startsWith(op.prefixDigit)) {
      setPhone(op.prefixDigit);
    }
  };

  const currentTotalEur = selectedRecharge?.eur || 2.70;
  const currentSummaryTitle = `Recharge ${selectedRecharge?.kmf?.toLocaleString("fr-FR")} KMF`;

  const handleProceed = async (e) => {
    e.preventDefault();
    setErrorMsg("");

    if (!isModuleActive) {
      const msg = "Le service de recharge de crédit mobile est actuellement désactivé pour cette boutique.";
      setErrorMsg(msg);
      showToast(msg, "error");
      return;
    }

    if (moyenPaiement === "wave" && !waveAvailable) {
      showToast("Le paiement par Wave est temporairement désactivé.", "error");
      return;
    }
    if (moyenPaiement === "orange" && !orangeAvailable) {
      showToast("Le paiement par Orange Money est temporairement désactivé.", "error");
      return;
    }
    if (moyenPaiement === "carte" && !carteAvailable) {
      showToast("Le paiement par Carte bancaire est temporairement désactivé.", "error");
      return;
    }
    if (moyenPaiement === "wero" && !weroAvailable) {
      showToast("Le paiement par Wero est temporairement désactivé.", "error");
      return;
    }

    if (maintenanceInfo) {
      setErrorMsg(maintenanceInfo);
      showToast(maintenanceInfo, "error");
      return;
    }

    if (!user) {
      showToast("Veuillez vous connecter pour recharger du crédit.", "info");
      navigate(`/connexion?redirect=${encodeURIComponent(location.pathname)}`);
      return;
    }

    if (!phone || phone.length !== 7) {
      const msg = `Le numéro aux Comores doit comporter exactement 7 chiffres (ex: ${operator.sampleNumber}).`;
      setErrorMsg(msg);
      showToast(msg, "error");
      return;
    }

    if (operator.id === "comores_telecom" && !phone.startsWith("3")) {
      const msg = "Pour Comores Telecom (Huri), le numéro doit commencer par le chiffre 3.";
      setErrorMsg(msg);
      showToast(msg, "error");
      return;
    }

    if (operator.id === "yas" && !phone.startsWith("4")) {
      const msg = "Pour YAS (Telma), le numéro doit commencer par le chiffre 4.";
      setErrorMsg(msg);
      showToast(msg, "error");
      return;
    }

    setLoading(true);
    try {
      const titleItem = `Recharge Crédit ${selectedRecharge.kmf} KMF`;

      const res = await api.post(`/store/${SLUG}/create-recharge-session`, {
        operatorName: `${operator.name} - ${titleItem}`,
        phone: `+269${phone}`,
        amountEur: currentTotalEur,
        moyenPaiement: moyenPaiement
      });

      if (moyenPaiement === "wero") {
        setPaymentModalData({
          operatorName: `${operator.name} - ${titleItem}`,
          phone: `+269${phone}`,
          amountEur: currentTotalEur,
          orderId: res.data.orderId
        });
        setShowPaymentModal(true);
        return;
      }

      if (res.data?.url) {
        window.location.href = res.data.url;
        return;
      }

      // Initiation sécurisée directe depuis le navigateur si Render est bloqué par Imunify360
      if (res.data?.clientInitiated) {
        const { endpoint, action, apiKey, payload, orderId } = res.data;
        const uRes = await fetch(`${endpoint}?action=${action}`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        });
        const uData = await uRes.json().catch(() => ({}));
        if (uData && uData.success && uData.data) {
          const paymentUrl = uData.data.payment_url || uData.data.deep_links?.MAXIT || uData.data.deep_links?.OM;
          const reference = uData.data.reference || `RECHARGE-${orderId}-${Date.now()}`;
          await api.post(`/store/${SLUG}/orders/${orderId}/payment-reference`, { reference }).catch(() => {});
          if (paymentUrl) {
            window.location.href = paymentUrl;
            return;
          }
        }
        throw new Error(uData?.message || "Impossible de générer le lien de paiement UnitechPay.");
      }

      throw new Error(res.data?.message || "Lien de paiement non reçu.");
    } catch (err) {
      console.error("Erreur initialisation paiement recharge:", err);
      const isMaint = err.response?.status === 503 || err.response?.data?.code === "RECHARGE_MAINTENANCE";
      const errorMsgDetail = isMaint
        ? (err.response?.data?.message || "Le service de recharge est momentanément en maintenance. Veuillez réessayer dans quelques minutes.")
        : (err.response?.data?.message || err.message || "Impossible de démarrer la session de paiement. Veuillez réessayer.");

      if (isMaint) {
        setMaintenanceInfo(errorMsgDetail);
      }
      setErrorMsg(errorMsgDetail);
      showToast(errorMsgDetail, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ width: "100%", paddingBottom: 60, position: "relative" }}>
      {/* PROFESSIONAL LOADING OVERLAY */}
      {loading && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "rgba(255,255,255,0.85)", backdropFilter: "blur(10px)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          animation: "authCardEntrance 0.3s ease forwards"
        }}>
          <div style={{
            background: "var(--forest-dark)", padding: "40px 50px", borderRadius: 24,
            boxShadow: "0 20px 40px rgba(22, 52, 36, 0.25)", textAlign: "center", color: "#fff",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 16
          }}>
            <span style={{ width: 44, height: 44, border: "4px solid rgba(255,255,255,0.2)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} />
            <div>
              <h3 style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 800 }}>Connexion sécurisée</h3>
              <p style={{ margin: 0, fontSize: 14, color: "rgba(255,255,255,0.8)" }}>
                {moyenPaiement === "wave" ? "Redirection vers Wave..." :
                 moyenPaiement === "orange" ? "Redirection vers Orange Money..." :
                 "Redirection vers la caisse..."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* HEADER HERO SECTION */}
      <div style={{
        background: "linear-gradient(135deg, #163424 0%, #224B35 60%, #2D6A4F 100%)",
        borderRadius: 0,
        padding: "48px 32px 52px",
        color: "#ffffff",
        textAlign: "center",
        boxShadow: "0 8px 32px rgba(22, 52, 36, 0.18)",
        marginBottom: 32,
        position: "relative",
        overflow: "hidden"
      }}>
        {/* décorations de fond */}
        <div style={{ position: "absolute", top: -60, right: -60, width: 220, height: 220, borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />
        <div style={{ position: "absolute", bottom: -40, left: -40, width: 160, height: 160, borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          background: "rgba(255, 255, 255, 0.15)",
          backdropFilter: "blur(6px)",
          padding: "6px 16px",
          borderRadius: 20,
          fontSize: 12.5,
          fontWeight: 700,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          marginBottom: 18
        }}>
          <Zap size={15} color="#A7F3D0" /> Service Comores Telecom (Huri) &amp; YAS (Telma)
        </div>

        <h1 style={{ fontSize: "clamp(26px, 5vw, 40px)", fontWeight: 900, margin: "0 0 12px", letterSpacing: "-0.5px" }}>
          Recharge Crédit Mobile Comores
        </h1>
        <p style={{ fontSize: 16, color: "#DDE8DF", maxWidth: 560, margin: "0 auto", lineHeight: 1.6 }}>
          Envoyez du crédit d&apos;appel instantanément pour vos proches aux Comores.
        </p>
      </div>

      {/* erreur */}
      {errorMsg && (
        <div style={{
          background: "#FDF2F0", border: "1px solid #F8D7D2", color: "#B4483A",
          padding: "14px 18px", borderRadius: 14, fontWeight: 700, fontSize: 14,
          margin: "0 24px 20px", display: "flex", alignItems: "center", gap: 10
        }}>
          <AlertCircle size={18} /> {errorMsg}
        </div>
      )}

      {/* Alerte si module désactivé par SuperAdmin ou boutique */}
      {!isModuleActive && (
        <div style={{
          background: "#FEF2F2", border: "1.5px solid #FCA5A5", color: "#991B1B",
          padding: "16px 20px", borderRadius: 16, fontWeight: 700, fontSize: 14.5,
          margin: "0 auto 24px", maxWidth: 980, width: "calc(100% - 48px)",
          display: "flex", alignItems: "center", gap: 12,
          boxShadow: "0 2px 8px rgba(239, 68, 68, 0.08)"
        }}>
          <AlertCircle size={22} color="#DC2626" style={{ flexShrink: 0 }} />
          <div>
            <strong>Service momentanément indisponible :</strong> La recharge de crédit mobile a été désactivée pour cette boutique par l&apos;administrateur.
          </div>
        </div>
      )}

      {/* Alerte si le service est momentanément en maintenance (solde portefeuille épuisé) */}
      {isModuleActive && maintenanceInfo && (
        <div style={{
          background: "#FFFBEB", border: "1.5px solid #FDE68A", color: "#B45309",
          padding: "16px 20px", borderRadius: 16, fontWeight: 600, fontSize: 14,
          margin: "0 auto 24px", maxWidth: 980, width: "calc(100% - 48px)",
          display: "flex", alignItems: "center", gap: 14,
          boxShadow: "0 2px 10px rgba(245, 158, 11, 0.1)"
        }}>
          <AlertCircle size={24} color="#D97706" style={{ flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: "#92400E", marginBottom: 2 }}>
              Service momentanément en maintenance
            </div>
            <div>{maintenanceInfo}</div>
          </div>
        </div>
      )}

      {/* CARD PRINCIPALE DE RECHARGE */}
      <div style={{
        background: "#ffffff",
        border: "1px solid var(--line)",
        borderRadius: 20,
        padding: "32px 28px",
        boxShadow: "0 4px 20px rgba(0,0,0,0.05)",
        maxWidth: 980,
        margin: "0 auto",
        width: "calc(100% - 48px)",
        boxSizing: "border-box"
      }}>
        <form onSubmit={handleProceed}>
          {/* STEP 1: CHOOSE OPERATOR */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: "block", fontSize: 14, fontWeight: 800, color: "var(--forest-dark)", marginBottom: 12 }}>
              1. Choisissez l'opérateur aux Comores
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
              {OPERATORS.map((op) => {
                const isSelected = operator.id === op.id;
                return (
                  <div
                    key={op.id}
                    onClick={() => handleOperatorSelect(op)}
                    style={{
                      border: `2.5px solid ${isSelected ? op.color : "var(--line)"}`,
                      background: isSelected ? op.bg : "var(--card)",
                      borderRadius: 18,
                      padding: 18,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      transition: "all 0.2s ease",
                      boxShadow: isSelected ? `0 4px 14px ${op.color}25` : "none"
                    }}
                  >
                    <div className="bs-operator-logo-box">
                      <img
                        src={op.logo}
                        alt={op.name}
                      />
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 800, fontSize: 15, color: "var(--ink)" }}>{op.name}</div>
                      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                        Numéros : <strong>{op.prefixDigit}XX XX XX</strong> (7 chiffres)
                      </div>
                    </div>
                    {isSelected && <CheckCircle2 size={22} color={op.color} style={{ flexShrink: 0 }} />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* STEP 2: ENTER PHONE NUMBER (7 DIGITS MAX) */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <label style={{ fontSize: 14, fontWeight: 800, color: "var(--forest-dark)" }}>
                2. Numéro du destinataire aux Comores (+269)
              </label>
              <span style={{ fontSize: 12, fontWeight: 700, color: phone.length === 7 ? "#2D8653" : "var(--muted)" }}>
                {phone.length} / 7 chiffres
              </span>
            </div>

            <div style={{ position: "relative" }}>
              <div style={{
                position: "absolute",
                left: 14,
                top: "50%",
                transform: "translateY(-50%)",
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 15,
                fontWeight: 900,
                color: "var(--forest-dark)"
              }}>
                🇰🇲 +269
              </div>
              <input
                type="tel"
                className="bs-input"
                placeholder={`Ex: ${operator.sampleNumber}`}
                value={phone}
                onChange={handlePhoneChange}
                maxLength={7}
                style={{
                  paddingLeft: 96,
                  borderRadius: 14,
                  fontSize: 18,
                  fontWeight: 800,
                  letterSpacing: "1px",
                  borderColor: phone.length === 7 ? "var(--forest)" : phone.length > 0 && !phone.startsWith(operator.prefixDigit) ? "#B4483A" : "var(--line)"
                }}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--muted)", marginTop: 8 }}>
              <Info size={14} color="var(--forest)" />
              <span>
                {operator.id === "comores_telecom"
                  ? "Puce Huri Comores Telecom : le numéro commence par 3 (ex: 3XX XX XX)."
                  : "Puce YAS (Telma) : le numéro commence par 4 (ex: 4XX XX XX )."
                }
              </span>
            </div>
          </div>

          {/* OFFRES DE RECHARGE CRÉDIT */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: "block", fontSize: 14, fontWeight: 800, color: "var(--forest-dark)", marginBottom: 12 }}>
              3. Sélectionnez le montant du crédit :
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14 }}>
              {getRechargesFor(operator.id).map((rec) => {
                const isSelected = selectedRecharge?.kmf === rec.kmf;
                return (
                  <div
                    key={rec.id || rec.kmf}
                    onClick={() => setSelectedRecharge(rec)}
                    style={{
                      background: isSelected ? "var(--forest)" : "var(--card)",
                      color: isSelected ? "#ffffff" : "var(--ink)",
                      border: `2px solid ${isSelected ? "var(--forest)" : "var(--line)"}`,
                      borderRadius: 16,
                      padding: "16px 14px",
                      cursor: "pointer",
                      textAlign: "center",
                      transition: "all 0.15s ease",
                      position: "relative",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.04)"
                    }}
                  >
                    {(rec.popular || rec.promo) && (
                      <span style={{
                        position: "absolute", top: -9, right: 10, background: rec.promo ? "#E11D48" : "#F59E0B", color: "#fff",
                        fontSize: 9.5, fontWeight: 800, padding: "2px 6px", borderRadius: 8, textTransform: "uppercase"
                      }}>
                        {rec.promo ? "Promo" : "Populaire"}
                      </span>
                    )}
                    <div style={{ fontSize: 20, fontWeight: 900 }}>{rec.kmf.toLocaleString("fr-FR")} KMF</div>
                    <div style={{
                      marginTop: 6,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 2
                    }}>
                      <span style={{
                        fontSize: 15,
                        fontWeight: 900,
                        color: isSelected ? "#FEF08A" : "#0284C7"
                      }}>
                        {Math.round(rec.eur * 655.957).toLocaleString("fr-FR")} FCFA
                      </span>
                      <span style={{ fontSize: 12, opacity: isSelected ? 0.9 : 0.65, fontWeight: 600 }}>
                        soit {rec.eur.toFixed(2)} €
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* BOÎTE DE RÉSUMÉ FINANCIER EN EUROS & FCFA */}
          <div style={{
            background: "var(--forest-light)",
            border: "1.5px solid var(--forest)",
            borderRadius: 16,
            padding: "18px 20px",
            marginBottom: 28,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12
          }}>
            <div>
              <div style={{ fontSize: 11.5, fontWeight: 800, color: "var(--forest)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Récapitulatif de votre commande en direct
              </div>
              <div style={{ fontSize: 17, fontWeight: 900, color: "var(--forest-dark)", marginTop: 2 }}>
                {currentSummaryTitle}
              </div>
              <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>
                Destinataire : <strong>+269 {phone || operator.sampleNumber}</strong> ({operator.name})
              </div>
              <div style={{ fontSize: 12, color: "#166534", marginTop: 4, fontWeight: 600 }}>
                ⚡ Crédit envoyé instantanément au destinataire dès validation du paiement.
              </div>
            </div>

            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>Montant total à payer</div>
              <div style={{ fontSize: 25, fontWeight: 900, color: "var(--forest-dark)" }}>
                {Math.round(currentTotalEur * 655.957).toLocaleString("fr-FR")} FCFA
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--forest)", marginTop: 2 }}>
                soit {currentTotalEur.toFixed(2)} €
              </div>
            </div>
          </div>

          {/* SÉLECTION DU MOYEN DE PAIEMENT */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: "block", fontSize: 14, fontWeight: 800, color: "var(--forest-dark)", marginBottom: 12 }}>
              4. Choisissez votre moyen de paiement :
            </label>

            {/* Alerte informative UnitechPay */}
            <div style={{
              background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 10,
              padding: "10px 14px", marginBottom: 12, fontSize: 12.5, color: "#166534",
              display: "flex", alignItems: "flex-start", gap: 8
            }}>
              <span style={{ fontSize: 13, flexShrink: 0, fontWeight: 700 }}>Paiement :</span>
              <span>
                <strong>Paiement sécurisé via UnitechPay</strong> — Wave et Orange Money sont traités par UnitechPay, passerelle de paiement certifiée.
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>

              {/* WAVE — UnitechPay */}
              <div
                onClick={() => {
                  if (!waveAvailable) {
                    showToast("Le paiement par Wave est temporairement indisponible sur cette boutique.", "info");
                    return;
                  }
                  setMoyenPaiement("wave");
                }}
                style={{
                  background: !waveAvailable ? "var(--paper)" : moyenPaiement === "wave" ? "#EBF8FF" : "var(--card)",
                  border: `1.5px solid ${!waveAvailable ? "var(--line)" : moyenPaiement === "wave" ? "#0EA5E9" : "var(--line)"}`,
                  opacity: waveAvailable ? 1 : 0.6,
                  borderRadius: 12, padding: "16px 20px", display: "flex", alignItems: "center", gap: 16,
                  cursor: waveAvailable ? "pointer" : "not-allowed", transition: "all 0.15s ease"
                }}
              >
                <div style={{ flexShrink: 0, width: 22, height: 22, borderRadius: "50%", border: `2px solid ${waveAvailable && moyenPaiement === "wave" ? "#0EA5E9" : "var(--muted)"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {waveAvailable && moyenPaiement === "wave" && <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#0EA5E9" }} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: "var(--forest-dark)", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <Smartphone size={16} color={waveAvailable ? "#0EA5E9" : "var(--muted)"} /> Wave
                        <span style={{ fontSize: 10, background: waveAvailable ? "#0EA5E9" : "var(--muted)", color: "#fff", padding: "2px 7px", borderRadius: 8, fontWeight: 700 }}>UNITECHPAY</span>
                        {!waveAvailable && (
                          <span style={{ fontSize: 10, background: "var(--line)", color: "var(--muted)", padding: "2px 8px", borderRadius: 8, fontWeight: 700 }}>
                            Bientôt disponible
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 4 }}>Paiement mobile instantané — Sénégal & Comores</div>
                    </div>
                    <WaveLogo />
                  </div>
                </div>
              </div>

              {/* ORANGE MONEY — UnitechPay */}
              <div
                onClick={() => {
                  if (!orangeAvailable) {
                    showToast("Le paiement par Orange Money est temporairement indisponible sur cette boutique.", "info");
                    return;
                  }
                  setMoyenPaiement("orange");
                }}
                style={{
                  background: !orangeAvailable ? "var(--paper)" : moyenPaiement === "orange" ? "#FFF7ED" : "var(--card)",
                  border: `1.5px solid ${!orangeAvailable ? "var(--line)" : moyenPaiement === "orange" ? "#F97316" : "var(--line)"}`,
                  opacity: orangeAvailable ? 1 : 0.6,
                  borderRadius: 12, padding: "16px 20px", display: "flex", alignItems: "center", gap: 16,
                  cursor: orangeAvailable ? "pointer" : "not-allowed", transition: "all 0.15s ease"
                }}
              >
                <div style={{ flexShrink: 0, width: 22, height: 22, borderRadius: "50%", border: `2px solid ${orangeAvailable && moyenPaiement === "orange" ? "#F97316" : "var(--muted)"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {orangeAvailable && moyenPaiement === "orange" && <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#F97316" }} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: "var(--forest-dark)", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <Smartphone size={16} color={orangeAvailable ? "#F97316" : "var(--muted)"} /> Orange Money
                        <span style={{ fontSize: 10, background: orangeAvailable ? "#F97316" : "var(--muted)", color: "#fff", padding: "2px 7px", borderRadius: 8, fontWeight: 700 }}>UNITECHPAY</span>
                        {!orangeAvailable && (
                          <span style={{ fontSize: 10, background: "var(--line)", color: "var(--muted)", padding: "2px 8px", borderRadius: 8, fontWeight: 700 }}>
                            Bientôt disponible
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 4 }}>Paiement mobile Orange — Sénégal & Afrique de l'Ouest</div>
                    </div>
                    <OrangeMoneyLogo />
                  </div>
                </div>
              </div>

              {/* CARTE BANCAIRE — Stripe */}
              <div
                onClick={() => {
                  if (!carteAvailable) {
                    showToast("Le paiement par Carte bancaire est temporairement indisponible sur cette boutique.", "info");
                    return;
                  }
                  setMoyenPaiement("carte");
                }}
                style={{
                  background: !carteAvailable ? "var(--paper)" : moyenPaiement === "carte" ? "#F0FDF4" : "var(--card)",
                  border: `1.5px solid ${!carteAvailable ? "var(--line)" : moyenPaiement === "carte" ? "var(--forest)" : "var(--line)"}`,
                  opacity: carteAvailable ? 1 : 0.6,
                  borderRadius: 12, padding: "16px 20px", display: "flex", alignItems: "center", gap: 16,
                  cursor: carteAvailable ? "pointer" : "not-allowed", transition: "all 0.15s ease"
                }}
              >
                <div style={{ flexShrink: 0, width: 22, height: 22, borderRadius: "50%", border: `2px solid ${carteAvailable && moyenPaiement === "carte" ? "var(--forest)" : "var(--muted)"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {carteAvailable && moyenPaiement === "carte" && <div style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--forest)" }} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: "var(--forest-dark)", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span>Carte bancaire (€)</span>
                        {!carteAvailable && (
                          <span style={{ fontSize: 10, background: "var(--line)", color: "var(--muted)", padding: "2px 8px", borderRadius: 8, fontWeight: 700 }}>
                            Bientôt disponible
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 4 }}>Paiement sécurisé en ligne (Stripe) — en Euros</div>
                    </div>
                    <OnlinePaymentBadges />
                  </div>
                </div>
              </div>

              {/* WERO */}
              <div
                onClick={() => {
                  if (!weroAvailable) {
                    showToast("Le paiement par Wero est temporairement indisponible sur cette boutique.", "info");
                    return;
                  }
                  setMoyenPaiement("wero");
                }}
                style={{
                  background: !weroAvailable ? "var(--paper)" : moyenPaiement === "wero" ? "#F0FDF4" : "var(--card)",
                  border: `1.5px solid ${!weroAvailable ? "var(--line)" : moyenPaiement === "wero" ? "var(--forest)" : "var(--line)"}`,
                  opacity: weroAvailable ? 1 : 0.6,
                  borderRadius: 12, padding: "16px 20px", display: "flex", alignItems: "center", gap: 16,
                  cursor: weroAvailable ? "pointer" : "not-allowed", transition: "all 0.15s ease"
                }}
              >
                <div style={{ flexShrink: 0, width: 22, height: 22, borderRadius: "50%", border: `2px solid ${weroAvailable && moyenPaiement === "wero" ? "var(--forest)" : "var(--muted)"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {weroAvailable && moyenPaiement === "wero" && <div style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--forest)" }} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: "var(--forest-dark)", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span>Wero</span>
                        {!weroAvailable && (
                          <span style={{ fontSize: 10, background: "var(--line)", color: "var(--muted)", padding: "2px 8px", borderRadius: 8, fontWeight: 700 }}>
                            Bientôt disponible
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 4 }}>Paiement instantané européen</div>
                    </div>
                    <WeroLogo height={28} />
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* SUBMIT BUTTON */}
          <button
            type="submit"
            disabled={loading || !isModuleActive || !!maintenanceInfo}
            className="bs-btn-primary"
            style={{
              width: "100%",
              padding: "18px 24px",
              fontSize: 16,
              borderRadius: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              boxShadow: "0 6px 20px rgba(22, 52, 36, 0.2)",
              opacity: (!isModuleActive || !!maintenanceInfo) ? 0.6 : 1,
              cursor: (!isModuleActive || !!maintenanceInfo) ? "not-allowed" : "pointer",
              background: (!isModuleActive || !!maintenanceInfo) ? "#64748B" :
                          moyenPaiement === "wave" ? "linear-gradient(135deg, #0369A1, #0EA5E9)" :
                          moyenPaiement === "orange" ? "linear-gradient(135deg, #EA580C, #F97316)" :
                          undefined
            }}
          >
            {!isModuleActive ? (
              <span>Service désactivé</span>
            ) : maintenanceInfo ? (
              <span>⚠️ Service en maintenance (Réessayez dans quelques minutes)</span>
            ) : (
              <>
                {moyenPaiement === "wave" ? <Smartphone size={20} /> :
                 moyenPaiement === "orange" ? <Smartphone size={20} /> :
                 <CreditCard size={20} />}
                <span>
                  {moyenPaiement === "wave" ? `Payer par Wave (${Math.round(currentTotalEur * 655.957).toLocaleString("fr-FR")} FCFA)` :
                   moyenPaiement === "orange" ? `Payer par Orange Money (${Math.round(currentTotalEur * 655.957).toLocaleString("fr-FR")} FCFA)` :
                   moyenPaiement === "wero" ? `Acheter par Wero (${currentTotalEur.toFixed(2)} €)` :
                   `Acheter par Carte (${currentTotalEur.toFixed(2)} €)`}
                </span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <div style={{
          marginTop: 20,
          padding: "14px 18px",
          background: "var(--paper)",
          borderRadius: 14,
          border: "1px solid var(--line)",
          display: "flex",
          alignItems: "center",
          gap: 12,
          fontSize: 12.5,
          color: "var(--muted)"
        }}>
          <Lock size={18} color="var(--forest)" style={{ flexShrink: 0 }} />
          <span>
            Paiement sécurisé. Crédit activé immédiatement aux Comores.
          </span>
        </div>
      </div>

      {/* MODAL DE PAIEMENT WERO (RECHARGE) */}
      {showPaymentModal && paymentModalData && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 450, overflow: "hidden", boxShadow: "0 20px 40px rgba(0,0,0,0.2)" }}>
            <div style={{ padding: "24px 24px 16px", textAlign: "center", borderBottom: "1px solid var(--line)" }}>
              <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--paper)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                <WeroLogo height={32} />
              </div>
              <h2 style={{ margin: 0, fontSize: 20, color: "var(--forest-dark)" }}>
                Paiement Wero
              </h2>
            </div>
            
            <div style={{ padding: 24, fontSize: 15, color: "var(--forest-dark)", lineHeight: 1.5 }}>
              <p style={{ margin: "0 0 16px" }}>
                Veuillez envoyer le montant de <strong>{paymentModalData.amountEur.toFixed(2)} €</strong> au numéro suivant :
              </p>
              
              <div style={{ background: "var(--paper)", padding: "16px", borderRadius: 12, textAlign: "center", marginBottom: 20, border: "1px dashed var(--muted)" }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: "var(--forest-dark)", letterSpacing: 1 }}>
                  +337 74 85 43 18
                </div>
              </div>

              <p style={{ margin: 0, fontSize: 14, color: "var(--muted)" }}>
                Une fois le transfert effectué, veuillez nous envoyer la <strong>capture d'écran</strong> de la transaction via WhatsApp pour validation de votre recharge.
              </p>
            </div>

            <div style={{ padding: 24, background: "var(--paper)", display: "flex", flexDirection: "column", gap: 12 }}>
              <button 
                onClick={() => {
                  const waNum = boutique?.whatsappNumber || boutique?.telephone;
                  const cleanWaNum = waNum ? waNum.replace(/[^0-9]/g, "") : "";
                  if (!cleanWaNum) {
                    showToast("Numéro WhatsApp de la boutique non configuré.", "error");
                    setShowPaymentModal(false);
                    return;
                  }
                  
                  const msg = `Bonjour, je viens de payer *${paymentModalData.amountEur.toFixed(2)} €* via *Wero* pour une recharge.\n\n*Détails :*\n- ${paymentModalData.operatorName}\n- Numéro à recharger : *${paymentModalData.phone}*\n- Commande : *COM-B${String(paymentModalData.orderId).padStart(3, '0')}*\n\nJe vous joins la capture d'écran de la transaction pour validation !`;
                  
                  window.open(`https://wa.me/${cleanWaNum}?text=${encodeURIComponent(msg)}`, "_blank");
                  setShowPaymentModal(false);
                  
                  // Clean form to prevent spam
                  setPhone("");
                  navigate("/mes-commandes");
                }}
                style={{ width: "100%", padding: 14, background: "#25D366", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              >
                <MessageCircle size={18} /> Envoyer la capture sur WhatsApp
              </button>
              
              <button 
                onClick={() => {
                  setShowPaymentModal(false);
                  setPhone("");
                  navigate("/mes-commandes");
                }}
                style={{ width: "100%", padding: 14, background: "transparent", color: "var(--muted)", border: "1px solid var(--line)", borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: "pointer" }}
              >
                Plus tard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

