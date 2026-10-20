import React, { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { PlusCircle, Edit, Trash2, Award, X, Search, Package } from "lucide-react";
import api from "../../api";
import TablePagination from "../../components/TablePagination";
import ImageUploader from "../../components/ImageUploader";

export default function Marques() {
  const [marques, setMarques] = useState([]);
  const [modalType, setModalType] = useState(null); // 'create' | 'edit' | null
  const [selectedMarque, setSelectedMarque] = useState(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ nom: "", logoUrl: "", description: "" });
  const [erreur, setErreur] = useState("");
  const [succes, setSucces] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);

  function load() {
    setLoading(true);
    api.get("/admin/marques")
      .then(res => setMarques(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  const filteredMarques = marques.filter(m => {
    const q = search.trim().toLowerCase();
    return !q || m.nom.toLowerCase().includes(q) || (m.description && m.description.toLowerCase().includes(q));
  });

  function openCreateModal() {
    setForm({ nom: "", logoUrl: "", description: "" });
    setErreur("");
    setSucces("");
    setModalType("create");
  }

  function openEditModal(m) {
    setSelectedMarque(m);
    setForm({
      nom: m.nom || "",
      logoUrl: m.logoUrl || "",
      description: m.description || ""
    });
    setErreur("");
    setSucces("");
    setModalType("edit");
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.nom.trim()) {
      setErreur("Le nom de la marque est obligatoire.");
      return;
    }
    setErreur("");
    setSucces("");
    try {
      await api.post("/admin/marques", form);
      setSucces("Marque ajoutée avec succès !");
      setTimeout(() => { setModalType(null); load(); }, 600);
    } catch (err) {
      setErreur(err.response?.data?.message || "Impossible d'ajouter la marque.");
    }
  }

  async function handleUpdate(e) {
    e.preventDefault();
    if (!form.nom.trim()) {
      setErreur("Le nom de la marque est obligatoire.");
      return;
    }
    setErreur("");
    setSucces("");
    try {
      await api.put(`/admin/marques/${selectedMarque.id}`, form);
      setSucces("Marque mise à jour !");
      setTimeout(() => { setModalType(null); load(); }, 600);
    } catch (err) {
      setErreur(err.response?.data?.message || "Impossible de mettre à jour la marque.");
    }
  }

  async function handleDelete(id, nom) {
    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer la marque "${nom}" ? Les produits associés ne seront pas supprimés mais n'auront plus de marque.`)) return;
    try {
      await api.delete(`/admin/marques/${id}`);
      toast.success("Marque supprimée !");
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Impossible de supprimer cette marque.");
    }
  }

  return (
    <>
      <div className="bs-toolbar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 26, margin: 0, color: "var(--forest-dark)", display: "flex", alignItems: "center", gap: 10 }}>
            <Award size={28} color="var(--forest)" /> Gestion des Marques
          </h1>
          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 14 }}>
            Gérez la liste des constructeurs et marques officielles (Schneider, Legrand, Philips, Bosch...). Chaque produit peut être associé à sa marque.
          </p>
        </div>
        <button 
          className="bs-btn-primary" 
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 12, fontWeight: 700 }} 
          onClick={openCreateModal}
        >
          <PlusCircle size={18} /> Ajouter une Marque
        </button>
      </div>

      <div className="bs-card" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 260 }}>
            <Search size={18} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
            <input
              type="text"
              placeholder="Rechercher une marque par nom ou description..."
              className="bs-input"
              style={{ paddingLeft: 38 }}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>
            Total : {filteredMarques.length} marque{filteredMarques.length > 1 ? "s" : ""}
          </span>
        </div>
      </div>

      <div className="bs-table-card">
        <div className="bs-table-responsive">
          <table className="bs-table">
            <thead>
              <tr>
                <th style={{ width: 60 }}>Logo</th>
                <th>Nom de la Marque</th>
                <th>Description</th>
                <th>Produits Liés</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredMarques.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "40px 20px", color: "var(--muted)" }}>
                    {loading ? "Chargement des marques..." : "Aucune marque trouvée. Cliquez sur \"Ajouter une Marque\"."}
                  </td>
                </tr>
              ) : (
                filteredMarques
                  .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                  .map(m => {
                    const count = m.produits?.length || 0;
                    return (
                      <tr key={m.id}>
                        <td>
                          {m.logoUrl ? (
                            <img 
                              src={m.logoUrl} 
                              alt={m.nom} 
                              style={{ width: 44, height: 44, objectFit: "contain", borderRadius: 8, border: "1px solid var(--line)", background: "#fff", padding: 2 }} 
                            />
                          ) : (
                            <div style={{ 
                              width: 44, height: 44, borderRadius: 8, background: "var(--paper)", 
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontWeight: 800, fontSize: 16, color: "var(--forest-dark)", border: "1px solid var(--line)"
                            }}>
                              {m.nom.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                        </td>
                        <td>
                          <div style={{ fontWeight: 800, fontSize: 15, color: "var(--forest-dark)" }}>{m.nom}</div>
                        </td>
                        <td>
                          <div style={{ fontSize: 13, color: "var(--muted)", maxWidth: 400, whiteSpace: "normal" }}>
                            {m.description || "—"}
                          </div>
                        </td>
                        <td>
                          <span style={{ 
                            display: "inline-flex", alignItems: "center", gap: 5,
                            background: "var(--forest-light)", color: "var(--forest-dark)",
                            padding: "4px 10px", borderRadius: 14, fontSize: 12.5, fontWeight: 700 
                          }}>
                            <Package size={14} /> {count} produit{count > 1 ? "s" : ""}
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div style={{ display: "inline-flex", gap: 8 }}>
                            <button 
                              className="bs-icon-btn" 
                              title="Modifier la marque"
                              onClick={() => openEditModal(m)}
                              style={{ color: "var(--forest)" }}
                            >
                              <Edit size={16} />
                            </button>
                            <button 
                              className="bs-icon-btn" 
                              title="Supprimer la marque"
                              onClick={() => handleDelete(m.id, m.nom)}
                              style={{ color: "#DC2626" }}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
              )}
            </tbody>
          </table>
        </div>

        {filteredMarques.length > pageSize && (
          <TablePagination
            totalItems={filteredMarques.length}
            currentPage={currentPage}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        )}
      </div>

      {/* MODAL CRÉATION / MODIFICATION */}
      {modalType && (
        <div className="bs-modal-backdrop" onClick={() => setModalType(null)}>
          <div className="bs-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="bs-modal-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ margin: 0, fontSize: 18, color: "var(--forest-dark)", display: "flex", alignItems: "center", gap: 8 }}>
                <Award size={20} color="var(--forest)" />
                {modalType === "create" ? "Ajouter une Marque" : "Modifier la Marque"}
              </h2>
              <button className="bs-icon-btn" onClick={() => setModalType(null)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={modalType === "create" ? handleCreate : handleUpdate} style={{ padding: "20px 24px" }}>
              {erreur && <div className="bs-alert danger" style={{ marginBottom: 16 }}>{erreur}</div>}
              {succes && <div className="bs-alert success" style={{ marginBottom: 16 }}>{succes}</div>}

              <div className="bs-field" style={{ marginBottom: 16 }}>
                <label style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, display: "block" }}>
                  Nom de la marque *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Schneider Electric, Legrand, Philips, Bosch..."
                  className="bs-input"
                  value={form.nom}
                  onChange={e => setForm({ ...form, nom: e.target.value })}
                />
              </div>

              <div className="bs-field" style={{ marginBottom: 16 }}>
                <ImageUploader
                  label="Logo de la marque (optionnel)"
                  value={form.logoUrl}
                  onChange={url => setForm({ ...form, logoUrl: url })}
                />
              </div>

              <div className="bs-field" style={{ marginBottom: 20 }}>
                <label style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, display: "block" }}>
                  Description / Présentation (optionnel)
                </label>
                <textarea
                  rows={3}
                  placeholder="Brève description ou spécialité de cette marque..."
                  className="bs-textarea"
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
                <button type="button" className="bs-btn-secondary" onClick={() => setModalType(null)}>
                  Annuler
                </button>
                <button type="submit" className="bs-btn-primary" style={{ fontWeight: 700 }}>
                  {modalType === "create" ? "Enregistrer la marque" : "Mettre à jour"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
