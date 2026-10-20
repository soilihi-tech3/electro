import React, { useState } from "react";
import { Globe, Store, TrendingUp, TrendingDown, CheckCircle2, XCircle, Sliders, AlertCircle } from "lucide-react";
import { MODULE_LABELS, DEFAULT_MODULES } from "./constants";

export default function ModulesTab({
  boutiques = [], onGlobalToggle, onBoutiqueModulesUpdate
}) {
  const [selectedBoutiqueId, setSelectedBoutiqueId] = useState("global"); // "global" | boutiqueId (number/string)
  const safeBoutiques = (Array.isArray(boutiques) ? boutiques : []).filter(Boolean);

  const selectedBoutique = selectedBoutiqueId !== "global" 
    ? safeBoutiques.find(b => b && String(b.id) === String(selectedBoutiqueId))
    : null;

  // Determine current active modules state
  let activeModulesMap = { ...DEFAULT_MODULES };
  if (selectedBoutiqueId !== "global" && selectedBoutique) {
    let mods = selectedBoutique.modulesActifs || {};
    if (typeof mods === "string") {
      try { mods = JSON.parse(mods); } catch (e) { mods = {}; }
    }
    activeModulesMap = { ...DEFAULT_MODULES, ...mods };
  } else {
    // Check global status across boutiques (if all have true -> true, else if any false -> false)
    // Or check first active boutique's modules
    if (safeBoutiques.length > 0) {
      const first = safeBoutiques[0];
      let mods = first?.modulesActifs || {};
      if (typeof mods === "string") {
        try { mods = JSON.parse(mods); } catch (e) { mods = {}; }
      }
      activeModulesMap = { ...DEFAULT_MODULES, ...mods };
    }
  }

  async function handleToggle(moduleKey, currentStatus) {
    const nextStatus = !currentStatus;
    if (selectedBoutiqueId === "global") {
      // Toggle for ALL boutiques
      await onGlobalToggle(moduleKey, nextStatus);
    } else if (selectedBoutique) {
      // Toggle for SPECIFIC boutique
      const updatedMap = { ...activeModulesMap, [moduleKey]: nextStatus };
      await onBoutiqueModulesUpdate(selectedBoutique.id, updatedMap);
    }
  }

  return (
    <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: "1px solid var(--border)", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
      {/* HEADER & SELECTOR */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)", margin: 0, fontFamily: "serif", display: "flex", alignItems: "center", gap: 10 }}>
            <Sliders size={22} color="var(--forest)" />
            <span>Interrupteur Global & Spécifique des Fonctionnalités</span>
          </h2>
          <p style={{ fontSize: 13, color: "var(--muted)", margin: "4px 0 0 0" }}>
            Activez ou désactivez une fonctionnalité pour <b>TOUTES les boutiques</b> ou sélectionnez une <b>boutique spécifique</b>.
          </p>
        </div>

        {/* BOUTIQUE SELECTOR DROPDOWN */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#F4F7F5", padding: "8px 14px", borderRadius: 12, border: "1px solid var(--border)" }}>
          <Store size={18} color="var(--forest-dark)" />
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)" }}>Cible :</div>
          <select
            value={selectedBoutiqueId}
            onChange={(e) => setSelectedBoutiqueId(e.target.value)}
            style={{
              padding: "7px 12px", borderRadius: 8, border: "1px solid var(--border)",
              fontSize: 13, fontWeight: 700, outline: "none", background: "#fff",
              color: selectedBoutiqueId === "global" ? "var(--forest-dark)" : "var(--accent)", cursor: "pointer"
            }}
          >
            <option value="global">TOUTES les boutiques (Mode Global)</option>
            <optgroup label="Boutiques individuelles">
              {safeBoutiques.map(b => (
                <option key={b.id} value={b.id}>{b.nom} (ID #{b.id})</option>
              ))}
            </optgroup>
          </select>
        </div>
      </div>

      {/* BANNER NOTICE */}
      <div style={{
        background: selectedBoutiqueId === "global" ? "#EBF7F0" : "#FFF4EB",
        border: `1px solid ${selectedBoutiqueId === "global" ? "#C4E5D3" : "#FFD8BF"}`,
        padding: "12px 16px", borderRadius: 12, marginBottom: 24,
        display: "flex", alignItems: "center", gap: 12, fontSize: 13,
        color: selectedBoutiqueId === "global" ? "var(--forest-dark)" : "#A04000"
      }}>
        {selectedBoutiqueId === "global" ? <Globe size={20} /> : <Store size={20} />}
        <div>
          {selectedBoutiqueId === "global" ? (
            <span><b>Mode Global sélectionné :</b> Chaque interrupteur modifié s'appliquera immédiatement à <b>l'ensemble des {safeBoutiques.length} boutiques</b> de la plateforme.</span>
          ) : (
            <span><b>Mode Boutique Spécifique :</b> Vous modifiez les fonctionnalités uniquement pour la boutique <b>« {selectedBoutique?.nom} »</b>.</span>
          )}
        </div>
      </div>

      {/* MODULES GRID */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 16 }}>
        {MODULE_LABELS.map(mod => {
          const isActive = !!activeModulesMap[mod.key];
          return (
            <div
              key={mod.key}
              style={{
                border: `2px solid ${isActive ? "var(--forest)" : "var(--line)"}`,
                borderRadius: 14, padding: 18,
                background: isActive ? "var(--card)" : "var(--paper)",
                transition: "all 0.2s ease", display: "flex", flexDirection: "column", justifyContent: "space-between"
              }}
            >
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 8 }}>
                  <div style={{ fontWeight: 800, fontSize: 15, color: "var(--ink)" }}>
                    {mod.label}
                  </div>

                  {/* STATUS BADGE WITH UP / DOWN INDICATORS */}
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 800,
                    background: isActive ? "#EBF7F0" : "#FDF2F0",
                    color: isActive ? "#1F4D3A" : "#B4483A",
                    border: `1px solid ${isActive ? "#C4E5D3" : "#F8D7D2"}`
                  }}>
                    {isActive ? (
                      <>
                        <TrendingUp size={13} color="#1F4D3A" />
                        <span>Actif</span>
                      </>
                    ) : (
                      <>
                        <TrendingDown size={13} color="#B4483A" />
                        <span>Désactivé</span>
                      </>
                    )}
                  </span>
                </div>

                <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 16px 0", lineHeight: "1.4" }}>
                  {mod.desc}
                </p>
              </div>

              {/* TOGGLE BAR */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                paddingTop: 12, borderTop: "1px solid rgba(0,0,0,0.06)"
              }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: isActive ? "var(--forest)" : "var(--muted)" }}>
                  {isActive ? "Fonctionnalité disponible" : "Bientôt disponible (Désactivée)"}
                </span>

                <button
                  onClick={() => handleToggle(mod.key, isActive)}
                  style={{
                    padding: "6px 14px", borderRadius: 20, border: "none",
                    background: isActive ? "var(--forest)" : "#CBD5E1",
                    color: "#fff", fontWeight: 700, fontSize: 12,
                    cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                    transition: "all 0.15s ease", boxShadow: isActive ? "0 2px 6px rgba(26,60,44,0.3)" : "none"
                  }}
                >
                  {isActive ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                  <span>{isActive ? "Désactiver" : "Activer"}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
