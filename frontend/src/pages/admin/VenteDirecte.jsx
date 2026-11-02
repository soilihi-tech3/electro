import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-hot-toast";
import { 
  ShoppingCart, Search, Plus, Minus, Trash2, CheckCircle, Printer, X, CreditCard, DollarSign, Phone, User, Tag, FileText, ArrowRight, AlertTriangle, Edit2, Palette, Sparkles, Layers
} from "lucide-react";
import api from "../../api";
import { useAuth } from "../../context/AuthContext.jsx";
import { subscribeRealtime } from "../../utils/realtime.js";
import InvoiceModal from "../../components/InvoiceModal.jsx";
import { SkeletonProductGrid } from "../../components/Skeleton.jsx";

import { formatPrice as fcfa } from "../../utils/currency.js";

function parseProductVariants(p) {
  if (!p) return { colors: [], options: [], optionTitre: "Variante", hasVariants: false };

  let colors = [];
  if (Array.isArray(p.variantesCouleurs)) {
    colors = p.variantesCouleurs.filter(c => c && c.nom && String(c.nom).trim());
  } else if (typeof p.variantesCouleurs === "string") {
    try {
      const parsed = JSON.parse(p.variantesCouleurs);
      if (Array.isArray(parsed)) colors = parsed.filter(c => c && c.nom && String(c.nom).trim());
    } catch {}
  }

  let options = [];
  let optionTitre = "Variante";
  if (p.variantesOptions) {
    let raw = p.variantesOptions;
    if (typeof raw === "string") {
      try { raw = JSON.parse(raw); } catch {}
    }
    if (raw && typeof raw === "object") {
      if (Array.isArray(raw.options)) {
        options = raw.options.filter(o => o && o.nom && String(o.nom).trim());
        optionTitre = raw.titre || "Variante";
      } else if (Array.isArray(raw)) {
        options = raw.filter(o => o && o.nom && String(o.nom).trim());
      }
    }
  }

  return { colors, options, optionTitre, hasVariants: colors.length > 0 || options.length > 0 };
}

export default function VenteDirecte() {
  const { boutique } = useAuth();
  const storeName = boutique?.nom || "Marché Vert";
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(20);
  const [cart, setCart] = useState([]);
  const [clientNom, setClientNom] = useState("");
  const [clientTelephone, setClientTelephone] = useState("");
  const [moyenPaiement, setMoyenPaiement] = useState("cash");
  const [montantRecu, setMontantRecu] = useState("");
  const [dateEcheance, setDateEcheance] = useState("");
  const [loading, setLoading] = useState(true);
  const [completedSale, setCompletedSale] = useState(null);
  const [mobileTab, setMobileTab] = useState("produits"); // 'produits' | 'panier'
  const [modeDocument, setModeDocument] = useState("caisse"); // 'caisse' | 'devis'
  const [devisModalOpen, setDevisModalOpen] = useState(false);
  const [devisList, setDevisList] = useState([]);

  // Modal de sélection de variantes pour un produit
  const [variantModalProduct, setVariantModalProduct] = useState(null);

  // État du mode modification de vente
  const [editingVenteId, setEditingVenteId] = useState(null);
  const [editingVenteDetails, setEditingVenteDetails] = useState(null);

  function load() {
    setLoading(true);
    api.get("/admin/products?pos=true")
      .then(res => {
        const prods = Array.isArray(res.data) ? res.data : (res.data?.products || []);
        setProducts(prods);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  function loadDevis() {
    api.get("/admin/orders?typeDocument=devis&limit=50")
      .then(res => {
        const devis = Array.isArray(res.data) ? res.data : (res.data?.orders || []);
        setDevisList(devis);
      })
      .catch(() => {});
  }

  // Détection de la demande de modification d'une vente directe
  useEffect(() => {
    const modId = searchParams.get("modifierVenteId");
    if (modId) {
      api.get("/admin/orders")
        .then(res => {
          const found = (res.data || []).find(o => String(o.id) === String(modId));
          if (found) {
            setEditingVenteId(found.id);
            setEditingVenteDetails(found);
            setModeDocument("caisse");
            setClientNom(found.client?.nom || "");
            setClientTelephone(found.client?.telephone || "");
            setMoyenPaiement(found.moyenPaiement || "cash");
            setMontantRecu(String(found.montantRecu !== undefined ? found.montantRecu : ""));
            setDateEcheance(found.dateEcheance ? String(found.dateEcheance).substring(0, 10) : "");
            if (found.items && found.items.length > 0) {
              const loadedCart = found.items.map(it => {
                const p = it.product || { id: it.productId, nom: it.nomProduit || "Article", prix: it.prixUnitaire, stock: 99 };
                const cId = `edit_${it.id || it.productId}`;
                return {
                  cartItemId: cId,
                  product: p,
                  quantite: it.quantite,
                  prixUnitaire: Number(it.prixUnitaire || p.prix),
                  maxStock: p.stock || 99,
                  variantLabel: null
                };
              });
              setCart(loadedCart);
            }
            toast.success(`Vente #COM-B${String(found.id).padStart(3, "0")} chargée en caisse pour modification.`);
          }
        })
        .catch(() => {});
    }
  }, [searchParams]);

  useEffect(() => {
    load();
    const unsub = subscribeRealtime((detail) => {
      if (detail.type === "product_updated") {
        api.get("/admin/products?pos=true").then(res => {
          const prods = Array.isArray(res.data) ? res.data : (res.data?.products || []);
          setProducts(prods);
        }).catch(() => {});
      } else if (detail.type === "order_created" || detail.type === "order_updated") {
        if (devisModalOpen) loadDevis();
      }
    });
    return unsub;
  }, [devisModalOpen]);

  useEffect(() => {
    setVisibleCount(20);
  }, [search]);

  const filteredProducts = products.filter(p => {
    const q = search.trim().toLowerCase();
    return !q || p.nom?.toLowerCase().includes(q) || (p.famille && p.famille.toLowerCase().includes(q));
  });

  const displayedProducts = filteredProducts.slice(0, visibleCount);

  function getCartItemId(productId, color, option) {
    return `${productId}_${color?.nom || ""}_${option?.nom || ""}`;
  }

  function addToCartWithVariant(p, color, option, qty = 1) {
    let maxStock = p.stock;
    if (color && color.stock !== undefined && color.stock !== "") {
      maxStock = Number(color.stock);
    } else if (option && option.stock !== undefined && option.stock !== "") {
      maxStock = Number(option.stock);
    }

    const cartItemId = getCartItemId(p.id, color, option);

    let effectivePrice = p.enPromo && p.prixPromo ? Number(p.prixPromo) : Number(p.prix);
    if (color?.prix && Number(color.prix) > 0) {
      effectivePrice = Number(color.prix);
    } else if (option?.prix && Number(option.prix) > 0) {
      effectivePrice = Number(option.prix);
    }

    const variantLabel = [color?.nom, option?.nom].filter(Boolean).join(" · ");

    setCart(prev => {
      const exist = prev.find(item => (item.cartItemId || String(item.product.id)) === cartItemId);
      const currentInCart = exist ? exist.quantite : 0;
      
      if (modeDocument === "caisse") {
        if (maxStock <= 0) {
          toast.error(`Cette variante (${variantLabel || p.nom}) est en rupture de stock.`);
          return prev;
        }
        if (currentInCart + qty > maxStock) {
          const remainingAddable = Math.max(0, maxStock - currentInCart);
          if (remainingAddable === 0) {
            toast.error(`Stock épuisé pour cette variante (${variantLabel || p.nom}). Maximum disponible : ${maxStock}.`);
            return prev;
          }
          toast.error(`Stock insuffisant. Seules ${remainingAddable} unité(s) supplémentaire(s) disponible(s).`);
          return prev;
        }
      }

      if (exist) {
        toast.success(`Quantité mise à jour : ${exist.quantite + qty} dans le panier`, { id: `cart_${cartItemId}` });
        return prev.map(item => (item.cartItemId || String(item.product.id)) === cartItemId
          ? { ...item, quantite: item.quantite + qty }
          : item
        );
      }

      toast.success(`Ajouté au panier : ${p.nom} ${variantLabel ? `(${variantLabel})` : ""}`, { id: `cart_${cartItemId}` });
      return [...prev, {
        cartItemId,
        product: p,
        selectedColor: color || null,
        selectedOption: option || null,
        variantLabel,
        prixUnitaire: effectivePrice,
        maxStock,
        quantite: qty
      }];
    });
  }

  function handleProductCardClick(p) {
    const { hasVariants } = parseProductVariants(p);
    if (hasVariants) {
      setVariantModalProduct(p);
    } else {
      addToCartWithVariant(p, null, null, 1);
    }
  }

  function updateQty(cartItemId, delta) {
    setCart(prev => prev.map(item => {
      const id = item.cartItemId || String(item.product.id);
      if (id === cartItemId) {
        const maxAllowed = item.maxStock !== undefined ? item.maxStock : item.product.stock;
        const newQty = item.quantite + delta;
        if (modeDocument === "caisse" && newQty > maxAllowed) {
          toast.error(`Stock insuffisant. Maximum disponible pour cette variante : ${maxAllowed}`);
          return item;
        }
        return newQty > 0 ? { ...item, quantite: newQty } : null;
      }
      return item;
    }).filter(Boolean));
  }

  function removeFromCart(cartItemId) {
    setCart(prev => prev.filter(item => (item.cartItemId || String(item.product.id)) !== cartItemId));
  }

  const sousTotal = cart.reduce((sum, item) => {
    const pu = item.prixUnitaire !== undefined 
      ? Number(item.prixUnitaire) 
      : (item.product.enPromo && item.product.prixPromo ? Number(item.product.prixPromo) : Number(item.product.prix));
    return sum + (pu * item.quantite);
  }, 0);

  async function handleValiderVente() {
    if (cart.length === 0) return;
    setLoading(true);
    try {
      const itemsPayload = cart.map(item => ({
        productId: item.product.id,
        quantite: item.quantite,
        prixUnitaire: item.prixUnitaire,
        nom: item.product.nom,
        selectedColor: item.selectedColor,
        selectedOption: item.selectedOption,
        variantLabel: item.variantLabel
      }));

      const isDevis = modeDocument === "devis";
      if (!isDevis) {
        if (!montantRecu || isNaN(montantRecu) || Number(montantRecu) <= 0) {
          toast.error("Veuillez saisir le montant versé par le client (champ obligatoire).");
          setLoading(false);
          return;
        }
        if (Number(montantRecu) < sousTotal && !dateEcheance) {
          toast.error("Veuillez indiquer la date d'échéance pour le montant restant à payer.");
          setLoading(false);
          return;
        }
      }

      const recuNum = Number(montantRecu || (isDevis ? 0 : sousTotal));
      const mRendue = recuNum > sousTotal ? (recuNum - sousTotal) : 0;
      const mRestant = recuNum < sousTotal ? (sousTotal - recuNum) : 0;

      let statutPaiement = "paye";
      if (isDevis) {
        statutPaiement = "non_paye";
      } else if (mRestant > 0) {
        statutPaiement = recuNum > 0 ? "partiel" : "non_paye";
      }

      if (editingVenteId) {
        // Enregistrer la modification de la vente directe existante
        const res = await api.put(`/admin/ventes/directe/${editingVenteId}`, {
          items: itemsPayload,
          clientNom: clientNom.trim() || "Client comptoir",
          clientTelephone: clientTelephone.trim() || "",
          moyenPaiement,
          montantRecu: recuNum,
          monnaieRendue: mRendue,
          montantRestant: mRestant,
          dateEcheance: dateEcheance || null,
          statutPaiement
        });

        setCompletedSale(res.data);
        setEditingVenteId(null);
        setEditingVenteDetails(null);
        setSearchParams({});
        setCart([]);
        setClientNom("");
        setClientTelephone("");
        setMontantRecu("");
        setDateEcheance("");
        toast.success("Vente directe mise à jour avec succès et stocks ajustés !");
        load();
        return;
      }

      const res = await api.post("/admin/ventes/directe", {
        items: itemsPayload,
        clientNom: clientNom.trim() || (isDevis ? "Client Devis" : "Client comptoir"),
        clientTelephone: clientTelephone.trim() || "",
        moyenPaiement: isDevis ? "devis" : moyenPaiement,
        typeDocument: isDevis ? "devis" : "vente_directe",
        montantRecu: recuNum,
        monnaieRendue: mRendue,
        montantRestant: mRestant,
        dateEcheance: dateEcheance || null,
        statutPaiement
      });

      setCompletedSale(res.data);
      setCart([]);
      setClientNom("");
      setClientTelephone("");
      setMontantRecu("");
      setDateEcheance("");
      toast.success(isDevis ? "Devis généré avec succès !" : "Vente directe enregistrée !");
      load(); // Reload stock
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de la validation.");
    } finally {
      setLoading(false);
    }
  }

  function handleCancelModification() {
    setEditingVenteId(null);
    setEditingVenteDetails(null);
    setSearchParams({});
    setCart([]);
    setClientNom("");
    setClientTelephone("");
    setMontantRecu("");
    setDateEcheance("");
    toast.success("Mode modification de vente annulé.");
  }

  async function handleDeleteDevis(devisId) {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer définitivement ce devis proforma ?")) return;
    try {
      await api.delete(`/admin/orders/${devisId}`);
      toast.success("Devis supprimé avec succès.");
      loadDevis();
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de la suppression du devis.");
    }
  }

  async function handleConvertirDevis(devisId) {
    if (!confirm("Voulez-vous convertir ce devis en vente directe réelle ? Les stocks des produits seront décrémentés.")) return;
    try {
      const res = await api.post(`/admin/ventes/devis/${devisId}/convertir`, {
        moyenPaiement: "cash"
      });
      toast.success("Devis converti avec succès en vente directe (stocks mis à jour) !");
      setDevisModalOpen(false);
      setCompletedSale(res.data);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de la conversion du devis.");
    }
  }

  function handlePrintTicket() {
    window.print();
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 26, margin: 0, color: "var(--forest-dark)" }}>Caisse & Devis Directs</h1>
          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 14 }}>
            Enregistrez les encaissements en boutique ou éditez des devis proforma pour vos clients.
          </p>
        </div>

        {/* SWITCH MODE CAISSE VS MODE DEVIS */}
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", background: "var(--paper)", padding: 4, borderRadius: 14, border: "1px solid var(--line)" }}>
            <button
              type="button"
              onClick={() => setModeDocument("caisse")}
              style={{
                padding: "8px 16px",
                borderRadius: 10,
                border: "none",
                cursor: "pointer",
                fontWeight: 800,
                fontSize: 13,
                transition: "all 0.2s",
                background: modeDocument === "caisse" ? "var(--forest)" : "transparent",
                color: modeDocument === "caisse" ? "#fff" : "var(--ink)",
                display: "flex",
                alignItems: "center",
                gap: 6
              }}
            >
              <CreditCard size={15} /> Mode Caisse (Vente)
            </button>
            <button
              type="button"
              onClick={() => setModeDocument("devis")}
              style={{
                padding: "8px 16px",
                borderRadius: 10,
                border: "none",
                cursor: "pointer",
                fontWeight: 800,
                fontSize: 13,
                transition: "all 0.2s",
                background: modeDocument === "devis" ? "#D97706" : "transparent",
                color: modeDocument === "devis" ? "#fff" : "var(--ink)",
                display: "flex",
                alignItems: "center",
                gap: 6
              }}
            >
              <FileText size={15} /> Mode Devis (Proforma)
            </button>
          </div>

          <button
            type="button"
            className="bs-btn-secondary"
            onClick={() => { setDevisModalOpen(true); loadDevis(); }}
            style={{ padding: "9px 14px", fontSize: 13, display: "flex", alignItems: "center", gap: 6, borderRadius: 12, fontWeight: 700 }}
          >
            <FileText size={15} /> Consulter Devis ({devisList.length})
          </button>
        </div>
      </div>

      {/* BANNIÈRE MODE MODIFICATION DE VENTE */}
      {editingVenteId && (
        <div style={{
          background: "#FEF3C7",
          border: "1px solid #FCD34D",
          color: "#92400E",
          borderRadius: 12,
          padding: "12px 18px",
          marginBottom: 16,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 10
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <AlertTriangle size={20} color="#D97706" />
            <div>
              <div style={{ fontWeight: 800, fontSize: 14 }}>
                Mode Modification de la Vente Directe #COM-B{String(editingVenteId).padStart(3, "0")}
              </div>
              <div style={{ fontSize: 12.5, color: "#78350F" }}>
                Vous pouvez ajouter ou supprimer des articles, modifier les quantités et le montant. Les stocks seront recalculés à l'enregistrement.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCancelModification}
            className="bs-btn-secondary"
            style={{ background: "#FFFFFF", border: "1px solid #D97706", color: "#92400E", fontSize: 12, padding: "6px 14px", borderRadius: 8, fontWeight: 700 }}
          >
            Annuler la modification
          </button>
        </div>
      )}

      {/* BANNIÈRE MODE ACTIF */}
      <div style={{
        background: modeDocument === "caisse" ? "var(--forest-light)" : "#FEF3C7",
        border: modeDocument === "caisse" ? "1px solid #A7F3D0" : "1px solid #FDE68A",
        color: modeDocument === "caisse" ? "var(--forest-dark)" : "#B45309",
        borderRadius: 12,
        padding: "10px 16px",
        marginBottom: 16,
        fontSize: 13.5,
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 8
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {modeDocument === "caisse" ? (
            <>
              <CheckCircle size={16} color="var(--forest)" />
              <span>Mode Caisse actif : Les ventes directes décrémentent immédiatement les stocks et s'ajoutent au Chiffre d'Affaires.</span>
            </>
          ) : (
            <>
              <FileText size={16} color="#D97706" />
              <span>Mode Devis actif : Le devis généré ne touche pas aux stocks et ne s'ajoute pas au CA tant qu'il n'est pas converti.</span>
            </>
          )}
        </div>
      </div>

      {/* MOBILE TABS SWITCHER */}
      <div className="bs-pos-mobile-tabs">
        <button 
          className={`bs-pos-tab ${mobileTab === "produits" ? "active" : ""}`}
          onClick={() => setMobileTab("produits")}
        >
          Sélection Produits ({filteredProducts.length})
        </button>
        <button 
          className={`bs-pos-tab ${mobileTab === "panier" ? "active" : ""}`}
          onClick={() => setMobileTab("panier")}
        >
          {modeDocument === "caisse" ? "Panier de Caisse" : "Panier de Devis"} ({cart.reduce((sum, item) => sum + item.quantite, 0)})
        </button>
      </div>

      <div className="bs-pos-grid">
        {/* LEFT COLUMN: PRODUCT SELECTION & SEARCH */}
        <div className={`bs-pos-products-col ${mobileTab === "produits" ? "mobile-active" : "mobile-hidden"}`}>
          {/* SEARCH BAR */}
          <div className="bs-panel" style={{ padding: 14, marginBottom: 16 }}>
            <div style={{ position: "relative", width: "100%" }}>
              <Search size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
              <input
                className="bs-input"
                placeholder="Rechercher un produit à ajouter au panier..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ paddingLeft: 38, borderRadius: 10, fontSize: 13.5, height: 40 }}
              />
            </div>
          </div>

          {/* PRODUCT GRID */}
          {loading ? (
            <SkeletonProductGrid count={8} />
          ) : filteredProducts.length === 0 ? (
            <div className="bs-panel" style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
              Aucun produit ne correspond à votre recherche.
            </div>
          ) : (
            <>
              <div className="bs-pos-products-grid">
                {displayedProducts.map(p => {
                  const inStock = p.stock > 0;
                  const prixEff = p.enPromo && p.prixPromo ? Number(p.prixPromo) : Number(p.prix);
                  const { colors, options, optionTitre, hasVariants } = parseProductVariants(p);

                  return (
                    <div
                      key={p.id}
                      onClick={() => inStock && handleProductCardClick(p)}
                      style={{
                        background: "#fff", borderRadius: 14, border: "1px solid var(--line)",
                        padding: 12, cursor: inStock ? "pointer" : "not-allowed",
                        opacity: inStock ? 1 : 0.6, display: "flex", flexDirection: "column",
                        justifyContent: "space-between", position: "relative", transition: "transform 0.15s",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.03)"
                      }}
                    >
                      <img
                        src={p.imageUrl || "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=150&q=80"}
                        alt={p.nom}
                        loading="lazy"
                        decoding="async"
                        style={{ width: "100%", height: 110, objectFit: "cover", borderRadius: 10, marginBottom: 8 }}
                      />
                      <div>
                        <div style={{ fontSize: 11, color: "var(--forest)", fontWeight: 700, textTransform: "uppercase" }}>
                          {p.famille || "Produit"}
                        </div>
                        <div style={{ fontWeight: 700, fontSize: 13.5, color: "var(--ink)", height: 36, overflow: "hidden" }}>
                          {p.nom}
                        </div>

                        {/* BADGES VARIANTES COULEURS OU OPTIONS */}
                        {hasVariants && (
                          <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 4, flexWrap: "wrap" }}>
                            {colors.length > 0 && (
                              <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                                {colors.slice(0, 4).map((c, i) => (
                                  <span
                                    key={i}
                                    style={{
                                      width: 12, height: 12, borderRadius: "50%",
                                      background: c.couleur || "#163424",
                                      border: "1.5px solid #fff",
                                      boxShadow: "0 0 0 1px rgba(0,0,0,0.15)"
                                    }}
                                    title={c.nom}
                                  />
                                ))}
                                {colors.length > 4 && (
                                  <span style={{ fontSize: 9.5, color: "var(--muted)", fontWeight: 700 }}>
                                    +{colors.length - 4}
                                  </span>
                                )}
                              </div>
                            )}
                            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--forest)", background: "var(--forest-light)", padding: "1px 6px", borderRadius: 6 }}>
                              {colors.length > 0 ? `${colors.length} coul.` : `${options.length} ${optionTitre}`}
                            </span>
                          </div>
                        )}
                        
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                          <div style={{ fontWeight: 800, fontSize: 14.5, color: "var(--forest-dark)" }}>
                            {fcfa(prixEff)} {p.unite ? <span style={{ fontSize: 11, fontWeight: 500, color: "var(--muted)" }}>/ {p.poids && p.poids !== "1" ? `${p.poids} ` : ""}{p.unite}</span> : ""}
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 700, color: inStock ? "#1F4D3A" : "#B4483A" }}>
                            {inStock ? `Stock: ${p.stock}` : "Épuisé"}
                          </span>
                        </div>

                        {p.dernierPrix && Number(p.dernierPrix) > 0 && (
                          <div style={{ marginTop: 4, fontSize: 11, fontWeight: 700, color: "#DC2626", background: "#FEF2F2", border: "1px dashed #FCA5A5", padding: "2px 6px", borderRadius: 6, display: "inline-block" }}>
                            🔒 Plancher : {fcfa(p.dernierPrix)}
                          </div>
                        )}
                      </div>

                      {hasVariants ? (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 10 }}>
                          <button
                            type="button"
                            disabled={!inStock}
                            onClick={(e) => {
                              e.stopPropagation();
                              inStock && addToCartWithVariant(p, null, null, 1);
                            }}
                            title="Ajouter directement le produit standard"
                            style={{
                              background: inStock ? "var(--forest-light)" : "#F3F4F6",
                              color: inStock ? "var(--forest-dark)" : "var(--muted)",
                              border: "1px solid var(--line)",
                              padding: "7px 4px", borderRadius: 8, fontWeight: 700, fontSize: 11.5,
                              display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                              cursor: inStock ? "pointer" : "not-allowed"
                            }}
                          >
                            <Plus size={13} /> Direct
                          </button>

                          <button
                            type="button"
                            disabled={!inStock}
                            onClick={(e) => {
                              e.stopPropagation();
                              inStock && setVariantModalProduct(p);
                            }}
                            title="Choisir une couleur ou une variante spécifique"
                            style={{
                              background: inStock ? "var(--forest)" : "#F3F4F6",
                              color: inStock ? "#ffffff" : "var(--muted)",
                              border: "none",
                              padding: "7px 4px", borderRadius: 8, fontWeight: 700, fontSize: 11.5,
                              display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                              cursor: inStock ? "pointer" : "not-allowed",
                              boxShadow: inStock ? "0 2px 6px rgba(22, 52, 36, 0.25)" : "none"
                            }}
                          >
                            <Palette size={13} /> Variantes
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={!inStock}
                          onClick={(e) => {
                            e.stopPropagation();
                            inStock && handleProductCardClick(p);
                          }}
                          style={{
                            marginTop: 10, width: "100%",
                            background: inStock ? "var(--forest-light)" : "#F3F4F6",
                            color: inStock ? "var(--forest)" : "var(--muted)",
                            border: "none",
                            padding: "7px", borderRadius: 8, fontWeight: 700, fontSize: 12,
                            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                            cursor: inStock ? "pointer" : "not-allowed"
                          }}
                        >
                          <Plus size={14} /> Ajouter au panier
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {filteredProducts.length > visibleCount && (
                <div style={{ textAlign: "center", marginTop: 16 }}>
                  <button
                    type="button"
                    onClick={() => setVisibleCount(prev => prev + 20)}
                    className="bs-btn-secondary"
                    style={{
                      padding: "10px 24px",
                      borderRadius: 12,
                      fontWeight: 700,
                      fontSize: 13,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      boxShadow: "0 2px 6px rgba(0,0,0,0.04)"
                    }}
                  >
                    <span>Afficher 20 produits de plus</span>
                    <span style={{ fontSize: 11, background: "var(--line)", padding: "2px 8px", borderRadius: 10, color: "var(--muted)" }}>
                      {displayedProducts.length} sur {filteredProducts.length}
                    </span>
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* RIGHT COLUMN: CASHIER CART & TICKET SUMMARY */}
        <div className={`bs-pos-cart-col bs-pos-cart-sticky ${mobileTab === "panier" ? "mobile-active" : "mobile-hidden"}`}>
          <div className="bs-panel" style={{ padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, borderBottom: "1px solid var(--line)", paddingBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <ShoppingCart size={20} color="var(--forest)" />
                <h3 style={{ margin: 0, fontSize: 17, color: "var(--forest-dark)" }}>
                  {modeDocument === "caisse" ? "Panier de Caisse" : "Panier de Devis"}
                </h3>
              </div>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--muted)" }}>
                {cart.length} article{cart.length > 1 ? "s" : ""}
              </span>
            </div>

            {/* CART ITEMS LIST */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 280, overflowY: "auto", marginBottom: 16, paddingRight: 4 }}>
              {cart.length === 0 ? (
                <div style={{ padding: 30, textAlign: "center", color: "var(--muted)", fontSize: 13.5 }}>
                  Le panier est actuellement vide.<br />Cliquez sur un produit pour l'ajouter.
                </div>
              ) : (
                cart.map(item => {
                const prixEff = item.prixUnitaire !== undefined 
                  ? Number(item.prixUnitaire) 
                  : (item.product.enPromo && item.product.prixPromo ? Number(item.product.prixPromo) : Number(item.product.prix));
                const itemKey = item.cartItemId || String(item.product.id);
                const variantPhoto = item.selectedColor?.photo || item.selectedOption?.photo || item.product.imageUrl;

                return (
                  <div key={itemKey} style={{ display: "flex", alignItems: "center", gap: 10, padding: 8, background: "var(--paper)", borderRadius: 10, border: "1px solid var(--line)" }}>
                    <img 
                      src={variantPhoto || "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=80&q=80"} 
                      alt={item.product.nom}
                      style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover" }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {item.product.nom}
                      </div>

                      {/* BADGES VARIANTES COULEUR ET OPTION */}
                      {item.selectedColor && (
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#fff", border: "1px solid var(--line)", padding: "1px 7px", borderRadius: 10, fontSize: 11, fontWeight: 700, marginTop: 2 }}>
                          <span style={{ width: 9, height: 9, borderRadius: "50%", background: item.selectedColor.couleur || "#163424", border: "1px solid rgba(0,0,0,0.15)" }} />
                          <span>{item.selectedColor.nom}</span>
                        </div>
                      )}
                      {item.selectedOption && (
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#fff", border: "1px solid var(--line)", padding: "1px 7px", borderRadius: 10, fontSize: 11, fontWeight: 700, marginTop: 2, marginLeft: item.selectedColor ? 4 : 0 }}>
                          <span>{item.selectedOption.nom}</span>
                        </div>
                      )}

                      <div style={{ fontSize: 12, color: "var(--forest)", fontWeight: 700, marginTop: 2 }}>
                        {fcfa(prixEff)} x {item.quantite} = {fcfa(prixEff * item.quantite)}
                      </div>
                      {item.product.dernierPrix && Number(item.product.dernierPrix) > 0 && (
                        <div style={{ fontSize: 10.5, color: "#DC2626", fontWeight: 700 }}>
                          Plancher : {fcfa(item.product.dernierPrix)}
                        </div>
                      )}
                    </div>

                    {/* QUANTITY CONTROLS */}
                    <div style={{ display: "flex", alignItems: "center", gap: 4, background: "#fff", padding: "2px 6px", borderRadius: 8, border: "1px solid var(--line)" }}>
                      <button 
                        onClick={() => updateQty(itemKey, -1)}
                        style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex" }}
                      >
                        <Minus size={14} color="var(--ink)" />
                      </button>
                      <span style={{ fontSize: 13, fontWeight: 700, minWidth: 16, textAlign: "center" }}>{item.quantite}</span>
                      <button 
                        onClick={() => updateQty(itemKey, 1)}
                        style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex" }}
                      >
                        <Plus size={14} color="var(--ink)" />
                      </button>
                    </div>

                    <button 
                      onClick={() => removeFromCart(itemKey)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#B4483A", padding: 4 }}
                      title="Supprimer"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              })
              )}
            </div>

            {/* CUSTOMER INFO */}
            <div style={{ borderTop: "1px solid var(--line)", paddingTop: 14, marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", marginBottom: 8 }}>
                Informations Client {modeDocument === "devis" ? "(Recommandé pour Devis)" : "(Optionnel)"}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                <input
                  className="bs-input"
                  placeholder="Nom du client"
                  value={clientNom}
                  onChange={(e) => setClientNom(e.target.value)}
                  style={{ fontSize: 12.5, height: 36 }}
                />
                <input
                  type="tel"
                  className="bs-input"
                  placeholder="Téléphone (chiffres uniquement)"
                  value={clientTelephone}
                  onChange={(e) => setClientTelephone(e.target.value.replace(/\D/g, ""))}
                  style={{ fontSize: 12.5, height: 36 }}
                />
              </div>

              {/* PAYMENT METHOD (ONLY FOR CAISSE) */}
              {modeDocument === "caisse" && (
                <>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", marginBottom: 6 }}>
                    Moyen de paiement
                  </div>
                  <select
                    className="bs-select"
                    value={moyenPaiement}
                    onChange={(e) => setMoyenPaiement(e.target.value)}
                    style={{ fontSize: 13, height: 38, marginBottom: 14 }}
                  >
                    <option value="cash">Espèces / Cash</option>
                    <option value="mvola">Mvola</option>
                    <option value="holam">Holam</option>
                    <option value="carte">Carte Bancaire (TPE)</option>
                  </select>

                  {/* CAISSE & ENCAISSEMENT AVEC CALCUL DE MONNAIE / RESTE */}
                  <div style={{ background: "#F8FAFC", padding: 12, borderRadius: 12, border: "1px solid var(--line)", marginBottom: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <label style={{ fontSize: 11.5, fontWeight: 800, color: "var(--ink)", textTransform: "uppercase" }}>
                        Montant Reçu du Client <span style={{ color: "#DC2626" }}>* (Obligatoire)</span> :
                      </label>
                      <button
                        type="button"
                        onClick={() => setMontantRecu(String(sousTotal))}
                        style={{ background: "none", border: "none", color: "var(--forest)", fontSize: 11, fontWeight: 800, cursor: "pointer", textDecoration: "underline" }}
                      >
                        Montant exact
                      </button>
                    </div>

                    <input
                      type="number"
                      min="0"
                      className="bs-input"
                      placeholder={`ex: ${sousTotal}`}
                      value={montantRecu}
                      onChange={(e) => setMontantRecu(e.target.value)}
                      style={{ fontSize: 15, fontWeight: 800, height: 40, marginBottom: 8 }}
                    />

                    {/* Raccourcis coupures d'argent */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 10 }}>
                      {[500, 1000, 2000, 5000, 10000, 20000, 50000].map(val => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setMontantRecu(String(val))}
                          style={{
                            padding: "4px 8px", borderRadius: 6, border: "1px solid var(--line)",
                            background: Number(montantRecu) === val ? "var(--forest)" : "#fff",
                            color: Number(montantRecu) === val ? "#fff" : "var(--ink)",
                            fontSize: 11, fontWeight: 700, cursor: "pointer"
                          }}
                        >
                          +{val.toLocaleString()}
                        </button>
                      ))}
                    </div>

                    {/* CALCUL MONNAIE À RENDRE */}
                    {montantRecu !== "" && Number(montantRecu) > sousTotal && (
                      <div style={{
                        background: "#DCFCE7", border: "1px solid #86EFAC", color: "#166534",
                        borderRadius: 8, padding: "8px 12px", display: "flex", justifyContent: "space-between", alignItems: "center",
                        fontWeight: 800, fontSize: 13
                      }}>
                        <span>💵 Monnaie à rendre :</span>
                        <span style={{ fontSize: 16 }}>{fcfa(Number(montantRecu) - sousTotal, boutique?.devise)}</span>
                      </div>
                    )}

                    {/* CALCUL RESTE À PAYER (CRÉDIT) */}
                    {montantRecu !== "" && Number(montantRecu) < sousTotal && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <div style={{
                          background: "#FEE2E2", border: "1px solid #FCA5A5", color: "#991B1B",
                          borderRadius: 8, padding: "8px 12px", display: "flex", justifyContent: "space-between", alignItems: "center",
                          fontWeight: 800, fontSize: 13
                        }}>
                          <span>⚠️ Reste à payer (Dette) :</span>
                          <span style={{ fontSize: 16 }}>{fcfa(sousTotal - Number(montantRecu), boutique?.devise)}</span>
                        </div>

                        <div>
                          <label style={{ fontSize: 11, fontWeight: 800, color: "#991B1B", display: "block", marginBottom: 4 }}>
                            Date d'échéance de règlement * :
                          </label>
                          <input
                            type="date"
                            className="bs-input"
                            value={dateEcheance}
                            onChange={(e) => setDateEcheance(e.target.value)}
                            style={{ fontSize: 12.5, height: 36, borderColor: "#FCA5A5" }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* TOTAL & SUBMIT */}
            <div style={{ background: "var(--paper)", padding: 14, borderRadius: 12, border: "1px solid var(--line)", marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>
                  {modeDocument === "caisse" ? "Total à Payer" : "Total du Devis"}
                </span>
                <span style={{ fontSize: 22, fontWeight: 900, color: modeDocument === "caisse" ? "var(--forest-dark)" : "#B45309" }}>
                  {fcfa(sousTotal)}
                </span>
              </div>
            </div>

            <button
              className="bs-btn-primary"
              style={{
                width: "100%", height: 46, fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                background: editingVenteId ? "#2563EB" : modeDocument === "devis" ? "#D97706" : "var(--forest)"
              }}
              disabled={cart.length === 0 || loading}
              onClick={handleValiderVente}
            >
              {loading ? (
                "Traitement en cours..."
              ) : editingVenteId ? (
                <><CheckCircle size={18} /> Enregistrer les Modifications de la Vente</>
              ) : modeDocument === "devis" ? (
                <><FileText size={18} /> Générer le Devis Proforma</>
              ) : (
                <><CheckCircle size={18} /> Valider la Vente Directe</>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* FLOATING ACTION BUTTON ON MOBILE */}
      {cart.length > 0 && mobileTab === "produits" && (
        <button className="bs-pos-mobile-float-cart" onClick={() => setMobileTab("panier")}>
          <ShoppingCart size={18} /> Voir / Valider le Panier ({cart.reduce((sum, item) => sum + item.quantite, 0)}) · {fcfa(sousTotal)}
        </button>
      )}

      {/* DEVIS LIST MODAL */}
      {devisModalOpen && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9998, padding: 20
        }}>
          <div style={{
            background: "#fff", borderRadius: 16, padding: 24,
            maxWidth: 750, width: "100%", maxHeight: "85vh", display: "flex", flexDirection: "column",
            boxShadow: "0 20px 25px -5px rgba(0,0,0,0.15)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--line)", paddingBottom: 14, marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <FileText size={22} color="#D97706" />
                <h3 style={{ margin: 0, fontSize: 18, color: "var(--ink)" }}>Devis Proforma Enregistrés ({devisList.length})</h3>
              </div>
              <button onClick={() => setDevisModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)" }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 10, paddingRight: 6 }}>
              {devisList.length === 0 ? (
                <div style={{ textAlign: "center", padding: 40, color: "var(--muted)", fontSize: 14 }}>
                  Aucun devis proforma en attente.
                </div>
              ) : (
                devisList.map(devis => {
                  const isConverted = devis.statut === "livre" || devis.statut === "validee" || devis.statut === "paye";
                  return (
                    <div key={devis.id} style={{
                      border: "1px solid var(--line)", borderRadius: 12, padding: 14, background: "var(--paper)",
                      display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12
                    }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontWeight: 800, fontSize: 14, color: "var(--forest-dark)" }}>
                            #DEV-{String(devis.id).padStart(3, "0")}
                          </span>
                          <span style={{
                            fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6,
                            background: isConverted ? "#D1FAE5" : "#FEF3C7",
                            color: isConverted ? "#065F46" : "#B45309"
                          }}>
                            {isConverted ? "Converti en Vente" : "En attente"}
                          </span>
                          <span style={{ fontSize: 12, color: "var(--muted)" }}>
                            {new Date(devis.createdAt).toLocaleDateString("fr-FR")}
                          </span>
                        </div>
                        <div style={{ fontSize: 13, color: "var(--ink)", marginTop: 4, fontWeight: 600 }}>
                          Client : {devis.client?.nom || "Client inconnu"} {devis.client?.telephone && `(${devis.client.telephone})`}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                          {devis.items?.length || 0} article(s) · Émis par {devis.creeParNom || devis.employeAssigne?.nom || "Admin"}
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 16, fontWeight: 900, color: "var(--forest-dark)", marginRight: 8 }}>
                          {fcfa(devis.total)}
                        </span>
                        
                        <button
                          type="button"
                          className="bs-btn-secondary"
                          onClick={() => { setCompletedSale(devis); setDevisModalOpen(false); }}
                          style={{ padding: "6px 12px", fontSize: 12, borderRadius: 8, display: "flex", alignItems: "center", gap: 4 }}
                        >
                          <Printer size={13} /> Voir / Imprimer
                        </button>

                        {!isConverted && (
                          <button
                            type="button"
                            className="bs-btn-primary"
                            onClick={() => handleConvertirDevis(devis.id)}
                            style={{ padding: "6px 12px", fontSize: 12, borderRadius: 8, display: "flex", alignItems: "center", gap: 4 }}
                          >
                            <ArrowRight size={13} /> Convertir en Vente
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleDeleteDevis(devis.id)}
                          style={{
                            padding: "6px 10px", fontSize: 12, borderRadius: 8,
                            border: "1px solid #FCA5A5", background: "#FEE2E2", color: "#B91C1C",
                            cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontWeight: 600
                          }}
                          title="Supprimer définitivement ce devis"
                        >
                          <Trash2 size={13} /> Supprimer
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--line)", textAlign: "right" }}>
              <button className="bs-btn-secondary" onClick={() => setDevisModalOpen(false)} style={{ padding: "8px 18px", borderRadius: 8 }}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE SÉLECTION DYNAMIQUE DE VARIANTES & COULEURS */}
      {variantModalProduct && (() => {
        const p = variantModalProduct;
        const { colors, options, optionTitre } = parseProductVariants(p);
        const basePrice = (p.enPromo && p.prixPromo) ? Number(p.prixPromo) : Number(p.prix);
        const totalInCartForProduct = cart
          .filter(it => it.product.id === p.id)
          .reduce((sum, it) => sum + it.quantite, 0);

        return (
          <div
            style={{
              position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
              background: "rgba(15, 23, 42, 0.7)", backdropFilter: "blur(6px)",
              zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center",
              padding: 16
            }}
            onClick={() => setVariantModalProduct(null)}
          >
            <div
              style={{
                background: "var(--card, #ffffff)", borderRadius: 20, width: "100%", maxWidth: 540,
                maxHeight: "90vh", overflowY: "auto", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
                border: "1px solid var(--line)", padding: 24, position: "relative"
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header avec bouton fermer */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                  <img
                    src={p.imageUrl || "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=150&q=80"}
                    alt={p.nom}
                    style={{ width: 60, height: 60, borderRadius: 12, objectFit: "cover", border: "1px solid var(--line)" }}
                  />
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 800, color: "var(--forest)", textTransform: "uppercase" }}>
                      {p.famille || "Produit"}
                    </span>
                    <h3 style={{ margin: "2px 0 4px", fontSize: 16, color: "var(--ink)", fontWeight: 800, lineHeight: 1.3 }}>
                      {p.nom}
                    </h3>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                      <span style={{ fontWeight: 800, color: "var(--forest-dark)" }}>{fcfa(basePrice)}</span>
                      <span>•</span>
                      <span style={{ color: "var(--muted)", fontSize: 12 }}>Stock total : {p.stock}</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setVariantModalProduct(null)}
                  style={{
                    width: 32, height: 32, borderRadius: 10, border: "1px solid var(--line)",
                    background: "var(--paper)", display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", color: "var(--muted)"
                  }}
                >
                  <X size={18} />
                </button>
              </div>

              <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 10, padding: "8px 12px", marginBottom: 16, fontSize: 12, color: "#1E40AF", display: "flex", alignItems: "center", gap: 6 }}>
                <Sparkles size={15} />
                <span>Sélectionnez la variante à ajouter. Les stocks restants se mettent à jour en direct dès que vous ajoutez au panier.</span>
              </div>

              {/* LISTE DES COULEURS */}
              {colors.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: "var(--forest-dark)", textTransform: "uppercase", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                    <Palette size={15} />
                    <span>Couleurs disponibles ({colors.length})</span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {colors.map((c, idx) => {
                      const inCartQty = cart.find(it => it.product.id === p.id && it.selectedColor?.nom === c.nom)?.quantite || 0;
                      const configStock = (c.stock !== undefined && c.stock !== "") ? Number(c.stock) : p.stock;
                      const remainingStock = Math.max(0, configStock - inCartQty);
                      const isOutOfStock = modeDocument === "caisse" && remainingStock <= 0;
                      const priceEff = (c.prix && Number(c.prix) > 0) ? Number(c.prix) : basePrice;

                      return (
                        <div
                          key={idx}
                          style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            padding: "10px 14px", borderRadius: 12, border: "1.5px solid var(--line)",
                            background: inCartQty > 0 ? "var(--forest-light)" : "var(--paper)",
                            opacity: isOutOfStock ? 0.6 : 1, transition: "all 0.15s ease"
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            {c.photo ? (
                              <img
                                src={c.photo}
                                alt={c.nom}
                                style={{ width: 34, height: 34, borderRadius: 8, objectFit: "cover", border: "1px solid var(--line)" }}
                              />
                            ) : (
                              <span style={{
                                width: 24, height: 24, borderRadius: "50%",
                                background: c.couleur || "#163424",
                                border: "2px solid #ffffff",
                                boxShadow: "0 0 0 1.5px rgba(0,0,0,0.18)"
                              }} />
                            )}
                            <div>
                              <div style={{ fontWeight: 800, fontSize: 13.5, color: "var(--ink)" }}>
                                {c.nom}
                              </div>
                              <div style={{ fontSize: 12, color: "var(--forest-dark)", fontWeight: 700 }}>
                                {fcfa(priceEff)}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ textAlign: "right" }}>
                              {isOutOfStock ? (
                                <span style={{ fontSize: 11, fontWeight: 800, color: "#DC2626", background: "#FEF2F2", border: "1px solid #FCA5A5", padding: "3px 8px", borderRadius: 8, display: "inline-block" }}>
                                  Épuisé (0 restant)
                                </span>
                              ) : (
                                <span style={{ fontSize: 11.5, fontWeight: 800, color: "#059669", background: "#ECFDF5", border: "1px solid #A7F3D0", padding: "3px 8px", borderRadius: 8, display: "inline-block" }}>
                                  Stock : {remainingStock} restant{remainingStock > 1 ? "s" : ""}
                                </span>
                              )}
                              {inCartQty > 0 && (
                                <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--forest)", marginTop: 2 }}>
                                  ({inCartQty} dans le panier)
                                </div>
                              )}
                            </div>

                            <button
                              type="button"
                              disabled={isOutOfStock}
                              onClick={() => addToCartWithVariant(p, c, null, 1)}
                              style={{
                                background: isOutOfStock ? "#E2E8F0" : "var(--forest)",
                                color: isOutOfStock ? "var(--muted)" : "#ffffff",
                                border: "none", borderRadius: 9, padding: "7px 12px",
                                fontSize: 12, fontWeight: 700, cursor: isOutOfStock ? "not-allowed" : "pointer",
                                display: "flex", alignItems: "center", gap: 4,
                                boxShadow: isOutOfStock ? "none" : "0 2px 6px rgba(22, 52, 36, 0.2)"
                              }}
                            >
                              <Plus size={14} /> Ajouter 1
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* LISTE DES OPTIONS / SENTEURS / MODÈLES */}
              {options.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: "var(--forest-dark)", textTransform: "uppercase", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                    <Layers size={15} />
                    <span>{optionTitre}s disponibles ({options.length})</span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {options.map((opt, idx) => {
                      const inCartQty = cart.find(it => it.product.id === p.id && it.selectedOption?.nom === opt.nom)?.quantite || 0;
                      const configStock = (opt.stock !== undefined && opt.stock !== "") ? Number(opt.stock) : p.stock;
                      const remainingStock = Math.max(0, configStock - inCartQty);
                      const isOutOfStock = modeDocument === "caisse" && remainingStock <= 0;
                      const priceEff = (opt.prix && Number(opt.prix) > 0) ? Number(opt.prix) : basePrice;

                      return (
                        <div
                          key={idx}
                          style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            padding: "10px 14px", borderRadius: 12, border: "1.5px solid var(--line)",
                            background: inCartQty > 0 ? "var(--forest-light)" : "var(--paper)",
                            opacity: isOutOfStock ? 0.6 : 1, transition: "all 0.15s ease"
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            {opt.photo && (
                              <img
                                src={opt.photo}
                                alt={opt.nom}
                                style={{ width: 34, height: 34, borderRadius: 8, objectFit: "cover", border: "1px solid var(--line)" }}
                              />
                            )}
                            <div>
                              <div style={{ fontWeight: 800, fontSize: 13.5, color: "var(--ink)" }}>
                                {opt.nom}
                              </div>
                              <div style={{ fontSize: 12, color: "var(--forest-dark)", fontWeight: 700 }}>
                                {fcfa(priceEff)}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ textAlign: "right" }}>
                              {isOutOfStock ? (
                                <span style={{ fontSize: 11, fontWeight: 800, color: "#DC2626", background: "#FEF2F2", border: "1px solid #FCA5A5", padding: "3px 8px", borderRadius: 8, display: "inline-block" }}>
                                  Épuisé (0 restant)
                                </span>
                              ) : (
                                <span style={{ fontSize: 11.5, fontWeight: 800, color: "#059669", background: "#ECFDF5", border: "1px solid #A7F3D0", padding: "3px 8px", borderRadius: 8, display: "inline-block" }}>
                                  Stock : {remainingStock} restant{remainingStock > 1 ? "s" : ""}
                                </span>
                              )}
                              {inCartQty > 0 && (
                                <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--forest)", marginTop: 2 }}>
                                  ({inCartQty} dans le panier)
                                </div>
                              )}
                            </div>

                            <button
                              type="button"
                              disabled={isOutOfStock}
                              onClick={() => addToCartWithVariant(p, null, opt, 1)}
                              style={{
                                background: isOutOfStock ? "#E2E8F0" : "var(--forest)",
                                color: isOutOfStock ? "var(--muted)" : "#ffffff",
                                border: "none", borderRadius: 9, padding: "7px 12px",
                                fontSize: 12, fontWeight: 700, cursor: isOutOfStock ? "not-allowed" : "pointer",
                                display: "flex", alignItems: "center", gap: 4,
                                boxShadow: isOutOfStock ? "none" : "0 2px 6px rgba(22, 52, 36, 0.2)"
                              }}
                            >
                              <Plus size={14} /> Ajouter 1
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Footer */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
                  Total dans le panier : <strong style={{ color: "var(--forest-dark)" }}>{totalInCartForProduct}</strong> article(s)
                </span>
                <button
                  type="button"
                  className="bs-btn-primary"
                  onClick={() => setVariantModalProduct(null)}
                  style={{ padding: "8px 20px", borderRadius: 10, fontSize: 13 }}
                >
                  Terminer
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* VÉRITABLE FACTURE / DEVIS MODERNE FORMAT A4 & IMPRESSION PDF */}
      {completedSale && (
        <InvoiceModal
          order={completedSale}
          boutique={boutique}
          onClose={() => setCompletedSale(null)}
        />
      )}
    </>
  );
}
