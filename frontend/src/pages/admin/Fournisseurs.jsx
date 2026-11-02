import React, { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { PlusCircle, Edit, Trash2, Building, Phone, Mail, MapPin, X, CheckCircle, AlertCircle, Search } from "lucide-react";
import api from "../../api";
import TablePagination from "../../components/TablePagination";
import { useAuth } from "../../context/AuthContext";

export default function Fournisseurs() {
  const { hasPerm } = useAuth();
  const canManage = hasPerm("gerer_fournisseurs");
  const [fournisseurs, setFournisseurs] = useState([]);
  const [modalType, setModalType] = useState(null); // 'create' | 'edit' | null
  const [selectedFourn, setSelectedFourn] = useState(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ nom: "", telephone: "", email: "", adresse: "", notes: "" });
  const [erreur, setErreur] = useState("");
  const [succes, setSucces] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  function load() {
    api.get("/admin/fournisseurs")
      .then(res => setFournisseurs(res.data || []))
      .catch(() => {});
  }

  useEffect(load, []);

  const filteredFournisseurs = fournisseurs.filter(f => {
    const q = search.trim().toLowerCase();
    return !q || f.nom.toLowerCase().includes(q) || (f.telephone && f.telephone.includes(q)) || (f.email && f.email.toLowerCase().includes(q));
  });

  function openCreateModal() {
    setForm({ nom: "", telephone: "", email: "", adresse: "", notes: "" });
    setErreur("");
    setSucces("");
    setModalType("create");
  }

  function openEditModal(f) {
    setSelectedFourn(f);
    setForm({
      nom: f.nom || "",
      telephone: f.telephone || "",
      email: f.email || "",
      adresse: f.adresse || "",
      notes: f.notes || ""
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
      await api.post("/admin/fournisseurs", form);
      setSucces("Fournisseur créé avec succès !");
      setTimeout(() => { setModalType(null); load(); }, 800);
    } catch (err) {
      setErreur(err.response?.data?.message || "Impossible de créer le fournisseur.");
    }
  }

  async function handleUpdate(e) {
    e.preventDefault();
    setErreur("");
    setSucces("");
    try {
      await api.put(`/admin/fournisseurs/${selectedFourn.id}`, form);
      setSucces("Fournisseur mis à jour !");
      setTimeout(() => { setModalType(null); load(); }, 800);
    } catch (err) {
      setErreur(err.response?.data?.message || "Impossible de mettre à jour le fournisseur.");
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer ce fournisseur ?")) return;
    try {
      await api.delete(`/admin/fournisseurs/${id}`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Impossible de supprimer ce fournisseur.");
    }
  }

  return (
    <>
      <div className="bs-toolbar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 26, margin: 0, color: "var(--forest-dark)" }}>Gestion des Fournisseurs</h1>
          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 14 }}>
            Gérez la liste de vos partenaires, fournisseurs de produits et leurs coordonnées.
          </p>
        </div>
        {canManage ? (
          <button className="bs-btn-primary" style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 12 }} onClick={openCreateModal}>
            <PlusCircle size={18} /> Ajouter un Fournisseur
          </button>
        ) : (
          <span style={{ fontSize: 13, background: "var(--paper)", border: "1px solid var(--line)", padding: "7px 14px", borderRadius: 10, color: "var(--muted)", fontWeight: 600 }}>
            Mode consultation (Lecture seule)
          </span>
        )}
      </div>

      {/* SEARCH BAR */}
      <div className="bs-panel" style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ position: "relative", maxWidth: 400 }}>
          <Search size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
          <input
            className="bs-input"
            placeholder="Rechercher par nom, téléphone, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 38, borderRadius: 10, fontSize: 13.5, height: 38 }}
          />
        </div>
      </div>

      {/* FOURNISSEURS TABLE */}
      <div className="bs-panel" style={{ padding: 0, overflow: "hidden" }}>
        <table className="bs-table" style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--paper)", borderBottom: "1px solid var(--line)", textAlign: "left" }}>
              <th style={{ padding: "14px 18px", fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Fournisseur</th>
              <th style={{ padding: "14px 18px", fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Téléphone</th>
              <th style={{ padding: "14px 18px", fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Email & Adresse</th>
              <th style={{ padding: "14px 18px", fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Notes</th>
              <th style={{ padding: "14px 18px", fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredFournisseurs.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: 36, textAlign: "center", color: "var(--muted)", fontSize: 14 }}>
                  Aucun fournisseur enregistré.
                </td>
              </tr>
            ) : (
              filteredFournisseurs.slice((currentPage - 1) * pageSize, currentPage * pageSize).map(f => (
                <tr key={f.id} style={{ borderBottom: "1px solid var(--line)" }}>
                  <td style={{ padding: "14px 18px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 38, height: 38, borderRadius: "50%", background: "var(--forest-light)", color: "var(--forest)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>
                        <Building size={18} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)" }}>{f.nom}</div>
                        <div style={{ fontSize: 11.5, color: "var(--muted)" }}>ID #{f.id}</div>
                      </div>
                    </div>
                  </td>

                  <td style={{ padding: "14px 18px" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--forest-dark)", display: "flex", alignItems: "center", gap: 6 }}>
                      <Phone size={13} color="var(--forest)" /> {f.telephone || "Non renseigné"}
                    </div>
                  </td>

                  <td style={{ padding: "14px 18px" }}>
                    <div style={{ fontSize: 13, color: "var(--ink)", fontWeight: 500 }}>{f.email || "Non renseigné"}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{f.adresse || "Sans adresse"}</div>
                  </td>

                  <td style={{ padding: "14px 18px" }}>
                    <div style={{ fontSize: 12.5, color: "var(--muted)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {f.notes || "—"}
                    </div>
                  </td>

                  <td style={{ padding: "14px 18px", textAlign: "right" }}>
                    {canManage ? (
                      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                        <button onClick={() => openEditModal(f)} className="bs-icon-btn" title="Modifier">
                          <Edit size={16} />
                        </button>
                        <button onClick={() => handleDelete(f.id)} className="bs-icon-btn" title="Supprimer" style={{ color: "#B4483A" }}>
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
          totalItems={filteredFournisseurs.length}
          currentPage={currentPage}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(sz) => { setPageSize(sz); setCurrentPage(1); }}
        />
      </div>

      {/* MODAL CREER / MODIFIER */}
      {(modalType === "create" || modalType === "edit") && (
        <div className="bs-modal-bg" onClick={() => setModalType(null)}>
          <div className="bs-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500, width: "90%" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 18, color: "var(--forest-dark)" }}>
                {modalType === "create" ? "Ajouter un Fournisseur" : `Modifier : ${selectedFourn?.nom}`}
              </h2>
              <button onClick={() => setModalType(null)} style={{ background: "none", border: "none", cursor: "pointer" }}>
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

            <form onSubmit={modalType === "create" ? handleCreate : handleUpdate} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="bs-field">
                <label style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: 4 }}>Nom de la Société / Fournisseur *</label>
                <input className="bs-input" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} placeholder="ex: Agro Distribution Sarl" required />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="bs-field">
                  <label style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: 4 }}>Téléphone</label>
                  <input className="bs-input" value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} placeholder="ex: +221 77 100 20 30" />
                </div>

                <div className="bs-field">
                  <label style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: 4 }}>Email</label>
                  <input className="bs-input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="ex: contact@agro.sn" />
                </div>
              </div>

              <div className="bs-field">
                <label style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: 4 }}>Adresse Physique</label>
                <input className="bs-input" value={form.adresse} onChange={(e) => setForm({ ...form, adresse: e.target.value })} placeholder="ex: Zone Industrielle Dakar" />
              </div>

              <div className="bs-field">
                <label style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: 4 }}>Notes & Remarques</label>
                <textarea className="bs-input" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="ex: Fournisseur principal de fruits secs..." />
              </div>

              <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
                <button type="button" onClick={() => setModalType(null)} style={{ flex: 1, padding: "12px", borderRadius: 10, border: "1px solid var(--line)", background: "#fff", fontWeight: 600, cursor: "pointer" }}>
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
