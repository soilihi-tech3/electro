import { SkeletonTableRows } from "../../components/Skeleton.jsx";
import React, { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { PlusCircle, List, Pencil, Trash2, AlertTriangle, CheckCircle, Package, X, Eye, EyeOff, Palette, Sparkles, Plus, Image as ImageIcon, Tag } from "lucide-react";
import api from "../../api";
import ImageUploader from "../../components/ImageUploader.jsx";
import TablePagination from "../../components/TablePagination.jsx";

import { subscribeRealtime } from "../../utils/realtime.js";

import { formatPrice as fcfa } from "../../utils/currency.js";
import { useAuth } from "../../context/AuthContext";

export default function AdminProduits() {
  const { hasPerm } = useAuth();
  const canManage = hasPerm("gerer_produits");
  const canRestock = hasPerm("gerer_achats") || canManage;

  const [activeTab, setActiveTab] = useState("liste"); // "liste" | "ajout"
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [familles, setFamilles] = useState([]);
  const [unites, setUnites] = useState([]);
  const [fournisseurs, setFournisseurs] = useState([]);
  const [marques, setMarques] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);

  
  // États de filtre
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("");
  const [filterStock, setFilterStock] = useState(false);
  const [filterEtat, setFilterEtat] = useState("");
  const [filterMarque, setFilterMarque] = useState("");

  // Modal d'approvisionnement
  const [restockProduct, setRestockProduct] = useState(null);
  const [restockSubmitting, setRestockSubmitting] = useState(false);
  const [restockForm, setRestockForm] = useState({
    fournisseurId: "",
    quantite: 10,
    prixAchatUnitaire: 0,
    notes: ""
  });
  // Modal de consultation des variantes & stocks
  const [viewVariantsProduct, setViewVariantsProduct] = useState(null);

  const initialForm = {
    nom: "",
    categoryId: "",
    famille: "Électronique",
    associerMarque: false,
    marqueId: "",
    etat: "neuf",
    description: "",
    prix: "",
    prixPromo: "",
    enPromo: false,
    isNouveau: false,
    noteEtoiles: "5",
    poids: "1",
    unite: "Pièce",
    coutAchat: "",
    stock: "",
    seuilAlerte: 5,
    imageUrl: "",
    imageUrl2: "",
    visibleEnLigne: true,
    dernierPrix: "",
    variantesCouleurs: [],
    optionTitre: "Senteur",
    variantesOptions: [],
    galeriePhotos: []
  };
  const [form, setForm] = useState(initialForm);

  function silentSyncProducts() {
    api.get("/admin/products").then((res) => setProducts(res.data)).catch(() => {});
    api.get("/admin/categories").then((res) => setCategories(res.data)).catch(() => {});
    api.get("/admin/familles").then((res) => setFamilles(res.data || [])).catch(() => {});
    api.get("/admin/unites").then((res) => setUnites(res.data || [])).catch(() => {});
    api.get("/admin/fournisseurs").then((res) => setFournisseurs(res.data || [])).catch(() => {});
    api.get("/admin/marques").then((res) => setMarques(res.data || [])).catch(() => {});
  }

  function load() {
    setLoading(true);
    api.get("/admin/products").then((res) => setProducts(res.data)).finally(() => setLoading(false));
    api.get("/admin/categories").then((res) => setCategories(res.data));
    api.get("/admin/familles").then((res) => setFamilles(res.data || [])).catch(() => {});
    api.get("/admin/unites").then((res) => setUnites(res.data || [])).catch(() => {});
    api.get("/admin/fournisseurs").then((res) => setFournisseurs(res.data || [])).catch(() => {});
    api.get("/admin/marques").then((res) => setMarques(res.data || [])).catch(() => {});
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

  async function toggleProductVisibility(p) {
    const nextVis = p.visibleEnLigne === false ? true : false;
    try {
      await api.put(`/admin/products/${p.id}`, { visibleEnLigne: nextVis });
      setProducts(prev => prev.map(item => item.id === p.id ? { ...item, visibleEnLigne: nextVis } : item));
      showToast(nextVis ? "Produit rendu visible sur le site !" : "Produit masqué du site (mode stock en attente).");
      silentSyncProducts();
    } catch (err) {
      showToast("Erreur lors de la modification de la visibilité : " + (err.response?.data?.message || err.message));
    }
  }

function parseJsonSafe(val, fallback) {
  if (!val) return fallback;
  if (typeof val === "object") return val;
  if (typeof val === "string") {
    try {
      const p = JSON.parse(val);
      return typeof p === "string" ? parseJsonSafe(p, fallback) : (p ?? fallback);
    } catch {
      return fallback;
    }
  }
  return fallback;
}

  function startEdit(product) {
    setEditingId(product.id);
    const parsedColors = parseJsonSafe(product.variantesCouleurs, []);
    const rawColors = Array.isArray(parsedColors) ? parsedColors : [];

    const parsedOptions = parseJsonSafe(product.variantesOptions, { titre: "Senteur", options: [] });
    let optTitle = "Senteur";
    let optList = [];
    if (parsedOptions && typeof parsedOptions === "object" && !Array.isArray(parsedOptions) && parsedOptions.options) {
      optTitle = parsedOptions.titre || "Senteur";
      optList = Array.isArray(parsedOptions.options) ? parsedOptions.options : [];
    } else if (Array.isArray(parsedOptions)) {
      optList = parsedOptions;
    }
    const parsedGallery = parseJsonSafe(product.galeriePhotos, []);
    const rawGallery = Array.isArray(parsedGallery) ? parsedGallery : [];

    setForm({
      nom: product.nom || "",
      categoryId: product.categoryId || "",
      famille: product.famille || "Électronique",
      associerMarque: Boolean(product.marqueId),
      marqueId: product.marqueId || "",
      etat: product.etat || "neuf",
      description: product.description || "",
      prix: product.prix ?? "",
      prixPromo: product.prixPromo ?? "",
      enPromo: Boolean(product.enPromo || product.prixPromo),
      isNouveau: Boolean(product.isNouveau),
      noteEtoiles: product.noteEtoiles !== undefined && product.noteEtoiles !== null ? String(product.noteEtoiles) : "5",
      poids: product.poids || "1",
      unite: product.unite || "Pièce",
      coutAchat: product.coutAchat ?? "",
      stock: product.stock ?? "",
      seuilAlerte: product.seuilAlerte ?? 5,
      imageUrl: product.imageUrl || "",
      imageUrl2: product.imageUrl2 || "",
      visibleEnLigne: product.visibleEnLigne !== false,
      dernierPrix: product.dernierPrix ?? "",
      variantesCouleurs: rawColors,
      optionTitre: optTitle,
      variantesOptions: optList,
      galeriePhotos: rawGallery
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

    const globalStock = form.stock !== "" ? Math.max(0, Number(form.stock)) : 0;
    const totalColorsStock = (form.variantesCouleurs || []).reduce((sum, c) => sum + (c.stock !== "" && c.stock !== undefined ? Math.max(0, Number(c.stock)) : 0), 0);
    const totalOptionsStock = (form.variantesOptions || []).reduce((sum, o) => sum + (o.stock !== "" && o.stock !== undefined ? Math.max(0, Number(o.stock)) : 0), 0);
    
    if (totalColorsStock > globalStock) {
      showToast(`Le stock total des couleurs (${totalColorsStock}) dépasse le stock global (${globalStock}). Veuillez ajuster la répartition.`, "error");
      return;
    }
    if (totalOptionsStock > globalStock) {
      showToast(`Le stock total des options/modèles (${totalOptionsStock}) dépasse le stock global (${globalStock}). Veuillez ajuster la répartition.`, "error");
      return;
    }

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
      marqueId: form.associerMarque && form.marqueId ? Number(form.marqueId) : null,
      etat: form.etat || "neuf",
      poids: form.poids || "1",
      famille: form.famille || "Électronique",
      visibleEnLigne: Boolean(form.visibleEnLigne),
      dernierPrix: form.dernierPrix !== "" ? Number(form.dernierPrix) : null,
      variantesCouleurs: form.variantesCouleurs || [],
      variantesOptions: {
        titre: form.optionTitre || "Senteur",
        options: form.variantesOptions || []
      },
      galeriePhotos: form.galeriePhotos || []
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

  // Filter products by search query, category, low stock, etat, marque
  const filteredProducts = products.filter((p) => {
    const matchSearch = !search || (
      p.nom?.toLowerCase().includes(search.toLowerCase()) ||
      p.Category?.nom?.toLowerCase().includes(search.toLowerCase()) ||
      p.marque?.nom?.toLowerCase().includes(search.toLowerCase())
    );
    const matchCat = !filterCat || String(p.categoryId) === String(filterCat);
    const matchStock = !filterStock || p.stock <= p.seuilAlerte;
    const matchEtat = !filterEtat || p.etat === filterEtat;
    const matchMarque = !filterMarque || String(p.marqueId) === String(filterMarque);

    return matchSearch && matchCat && matchStock && matchEtat && matchMarque;
  });

  // Reset page to 1 when filters change
  useEffect(() => { setCurrentPage(1); }, [search, filterCat, filterStock, filterEtat, filterMarque]);

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
          {canManage && (
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
          )}
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
            </div>
            
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <input 
                className="bs-input" 
                style={{ flex: 1, minWidth: 200 }} 
                placeholder="Rechercher un produit, catégorie ou marque..." 
                value={search} 
                onChange={(e) => setSearch(e.target.value)} 
              />
              <select 
                className="bs-select" 
                style={{ width: 170 }} 
                value={filterCat} 
                onChange={(e) => setFilterCat(e.target.value)}
              >
                <option value="">Toutes les catégories</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>

              <select 
                className="bs-select" 
                style={{ width: 150 }} 
                value={filterEtat} 
                onChange={(e) => setFilterEtat(e.target.value)}
              >
                <option value="">Tous les états</option>
                <option value="neuf">Neuf</option>
                <option value="occasion">Occasion</option>
              </select>

              <select 
                className="bs-select" 
                style={{ width: 170 }} 
                value={filterMarque} 
                onChange={(e) => setFilterMarque(e.target.value)}
              >
                <option value="">Toutes les marques</option>
                {marques.map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}
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
                <th>Nom & Marque</th>
                <th>Visibilité</th>
                <th>État</th>
                <th>Catégorie / Fournisseur</th>
                <th>Prix de vente</th>
                <th>Coût d'achat</th>
                <th>Stock</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <SkeletonTableRows rows={6} cols={9} />
              )}
              {!loading && paginatedProducts.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>
                    Aucun produit ne correspond à votre recherche.
                  </td>
                </tr>
              )}
              {!loading && paginatedProducts.map((p) => {
                const supplierName = p.fournisseur ? (p.fournisseur.nom || p.fournisseur.nomCompany || p.fournisseur.nomContact) : null;
                const marqueNom = p.marque?.nom || p.Marque?.nom;
                const isOnline = p.visibleEnLigne !== false;
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
                      {marqueNom && (
                        <div style={{ fontSize: 11.5, color: "var(--forest)", fontWeight: 700, marginTop: 2 }}>
                          Marque : {marqueNom}
                        </div>
                      )}
                      <div style={{ fontSize: 11.5, color: "#F59E0B", marginTop: 2, display: "flex", alignItems: "center", gap: 3 }}>
                        ⭐ <strong>{(p.avis?.length ? (p.avis.reduce((s, a) => s + a.note, 0) / p.avis.length) : (p.noteEtoiles !== undefined && p.noteEtoiles !== null ? Number(p.noteEtoiles) : 5.0)).toFixed(1)}</strong>
                        <span style={{ color: "var(--muted)", fontWeight: 400 }}>({p.avis?.length || 0} avis)</span>
                      </div>
                      {p.creeParNom && (
                        <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 500, marginTop: 2 }}>
                          Créé par : {p.creeParNom}
                        </div>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={canManage ? () => toggleProductVisibility(p) : undefined}
                        title={!canManage ? (isOnline ? "En ligne" : "Stock en attente") : (isOnline ? "Cliquer pour masquer du site (mettre en attente)" : "Cliquer pour rendre visible sur le site")}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          padding: "5px 10px",
                          borderRadius: 14,
                          fontSize: 11.5,
                          fontWeight: 800,
                          cursor: canManage ? "pointer" : "default",
                          transition: "all 0.2s",
                          border: isOnline ? "1.5px solid #86EFAC" : "1.5px solid #FCD34D",
                          background: isOnline ? "#F0FDF4" : "#FFFBEB",
                          color: isOnline ? "#166534" : "#92400E"
                        }}
                      >
                        {isOnline ? <Eye size={13} /> : <EyeOff size={13} />}
                        {isOnline ? "En ligne" : "Stock en attente"}
                      </button>
                    </td>
                    <td>
                      {p.etat === "occasion" ? (
                        <span style={{ 
                          display: "inline-flex", alignItems: "center", gap: 4,
                          background: "#FFFBEB", color: "#B45309", border: "1.5px solid #FDE68A",
                          padding: "3px 9px", borderRadius: 12, fontSize: 11.5, fontWeight: 800 
                        }}>
                          Occasion
                        </span>
                      ) : (
                        <span style={{ 
                          display: "inline-flex", alignItems: "center", gap: 4,
                          background: "#F0FDFA", color: "#0F766E", border: "1.5px solid #99F6E4",
                          padding: "3px 9px", borderRadius: 12, fontSize: 11.5, fontWeight: 800 
                        }}>
                          Neuf
                        </span>
                      )}
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
                      {p.dernierPrix && Number(p.dernierPrix) > 0 && (
                        <div style={{ fontSize: 11, color: "#DC2626", fontWeight: 700, marginTop: 3 }}>
                          Plancher : {fcfa(p.dernierPrix)}
                        </div>
                      )}
                    </td>
                    <td style={{ color: "var(--muted)" }}>{fcfa(p.coutAchat || 0)}</td>
                    <td className={p.stock <= p.seuilAlerte ? "bs-stock-low" : ""}>
                      <span style={{ fontWeight: 700 }}>{p.stock}</span> {p.unite}
                      {p.stock <= p.seuilAlerte && <AlertTriangle size={14} color="#B4483A" style={{ marginLeft: 6, verticalAlign: "-2px" }} />}
                    </td>

                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <button
                          type="button"
                          className="bs-icon-btn"
                          title="Aperçu des variantes & stocks"
                          style={{ color: "var(--forest)", background: "var(--forest-light)", borderRadius: 8, padding: 5 }}
                          onClick={() => setViewVariantsProduct(p)}
                        >
                          <Eye size={15} />
                        </button>
                        {canRestock && (
                          <button
                            className="bs-icon-btn"
                            title="Approvisionner (Réappro stock)"
                            style={{ color: "var(--forest)" }}
                            onClick={() => openRestockModal(p)}
                          >
                            <Package size={15} />
                          </button>
                        )}
                        {canManage ? (
                          <>
                            <button className="bs-icon-btn" title="Modifier" onClick={() => startEdit(p)}><Pencil size={15} /></button>{" "}
                            <button className="bs-icon-btn" title="Supprimer" style={{ color: "#B4483A" }} onClick={() => deleteProduct(p.id)}><Trash2 size={15} /></button>
                          </>
                        ) : (
                          !canRestock && <span style={{ fontSize: 12, color: "var(--muted)", fontStyle: "italic" }}>Lecture seule</span>
                        )}
                      </div>
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

          <form onSubmit={handleSubmit} className="bs-auth-form" style={{ gap: 18 }}>
            {/* VISIBILITÉ SUR LE SITE / GESTION STOCK EN ATTENTE */}
            <div style={{
              background: form.visibleEnLigne ? "#F0FDF4" : "#FFFBEB",
              border: form.visibleEnLigne ? "1.5px solid #86EFAC" : "1.5px solid #FCD34D",
              borderRadius: 14,
              padding: "14px 18px",
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
              transition: "all 0.2s"
            }}>
              <input
                type="checkbox"
                id="visibleEnLigne"
                checked={form.visibleEnLigne}
                onChange={(e) => set("visibleEnLigne", e.target.checked)}
                style={{ width: 20, height: 20, marginTop: 2, accentColor: "var(--forest)", cursor: "pointer" }}
              />
              <div style={{ flex: 1 }}>
                <label htmlFor="visibleEnLigne" style={{ fontWeight: 800, fontSize: 14, color: form.visibleEnLigne ? "#166534" : "#92400E", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                  {form.visibleEnLigne ? <Eye size={18} /> : <EyeOff size={18} />}
                  {form.visibleEnLigne ? "Produit visible en ligne sur le site web (Public)" : "Masquer sur le site / Mode Stock en attente (Privé)"}
                </label>
                <div style={{ fontSize: 12.5, color: form.visibleEnLigne ? "#15803D" : "#B45309", marginTop: 4, lineHeight: 1.4 }}>
                  {form.visibleEnLigne 
                    ? "Ce produit apparaîtra dans le catalogue public et sur la boutique en ligne dès sa création." 
                    : "Stock en attente : le produit ne sera PAS affiché aux clients sur le site. Vous pouvez enregistrer vos achats, connaître le montant total dépensé et gérer vos stocks en magasin avant de le publier."}
                </div>
              </div>
            </div>

            <div className="bs-input-group">
              <label>Nom du produit *</label>
              <input
                className="bs-input"
                required
                placeholder="ex: Disjoncteur Différentiel 32A, Câble R2V 3G2.5, Parfum d'ambiance..."
                value={form.nom}
                onChange={(e) => set("nom", e.target.value)}
              />
            </div>

            <div className="bs-form-row-2" style={{ marginBottom: 4 }}>
              {/* ÉTAT DU PRODUIT (NEUF / OCCASION) */}
              <div className="bs-input-group">
                <label style={{ fontWeight: 700 }}>État du produit *</label>
                <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                  <label style={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    padding: "10px 14px", borderRadius: 10, cursor: "pointer",
                    border: form.etat === "neuf" ? "2px solid #0D9488" : "1.5px solid var(--line)",
                    background: form.etat === "neuf" ? "#F0FDFA" : "var(--card)",
                    color: form.etat === "neuf" ? "#0F766E" : "var(--ink)",
                    fontWeight: 800, fontSize: 13.5, transition: "all 0.2s"
                  }}>
                    <input 
                      type="radio" 
                      name="etat" 
                      value="neuf" 
                      checked={form.etat === "neuf"} 
                      onChange={() => set("etat", "neuf")} 
                      style={{ display: "none" }}
                    />
                    Neuf (Jamais servi)
                  </label>
                  <label style={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    padding: "10px 14px", borderRadius: 10, cursor: "pointer",
                    border: form.etat === "occasion" ? "2px solid #D97706" : "1.5px solid var(--line)",
                    background: form.etat === "occasion" ? "#FFFBEB" : "var(--card)",
                    color: form.etat === "occasion" ? "#B45309" : "var(--ink)",
                    fontWeight: 800, fontSize: 13.5, transition: "all 0.2s"
                  }}>
                    <input 
                      type="radio" 
                      name="etat" 
                      value="occasion" 
                      checked={form.etat === "occasion"} 
                      onChange={() => set("etat", "occasion")} 
                      style={{ display: "none" }}
                    />
                    Occasion (2nde main)
                  </label>
                </div>
              </div>

              {/* MARQUE DU PRODUIT (OPTIONNELLE) */}
              <div className="bs-input-group">
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <input
                    type="checkbox"
                    id="associerMarque"
                    checked={form.associerMarque}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      set("associerMarque", checked);
                      if (!checked) set("marqueId", "");
                    }}
                    style={{ width: 17, height: 17, accentColor: "var(--forest)", cursor: "pointer" }}
                  />
                  <label htmlFor="associerMarque" style={{ fontWeight: 700, fontSize: 13.5, cursor: "pointer", margin: 0 }}>
                    Associer une marque à ce produit ?
                  </label>
                </div>
                {form.associerMarque ? (
                  <div>
                    <select
                      className="bs-select"
                      value={form.marqueId}
                      onChange={(e) => set("marqueId", e.target.value)}
                      style={{ height: 42, width: "100%" }}
                    >
                      <option value="">-- Sélectionner une marque --</option>
                      {marques.map((m) => (
                        <option key={m.id} value={m.id}>{m.nom}</option>
                      ))}
                    </select>
                    <div style={{ marginTop: 4, textAlign: "right" }}>
                      <a href="/admin/marques" target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "var(--forest)", fontWeight: 700, textDecoration: "none" }}>
                        + Gérer les marques
                      </a>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: "var(--muted)", fontStyle: "italic", padding: "8px 0" }}>
                    Sans marque spécifique (le filtre de marque sera masqué pour ce type de produit).
                  </div>
                )}
              </div>
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

            {/* PRIX, DERNIER PRIX & PROMOTIONS */}
            <div style={{ background: "var(--paper)", padding: 16, borderRadius: 12, border: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
                  <label>Prix de vente public *</label>
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
                  <label>Prix Promo</label>
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
                  <label style={{ color: "#DC2626", fontWeight: 700 }}>Dernier prix (Plancher caisse)</label>
                  <input
                    className="bs-input"
                    type="number"
                    step="0.01"
                    placeholder="ex: 10.00"
                    value={form.dernierPrix}
                    onChange={(e) => set("dernierPrix", e.target.value)}
                    style={{ borderColor: "#FCA5A5" }}
                  />
                  <div style={{ fontSize: 11, color: "#991B1B", marginTop: 3 }}>
                    Prix plancher secret pour négociation en caisse. Masqué aux clients.
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

            {/* VARIANTES DE COULEURS */}
            <div style={{ background: "var(--paper)", padding: 16, borderRadius: 12, border: "1px solid var(--line)" }}>
              {(() => {
                const gStock = form.stock !== "" ? Math.max(0, Number(form.stock)) : 0;
                const cStock = (form.variantesCouleurs || []).reduce((sum, c) => sum + (c.stock !== "" && c.stock !== undefined ? Math.max(0, Number(c.stock)) : 0), 0);
                const isOver = cStock > gStock;
                const remaining = Math.max(0, gStock - cStock);
                return (
                  <div style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    marginBottom: 12, padding: "8px 12px", borderRadius: 8,
                    background: isOver ? "#FEF2F2" : (cStock > 0 ? "#F0FDF4" : "var(--card)"),
                    border: `1px solid ${isOver ? "#FCA5A5" : (cStock > 0 ? "#BBF7D0" : "var(--line)")}`
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {isOver ? <AlertTriangle size={15} color="#DC2626" /> : <Tag size={15} color={cStock > 0 ? "#16A34A" : "var(--muted)"} />}
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: isOver ? "#DC2626" : (cStock > 0 ? "#15803D" : "var(--ink)") }}>
                        {isOver
                          ? `⚠️ Dépassement : ${cStock} attribués sur ${gStock} disponibles (excédent: +${cStock - gStock})`
                          : `Stock réparti : ${cStock} / ${gStock} global ${remaining > 0 ? `(${remaining} restant à attribuer)` : "(Totalement réparti)"}`
                        }
                      </span>
                    </div>
                    <span style={{ fontSize: 11, color: "var(--muted)", fontStyle: "italic" }}>
                      Le stock des variantes est une part du stock global
                    </span>
                  </div>
                );
              })()}

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Palette size={18} color="var(--forest)" />
                  <span style={{ fontWeight: 800, fontSize: 14, color: "var(--forest-dark)" }}>Variantes de Couleurs (Optionnel)</span>
                </div>
                <button
                  type="button"
                  className="bs-btn-secondary"
                  style={{ padding: "5px 12px", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}
                  onClick={() => {
                    const gStock = form.stock !== "" ? Math.max(0, Number(form.stock)) : 0;
                    const cStock = (form.variantesCouleurs || []).reduce((sum, c) => sum + (c.stock !== "" && c.stock !== undefined ? Math.max(0, Number(c.stock)) : 0), 0);
                    const defaultVariantStock = Math.max(0, gStock - cStock);
                    set("variantesCouleurs", [...(form.variantesCouleurs || []), { nom: "", couleur: "#163424", photo: "", prix: "", stock: defaultVariantStock }]);
                  }}
                >
                  <Plus size={14} /> Ajouter une couleur
                </button>
              </div>

              {(!form.variantesCouleurs || form.variantesCouleurs.length === 0) ? (
                <div style={{ fontSize: 12.5, color: "var(--muted)", fontStyle: "italic" }}>
                  Aucune couleur configurée (produit à couleur unique ou standard).
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {form.variantesCouleurs.map((vc, idx) => (
                    <div key={idx} style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--card)", padding: 10, borderRadius: 10, border: "1px solid var(--line)", flexWrap: "wrap" }}>
                      <input
                        type="color"
                        value={vc.couleur || "#163424"}
                        onChange={(e) => {
                          const updated = [...form.variantesCouleurs];
                          updated[idx].couleur = e.target.value;
                          set("variantesCouleurs", updated);
                        }}
                        style={{ width: 36, height: 36, borderRadius: 6, border: "none", cursor: "pointer", padding: 0 }}
                        title="Choisir la couleur"
                      />
                      <input
                        className="bs-input"
                        style={{ width: 140 }}
                        placeholder="Nom (ex: Bleu nuit)"
                        value={vc.nom}
                        onChange={(e) => {
                          const updated = [...form.variantesCouleurs];
                          updated[idx].nom = e.target.value;
                          set("variantesCouleurs", updated);
                        }}
                      />
                      <input
                        className="bs-input"
                        style={{ flex: 1, minWidth: 140 }}
                        placeholder="URL Photo (optionnel)"
                        value={vc.photo}
                        onChange={(e) => {
                          const updated = [...form.variantesCouleurs];
                          updated[idx].photo = e.target.value;
                          set("variantesCouleurs", updated);
                        }}
                      />
                      <input
                        className="bs-input"
                        type="number"
                        style={{ width: 110 }}
                        placeholder="Prix spé."
                        value={vc.prix}
                        onChange={(e) => {
                          const updated = [...form.variantesCouleurs];
                          updated[idx].prix = e.target.value;
                          set("variantesCouleurs", updated);
                        }}
                      />
                      <input
                        className="bs-input"
                        type="number"
                        style={{ width: 80 }}
                        placeholder="Stock"
                        value={vc.stock}
                        onChange={(e) => {
                          const updated = [...form.variantesCouleurs];
                          updated[idx].stock = e.target.value;
                          set("variantesCouleurs", updated);
                        }}
                      />
                      <button
                        type="button"
                        className="bs-icon-btn"
                        style={{ color: "#DC2626" }}
                        onClick={() => {
                          const updated = form.variantesCouleurs.filter((_, i) => i !== idx);
                          set("variantesCouleurs", updated);
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* VARIANTES OPTIONS / SENTEURS PERSONNALISABLES */}
            <div style={{ background: "var(--paper)", padding: 16, borderRadius: 12, border: "1px solid var(--line)" }}>
              {(() => {
                const gStock = form.stock !== "" ? Math.max(0, Number(form.stock)) : 0;
                const oStock = (form.variantesOptions || []).reduce((sum, o) => sum + (o.stock !== "" && o.stock !== undefined ? Math.max(0, Number(o.stock)) : 0), 0);
                const isOver = oStock > gStock;
                const remaining = Math.max(0, gStock - oStock);
                return (
                  <div style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    marginBottom: 12, padding: "8px 12px", borderRadius: 8,
                    background: isOver ? "#FEF2F2" : (oStock > 0 ? "#F0FDF4" : "var(--card)"),
                    border: `1px solid ${isOver ? "#FCA5A5" : (oStock > 0 ? "#BBF7D0" : "var(--line)")}`
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {isOver ? <AlertTriangle size={15} color="#DC2626" /> : <Tag size={15} color={oStock > 0 ? "#16A34A" : "var(--muted)"} />}
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: isOver ? "#DC2626" : (oStock > 0 ? "#15803D" : "var(--ink)") }}>
                        {isOver
                          ? `⚠️ Dépassement : ${oStock} attribués sur ${gStock} disponibles (excédent: +${oStock - gStock})`
                          : `Stock réparti : ${oStock} / ${gStock} global ${remaining > 0 ? `(${remaining} restant à attribuer)` : "(Totalement réparti)"}`
                        }
                      </span>
                    </div>
                    <span style={{ fontSize: 11, color: "var(--muted)", fontStyle: "italic" }}>
                      Le stock de chaque option est une part du stock global
                    </span>
                  </div>
                );
              })()}

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Sparkles size={18} color="var(--forest)" />
                  <span style={{ fontWeight: 800, fontSize: 14, color: "var(--forest-dark)" }}>Variantes Personnalisables (Optionnel)</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Titre :</span>
                  <input
                    className="bs-input"
                    style={{ width: 140, height: 32, fontSize: 12.5 }}
                    value={form.optionTitre}
                    onChange={(e) => set("optionTitre", e.target.value)}
                    placeholder="ex: Senteur, Modèle..."
                  />
                  <button
                    type="button"
                    className="bs-btn-secondary"
                    style={{ padding: "5px 12px", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}
                    onClick={() => {
                      const gStock = form.stock !== "" ? Math.max(0, Number(form.stock)) : 0;
                      const oStock = (form.variantesOptions || []).reduce((sum, o) => sum + (o.stock !== "" && o.stock !== undefined ? Math.max(0, Number(o.stock)) : 0), 0);
                      const defaultVariantStock = Math.max(0, gStock - oStock);
                      set("variantesOptions", [...(form.variantesOptions || []), { nom: "", photo: "", prix: "", stock: defaultVariantStock }]);
                    }}
                  >
                    <Plus size={14} /> Ajouter une option
                  </button>
                </div>
              </div>

              {(!form.variantesOptions || form.variantesOptions.length === 0) ? (
                <div style={{ fontSize: 12.5, color: "var(--muted)", fontStyle: "italic" }}>
                  Aucune variante spécifique (ex: Senteur, Modèle, Taille...).
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {form.variantesOptions.map((vo, idx) => (
                    <div key={idx} style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--card)", padding: 10, borderRadius: 10, border: "1px solid var(--line)", flexWrap: "wrap" }}>
                      <input
                        className="bs-input"
                        style={{ width: 160 }}
                        placeholder={`Nom (ex: ${form.optionTitre || "Option"} 1)`}
                        value={vo.nom}
                        onChange={(e) => {
                          const updated = [...form.variantesOptions];
                          updated[idx].nom = e.target.value;
                          set("variantesOptions", updated);
                        }}
                      />
                      <input
                        className="bs-input"
                        style={{ flex: 1, minWidth: 140 }}
                        placeholder="URL Photo (optionnel)"
                        value={vo.photo}
                        onChange={(e) => {
                          const updated = [...form.variantesOptions];
                          updated[idx].photo = e.target.value;
                          set("variantesOptions", updated);
                        }}
                      />
                      <input
                        className="bs-input"
                        type="number"
                        style={{ width: 110 }}
                        placeholder="Prix spé."
                        value={vo.prix}
                        onChange={(e) => {
                          const updated = [...form.variantesOptions];
                          updated[idx].prix = e.target.value;
                          set("variantesOptions", updated);
                        }}
                      />
                      <input
                        className="bs-input"
                        type="number"
                        style={{ width: 80 }}
                        placeholder="Stock"
                        value={vo.stock}
                        onChange={(e) => {
                          const updated = [...form.variantesOptions];
                          updated[idx].stock = e.target.value;
                          set("variantesOptions", updated);
                        }}
                      />
                      <button
                        type="button"
                        className="bs-icon-btn"
                        style={{ color: "#DC2626" }}
                        onClick={() => {
                          const updated = form.variantesOptions.filter((_, i) => i !== idx);
                          set("variantesOptions", updated);
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* GALERIE MULTI-PHOTOS SUPPLEMENTAIRES */}
            <div style={{ background: "var(--paper)", padding: 16, borderRadius: 12, border: "1px solid var(--line)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <ImageIcon size={18} color="var(--forest)" />
                  <span style={{ fontWeight: 800, fontSize: 14, color: "var(--forest-dark)" }}>Galerie Multi-Photos Additionnelles</span>
                </div>
                <button
                  type="button"
                  className="bs-btn-secondary"
                  style={{ padding: "5px 12px", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}
                  onClick={() => set("galeriePhotos", [...(form.galeriePhotos || []), ""])}
                >
                  <Plus size={14} /> + Ajouter une photo
                </button>
              </div>

              {(!form.galeriePhotos || form.galeriePhotos.length === 0) ? (
                <div style={{ fontSize: 12.5, color: "var(--muted)", fontStyle: "italic" }}>
                  Aucune photo supplémentaire. Vous pouvez en ajouter autant que souhaité pour le carrousel sur le site.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {form.galeriePhotos.map((url, idx) => (
                    <div key={idx} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {url && (
                        <img src={url} alt={`Aperçu ${idx}`} style={{ width: 36, height: 36, borderRadius: 6, objectFit: "cover" }} />
                      )}
                      <input
                        className="bs-input"
                        style={{ flex: 1 }}
                        placeholder={`URL de la photo #${idx + 1}`}
                        value={url}
                        onChange={(e) => {
                          const updated = [...form.galeriePhotos];
                          updated[idx] = e.target.value;
                          set("galeriePhotos", updated);
                        }}
                      />
                      <button
                        type="button"
                        className="bs-icon-btn"
                        style={{ color: "#DC2626" }}
                        onClick={() => {
                          const updated = form.galeriePhotos.filter((_, i) => i !== idx);
                          set("galeriePhotos", updated);
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
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
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
            zIndex: 1300,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20
          }}
          onClick={() => setRestockProduct(null)}
        >
          <div
            className="bs-panel"
            style={{
              width: "100%",
              maxWidth: 520,
              background: "#ffffff",
              borderRadius: 18,
              padding: 24,
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              border: "1px solid var(--line)"
            }}
            onClick={(e) => e.stopPropagation()}
          >
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

      {/* MODAL DE CONSULTATION DÉTAILLÉE DES VARIANTES ET DU STOCK RESTANT */}
      {viewVariantsProduct && (() => {
        const p = viewVariantsProduct;
        const parsedColors = parseJsonSafe(p.variantesCouleurs, []);
        const colors = Array.isArray(parsedColors) ? parsedColors : [];
        const parsedOptions = parseJsonSafe(p.variantesOptions, { titre: "Option", options: [] });
        const optionTitre = parsedOptions?.titre || "Option";
        const options = Array.isArray(parsedOptions?.options) ? parsedOptions.options : (Array.isArray(parsedOptions) ? parsedOptions : []);
        const hasAnyVariants = colors.length > 0 || options.length > 0;

        return (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(15, 23, 42, 0.65)",
              backdropFilter: "blur(4px)",
              WebkitBackdropFilter: "blur(4px)",
              zIndex: 1300,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 20
            }}
            onClick={() => setViewVariantsProduct(null)}
          >
            <div
              className="bs-panel"
              style={{
                width: "100%",
                maxWidth: 540,
                background: "#ffffff",
                borderRadius: 18,
                padding: 24,
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
                border: "1px solid var(--line)",
                animation: "modalFadeIn 0.15s ease-out"
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, borderBottom: "1px solid var(--line)", paddingBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <img
                    src={p.imageUrl || "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=80&q=80"}
                    alt={p.nom}
                    style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover", border: "1px solid var(--line)" }}
                  />
                  <div>
                    <h3 style={{ margin: 0, fontSize: 16, color: "var(--forest-dark)" }}>{p.nom}</h3>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>
                      Stock global total : <strong style={{ color: "var(--forest)" }}>{p.stock} {p.unite || "pièce(s)"}</strong>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="bs-icon-btn"
                  onClick={() => setViewVariantsProduct(null)}
                  style={{ color: "var(--muted)" }}
                >
                  <X size={20} />
                </button>
              </div>

              {!hasAnyVariants ? (
                <div style={{ padding: "26px 16px", textAlign: "center", color: "var(--muted)", background: "var(--paper)", borderRadius: 12 }}>
                  <Package size={32} style={{ margin: "0 auto 8px", opacity: 0.4 }} />
                  <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600 }}>Ce produit n'a aucune variante ou couleur spécifique configurée.</p>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>Stock standard unique : {p.stock} disponibles</span>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 16, maxHeight: 380, overflowY: "auto", paddingRight: 4 }}>
                  {/* COULEURS */}
                  {colors.length > 0 && (
                    <div style={{ background: "var(--paper)", padding: 14, borderRadius: 14, border: "1px solid var(--line)" }}>
                      <div style={{ fontSize: 12.5, fontWeight: 800, color: "var(--forest-dark)", textTransform: "uppercase", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                        <Palette size={15} color="var(--forest)" />
                        <span>Variantes de Couleurs ({colors.length})</span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {colors.map((c, idx) => {
                          const vStock = (c.stock !== undefined && c.stock !== "") ? Number(c.stock) : p.stock;
                          const isDepleted = vStock <= 0;
                          return (
                            <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#ffffff", borderRadius: 10, border: "1px solid var(--line)" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                {c.photo ? (
                                  <img src={c.photo} alt={c.nom} style={{ width: 28, height: 28, borderRadius: 6, objectFit: "cover" }} />
                                ) : (
                                  <span style={{ width: 18, height: 18, borderRadius: "50%", background: c.couleur || "#163424", border: "1px solid rgba(0,0,0,0.15)" }} />
                                )}
                                <span style={{ fontWeight: 700, fontSize: 13, color: "var(--ink)" }}>{c.nom}</span>
                              </div>
                              <span style={{
                                fontSize: 12,
                                fontWeight: 800,
                                padding: "3px 10px",
                                borderRadius: 8,
                                background: isDepleted ? "#FEE2E2" : "#ECFDF5",
                                color: isDepleted ? "#DC2626" : "#059669",
                                border: `1px solid ${isDepleted ? "#FCA5A5" : "#A7F3D0"}`
                              }}>
                                {isDepleted ? "Épuisé (0 restant)" : `${vStock} restant(s)`}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* OPTIONS / MODÈLES */}
                  {options.length > 0 && (
                    <div style={{ background: "var(--paper)", padding: 14, borderRadius: 14, border: "1px solid var(--line)" }}>
                      <div style={{ fontSize: 12.5, fontWeight: 800, color: "var(--forest-dark)", textTransform: "uppercase", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                        <Sparkles size={15} color="var(--forest)" />
                        <span>{optionTitre}s ({options.length})</span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {options.map((opt, idx) => {
                          const vStock = (opt.stock !== undefined && opt.stock !== "") ? Number(opt.stock) : p.stock;
                          const isDepleted = vStock <= 0;
                          return (
                            <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#ffffff", borderRadius: 10, border: "1px solid var(--line)" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                {opt.photo && (
                                  <img src={opt.photo} alt={opt.nom} style={{ width: 28, height: 28, borderRadius: 6, objectFit: "cover" }} />
                                )}
                                <span style={{ fontWeight: 700, fontSize: 13, color: "var(--ink)" }}>{opt.nom}</span>
                              </div>
                              <span style={{
                                fontSize: 12,
                                fontWeight: 800,
                                padding: "3px 10px",
                                borderRadius: 8,
                                background: isDepleted ? "#FEE2E2" : "#ECFDF5",
                                color: isDepleted ? "#DC2626" : "#059669",
                                border: `1px solid ${isDepleted ? "#FCA5A5" : "#A7F3D0"}`
                              }}>
                                {isDepleted ? "Épuisé (0 restant)" : `${vStock} restant(s)`}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div style={{ marginTop: 18, textAlign: "right" }}>
                <button
                  type="button"
                  className="bs-btn-primary"
                  onClick={() => setViewVariantsProduct(null)}
                  style={{ padding: "8px 20px", borderRadius: 10, fontSize: 13 }}
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}

