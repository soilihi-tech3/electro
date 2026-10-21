import React, { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Plus, Trash2, Image, Layers, LayoutGrid, Store, Phone, MapPin, Mail, Info, Save, CreditCard, ToggleLeft, ToggleRight, Banknote, Smartphone, Globe, Key, CheckCircle2, HelpCircle, Database, AlertTriangle } from "lucide-react";
import api from "../../api";
import ImageUploader from "../../components/ImageUploader.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { useCart } from "../../context/CartContext.jsx";

export default function AdminSettings({ defaultTab = "general" }) {
  const { refreshBoutique } = useAuth();
  const { showToast } = useCart();
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [boutique, setBoutique] = useState(null);
  const [categories, setCategories] = useState([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  useEffect(() => {
    api.get("/admin/boutique").then((res) => {
      const data = res.data;
      if (typeof data.bannerSlides === "string") {
        try { data.bannerSlides = JSON.parse(data.bannerSlides); } catch (e) { data.bannerSlides = []; }
      }
      if (!Array.isArray(data.bannerSlides)) data.bannerSlides = [];

      if (typeof data.sideBanners === "string") {
        try { data.sideBanners = JSON.parse(data.sideBanners); } catch (e) { data.sideBanners = []; }
      }
      if (!Array.isArray(data.sideBanners)) data.sideBanners = [];

      if (typeof data.modesPaiement === "string") {
        try { data.modesPaiement = JSON.parse(data.modesPaiement); } catch (e) { data.modesPaiement = null; }
      }
      
      // Assainissement strict pour éviter les objets corrompus géants (due au spread de string)
      const sanitizedModes = { especes: true, mvola: true, holam: true, carte: false, wave: true, orange: true };
      if (data.modesPaiement && typeof data.modesPaiement === "object" && !data.modesPaiement["0"]) {
        if (typeof data.modesPaiement.especes === "boolean") sanitizedModes.especes = data.modesPaiement.especes;
        if (typeof data.modesPaiement.mvola === "boolean") sanitizedModes.mvola = data.modesPaiement.mvola;
        if (typeof data.modesPaiement.holam === "boolean") sanitizedModes.holam = data.modesPaiement.holam;
        if (typeof data.modesPaiement.carte === "boolean") sanitizedModes.carte = data.modesPaiement.carte;
        if (typeof data.modesPaiement.wave === "boolean") sanitizedModes.wave = data.modesPaiement.wave;
        if (typeof data.modesPaiement.orange === "boolean") sanitizedModes.orange = data.modesPaiement.orange;
      }
      data.modesPaiement = sanitizedModes;

      if (typeof data.modulesActifs === "string") {
        try { data.modulesActifs = JSON.parse(data.modulesActifs); } catch (e) { data.modulesActifs = null; }
      }
      if (!data.modulesActifs || typeof data.modulesActifs !== "object" || data.modulesActifs["0"]) {
        data.modulesActifs = {
          vente: true, ventesHistorique: true, achats: true, fournisseurs: true, 
          unites: true, homeBanners: true, sideBanners: true, commandes: true
        };
      }

      setBoutique(data);
    });

    api.get("/admin/categories").then((res) => setCategories(res.data || [])).catch(() => { });
  }, []);

  async function save() {
    try {
      await api.put("/admin/boutique", boutique);
      refreshBoutique();
      setSaved(true);
      showToast("Configurations enregistrées avec succès !", "success");
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.message || err.message;
      toast.error("Erreur lors de l'enregistrement: " + msg);
      showToast("Erreur: " + msg, "error");
    }
  }

  if (!boutique) return <div style={{ padding: 40 }}>Chargement des paramètres...</div>;
  const set = (k, v) => setBoutique((b) => ({ ...b, [k]: v }));
  const slidesList = Array.isArray(boutique.bannerSlides) ? boutique.bannerSlides : [];
  const sideList = Array.isArray(boutique.sideBanners) ? boutique.sideBanners : [];
  const modesPaiement = boutique.modesPaiement || { especes: true, mvola: true, holam: true, carte: false, orange: true, wave: true };

  function togglePaymentMode(key) {
    set("modesPaiement", {
      ...modesPaiement,
      [key]: !modesPaiement[key]
    });
  }

  // Home Slides Actions
  function addSlide() {
    const newSlide = {
      id: Date.now(),
      title: "Nouvelle diapositive",
      subtitle: "Offres fraîches du jour",
      imageUrl: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1600&q=80",
      buttonText: "Découvrir le marché",
      categoryId: categories[0]?.id || ""
    };
    set("bannerSlides", [...slidesList, newSlide]);
  }

  function updateSlide(idx, field, value) {
    const updated = [...slidesList];
    updated[idx] = { ...updated[idx], [field]: value };
    set("bannerSlides", updated);
  }

  function removeSlide(idx) {
    set("bannerSlides", slidesList.filter((_, i) => i !== idx));
  }

  // Side Banners Actions
  function addSideBanner() {
    const newSide = {
      id: Date.now(),
      title: "Promotions Spéciales",
      subtitle: "Jusqu'à -30% cette semaine",
      imageUrl: "https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=800&q=80",
      buttonText: "Acheter maintenant",
      categoryId: categories[0]?.id || ""
    };
    set("sideBanners", [...sideList, newSide]);
  }

  function updateSideBanner(idx, field, value) {
    const updated = [...sideList];
    updated[idx] = { ...updated[idx], [field]: value };
    set("sideBanners", updated);
  }

  function removeSideBanner(idx) {
    set("sideBanners", sideList.filter((_, i) => i !== idx));
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, margin: 0, color: "var(--forest-dark)" }}>Paramètres & Configuration</h1>
          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 13.5 }}>
            Gérez l'identité de l'application, votre domaine personnalisé, les bannières et les moyens de paiement.
          </p>
        </div>
        <button className="bs-btn-primary" onClick={save} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Save size={16} /> Enregistrer les modifications
        </button>
      </div>

      {saved && (
        <div style={{ background: "#EBF7F0", color: "#1F4D3A", padding: "12px 16px", borderRadius: 10, fontWeight: 700, marginBottom: 20 }}>
          ✓ Toutes les modifications ont été enregistrées avec succès !
        </div>
      )}

      {/* TAB NAVIGATION BAR */}
      <div style={{ display: "flex", gap: 10, borderBottom: "2px solid var(--line)", marginBottom: 24, flexWrap: "wrap" }}>
        <button
          onClick={() => setActiveTab("general")}
          style={{
            padding: "10px 18px", border: "none", background: "none", cursor: "pointer",
            fontWeight: 700, fontSize: 13.5,
            color: activeTab === "general" ? "var(--forest)" : "var(--muted)",
            borderBottom: activeTab === "general" ? "3px solid var(--forest)" : "3px solid transparent",
            marginBottom: -2, display: "flex", alignItems: "center", gap: 8
          }}
        >
          <Store size={17} /> Identité & Contacts
        </button>

        <button
          onClick={() => setActiveTab("domain")}
          style={{
            padding: "10px 18px", border: "none", background: "none", cursor: "pointer",
            fontWeight: 700, fontSize: 13.5,
            color: activeTab === "domain" ? "var(--forest)" : "var(--muted)",
            borderBottom: activeTab === "domain" ? "3px solid var(--forest)" : "3px solid transparent",
            marginBottom: -2, display: "flex", alignItems: "center", gap: 8
          }}
        >
          <Globe size={17} /> Domaine Personnalisé
        </button>

        <button
          onClick={() => setActiveTab("home_banners")}
          style={{
            padding: "10px 18px", border: "none", background: "none", cursor: "pointer",
            fontWeight: 700, fontSize: 13.5,
            color: activeTab === "home_banners" ? "var(--forest)" : "var(--muted)",
            borderBottom: activeTab === "home_banners" ? "3px solid var(--forest)" : "3px solid transparent",
            marginBottom: -2, display: "flex", alignItems: "center", gap: 8
          }}
        >
          <Image size={17} /> Bannières Slider
        </button>

        <button
          onClick={() => setActiveTab("side_banners")}
          style={{
            padding: "10px 18px", border: "none", background: "none", cursor: "pointer",
            fontWeight: 700, fontSize: 13.5,
            color: activeTab === "side_banners" ? "var(--forest)" : "var(--muted)",
            borderBottom: activeTab === "side_banners" ? "3px solid var(--forest)" : "3px solid transparent",
            marginBottom: -2, display: "flex", alignItems: "center", gap: 8
          }}
        >
          <LayoutGrid size={17} /> Bannières Latérales
        </button>

        <button
          onClick={() => setActiveTab("payment_modes")}
          style={{
            padding: "10px 18px", border: "none", background: "none", cursor: "pointer",
            fontWeight: 700, fontSize: 13.5,
            color: activeTab === "payment_modes" ? "var(--forest)" : "var(--muted)",
            borderBottom: activeTab === "payment_modes" ? "3px solid var(--forest)" : "3px solid transparent",
            marginBottom: -2, display: "flex", alignItems: "center", gap: 8
          }}
        >
          <CreditCard size={17} /> Paiement, Stripe & UnitechPay
        </button>

        <button
          onClick={() => setActiveTab("cleanup")}
          style={{
            padding: "10px 18px", border: "none", background: "none", cursor: "pointer",
            fontWeight: 700, fontSize: 13.5,
            color: activeTab === "cleanup" ? "#E11D48" : "var(--muted)",
            borderBottom: activeTab === "cleanup" ? "3px solid #E11D48" : "3px solid transparent",
            marginBottom: -2, display: "flex", alignItems: "center", gap: 8
          }}
        >
          <Database size={17} /> Nettoyage DB
        </button>
      </div>

      {/* TAB 1: IDENTITÉ & CONTACTS */}
      {activeTab === "general" && (
        <div className="bs-panel">
          <h3 style={{ marginTop: 0, fontSize: 18, color: "var(--forest-dark)" }}>Identité & Informations de la Boutique</h3>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
            <div className="bs-field">
              <label>Nom de la boutique</label>
              <input className="bs-input" value={boutique.nom || ""} onChange={(e) => set("nom", e.target.value)} />
            </div>

            <div className="bs-field">
              <label>Devise de la boutique</label>
              <select 
                className="bs-input" 
                value={boutique.devise || "KMF"} 
                onChange={(e) => set("devise", e.target.value)}
                style={{ fontWeight: 700, color: "var(--forest-dark)" }}
              >
                <option value="KMF">Franc Comorien (KMF)</option>
                <option value="EUR">Euro (€)</option>
                <option value="FCFA">Franc CFA (FCFA)</option>
                <option value="USD">Dollar US ($)</option>
              </select>
            </div>

            <div className="bs-field">
              <label>Email de Contact</label>
              <input className="bs-input" type="email" value={boutique.emailContact || ""} onChange={(e) => set("emailContact", e.target.value)} placeholder="contact@maboutique.com" />
            </div>

            <div className="bs-field">
              <label>Frais de livraison à domicile ({boutique.devise || "KMF"})</label>
              <input className="bs-input" type="text" value={boutique.fraisLivraison ?? "1500"} onChange={(e) => set("fraisLivraison", e.target.value)} placeholder="ex: 1500 ou 5" />
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <ImageUploader
              label="Logo de la boutique (Upload direct ou URL)"
              value={boutique.logoUrl || ""}
              onChange={(url) => set("logoUrl", url)}
            />
          </div>

          <h3 style={{ marginTop: 28, fontSize: 16, color: "var(--forest-dark)" }}>Téléphones & Adresses</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div className="bs-field">
              <label>Téléphone N° 1</label>
              <input className="bs-input" value={boutique.telephone || ""} onChange={(e) => set("telephone", e.target.value)} placeholder="+33 6 00 00 00 00" />
            </div>
            <div className="bs-field">
              <label>Téléphone N° 2 (Facultatif)</label>
              <input className="bs-input" value={boutique.telephone2 || ""} onChange={(e) => set("telephone2", e.target.value)} placeholder="+33 1 00 00 00 00" />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 12 }}>
            <div className="bs-field">
              <label>Adresse Principale N° 1</label>
              <input className="bs-input" value={boutique.adresse || ""} onChange={(e) => set("adresse", e.target.value)} placeholder="123 Rue de la République, Paris" />
            </div>
            <div className="bs-field">
              <label>Adresse Secondaire N° 2 (Facultatif)</label>
              <input className="bs-input" value={boutique.adresse2 || ""} onChange={(e) => set("adresse2", e.target.value)} placeholder="Entrepôt B, Zone Industrielle" />
            </div>
          </div>

          <div className="bs-field" style={{ marginTop: 16 }}>
            <label style={{ fontWeight: 700, color: "var(--forest-dark)" }}>Adresse & Instructions détaillées pour le Point de Retrait en Boutique</label>
            <p style={{ margin: "2px 0 8px", fontSize: 12.5, color: "var(--muted)" }}>
              Décrivez exactement où se trouve la boutique (ex: repères, étage, numéro de porte) pour les clients qui choisissent "Retrait en boutique".
            </p>
            <textarea
              className="bs-input"
              rows={3}
              value={boutique.adresseRetrait || ""}
              onChange={(e) => set("adresseRetrait", e.target.value)}
              placeholder="Ex: 12 Rue des Marchands, Moroni — Entrez par le portail vert au rez-de-chaussée à côté de la banque."
              style={{ padding: 12 }}
            />
          </div>

          <h3 style={{ marginTop: 28, fontSize: 16, color: "var(--forest-dark)" }}>Horaires d'Ouverture & WhatsApp Contact</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div className="bs-field">
              <label>Horaires d'ouverture (Affiché dans le footer)</label>
              <input
                className="bs-input"
                value={boutique.horairesOuverture || "Tous les jours de 08h30 à 23h00"}
                onChange={(e) => set("horairesOuverture", e.target.value)}
                placeholder="Ex: Tous les jours de 08h30 à 23h00"
              />
            </div>
            <div className="bs-field">
              <label>Numéro WhatsApp Contact Direct </label>
              <input
                className="bs-input"
                value={boutique.whatsappNumber || ""}
                onChange={(e) => set("whatsappNumber", e.target.value)}
                placeholder="Ex: 2693300000 (sans + ni espaces)"
              />
            </div>
          </div>

          <h3 style={{ marginTop: 28, fontSize: 16, color: "var(--forest-dark)" }}>Réseaux Sociaux (Liens Footer)</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
            <div className="bs-field">
              <label>Lien Facebook</label>
              <input
                className="bs-input"
                value={boutique.facebookUrl || ""}
                onChange={(e) => set("facebookUrl", e.target.value)}
                placeholder="https://facebook.com/votrepage"
              />
            </div>
            <div className="bs-field">
              <label>Lien Instagram</label>
              <input
                className="bs-input"
                value={boutique.instagramUrl || ""}
                onChange={(e) => set("instagramUrl", e.target.value)}
                placeholder="https://instagram.com/votrecompte"
              />
            </div>
            <div className="bs-field">
              <label>Lien TikTok</label>
              <input
                className="bs-input"
                value={boutique.tiktokUrl || ""}
                onChange={(e) => set("tiktokUrl", e.target.value)}
                placeholder="https://tiktok.com/@votrecompte"
              />
            </div>
          </div>

          <h3 style={{ marginTop: 28, fontSize: 16, color: "var(--forest-dark)" }}>Section « À propos de nous »</h3>
          <div className="bs-field">
            <label>Description & Présentation de l'entreprise</label>
            <textarea
              className="bs-input"
              rows={4}
              value={boutique.aProposText || ""}
              onChange={(e) => set("aProposText", e.target.value)}
              placeholder="Présentez votre entreprise, vos valeurs, vos produits frais et bio..."
              style={{ padding: 12 }}
            />
          </div>
          <div style={{ marginTop: 16 }}>
            <ImageUploader
              label="Photo / Flyer de présentation (À propos de nous)"
              value={boutique.aProposImageUrl || ""}
              onChange={(url) => set("aProposImageUrl", url)}
            />
          </div>
        </div>
      )}

      {/* TAB DOMAINE PERSONNALISÉ */}
      {activeTab === "domain" && (
        <div className="bs-panel">
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ margin: "0 0 6px", fontSize: 18, color: "var(--ink)", display: "flex", alignItems: "center", gap: 8 }}>
              <Globe size={20} color="var(--forest)" /> Nom de Domaine Personnalisé
            </h3>
            <div style={{ fontSize: 13.5, color: "var(--muted)" }}>
              Liez votre propre nom de domaine (ex: <code>abdou.com</code> ou <code>boutique.abdou.com</code>) à votre storefront.
            </div>
          </div>

          <div style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 14, padding: 20, marginBottom: 24 }}>
            <div className="bs-field">
              <label style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)" }}>
                Domaine personnalisé de votre boutique
              </label>
              <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
                <input
                  className="bs-input"
                  style={{ flex: 1, fontFamily: "monospace", fontSize: 15 }}
                  value={boutique.customDomain || ""}
                  onChange={(e) => set("customDomain", e.target.value)}
                  placeholder="ex: abdou.com ou store.abdou.com"
                />
              </div>
              <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "var(--muted)" }}>
                Saisissez votre nom de domaine sans <code>https://</code> ni <code>www.</code>
              </p>
            </div>
          </div>

          <div style={{ background: "var(--paper)", border: "1.5px solid var(--forest)", borderRadius: 14, padding: 20 }}>
            <h4 style={{ margin: "0 0 12px", fontSize: 15, color: "var(--ink)", display: "flex", alignItems: "center", gap: 8 }}>
              <HelpCircle size={18} color="var(--forest)" /> Instructions de configuration DNS chez votre Registrar (Namecheap, GoDaddy, OVH, etc.)
            </h4>
            
            <p style={{ fontSize: 13.5, color: "var(--muted)", lineHeight: 1.5, margin: "0 0 14px" }}>
              Pour que votre domaine personnalisé pointe vers votre boutique Render, ajoutez les enregistrements DNS suivants dans l'espace client de votre registrar :
            </p>

            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, background: "var(--card)", borderRadius: 8, overflow: "hidden", border: "1px solid var(--line)" }}>
              <thead>
                <tr style={{ background: "var(--forest-light)", textAlign: "left", color: "var(--ink)" }}>
                  <th style={{ padding: "10px 14px" }}>Type</th>
                  <th style={{ padding: "10px 14px" }}>Nom / Hôte</th>
                  <th style={{ padding: "10px 14px" }}>Valeur / Cible</th>
                  <th style={{ padding: "10px 14px" }}>Utilité</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: "1px solid var(--line)" }}>
                  <td style={{ padding: "10px 14px", fontWeight: 700, color: "var(--ink)" }}>CNAME</td>
                  <td style={{ padding: "10px 14px", fontFamily: "monospace", color: "var(--ink)" }}>@ ou store</td>
                  <td style={{ padding: "10px 14px", fontFamily: "monospace", color: "var(--forest)", fontWeight: 700 }}>votre-app.onrender.com</td>
                  <td style={{ padding: "10px 14px", color: "var(--muted)" }}>Redirige le trafic vers Render</td>
                </tr>
                <tr>
                  <td style={{ padding: "10px 14px", fontWeight: 700, color: "var(--ink)" }}>CNAME</td>
                  <td style={{ padding: "10px 14px", fontFamily: "monospace", color: "var(--ink)" }}>www</td>
                  <td style={{ padding: "10px 14px", fontFamily: "monospace", color: "var(--forest)", fontWeight: 700 }}>votre-app.onrender.com</td>
                  <td style={{ padding: "10px 14px", color: "var(--muted)" }}>Redirige les visites www</td>
                </tr>
              </tbody>
            </table>

            <div style={{ marginTop: 14, fontSize: 12.5, color: "var(--forest)", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
              <CheckCircle2 size={16} color="var(--forest)" /> Render émettra automatiquement un certificat SSL/TLS gratuit dès la validation DNS.
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: HOME BANNERS (SLIDER) */}
      {activeTab === "home_banners" && (
        <div className="bs-panel">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 18, color: "var(--forest-dark)", display: "flex", alignItems: "center", gap: 8 }}>
                <Image size={20} /> Liste des Home Banners (Slider Principal)
              </h3>
              <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>
                Ajoutez et organisez les grands visuels défilants de la page d'accueil.
              </div>
            </div>
            <button className="bs-btn-primary" style={{ padding: "8px 14px", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }} onClick={addSlide}>
              <Plus size={16} /> Ajouter une diapositive
            </button>
          </div>

          {slidesList.length === 0 && (
            <p style={{ color: "var(--muted)", textAlign: "center", padding: 20 }}>Aucune diapositive configurée. Cliquez sur "Ajouter une diapositive".</p>
          )}

          {slidesList.map((slide, idx) => (
            <div key={slide.id || idx} style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 18, marginBottom: 20, background: "var(--paper)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <span style={{ fontWeight: 800, fontSize: 14, color: "var(--forest-dark)" }}>Diapositive #{idx + 1}</span>
                <button className="bs-icon-btn" style={{ color: "#B4483A" }} onClick={() => removeSlide(idx)}>
                  <Trash2 size={16} /> Supprimer
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 12 }}>
                <div className="bs-field">
                  <label>Titre principal</label>
                  <input className="bs-input" value={slide.title || ""} onChange={(e) => updateSlide(idx, "title", e.target.value)} />
                </div>

                <div className="bs-field">
                  <label>Sous-titre / Accroche</label>
                  <input className="bs-input" value={slide.subtitle || ""} onChange={(e) => updateSlide(idx, "subtitle", e.target.value)} />
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <ImageUploader
                  label="Photo de la diapositive (Depuis l'ordinateur direct OU par URL)"
                  value={slide.imageUrl || ""}
                  onChange={(url) => updateSlide(idx, "imageUrl", url)}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div className="bs-field">
                  <label>Texte du bouton</label>
                  <input className="bs-input" value={slide.buttonText || ""} onChange={(e) => updateSlide(idx, "buttonText", e.target.value)} />
                </div>

                <div className="bs-field">
                  <label>Associer à une Catégorie (Redirection au clic)</label>
                  <select
                    className="bs-select"
                    value={slide.categoryId || ""}
                    onChange={(e) => updateSlide(idx, "categoryId", e.target.value)}
                  >
                    <option value="">-- Toutes les catégories --</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.nom}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 3: HOME SIDE BANNERS */}
      {activeTab === "side_banners" && (
        <div className="bs-panel">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 18, color: "var(--forest-dark)", display: "flex", alignItems: "center", gap: 8 }}>
                <LayoutGrid size={20} /> Liste des Home Side Banners
              </h3>
              <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>
                Bannières secondaires affichées sous les promotions de la page d'accueil.
              </div>
            </div>
            <button className="bs-btn-primary" style={{ padding: "8px 14px", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }} onClick={addSideBanner}>
              <Plus size={16} /> Ajouter une bannière latérale
            </button>
          </div>

          {sideList.length === 0 && (
            <p style={{ color: "var(--muted)", textAlign: "center", padding: 20 }}>Aucune bannière latérale configurée. Cliquez sur "Ajouter une bannière latérale".</p>
          )}

          {sideList.map((side, idx) => (
            <div key={side.id || idx} style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 18, marginBottom: 20, background: "var(--paper)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <span style={{ fontWeight: 800, fontSize: 14, color: "var(--forest-dark)" }}>Bannière Latérale #{idx + 1}</span>
                <button className="bs-icon-btn" style={{ color: "#B4483A" }} onClick={() => removeSideBanner(idx)}>
                  <Trash2 size={16} /> Supprimer
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 12 }}>
                <div className="bs-field">
                  <label>Titre de l'offre</label>
                  <input className="bs-input" value={side.title || ""} onChange={(e) => updateSideBanner(idx, "title", e.target.value)} />
                </div>

                <div className="bs-field">
                  <label>Sous-titre / Promo</label>
                  <input className="bs-input" value={side.subtitle || ""} onChange={(e) => updateSideBanner(idx, "subtitle", e.target.value)} />
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <ImageUploader
                  label="Photo de la bannière (Depuis l'ordinateur direct OU par URL)"
                  value={side.imageUrl || ""}
                  onChange={(url) => updateSideBanner(idx, "imageUrl", url)}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div className="bs-field">
                  <label>Texte du bouton</label>
                  <input className="bs-input" value={side.buttonText || ""} onChange={(e) => updateSideBanner(idx, "buttonText", e.target.value)} />
                </div>

                <div className="bs-field">
                  <label>Associer à une Catégorie (Redirection au clic)</label>
                  <select
                    className="bs-select"
                    value={side.categoryId || ""}
                    onChange={(e) => updateSideBanner(idx, "categoryId", e.target.value)}
                  >
                    <option value="">-- Toutes les catégories --</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.nom}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 4: MODES DE PAIEMENT & STRIPE */}
      {activeTab === "payment_modes" && (
        <div className="bs-panel">
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ margin: "0 0 6px", fontSize: 18, color: "var(--forest-dark)", display: "flex", alignItems: "center", gap: 8 }}>
              <CreditCard size={20} /> Configuration des Modes de Paiement
            </h3>
            <div style={{ fontSize: 13.5, color: "var(--muted)" }}>
              Choisissez les moyens de paiement autorisés et affichés aux clients lors de la validation du panier.
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 28 }}>
            {[
              { key: "especes", label: "Espèces (Cash)", sub: "Paiement à la livraison / réception au comptoir", Icon: Banknote },
              { key: "mvola", label: "Mvola", sub: "Paiement mobile Money Mvola", Icon: Smartphone },
              { key: "holam", label: "Wero", sub: "Paiement instantané européen Wero", Icon: Smartphone },
              { key: "carte", label: "Carte Bancaire (Stripe)", sub: "Paiement en ligne Visa / Mastercard", Icon: CreditCard },
              { key: "wave", label: "Wave", sub: "Paiement mobile Wave via UnitechPay — Sénégal & Afrique", Icon: Smartphone },
              { key: "orange", label: "Orange Money", sub: "Paiement mobile Orange via UnitechPay — Sénégal & Afrique", Icon: Smartphone },
            ].map((item) => {
              const isEnabled = !!modesPaiement[item.key];
              return (
                <div
                  key={item.key}
                  onClick={() => togglePaymentMode(item.key)}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "20px", borderRadius: 16,
                    border: `2px solid ${isEnabled ? "var(--forest)" : "var(--line)"}`,
                    background: isEnabled ? "var(--forest-light)" : "var(--paper)",
                    cursor: "pointer", transition: "all 0.2s ease"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 12,
                      background: isEnabled ? "var(--forest)" : "var(--card)",
                      color: isEnabled ? "#fff" : "var(--muted)",
                      display: "flex", alignItems: "center", justifyContent: "center"
                    }}>
                      <item.Icon size={22} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: "var(--ink)" }}>
                        {item.label}
                      </div>
                      <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>
                        {item.sub}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8, color: isEnabled ? "var(--forest)" : "var(--muted)" }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700 }}>
                      {isEnabled ? "Disponible" : "Indisponible"}
                    </span>
                    {isEnabled ? (
                      <ToggleRight size={34} color="var(--forest)" />
                    ) : (
                      <ToggleLeft size={34} color="#A0AEC0" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* STRIPE CREDENTIALS SECTION */}
          {modesPaiement.carte && (
            <div style={{ background: "var(--paper)", border: "1.5px solid var(--forest)", borderRadius: 16, padding: 22, marginTop: 20 }}>
              <h4 style={{ margin: "0 0 8px", fontSize: 16, color: "var(--ink)", display: "flex", alignItems: "center", gap: 8 }}>
                <Key size={18} color="var(--forest)" /> Clés API & Compte Stripe de la Boutique
              </h4>
              <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--muted)" }}>
                Renseignez vos clés d'API Stripe pour recevoir directement les paiements en carte bancaire sur votre propre compte Stripe d'entreprise.
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div className="bs-field">
                  <label style={{ color: "var(--ink)", fontWeight: 600 }}>Clé Publique Stripe (Publishable Key)</label>
                  <input
                    className="bs-input"
                    style={{ fontFamily: "monospace", fontSize: 13.5 }}
                    value={boutique.stripePublishableKey || ""}
                    onChange={(e) => set("stripePublishableKey", e.target.value)}
                    placeholder="pk_live_..."
                  />
                </div>

                <div className="bs-field">
                  <label style={{ color: "var(--ink)", fontWeight: 600 }}>Clé Secrète Stripe (Secret Key)</label>
                  <input
                    className="bs-input"
                    type="password"
                    style={{ fontFamily: "monospace", fontSize: 13.5 }}
                    value={boutique.stripeSecretKey || ""}
                    onChange={(e) => set("stripeSecretKey", e.target.value)}
                    placeholder="sk_live_..."
                  />
                </div>
              </div>

              <div className="bs-field" style={{ marginTop: 14 }}>
                <label style={{ color: "var(--ink)", fontWeight: 600 }}>ID de compte Stripe Connect (Facultatif - ex: acct_1N...)</label>
                <input
                  className="bs-input"
                  style={{ fontFamily: "monospace", fontSize: 13.5 }}
                  value={boutique.stripeAccountId || ""}
                  onChange={(e) => set("stripeAccountId", e.target.value)}
                  placeholder="acct_..."
                />
              </div>

              <div style={{ background: "var(--accent-light)", color: "var(--accent)", padding: "12px 16px", borderRadius: 10, fontSize: 13, border: "1px solid var(--accent)", marginTop: 16 }}>
                <span style={{ fontWeight: 700 }}>Note d'éligibilité Stripe :</span> Stripe requiert que le compte d'entreprise soit enregistré dans un pays pris en charge (ex: États-Unis via une LLC US, France, Émirats Arabes Unis). Les paiements seront directement versés sur votre compte bancaire rattaché.
              </div>
            </div>
          )}

          {/* UNITECHPAY CREDENTIALS SECTION (Wave & Orange Money) */}
          {(modesPaiement.wave || modesPaiement.orange) && (
            <div style={{ background: "#F0FDF4", border: "1.5px solid #22C55E", borderRadius: 16, padding: 22, marginTop: 20 }}>
              <h4 style={{ margin: "0 0 8px", fontSize: 16, color: "#15803D", display: "flex", alignItems: "center", gap: 8 }}>
                Clé API UnitechPay — Wave & Orange Money
              </h4>
              <p style={{ margin: "0 0 6px", fontSize: 13, color: "var(--muted)" }}>
                Cette clé permet d'encaisser directement les paiements Wave et Orange Money sans redirection complexe.
              </p>

              {/* Guide UnitechPay */}
              <div style={{ background: "#EBF8FF", border: "1px solid #BAE6FD", borderRadius: 10, padding: "10px 14px", fontSize: 13, marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
                <Key size={18} color="#0369A1" />
                <div>
                  <strong>Comment obtenir votre clé UnitechPay :</strong><br />
                  <span style={{ color: "#0369A1" }}>1. Connectez-vous sur <a href="https://pay.unitech.sn" target="_blank" rel="noopener noreferrer" style={{ color: "#0EA5E9", fontWeight: 700 }}>pay.unitech.sn</a></span><br />
                  <span>2. Allez dans <strong>Paramètres → Clé API</strong></span><br />
                  <span>3. Copiez votre <strong>Clé API</strong> et collez-la ci-dessous ou dans votre <code>.env</code>.</span>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
                <div className="bs-field">
                  <label style={{ color: "var(--ink)", fontWeight: 600 }}>Clé API UnitechPay</label>
                  <input
                    className="bs-input"
                    style={{ fontFamily: "monospace", fontSize: 13.5, background: "#f8fafc" }}
                    value={boutique.unitechApiKey || ""}
                    onChange={(e) => set("unitechApiKey", e.target.value)}
                    placeholder="Ex: eb347b5f5b68382b58d3f0babd3687e0186026209ef..."
                  />
                </div>
              </div>

              {/* URL Webhook à configurer dans UnitechPay */}
              <div style={{ background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 10, padding: "12px 16px", marginTop: 14, fontSize: 13 }}>
                <div style={{ fontWeight: 700, color: "#C2410C", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                  À configurer dans votre tableau de bord UnitechPay (Paramètres → Webhooks) :
                </div>
                <div style={{ color: "#92400E", lineHeight: 1.6 }}>
                  Saisissez l'URL de Webhook suivante :<br />
                  <code style={{ background: "#FEF3C7", padding: "4px 8px", borderRadius: 6, display: "inline-block", marginTop: 6, fontWeight: 700, color: "#92400E", fontSize: 12 }}>
                    https://electro-backend.onrender.com/api/webhooks/unitechpay
                  </code><br />
                  <span>Cochez les événements : <strong>Paiement réussi</strong>, <strong>Paiement échoué</strong>, <strong>Paiement expiré</strong>.</span>
                </div>
              </div>

              <div style={{ marginTop: 12, fontSize: 12.5, color: "var(--muted)", lineHeight: 1.5 }}>
                <strong>Note :</strong> La clé UnitechPay est également configurée globalement dans le fichier <code>.env</code> du backend :
                <code style={{ display: "block", background: "#f1f5f9", padding: "8px 12px", borderRadius: 8, marginTop: 6, fontSize: 12 }}>
                  UNITECH_API_KEY=eb347b5f5b68382b58d3f0babd3687e0186026209ef62357d341fef9bccd4fd3
                </code>
              </div>
            </div>
          )}

          {/* RELOADLY AIRTIME CREDENTIALS SECTION (Envoi direct crédit Comores Telecom / Telma) */}
          <div style={{ background: "#F8FAFC", border: "1.5px solid #0284C7", borderRadius: 16, padding: 22, marginTop: 20 }}>
            <h4 style={{ margin: "0 0 8px", fontSize: 16, color: "#0369A1", display: "flex", alignItems: "center", gap: 8 }}>
              Distribution Télécom Automatique (Reloadly API)
            </h4>
            <p style={{ margin: "0 0 10px", fontSize: 13, color: "var(--muted)" }}>
              Permet l&apos;envoi <strong>100% automatique et instantané</strong> du crédit télécom vers les puces <strong>Comores Telecom (Huri)</strong> et <strong>Telma (Yas)</strong> dès que le paiement du client est validé, sans aucune intervention humaine.
            </p>

            {/* Guide Reloadly */}
            <div style={{ background: "#F0F9FF", border: "1px solid #BAE6FD", borderRadius: 10, padding: "12px 16px", fontSize: 13, marginBottom: 16, color: "#0369A1", lineHeight: 1.6 }}>
              <strong>Comment obtenir vos clés d&apos;API Reloadly :</strong><br />
              1. Créez un compte gratuitement sur <a href="https://www.reloadly.com" target="_blank" rel="noopener noreferrer" style={{ color: "#0284C7", fontWeight: 700, textDecoration: "underline" }}>www.reloadly.com</a><br />
              2. Rendez-vous dans <strong>Developers → API Settings</strong><br />
              3. Copiez votre <strong>Client ID</strong> et votre <strong>Client Secret</strong> et collez-les ci-dessous :
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div className="bs-field">
                <label style={{ color: "var(--ink)", fontWeight: 600 }}>Reloadly Client ID</label>
                <input
                  className="bs-input"
                  style={{ fontFamily: "monospace", fontSize: 13.5, background: "#fff" }}
                  value={boutique.reloadlyClientId || ""}
                  onChange={(e) => set("reloadlyClientId", e.target.value)}
                  placeholder="Ex: ABC123XYZ..."
                />
              </div>

              <div className="bs-field">
                <label style={{ color: "var(--ink)", fontWeight: 600 }}>Reloadly Client Secret</label>
                <input
                  type="password"
                  className="bs-input"
                  style={{ fontFamily: "monospace", fontSize: 13.5, background: "#fff" }}
                  value={boutique.reloadlyClientSecret || ""}
                  onChange={(e) => set("reloadlyClientSecret", e.target.value)}
                  placeholder="••••••••••••••••"
                />
              </div>
            </div>

            <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10 }}>
              <input
                type="checkbox"
                id="reloadlySandboxToggle"
                checked={!!boutique.reloadlySandbox}
                onChange={(e) => set("reloadlySandbox", e.target.checked)}
                style={{ width: 18, height: 18, cursor: "pointer" }}
              />
              <label htmlFor="reloadlySandboxToggle" style={{ fontSize: 13, color: "var(--ink)", fontWeight: 600, cursor: "pointer" }}>
                Mode Sandbox / Test (Permet de tester gratuitement les recharges sans argent réel)
              </label>
            </div>
          </div>

          {/* Configuration DingConnect API */}
          <div style={{ background: "#FDF4FF", border: "1.5px solid #C026D3", borderRadius: 16, padding: 22, marginTop: 20 }}>
            <h4 style={{ margin: "0 0 8px", fontSize: 16, color: "#86198F", display: "flex", alignItems: "center", gap: 8 }}>
              Distribution Télécom Alternative (DingConnect API / Ding)
            </h4>
            <p style={{ margin: "0 0 10px", fontSize: 13, color: "var(--muted)" }}>
              Vous utilisez déjà un compte <strong>Ding</strong> (<a href="https://www.ding.com" target="_blank" rel="noopener noreferrer" style={{ color: "#C026D3", fontWeight: 700 }}>www.ding.com</a>) ? Vous pouvez connecter votre compte pour l&apos;envoi automatique de crédit.
            </p>

            <div style={{ background: "#FAE8FF", border: "1px solid #F0ABFC", borderRadius: 10, padding: "12px 16px", fontSize: 13, marginBottom: 16, color: "#86198F", lineHeight: 1.6 }}>
              <strong>Comment obtenir votre Clé API DingConnect :</strong><br />
              1. Connectez-vous sur le portail partenaire : <a href="https://www.dingconnect.com" target="_blank" rel="noopener noreferrer" style={{ color: "#A21CAF", fontWeight: 700, textDecoration: "underline" }}>www.dingconnect.com</a><br />
              2. Allez dans <strong>Account Settings → Developer</strong> (ou API Keys)<br />
              3. Générez ou copiez votre <strong>API Key</strong> et collez-la ci-dessous :
            </div>

            <div className="bs-field">
              <label style={{ color: "var(--ink)", fontWeight: 600 }}>DingConnect API Key</label>
              <input
                type="password"
                className="bs-input"
                style={{ fontFamily: "monospace", fontSize: 13.5, background: "#fff" }}
                value={boutique.dingApiKey || ""}
                onChange={(e) => set("dingApiKey", e.target.value)}
                placeholder="Ex: ding_api_key_xxxxxxxxxxxxxxxx"
              />
            </div>
          </div>

          <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end" }}>
            <button className="bs-btn-primary" onClick={save} style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 24px", fontSize: 15 }}>
              <Save size={18} /> Enregistrer les configurations de paiement
            </button>
          </div>
        </div>
      )}

      {/* TAB 5: NETTOYAGE DB */}
      {activeTab === "cleanup" && (
        <CleanupPanel />
      )}

      <button className="bs-btn-primary" style={{ padding: "14px 28px", marginTop: 10 }} onClick={save}>
        Enregistrer toutes les modifications
      </button>
    </>
  );
}

function CleanupPanel() {
  const [selectedTables, setSelectedTables] = useState({
    commandes: false,
    achats: false,
    produits: false,
    categories: false,
    clients: false,
    fournisseurs: false,
  });
  const [isCleaning, setIsCleaning] = useState(false);
  const [notification, setNotification] = useState(null);

  const showNotification = (msg, type = "success") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleToggle = (table) => {
    setSelectedTables(prev => ({ ...prev, [table]: !prev[table] }));
  };

  const handleCleanup = async () => {
    const toClean = Object.keys(selectedTables).filter(k => selectedTables[k]);
    if (toClean.length === 0) {
      showNotification("Veuillez sélectionner au moins une table à vider.", "error");
      return;
    }
    const confirmMessage = "ATTENTION : Vous êtes sur le point de SUPPRIMER DÉFINITIVEMENT les données des tables suivantes :\n- " + toClean.join("\n- ") + "\n\nCette action est IRRÉVERSIBLE. Voulez-vous continuer ?";
    if (!window.confirm(confirmMessage)) return;

    // Double confirmation if products or clients are selected
    if ((toClean.includes("produits") || toClean.includes("clients")) && !window.confirm("ÊTES-VOUS ABSOLUMENT SÛR ? La suppression des produits/clients peut impacter toute la boutique.")) {
      return;
    }

    setIsCleaning(true);
    try {
      await api.post(`/admin/cleanup`, { tables: toClean });
      showNotification("Nettoyage effectué avec succès !");
      setSelectedTables({ commandes: false, achats: false, produits: false, categories: false, clients: false, fournisseurs: false });
    } catch (err) {
      console.error(err);
      showNotification("Erreur lors du nettoyage : " + (err.response?.data?.message || err.message), "error");
    } finally {
      setIsCleaning(false);
    }
  };

  return (
    <div className="bs-panel" style={{ border: "2px solid #E11D48" }}>
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ margin: "0 0 6px", fontSize: 18, color: "#E11D48", display: "flex", alignItems: "center", gap: 8 }}>
          <AlertTriangle size={20} /> Zone de Danger : Nettoyage de la Base de Données
        </h3>
        <div style={{ fontSize: 13.5, color: "var(--muted)" }}>
          Sélectionnez les données que vous souhaitez remettre à zéro. Cette action supprimera définitivement les éléments sélectionnés pour votre boutique.
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
        {[
          { key: "commandes", label: "Commandes & Ventes" },
          { key: "achats", label: "Achats & Stocks" },
          { key: "produits", label: "Produits du Catalogue" },
          { key: "categories", label: "Catégories" },
          { key: "clients", label: "Comptes Clients" },
          { key: "fournisseurs", label: "Fournisseurs" },
        ].map(item => (
          <label key={item.key} style={{
            display: "flex", alignItems: "center", gap: 10, padding: 16,
            background: selectedTables[item.key] ? "#FFE4E6" : "var(--paper)",
            border: `2px solid ${selectedTables[item.key] ? "#E11D48" : "var(--line)"}`,
            borderRadius: 12, cursor: "pointer", fontWeight: 600, color: "var(--ink)"
          }}>
            <input type="checkbox" checked={selectedTables[item.key]} onChange={() => handleToggle(item.key)} style={{ width: 18, height: 18, accentColor: "#E11D48" }} />
            {item.label}
          </label>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button 
          onClick={handleCleanup} 
          disabled={isCleaning || !Object.values(selectedTables).some(v => v)}
          style={{
            background: "#E11D48", color: "#fff", border: "none", padding: "12px 24px",
            borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 8, opacity: isCleaning ? 0.7 : 1
          }}
        >
          <Trash2 size={18} /> {isCleaning ? "Nettoyage en cours..." : "Lancer le Nettoyage Sélectionné"}
        </button>
      </div>

      {notification && (
        <div style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          background: notification.type === "error" ? "#EF4444" : "#10B981",
          color: "#fff",
          padding: "14px 24px",
          borderRadius: 12,
          boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
          fontWeight: 600,
          fontSize: 14,
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          gap: 10
        }}>
          {notification.msg}
        </div>
      )}
    </div>
  );
}


