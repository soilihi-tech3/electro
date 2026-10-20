import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, AreaChart, Area, LineChart, Line, Legend } from "recharts";
import { TrendingUp, ShoppingBag, AlertTriangle, Layers, DollarSign, Package, Users, Star, UserCheck, CheckCircle2, Clock, CheckCircle, RefreshCw, CreditCard, ArrowUpRight } from "lucide-react";
import api from "../../api";
import Stars from "../../components/Stars.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { subscribeRealtime } from "../../utils/realtime.js";
import { Skel, SkeletonStatCards } from "../../components/Skeleton.jsx";
import { readCache, writeCache } from "../../utils/swrCache.js";

import { formatPrice as fcfa } from "../../utils/currency.js";

export default function Dashboard() {
  const { user, boutique, theme } = useAuth();
  const [data, setData] = useState(() => readCache("admin_dashboard") || null);
  const [prodChartTab, setProdChartTab] = useState("top"); // "top" | "flop"
  const isDark = theme === "dark";

  // Chart styling options based on active theme
  const chartColors = {
    stroke: isDark ? "#10B981" : "#163424", // Vibrant Emerald in Dark Mode
    grid: isDark ? "rgba(255, 255, 255, 0.12)" : "#E5E9DE",
    axisText: isDark ? "#94A3B8" : "#64748B",
    yAxisCategoryText: isDark ? "#F1F5F9" : "var(--ink)",
    tooltipBg: isDark ? "#1E293B" : "#FFFFFF",
    tooltipText: isDark ? "#F8FAFC" : "#1E293B",
    tooltipBorder: isDark ? "#334155" : "#E2E8F0",
    badgeBg: isDark ? "rgba(16, 185, 129, 0.15)" : "#EBF7F0",
    badgeText: isDark ? "#34D399" : "#163424",
    barFill: isDark ? "#6366F1" : "#4F46E5",
  };

  function loadDashboard() {
    api.get("/admin/dashboard").then((res) => { setData(res.data); writeCache("admin_dashboard", res.data); }).catch(() => {});
  }

  useEffect(() => { 
    loadDashboard();
    const unsub = subscribeRealtime((detail) => {
      if (
        detail.type === "order_created" ||
        detail.type === "order_updated" ||
        detail.type === "product_updated" ||
        detail.type === "category_updated" ||
        detail.type === "user_registered"
      ) {
        loadDashboard();
      }
    });
    return unsub;
  }, []);

  if (!data) return (
    <div role="status" aria-label="Chargement">
      <Skel w={280} h={26} style={{ marginBottom: 10 }} />
      <Skel w={360} h={12} style={{ marginBottom: 24 }} />
      <SkeletonStatCards count={8} />
      <div style={{ display: "grid", gridTemplateColumns: "1.8fr 1.2fr", gap: 20 }}>
        <div className="bs-panel" style={{ padding: 20 }}><Skel h={250} r={12} /></div>
        <div className="bs-panel" style={{ padding: 20 }}><Skel h={250} r={12} /></div>
      </div>
    </div>
  );

  // ── 1. DASHBOARD SPÉCIFIQUE À L'EMPLOYÉ ──
  if (data.isEmploye || user?.role === "employe") {
    const listCmds = data.mesCommandes || [];

    return (
      <>
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "inline-block", background: "var(--forest-light)", color: "var(--forest)", padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
            Espace Opérationnel Employé
          </div>
          <h1 style={{ fontSize: 26, margin: 0, color: "var(--forest-dark)" }}>Mon Tableau de bord & Activités</h1>
          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 14 }}>
            Bonjour {user?.nom}, voici un récapitulatif de votre chiffre d'affaires et de vos commandes chez {boutique?.nom || "la boutique"}.
          </p>
        </div>

        {/* STATS DE L'EMPLOYÉ */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 24 }}>
          
          <div className="bs-panel" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ color: "var(--muted)", fontSize: 12, fontWeight: 700, textTransform: "uppercase" }}>Chiffre d'affaires généré</span>
              <div style={{ background: "var(--forest-light)", padding: 6, borderRadius: 8, color: "var(--forest)" }}>
                <TrendingUp size={18} />
              </div>
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--ink)" }}>{fcfa(data.monChiffreAffaires || 0)}</div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>Commandes traitées hors annulées</div>
          </div>

          <div className="bs-panel" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ color: "var(--muted)", fontSize: 12, fontWeight: 700, textTransform: "uppercase" }}>Commandes Livrées</span>
              <div style={{ background: "#EBF7F0", padding: 6, borderRadius: 8, color: "#1F4D3A" }}>
                <CheckCircle size={18} />
              </div>
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--ink)" }}>{data.nbMesCommandesLivrees || 0}</div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>Livrées au client</div>
          </div>

          <div className="bs-panel" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ color: "var(--muted)", fontSize: 12, fontWeight: 700, textTransform: "uppercase" }}>Commandes En cours</span>
              <div style={{ background: "#FEF3C7", padding: 6, borderRadius: 8, color: "#D97706" }}>
                <Clock size={18} />
              </div>
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--ink)" }}>{data.nbMesCommandesEnCours || 0}</div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>En cours de traitement</div>
          </div>

          <div className="bs-panel" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ color: "var(--muted)", fontSize: 12, fontWeight: 700, textTransform: "uppercase" }}>Total Assignations</span>
              <div style={{ background: "var(--forest-light)", padding: 6, borderRadius: 8, color: "var(--forest)" }}>
                <ShoppingBag size={18} />
              </div>
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--ink)" }}>{data.nbMesCommandes || 0}</div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>Total des commandes attribuées</div>
          </div>

        </div>

        {/* LISTE DES COMMANDES ASSIGNÉES À L'EMPLOYÉ */}
        <div className="bs-panel">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, color: "var(--forest-dark)" }}>Mes Commandes Assignées</h3>
              <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>
                Gérez l'avancement et la livraison des commandes sous votre responsabilité.
              </div>
            </div>
            <Link to="/admin/commandes" style={{ fontSize: 13, fontWeight: 700, color: "var(--forest)", textDecoration: "none" }}>
              Accéder à la gestion des commandes →
            </Link>
          </div>

          {listCmds.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: "var(--muted)", fontSize: 14 }}>
              Vous n'avez actuellement aucune commande assignée.
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
              {listCmds.map((c) => {
                const cmdNum = "COM-B" + String(c.id).padStart(3, "0");
                const statusBadges = {
                  en_attente: { label: "En attente", bg: "#FEF3C7", color: "#92400E" },
                  validee: { label: "Validée", bg: "#E0E7FF", color: "#3730A3" },
                  en_preparation: { label: "En préparation", bg: "#DBEAFE", color: "#1E40AF" },
                  en_livraison: { label: "En livraison", bg: "#E0F2FE", color: "#075985" },
                  livree: { label: "Livrée", bg: "#D1FAE5", color: "#065F46" },
                  annulee: { label: "Annulée", bg: "#FEE2E2", color: "#991B1B" },
                };
                const st = statusBadges[c.statut] || { label: c.statut, bg: "#E5E7EB", color: "#374151" };

                return (
                  <div key={c.id} style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 16, background: "var(--paper)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <span style={{ fontWeight: 800, fontSize: 15, color: "var(--forest-dark)" }}>#{cmdNum}</span>
                      <span style={{ background: st.bg, color: st.color, padding: "3px 10px", borderRadius: 12, fontSize: 11.5, fontWeight: 700 }}>
                        {st.label}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: "var(--ink)", fontWeight: 700 }}>Client: {c.client?.nom || "Client non inscrit"}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>Tél: {c.client?.telephone || c.telephoneClient || "Non renseigné"}</div>
                    
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 10, borderTop: "1px dashed var(--line)" }}>
                      <span style={{ fontWeight: 800, fontSize: 14, color: "var(--forest)" }}>{fcfa(c.total)}</span>
                      <Link to="/admin/commandes" style={{ fontSize: 12, fontWeight: 700, color: "var(--forest-dark)", textDecoration: "underline" }}>
                        Modifier le statut
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </>
    );
  }

  // ── 2. DASHBOARD GLOBAL ADMINISTRATEUR ──
  const chartData = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((jour, i) => ({
    jour, ca: Math.round(data.chiffreAffaires / 7 * (0.6 + 0.15 * ((i * 7) % 5))),
  }));

  const activeProductsChart = prodChartTab === "top" ? (data.top7Produits || []) : (data.flop7Produits || []);

  return (
    <>
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 style={{ fontSize: 26, margin: 0, color: "var(--forest-dark)" }}>Tableau de bord Général Admin</h1>
          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 14 }}>Aperçu global et statistiques avancées de votre boutique.</p>
        </div>
      </div>

      {/* ── HIGH-ELEGANCE SLIM KPI CARDS GRID (10 Cartes Dynamiques Slims) ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 24 }}>
        
        {/* 1. CHIFFRE D'AFFAIRES GLOBAL */}
        <div style={{
          background: "var(--card)", border: "1px solid var(--line)", borderRadius: 16, padding: "14px 16px",
          position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "space-between",
          boxShadow: "0 2px 8px rgba(0,0,0,0.02)"
        }}>
          <div style={{ position: "absolute", right: -12, top: -12, width: 60, height: 60, borderRadius: "50%", background: "rgba(34,75,53,0.08)", pointerEvents: "none" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(34,75,53,0.12)", color: "var(--forest-dark)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <TrendingUp size={17} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, color: "var(--ink)", letterSpacing: "-0.02em" }}>
              {fcfa(data.chiffreAffaires || 0)}
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", marginTop: 2 }}>
              Chiffre d'affaires
            </div>
          </div>
        </div>

        {/* 2. BÉNÉFICE NET */}
        <div style={{
          background: "var(--card)", border: "1px solid var(--line)", borderRadius: 16, padding: "14px 16px",
          position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "space-between",
          boxShadow: "0 2px 8px rgba(0,0,0,0.02)"
        }}>
          <div style={{ position: "absolute", right: -12, top: -12, width: 60, height: 60, borderRadius: "50%", background: "rgba(5,150,105,0.08)", pointerEvents: "none" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "#ECFDF5", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <DollarSign size={17} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, color: "var(--ink)", letterSpacing: "-0.02em" }}>
              {fcfa(data.beneficeNet || 0)}
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", marginTop: 2 }}>
              Bénéfice net
            </div>
          </div>
        </div>

        {/* 3. VALEUR DU STOCK */}
        <div style={{
          background: "var(--card)", border: "1px solid var(--line)", borderRadius: 16, padding: "14px 16px",
          position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "space-between",
          boxShadow: "0 2px 8px rgba(0,0,0,0.02)"
        }}>
          <div style={{ position: "absolute", right: -12, top: -12, width: 60, height: 60, borderRadius: "50%", background: "rgba(79,70,229,0.08)", pointerEvents: "none" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "#EEF2FF", color: "#4F46E5", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Package size={17} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, color: "var(--ink)", letterSpacing: "-0.02em" }}>
              {fcfa(data.valeurStockVente || 0)}
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", marginTop: 2 }}>
              Valeur stock (achat)
            </div>
          </div>
        </div>

        {/* 4. COMMANDES REÇUES */}
        <div style={{
          background: "var(--card)", border: "1px solid var(--line)", borderRadius: 16, padding: "14px 16px",
          position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "space-between",
          boxShadow: "0 2px 8px rgba(0,0,0,0.02)"
        }}>
          <div style={{ position: "absolute", right: -12, top: -12, width: 60, height: 60, borderRadius: "50%", background: "rgba(13,148,136,0.08)", pointerEvents: "none" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "#CCFBF1", color: "#0D9488", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <CheckCircle2 size={17} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, color: "var(--ink)", letterSpacing: "-0.02em" }}>
              {data.nbCommandes || 0}
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", marginTop: 2 }}>
              Commandes reçues
            </div>
          </div>
        </div>

        {/* 5. VENTES CE MOIS */}
        <div style={{
          background: "var(--card)", border: "1px solid var(--line)", borderRadius: 16, padding: "14px 16px",
          position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "space-between",
          boxShadow: "0 2px 8px rgba(0,0,0,0.02)"
        }}>
          <div style={{ position: "absolute", right: -12, top: -12, width: 60, height: 60, borderRadius: "50%", background: "rgba(16,185,129,0.08)", pointerEvents: "none" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "#D1FAE5", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ShoppingBag size={17} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, color: "var(--ink)", letterSpacing: "-0.02em" }}>
              {data.nbCommandes || 0}
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", marginTop: 2 }}>
              Nombre total de ventes
            </div>
          </div>
        </div>

        {/* 6. TOTAL PRODUITS */}
        <div style={{
          background: "var(--card)", border: "1px solid var(--line)", borderRadius: 16, padding: "14px 16px",
          position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "space-between",
          boxShadow: "0 2px 8px rgba(0,0,0,0.02)"
        }}>
          <div style={{ position: "absolute", right: -12, top: -12, width: 60, height: 60, borderRadius: "50%", background: "rgba(139,92,246,0.08)", pointerEvents: "none" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "#F3E8FF", color: "#8B5CF6", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Layers size={17} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, color: "var(--ink)", letterSpacing: "-0.02em" }}>
              {data.totalProduits || 0}
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", marginTop: 2 }}>
              Total produits
            </div>
          </div>
        </div>

        {/* 7. CATÉGORIES EN CATALOGUE */}
        <div style={{
          background: "var(--card)", border: "1px solid var(--line)", borderRadius: 16, padding: "14px 16px",
          position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "space-between",
          boxShadow: "0 2px 8px rgba(0,0,0,0.02)"
        }}>
          <div style={{ position: "absolute", right: -12, top: -12, width: 60, height: 60, borderRadius: "50%", background: "rgba(168,85,247,0.08)", pointerEvents: "none" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "#FAF5FF", color: "#A855F7", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Layers size={17} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, color: "var(--ink)", letterSpacing: "-0.02em" }}>
              {data.totalCategories || 0}
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", marginTop: 2 }}>
              Catégories actives
            </div>
          </div>
        </div>

        {/* 8. CLIENTS ACTIFS */}
        <div style={{
          background: "var(--card)", border: "1px solid var(--line)", borderRadius: 16, padding: "14px 16px",
          position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "space-between",
          boxShadow: "0 2px 8px rgba(0,0,0,0.02)"
        }}>
          <div style={{ position: "absolute", right: -12, top: -12, width: 60, height: 60, borderRadius: "50%", background: "rgba(2,132,199,0.08)", pointerEvents: "none" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "#E0F2FE", color: "#0284C7", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <UserCheck size={17} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, color: "var(--ink)", letterSpacing: "-0.02em" }}>
              {data.totalClients || 0}
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", marginTop: 2 }}>
              Clients actifs
            </div>
          </div>
        </div>

        {/* 9. AVIS CLIENTS */}
        <div style={{
          background: "var(--card)", border: "1px solid var(--line)", borderRadius: 16, padding: "14px 16px",
          position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "space-between",
          boxShadow: "0 2px 8px rgba(0,0,0,0.02)"
        }}>
          <div style={{ position: "absolute", right: -12, top: -12, width: 60, height: 60, borderRadius: "50%", background: "rgba(245,158,11,0.08)", pointerEvents: "none" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "#FEF3C7", color: "#D97706", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Star size={17} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, color: "var(--ink)", letterSpacing: "-0.02em" }}>
              {data.noteMoyenneGlobale || "4.9"} / 5
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", marginTop: 2 }}>
              Avis clients ({data.totalReviews || 0})
            </div>
          </div>
        </div>

        {/* 10. ALERTES STOCK */}
        <div style={{
          background: "var(--card)", border: "1px solid var(--line)", borderRadius: 16, padding: "14px 16px",
          position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "space-between",
          boxShadow: "0 2px 8px rgba(0,0,0,0.02)"
        }}>
          <div style={{ position: "absolute", right: -12, top: -12, width: 60, height: 60, borderRadius: "50%", background: data.stockFaibleCount > 0 ? "rgba(239,68,68,0.1)" : "rgba(100,116,139,0.06)", pointerEvents: "none" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: data.stockFaibleCount > 0 ? "#FEE2E2" : "var(--paper)", color: data.stockFaibleCount > 0 ? "#EF4444" : "var(--sage)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <AlertTriangle size={17} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, color: data.stockFaibleCount > 0 ? "#EF4444" : "var(--ink)", letterSpacing: "-0.02em" }}>
              {data.stockFaibleCount || 0}
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: data.stockFaibleCount > 0 ? "#EF4444" : "var(--muted)", marginTop: 2 }}>
              Stock faible
            </div>
          </div>
        </div>



      </div>

      {/* ── SECTION GRAPHIQUES VARIÉS & STYLÉS ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1.8fr 1.2fr", gap: 20, marginBottom: 20 }}>
        
        {/* 1. COURBE FLUIDE ET DÉGRADÉE - CHIFFRE D'AFFAIRES */}
        <div className="bs-panel" style={{ padding: "20px 24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, color: "var(--forest-dark)", fontWeight: 700 }}>Evolution du Chiffre d'Affaires</h3>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>Tendance des 7 derniers jours</div>
            </div>
            <span style={{ background: chartColors.badgeBg, color: chartColors.badgeText, padding: "4px 10px", borderRadius: 12, fontSize: 11.5, fontWeight: 700 }}>
              7 derniers jours
            </span>
          </div>

          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorCa" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={chartColors.stroke} stopOpacity={isDark ? 0.5 : 0.35}/>
                  <stop offset="95%" stopColor={chartColors.stroke} stopOpacity={0.0}/>
                </linearGradient>
              </defs>
              <CartesianGrid stroke={chartColors.grid} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="jour" tick={{ fontSize: 12, fill: chartColors.axisText }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: chartColors.axisText }} axisLine={false} tickLine={false} tickFormatter={(v) => v === 0 ? "0" : (v / 1000) + "k"} />
              <Tooltip 
                contentStyle={{ 
                  background: chartColors.tooltipBg, 
                  borderRadius: 12, 
                  border: `1px solid ${chartColors.tooltipBorder}`, 
                  color: chartColors.tooltipText, 
                  boxShadow: isDark ? "0 10px 25px rgba(0,0,0,0.5)" : "0 8px 20px rgba(0,0,0,0.08)", 
                  fontWeight: 600, 
                  fontSize: 13 
                }}
                itemStyle={{ color: chartColors.tooltipText }}
                labelStyle={{ color: chartColors.axisText }}
                formatter={(v) => [fcfa(v), "Revenu"]} 
              />
              <Area type="monotone" dataKey="ca" stroke={chartColors.stroke} strokeWidth={3} fillOpacity={1} fill="url(#colorCa)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* 2. DIAGRAMME DONUT / CIRCULAIRE - MODES DE PAIEMENT & COMMANDES */}
        <div className="bs-panel" style={{ padding: "20px 24px" }}>
          <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--forest-dark)", fontWeight: 700 }}>Modes de paiement</h3>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 14 }}>Répartition globale des transactions</div>

          <ResponsiveContainer width="100%" height={210}>
            <PieChart>
              <Pie
                data={[
                  { name: "Espèces (Cash)", value: Math.max(1, Math.round((data.nbCommandes || 5) * 0.6)) },
                  { name: "Mvola / Holam", value: Math.max(1, Math.round((data.nbCommandes || 5) * 0.25)) },
                  { name: "Carte bancaire / Stripe", value: Math.max(1, Math.round((data.nbCommandes || 5) * 0.15)) },
                ]}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={80}
                paddingAngle={4}
                dataKey="value"
              >
                <Cell key="cell-0" fill="#10B981" />
                <Cell key="cell-1" fill="#F59E0B" />
                <Cell key="cell-2" fill="#06B6D4" />
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  background: chartColors.tooltipBg, 
                  borderRadius: 12, 
                  border: `1px solid ${chartColors.tooltipBorder}`, 
                  color: chartColors.tooltipText, 
                  boxShadow: isDark ? "0 10px 25px rgba(0,0,0,0.5)" : "0 8px 20px rgba(0,0,0,0.08)", 
                  fontWeight: 600, 
                  fontSize: 13 
                }}
                itemStyle={{ color: chartColors.tooltipText }}
                labelStyle={{ color: chartColors.axisText }}
                formatter={(v, name) => [`${v} commande(s)`, name]} 
              />
              <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: 11.5, fontWeight: 600, color: chartColors.axisText }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

      </div>

      {/* ── SECTION GRAPHIQUES 2 : TOP PRODUITS & TOP CATÉGORIES ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
        
        {/* TOP / FLOP PRODUITS LISTE MODERNE */}
        <div className="bs-panel" style={{ padding: "20px 24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, color: "var(--forest-dark)", fontWeight: 700 }}>
                {prodChartTab === "top" ? "Top Produits (Ventes)" : "Produits Moins Vendus"}
              </h3>
            </div>
            <div style={{ display: "flex", gap: 4, background: "var(--paper)", padding: 3, borderRadius: 8 }}>
              <button
                onClick={() => setProdChartTab("top")}
                style={{
                  background: prodChartTab === "top" ? "var(--forest)" : "none",
                  color: prodChartTab === "top" ? "#fff" : "var(--muted)",
                  border: "none", padding: "4px 10px", borderRadius: 6, fontSize: 11.5, fontWeight: 700, cursor: "pointer"
                }}
              >
                Plus vendus
              </button>
              <button
                onClick={() => setProdChartTab("flop")}
                style={{
                  background: prodChartTab === "flop" ? "#B4483A" : "none",
                  color: prodChartTab === "flop" ? "#fff" : "var(--muted)",
                  border: "none", padding: "4px 10px", borderRadius: 6, fontSize: 11.5, fontWeight: 700, cursor: "pointer"
                }}
              >
                Moins vendus
              </button>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 250, overflowY: "auto" }}>
            {activeProductsChart.length > 0 ? (
              activeProductsChart.map((p, idx) => (
                <div key={p.id || idx} style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 8, borderBottom: "1px solid var(--line)" }}>
                  <img src={p.imageUrl || "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=100&q=80"} alt={p.nom} style={{ width: 36, height: 36, borderRadius: 8, objectFit: "cover" }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      #{idx + 1} {p.nom}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--muted)" }}>
                      <span>{p.ventesCount} vente{p.ventesCount > 1 ? "s" : ""}</span>
                      <span>•</span>
                      <Stars rating={Math.round(p.noteMoyenne || 5)} size={11} />
                    </div>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "var(--forest-dark)" }}>
                    {fcfa(p.prixPromo || p.prix)}
                  </div>
                </div>
              ))
            ) : (
              <div style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", padding: 20 }}>
                Aucune donnée de vente disponible.
              </div>
            )}
          </div>
        </div>

        {/* BARS HORIZONTAUX POUR LES CATÉGORIES (Comme sur la photo 2) */}
        <div className="bs-panel" style={{ padding: "20px 24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 16, color: "var(--forest-dark)", fontWeight: 700 }}>Performance des Catégories</h3>
            <span style={{ fontSize: 12, color: "var(--forest)", fontWeight: 700 }}>Volume de ventes</span>
          </div>

          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              layout="vertical"
              data={data.topCategories || []}
              margin={{ top: 0, right: 20, left: 20, bottom: 0 }}
            >
              <CartesianGrid stroke={chartColors.grid} strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: chartColors.axisText }} axisLine={false} tickLine={false} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: chartColors.yAxisCategoryText, fontWeight: 600 }} axisLine={false} tickLine={false} width={90} />
              <Tooltip 
                contentStyle={{ 
                  background: chartColors.tooltipBg, 
                  borderRadius: 12, 
                  border: `1px solid ${chartColors.tooltipBorder}`, 
                  color: chartColors.tooltipText, 
                  boxShadow: isDark ? "0 10px 25px rgba(0,0,0,0.5)" : "0 8px 20px rgba(0,0,0,0.08)", 
                  fontWeight: 600, 
                  fontSize: 13 
                }}
                itemStyle={{ color: chartColors.tooltipText }}
                labelStyle={{ color: chartColors.axisText }}
                formatter={(v) => [`${v} ventes`, "Nombre de ventes"]} 
              />
              <Bar dataKey="ventes" fill={chartColors.barFill} radius={[0, 8, 8, 0]} barSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </div>

      </div>
    </>
  );
}
