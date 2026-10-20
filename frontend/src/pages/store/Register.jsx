import React, { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  UserPlus, User, Mail, Lock, AlertCircle, ShieldCheck,
  RefreshCw, Send, MessageSquare, CheckCircle2
} from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import PhoneInputSelect from "../../components/PhoneInputSelect.jsx";

const OTP_LENGTH = 6;

export default function Register() {
  const { register, verifyOtp, resendOtp, boutique } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(1); // 1 = info, 2 = otp
  const [form, setForm] = useState({ nom: "", email: "", telephone: "", motDePasse: "" });

  // OTP: individual boxes
  const [otpDigits, setOtpDigits] = useState(Array(OTP_LENGTH).fill(""));
  const otpRefs = useRef([]);

  const [targetContact, setTargetContact] = useState({ email: "", telephone: "" });

  const [erreur, setErreur] = useState("");
  const [succes, setSucces] = useState("");
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState(false);
  const [timeLeft, setTimeLeft] = useState(900); // 15 mins

  useEffect(() => {
    let timer;
    if (step === 2 && timeLeft > 0 && !verified) {
      timer = setInterval(() => setTimeLeft((t) => t - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [step, timeLeft, verified]);

  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }

  // ── OTP digit input handler ──
  function handleOtpInput(index, e) {
    const val = e.target.value.replace(/[^0-9]/g, "").slice(-1);
    const next = [...otpDigits];
    next[index] = val;
    setOtpDigits(next);
    if (val && index < OTP_LENGTH - 1) {
      otpRefs.current[index + 1]?.focus();
    }
  }

  function handleOtpKeyDown(index, e) {
    if (e.key === "Backspace") {
      if (!otpDigits[index] && index > 0) {
        const next = [...otpDigits];
        next[index - 1] = "";
        setOtpDigits(next);
        otpRefs.current[index - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      otpRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < OTP_LENGTH - 1) {
      otpRefs.current[index + 1]?.focus();
    }
  }

  // Handle paste for OTP
  function handleOtpPaste(e) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/[^0-9]/g, "").slice(0, OTP_LENGTH);
    if (pasted.length > 0) {
      const next = Array(OTP_LENGTH).fill("");
      for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
      setOtpDigits(next);
      const focusIdx = Math.min(pasted.length, OTP_LENGTH - 1);
      otpRefs.current[focusIdx]?.focus();
    }
  }

  const otpCode = otpDigits.join("");
  const isOtpComplete = otpCode.length === OTP_LENGTH;

  async function onSubmitRegister(e) {
    e.preventDefault();
    setErreur("");
    setSucces("");
    setLoading(true);
    try {
      const res = await register(form.nom, form.email, form.telephone, form.motDePasse);
      if (res.requireOtp) {
        setTargetContact({ email: res.email || form.email, telephone: res.telephone || form.telephone });
        setStep(2);
        setTimeLeft(900);
        setSucces("Code OTP envoyé ! Saisissez les 6 chiffres reçus.");
      } else {
        navigate("/");
      }
    } catch (err) {
      setErreur(err.response?.data?.message || "Impossible de créer le compte.");
    } finally {
      setLoading(false);
    }
  }

  async function onSubmitOtp(e) {
    e.preventDefault();
    setErreur("");
    setSucces("");
    if (!isOtpComplete) {
      setErreur("Veuillez saisir les 6 chiffres du code OTP.");
      return;
    }
    setLoading(true);
    try {
      await verifyOtp(targetContact.email, targetContact.telephone, otpCode);
      setVerified(true);
      setSucces("Vérification réussie ! Bienvenue sur notre boutique.");
      setTimeout(() => navigate("/"), 1500);
    } catch (err) {
      setErreur(err.response?.data?.message || "Code OTP incorrect ou expiré.");
      setOtpDigits(Array(OTP_LENGTH).fill(""));
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setErreur("");
    setSucces("");
    setLoading(true);
    try {
      const res = await resendOtp(targetContact.email, targetContact.telephone);
      setSucces(res.message || "Un nouveau code OTP a été envoyé.");
      setTimeLeft(900);
      setOtpDigits(Array(OTP_LENGTH).fill(""));
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (err) {
      setErreur(err.response?.data?.message || "Impossible de renvoyer le code.");
    } finally {
      setLoading(false);
    }
  }

  const shopPhone = boutique?.telephone || "2693300000";
  const whatsappMsg = encodeURIComponent(
    `Bonjour ${boutique?.nom || "Boutique"}, je crée mon compte client (${targetContact.telephone}) et je souhaite recevoir assistance / mon code de sécurité OTP.`
  );
  const whatsappUrl = `https://wa.me/${shopPhone.replace(/[^0-9]/g, "")}?text=${whatsappMsg}`;

  return (
    <div className="bs-auth-container">
      <div className="bs-auth-card slide-from-right">
        {step === 1 ? (
          <>
            <div className="bs-auth-header">
              <div className="bs-auth-icon">
                <UserPlus size={26} color="var(--forest)" />
              </div>
              <h2>Créer un compte client</h2>
              <p>Rejoignez-nous pour commander vos produits frais et bio en quelques clics</p>
            </div>

            {erreur && (
              <div className="bs-auth-error">
                <AlertCircle size={18} />
                <span>{erreur}</span>
              </div>
            )}

            <form onSubmit={onSubmitRegister} className="bs-auth-form">
              <div className="bs-input-group">
                <label>Nom complet</label>
                <div className="bs-input-wrapper">
                  <User size={18} className="bs-input-icon" />
                  <input
                    type="text"
                    placeholder="Prénom et Nom"
                    required
                    value={form.nom}
                    onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
                  />
                </div>
              </div>

              <div className="bs-input-group">
                <label>Téléphone Mobile *</label>
                <PhoneInputSelect
                  value={form.telephone}
                  onChange={(val) => setForm((f) => ({ ...f, telephone: val }))}
                  placeholder="330 00 00 ou 6 00 00 00 00"
                />
              </div>

              <div className="bs-input-group">
                <label>Adresse e-mail (Optionnel)</label>
                <div className="bs-input-wrapper">
                  <Mail size={18} className="bs-input-icon" />
                  <input
                    type="email"
                    placeholder="votre.email@exemple.com (optionnel)"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  />
                </div>
              </div>

              <div className="bs-input-group">
                <label>Mot de passe</label>
                <div className="bs-input-wrapper">
                  <Lock size={18} className="bs-input-icon" />
                  <input
                    type="password"
                    placeholder="••••••••"
                    required
                    value={form.motDePasse}
                    onChange={(e) => setForm((f) => ({ ...f, motDePasse: e.target.value }))}
                  />
                </div>
              </div>

              <button className="bs-auth-btn" disabled={loading}>
                {loading ? "Création en cours..." : "Créer mon compte client"}
              </button>
            </form>

            <div className="bs-auth-footer">
              <span>Vous avez déjà un compte ?</span>{" "}
              <Link to="/connexion">Se connecter</Link>
            </div>
          </>
        ) : (
          /* ── STEP 2: OTP VERIFICATION ── */
          <div className="bs-otp-container">
            {/* Shield icon with spinning dashed border */}
            <div className="bs-otp-shield">
              {verified ? (
                <CheckCircle2 size={36} color="#22c55e" />
              ) : (
                <ShieldCheck size={36} color="var(--forest)" />
              )}
            </div>

            <div className="bs-auth-header" style={{ paddingTop: 0, marginBottom: 8 }}>
              <h2 style={{ marginBottom: 6 }}>
                {verified ? "Compte vérifié !" : "Vérification OTP"}
              </h2>
              <p style={{ fontSize: 13.5, lineHeight: 1.6 }}>
                Un code à 6 chiffres a été envoyé à{" "}
                <strong style={{ color: "var(--forest-dark)" }}>
                  {targetContact.email || targetContact.telephone}
                </strong>
              </p>
            </div>

            {succes && (
              <div
                style={{
                  background: verified ? "#f0fdf4" : "#E8F5E9",
                  color: verified ? "#15803d" : "#2E7D32",
                  border: `1px solid ${verified ? "#bbf7d0" : "#C8E6C9"}`,
                  padding: "12px 16px",
                  borderRadius: 12,
                  fontSize: 13,
                  fontWeight: 600,
                  marginBottom: 16,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  animation: "otpSlideUp 0.4s ease",
                }}
              >
                <Send size={15} /> <span>{succes}</span>
              </div>
            )}

            {erreur && (
              <div className="bs-auth-error" style={{ animation: "otpBoxFocus 0.35s ease" }}>
                <AlertCircle size={18} />
                <span>{erreur}</span>
              </div>
            )}

            <form onSubmit={onSubmitOtp} className="bs-auth-form">
              {/* Timer */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 12,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)" }}>
                  Code de sécurité
                </span>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: timeLeft < 120 ? "#D32F2F" : "var(--muted)",
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    transition: "color 0.3s",
                  }}
                >
                  {timeLeft > 0 ? (
                    <>
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: timeLeft < 120 ? "#D32F2F" : "#22c55e",
                          display: "inline-block",
                          animation: "pulse 1s ease infinite",
                        }}
                      />
                      Expire dans : {formatTime(timeLeft)}
                    </>
                  ) : (
                    <span style={{ color: "#D32F2F" }}>Code expiré</span>
                  )}
                </span>
              </div>

              {/* OTP boxes */}
              <div className="bs-otp-boxes" onPaste={handleOtpPaste}>
                {otpDigits.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => (otpRefs.current[i] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    autoFocus={i === 0}
                    disabled={loading || verified}
                    className={
                      "bs-otp-box" +
                      (erreur && !digit ? " error" : "") +
                      (verified ? " success" : "") +
                      (digit && !erreur ? " filled" : "")
                    }
                    onChange={(e) => handleOtpInput(i, e)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    onFocus={(e) => e.target.select()}
                  />
                ))}
              </div>

              <p style={{ textAlign: "center", fontSize: 12, color: "var(--muted)", margin: "4px 0 16px" }}>
                Saisissez ou collez votre code à 6 chiffres
              </p>

              <button
                className="bs-auth-btn"
                disabled={loading || !isOtpComplete || verified}
                style={{
                  background: verified ? "#22c55e" : undefined,
                  transition: "all 0.3s ease",
                }}
              >
                {loading ? (
                  <span style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
                    <span
                      style={{
                        width: 16,
                        height: 16,
                        border: "2px solid rgba(255,255,255,0.4)",
                        borderTopColor: "#fff",
                        borderRadius: "50%",
                        display: "inline-block",
                        animation: "spin 0.7s linear infinite",
                      }}
                    />
                    Vérification...
                  </span>
                ) : verified ? (
                  <span style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
                    <CheckCircle2 size={18} /> Bienvenue !
                  </span>
                ) : (
                  "Valider et Accéder au Compte"
                )}
              </button>
            </form>

            {!verified && (
              <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={loading}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    background: "none",
                    border: "1px solid var(--line)",
                    padding: "10px",
                    borderRadius: 10,
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--ink)",
                    transition: "all 0.2s",
                  }}
                >
                  <RefreshCw size={14} /> Renvoyer le code par e-mail
                </button>

                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    background: "#25D366",
                    color: "#fff",
                    padding: "10px",
                    borderRadius: 10,
                    textDecoration: "none",
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  <MessageSquare size={16} /> Demander de l&apos;aide via WhatsApp
                </a>
              </div>
            )}

            {!verified && (
              <div className="bs-auth-footer" style={{ marginTop: 16 }}>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--muted)",
                    cursor: "pointer",
                    fontSize: 13,
                    textDecoration: "underline",
                  }}
                >
                  Modifier mes informations d&apos;inscription
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
