import { SkeletonTableRows } from "../../components/Skeleton.jsx";
import React, { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { PlusCircle, List, Pencil, Trash2, AlertTriangle, CheckCircle, Package, X } from "lucide-react";
import api from "../../api";
import ImageUploader from "../../components/ImageUploader.jsx";
import TablePagination from "../../components/TablePagination.jsx";

import { subscribeRealtime } from "../../utils/realtime.js";

import { formatPrice as fcfa } from "../../utils/currency.js";

export default function AdminProduits() {
  const [activeTab, setActiveTab] = useState("liste"); // "liste" | "ajout"
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [familles, setFamilles] = useState([]);
  const [unites, setUnites] = useState([]);
  const [fournisseurs, setFournisseurs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);

  
  // États de filtre
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("");
  const [filterStock, setFilterStock] = useState(false);

  // Modal d'approvisionnement
  const [restockProduct, setRestockProduct] = useState(null);
  const [restockForm, setRestockForm] = useState({
    fournisseurId: "",
    quantite: 10,
    prixAchatUnitaire: 0,
    notes: ""
  });
  const [restockSubmitting, setRestockSubmitting] = useState(false);

  const initialForm = {
    nom: "",
    categoryId: "",
    famille: "Alimentation",
    description: "",
    prix: "",
    prixPromo: "",
    enPromo: false,
    isNouveau: false,
    noteEtoiles: "5",
    poids: "1",
    unite: "Kg",
    coutAchat: "",
    stock: "",
    seuilAlerte: 5,
    imageUrl: "",
    imageUrl2: ""
  };
  const [form, setForm] = useState(initialForm);

  function silentSyncProducts() {
    api.get("/admin/products").then((res) => setProducts(res.data)).catch(() => {});
    api.get("/admin/categories").then((res) => setCategories(res.data)).catch(() => {});
    api.get("/admin/familles").then((res) => setFamilles(res.data || [])).catch(() => {});
    api.get("/admin/unites").then((res) => setUnites(res.data || [])).catch(() => {});
    api.get("/admin/fournisseurs").then((res) => setFournisseurs(res.data || [])).catch(() => {});
  }

  function load() {
    setLoading(true);
    api.get("/admin/products").then((res) => setProducts(res.data)).finally(() => setLoading(false));
    api.get("/admin/categories").then((res) => setCategories(res.data));
    api.get("/admin/familles").then((res) => setFamilles(res.data || [])).catch(() => {});
    api.get("/admin/unites").then((res) => setUnites(res.data || [])).catch(() => {});
    api.get("/admin/fournisseurs").then((res) => setFournisseurs(res.data || [])).catch(() => {});
  }

  useEffect(() => {
    load();
    const unsub = subscribeRealtime((detail) => {
      if (detail.type === "product_updated" || detail.type === "category_updated") {
        silentSyncProducts();
      }
    });
    return () => unsub();
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  function showToast(msg, type = "success") {
    if (type === "success") {
      toast.success(msg);
    } else {
      toast.error(msg);
    }
  }

  function startEdit(product) {
    setEditingId(product.id);
    setForm({
      nom: product.nom || "",
      categoryId: product.categoryId || "",
      famille: product.famille || "Alimentation",
      description: product.description || "",
      prix: product.prix ?? "",
      prixPromo: product.prixPromo ?? "",
      enPromo: Boolean(product.enPromo || product.prixPromo),
      isNouveau: Boolean(product.isNouveau),
      noteEtoiles: product.noteEtoiles !== undefined && product.noteEtoiles !== null ? String(product.noteEtoiles) : "5",
      poids: product.poids || "1",
      unite: product.unite || "Kg",
      coutAchat: product.coutAchat ?? "",
      stock: product.stock ?? "",
      seuilAlerte: product.seuilAlerte ?? 5,
      imageUrl: product.imageUrl || "",
      imageUrl2: product.imageUrl2 || ""
    });
    setActiveTab("ajout");
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(initialForm);
    setActiveTab("liste");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.nom || !form.categoryId) return;

    // Sanitize: empty string → 0 or null
    const payload = {
      ...form,
      prix: form.prix !== "" ? Number(form.prix) : 0,
      prixPromo: form.enPromo && form.prixPromo !== "" && form.prixPromo !== null ? Number(form.prixPromo) : null,
      enPromo: Boolean(form.enPromo),
      isNouveau: Boolean(form.isNouveau),
      noteEtoiles: form.noteEtoiles !== "" ? Number(form.noteEtoiles) : 5.0,
      coutAchat: form.coutAchat !== "" ? Number(form.coutAchat) : 0,
      stock: form.stock !== "" ? Number(form.stock) : 0,
      seuilAlerte: form.seuilAlerte !== "" ? Number(form.seuilAlerte) : 5,
      categoryId: Number(form.categoryId),
      poids: form.poids || "1",
      famille: form.famille || "Électronique"
    };

    try {
      if (editingId) {
        const res = await api.put(`/admin/products/${editingId}`, payload);
        const updated = res.data;
        const matchingCat = categories.find(c => String(c.id) === String(payload.categoryId));
        setProducts((prev) =>
          prev.map((p) =>
            p.id === editingId
              ? { ...p, ...payload, Category: matchingCat || p.Category, id: editingId }
              : p
          )
        );
        showToast("Produit modifié avec succès !");
      } else {
        const res = await api.post("/admin/products", payload);
        const created = res.data;
        const matchingCat = categories.find(c => String(c.id) === String(payload.categoryId));
        const newProductItem = created && created.id ? { ...created, Category: matchingCat } : { ...payload, id: Date.now(), Category: matchingCat };
        setProducts((prev) => [newProductItem, ...prev]);
        showToast("Nouveau produit ajouté et achat initial enregistré !");
      }
      setEditingId(null);
      setForm(initialForm);
      setActiveTab("liste");
      silentSyncProducts();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Erreur inconnue.";
      showToast("Erreur : " + msg);
    }
  }

  async function deleteProduct(id) {
    if (!confirm("Voulez-vous vraiment supprimer ce produit ?")) return;
    setProducts((prev) => prev.filter((p) => p.id !== id));
    try {
      await api.delete(`/admin/products/${id}`);
      showToast("Produit supprimé.");
      silentSyncProducts();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Erreur inconnue.";
      showToast("Erreur lors de la suppression : " + msg);
      load(); // Revert on failure
    }
  }

  function openRestockModal(product) {
    setRestockProduct(product);
    setRestockForm({
      fournisseurId: product.fournisseurId || "",
      quantite: 10,
      prixAchatUnitaire: product.coutAchat || 0,
      notes: ""
    });
  }

  async function handleRestockSubmit(e) {
    e.preventDefault();
    if (!restockProduct) return;
    setRestockSubmitting(true);
    try {
      await api.post("/admin/achats", {
        productId: restockProduct.id,
        fournisseurId: restockForm.fournisseurId ? Number(restockForm.fournisseurId) : null,
        quantite: Number(restockForm.quantite),
        prixAchatUnitaire: Number(restockForm.prixAchatUnitaire),
        notes: restockForm.notes || `Approvisionnement direct pour ${restockProduct.nom}`
      });
      showToast(`Approvisionnement réussi ! (+${restockForm.quantite} en stock pour ${restockProduct.nom})`);
      setProducts((prev) =>
        prev.map((p) =>
          p.id === restockProduct.id
            ? { ...p, stock: Number(p.stock) + Number(restockForm.quantite) }
            : p
        )
      );
      setRestockProduct(null);
      silentSyncProducts();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Erreur lors de l'approvisionnement.";
      showToast("Erreur : " + msg);
    } finally {
      setRestockSubmitting(false);
    }
  }

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Filter products by search query, category, low stock
  const filteredProducts = products.filter((p) => {
    const matchSearch = !search || p.nom?.toLowerCase().includes(search.toLowerCase());
    const matchCat = !filterCat || String(p.categoryId) === String(filterCat);
    const matchStock = !filterStock || p.stock <= p.seuilAlerte;

    return matchSearch && matchCat && matchStock;
  });

  // Reset page to 1 when filters change
  useEffect(() => { setCurrentPage(1); }, [search, filterCat, filterStock]);

  const totalItems = filteredProducts.length;
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 26, margin: 0, color: "var(--forest-dark)" }}>Gestion des Produits</h1>
          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 14 }}>
            Consultez votre inventaire ou ajoutez de nouveaux articles à la boutique.
          </p>
        </div>

        {/* TABS DE NAVIGATION */}
        <div style={{ display: "flex", gap: 8, background: "var(--paper)", padding: 4, borderRadius: 30, border: "1px solid var(--line)" }}>
          <button
            className={`bs-btn-primary ${activeTab === "liste" ? "" : "inactive"}`}
            style={{
              padding: "8px 18px",
              borderRadius: 24,
              fontSize: 13,
              background: activeTab === "liste" ? "var(--forest)" : "transparent",
              color: activeTab === "liste" ? "#fff" : "var(--muted)",
              boxShadow: "none"
            }}
            onClick={() => { setEditingId(null); setForm(initialForm); setActiveTab("liste"); }}
          >
            <List size={15} style={{ verticalAlign: "-2px", marginRight: 6 }} /> Liste des produits ({products.length})
          </button>
          <button
            className={`bs-btn-primary ${activeTab === "ajout" ? "" : "inactive"}`}
            style={{
              padding: "8px 18px",
              borderRadius: 24,
              fontSize: 13,
              background: activeTab === "ajout" ? "var(--forest)" : "transparent",
              color: activeTab === "ajout" ? "#fff" : "var(--muted)",
              boxShadow: "none"
            }}
            onClick={() => {
              if (!editingId) { setForm(initialForm); }
              setActiveTab("ajout");
            }}
          >
            <PlusCircle size={15} style={{ verticalAlign: "-2px", marginRight: 6 }} /> {editingId ? "Modifier le produit" : "Ajouter un produit"}
          </button>
        </div>
      </div>



      {/* CONTENUS DES ONGLETS */}
      {activeTab === "liste" && (
        <div className="bs-panel" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ background: "var(--paper)", padding: "16px 20px", borderBottom: "1px solid var(--line)" }}>
            <div style={{ display: "flex", gap: 24, marginBottom: 16, flexWrap: "wrap" }}>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 12, color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>Total Produits</span>
                <span style={{ fontSize: 24, fontWeight: 800, color: "var(--ink)" }}>{products.length}</span>
              </div>
              <div style={{ width: 1, background: "var(--line)" }}></div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 12, color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>Résultats</span>
                <span style={{ fontSize: 24, fontWeight: 800, color: "var(--ink)" }}>{filteredProducts.length}</span>
              </div>
              <div style={{ width: 1, background: "var(--line)" }}></div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 12, color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>Alertes Stock</span>
                <span style={{ fontSize: 24, fontWeight: 800, color: "#B4483A" }}>{products.filter(p => p.stock <= p.seuilAlerte).length}</span>
              </div>
              <div style={{ width: 1, background: "var(--line)" }}></div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 12, color: "#D97706", textTransform: "uppercase", fontWeight: 700 }}>Bientôt Expirés</span>
                <span style={{ fontSize: 24, fontWeight: 800, color: "#D97706" }}>{bientotExpiresCount}</span>
              </div>
              <div style={{ width: 1, background: "var(--line)" }}></div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 12, color: "#DC2626", textTransform: "uppercase", fontWeight: 700 }}>Déjà Expirés</span>
                <span style={{ fontSize: 24, fontWeight: 800, color: "#DC2626" }}>{expiresCount}</span>
              </div>
            </div>
            
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <input 
                className="bs-input" 
                style={{ flex: 1, minWidth: 200 }} 
                placeholder="🔍 Rechercher un produit..." 
                value={search} 
                onChange={(e) => setSearch(e.target.value)} 
              />
              <select 
                className="bs-select" 
                style={{ width: 180 }} 
                value={filterCat} 
                onChange={(e) => setFilterCat(e.target.value)}
              >
                <option value="">Toutes les catégories</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>



              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, cursor: "pointer", background: filterStock ? "#FAD2CD" : "var(--forest-light)", padding: "0 12px", borderRadius: 8, color: filterStock ? "#B4483A" : "var(--forest-dark)", fontWeight: 700, height: 40 }}>
                <input type="checkbox" checked={filterStock} onChange={(e) => setFilterStock(e.target.checked)} style={{ margin: 0 }} />
                Stock faible
              </label>
            </div>
          </div>

          <table className="bs-table">
            <thead>
              <tr>
                <th>Photo</th>
                <th>Nom du produit</th>
                <th>Catégorie / Fournisseur</th>
                <th>Prix de vente</th>
                <th>Coût d'achat</th>
                <th>Stock</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <SkeletonTableRows rows={6} cols={7} />
              )}
              {!loading && paginatedProducts.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>
                    Aucun produit ne correspond à votre recherche.
                  </td>
                </tr>
              )}
              {!loading && paginatedProducts.map((p) => {
                const supplierName = p.fournisseur ? (p.fournisseur.nom || p.fournisseur.nomCompany || p.fournisseur.nomContact) : null;
                return (
                  <tr key={p.id}>
                    <td style={{ width: 60 }}>
                      <img
                        src={p.imageUrl || "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=100&q=80"}
                        alt={p.nom}
                        style={{ width: 46, height: 46, borderRadius: 8, objectFit: "cover", border: "1px solid var(--line)" }}
                      />
                    </td>
                    <td style={{ fontWeight: 700, color: "var(--ink)" }}>
                      <div>{p.nom}</div>
                      <div style={{ fontSize: 11.5, color: "#F59E0B", marginTop: 2, display: "flex", alignItems: "center", gap: 3 }}>
                        ⭐ <strong>{(p.avis?.length ? (p.avis.reduce((s, a) => s + a.note, 0) / p.avis.length) : (p.noteEtoiles !== undefined && p.noteEtoiles !== null ? Number(p.noteEtoiles) : 5.0)).toFixed(1)}</strong>
                        <span style={{ color: "var(--muted)", fontWeight: 400 }}>({p.avis?.length || 0} avis)</span>
                      </div>
                    </td>
                    <td>
                      <span style={{ background: "var(--forest-light)", color: "var(--forest-dark)", padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700, border: "1px solid var(--line)" }}>
                        {p.Category?.nom || "Non classé"}
                      </span>
                      {supplierName && (
                        <div style={{ fontSize: 11, color: "var(--forest-dark)", fontWeight: 600, marginTop: 4 }}>
                          Fournisseur: {supplierName}
                        </div>
                      )}
                    </td>
                    <td>
                      {p.prixPromo ? (
                        <>
                          <span style={{ textDecoration: "line-through", color: "var(--muted)", marginRight: 6, fontSize: 13 }}>{fcfa(p.prix)}</span>
                          <span style={{ color: "var(--accent)", fontWeight: 700 }}>{fcfa(p.prixPromo)}</span>
                        </>
                      ) : (
                        <span style={{ fontWeight: 700 }}>{fcfa(p.prix)}</span>
                      )}
                      <span style={{ color: "var(--muted)", fontSize: 12 }}> / {p.poids && p.poids !== "1" ? `${p.poids} ` : ""}{p.unite}</span>
                    </td>
                    <td style={{ color: "var(--muted)" }}>{fcfa(p.coutAchat || 0)}</td>
                    <td className={p.stock <= p.seuilAlerte ? "bs-stock-low" : ""}>
                      <span style={{ fontWeight: 700 }}>{p.stock}</span> {p.unite}
                      {p.stock <= p.seuilAlerte && <AlertTriangle size={14} color="#B4483A" style={{ marginLeft: 6, verticalAlign: "-2px" }} />}
                    </td>

                    <td>
                      <button
                        className="bs-icon-btn"
                        title="Approvisionner (Réappro stock)"
                        style={{ color: "var(--forest)", marginRight: 4 }}
                        onClick={() => openRestockModal(p)}
                      >
                        <Package size={15} />
                      </button>
                      <button className="bs-icon-btn" title="Modifier" onClick={() => startEdit(p)}><Pencil size={15} /></button>{" "}
                      <button className="bs-icon-btn" title="Supprimer" style={{ color: "#B4483A" }} onClick={() => deleteProduct(p.id)}><Trash2 size={15} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* TABLE PAGINATION */}
          <TablePagination
            totalItems={totalItems}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      {activeTab === "ajout" && (
        <div className="bs-panel" style={{ maxWidth: 780, margin: "0 auto" }}>
          <h3 style={{ marginTop: 0, fontSize: 20, color: "var(--forest-dark)", borderBottom: "1px solid var(--line)", paddingBottom: 12, marginBottom: 20 }}>
            {editingId ? "Modifier le produit" : "Formulaire d'ajout de produit"}
          </h3>

          <form onSubmit={handleSubmit} className="bs-auth-form" style={{ gap: 16 }}>
            <div className="bs-input-group">
              <label>Nom du produit *</label>
              <input
                className="bs-input"
                required
                placeholder="ex: Mangues Kent de Thiès"
                value={form.nom}
                onChange={(e) => set("nom", e.target.value)}
              />
            </div>

            <div className="bs-form-row-4">
              <div className="bs-input-group">
                <label>Catégorie *</label>
                <select
                  className="bs-select"
                  required
                  value={form.categoryId}
                  onChange={(e) => {
                    const catId = Number(e.target.value);
                    const selectedCat = categories.find(c => c.id === catId);
                    set("categoryId", catId);
                    if (selectedCat && selectedCat.famille) {
                      set("famille", selectedCat.famille);
                    }
                  }}
                >
                  <option value="">-- Sélectionner --</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.nom} ({c.famille || "Général"})</option>
                  ))}
                </select>
              </div>

              <div className="bs-input-group">
                <label>Famille *</label>
                <select
                  className="bs-select"
                  required
                  value={form.famille}
                  onChange={(e) => set("famille", e.target.value)}
                >
                  {familles.map((f) => (
                    <option key={f.id} value={f.nom}>{f.nom}</option>
                  ))}
                  {!familles.some(f => f.nom === form.famille) && form.famille && (
                    <option value={form.famille}>{form.famille}</option>
                  )}
                </select>
              </div>

              <div className="bs-input-group">
                <label>Poids / Qté *</label>
                <input
                  className="bs-input"
                  placeholder="ex: 1, 1.5, 500"
                  value={form.poids}
                  onChange={(e) => set("poids", e.target.value)}
                />
              </div>

              <div className="bs-input-group">
                <label>Unité de vente *</label>
                <select
                  className="bs-select"
                  value={form.unite}
                  onChange={(e) => set("unite", e.target.value)}
                >
                  <option value="">-- Sélectionner --</option>
                  {unites.map((u) => (
                    <option key={u.id} value={u.abbreviation || u.nom}>
                      {u.nom} ({u.abbreviation || u.nom})
                    </option>
                  ))}
                  {form.unite && !unites.some(u => (u.abbreviation || u.nom) === form.unite) && (
                    <option value={form.unite}>{form.unite}</option>
                  )}
                </select>
              </div>
            </div>

            {/* SECTION CLASSEMENT NOUVEAUTÉ ET ÉTOILES */}
            <div style={{ background: "var(--paper)", padding: 16, borderRadius: 12, border: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input
                  type="checkbox"
                  id="isNouveau"
                  checked={form.isNouveau}
                  onChange={(e) => set("isNouveau", e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: "var(--forest)", cursor: "pointer" }}
                />
                <div>
                  <label htmlFor="isNouveau" style={{ fontWeight: 700, fontSize: 13.5, color: "var(--forest-dark)", cursor: "pointer", margin: 0 }}>
                    Marquer comme NOUVEAU produit (Nouveauté) ?
                  </label>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                    Si cette option est activée, le produit apparaîtra dans la section "Nouveaux Produits" sur la page d'accueil avec un badge NOUVEAU.
                  </div>
                </div>
              </div>

              <div style={{ borderTop: "1px solid var(--line)", paddingTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                <div>
                  <label htmlFor="noteEtoiles" style={{ fontWeight: 700, fontSize: 13.5, color: "var(--forest-dark)", display: "block" }}>
                    ⭐ Étoiles du produit (Note par défaut)
                  </label>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                    Attribuez une note initiale entre 1 et 5 étoiles (ex: 5 étoiles pour une qualité maximale).
                  </div>
                </div>
                <select
                  id="noteEtoiles"
                  className="bs-select"
                  style={{ width: 150, fontWeight: 700 }}
                  value={form.noteEtoiles}
                  onChange={(e) => set("noteEtoiles", e.target.value)}
                >
                  <option value="5">⭐⭐⭐⭐⭐ (5.0 / 5)</option>
                  <option value="4.5">⭐⭐⭐⭐½ (4.5 / 5)</option>
                  <option value="4">⭐⭐⭐⭐ (4.0 / 5)</option>
                  <option value="3.5">⭐⭐⭐½ (3.5 / 5)</option>
                  <option value="3">⭐⭐⭐ (3.0 / 5)</option>
                  <option value="2.5">⭐⭐½ (2.5 / 5)</option>
                  <option value="2">⭐⭐ (2.0 / 5)</option>
                  <option value="1">⭐ (1.0 / 5)</option>
                </select>
              </div>
            </div>

            {/* PROMO & EXPIRATION SECTION */}
            <div style={{ background: "var(--paper)", padding: 16, borderRadius: 12, border: "1px solid var(--line)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <input
                  type="checkbox"
                  id="enPromo"
                  checked={form.enPromo}
                  onChange={(e) => set("enPromo", e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: "var(--forest)", cursor: "pointer" }}
                />
                <label htmlFor="enPromo" style={{ fontWeight: 700, fontSize: 13.5, color: "var(--forest-dark)", cursor: "pointer", margin: 0 }}>
                  Activer une Promotion sur ce produit ?
                </label>
              </div>

              <div className="bs-form-row-3">
                <div className="bs-input-group">
                  <label>Prix Normal (€) *</label>
                  <input
                    className="bs-input"
                    type="number"
                    step="0.01"
                    required
                    placeholder="ex: 15.00"
                    value={form.prix}
                    onChange={(e) => set("prix", e.target.value)}
                  />
                </div>

                <div className="bs-input-group">
                  <label>Prix Promo (€)</label>
                  <input
                    className="bs-input"
                    type="number"
                    step="0.01"
                    disabled={!form.enPromo}
                    placeholder="ex: 12.50"
                    value={form.prixPromo}
                    onChange={(e) => set("prixPromo", e.target.value)}
                  />
                </div>

                <div className="bs-input-group">
                  <label>Réduction calculée</label>
                  <div style={{
                    height: 44, boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center",
                    padding: "0 14px", background: "#E0F2FE", borderRadius: 8, border: "1.5px solid #BAE6FD",
                    fontWeight: 800, color: "#0369A1", fontSize: 13.5, textAlign: "center"
                  }}>
                    {form.enPromo && form.prixPromo && Number(form.prix) > 0 ? (
                      `-${Math.round(((Number(form.prix) - Number(form.prixPromo)) / Number(form.prix)) * 100)} % de remise`
                    ) : (
                      "Aucune promo active"
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="bs-form-row-2">
              <div className="bs-input-group">
                <label>Stock disponible</label>
                <input
                  className="bs-input"
                  type="number"
                  placeholder="ex: 50"
                  value={form.stock}
                  onChange={(e) => set("stock", e.target.value)}
                />
              </div>

              <div className="bs-input-group">
                <label>Coût d'achat unitaire</label>
                <input
                  className="bs-input"
                  type="number"
                  step="0.01"
                  placeholder="ex: 8500"
                  value={form.coutAchat}
                  onChange={(e) => set("coutAchat", e.target.value)}
                />
              </div>
            </div>

            <div className="bs-input-group">
              <label>Description du produit</label>
              <textarea
                className="bs-input"
                style={{ minHeight: 80, resize: "vertical" }}
                placeholder="Décrivez le produit en quelques mots..."
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
              />
            </div>

            <ImageUploader
              label="Photo Principale"
              value={form.imageUrl}
              onChange={(url) => set("imageUrl", url)}
            />

            <ImageUploader
              label="Photo Secondaire (survol & galerie)"
              value={form.imageUrl2}
              onChange={(url) => set("imageUrl2", url)}
            />

            <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
              <button
                type="button"
                className="bs-btn-primary"
                style={{ background: "#E2E8E3", color: "var(--ink)", flex: 1 }}
                onClick={cancelEdit}
              >
                Annuler
              </button>
              <button
                type="submit"
                className="bs-btn-primary"
                style={{ flex: 2 }}
                disabled={!form.nom || !form.categoryId}
              >
                {editingId ? "Enregistrer les modifications" : "Créer le produit"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL APPROVISIONNEMENT */}
      {restockProduct && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.5)", zIndex: 999, display: "flex",
          alignItems: "center", justifyContent: "center", padding: 20
        }}>
          <div className="bs-panel" style={{ width: "100%", maxWidth: 520, background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, borderBottom: "1px solid var(--line)", paddingBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ background: "var(--forest-light)", padding: 8, borderRadius: 10, color: "var(--forest-dark)" }}>
                  <Package size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, color: "var(--forest-dark)" }}>Approvisionnement Produit</h3>
                  <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>{restockProduct.nom}</span>
                </div>
              </div>
              <button 
                onClick={() => setRestockProduct(null)} 
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)" }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleRestockSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ background: "#F8FAFC", padding: 12, borderRadius: 10, border: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span>Stock Actuel: <strong>{restockProduct.stock} {restockProduct.unite}</strong></span>
                <span>Coût d'achat: <strong>{fcfa(restockProduct.coutAchat || 0)}</strong></span>
              </div>

              <div className="bs-input-group">
                <label>Fournisseur</label>
                <select
                  className="bs-select"
                  value={restockForm.fournisseurId}
                  onChange={(e) => setRestockForm(f => ({ ...f, fournisseurId: e.target.value }))}
                >
                  <option value="">-- Sélectionner un fournisseur (Optionnel) --</option>
                  {fournisseurs.map(f => (
                    <option key={f.id} value={f.id}>{f.nom || f.nomCompany || f.nomContact}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div className="bs-input-group">
                  <label>Quantité à ajouter *</label>
                  <input
                    className="bs-input"
                    type="number"
                    min="1"
                    required
                    value={restockForm.quantite}
                    onChange={(e) => setRestockForm(f => ({ ...f, quantite: e.target.value }))}
                  />
                </div>

                <div className="bs-input-group">
                  <label>Prix d'achat unitaire (€) *</label>
                  <input
                    className="bs-input"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={restockForm.prixAchatUnitaire}
                    onChange={(e) => setRestockForm(f => ({ ...f, prixAchatUnitaire: e.target.value }))}
                  />
                </div>
              </div>

              <div style={{ background: "var(--forest-light)", padding: "10px 14px", borderRadius: 8, fontSize: 13, color: "var(--forest-dark)", fontWeight: 700, display: "flex", justifyContent: "space-between" }}>
                <span>Total de l'achat:</span>
                <span>{fcfa(Number(restockForm.quantite || 0) * Number(restockForm.prixAchatUnitaire || 0))}</span>
              </div>

              <div className="bs-input-group">
                <label>Notes / Référence facture (Optionnel)</label>
                <input
                  className="bs-input"
                  placeholder="ex: BL-2026-0917 ou Réapprovisionnement régulier"
                  value={restockForm.notes}
                  onChange={(e) => setRestockForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>

              <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                <button
                  type="button"
                  className="bs-btn-primary"
                  style={{ background: "#E2E8E3", color: "var(--ink)", flex: 1 }}
                  onClick={() => setRestockProduct(null)}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="bs-btn-primary"
                  style={{ flex: 2 }}
                  disabled={restockSubmitting}
                >
                  {restockSubmitting ? "Enregistrement..." : "Valider l'Approvisionnement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

