import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Truck, Store, CreditCard, Banknote, Smartphone, ArrowLeft, Minus, Plus, Trash2, CheckCircle, MapPin, ShoppingBag, ArrowRight, Lock, AlertCircle, ChevronDown, ChevronUp, MessageCircle } from "lucide-react";
import api, { SLUG } from "../../api";
import { useCart } from "../../context/CartContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { processWhatsAppOrder, formatWhatsAppOrderMessage } from "../../utils/whatsappOrder.js";

import { MvolaLogo, WeroLogo, OnlinePaymentBadges, CashLogo } from "../../components/PaymentLogos";

import { formatPrice as fcfa } from "../../utils/currency.js";

export default function Checkout() {
  const { cart, subtotal, updateQuantite, removeFromCart, clearCart, showToast } = useCart();
  const { boutique, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isWhatsAppFocus = location.search.includes("whatsapp=true");

  const [form, setForm] = useState({
    modeLivraison: "domicile",
    adresseLivraison: user?.adresse || "",
    moyenPaiement: "cash"
  });

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentModalData, setPaymentModalData] = useState(null);

  // Gestion de l'affichage dépliable (Accordéon) pour libérer de l'espace à l'écran
  const [openSteps, setOpenSteps] = useState({ 1: true, 2: true, 3: true });

  const toggleStep = (stepNum) => {
    setOpenSteps((prev) => ({ ...prev, [stepNum]: !prev[stepNum] }));
  };

  const [erreur, setErreur] = useState("");
  const [loading, setLoading] = useState(false);

  // Pré-remplir l'adresse de livraison si l'utilisateur est chargé ou mis à jour
  useEffect(() => {
    if (user?.adresse && !form.adresseLivraison) {
      setForm((f) => ({ ...f, adresseLivraison: user.adresse }));
    }
  }, [user]);

  const defaultModes = { especes: true, mvola: true, holam: true, carte: false, wave: true, orange: true };
  const rawModes = boutique?.modesPaiement || {};
  const modesPaiement = {
    especes: rawModes.especes !== undefined ? !!rawModes.especes : defaultModes.especes,
    mvola: rawModes.mvola !== undefined ? !!rawModes.mvola : defaultModes.mvola,
    holam: rawModes.holam !== undefined ? !!rawModes.holam : defaultModes.holam,
    carte: rawModes.carte !== undefined ? !!rawModes.carte : defaultModes.carte,
    wave: rawModes.wave !== undefined ? !!rawModes.wave : defaultModes.wave,
    orange: rawModes.orange !== undefined ? !!rawModes.orange : defaultModes.orange,
  };
  const isWhatsAppEnabled = boutique?.modulesActifs?.commanderWhatsapp !== false;

  const PAYMENT_OPTIONS = [
    { 
      id: "cash", key: "especes", label: "Paiement à la livraison", sub: "Paiement en espèces à la livraison / réception", Icon: Banknote, available: !!modesPaiement.especes,
      renderLogo: () => <CashLogo height={32} />
    },
    { 
      id: "mvola", key: "mvola", label: "MVola", sub: "Paiement mobile sécurisé", Icon: Smartphone, available: !!modesPaiement.mvola,
      renderLogo: () => <MvolaLogo height={32} />
    },
    // Wave — UnitechPay
    {
      id: "wave", key: "wave", label: "Wave", sub: "Paiement mobile instantané (UnitechPay)", Icon: Smartphone, available: !!modesPaiement.wave,
      badgeColor: "#0EA5E9",
      renderLogo: () => (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: "#1E40AF", background: "#E0F2FE", padding: "2px 8px", borderRadius: 6 }}>WAVE</span>
          <span style={{ fontSize: 9, background: "#0284C7", color: "#fff", padding: "2px 6px", borderRadius: 6, fontWeight: 700 }}>UnitechPay</span>
        </div>
      )
    },
    // Orange Money — UnitechPay
    {
      id: "orange", key: "orange", label: "Orange Money", sub: "Paiement mobile Orange (UnitechPay)", Icon: Smartphone, available: !!modesPaiement.orange,
      badgeColor: "#F97316",
      renderLogo: () => (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: "#EA580C", background: "#FFEDD5", padding: "2px 8px", borderRadius: 6 }}>ORANGE</span>
          <span style={{ fontSize: 9, background: "#EA580C", color: "#fff", padding: "2px 6px", borderRadius: 6, fontWeight: 700 }}>UnitechPay</span>
        </div>
      )
    },
    { 
      id: "wero", key: "holam", label: "Wero", sub: "Paiement instantané européen Wero", Icon: Smartphone, available: !!modesPaiement.holam,
      renderLogo: () => <WeroLogo height={28} />
    },
    { 
      id: "carte", key: "carte", label: "Paiement en ligne sécurisé", sub: "Visa / MasterCard / PayPal / Virement", Icon: CreditCard, available: !!modesPaiement.carte,
      renderLogo: () => <OnlinePaymentBadges />
    },
  ];

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Auto-select first available payment option if current choice is disabled
  useEffect(() => {
    const currentOpt = PAYMENT_OPTIONS.find(o => o.id === form.moyenPaiement);
    if (!currentOpt || !currentOpt.available) {
      const firstAvailable = PAYMENT_OPTIONS.find(o => o.available);
      if (firstAvailable) {
        setForm(f => ({ ...f, moyenPaiement: firstAvailable.id }));
      }
    }
  }, [boutique]);

  const tarifLivraisonConfig = boutique?.fraisLivraison || "0";
  const fraisLivraison = form.modeLivraison === "domicile" ? tarifLivraisonConfig : 0;
  const numericFrais = isNaN(Number(fraisLivraison)) ? 0 : Number(fraisLivraison);
  const total = subtotal + numericFrais;
  const totalItems = cart.reduce((s, l) => s + l.quantite, 0);

  function handleSelectPayment(m) {
    if (!m.available) {
      showToast(
        `Le paiement par ${m.label} est bientôt disponible sur cette boutique.`,
        "info"
      );
      return;
    }
    setForm((f) => ({ ...f, moyenPaiement: m.id }));
  }

  async function valider() {
    setErreur("");
    if (form.modeLivraison === "domicile" && !form.adresseLivraison.trim()) {
      const msg = "Veuillez indiquer votre adresse de livraison complète.";
      setErreur(msg);
      showToast(msg, "error", "Adresse manquante");
      return;
    }

    const chosenOption = PAYMENT_OPTIONS.find(p => p.id === form.moyenPaiement);
    if (!chosenOption || !chosenOption.available) {
      const msg = `Le moyen de paiement choisi (${chosenOption?.label || form.moyenPaiement}) est temporairement indisponible. Veuillez en sélectionner un autre.`;
      setErreur(msg);
      showToast(msg, "error");
      return;
    }

    if (form.moyenPaiement === "whatsapp") {
      setLoading(true);
      await processWhatsAppOrder({
        boutique,
        user,
        cart,
        subtotal,
        fraisLivraison,
        total,
        form,
        clearCart,
        showToast,
        navigate
      });
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const items = cart.map((l) => ({ productId: l.product.id, quantite: l.quantite }));
      const res = await api.post(`/store/${SLUG}/orders`, { items, ...form });
      
      if (form.moyenPaiement === "wero" || form.moyenPaiement === "holam" || form.moyenPaiement === "mvola") {
        setPaymentModalData({
          order: res.data,
          moyenPaiement: form.moyenPaiement
        });
        setShowPaymentModal(true);
        setLoading(false);
        return;
      }

      // Paiement via UnitechPay — Wave ou Orange Money → redirection
      if (form.moyenPaiement === "wave" || form.moyenPaiement === "orange") {
        const sessionRes = await api.post(`/store/${SLUG}/create-checkout-session`, {
          orderId: res.data.id,
          moyenPaiement: form.moyenPaiement,
          customerNumber: form.telephone || ""
        });

        // Cas 1 : URL renvoyée directement par le serveur
        if (sessionRes.data?.url) {
          clearCart();
          window.location.href = sessionRes.data.url;
          return;
        }

        // Cas 2 : Initiation sécurisée directe depuis le navigateur si Render est bloqué par Imunify360
        if (sessionRes.data?.clientInitiated) {
          const { endpoint, action, apiKey, payload, orderId } = sessionRes.data;
          try {
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
              const reference = uData.data.reference || `TXN-${orderId}-${Date.now()}`;
              await api.post(`/store/${SLUG}/orders/${orderId}/payment-reference`, { reference }).catch(() => {});
              if (paymentUrl) {
                clearCart();
                window.location.href = paymentUrl;
                return;
              }
            }
            throw new Error(uData?.message || "Échec de génération du lien UnitechPay");
          } catch (uErr) {
            console.error("Client UnitechPay error:", uErr);
            throw new Error("Impossible d'initialiser le paiement sécurisé: " + (uErr.message || "Erreur réseau"));
          }
        }
      }

      // Paiement via Stripe (Carte) → redirection
      if (form.moyenPaiement === "carte") {
        const sessionRes = await api.post(`/store/${SLUG}/create-checkout-session`, { orderId: res.data.id });
        if (sessionRes.data.url) {
          clearCart();
          window.location.href = sessionRes.data.url;
          return; // Stop here, user is redirected
        }
      }

      clearCart();
      showToast("Commande validée avec succès !", "success", "Félicitations");
      navigate(`/confirmation/${res.data.id}`);
    } catch (err) {
      const errorMsg = err.response?.data?.message || "Impossible de valider la commande.";
      setErreur(errorMsg);
      showToast(errorMsg, "error", "Erreur");
    } finally {
      setLoading(false);
    }
  }

  if (cart.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: 16 }}>
        <ShoppingBag size={64} color="var(--line)" strokeWidth={1.5} />
        <h2 style={{ color: "var(--forest-dark)", margin: 0 }}>Votre panier est vide</h2>
        <p style={{ color: "var(--muted)", margin: 0 }}>Ajoutez des articles pour passer commande.</p>
        <button className="bs-btn-primary" onClick={() => navigate("/catalogue")} style={{ marginTop: 8, padding: "12px 28px" }}>
          Découvrir le catalogue
        </button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "calc(100vh - 70px)", background: "var(--paper)", display: "flex", flexDirection: "column" }}>
      {/* TOP BAR */}
      <div style={{ background: "var(--card)", borderBottom: "1px solid var(--line)", padding: "12px 24px", display: "flex", alignItems: "center", gap: 20 }}>
        <button onClick={() => navigate("/catalogue")} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 13, fontWeight: 600 }}>
          <ArrowLeft size={15} /> Continuer les achats
        </button>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--muted)" }}>
          <Lock size={14} /> Paiement sécurisé
        </div>
        <div style={{ background: "var(--forest)", color: "#fff", borderRadius: 20, padding: "4px 12px", fontSize: 13, fontWeight: 700 }}>
          {totalItems} article{totalItems > 1 ? "s" : ""}
        </div>
      </div>

      {/* MAIN */}
      <div className="bs-checkout-layout">

        {/* ── LEFT: FORM AREA ── */}
        <div className="bs-checkout-left">
          <h1 style={{ fontFamily: "var(--font-heading)", fontSize: 30, color: "var(--forest-dark)", margin: "0 0 4px" }}>Finaliser la commande</h1>
          <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 32 }}>Vérifiez votre panier et choisissez vos options de livraison.</p>

          {erreur && (
            <div style={{ background: "#FDF2F0", color: "#B4483A", border: "1px solid #F8D7D2", padding: "14px 18px", borderRadius: 12, fontWeight: 600, marginBottom: 24, display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
              <AlertCircle size={18} /> {erreur}
            </div>
          )}

          {/* ── SECTION: PANIER ── */}
          <div style={{ marginBottom: 24, width: "100%", boxSizing: "border-box" }}>
            <div
              onClick={() => toggleStep(1)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "12px 16px", background: "var(--card)", border: "1px solid var(--line)",
                borderRadius: 14, cursor: "pointer", marginBottom: openSteps[1] ? 12 : 0,
                boxShadow: "0 2px 6px rgba(0,0,0,0.03)"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--forest)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14 }}>1</div>
                <h2 style={{ margin: 0, fontSize: 18, color: "var(--ink)" }}>Vos articles</h2>
                {!openSteps[1] && (
                  <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600, marginLeft: 8 }}>
                    ({totalItems} article{totalItems > 1 ? "s" : ""})
                  </span>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--forest)", fontWeight: 700, fontSize: 13 }}>
                <span>{openSteps[1] ? "Réduire" : "Détails"}</span>
                {openSteps[1] ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </div>
            </div>

            {openSteps[1] && (
              <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 16, overflow: "hidden", width: "100%", boxSizing: "border-box" }}>
                {cart.map((l, idx) => {
                  const prix = l.product.prixPromo || l.product.prix;
                  return (
                    <div key={l.product.id} style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 20px", borderBottom: idx < cart.length - 1 ? "1px solid var(--line)" : "none", flexWrap: "wrap" }}>
                      <img src={l.product.imageUrl || "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=80&q=80"} alt={l.product.nom} style={{ width: 68, height: 68, borderRadius: 12, objectFit: "cover", border: "1px solid var(--line)", flexShrink: 0 }} />
                      <div style={{ flex: "1 1 180px", minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 15, color: "var(--ink)", marginBottom: 2 }}>{l.product.nom}</div>
                        <div style={{ fontSize: 13, color: "var(--muted)" }}>{fcfa(prix)} / {l.product.unite}</div>
                        {l.product.prixPromo && (
                          <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600 }}>
                            Promo · <span style={{ textDecoration: "line-through", color: "var(--muted)" }}>{fcfa(l.product.prix)}</span>
                          </div>
                        )}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, width: "100%", maxWidth: 220, marginLeft: "auto" }}>
                        <div style={{ fontWeight: 800, fontSize: 16, color: "var(--forest-dark)" }}>{fcfa(prix * l.quantite)}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ display: "flex", alignItems: "center", border: "1.5px solid var(--line)", borderRadius: 24, overflow: "hidden", background: "var(--paper)" }}>
                            <button onClick={() => updateQuantite(l.product.id, -1)} style={{ width: 32, height: 32, border: "none", background: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink)" }}><Minus size={13} /></button>
                            <span style={{ width: 28, textAlign: "center", fontWeight: 700, fontSize: 14 }}>{l.quantite}</span>
                            <button onClick={() => updateQuantite(l.product.id, 1)} style={{ width: 32, height: 32, border: "none", background: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink)" }}><Plus size={13} /></button>
                          </div>
                          <button onClick={() => removeFromCart(l.product.id)} style={{ width: 32, height: 32, borderRadius: "50%", border: "none", background: "#FEF0EF", color: "#B4483A", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Trash2 size={13} /></button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── SECTION: LIVRAISON ── */}
          <div style={{ marginBottom: 24 }}>
            <div
              onClick={() => toggleStep(2)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "12px 16px", background: "var(--card)", border: "1px solid var(--line)",
                borderRadius: 14, cursor: "pointer", marginBottom: openSteps[2] ? 12 : 0,
                boxShadow: "0 2px 6px rgba(0,0,0,0.03)"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--forest)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14 }}>2</div>
                <h2 style={{ margin: 0, fontSize: 18, color: "var(--ink)" }}>Mode de livraison</h2>
                {!openSteps[2] && (
                  <span style={{ fontSize: 13, color: "var(--forest)", fontWeight: 700, marginLeft: 8 }}>
                    ({form.modeLivraison === "domicile" ? `Livraison à domicile : ${isNaN(Number(tarifLivraisonConfig)) ? tarifLivraisonConfig : "+" + fcfa(Number(tarifLivraisonConfig))}` : "Retrait gratuit en boutique"})
                  </span>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--forest)", fontWeight: 700, fontSize: 13 }}>
                <span>{openSteps[2] ? "Réduire" : "Changer"}</span>
                {openSteps[2] ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </div>
            </div>

            {openSteps[2] && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[
                  { id: "domicile", label: "Livraison à domicile", sub: "Livré directement chez vous", price: isNaN(Number(tarifLivraisonConfig)) ? tarifLivraisonConfig : `+${fcfa(Number(tarifLivraisonConfig))}`, Icon: Truck, color: "#2D8653" },
                  { id: "retrait", label: "Retrait en boutique", sub: "Récupérez votre commande en magasin", price: "Gratuit", Icon: Store, color: "#6C47FF" },
                ].map((opt) => (
                  <div key={opt.id} onClick={() => setForm(f => ({ ...f, modeLivraison: opt.id }))} style={{
                    display: "flex", alignItems: "center", gap: 16, padding: "18px 20px", borderRadius: 14,
                    border: `2px solid ${form.modeLivraison === opt.id ? "var(--forest)" : "var(--line)"}`,
                    background: form.modeLivraison === opt.id ? "var(--forest-light)" : "var(--card)",
                    cursor: "pointer", transition: "all 0.2s"
                  }}>
                    <div style={{ width: 48, height: 48, borderRadius: 12, background: form.modeLivraison === opt.id ? "var(--forest)" : "var(--paper)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.2s" }}>
                      <opt.Icon size={22} color={form.modeLivraison === opt.id ? "#fff" : opt.color} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: form.modeLivraison === opt.id ? "var(--forest-dark)" : "var(--ink)" }}>{opt.label}</div>
                      <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>{opt.sub}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <span style={{ fontWeight: 700, fontSize: 15, color: opt.id === "retrait" ? "#2D8653" : "var(--ink)" }}>{opt.price}</span>
                      <div style={{
                        width: 22, height: 22, borderRadius: "50%",
                        border: `2.5px solid ${form.modeLivraison === opt.id ? "var(--forest)" : "var(--line)"}`,
                        background: form.modeLivraison === opt.id ? "var(--forest)" : "var(--card)",
                        display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s"
                      }}>
                        {form.modeLivraison === opt.id && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff" }} />}
                      </div>
                    </div>
                  </div>
                ))}
                {form.modeLivraison === "domicile" && (
                  <div style={{ position: "relative", marginTop: 4 }}>
                    <MapPin size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--sage)", pointerEvents: "none" }} />
                    <input className="bs-input" style={{ paddingLeft: 42, borderRadius: 12, fontSize: 14 }}
                      placeholder="Adresse complète (quartier, ville, rue...)"
                      value={form.adresseLivraison}
                      onChange={(e) => setForm(f => ({ ...f, adresseLivraison: e.target.value }))}
                    />
                  </div>
                )}
                {form.modeLivraison === "retrait" && (
                  <div style={{
                    marginTop: 6,
                    padding: "16px 18px",
                    borderRadius: 14,
                    background: "var(--card)",
                    border: "1.5px solid var(--forest)",
                    color: "var(--ink)"
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 14, marginBottom: 6, color: "var(--forest-dark)" }}>
                      <MapPin size={18} color="var(--forest)" />
                      <span>Adresse & Emplacement du point de retrait :</span>
                    </div>
                    <div style={{ fontSize: 14, lineHeight: "1.5", color: "var(--forest)", whiteSpace: "pre-wrap", fontWeight: 700 }}>
                      {boutique?.adresseRetrait || boutique?.adresse || "Adresse du point de retrait en boutique non renseignée par l'administrateur."}
                    </div>
                    {boutique?.horairesOuverture && (
                      <div style={{ fontSize: 13, marginTop: 8, color: "var(--sage)", fontWeight: 600 }}>
                        Horaires : {boutique.horairesOuverture}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── SECTION: PAIEMENT ── */}
          <div style={{ marginBottom: 24 }}>
            <div
              onClick={() => toggleStep(3)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "12px 16px", background: "var(--card)", border: "1px solid var(--line)",
                borderRadius: 14, cursor: "pointer", marginBottom: openSteps[3] ? 12 : 0,
                boxShadow: "0 2px 6px rgba(0,0,0,0.03)"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--forest)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14 }}>3</div>
                <h2 style={{ margin: 0, fontSize: 18, color: "var(--ink)" }}>Moyen de paiement</h2>
                {!openSteps[3] && (
                  <span style={{ fontSize: 13, color: "var(--forest)", fontWeight: 700, marginLeft: 8 }}>
                    ({PAYMENT_OPTIONS.find(p => p.id === form.moyenPaiement)?.label || form.moyenPaiement})
                  </span>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--forest)", fontWeight: 700, fontSize: 13 }}>
                <span>{openSteps[3] ? "Réduire" : "Changer"}</span>
                {openSteps[3] ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </div>
            </div>

            {openSteps[3] && (
              <div className="bs-payment-grid">
              {PAYMENT_OPTIONS.map((m) => {
                const isSelected = form.moyenPaiement === m.id && m.available;
                return (
                  <div
                    key={m.id}
                    onClick={() => handleSelectPayment(m)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "16px 18px",
                      borderRadius: 14,
                      border: `2px solid ${isSelected ? "var(--forest)" : "var(--line)"}`,
                      background: isSelected ? "var(--forest-light)" : m.available ? "var(--card)" : "#F8FAFC",
                      cursor: m.available ? "pointer" : "not-allowed",
                      opacity: m.available ? 1 : 0.55,
                      transition: "all 0.2s",
                      position: "relative"
                    }}
                  >
                    <div style={{
                      height: 48,
                      padding: "0 10px",
                      borderRadius: 10,
                      background: "#FFFFFF",
                      border: "1px solid var(--line)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0
                    }}>
                      {m.renderLogo ? m.renderLogo() : <m.Icon size={20} color={m.available ? "var(--forest)" : "var(--muted)"} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: isSelected ? "var(--forest-dark)" : m.available ? "var(--ink)" : "var(--muted)" }}>
                          {m.label}
                        </span>
                        {!m.available && (
                          <span style={{ fontSize: 10, fontWeight: 700, background: "#F1F5F9", color: "#64748B", padding: "2px 8px", borderRadius: 8, border: "1px solid #CBD5E1" }}>
                            Bientôt disponible
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {m.available ? m.sub : "Ce mode de paiement est temporairement désactivé."}
                      </div>
                    </div>
                    <div style={{
                      marginLeft: "auto",
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      border: `2px solid ${isSelected ? "var(--forest)" : "var(--line)"}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0
                    }}>
                      {isSelected && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--forest)" }} />}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        </div>

        {/* ── RIGHT: SUMMARY PANEL ── */}
        <div style={{ background: "var(--card)", borderLeft: "none", display: "flex", flexDirection: "column", height: "fit-content" }}>
          <div style={{ padding: "32px 28px" }}>
            <h2 style={{ fontFamily: "var(--font-heading)", fontSize: 22, color: "var(--forest-dark)", margin: "0 0 24px" }}>Récapitulatif</h2>

            {/* Items */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 24 }}>
              {cart.map(l => {
                const prix = l.product.prixPromo || l.product.prix;
                return (
                  <div key={l.product.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ position: "relative" }}>
                      <img src={l.product.imageUrl || "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=60&q=80"} alt="" style={{ width: 52, height: 52, borderRadius: 10, objectFit: "cover", border: "1px solid var(--line)" }} />
                      <span style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, background: "var(--forest)", color: "#fff", borderRadius: "50%", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{l.quantite}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.product.nom}</div>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>{fcfa(prix)} / {l.product.unite}</div>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "var(--ink)", flexShrink: 0 }}>{fcfa(prix * l.quantite)}</div>
                  </div>
                );
              })}
            </div>

            <div style={{ height: 1, background: "var(--line)", marginBottom: 16 }} />

            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 14 }}>
              <span style={{ color: "var(--muted)" }}>Sous-total</span>
              <span style={{ fontWeight: 600 }}>{fcfa(subtotal)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20, fontSize: 14 }}>
              <span style={{ color: "var(--muted)" }}>Livraison</span>
              <span style={{ fontWeight: 600, color: (fraisLivraison === 0 || fraisLivraison === "0") ? "#2D8653" : "var(--ink)" }}>
                {fraisLivraison === 0 || fraisLivraison === "0" ? "Gratuite" : (isNaN(Number(fraisLivraison)) ? fraisLivraison : fcfa(Number(fraisLivraison)))}
              </span>
            </div>

            <div style={{ background: "var(--forest-dark)", borderRadius: 14, padding: "18px 20px", marginBottom: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "#DDE8DF", fontSize: 14, fontWeight: 600 }}>Total à payer</span>
                <span style={{ color: "#fff", fontSize: 24, fontWeight: 900 }}>{fcfa(total)}</span>
              </div>
            </div>

            <button onClick={valider} disabled={loading} style={{
              width: "100%", padding: "16px 20px", background: loading ? "var(--sage)" : "var(--forest)",
              color: "#fff", border: "none", borderRadius: 14, fontWeight: 700, fontSize: 16,
              cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, transition: "all 0.2s"
            }}>
              {loading ? (
                <><span style={{ width: 18, height: 18, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} /> Validation...</>
              ) : (
                <><CheckCircle size={20} /> Valider la commande <ArrowRight size={18} /></>
              )}
            </button>

            {isWhatsAppEnabled && (
              <button
                type="button"
                disabled={loading}
                onClick={async () => {
                  if (form.modeLivraison === "domicile" && !form.adresseLivraison.trim()) {
                    const msg = "Veuillez indiquer votre adresse de livraison complète.";
                    setErreur(msg);
                    showToast(msg, "error", "Adresse manquante");
                    return;
                  }
                  setLoading(true);
                  await processWhatsAppOrder({
                    boutique,
                    user,
                    cart,
                    subtotal,
                    fraisLivraison,
                    total,
                    form,
                    clearCart,
                    showToast,
                    navigate
                  });
                  setLoading(false);
                }}
                style={{
                  width: "100%", marginTop: 12, padding: "15px 20px", fontSize: 15, fontWeight: 800,
                  background: "#25D366", color: "#ffffff", border: "none",
                  borderRadius: 14, cursor: loading ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  boxShadow: isWhatsAppFocus 
                    ? "0 0 0 4px #25D366, 0 6px 20px rgba(37, 211, 102, 0.5)" 
                    : "0 4px 14px rgba(37, 211, 102, 0.35)",
                  transform: isWhatsAppFocus ? "scale(1.02)" : "none",
                  transition: "all 0.2s ease"
                }}
              >
                <MessageCircle size={20} fill="#ffffff" color="#25D366" />
                Envoyer la commande via WhatsApp
              </button>
            )}

            <div style={{ textAlign: "center", marginTop: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 12, color: "var(--muted)" }}>
              <Lock size={12} /> Paiement 100% sécurisé · Conditions générales de vente
            </div>
          </div>
        </div>
      </div>

      {/* MODAL DE PAIEMENT WERO / MVOLA */}
      {showPaymentModal && paymentModalData && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 450, overflow: "hidden", boxShadow: "0 20px 40px rgba(0,0,0,0.2)" }}>
            <div style={{ padding: "24px 24px 16px", textAlign: "center", borderBottom: "1px solid var(--line)" }}>
              <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--paper)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                {(paymentModalData.moyenPaiement === "wero" || paymentModalData.moyenPaiement === "holam") ? (
                  <WeroLogo height={32} />
                ) : (
                  <MvolaLogo height={32} />
                )}
              </div>
              <h2 style={{ margin: 0, fontSize: 20, color: "var(--forest-dark)" }}>
                Paiement {paymentModalData.moyenPaiement === "mvola" ? "MVola" : "Wero"}
              </h2>
            </div>
            
            <div style={{ padding: 24, fontSize: 15, color: "var(--forest-dark)", lineHeight: 1.5 }}>
              <p style={{ margin: "0 0 16px" }}>
                Veuillez envoyer le montant de <strong>{fcfa(total)}</strong> au numéro suivant :
              </p>
              
              <div style={{ background: "var(--paper)", padding: "16px", borderRadius: 12, textAlign: "center", marginBottom: 20, border: "1px dashed var(--muted)" }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: "var(--forest-dark)", letterSpacing: 1 }}>
                  {(paymentModalData.moyenPaiement === "wero" || paymentModalData.moyenPaiement === "holam") ? "+337 74 85 43 18" : "+269 442 04 39"}
                </div>
              </div>

              <p style={{ margin: 0, fontSize: 14, color: "var(--muted)" }}>
                Une fois le transfert effectué, veuillez nous envoyer la <strong>capture d'écran</strong> de la transaction via WhatsApp pour validation.
              </p>
            </div>

            <div style={{ padding: 24, background: "var(--paper)", display: "flex", flexDirection: "column", gap: 12 }}>
              <button 
                onClick={() => {
                  const waNum = boutique?.whatsappNumber || boutique?.telephone;
                  const cleanWaNum = waNum ? waNum.replace(/[^0-9]/g, "") : "";
                  if (!cleanWaNum) {
                    showToast("Numéro WhatsApp de la boutique non configuré.", "error");
                    clearCart();
                    navigate(`/confirmation/${paymentModalData.order.id}`);
                    return;
                  }
                  
                  const orderNumber = "COM-B" + String(paymentModalData.order.id).padStart(3, "0");
                  const message = formatWhatsAppOrderMessage({
                    boutique, user, cart, subtotal, fraisLivraison, total, orderNumber, form: { ...form, moyenPaiement: paymentModalData.moyenPaiement }
                  });
                  
                  window.open(`https://wa.me/${cleanWaNum}?text=${encodeURIComponent(message)}`, "_blank");
                  clearCart();
                  navigate(`/confirmation/${paymentModalData.order.id}`);
                }}
                style={{ width: "100%", padding: 14, background: "#25D366", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              >
                <MessageCircle size={18} /> Envoyer la capture sur WhatsApp
              </button>
              
              <button 
                onClick={() => {
                  clearCart();
                  navigate(`/confirmation/${paymentModalData.order.id}`);
                }}
                style={{ width: "100%", padding: 14, background: "transparent", color: "var(--muted)", border: "1px solid var(--line)", borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: "pointer" }}
              >
                Je le ferai plus tard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
