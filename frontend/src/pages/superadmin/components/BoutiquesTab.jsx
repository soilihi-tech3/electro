import React from "react";
import { Search, PlusCircle, Pencil, Sliders, PauseCircle, PlayCircle, Trash2, ShieldCheck, Building2 } from "lucide-react";
import { fcfa } from "./constants";

export default function BoutiquesTab({
  boutiques = [], search = "", setSearch, onNewBoutique, onEdit, onModules, onToggleStatus, onDelete
}) {
  const safeBoutiques = (Array.isArray(boutiques) ? boutiques : []).filter(Boolean);
  const filteredBoutiques = safeBoutiques.filter(b =>
    (b.nom || "").toLowerCase().includes((search || "").toLowerCase()) ||
    (b.slug || "").toLowerCase().includes((search || "").toLowerCase())
  );

  return (
    <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: "1px solid var(--border)", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 16 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--ink)", margin: 0, fontFamily: "serif" }}>
            Liste de Toutes les Boutiques ({filteredBoutiques.length})
          </h2>
          <p style={{ fontSize: 13, color: "var(--muted)", margin: "4px 0 0 0" }}>
            Consultez le statut, gérez le chiffre d'affaires et attribuez les droits d'accès
          </p>
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ position: "relative" }}>
            <Search size={16} color="var(--muted)" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
            <input
              type="text"
              placeholder="Rechercher une boutique..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                padding: "9px 12px 9px 36px", borderRadius: 10, border: "1px solid var(--border)",
                fontSize: 13, width: 240, outline: "none"
              }}
            />
          </div>

          <button
            onClick={onNewBoutique}
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "9px 14px",
              borderRadius: 10, background: "var(--accent)", color: "#fff", border: "none",
              fontWeight: 700, fontSize: 13, cursor: "pointer"
            }}
          >
            <PlusCircle size={15} />
            <span>Créer</span>
          </button>
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 8px" }}>
          <thead>
            <tr style={{ color: "var(--muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "left" }}>
              <th style={{ padding: "8px 16px" }}>BOUTIQUE</th>
              <th style={{ padding: "8px 16px" }}>SLUG & ACCÈS</th>
              <th style={{ padding: "8px 16px" }}>FORMULE</th>
              <th style={{ padding: "8px 16px" }}>ADMINISTRATEUR(S)</th>
              <th style={{ padding: "8px 16px" }} className="num">CHIFFRE D'AFFAIRES</th>
              <th style={{ padding: "8px 16px" }}>STATUT</th>
              <th style={{ padding: "8px 16px", textAlign: "right" }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {filteredBoutiques.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: 30, color: "var(--muted)", fontSize: 14 }}>
                  Aucune boutique trouvée.
                </td>
              </tr>
            ) : (
              filteredBoutiques.map((b) => (
                <tr key={b.id} style={{ background: "#FAFCFA", borderRadius: 12 }}>
                  <td style={{ padding: "14px 16px", fontWeight: 700, color: "var(--ink)", borderTopLeftRadius: 12, borderBottomLeftRadius: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ background: "rgba(26,60,44,0.08)", color: "var(--forest-dark)", width: 34, height: 34, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Building2 size={16} />
                      </div>
                      <div>
                        <div>{b.nom}</div>
                        <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 400 }}>ID #{b.id}</div>
                      </div>
                    </div>
                  </td>

                  <td style={{ padding: "14px 16px", fontSize: 13, color: "var(--muted)" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      <code style={{ background: "#EAEFEA", padding: "2px 6px", borderRadius: 4, fontSize: 12, color: "var(--ink)", width: "fit-content" }}>
                        /{b.slug}
                      </code>
                      {b.customDomain && (
                        <span style={{ fontSize: 11, color: "var(--forest)", fontWeight: 600 }}>
                          {b.customDomain}
                        </span>
                      )}
                    </div>
                  </td>

                  <td style={{ padding: "14px 16px", fontSize: 13 }}>
                    <span style={{ textTransform: "capitalize", fontWeight: 600, color: "var(--ink)" }}>
                      {b.formuleAbonnement || "standard"}
                    </span>
                  </td>

                  <td style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      {b.admins && b.admins.length > 0 ? (
                        b.admins.map(adm => (
                          <div key={adm.id} style={{ fontSize: 12, color: "var(--ink)", display: "flex", alignItems: "center", gap: 5 }}>
                            <ShieldCheck size={13} color="var(--forest)" />
                            <span style={{ fontWeight: 600 }}>{adm.nom}</span>
                            <span style={{ color: "var(--muted)", fontSize: 11 }}>({adm.role})</span>
                          </div>
                        ))
                      ) : (
                        <span style={{ fontSize: 12, color: "var(--muted)" }}>Aucun admin</span>
                      )}
                    </div>
                  </td>

                  <td className="num" style={{ padding: "14px 16px", fontWeight: 700, color: "var(--forest-dark)" }}>
                    {fcfa(b.chiffreAffaires || 0)}
                  </td>

                  <td style={{ padding: "14px 16px" }}>
                    <span 
                      style={{
                        padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                        background: b.statut === "active" ? "#EBF7F0" : "#FDF2F0",
                        color: b.statut === "active" ? "#1F4D3A" : "#B4483A",
                        border: `1px solid ${b.statut === "active" ? "#C4E5D3" : "#F8D7D2"}`
                      }}
                    >
                      {b.statut === "active" ? "Active" : "Suspendue"}
                    </span>
                  </td>

                  <td style={{ padding: "14px 16px", textAlign: "right", borderTopRightRadius: 12, borderBottomRightRadius: 12 }}>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      <button
                        onClick={() => onEdit(b)}
                        title="Modifier la boutique"
                        style={{
                          background: "#fff", border: "1px solid var(--border)", borderRadius: 8,
                          padding: 6, color: "var(--ink)", cursor: "pointer", display: "flex"
                        }}
                      >
                        <Pencil size={15} />
                      </button>

                      <button
                        onClick={() => onModules(b)}
                        title="Gérer les modules"
                        style={{
                          background: "#fff", border: "1px solid var(--border)", borderRadius: 8,
                          padding: 6, color: "var(--forest-dark)", cursor: "pointer", display: "flex"
                        }}
                      >
                        <Sliders size={15} />
                      </button>

                      <button
                        onClick={() => onToggleStatus(b)}
                        title={b.statut === "active" ? "Suspendre la boutique" : "Activer la boutique"}
                        style={{
                          background: b.statut === "active" ? "#FDF2F0" : "#EBF7F0",
                          border: `1px solid ${b.statut === "active" ? "#F8D7D2" : "#C4E5D3"}`,
                          borderRadius: 8, padding: 6,
                          color: b.statut === "active" ? "#B4483A" : "#1F4D3A",
                          cursor: "pointer", display: "flex"
                        }}
                      >
                        {b.statut === "active" ? <PauseCircle size={15} /> : <PlayCircle size={15} />}
                      </button>

                      <button
                        onClick={() => onDelete(b.id)}
                        title="Supprimer la boutique"
                        style={{
                          background: "#FDF2F0", border: "1px solid #F8D7D2", borderRadius: 8,
                          padding: 6, color: "#B4483A", cursor: "pointer", display: "flex"
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
