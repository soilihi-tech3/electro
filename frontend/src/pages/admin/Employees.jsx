import React, { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { 
  PlusCircle, Edit, Trash2, Shield, Lock, CheckCircle, Ban, User, AlertCircle, X, 
  ShieldCheck, UserCheck, Key, Settings, Layers, Package, ShoppingCart, Image, 
  Eye, EyeOff, Copy, RefreshCw, Send, CreditCard, FileText, ShoppingBag, TrendingUp,
  CheckSquare, Square, Truck, Scale, Award, Users
} from "lucide-react";
import api from "../../api";
import TablePagination from "../../components/TablePagination";
import { useAuth } from "../../context/AuthContext.jsx";

export const PERMISSION_CATEGORIES = [
  {
    id: "caisse_ventes",
    titre: "Caisse & Ventes",
    desc: "Point de vente, encaissements et suivi des ventes",
    icon: ShoppingCart,
    color: "#166534",
    bg: "#DCFCE7",
    permissions: [
      { key: "gerer_caisse", label: "Accès Caisse (POS)", desc: "Encaisser les ventes comptoir au point de vente" },
      { key: "voir_ventes", label: "Voir ses propres ventes", desc: "Consulter l'historique de ses ventes uniquement" },
      { key: "voir_toutes_ventes", label: "Voir TOUTES les ventes", desc: "Consulter l'ensemble des ventes de tous les employés" },
      { key: "encaisser_paiement", label: "Encaisser un paiement", desc: "Enregistrer un paiement ou solde de dette client" },
      { key: "modifier_vente", label: "Modifier une vente directe", desc: "Ajuster les articles, prix et quantités vendus" },
      { key: "supprimer_vente", label: "Supprimer une vente", desc: "Annuler une vente et remettre les articles en stock" },
      { key: "gerer_devis", label: "Devis & Proforma", desc: "Créer, convertir, modifier et supprimer des devis" },
    ]
  },
  {
    id: "catalogue",
    titre: "Catalogue & Produits",
    desc: "Produits, marques, catégories et unités",
    icon: Package,
    color: "#1E40AF",
    bg: "#DBEAFE",
    permissions: [
      { key: "voir_produits", label: "Voir les produits (Lecture seule)", desc: "Consulter les fiches produits et stocks" },
      { key: "gerer_produits", label: "Gérer les produits (Ajout/Modif/Suppr)", desc: "Créer, modifier prix/stocks et supprimer des produits" },
      { key: "voir_categories", label: "Voir les catégories (Lecture seule)", desc: "Consulter l'arborescence des catégories" },
      { key: "gerer_categories", label: "Gérer les catégories", desc: "Ajouter, modifier ou supprimer des catégories" },
      { key: "voir_marques", label: "Voir les marques (Lecture seule)", desc: "Consulter le registre des marques" },
      { key: "gerer_marques", label: "Gérer les marques", desc: "Ajouter, modifier ou supprimer des marques" },
      { key: "voir_unites", label: "Voir les unités de vente (Lecture seule)", desc: "Consulter les unités de mesure (Kg, Litre, etc.)" },
      { key: "gerer_unites", label: "Gérer les unités de vente", desc: "Ajouter, modifier ou supprimer des unités" },
    ]
  },
  {
    id: "achats",
    titre: "Fournisseurs & Approvisionnements",
    desc: "Achats, réceptions et contacts fournisseurs",
    icon: ShoppingBag,
    color: "#854D0E",
    bg: "#FEF9C3",
    permissions: [
      { key: "voir_fournisseurs", label: "Voir les fournisseurs (Lecture seule)", desc: "Consulter les coordonnées des fournisseurs" },
      { key: "gerer_fournisseurs", label: "Gérer les fournisseurs", desc: "Ajouter, modifier et supprimer des fournisseurs" },
      { key: "voir_achats", label: "Voir les achats (Lecture seule)", desc: "Consulter le journal des réceptions et achats" },
      { key: "gerer_achats", label: "Gérer les achats & réceptions", desc: "Enregistrer ou supprimer des réapprovisionnements" },
    ]
  },
  {
    id: "clients_web",
    titre: "Clients & Commandes Web",
    desc: "Fichier clients et commandes e-commerce",
    icon: Users,
    color: "#6B21A8",
    bg: "#F3E8FF",
    permissions: [
      { key: "voir_clients", label: "Voir les clients (Lecture seule)", desc: "Consulter la base clients et coordonnées" },
      { key: "gerer_clients", label: "Gérer les clients", desc: "Créer, modifier les coordonnées et statuts clients" },
      { key: "gerer_commandes", label: "Gérer les commandes web", desc: "Valider, assigner et traiter les livraisons en ligne" },
    ]
  },
  {
    id: "rapports_admin",
    titre: "Rapports & Paramètres",
    desc: "Bilan financier, statistiques et configuration",
    icon: TrendingUp,
    color: "#991B1B",
    bg: "#FEE2E2",
    permissions: [
      { key: "voir_dashboard", label: "Tableau de bord général", desc: "Aperçu global des indicateurs et graphiques" },
      { key: "voir_bilan", label: "Bilan Financier & Rentabilité", desc: "Consulter le CA, dépenses, marges nettes et dettes" },
      { key: "gerer_parametres", label: "Paramètres Boutique", desc: "Coordonnées, devise et réglages généraux" },
    ]
  }
];

export const ALL_PERMISSION_KEYS = PERMISSION_CATEGORIES.flatMap(c => c.permissions.map(p => p.key));

export default function AdminEmployees() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [modalType, setModalType] = useState(null); // 'create' | 'edit' | 'permissions' | 'credentials' | null
  const [selectedUser, setSelectedUser] = useState(null);
  const [createdCredentials, setCreatedCredentials] = useState(null);

  const [form, setForm] = useState({ 
    nom: "", email: "", telephone: "", motDePasse: "", role: "employe", permissions: ["voir_dashboard", "gerer_commandes"] 
  });
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);

  const [erreur, setErreur] = useState("");
  const [succes, setSucces] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  function load() { 
    api.get("/admin/employees")
      .then((res) => setUsers(res.data || []))
      .catch(() => {}); 
  }
  
  useEffect(load, []);

  function generateRandomPassword() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$";
    let pwd = "";
    for (let i = 0; i < 10; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setForm((f) => ({ ...f, motDePasse: pwd }));
    setShowPassword(true);
  }

  function openCreateModal() {
    const randomPwd = Math.random().toString(36).slice(-8) + "A1!";
    setForm({ 
      nom: "", 
      email: "", 
      telephone: "", 
      motDePasse: randomPwd, 
      role: "employe", 
      permissions: ["voir_dashboard", "gerer_commandes"] 
    });
    setShowPassword(true);
    setErreur("");
    setSucces("");
    setModalType("create");
  }

  function openEditModal(u) {
    setSelectedUser(u);
    setForm({
      nom: u.nom || "",
      email: u.email || "",
      telephone: u.telephone || "",
      motDePasse: "",
      role: u.role || "employe",
      permissions: Array.isArray(u.permissions) ? u.permissions : []
    });
    setShowPassword(false);
    setErreur("");
    setSucces("");
    setModalType("edit");
  }

  function openPermissionsModal(u) {
    setSelectedUser(u);
    setForm({
      ...u,
      role: u.role || "employe",
      permissions: Array.isArray(u.permissions) ? u.permissions : []
    });
    setErreur("");
    setSucces("");
    setModalType("permissions");
  }

  async function handleCreate(e) {
    e.preventDefault();
    setErreur("");
    setSucces("");
    try {
      const res = await api.post("/admin/employees", form);
      const createdData = res.data;
      
      setCreatedCredentials({
        nom: createdData.nom,
        identifiant: createdData.email || createdData.telephone,
        email: createdData.email,
        telephone: createdData.telephone,
        motDePasse: createdData.generatedPassword || form.motDePasse,
        role: createdData.role === "admin" ? "Administrateur" : "Employé"
      });

      setModalType("credentials");
      load();
    } catch (err) {
      setErreur(err.response?.data?.message || "Impossible de créer l'utilisateur.");
    }
  }

  async function handleUpdate(e) {
    e?.preventDefault?.();
    setErreur("");
    setSucces("");
    try {
      await api.put(`/admin/employees/${selectedUser.id}`, form);
      setSucces("Utilisateur mis à jour avec succès !");
      setTimeout(() => { setModalType(null); load(); }, 900);
    } catch (err) {
      setErreur(err.response?.data?.message || "Impossible de mettre à jour l'utilisateur.");
    }
  }

  async function toggleStatus(u) {
    if (currentUser && currentUser.id === u.id) {
      toast.error("Vous ne pouvez pas suspendre votre propre compte administrateur actuellement connecté.");
      return;
    }

    const actionText = u.statut === "actif" ? "suspendre / désactiver" : "réactiver";
    const confirmMessage = `Voulez-vous vraiment ${actionText} le compte de "${u.nom}" (${u.email}) ?`;
    
    if (!window.confirm(confirmMessage)) return;

    try {
      await api.patch(`/admin/employees/${u.id}/status`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de la modification du statut.");
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer cet utilisateur ?")) return;
    try {
      await api.delete(`/admin/employees/${id}`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Impossible de supprimer cet utilisateur.");
    }
  }

  function togglePermissionKey(key) {
    setForm((prev) => {
      const currentPerms = prev.permissions || [];
      if (currentPerms.includes(key)) {
        return { ...prev, permissions: currentPerms.filter(k => k !== key) };
      } else {
        return { ...prev, permissions: [...currentPerms, key] };
      }
    });
  }

  function toggleCategory(cat) {
    const catKeys = cat.permissions.map(p => p.key);
    setForm((prev) => {
      const currentPerms = prev.permissions || [];
      const hasAll = catKeys.every(k => currentPerms.includes(k));
      let newPerms;
      if (hasAll) {
        newPerms = currentPerms.filter(k => !catKeys.includes(k));
      } else {
        newPerms = Array.from(new Set([...currentPerms, ...catKeys]));
      }
      return { ...prev, permissions: newPerms };
    });
  }

  function toggleAllPermissions() {
    setForm((prev) => {
      const currentPerms = prev.permissions || [];
      const hasAll = ALL_PERMISSION_KEYS.every(k => currentPerms.includes(k));
      return {
        ...prev,
        permissions: hasAll ? [] : [...ALL_PERMISSION_KEYS]
      };
    });
  }

  function renderPermissionsSelector() {
    const activeCount = (form.permissions || []).length;
    const allCount = ALL_PERMISSION_KEYS.length;
    const isAllSelected = allCount > 0 && activeCount === allCount;

    return (
      <div style={{ marginTop: 10, background: "var(--paper)", padding: 16, borderRadius: 16, border: "1px solid var(--line)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 13.5, color: "var(--forest-dark)" }}>
              Droits d'accès granulaires ({activeCount}/{allCount} actifs)
            </div>
            <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>
              Configurez précisément ce que cet employé peut voir, ajouter, modifier ou supprimer.
            </div>
          </div>

          <button
            type="button"
            onClick={toggleAllPermissions}
            style={{
              padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700,
              background: isAllSelected ? "#FEE2E2" : "#DCFCE7",
              color: isAllSelected ? "#991B1B" : "#166534",
              border: isAllSelected ? "1px solid #FECACA" : "1px solid #BBF7D0",
              cursor: "pointer", display: "flex", alignItems: "center", gap: 6
            }}
          >
            {isAllSelected ? <Square size={13} /> : <CheckSquare size={13} />}
            {isAllSelected ? "Tout décocher" : "Tout cocher"}
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {PERMISSION_CATEGORIES.map((cat) => {
            const CatIcon = cat.icon;
            const catKeys = cat.permissions.map(p => p.key);
            const activeInCat = catKeys.filter(k => (form.permissions || []).includes(k)).length;
            const isCatAll = activeInCat === catKeys.length;

            return (
              <div 
                key={cat.id} 
                style={{
                  background: "#fff",
                  borderRadius: 14,
                  border: "1px solid var(--line)",
                  overflow: "hidden"
                }}
              >
                {/* Header de la catégorie */}
                <div 
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "10px 14px", background: "rgba(0,0,0,0.02)", borderBottom: "1px solid var(--line)"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: cat.bg, color: cat.color, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <CatIcon size={16} />
                    </div>
                    <div>
                      <span style={{ fontWeight: 800, fontSize: 13, color: "var(--forest-dark)" }}>{cat.titre}</span>
                      <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: 6 }}>({cat.desc})</span>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10,
                      background: activeInCat > 0 ? cat.bg : "var(--line)",
                      color: activeInCat > 0 ? cat.color : "var(--muted)"
                    }}>
                      {activeInCat}/{cat.permissions.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleCategory(cat)}
                      style={{
                        padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                        background: "#fff", border: "1px solid var(--line)", color: "var(--forest-dark)",
                        cursor: "pointer"
                      }}
                    >
                      {isCatAll ? "Décocher" : "Cocher tout"}
                    </button>
                  </div>
                </div>

                {/* Grille des permissions de la catégorie */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: 10 }}>
                  {cat.permissions.map((item) => {
                    const checked = (form.permissions || []).includes(item.key);

                    return (
                      <label
                        key={item.key}
                        onClick={() => togglePermissionKey(item.key)}
                        style={{
                          display: "flex", alignItems: "flex-start", gap: 10,
                          padding: "8px 10px", borderRadius: 10,
                          border: checked ? `1.5px solid ${cat.color}` : "1px solid var(--line)",
                          background: checked ? cat.bg + "40" : "#fafafa",
                          cursor: "pointer", transition: "all 0.12s"
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {}}
                          style={{ width: 16, height: 16, marginTop: 2, accentColor: cat.color, cursor: "pointer" }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: checked ? 800 : 600, color: checked ? "var(--forest-dark)" : "var(--ink)" }}>
                            {item.label}
                          </div>
                          <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 1, lineHeight: 1.25 }}>
                            {item.desc}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function copyCredentialsToClipboard() {
    if (!createdCredentials) return;
    const textToCopy = `Compte ${createdCredentials.role} créé avec succès !\nNom: ${createdCredentials.nom}\nIdentifiant: ${createdCredentials.identifiant}\nMot de passe temporaire: ${createdCredentials.motDePasse}\n\nNote: Le mot de passe devra être changé lors de la première connexion.`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  }

  return (
    <>
      {/* ── HEADER TOOLBAR ── */}
      <div className="bs-toolbar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 26, margin: 0, color: "var(--forest-dark)" }}>Gestion des Utilisateurs & Droits d'Accès</h1>
          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 14 }}>
            Gérez votre équipe, attribuez le rôle (Admin ou Employé) et configurez les droits d'accès granulaires.
          </p>
        </div>
        <button 
          className="bs-btn-primary" 
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 12 }} 
          onClick={openCreateModal}
        >
          <PlusCircle size={18} /> Ajouter un utilisateur
        </button>
      </div>

      {/* ── TABLE UTILISATEURS ── */}
      <div className="bs-panel" style={{ padding: 0, overflow: "hidden" }}>
        <table className="bs-table" style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--paper)", borderBottom: "1px solid var(--line)", textAlign: "left" }}>
              <th style={{ padding: "14px 18px", fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Utilisateur</th>
              <th style={{ padding: "14px 18px", fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Contact</th>
              <th style={{ padding: "14px 18px", fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Rôle & Accès</th>
              <th style={{ padding: "14px 18px", fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Statut</th>
              <th style={{ padding: "14px 18px", fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: 36, textAlign: "center", color: "var(--muted)", fontSize: 14 }}>
                  Aucun utilisateur enregistré pour le moment.
                </td>
              </tr>
            ) : (
              users.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((u) => {
                const isActif = u.statut === "actif";
                const isAdmin = u.role === "admin";
                const perms = Array.isArray(u.permissions) ? u.permissions : [];

                return (
                  <tr key={u.id} style={{ borderBottom: "1px solid var(--line)" }}>
                    <td style={{ padding: "14px 18px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{
                          width: 38, height: 38, borderRadius: "50%", 
                          background: isAdmin ? "var(--forest)" : isActif ? "var(--forest-light)" : "#FDF2F0",
                          color: isAdmin ? "#fff" : isActif ? "var(--forest)" : "#B4483A", 
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontWeight: 800, fontSize: 14
                        }}>
                          {u.nom?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)" }}>{u.nom}</div>
                          <div style={{ fontSize: 11.5, color: "var(--muted)" }}>ID #{u.id}</div>
                        </div>
                      </div>
                    </td>

                    <td style={{ padding: "14px 18px" }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{u.email || "—"}</div>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>{u.telephone || "Sans téléphone"}</div>
                    </td>

                    <td style={{ padding: "14px 18px" }}>
                      {isAdmin ? (
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 6,
                          background: "var(--forest-light)", border: "1px solid var(--forest-light)",
                          borderRadius: 20, padding: "5px 12px", fontSize: 12, fontWeight: 800, color: "var(--forest-dark)"
                        }}>
                          <ShieldCheck size={14} color="var(--forest)" /> Admin (Accès Total)
                        </span>
                      ) : (
                        <button
                          onClick={() => openPermissionsModal(u)}
                          style={{
                            background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 20,
                            padding: "5px 12px", fontSize: 12, fontWeight: 700, color: "var(--forest-dark)",
                            cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6
                          }}
                        >
                          <Shield size={14} color="var(--forest)" />
                          {perms.length} accès attribué{perms.length > 1 ? "s" : ""}
                        </button>
                      )}
                    </td>

                    <td style={{ padding: "14px 18px" }}>
                      <span
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 5,
                          padding: "4px 10px", borderRadius: 12, fontSize: 11.5, fontWeight: 700,
                          background: isActif ? "#EBF7F0" : "#FDF2F0",
                          color: isActif ? "#1F4D3A" : "#B4483A"
                        }}
                      >
                        {isActif ? <CheckCircle size={13} /> : <Ban size={13} />}
                        {isActif ? "Actif" : "Suspendu"}
                      </span>
                    </td>

                    <td style={{ padding: "14px 18px", textAlign: "right" }}>
                      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                        {!isAdmin && (
                          <button
                            onClick={() => openPermissionsModal(u)}
                            className="bs-icon-btn"
                            title="Gérer les droits d'accès"
                            style={{ color: "var(--forest)" }}
                          >
                            <Shield size={16} />
                          </button>
                        )}
                        <button
                          onClick={() => openEditModal(u)}
                          className="bs-icon-btn"
                          title="Modifier l'utilisateur"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => toggleStatus(u)}
                          className="bs-icon-btn"
                          title={isActif ? "Suspendre l'accès" : "Activer l'accès"}
                          style={{ color: isActif ? "#D97706" : "#1F4D3A" }}
                        >
                          {isActif ? <Ban size={16} /> : <CheckCircle size={16} />}
                        </button>
                        <button
                          onClick={() => handleDelete(u.id)}
                          className="bs-icon-btn"
                          title="Supprimer"
                          style={{ color: "#B4483A" }}
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
        <TablePagination
          totalItems={users.length}
          currentPage={currentPage}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(sz) => { setPageSize(sz); setCurrentPage(1); }}
        />
      </div>

      {/* ── STANDALONE PAGE MODAL: AJOUTER / MODIFIER UN UTILISATEUR ── */}
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
              maxWidth: 780, width: "92%", maxHeight: "90vh", overflowY: "auto",
              boxShadow: "0 12px 40px rgba(0,0,0,0.2)"
            }}
          >
            {/* Modal Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, borderBottom: "1px solid var(--line)", paddingBottom: 14 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 20, color: "var(--forest-dark)" }}>
                  {modalType === "create" ? "Ajouter un nouvel Utilisateur" : `Modifier l'utilisateur : ${selectedUser?.nom}`}
                </h2>
                <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>
                  Renseignez les coordonnées et définissez le rôle et les autorisations.
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
              {/* Informational Inputs */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div className="bs-field">
                  <label style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: 4 }}>Nom complet *</label>
                  <input className="bs-input" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} placeholder="ex: Ousmane Sow" required />
                </div>

                <div className="bs-field">
                  <label style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: 4 }}>Adresse Email</label>
                  <input className="bs-input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="ex: ousmane@marche-vert.com" />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div className="bs-field">
                  <label style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: 4 }}>Téléphone</label>
                  <input
                    type="tel"
                    className="bs-input"
                    value={form.telephone}
                    onChange={(e) => setForm({ ...form, telephone: e.target.value.replace(/\D/g, "") })}
                    placeholder="ex: 3341234 (chiffres uniquement)"
                  />
                </div>

                <div className="bs-field" style={{ position: "relative" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <label style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)" }}>
                      {modalType === "create" ? "Mot de passe généré *" : "Mot de passe (facultatif)"}
                    </label>
                    {modalType === "create" && (
                      <button
                        type="button"
                        onClick={generateRandomPassword}
                        style={{ background: "none", border: "none", color: "var(--forest)", fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                      >
                        <RefreshCw size={12} /> Régénérer
                      </button>
                    )}
                  </div>
                  <div style={{ position: "relative" }}>
                    <input 
                      className="bs-input" 
                      type={showPassword ? "text" : "password"} 
                      style={{ paddingRight: 40 }}
                      placeholder={modalType === "create" ? "Mot de passe" : "Laisser vide si inchangé"} 
                      value={form.motDePasse} 
                      onChange={(e) => setForm({ ...form, motDePasse: e.target.value })} 
                      required={modalType === "create"} 
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                        background: "none", border: "none", cursor: "pointer", color: "var(--muted)"
                      }}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* RÔLE SELECTION CARDS */}
              <div style={{ marginTop: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 800, color: "var(--forest-dark)", display: "block", marginBottom: 8 }}>
                  Sélectionnez le Rôle de l'utilisateur :
                </label>
                
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {/* Option 1: Admin */}
                  <div
                    onClick={() => setForm({ ...form, role: "admin" })}
                    style={{
                      border: form.role === "admin" ? "2px solid var(--forest)" : "1px solid var(--line)",
                      background: form.role === "admin" ? "var(--forest-light)" : "var(--paper)",
                      borderRadius: 12, padding: 14, cursor: "pointer", transition: "all 0.15s"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <ShieldCheck size={18} color="var(--forest)" />
                      <span style={{ fontWeight: 800, fontSize: 14, color: "var(--forest-dark)" }}>Administrateur</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--muted)" }}>
                      Accès complet et illimité à tous les menus, statistiques, paramètres et gestion des utilisateurs.
                    </div>
                  </div>

                  {/* Option 2: Employé */}
                  <div
                    onClick={() => setForm({ ...form, role: "employe" })}
                    style={{
                      border: form.role === "employe" ? "2px solid var(--forest)" : "1px solid var(--line)",
                      background: form.role === "employe" ? "var(--forest-light)" : "var(--paper)",
                      borderRadius: 12, padding: 14, cursor: "pointer", transition: "all 0.15s"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <UserCheck size={18} color="var(--forest)" />
                      <span style={{ fontWeight: 800, fontSize: 14, color: "var(--forest-dark)" }}>Employé</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--muted)" }}>
                      Accès restreint. Vous choisissez exactement les menus auxquels l'employé aura accès.
                    </div>
                  </div>
                </div>
              </div>

              {/* GRANULAR PERMISSIONS MATRIX IF ROLE IS EMPLOYE */}
              {form.role === "employe" ? (
                renderPermissionsSelector()
              ) : (
                <div style={{ background: "var(--forest-light)", borderRadius: 12, padding: 12, color: "var(--forest-dark)", fontSize: 12.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                  <ShieldCheck size={18} color="var(--forest)" />
                  En tant qu'Admin, cet utilisateur bénéficiera automatiquement de la totalité des accès.
                </div>
              )}

              {/* Form Buttons */}
              <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
                <button 
                  type="button" 
                  onClick={() => setModalType(null)} 
                  style={{ flex: 1, padding: "12px", borderRadius: 12, border: "1px solid var(--line)", background: "#fff", fontWeight: 600, cursor: "pointer" }}
                >
                  Annuler
                </button>
                <button type="submit" className="bs-btn-primary" style={{ flex: 1, borderRadius: 12 }}>
                  {modalType === "create" ? "Créer l'utilisateur & envoyer identifiants" : "Enregistrer les modifications"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: CONFIRMATION IDENTIFIANTS APRÈS CRÉATION ── */}
      {modalType === "credentials" && createdCredentials && (
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
              maxWidth: 520, width: "90%",
              boxShadow: "0 12px 40px rgba(0,0,0,0.2)",
              textAlign: "center"
            }}
          >
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#EBF7F0", color: "#1F4D3A", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <CheckCircle size={32} />
            </div>

            <h2 style={{ margin: "0 0 8px", fontSize: 20, color: "var(--forest-dark)" }}>Compte créé avec succès !</h2>
            <p style={{ fontSize: 13.5, color: "var(--muted)", margin: "0 0 20px" }}>
              Un e-mail d'accueil avec ces identifiants a été envoyé {createdCredentials.email ? `à ${createdCredentials.email}` : "à l'utilisateur"}.
            </p>

            <div style={{ background: "var(--paper)", padding: 20, borderRadius: 14, border: "1px solid var(--line)", textAlign: "left", marginBottom: 20 }}>
              <div style={{ fontSize: 13, marginBottom: 8, color: "var(--ink)" }}>
                <strong>Nom complet :</strong> {createdCredentials.nom}
              </div>
              <div style={{ fontSize: 13, marginBottom: 8, color: "var(--ink)" }}>
                <strong>Identifiant :</strong> <span style={{ fontFamily: "monospace", color: "var(--forest-dark)", fontWeight: 700 }}>{createdCredentials.identifiant}</span>
              </div>
              <div style={{ fontSize: 13, color: "var(--ink)" }}>
                <strong>Mot de passe générique :</strong> <span style={{ fontFamily: "monospace", color: "#163424", fontWeight: 800, background: "#E2E8F0", padding: "2px 8px", borderRadius: 6 }}>{createdCredentials.motDePasse}</span>
              </div>
            </div>

            <div style={{ fontSize: 12.5, color: "#D97706", background: "#FEF3C7", padding: "10px 14px", borderRadius: 10, marginBottom: 20, fontWeight: 600, display: "flex", alignItems: "center", gap: 8, textAlign: "left" }}>
              <Key size={16} /> À la 1ère connexion, cet utilisateur devra obligatoirement modifier son mot de passe.
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <button
                type="button"
                onClick={copyCredentialsToClipboard}
                style={{
                  flex: 1, padding: "12px", borderRadius: 12, border: "1px solid var(--forest)",
                  background: copied ? "var(--forest)" : "#fff", color: copied ? "#fff" : "var(--forest)",
                  fontWeight: 700, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8
                }}
              >
                {copied ? <CheckCircle size={16} /> : <Copy size={16} />}
                {copied ? "Copié !" : "Copier les identifiants"}
              </button>
              <button
                type="button"
                onClick={() => setModalType(null)}
                className="bs-btn-primary"
                style={{ flex: 1, borderRadius: 12 }}
              >
                Terminer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: ACCÈS ET PERMISSIONS SEULES ── */}
      {modalType === "permissions" && (
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
              maxWidth: 780, width: "92%", maxHeight: "90vh", overflowY: "auto",
              boxShadow: "0 12px 40px rgba(0,0,0,0.2)"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, color: "var(--forest-dark)" }}>Droits d'accès & Autorisations</h2>
                <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>{selectedUser?.nom} ({selectedUser?.email})</div>
              </div>
              <button onClick={() => setModalType(null)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                <X size={20} />
              </button>
            </div>

            {succes && (
              <div style={{ background: "#EBF7F0", color: "#1F4D3A", padding: "10px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
                <CheckCircle size={16} /> {succes}
              </div>
            )}

            {renderPermissionsSelector()}

            <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
              <button type="button" onClick={() => setModalType(null)} style={{ flex: 1, padding: "12px", borderRadius: 12, border: "1px solid var(--line)", background: "#fff", fontWeight: 600, cursor: "pointer" }}>
                Fermer
              </button>
              <button type="button" onClick={handleUpdate} className="bs-btn-primary" style={{ flex: 1, borderRadius: 12 }}>
                Enregistrer les droits
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
