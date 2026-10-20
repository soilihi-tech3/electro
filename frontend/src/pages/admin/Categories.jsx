import { SkeletonTableRows } from "../../components/Skeleton.jsx";
import React, { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { PlusCircle, List, Pencil, Trash2, CheckCircle, Image as ImageIcon, Layers } from "lucide-react";
import api from "../../api";
import ImageUploader from "../../components/ImageUploader.jsx";
import TablePagination from "../../components/TablePagination.jsx";
import { subscribeRealtime } from "../../utils/realtime.js";

export default function AdminCategories() {
  const [activeTab, setActiveTab] = useState("liste"); // "liste" | "ajout" | "familles"
  const [categories, setCategories] = useState([]);
  const [familles, setFamilles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editingFamilleId, setEditingFamilleId] = useState(null);

  const [search, setSearch] = useState("");

  const initialCategoryForm = {
    nom: "",
    famille: "Électronique",
    imageUrl: ""
  };
  const [categoryForm, setCategoryForm] = useState(initialCategoryForm);

  const initialFamilleForm = {
    nom: "",
    description: "",
    imageUrl: ""
  };
  const [familleForm, setFamilleForm] = useState(initialFamilleForm);

  function silentSyncCategories() {
    Promise.all([
      api.get("/admin/categories"),
      api.get("/admin/familles")
    ]).then(([resCats, resFams]) => {
      setCategories(resCats.data || []);
      setFamilles(resFams.data || []);
    }).catch(() => {});
  }

  function load() {
    setLoading(true);
    Promise.all([
      api.get("/admin/categories"),
      api.get("/admin/familles")
    ]).then(([resCats, resFams]) => {
      setCategories(resCats.data || []);
      setFamilles(resFams.data || []);
      if (resFams.data && resFams.data.length > 0 && !categoryForm.famille) {
        setCategoryForm(f => ({ ...f, famille: resFams.data[0].nom }));
      }
    }).finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    const unsub = subscribeRealtime((detail) => {
      if (detail.type === "category_updated") {
        silentSyncCategories();
      }
    });
    return () => unsub();
  }, []);

  function showToast(msg, type = "success") {
    if (type === "success") {
      toast.success(msg);
    } else {
      toast.error(msg);
    }
  }

  // --- CATEGORY ACTIONS ---
  function startEditCategory(cat) {
    setEditingId(cat.id);
    setCategoryForm({
      nom: cat.nom || "",
      famille: cat.famille || "Alimentation",
      imageUrl: cat.imageUrl || ""
    });
    setActiveTab("ajout");
  }

  function cancelEditCategory() {
    setEditingId(null);
    setCategoryForm(initialCategoryForm);
    setActiveTab("liste");
  }

  async function handleCategorySubmit(e) {
    e.preventDefault();
    if (!categoryForm.nom) return;

    try {
      if (editingId) {
        const res = await api.put(`/admin/categories/${editingId}`, categoryForm);
        const updatedCat = res.data;
        setCategories((prev) =>
          prev.map((c) =>
            c.id === editingId
              ? (updatedCat && updatedCat.id ? updatedCat : { ...c, ...categoryForm })
              : c
          )
        );
        showToast("Catégorie modifiée avec succès !");
      } else {
        const res = await api.post("/admin/categories", categoryForm);
        const newCat = res.data;
        const newCatItem = newCat && newCat.id ? newCat : { ...categoryForm, id: Date.now() };
        setCategories((prev) => [newCatItem, ...prev]);
        showToast("Nouvelle catégorie ajoutée !");
      }
      setEditingId(null);
      setCategoryForm(initialCategoryForm);
      setActiveTab("liste");
      silentSyncCategories();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Erreur inconnue.";
      showToast("Erreur : " + msg);
    }
  }

  async function deleteCategory(id) {
    if (!confirm("Voulez-vous vraiment supprimer cette catégorie ?")) return;
    setCategories((prev) => prev.filter((c) => c.id !== id));
    showToast("Catégorie supprimée.");
    try {
      await api.delete(`/admin/categories/${id}`);
      silentSyncCategories();
    } catch (err) {
      load(); // Revert on failure
    }
  }

  // --- FAMILLE ACTIONS ---
  function startEditFamille(fam) {
    setEditingFamilleId(fam.id);
    setFamilleForm({
      nom: fam.nom || "",
      description: fam.description || "",
      imageUrl: fam.imageUrl || ""
    });
  }

  function cancelEditFamille() {
    setEditingFamilleId(null);
    setFamilleForm(initialFamilleForm);
  }

  async function handleFamilleSubmit(e) {
    e.preventDefault();
    if (!familleForm.nom) return;

    try {
      if (editingFamilleId) {
        const res = await api.put(`/admin/familles/${editingFamilleId}`, familleForm);
        const updatedFam = res.data;
        setFamilles((prev) =>
          prev.map((f) =>
            f.id === editingFamilleId
              ? (updatedFam && updatedFam.id ? updatedFam : { ...f, ...familleForm })
              : f
          )
        );
        showToast("Famille de produit modifiée !");
      } else {
        const res = await api.post("/admin/familles", familleForm);
        const newFam = res.data;
        const newFamItem = newFam && newFam.id ? newFam : { ...familleForm, id: Date.now() };
        setFamilles((prev) => [...prev, newFamItem]);
        showToast("Nouvelle famille de produit créée !");
      }
      setEditingFamilleId(null);
      setFamilleForm(initialFamilleForm);
      silentSyncCategories();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Erreur inconnue.";
      showToast("Erreur : " + msg);
    }
  }

  async function deleteFamille(id) {
    if (!confirm("Voulez-vous vraiment supprimer cette famille de produit ?")) return;
    setFamilles((prev) => prev.filter((f) => f.id !== id));
    showToast("Famille de produit supprimée.");
    try {
      await api.delete(`/admin/familles/${id}`);
      silentSyncCategories();
    } catch (err) {
      load();
    }
  }

  // Pagination for categories
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filteredCategories = categories.filter((c) =>
    !search || c.nom?.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => { setCurrentPage(1); }, [search]);

  const totalItems = filteredCategories.length;
  const paginatedCategories = filteredCategories.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 26, margin: 0, color: "var(--forest-dark)" }}>Gestion des Catégories & Familles</h1>
          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 14 }}>
            Organisez vos produits en créant des catégories et des familles de produits.
          </p>
        </div>

        {/* TABS DE NAVIGATION */}
        <div style={{ display: "flex", gap: 8, background: "var(--paper)", padding: 4, borderRadius: 30, border: "1px solid var(--line)" }}>
          <button
            className={`bs-btn-primary ${activeTab === "liste" ? "" : "inactive"}`}
            style={{
              padding: "8px 18px", borderRadius: 24, fontSize: 13,
              background: activeTab === "liste" ? "var(--forest)" : "transparent",
              color: activeTab === "liste" ? "#fff" : "var(--muted)", boxShadow: "none"
            }}
            onClick={() => { setEditingId(null); setCategoryForm(initialCategoryForm); setActiveTab("liste"); }}
          >
            <List size={15} style={{ verticalAlign: "-2px", marginRight: 6 }} /> Catégories ({categories.length})
          </button>

          <button
            className={`bs-btn-primary ${activeTab === "ajout" ? "" : "inactive"}`}
            style={{
              padding: "8px 18px", borderRadius: 24, fontSize: 13,
              background: activeTab === "ajout" ? "var(--forest)" : "transparent",
              color: activeTab === "ajout" ? "#fff" : "var(--muted)", boxShadow: "none"
            }}
            onClick={() => {
              if (!editingId) { setCategoryForm(initialCategoryForm); }
              setActiveTab("ajout");
            }}
          >
            <PlusCircle size={15} style={{ verticalAlign: "-2px", marginRight: 6 }} /> {editingId ? "Modifier catégorie" : "Ajouter catégorie"}
          </button>

          <button
            className={`bs-btn-primary ${activeTab === "familles" ? "" : "inactive"}`}
            style={{
              padding: "8px 18px", borderRadius: 24, fontSize: 13,
              background: activeTab === "familles" ? "var(--forest)" : "transparent",
              color: activeTab === "familles" ? "#fff" : "var(--muted)", boxShadow: "none"
            }}
            onClick={() => setActiveTab("familles")}
          >
            <Layers size={15} style={{ verticalAlign: "-2px", marginRight: 6 }} /> Familles de produits ({familles.length})
          </button>
        </div>
      </div>



      {/* ONGLET 1: LISTE DES CATÉGORIES */}
      {activeTab === "liste" && (
        <div className="bs-panel" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ background: "var(--paper)", padding: "16px 20px", borderBottom: "1px solid var(--line)" }}>
            <div style={{ display: "flex", gap: 24, marginBottom: 16 }}>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 13, color: "var(--muted)", textTransform: "uppercase", fontWeight: 600 }}>Total Catégories</span>
                <span style={{ fontSize: 24, fontWeight: 800, color: "var(--ink)" }}>{categories.length}</span>
              </div>
              <div style={{ width: 1, background: "var(--line)" }}></div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 13, color: "var(--muted)", textTransform: "uppercase", fontWeight: 600 }}>Résultats</span>
                <span style={{ fontSize: 24, fontWeight: 800, color: "var(--ink)" }}>{filteredCategories.length}</span>
              </div>
            </div>
            
            <div style={{ display: "flex" }}>
              <input 
                className="bs-input" 
                style={{ flex: 1, maxWidth: 400 }} 
                placeholder="Rechercher une catégorie..." 
                value={search} 
                onChange={(e) => setSearch(e.target.value)} 
              />
            </div>
          </div>

          <table className="bs-table">
            <thead>
              <tr>
                <th>Image</th>
                <th>Nom de la catégorie</th>
                <th>Famille de produit</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <SkeletonTableRows rows={6} cols={4} />
              )}
              {!loading && paginatedCategories.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>
                    Aucune catégorie trouvée.
                  </td>
                </tr>
              )}
              {!loading && paginatedCategories.map((c) => (
                <tr key={c.id}>
                  <td style={{ width: 60 }}>
                    {c.imageUrl ? (
                      <img
                        src={c.imageUrl}
                        alt={c.nom}
                        style={{ width: 46, height: 46, borderRadius: 8, objectFit: "cover", border: "1px solid var(--line)" }}
                      />
                    ) : (
                      <div style={{ width: 46, height: 46, borderRadius: 8, background: "var(--paper)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--line)", color: "var(--muted)" }}>
                        <ImageIcon size={20} />
                      </div>
                    )}
                  </td>
                  <td style={{ fontWeight: 700, color: "var(--ink)" }}>{c.nom}</td>
                  <td>
                    <span style={{ background: "var(--forest-light)", color: "var(--forest-dark)", padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700, border: "1px solid var(--line)" }}>
                      {c.famille || "Alimentation"}
                    </span>
                  </td>
                  <td>
                    <button className="bs-icon-btn" title="Modifier" onClick={() => startEditCategory(c)}><Pencil size={15} /></button>{" "}
                    <button className="bs-icon-btn" title="Supprimer" style={{ color: "#B4483A" }} onClick={() => deleteCategory(c.id)}><Trash2 size={15} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <TablePagination
            totalItems={totalItems}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      {/* ONGLET 2: CREER OU MODIFIER UNE CATÉGRIE */}
      {activeTab === "ajout" && (
        <div className="bs-panel" style={{ maxWidth: 600, margin: "0 auto" }}>
          <h3 style={{ marginTop: 0, fontSize: 20, color: "var(--forest-dark)", borderBottom: "1px solid var(--line)", paddingBottom: 12, marginBottom: 20 }}>
            {editingId ? "Modifier la catégorie" : "Créer une nouvelle catégorie"}
          </h3>

          <form onSubmit={handleCategorySubmit} className="bs-auth-form" style={{ gap: 16 }}>
            <div className="bs-input-group">
              <label>Nom de la catégorie *</label>
              <input
                className="bs-input"
                required
                placeholder="ex: Légumes Bio"
                value={categoryForm.nom}
                onChange={(e) => setCategoryForm(f => ({ ...f, nom: e.target.value }))}
              />
            </div>

            <div className="bs-input-group">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <label style={{ margin: 0 }}>Famille de produits *</label>
                <button
                  type="button"
                  onClick={() => setActiveTab("familles")}
                  style={{ background: "none", border: "none", color: "var(--forest)", fontWeight: 700, fontSize: 12, cursor: "pointer" }}
                >
                  + Gérer / Ajouter des familles
                </button>
              </div>
              <select
                className="bs-select"
                required
                value={categoryForm.famille}
                onChange={(e) => setCategoryForm(f => ({ ...f, famille: e.target.value }))}
              >
                {familles.map((fam) => (
                  <option key={fam.id} value={fam.nom}>{fam.nom}</option>
                ))}
                {!familles.some(fam => fam.nom === categoryForm.famille) && categoryForm.famille && (
                  <option value={categoryForm.famille}>{categoryForm.famille}</option>
                )}
              </select>
            </div>

            <ImageUploader
              label="Image d'illustration"
              value={categoryForm.imageUrl}
              onChange={(url) => setCategoryForm(f => ({ ...f, imageUrl: url }))}
            />

            <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
              <button
                type="button"
                style={{
                  background: "var(--paper)",
                  border: "1px solid var(--line)",
                  color: "var(--ink)",
                  padding: "12px 20px",
                  borderRadius: 12,
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: "pointer",
                  flex: 1
                }}
                onClick={cancelEditCategory}
              >
                Annuler
              </button>
              <button
                type="submit"
                className="bs-btn-primary"
                style={{ flex: 2 }}
                disabled={!categoryForm.nom}
              >
                {editingId ? "Enregistrer les modifications" : "Créer la catégorie"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ONGLET 3: GESTION DES FAMILLES DE PRODUITS */}
      {activeTab === "familles" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          {/* FORMULAIRE D'AJOUT / MODIFICATION DE FAMILLE */}
          <div className="bs-panel">
            <h3 style={{ marginTop: 0, fontSize: 18, color: "var(--forest-dark)", borderBottom: "1px solid var(--line)", paddingBottom: 10, marginBottom: 16 }}>
              {editingFamilleId ? "Modifier la famille" : "Ajouter une famille de produit"}
            </h3>

            <form onSubmit={handleFamilleSubmit} className="bs-auth-form" style={{ gap: 14 }}>
              <div className="bs-input-group">
                <label>Nom de la famille *</label>
                <input
                  className="bs-input"
                  required
                  placeholder="ex: Alimentation, Cosmétique, Électronique..."
                  value={familleForm.nom}
                  onChange={(e) => setFamilleForm(f => ({ ...f, nom: e.target.value }))}
                />
              </div>

              <div className="bs-input-group">
                <label>Description (optionnel)</label>
                <input
                  className="bs-input"
                  placeholder="ex: Tous les produits d'alimentation bio"
                  value={familleForm.description}
                  onChange={(e) => setFamilleForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>

              <ImageUploader
                label="Image de couverture (optionnel)"
                value={familleForm.imageUrl}
                onChange={(url) => setFamilleForm(f => ({ ...f, imageUrl: url }))}
              />

              <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                {editingFamilleId && (
                  <button
                    type="button"
                    className="bs-btn-primary"
                    style={{ background: "#E2E8E3", color: "var(--ink)", flex: 1 }}
                    onClick={cancelEditFamille}
                  >
                    Annuler
                  </button>
                )}
                <button
                  type="submit"
                  className="bs-btn-primary"
                  style={{ flex: 2 }}
                  disabled={!familleForm.nom}
                >
                  {editingFamilleId ? "Enregistrer" : "Créer la famille"}
                </button>
              </div>
            </form>
          </div>

          {/* LISTE DES FAMILLES */}
          <div className="bs-panel" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ background: "var(--paper)", padding: "14px 18px", borderBottom: "1px solid var(--line)", fontWeight: 800, color: "var(--forest-dark)", fontSize: 16 }}>
              Liste des familles créées ({familles.length})
            </div>

            <table className="bs-table">
              <thead>
                <tr>
                  <th>Famille</th>
                  <th>Description</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {familles.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ textAlign: "center", padding: 30, color: "var(--muted)" }}>
                      Aucune famille de produit définie.
                    </td>
                  </tr>
                ) : (
                  familles.map((fam) => (
                    <tr key={fam.id}>
                      <td style={{ fontWeight: 700, color: "var(--ink)" }}>{fam.nom}</td>
                      <td style={{ fontSize: 12.5, color: "var(--muted)" }}>{fam.description || "—"}</td>
                      <td>
                        <button className="bs-icon-btn" title="Modifier" onClick={() => startEditFamille(fam)}><Pencil size={15} /></button>{" "}
                        <button className="bs-icon-btn" title="Supprimer" style={{ color: "#B4483A" }} onClick={() => deleteFamille(fam.id)}><Trash2 size={15} /></button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
