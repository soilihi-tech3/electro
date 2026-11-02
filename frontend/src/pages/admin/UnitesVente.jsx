import React, { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { PlusCircle, Edit, Trash2, Scale, X, CheckCircle, AlertCircle } from "lucide-react";
import api from "../../api";
import TablePagination from "../../components/TablePagination";
import { useAuth } from "../../context/AuthContext";

export default function UnitesVente() {
  const { hasPerm } = useAuth();
  const canManage = hasPerm("gerer_unites");
  const [unites, setUnites] = useState([]);
  const [modalType, setModalType] = useState(null); // 'create' | 'edit' | null
  const [selectedUnite, setSelectedUnite] = useState(null);
  const [form, setForm] = useState({ nom: "", abbreviation: "" });
  const [erreur, setErreur] = useState("");
  const [succes, setSucces] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  function load() {
    api.get("/admin/unites")
      .then(res => setUnites(res.data || []))
      .catch(() => {});
  }

  useEffect(load, []);

  function openCreateModal() {
    setForm({ nom: "", abbreviation: "" });
    setErreur("");
    setSucces("");
    setModalType("create");
  }

  function openEditModal(u) {
    setSelectedUnite(u);
    setForm({
      nom: u.nom || "",
      abbreviation: u.abbreviation || ""
    });
    setErreur("");
    setSucces("");
    setModalType("edit");
  }

  async function handleCreate(e) {
    e.preventDefault();
    setErreur("");
    setSucces("");
    try {
      await api.post("/admin/unites", form);
      setSucces("Unité de vente créée avec succès !");
      setTimeout(() => { setModalType(null); load(); }, 800);
    } catch (err) {
      setErreur(err.response?.data?.message || "Impossible de créer l'unité.");
    }
  }

  async function handleUpdate(e) {
    e.preventDefault();
    setErreur("");
    setSucces("");
    try {
      await api.put(`/admin/unites/${selectedUnite.id}`, form);
      setSucces("Unité de vente mise à jour !");
      setTimeout(() => { setModalType(null); load(); }, 800);
    } catch (err) {
      setErreur(err.response?.data?.message || "Impossible de mettre à jour l'unité.");
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer cette unité de vente ?")) return;
    try {
      await api.delete(`/admin/unites/${id}`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Impossible de supprimer cette unité.");
    }
  }

  return (
    <>
      <div className="bs-toolbar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 26, margin: 0, color: "var(--forest-dark)" }}>Unités de Vente & Mesures</h1>
          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 14 }}>
            Configurez les unités de vente pour vos produits (Kg, Litre, Carton, Sac, Bouteille, Pièce, etc.).
          </p>
        </div>
        {canManage ? (
          <button className="bs-btn-primary" style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 12 }} onClick={openCreateModal}>
            <PlusCircle size={18} /> Ajouter une Unité
          </button>
        ) : (
          <span style={{ fontSize: 13, background: "var(--paper)", border: "1px solid var(--line)", padding: "7px 14px", borderRadius: 10, color: "var(--muted)", fontWeight: 600 }}>
            Mode consultation (Lecture seule)
          </span>
        )}
      </div>

      {/* UNITÉS TABLE */}
      <div className="bs-panel" style={{ padding: 0, overflow: "hidden" }}>
        <table className="bs-table" style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--paper)", borderBottom: "1px solid var(--line)", textAlign: "left" }}>
              <th style={{ padding: "14px 18px", fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Nom de l'Unité</th>
              <th style={{ padding: "14px 18px", fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Abréviation / Symbole</th>
              <th style={{ padding: "14px 18px", fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {unites.length === 0 ? (
              <tr>
                <td colSpan={3} style={{ padding: 36, textAlign: "center", color: "var(--muted)", fontSize: 14 }}>
                  Aucune unité de vente configurée.
                </td>
              </tr>
            ) : (
              unites.slice((currentPage - 1) * pageSize, currentPage * pageSize).map(u => (
                <tr key={u.id} style={{ borderBottom: "1px solid var(--line)" }}>
                  <td style={{ padding: "14px 18px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--forest-light)", color: "var(--forest)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Scale size={18} />
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)" }}>{u.nom}</div>
                    </div>
                  </td>

                  <td style={{ padding: "14px 18px" }}>
                    <span style={{ background: "var(--forest-light)", color: "var(--forest-dark)", padding: "4px 12px", borderRadius: 20, fontSize: 12.5, fontWeight: 800 }}>
                      {u.abbreviation || u.nom}
                    </span>
                  </td>

                  <td style={{ padding: "14px 18px", textAlign: "right" }}>
                    {canManage ? (
                      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                        <button onClick={() => openEditModal(u)} className="bs-icon-btn" title="Modifier">
                          <Edit size={16} />
                        </button>
                        <button onClick={() => handleDelete(u.id)} className="bs-icon-btn" title="Supprimer" style={{ color: "#B4483A" }}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ) : (
                      <span style={{ fontSize: 12, color: "var(--muted)", fontStyle: "italic" }}>Lecture seule</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <TablePagination
          totalItems={unites.length}
          currentPage={currentPage}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(sz) => { setPageSize(sz); setCurrentPage(1); }}
        />
      </div>

      {/* MODAL CREER / MODIFIER */}
      {(modalType === "create" || modalType === "edit") && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "rgba(15, 23, 42, 0.65)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 16
        }} onClick={() => setModalType(null)}>
          <div className="bs-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440, width: "100%", borderRadius: 16, padding: 24, boxShadow: "0 20px 30px rgba(0,0,0,0.3)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, borderBottom: "1px solid var(--line)", paddingBottom: 12 }}>
              <h2 style={{ margin: 0, fontSize: 18, color: "var(--forest-dark)" }}>
                {modalType === "create" ? "Ajouter une Unité de Vente" : `Modifier : ${selectedUnite?.nom}`}
              </h2>
              <button onClick={() => setModalType(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)" }}>
                <X size={20} />
              </button>
            </div>

            {erreur && (
              <div style={{ background: "#FDF2F0", color: "#B4483A", padding: "10px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
                <AlertCircle size={16} /> {erreur}
              </div>
            )}
            {succes && (
              <div style={{ background: "#EBF7F0", color: "#1F4D3A", padding: "10px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
                <CheckCircle size={16} /> {succes}
              </div>
            )}

            <form onSubmit={modalType === "create" ? handleCreate : handleUpdate} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="bs-field">
                <label style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: 4 }}>Nom de l'Unité (ex: Kilogramme, Litre, Carton, Sac) *</label>
                <input className="bs-input" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} placeholder="ex: Kilogramme" required />
              </div>

              <div className="bs-field">
                <label style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: 4 }}>Abréviation / Symbole (ex: Kg, Litre, Carton)</label>
                <input className="bs-input" value={form.abbreviation} onChange={(e) => setForm({ ...form, abbreviation: e.target.value })} placeholder="ex: Kg" />
              </div>

              <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
                <button type="button" onClick={() => setModalType(null)} style={{ flex: 1, padding: "12px", borderRadius: 10, border: "1px solid var(--line)", background: "var(--paper)", color: "var(--ink)", fontWeight: 600, cursor: "pointer" }}>
                  Annuler
                </button>
                <button type="submit" className="bs-btn-primary" style={{ flex: 1, borderRadius: 10 }}>
                  {modalType === "create" ? "Enregistrer" : "Mettre à jour"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
