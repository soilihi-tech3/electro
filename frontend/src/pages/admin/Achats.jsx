import React, { useEffect, useState } from "react";
import { PlusCircle, ShoppingBag, Building, DollarSign, Calendar, Package, X, CheckCircle, AlertCircle, Search } from "lucide-react";
import api from "../../api";
import TablePagination from "../../components/TablePagination";

import { formatPrice as fcfa } from "../../utils/currency.js";

export default function Achats() {
  const [achats, setAchats] = useState([]);
  const [products, setProducts] = useState([]);
  const [fournisseurs, setFournisseurs] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    productId: "", fournisseurId: "", quantite: 1, prixAchatUnitaire: "", notes: ""
  });
  const [erreur, setErreur] = useState("");
  const [succes, setSucces] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  function load() {
    api.get("/admin/achats").then(res => setAchats(res.data || []));
    api.get("/admin/products").then(res => setProducts(res.data || []));
    api.get("/admin/fournisseurs").then(res => setFournisseurs(res.data || []));
  }

  useEffect(load, []);

  const filteredAchats = achats.filter(a => {
    const q = search.trim().toLowerCase();
    const prodName = a.product?.nom?.toLowerCase() || "";
    const fournName = a.fournisseur?.nom?.toLowerCase() || "";
    return !q || prodName.includes(q) || fournName.includes(q);
  });

  const totalDepensesAchats = filteredAchats.reduce((sum, a) => sum + Number(a.totalAchat || 0), 0);

  function openModal() {
    setForm({ productId: products[0]?.id || "", fournisseurId: "", quantite: 1, prixAchatUnitaire: "", notes: "" });
    setErreur("");
    setSucces("");
    setModalOpen(true);
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.productId) {
      setErreur("Veuillez sélectionner un produit.");
      return;
    }
    setErreur("");
    setSucces("");
    try {
      await api.post("/admin/achats", form);
      setSucces("Approvisionnement enregistré et stock mis à jour avec succès !");
      setTimeout(() => { setModalOpen(false); load(); }, 900);
    } catch (err) {
      setErreur(err.response?.data?.message || "Erreur lors de l'enregistrement de l'achat.");
    }
  }

  return (
    <>
      <div className="bs-toolbar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 26, margin: 0, color: "var(--forest-dark)" }}>Achats & Approvisionnements</h1>
          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 14 }}>
            Enregistrez les achats auprès des fournisseurs, suivez les prix d'achat et mettez à jour les stocks.
          </p>
        </div>
        <button className="bs-btn-primary" style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 12 }} onClick={openModal}>
          <PlusCircle size={18} /> Nouvel Achat / Restock
        </button>
      </div>

      {/* KPI SUMMARY CARDS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 20 }}>
        <div className="bs-panel" style={{ padding: 18, display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ background: "var(--forest-light)", color: "var(--forest)", borderRadius: 12, padding: 12 }}>
            <ShoppingBag size={22} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase" }}>Total Achats</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--ink)" }}>{filteredAchats.length}</div>
          </div>
        </div>

        <div className="bs-panel" style={{ padding: 18, display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ background: "#FEF3C7", color: "#D97706", borderRadius: 12, padding: 12 }}>
            <DollarSign size={22} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: "#B45309", fontWeight: 600, textTransform: "uppercase" }}>Dépenses Totales d'Achat</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#92400E" }}>{fcfa(totalDepensesAchats)}</div>
          </div>
        </div>
      </div>

      {/* SEARCH BAR */}
      <div className="bs-panel" style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ position: "relative", maxWidth: 400 }}>
          <Search size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
          <input
            className="bs-input"
            placeholder="Rechercher par produit ou fournisseur..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 38, borderRadius: 10, fontSize: 13.5, height: 38 }}
          />
        </div>
      </div>

      {/* ACHATS TABLE */}
      <div className="bs-panel" style={{ padding: 0, overflow: "hidden" }}>
        <table className="bs-table" style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--paper)", borderBottom: "1px solid var(--line)", textAlign: "left" }}>
              <th style={{ padding: "14px 18px", fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Date</th>
              <th style={{ padding: "14px 18px", fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Produit</th>
              <th style={{ padding: "14px 18px", fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Fournisseur</th>
              <th style={{ padding: "14px 18px", fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Quantité</th>
              <th style={{ padding: "14px 18px", fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Prix Achat Unitaire</th>
              <th style={{ padding: "14px 18px", fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", textAlign: "right" }}>Coût Total</th>
            </tr>
          </thead>
          <tbody>
            {filteredAchats.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 36, textAlign: "center", color: "var(--muted)", fontSize: 14 }}>
                  Aucun achat / réapprovisionnement enregistré.
                </td>
              </tr>
            ) : (
              filteredAchats.slice((currentPage - 1) * pageSize, currentPage * pageSize).map(a => {
                const dateFormatted = new Date(a.createdAt || a.dateAchat).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

                return (
                  <tr key={a.id} style={{ borderBottom: "1px solid var(--line)" }}>
                    <td style={{ padding: "14px 18px" }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{dateFormatted}</div>
                    </td>

                    <td style={{ padding: "14px 18px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <img src={a.product?.imageUrl || "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=60&q=80"} alt={a.product?.nom} style={{ width: 34, height: 34, borderRadius: 6, objectFit: "cover" }} />
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13.5, color: "var(--ink)" }}>{a.product?.nom || "Produit supprimé"}</div>
                          <div style={{ fontSize: 11.5, color: "var(--muted)" }}>Nouveau Stock: {a.product?.stock}</div>
                        </div>
                      </div>
                    </td>

                    <td style={{ padding: "14px 18px" }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: a.fournisseur ? "var(--forest-dark)" : "var(--muted)" }}>
                        {a.fournisseur?.nom || "Non spécifié (Achat direct)"}
                      </div>
                    </td>

                    <td style={{ padding: "14px 18px" }}>
                      <span style={{ background: "var(--forest-light)", color: "var(--forest-dark)", padding: "4px 10px", borderRadius: 12, fontSize: 12.5, fontWeight: 800 }}>
                        +{a.quantite}
                      </span>
                    </td>

                    <td style={{ padding: "14px 18px" }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)" }}>
                        {fcfa(a.prixAchatUnitaire)}
                      </div>
                    </td>

                    <td style={{ padding: "14px 18px", textAlign: "right" }}>
                      <div style={{ fontWeight: 800, fontSize: 14.5, color: "var(--forest-dark)" }}>
                        {fcfa(a.totalAchat)}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        <TablePagination
          totalItems={filteredAchats.length}
          currentPage={currentPage}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(sz) => { setPageSize(sz); setCurrentPage(1); }}
        />
      </div>

      {/* MODAL NOUVEL ACHAT */}
      {modalOpen && (
        <div className="bs-modal-bg" onClick={() => setModalOpen(false)}>
          <div className="bs-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520, width: "90%" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 18, color: "var(--forest-dark)" }}>
                Enregistrer un Achat / Restock
              </h2>
              <button onClick={() => setModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                <X size={20} />
              </button>
            </div>

            {erreur && (
              <div style={{ background: "#FDF2F0", color: "#B4483A", padding: "10px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600, marginBottom: 14 }}>
                <AlertCircle size={16} /> {erreur}
              </div>
            )}
            {succes && (
              <div style={{ background: "#EBF7F0", color: "#1F4D3A", padding: "10px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600, marginBottom: 14 }}>
                <CheckCircle size={16} /> {succes}
              </div>
            )}

            <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="bs-field">
                <label style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: 4 }}>Sélectionner le Produit *</label>
                <select
                  className="bs-select"
                  value={form.productId}
                  onChange={(e) => {
                    const selectedProd = products.find(p => p.id === Number(e.target.value));
                    setForm({
                      ...form,
                      productId: e.target.value,
                      prixAchatUnitaire: selectedProd?.coutAchat || form.prixAchatUnitaire
                    });
                  }}
                  required
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8 }}
                >
                  <option value="">Sélectionnez un produit</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.nom} (Stock actuel: {p.stock})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="bs-field">
                  <label style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: 4 }}>Quantité achetée (+ stock) *</label>
                  <input className="bs-input" type="number" min="1" value={form.quantite} onChange={(e) => setForm({ ...form, quantite: Math.max(1, Number(e.target.value)) })} required />
                </div>

                <div className="bs-field">
                  <label style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: 4 }}>Prix d'Achat Unitaire (€) *</label>
                  <input className="bs-input" type="number" step="0.01" min="0" value={form.prixAchatUnitaire} onChange={(e) => setForm({ ...form, prixAchatUnitaire: e.target.value })} placeholder="ex: 12.50" required />
                </div>
              </div>

              <div className="bs-field">
                <label style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: 4 }}>Fournisseur (Facultatif)</label>
                <select
                  className="bs-select"
                  value={form.fournisseurId}
                  onChange={(e) => setForm({ ...form, fournisseurId: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8 }}
                >
                  <option value="">Aucun (Fournisseur non spécifié)</option>
                  {fournisseurs.map(f => (
                    <option key={f.id} value={f.id}>{f.nom}</option>
                  ))}
                </select>
              </div>

              <div className="bs-field">
                <label style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: 4 }}>Notes & Numéro de facture / Bon d'achat</label>
                <textarea className="bs-input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="ex: Bon de livraison #BL-9921" />
              </div>

              {/* CALCUATED TOTAL PREVIEW */}
              <div style={{ background: "var(--paper)", padding: 12, borderRadius: 10, border: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)" }}>Coût Total de l'Achat :</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: "var(--forest-dark)" }}>
                  {fcfa((Number(form.quantite) || 0) * (Number(form.prixAchatUnitaire) || 0))}
                </span>
              </div>

              <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
                <button type="button" onClick={() => setModalOpen(false)} style={{ flex: 1, padding: "12px", borderRadius: 10, border: "1px solid var(--line)", background: "#fff", fontWeight: 600, cursor: "pointer" }}>
                  Annuler
                </button>
                <button type="submit" className="bs-btn-primary" style={{ flex: 1, borderRadius: 10 }}>
                  Enregistrer l'Achat
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
