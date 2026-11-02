import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, AreaChart, Area, Legend } from "recharts";
import { 
  TrendingUp, ShoppingBag, AlertTriangle, Layers, DollarSign, Package, Star, 
  UserCheck, CheckCircle2, Clock, CheckCircle, RefreshCw, CreditCard, ArrowUpRight, 
  Calendar, Eye, Activity, Award, ShieldCheck, Zap 
} from "lucide-react";
import api from "../../api";
import Stars from "../../components/Stars.jsx";
import InvoiceModal from "../../components/InvoiceModal.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { subscribeRealtime } from "../../utils/realtime.js";
import { Skel, SkeletonStatCards } from "../../components/Skeleton.jsx";
import { readCache, writeCache } from "../../utils/swrCache.js";
import { formatPrice as fcfa } from "../../utils/currency.js";

const PERIODES = [
  { id: "today", label: "Aujourd'hui" },
  { id: "7d", label: "7 jours" },
  { id: "30d", label: "30 jours" },
  { id: "month", label: "Ce mois" },
  { id: "year", label: "Cette année" },
  { id: "all", label: "Tout" },
];

export default function Dashboard() {
  const { user, boutique, theme } = useAuth();
  const [periode, setPeriode] = useState("7d");
  const [data, setData] = useState(() => readCache("admin_dashboard_7d") || readCache("admin_dashboard") || null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [prodChartTab, setProdChartTab] = useState("top"); // "top" | "flop"
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [loadingInvoice, setLoadingInvoice] = useState(false);
  const isDark = theme === "dark";

  // Chart styling options based on active theme
  const chartColors = {
    stroke: isDark ? "#10B981" : "#163424",
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

  function loadDashboard(targetPeriode = periode) {
    setIsRefreshing(true);
    api.get(`/admin/dashboard?periode=${targetPeriode}`)
      .then((res) => {
        setData(res.data);
        writeCache(`admin_dashboard_${targetPeriode}`, res.data);
        writeCache("admin_dashboard", res.data);
      })
      .catch(() => {})
      .finally(() => setIsRefreshing(false));
  }

  const handleSelectPeriode = (pId) => {
    setPeriode(pId);
    loadDashboard(pId);
  };

  const handleViewInvoice = async (vente) => {
    try {
      setLoadingInvoice(true);
      const res = await api.get(`/orders/${vente.id}`);
      setSelectedOrder(res.data);
    } catch {
      setSelectedOrder(vente);
    } finally {
      setLoadingInvoice(false);
    }
  };

  useEffect(() => { 
    loadDashboard(periode);
    const unsub = subscribeRealtime((detail) => {
      if (
        detail.type === "order_created" ||
        detail.type === "order_updated" ||
        detail.type === "product_updated" ||
        detail.type === "category_updated" ||
        detail.type === "user_registered"
      ) {
        loadDashboard(periode);
      }
    });
    return unsub;
  }, [periode]);

  if (!data) return (
    <div role="status" aria-label="Chargement">
      <Skel w={280} h={26} style={{ marginBottom: 10 }} />
      <Skel w={360} h={12} style={{ marginBottom: 24 }} />
      <SkeletonStatCards count={10} />
      <div style={{ display: "grid", gridTemplateColumns: "1.8fr 1.2fr", gap: 20, marginTop: 20 }}>
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
  const activeProductsChart = prodChartTab === "top" ? (data.top7Produits || []) : (data.flop7Produits || []);
  const chartEvolutionData = data.evolutionCA || [];

  return (
    <>
      {/* ── ENTÊTE & FILTRES DYNAMIQUES DE PÉRIODE ── */}
      <div style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h1 style={{ fontSize: 26, margin: 0, color: "var(--forest-dark)", fontWeight: 800 }}>Tableau de bord Général Admin</h1>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "#ECFDF5", color: "#059669",
              padding: "4px 10px", borderRadius: 14, fontSize: 11.5, fontWeight: 700,
              border: "1px solid #A7F3D0"
            }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#10B981", boxShadow: "0 0 6px #10B981" }} />
              EN DIRECT
            </span>
          </div>
          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 14 }}>
            Aperçu global, statistiques avancées et métriques en temps réel de votre boutique.
          </p>
        </div>

        {/* Dynamic Period Filter & Refresh Control */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--card)", padding: 4, borderRadius: 12, border: "1px solid var(--line)", boxShadow: "0 2px 6px rgba(0,0,0,0.02)" }}>
          {PERIODES.map((p) => {
            const active = periode === p.id;
            return (
              <button
                key={p.id}
                onClick={() => handleSelectPeriode(p.id)}
                style={{
                  background: active ? "var(--forest)" : "transparent",
                  color: active ? "#ffffff" : "var(--muted)",
                  border: "none",
                  padding: "6px 12px",
                  borderRadius: 8,
                  fontSize: 12.5,
                  fontWeight: active ? 700 : 600,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  boxShadow: active ? "0 2px 6px rgba(22, 52, 36, 0.25)" : "none"
                }}
              >
                {p.label}
              </button>
            );
          })}

          <button
            onClick={() => loadDashboard(periode)}
            disabled={isRefreshing}
            title="Rafraîchir les métriques"
            style={{
              background: "var(--paper)",
              color: "var(--forest-dark)",
              border: "1px solid var(--line)",
              padding: "6px 10px",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
              cursor: isRefreshing ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: 5,
              marginLeft: 4
            }}
          >
            <RefreshCw size={13} style={{ animation: isRefreshing ? "spin 1s linear infinite" : "none" }} />
            <span>Rafraîchir</span>
          </button>
        </div>
      </div>

      {/* ── HIGH-ELEGANCE SLIM KPI CARDS GRID (10 Cartes Dynamiques) ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 24 }}>
        
        {/* 1. CHIFFRE D'AFFAIRES DE LA PÉRIODE */}
        <div style={{
          background: "var(--card)", border: "1px solid var(--line)", borderRadius: 16, padding: "14px 16px",
          position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "space-between",
          boxShadow: "0 2px 8px rgba(0,0,0,0.02)"
        }}>
          <div style={{ position: "absolute", right: -12, top: -12, width: 60, height: 60, borderRadius: "50%", background: "rgba(34,75,53,0.08)", pointerEvents: "none" }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(34,75,53,0.12)", color: "var(--forest-dark)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <TrendingUp size={17} />
            </div>
            {data.panierMoyen > 0 && (
              <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--forest)", background: "var(--forest-light)", padding: "2px 8px", borderRadius: 10 }}>
                Panier : {fcfa(data.panierMoyen)}
              </span>
            )}
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, color: "var(--ink)", letterSpacing: "-0.02em" }}>
              {fcfa(data.chiffreAffaires || 0)}
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", marginTop: 2 }}>
              Chiffre d'affaires ({PERIODES.find(p => p.id === periode)?.label})
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
            <div style={{ fontSize: 20, fontWeight: 900, color: (data.beneficeNet || 0) >= 0 ? "var(--ink)" : "#EF4444", letterSpacing: "-0.02em" }}>
              {fcfa(data.beneficeNet || 0)}
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", marginTop: 2 }}>
              Bénéfice net calculé
            </div>
          </div>
        </div>

        {/* 3. VALEUR DU STOCK (ACHAT) */}
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
              {fcfa(data.valeurStockAchat || data.valeurStockVente || 0)}
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", marginTop: 2 }}>
              Valeur stock (revente: {fcfa(data.valeurStockVente || 0)})
            </div>
          </div>
        </div>

        {/* 4. COMMANDES DE LA PÉRIODE */}
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
              Commandes ({PERIODES.find(p => p.id === periode)?.label})
            </div>
          </div>
        </div>

        {/* 5. VENTES TOTALES GLOBALES */}
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
              {data.nbCommandesGlobal || data.nbCommandes || 0}
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", marginTop: 2 }}>
              Total ventes (tous canaux)
            </div>
          </div>
        </div>

        {/* 6. CRÉANCES & RESTE À RECOUVRER (NOUVEAU) */}
        <div style={{
          background: "var(--card)", border: "1px solid var(--line)", borderRadius: 16, padding: "14px 16px",
          position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "space-between",
          boxShadow: "0 2px 8px rgba(0,0,0,0.02)"
        }}>
          <div style={{ position: "absolute", right: -12, top: -12, width: 60, height: 60, borderRadius: "50%", background: (data.resteARecouvrerTotal || 0) > 0 ? "rgba(245,158,11,0.12)" : "rgba(100,116,139,0.06)", pointerEvents: "none" }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: (data.resteARecouvrerTotal || 0) > 0 ? "#FEF3C7" : "var(--paper)", color: (data.resteARecouvrerTotal || 0) > 0 ? "#D97706" : "var(--sage)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <CreditCard size={17} />
            </div>
            {(data.nbVentesCredit || 0) > 0 && (
              <span style={{ fontSize: 10.5, fontWeight: 700, color: "#D97706", background: "#FEF3C7", padding: "2px 8px", borderRadius: 10 }}>
                {data.nbVentesCredit} crédit{data.nbVentesCredit > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, color: (data.resteARecouvrerTotal || 0) > 0 ? "#D97706" : "var(--ink)", letterSpacing: "-0.02em" }}>
              {fcfa(data.resteARecouvrerTotal || 0)}
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", marginTop: 2 }}>
              Reste à recouvrer (crédits)
            </div>
          </div>
        </div>

        {/* 7. TOTAL PRODUITS */}
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
              Total produits actifs
            </div>
          </div>
        </div>

        {/* 8. CATÉGORIES EN CATALOGUE */}
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

        {/* 9. CLIENTS ACTIFS */}
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
              Clients enregistrés
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
              {data.stockFaibleCount > 0 ? "Articles à réapprovisionner" : "Stock optimal"}
            </div>
          </div>
        </div>

      </div>

      {/* ── SECTION 1 : GRAPHIQUES DYNAMIQUES (COURBE CA RÉELLE & MODES DE PAIEMENT) ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1.8fr 1.2fr", gap: 20, marginBottom: 24 }}>
        
        {/* 1. COURBE FLUIDE ET DÉGRADÉE - CHIFFRE D'AFFAIRES RÉEL DYNAMIQUE */}
        <div className="bs-panel" style={{ padding: "20px 24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, color: "var(--forest-dark)", fontWeight: 700 }}>
                Évolution du Chiffre d'Affaires
              </h3>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                Tendance {periode === "today" ? "d'aujourd'hui (par heure)" : periode === "month" ? "du mois en cours" : periode === "year" ? "de l'année" : "des " + periode}
              </div>
            </div>
            <span style={{ background: chartColors.badgeBg, color: chartColors.badgeText, padding: "4px 10px", borderRadius: 12, fontSize: 11.5, fontWeight: 700 }}>
              {PERIODES.find(p => p.id === periode)?.label}
            </span>
          </div>

          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={chartEvolutionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorCa" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={chartColors.stroke} stopOpacity={isDark ? 0.5 : 0.35}/>
                  <stop offset="95%" stopColor={chartColors.stroke} stopOpacity={0.0}/>
                </linearGradient>
              </defs>
              <CartesianGrid stroke={chartColors.grid} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="jour" tick={{ fontSize: 12, fill: chartColors.axisText }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: chartColors.axisText }} axisLine={false} tickLine={false} tickFormatter={(v) => v === 0 ? "0" : (v >= 1000 ? (v / 1000) + "k" : v)} />
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
                formatter={(v, name, item) => [
                  `${fcfa(v)} (${item?.payload?.nb || 0} vente${(item?.payload?.nb || 0) > 1 ? "s" : ""})`,
                  "Chiffre d'Affaires"
                ]} 
                labelFormatter={(label, payload) => payload?.[0]?.payload?.dateLabel || label}
              />
              <Area type="monotone" dataKey="ca" stroke={chartColors.stroke} strokeWidth={3} fillOpacity={1} fill="url(#colorCa)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* 2. DIAGRAMME DONUT CIRCULAIRE - MODES DE PAIEMENT RÉELS */}
        <div className="bs-panel" style={{ padding: "20px 24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, color: "var(--forest-dark)", fontWeight: 700 }}>Modes de paiement</h3>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                Répartition réelle des règlements
              </div>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--forest)", background: "var(--forest-light)", padding: "2px 8px", borderRadius: 8 }}>
              {data.repartitionPaiements?.reduce((s, p) => s + p.value, 0) || 0} transaction(s)
            </span>
          </div>

          <ResponsiveContainer width="100%" height={210}>
            <PieChart>
              <Pie
                data={data.repartitionPaiements && data.repartitionPaiements.length > 0 ? data.repartitionPaiements : [{ name: "Aucune vente", value: 1, montant: 0, fill: "#CBD5E1" }]}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={80}
                paddingAngle={4}
                dataKey="value"
                nameKey="name"
              >
                {(data.repartitionPaiements || []).map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill || ["#10B981", "#F59E0B", "#06B6D4", "#8B5CF6", "#94A3B8"][index % 5]} />
                ))}
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
                formatter={(v, name, item) => [`${v} commande(s) • ${fcfa(item?.payload?.montant || 0)}`, name]} 
              />
              <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: 11.5, fontWeight: 600, color: chartColors.axisText }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

      </div>

      {/* ── SECTION 2 DYNAMIQUE : FLUX RÉCENT DES VENTES EN DIRECT & CLASSEMENT VENDEURS ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1.4fr", gap: 20, marginBottom: 24 }}>
        
        {/* DERNIÈRES TRANSACTIONS EN DIRECT */}
        <div className="bs-panel" style={{ padding: "20px 24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h3 style={{ margin: 0, fontSize: 16, color: "var(--forest-dark)", fontWeight: 700 }}>
                  Flux Récent des Ventes
                </h3>
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  background: "#ECFDF5", color: "#059669",
                  padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 700
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10B981" }} />
                  Direct
                </span>
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                Dernières transactions enregistrées en caisse & web
              </div>
            </div>
            <Link to="/admin/ventes" style={{ fontSize: 12.5, fontWeight: 700, color: "var(--forest)", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
              Historique complet <ArrowUpRight size={14} />
            </Link>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {data.dernieresVentes && data.dernieresVentes.length > 0 ? (
              data.dernieresVentes.map((v) => {
                const dateStr = v.createdAt 
                  ? new Date(v.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) 
                  : "";
                const isCredit = v.montantRestant > 0;

                return (
                  <div key={v.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: 10, background: "var(--paper)", border: "1px solid var(--line)", transition: "all 0.15s ease" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 10,
                        background: "var(--forest-light)", color: "var(--forest)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontWeight: 800, fontSize: 13, flexShrink: 0
                      }}>
                        {(v.clientNom || "C")[0].toUpperCase()}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", display: "flex", alignItems: "center", gap: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          <span>{v.clientNom}</span>
                          <span style={{ fontSize: 11, padding: "1px 6px", borderRadius: 6, background: "var(--card)", border: "1px solid var(--line)", color: "var(--muted)", fontWeight: 600 }}>
                            #FAC-{String(v.id).padStart(4, "0")}
                          </span>
                        </div>
                        <div style={{ fontSize: 11.5, color: "var(--muted)", display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                          <span>{dateStr}</span>
                          <span>•</span>
                          <span style={{ textTransform: "capitalize" }}>{v.moyenPaiement}</span>
                          <span>•</span>
                          <span>Par {v.vendeur}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: "var(--forest-dark)" }}>
                          {fcfa(v.total)}
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: isCredit ? "#D97706" : "#059669" }}>
                          {isCredit ? `Reste : ${fcfa(v.montantRestant)}` : "Payé intégral"}
                        </div>
                      </div>

                      <button
                        onClick={() => handleViewInvoice(v)}
                        title="Voir la facture"
                        disabled={loadingInvoice}
                        style={{
                          width: 32, height: 32, borderRadius: 8,
                          border: "1px solid var(--line)", background: "var(--card)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          cursor: "pointer", color: "var(--forest)",
                          transition: "background 0.15s ease"
                        }}
                      >
                        <Eye size={15} />
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{ padding: 24, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
                Aucune vente récente enregistrée.
              </div>
            )}
          </div>
        </div>

        {/* CLASSEMENT DES VENDEURS & CANAUX ACTIFS */}
        <div className="bs-panel" style={{ padding: "20px 24px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Award size={18} color="var(--forest)" />
                <h3 style={{ margin: 0, fontSize: 16, color: "var(--forest-dark)", fontWeight: 700 }}>
                  Classement des Vendeurs
                </h3>
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                Performances réelles des collaborateurs sur la période
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
              {(data.topEmployes && data.topEmployes.length > 0 ? data.topEmployes : [
                { nom: "Caisse Principale", nbVentes: data.nbCommandes || 0, totalCA: data.chiffreAffaires || 0 }
              ]).map((emp, idx) => (
                <div key={idx} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: 10, background: "var(--paper)", border: "1px solid var(--line)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{
                      width: 26, height: 26, borderRadius: "50%",
                      background: idx === 0 ? "#FEF3C7" : idx === 1 ? "#E2E8F0" : "#F3E8FF",
                      color: idx === 0 ? "#D97706" : idx === 1 ? "#475569" : "#7E22CE",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 12, fontWeight: 800
                    }}>
                      #{idx + 1}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{emp.nom}</div>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>{emp.nbVentes} vente{emp.nbVentes > 1 ? "s" : ""} traitée{emp.nbVentes > 1 ? "s" : ""}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right", fontWeight: 800, fontSize: 13, color: "var(--forest-dark)" }}>
                    {fcfa(emp.totalCA)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Répartition Canaux (POS vs En ligne vs Recharge) */}
          <div style={{ borderTop: "1px dashed var(--line)", paddingTop: 14 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", marginBottom: 10, letterSpacing: "0.03em" }}>
              Canaux de Vente Actifs
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(data.repartitionCanaux && data.repartitionCanaux.length > 0 ? data.repartitionCanaux : [
                { name: "Vente Directe (POS)", count: data.nbCommandes || 1, montant: data.chiffreAffaires || 0, fill: "#10B981" }
              ]).map((c, i) => {
                const totalCmds = data.nbCommandes || 1;
                const pct = Math.round((c.count / Math.max(1, totalCmds)) * 100);
                return (
                  <div key={i}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                      <span style={{ fontWeight: 600, color: "var(--ink)" }}>{c.name} ({c.count})</span>
                      <span style={{ fontWeight: 700, color: "var(--forest-dark)" }}>{fcfa(c.montant)} ({pct}%)</span>
                    </div>
                    <div style={{ width: "100%", height: 6, borderRadius: 3, background: "var(--line)", overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: c.fill || "var(--forest)", borderRadius: 3 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

      </div>

      {/* ── SECTION 3 : TOP PRODUITS & PERFORMANCE DES CATÉGORIES ── */}
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

        {/* BARS HORIZONTAUX POUR LES CATÉGORIES */}
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

      {/* ── MODAL VÉRITABLE FACTURE FORMAT A4 & IMPRESSION ── */}
      {selectedOrder && (
        <InvoiceModal
          order={selectedOrder}
          boutique={boutique}
          onClose={() => setSelectedOrder(null)}
        />
      )}
    </>
  );
}

