import React, { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { 
  ShoppingCart, Search, Plus, Minus, Trash2, CheckCircle, Printer, X, CreditCard, DollarSign, Phone, User, Tag
} from "lucide-react";
import api from "../../api";
import { useAuth } from "../../context/AuthContext.jsx";
import { subscribeRealtime } from "../../utils/realtime.js";

import { formatPrice as fcfa } from "../../utils/currency.js";

export default function VenteDirecte() {
  const { boutique } = useAuth();
  const storeName = boutique?.nom || "Marché Vert";
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState([]);
  const [clientNom, setClientNom] = useState("");
  const [clientTelephone, setClientTelephone] = useState("");
  const [moyenPaiement, setMoyenPaiement] = useState("cash");
  const [loading, setLoading] = useState(false);
  const [completedSale, setCompletedSale] = useState(null);
  const [mobileTab, setMobileTab] = useState("produits"); // 'produits' | 'panier'


  function load() {
    api.get("/admin/products").then(res => setProducts(res.data || []));
  }

  useEffect(() => {
    load();
    const unsub = subscribeRealtime((detail) => {
      if (detail.type === "product_updated" || detail.type === "order_created") {
        load();
      }
    });
    return unsub;
  }, []);

  const filteredProducts = products.filter(p => {
    const q = search.trim().toLowerCase();
    return !q || p.nom.toLowerCase().includes(q) || (p.famille && p.famille.toLowerCase().includes(q));
  });

  function addToCart(p) {
    if (p.stock <= 0) {
      toast.error("Ce produit est en rupture de stock.");
      return;
    }
    setCart(prev => {
      const exist = prev.find(item => item.product.id === p.id);
      if (exist) {
        if (exist.quantite >= p.stock) {
          toast.error(`Stock insuffisant. Seules ${p.stock} unités sont disponibles.`);
          return prev;
        }
        return prev.map(item => item.product.id === p.id ? { ...item, quantite: item.quantite + 1 } : item);
      }
      return [...prev, { product: p, quantite: 1 }];
    });
  }

  function updateQty(productId, delta) {
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        const newQty = item.quantite + delta;
        if (newQty > item.product.stock) {
          toast.error(`Stock insuffisant. Maximum : ${item.product.stock}`);
          return item;
        }
        return newQty > 0 ? { ...item, quantite: newQty } : null;
      }
      return item;
    }).filter(Boolean));
  }

  function removeFromCart(productId) {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  }

  const sousTotal = cart.reduce((sum, item) => {
    const prixEff = item.product.enPromo && item.product.prixPromo ? Number(item.product.prixPromo) : Number(item.product.prix);
    return sum + (prixEff * item.quantite);
  }, 0);

  async function handleValiderVente() {
    if (cart.length === 0) return;
    setLoading(true);
    try {
      const itemsPayload = cart.map(item => ({
        productId: item.product.id,
        quantite: item.quantite
      }));

      const res = await api.post("/admin/ventes/directe", {
        items: itemsPayload,
        clientNom: clientNom.trim() || "Client comptoir",
        clientTelephone: clientTelephone.trim() || "",
        moyenPaiement
      });

      setCompletedSale(res.data);
      setCart([]);
      setClientNom("");
      setClientTelephone("");
      load(); // Reload stock
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de la validation de la vente.");
    } finally {
      setLoading(false);
    }
  }

  function handlePrintTicket() {
    window.print();
  }

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, margin: 0, color: "var(--forest-dark)" }}>Caisse & Vente Directe</h1>
        <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 14 }}>
          Enregistrez les ventes physiques directes en boutique avec mise à jour immédiate du stock.
        </p>
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
          Panier de Caisse ({cart.reduce((sum, item) => sum + item.quantite, 0)})
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
          <div className="bs-pos-products-grid">
            {filteredProducts.map(p => {
              const inStock = p.stock > 0;
              const prixEff = p.enPromo && p.prixPromo ? Number(p.prixPromo) : Number(p.prix);

              return (
                <div
                  key={p.id}
                  onClick={() => inStock && addToCart(p)}
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
                    style={{ width: "100%", height: 110, objectFit: "cover", borderRadius: 10, marginBottom: 8 }}
                  />
                  <div>
                    <div style={{ fontSize: 11, color: "var(--forest)", fontWeight: 700, textTransform: "uppercase" }}>
                      {p.famille || "Produit"}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 13.5, color: "var(--ink)", height: 36, overflow: "hidden" }}>
                      {p.nom}
                    </div>
                    
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                      <div style={{ fontWeight: 800, fontSize: 14.5, color: "var(--forest-dark)" }}>
                        {fcfa(prixEff)} {p.unite ? <span style={{ fontSize: 11, fontWeight: 500, color: "var(--muted)" }}>/ {p.poids && p.poids !== "1" ? `${p.poids} ` : ""}{p.unite}</span> : ""}
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: inStock ? "#1F4D3A" : "#B4483A" }}>
                        {inStock ? `Stock: ${p.stock}` : "Épuisé"}
                      </span>
                    </div>
                  </div>

                  <button
                    disabled={!inStock}
                    style={{
                      marginTop: 10, width: "100%", background: inStock ? "var(--forest-light)" : "#F3F4F6",
                      color: inStock ? "var(--forest)" : "var(--muted)", border: "none",
                      padding: "7px", borderRadius: 8, fontWeight: 700, fontSize: 12,
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 6, cursor: inStock ? "pointer" : "not-allowed"
                    }}
                  >
                    <Plus size={14} /> Ajouter au panier
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT COLUMN: CASHIER CART & TICKET SUMMARY */}
        <div className={`bs-pos-cart-col bs-pos-cart-sticky ${mobileTab === "panier" ? "mobile-active" : "mobile-hidden"}`}>
          <div className="bs-panel" style={{ padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, borderBottom: "1px solid var(--line)", paddingBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <ShoppingCart size={20} color="var(--forest)" />
                <h3 style={{ margin: 0, fontSize: 17, color: "var(--forest-dark)" }}>Panier de Caisse</h3>
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
                  const prixEff = item.product.enPromo && item.product.prixPromo ? Number(item.product.prixPromo) : Number(item.product.prix);

                  return (
                    <div key={item.product.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: 8, background: "var(--paper)", borderRadius: 10, border: "1px solid var(--line)" }}>
                      <img 
                        src={item.product.imageUrl || "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=80&q=80"} 
                        alt={item.product.nom}
                        style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover" }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {item.product.nom}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--forest)", fontWeight: 700 }}>
                          {fcfa(prixEff)} x {item.quantite} = {fcfa(prixEff * item.quantite)}
                        </div>
                      </div>

                      {/* QUANTITY CONTROLS */}
                      <div style={{ display: "flex", alignItems: "center", gap: 4, background: "#fff", padding: "2px 6px", borderRadius: 8, border: "1px solid var(--line)" }}>
                        <button 
                          onClick={() => updateQty(item.product.id, -1)}
                          style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex" }}
                        >
                          <Minus size={14} color="var(--ink)" />
                        </button>
                        <span style={{ fontSize: 13, fontWeight: 700, minWidth: 16, textAlign: "center" }}>{item.quantite}</span>
                        <button 
                          onClick={() => updateQty(item.product.id, 1)}
                          style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex" }}
                        >
                          <Plus size={14} color="var(--ink)" />
                        </button>
                      </div>

                      <button 
                        onClick={() => removeFromCart(item.product.id)}
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

            {/* CUSTOMER INFO (OPTIONAL) */}
            <div style={{ borderTop: "1px solid var(--line)", paddingTop: 14, marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", marginBottom: 8 }}>
                Informations Vente & Client (Optionnel)
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
                  className="bs-input"
                  placeholder="Téléphone client"
                  value={clientTelephone}
                  onChange={(e) => setClientTelephone(e.target.value)}
                  style={{ fontSize: 12.5, height: 36 }}
                />
              </div>

              {/* PAYMENT METHOD */}
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", marginBottom: 6 }}>
                Moyen de paiement
              </div>
              <select
                className="bs-select"
                value={moyenPaiement}
                onChange={(e) => setMoyenPaiement(e.target.value)}
                style={{ fontSize: 13, height: 38 }}
              >
                <option value="cash">Espèces / Cash</option>
                <option value="mvola">Mvola</option>
                <option value="holam">Holam</option>
                <option value="carte">Carte Bancaire (TPE)</option>
              </select>
            </div>

            {/* TOTAL & SUBMIT */}
            <div style={{ background: "var(--paper)", padding: 14, borderRadius: 12, border: "1px solid var(--line)", marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>Total à Payer</span>
                <span style={{ fontSize: 22, fontWeight: 900, color: "var(--forest-dark)" }}>{fcfa(sousTotal)}</span>
              </div>
            </div>

            <button
              className="bs-btn-primary"
              style={{ width: "100%", height: 46, fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              disabled={cart.length === 0 || loading}
              onClick={handleValiderVente}
            >
              {loading ? (
                "Validation en cours..."
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

      {/* TICKET DE CAISSE MODAL / PRINT VIEW */}
      {completedSale && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 20
        }}>
          <div style={{
            background: "#fff", borderRadius: 16, padding: 24,
            maxWidth: 420, width: "100%", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.15)",
            fontFamily: "Courier, monospace, sans-serif"
          }}>

            {/* Header Ticket */}
            <div style={{ textAlign: "center", borderBottom: "1px dashed #64748B", paddingBottom: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: "#0F172A", letterSpacing: 1 }}>{storeName.toUpperCase()}</div>
              {boutique?.adresse && <div style={{ fontSize: 10.5, color: "#475569", marginTop: 2 }}>{boutique.adresse}</div>}
              {boutique?.telephone && <div style={{ fontSize: 10.5, color: "#475569", marginTop: 1 }}>Tél: {boutique.telephone}</div>}
              <div style={{ fontSize: 11, color: "#64748B", marginTop: 4 }}>TICKET DE CAISSE — VENTE DIRECTE</div>
              <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>
                N° #COM-B{String(completedSale.id).padStart(3, "0")}
              </div>
              <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>
                {new Date(completedSale.createdAt).toLocaleString("fr-FR")}
              </div>
            </div>

            {/* Client & Metadata Info */}
            <div style={{ fontSize: 11.5, color: "#334155", marginBottom: 12, lineHeight: 1.5 }}>
              <div><strong>Client :</strong> {completedSale.client?.nom || "Client comptoir"}</div>
              {completedSale.client?.telephone && completedSale.client.telephone !== "non_renseigne" && (
                <div><strong>Téléphone :</strong> {completedSale.client.telephone}</div>
              )}
              <div><strong>Caissier :</strong> {completedSale.employeAssigne?.nom || "Caisse"}</div>
              <div><strong>Paiement :</strong> {completedSale.moyenPaiement?.replace("_", " ").toUpperCase()}</div>
            </div>

            {/* Articles Table */}
            <div style={{ borderTop: "1px dashed #64748B", borderBottom: "1px dashed #64748B", padding: "10px 0", marginBottom: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "2.2fr 0.6fr 1fr 1fr", fontSize: 11, fontWeight: 800, color: "#0F172A", borderBottom: "1px solid #E2E8F0", paddingBottom: 4, marginBottom: 6 }}>
                <span>ARTICLE</span>
                <span style={{ textAlign: "center" }}>QTÉ</span>
                <span style={{ textAlign: "right" }}>PRIX U.</span>
                <span style={{ textAlign: "right" }}>TOTAL</span>
              </div>

              {completedSale.items?.map((it, idx) => {
                const pu = Number(it.prixUnitaire || it.product?.prix || 0);
                const totLine = pu * it.quantite;

                return (
                  <div key={idx} style={{ display: "grid", gridTemplateColumns: "2.2fr 0.6fr 1fr 1fr", fontSize: 11.5, color: "#1E293B", marginBottom: 5 }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {it.product?.nom || "Produit"}
                    </span>
                    <span style={{ textAlign: "center" }}>{it.quantite}</span>
                    <span style={{ textAlign: "right" }}>{pu.toFixed(2)} €</span>
                    <span style={{ textAlign: "right", fontWeight: 700 }}>{totLine.toFixed(2)} €</span>
                  </div>
                );
              })}
            </div>

            {/* Total */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "#1E293B", marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 900, color: "#0F172A" }}>
                <span>TOTAL RÉGLÉ :</span>
                <span>{fcfa(completedSale.total)}</span>
              </div>
            </div>

            {/* Footer Message */}
            <div style={{ textAlign: "center", fontSize: 11, color: "#64748B", borderTop: "1px dashed #64748B", paddingTop: 10, marginBottom: 16 }}>
              Merci de votre visite !<br />À très bientôt chez {storeName}.
            </div>

            {/* Action Buttons */}
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={handlePrintTicket}
                style={{ flex: 1, padding: "10px", borderRadius: 8, background: "var(--forest)", color: "#fff", border: "none", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: "sans-serif" }}
              >
                <Printer size={16} /> Imprimer Ticket
              </button>
              <button
                onClick={() => setCompletedSale(null)}
                style={{ flex: 1, padding: "10px", borderRadius: 8, background: "#F1F5F9", border: "1px solid #CBD5E1", color: "#334155", fontWeight: 700, cursor: "pointer", fontFamily: "sans-serif" }}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
