import { SkeletonTableRows } from "../../components/Skeleton.jsx";
import { toast } from "react-hot-toast";
import React, { useEffect, useState } from "react";
import { UserCheck, Edit, Trash2, Ban, CheckCircle, Search, UserPlus, Key, Mail, Phone, Calendar, AlertCircle, X, ShieldCheck } from "lucide-react";
import api from "../../api";
import TablePagination from "../../components/TablePagination";
import { useCart } from "../../context/CartContext.jsx";
import { useAuth } from "../../context/AuthContext";

export default function AdminClients() {
  const { hasPerm } = useAuth();
  const canManage = hasPerm("gerer_clients");
  const { showToast } = useCart();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatut, setFilterStatut] = useState("all");

  const [modalType, setModalType] = useState(null); // 'create' | 'edit' | 'password' | null
  const [selectedClient, setSelectedClient] = useState(null);
  const [form, setForm] = useState({ nom: "", email: "", telephone: "", motDePasse: "", statut: "actif" });
  const [erreur, setErreur] = useState("");
  const [succes, setSucces] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  function loadClients() {
    setLoading(true);
    api.get("/admin/clients")
      .then((res) => setClients(res.data || []))
      .catch((err) => console.error("Erreur de chargement des clients:", err))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadClients();
  }, []);

  function openCreateModal() {
    setSelectedClient(null);
    setForm({ nom: "", email: "", telephone: "", motDePasse: "client123", statut: "actif" });
    setErreur("");
    setSucces("");
    setModalType("create");
  }

  function openEditModal(c) {
    setSelectedClient(c);
    setForm({
      nom: c.nom || "",
      email: c.email || "",
      telephone: c.telephone || "",
      motDePasse: "",
      statut: c.statut || "actif"
    });
    setErreur("");
    setSucces("");
    setModalType("edit");
  }

  function openPasswordModal(c) {
    setSelectedClient(c);
    setForm({ ...form, motDePasse: "" });
    setErreur("");
    setSucces("");
    setModalType("password");
  }

  async function handleCreate(e) {
    e.preventDefault();
    setErreur("");
    setSucces("");
    try {
      await api.post("/admin/clients", form);
      setSucces("Nouveau compte client créé avec succès !");
      showToast("Nouveau client ajouté", "success");
      setTimeout(() => { setModalType(null); loadClients(); }, 800);
    } catch (err) {
      setErreur(err.response?.data?.message || "Impossible de créer le client.");
    }
  }

  async function handleUpdate(e) {
    e.preventDefault();
    setErreur("");
    setSucces("");
    try {
      await api.put(`/admin/clients/${selectedClient.id}`, form);
      setSucces("Profil client mis à jour avec succès !");
      showToast("Profil client modifié", "success");
      setTimeout(() => { setModalType(null); loadClients(); }, 800);
    } catch (err) {
      setErreur(err.response?.data?.message || "Impossible de modifier le client.");
    }
  }

  async function toggleStatus(c) {
    const actionText = c.statut === "actif" ? "suspendre / désactiver" : "réactiver";
    if (!window.confirm(`Voulez-vous vraiment ${actionText} le compte client de "${c.nom}" ?`)) return;

    try {
      await api.patch(`/admin/clients/${c.id}/status`);
      showToast(`Compte client ${c.statut === "actif" ? "suspendu" : "réactivé"}`, "info");
      loadClients();
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de la modification du statut.");
    }
  }

  async function handleDelete(id, nom) {
    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer définitivement le compte client "${nom}" ?`)) return;

    try {
      await api.delete(`/admin/clients/${id}`);
      showToast("Compte client supprimé", "info");
      loadClients();
    } catch (err) {
      toast.error(err.response?.data?.message || "Impossible de supprimer ce client.");
    }
  }

  const filtered = clients.filter(c => {
    const term = search.toLowerCase().trim();
    const matchSearch = !term ||
      c.nom?.toLowerCase().includes(term) ||
      c.email?.toLowerCase().includes(term) ||
      c.telephone?.includes(term);

    const matchStatut = filterStatut === "all" || c.statut === filterStatut;
    return matchSearch && matchStatut;
  });

  return (
    <>
      {/* ── TOOLBAR HEADER ── */}
      <div className="bs-toolbar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 26, margin: 0, color: "var(--forest-dark)" }}>Gestion des Clients</h1>
          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 14 }}>
            Visualisez et gérez l'ensemble des comptes clients inscrits sur votre boutique.
          </p>
        </div>

        {canManage ? (
          <button
            className="bs-btn-primary"
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 12 }}
            onClick={openCreateModal}
          >
            <UserPlus size={18} /> Ajouter un client
          </button>
        ) : (
          <span style={{ fontSize: 13, background: "var(--paper)", border: "1px solid var(--line)", padding: "7px 14px", borderRadius: 10, color: "var(--muted)", fontWeight: 600 }}>
            Mode consultation (Lecture seule)
          </span>
        )}
      </div>

      {/* ── KPI STATS CARDS ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
        <div style={{ background: "#fff", border: "1px solid var(--line)", padding: "18px 20px", borderRadius: 16, display: "flex", alignItems: "center", gap: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
          <div style={{ width: 46, height: 46, borderRadius: 12, background: "var(--forest-light)", color: "var(--forest)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <UserCheck size={22} />
          </div>
          <div>
            <div style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 600 }}>Total Clients Inscrits & Vérifiés</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: "var(--forest-dark)", marginTop: 2 }}>{clients.length}</div>
          </div>
        </div>

        <div style={{ background: "#fff", border: "1px solid var(--line)", padding: "18px 20px", borderRadius: 16, display: "flex", alignItems: "center", gap: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
          <div style={{ width: 46, height: 46, borderRadius: 12, background: "#EBF7F0", color: "#1F4D3A", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <CheckCircle size={22} />
          </div>
          <div>
            <div style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 600 }}>Clients Actifs (Autorisés)</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#1F4D3A", marginTop: 2 }}>
              {clients.filter(c => c.statut === "actif").length}
            </div>
          </div>
        </div>

        <div style={{ background: "#fff", border: "1px solid var(--line)", padding: "18px 20px", borderRadius: 16, display: "flex", alignItems: "center", gap: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
          <div style={{ width: 46, height: 46, borderRadius: 12, background: "#FDF2F0", color: "#B4483A", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Ban size={22} />
          </div>
          <div>
            <div style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 600 }}>Clients Suspendus / Inactifs</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#B4483A", marginTop: 2 }}>
              {clients.filter(c => c.statut === "suspendu").length}
            </div>
          </div>
        </div>
      </div>

      {/* ── SEARCH & FILTERS BAR ── */}
      <div style={{ display: "flex", gap: 14, marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 260 }}>
          <Search size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
          <input
            className="bs-input"
            style={{ paddingLeft: 42, background: "#fff", borderRadius: 12 }}
            placeholder="Rechercher par nom, e-mail ou téléphone..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
          />
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          {[
            { key: "all", label: "Tous les clients", count: clients.length },
            { key: "actif", label: "Actifs", count: clients.filter(c => c.statut === "actif").length },
            { key: "suspendu", label: "Suspendus", count: clients.filter(c => c.statut === "suspendu").length }
          ].map(f => (
            <button
              key={f.key}
              onClick={() => { setFilterStatut(f.key); setCurrentPage(1); }}
              style={{
                padding: "8px 14px", borderRadius: 20, fontSize: 13, fontWeight: 700,
                border: filterStatut === f.key ? "1px solid var(--forest-dark)" : "1px solid var(--line)",
                background: filterStatut === f.key ? "var(--forest-dark)" : "#fff",
                color: filterStatut === f.key ? "#fff" : "var(--ink)",
                cursor: "pointer", display: "flex", alignItems: "center", gap: 6
              }}
            >
              <span>{f.label}</span>
              <span style={{
                background: filterStatut === f.key ? "rgba(255,255,255,0.2)" : "var(--line)",
                color: filterStatut === f.key ? "#fff" : "var(--muted)",
                borderRadius: 10, padding: "1px 7px", fontSize: 11
              }}>
                {f.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── CLIENTS TABLE ── */}
      <div className="bs-panel" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <table className="bs-table" style={{ width: "100%" }}><tbody><SkeletonTableRows rows={6} cols={6} /></tbody></table>
        ) : (
          <table className="bs-table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--paper)", borderBottom: "1px solid var(--line)", textAlign: "left" }}>
                <th style={{ padding: "14px 18px", fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Client</th>
                <th style={{ padding: "14px 18px", fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Coordonnées</th>
                <th style={{ padding: "14px 18px", fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Vérification Email</th>
                <th style={{ padding: "14px 18px", fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Statut Compte</th>
                <th style={{ padding: "14px 18px", fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Date Inscription</th>
                <th style={{ padding: "14px 18px", fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 36, textAlign: "center", color: "var(--muted)", fontSize: 14 }}>
                    Aucun client trouvé.
                  </td>
                </tr>
              ) : (
                filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((c) => {
                  const isActif = c.statut === "actif";
                  const isVerified = c.isEmailVerified;

                  return (
                    <tr key={c.id} style={{ borderBottom: "1px solid var(--line)" }}>
                      <td style={{ padding: "14px 18px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{
                            width: 38, height: 38, borderRadius: "50%",
                            background: isActif ? "var(--forest-light)" : "#FDF2F0",
                            color: isActif ? "var(--forest)" : "#B4483A",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontWeight: 800, fontSize: 14
                          }}>
                            {c.nom?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)" }}>{c.nom}</div>
                            <div style={{ fontSize: 11.5, color: "var(--muted)" }}>Client #{c.id}</div>
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: "14px 18px" }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", display: "flex", alignItems: "center", gap: 6 }}>
                          <Mail size={13} color="var(--muted)" /> {c.email || "Non renseigné"}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--muted)", display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                          <Phone size={13} color="var(--muted)" /> {c.telephone || "Sans téléphone"}
                        </div>
                      </td>

                      <td style={{ padding: "14px 18px" }}>
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 5,
                          padding: "4px 10px", borderRadius: 12, fontSize: 11.5, fontWeight: 700,
                          background: isVerified ? "#EBF7F0" : "#FEF3C7",
                          color: isVerified ? "#1F4D3A" : "#D97706"
                        }}>
                          {isVerified ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
                          {isVerified ? "Email Vérifié" : "En attente OTP"}
                        </span>
                      </td>

                      <td style={{ padding: "14px 18px" }}>
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 5,
                          padding: "4px 10px", borderRadius: 12, fontSize: 11.5, fontWeight: 700,
                          background: isActif ? "#EBF7F0" : "#FDF2F0",
                          color: isActif ? "#1F4D3A" : "#B4483A"
                        }}>
                          {isActif ? <CheckCircle size={13} /> : <Ban size={13} />}
                          {isActif ? "Actif" : "Suspendu"}
                        </span>
                      </td>

                      <td style={{ padding: "14px 18px", fontSize: 12.5, color: "var(--muted)" }}>
                        {c.createdAt ? new Date(c.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "-"}
                      </td>

                      <td style={{ padding: "14px 18px", textAlign: "right" }}>
                        {canManage ? (
                          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                            <button
                              onClick={() => openEditModal(c)}
                              className="bs-icon-btn"
                              title="Modifier les coordonnées & le mot de passe"
                            >
                              <Edit size={16} />
                            </button>
                            <button
                              onClick={() => toggleStatus(c)}
                              className="bs-icon-btn"
                              title={isActif ? "Suspendre l'accès" : "Réactiver l'accès"}
                              style={{ color: isActif ? "#D97706" : "#1F4D3A" }}
                            >
                              {isActif ? <Ban size={16} /> : <CheckCircle size={16} />}
                            </button>
                            <button
                              onClick={() => handleDelete(c.id, c.nom)}
                              className="bs-icon-btn"
                              title="Supprimer définitivement"
                              style={{ color: "#B4483A" }}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: 12, color: "var(--muted)", fontStyle: "italic" }}>Lecture seule</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}

        <TablePagination
          totalItems={filtered.length}
          currentPage={currentPage}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(sz) => { setPageSize(sz); setCurrentPage(1); }}
        />
      </div>

      {/* ── MODAL AJOUTER / MODIFIER CLIENT ── */}
      {(modalType === "create" || modalType === "edit") && (
        <div
          onClick={() => setModalType(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            background: "rgba(22,52,36,0.5)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center"
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff", borderRadius: 20, padding: 32,
              maxWidth: 540, width: "90%", maxHeight: "90vh", overflowY: "auto",
              boxShadow: "0 12px 40px rgba(0,0,0,0.2)"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, borderBottom: "1px solid var(--line)", paddingBottom: 14 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 20, color: "var(--forest-dark)" }}>
                  {modalType === "create" ? "Ajouter un Client" : `Modifier : ${selectedClient?.nom}`}
                </h2>
                <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>
                  Mettez à jour les informations ou réinitialisez le mot de passe du compte client.
                </div>
              </div>
              <button onClick={() => setModalType(null)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                <X size={20} />
              </button>
            </div>

            {erreur && (
              <div style={{ background: "#FDF2F0", color: "#B4483A", padding: "12px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                <AlertCircle size={16} /> {erreur}
              </div>
            )}
            {succes && (
              <div style={{ background: "#EBF7F0", color: "#1F4D3A", padding: "12px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                <CheckCircle size={16} /> {succes}
              </div>
            )}

            <form onSubmit={modalType === "create" ? handleCreate : handleUpdate} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="bs-field">
                <label style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: 4 }}>Nom complet *</label>
                <input className="bs-input" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} placeholder="ex: Amina Ali" required />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div className="bs-field">
                  <label style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: 4 }}>Adresse Email</label>
                  <input className="bs-input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="ex: amina@gmail.com" />
                </div>

                <div className="bs-field">
                  <label style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: 4 }}>Téléphone *</label>
                  <input
                    type="tel"
                    className="bs-input"
                    value={form.telephone}
                    onChange={(e) => setForm({ ...form, telephone: e.target.value.replace(/\D/g, "") })}
                    placeholder="ex: 3321000 (chiffres uniquement)"
                    required
                  />
                </div>
              </div>

              <div className="bs-field">
                <label style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: 4 }}>
                  {modalType === "create" ? "Mot de passe initial *" : "Nouveau mot de passe (laisser vide si inchangé)"}
                </label>
                <input
                  className="bs-input"
                  type="password"
                  value={form.motDePasse}
                  onChange={(e) => setForm({ ...form, motDePasse: e.target.value })}
                  placeholder={modalType === "create" ? "Mot de passe à attribuer" : "Nouveau mot de passe"}
                  required={modalType === "create"}
                />
              </div>

              <div className="bs-field">
                <label style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: 4 }}>Statut du compte</label>
                <select className="bs-input" value={form.statut} onChange={(e) => setForm({ ...form, statut: e.target.value })}>
                  <option value="actif">Actif (Accès autorisé)</option>
                  <option value="suspendu">Suspendu (Accès bloqué)</option>
                </select>
              </div>

              <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  style={{ flex: 1, padding: "12px", borderRadius: 12, border: "1px solid var(--line)", background: "#fff", fontWeight: 600, cursor: "pointer" }}
                >
                  Annuler
                </button>
                <button type="submit" className="bs-btn-primary" style={{ flex: 1, borderRadius: 12 }}>
                  {modalType === "create" ? "Créer le compte" : "Enregistrer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
