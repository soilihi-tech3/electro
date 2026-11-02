import React, { useEffect, useState } from "react";
import { 
  TrendingUp, TrendingDown, DollarSign, ShoppingBag, ArrowUpRight, ArrowDownRight, 
  Calendar, RefreshCw, Users, Package, Award, FileSpreadsheet, Percent, HelpCircle, Filter, AlertTriangle 
} from "lucide-react";
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, Legend 
} from "recharts";
import { toast } from "react-hot-toast";
import api from "../../api";
import { useAuth } from "../../context/AuthContext.jsx";
import { formatPrice } from "../../utils/currency.js";

const MONTHS = [
  { value: "1", label: "Janvier" },
  { value: "2", label: "Février" },
  { value: "3", label: "Mars" },
  { value: "4", label: "Avril" },
  { value: "5", label: "Mai" },
  { value: "6", label: "Juin" },
  { value: "7", label: "Juillet" },
  { value: "8", label: "Août" },
  { value: "9", label: "Septembre" },
  { value: "10", label: "Octobre" },
  { value: "11", label: "Novembre" },
  { value: "12", label: "Décembre" }
];

export default function Bilan() {
  const { boutique } = useAuth();
  const storeDevise = boutique?.devise || "KMF";
  const cur = (val) => formatPrice(val, storeDevise);

  const currentYear = new Date().getFullYear().toString();
  const [periode, setPeriode] = useState("month");
  const [annee, setAnnee] = useState(currentYear);
  const [mois, setMois] = useState("");
  const [employeId, setEmployeId] = useState("tous");
  const [employees, setEmployees] = useState([]);
  
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Charger la liste des employés de la boutique
  useEffect(() => {
    api.get("/admin/employees")
      .then(res => setEmployees(res.data || []))
      .catch(() => setEmployees([]));
  }, []);

  function fetchBilan(overrides = {}) {
    setLoading(true);
    const p = overrides.periode !== undefined ? overrides.periode : periode;
    const yr = overrides.annee !== undefined ? overrides.annee : annee;
    const mo = overrides.mois !== undefined ? overrides.mois : mois;
    const emp = overrides.employeId !== undefined ? overrides.employeId : employeId;

    const query = new URLSearchParams();
    if (yr) query.set("annee", yr);
    if (mo && mo !== "tous") query.set("mois", mo);
    if (emp && emp !== "tous") query.set("employeId", emp);
    if (p && (!yr || yr === "toutes") && (!mo || mo === "tous")) query.set("periode", p);

    api.get(`/admin/bilan?${query.toString()}`)
      .then(res => {
        setData(res.data);
      })
      .catch(() => {
        toast.error("Erreur de chargement du bilan financier.");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchBilan();
  }, [annee, mois, employeId, periode]);

  const kpis = data?.kpis || {
    totalCA: 0,
    totalEncaisse: 0,
    totalCredit: 0,
    totalAchats: 0,
    cogsVentes: 0,
    margeBrute: 0,
    beneficeNet: 0,
    nombreCommandes: 0,
    nombreAchats: 0
  };

  const timeline = data?.timeline || [];
  const employeeStats = data?.employeeStats || [];
  const topProducts = data?.topProducts || [];

  const isNetPositive = kpis.beneficeNet >= 0;
  const tauxMargeBrute = kpis.totalCA > 0 ? ((kpis.margeBrute / kpis.totalCA) * 100).toFixed(1) : 0;
  const tauxMargeNette = kpis.totalCA > 0 ? ((kpis.beneficeNet / kpis.totalCA) * 100).toFixed(1) : 0;

  const selectedEmployee = employees.find(e => String(e.id) === String(employeId));
  const selectedMonthObj = MONTHS.find(m => m.value === String(mois));
  const selectedMonthName = selectedMonthObj ? selectedMonthObj.label : "Tous les mois";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, paddingBottom: 40 }}>
      {/* HEADER PAGE */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 26, margin: 0, color: "var(--forest-dark)", display: "flex", alignItems: "center", gap: 10 }}>
            <TrendingUp size={28} /> Bilan Financier & Rentabilité
          </h1>
          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 14 }}>
            Analyse détaillée du Chiffre d'Affaires, des encaissements réels, dépenses fournisseurs et marges nettes.
          </p>
        </div>

        <button
          onClick={() => fetchBilan()}
          className="bs-btn-secondary"
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 10, fontSize: 13 }}
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Actualiser les Chiffres
        </button>
      </div>

      {/* FILTER BAR: EMPLOYÉ, ANNÉE EN COURS, MOIS SPÉCIFIQUE, PÉRIODES RAPIDES */}
      <div className="bs-panel" style={{ padding: "14px 18px", display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", background: "#FFFFFF", borderRadius: 14, border: "1px solid var(--line)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--forest-dark)", fontWeight: 800, fontSize: 13, marginRight: 4 }}>
          <Filter size={16} /> Filtres :
        </div>

        {/* FILTRE EMPLOYÉ / CAISSIER */}
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Vendeur / Caissier</span>
          <select
            className="bs-select"
            style={{ minWidth: 170, height: 38, fontSize: 13 }}
            value={employeId}
            onChange={(e) => setEmployeId(e.target.value)}
          >
            <option value="tous">Tous les vendeurs</option>
            {employees.map(emp => (
              <option key={emp.id} value={emp.id}>
                {emp.nom} ({emp.role === "admin" ? "Admin" : "Caissier"})
              </option>
            ))}
          </select>
        </div>

        {/* FILTRE ANNÉE (ANNÉE EN COURS PAR DÉFAUT) */}
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Année</span>
          <select
            className="bs-select"
            style={{ width: 130, height: 38, fontSize: 13, fontWeight: 700 }}
            value={annee}
            onChange={(e) => {
              setAnnee(e.target.value);
              setPeriode("custom");
            }}
          >
            <option value="toutes">Toutes</option>
            <option value={currentYear}>{currentYear} (En cours)</option>
            <option value={(Number(currentYear) - 1).toString()}>{Number(currentYear) - 1}</option>
            <option value={(Number(currentYear) - 2).toString()}>{Number(currentYear) - 2}</option>
          </select>
        </div>

        {/* FILTRE MOIS SPÉCIFIQUE */}
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Mois Spécifique</span>
          <select
            className="bs-select"
            style={{ width: 150, height: 38, fontSize: 13 }}
            value={mois}
            onChange={(e) => {
              setMois(e.target.value);
              setPeriode("custom");
            }}
          >
            <option value="">Tous les mois</option>
            {MONTHS.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        <div style={{ height: 32, width: 1, background: "var(--line)", margin: "0 6px" }}></div>

        {/* RACCOURCIS DE PÉRIODE */}
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Raccourcis rapides</span>
          <div style={{ display: "flex", gap: 4 }}>
            {[
              { id: "today", label: "Aujourd'hui" },
              { id: "week", label: "7 jours" },
              { id: "month", label: "Ce mois" },
              { id: "year", label: "Cette année" },
              { id: "all", label: "Tout" }
            ].map(p => (
              <button
                key={p.id}
                onClick={() => {
                  setPeriode(p.id);
                  if (p.id === "today" || p.id === "week" || p.id === "all") {
                    setMois("");
                    setAnnee("toutes");
                  } else if (p.id === "month") {
                    setAnnee(currentYear);
                    setMois(String(new Date().getMonth() + 1));
                  } else if (p.id === "year") {
                    setAnnee(currentYear);
                    setMois("");
                  }
                }}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 700,
                  fontSize: 12,
                  transition: "all 0.15s",
                  background: periode === p.id ? "var(--forest)" : "#F1F5F9",
                  color: periode === p.id ? "#fff" : "var(--ink)"
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI METRIC CARDS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
        {/* CA TOTAL */}
        <div className="bs-panel" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 8, borderLeft: "4px solid var(--forest)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Chiffre d'Affaires</span>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "var(--forest-light)", color: "var(--forest)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <DollarSign size={18} />
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "var(--forest-dark)" }}>
            {cur(kpis.totalCA)}
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", display: "flex", justifyContent: "space-between" }}>
            <span>{kpis.nombreCommandes} vente(s)</span>
            <span style={{ fontWeight: 800, color: "var(--forest)" }}>Encaissé: {cur(kpis.totalEncaisse)}</span>
          </div>
        </div>

        {/* NOMBRE DE VENTES RÉALISÉES (DYNAMIQUE PAR VENDEUR / GLOBAL) */}
        <div className="bs-panel" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 8, borderLeft: "4px solid #0D9488" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
              Ventes Réalisées
            </span>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "#CCFBF1", color: "#0D9488", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Award size={18} />
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#0F766E" }}>
            {kpis.nombreCommandes} <span style={{ fontSize: 14, fontWeight: 600, color: "var(--muted)" }}>vente(s)</span>
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontWeight: 700, color: "var(--forest-dark)" }}>
              {selectedEmployee ? selectedEmployee.nom : "Tous vendeurs"}
            </span>
            <span>{selectedMonthName} {annee !== "toutes" ? annee : ""}</span>
          </div>
        </div>

        {/* RESTE À RECOUVRER (DETTES EN COURS) DYNAMIQUE */}
        <div className="bs-panel" style={{ 
          padding: 20, display: "flex", flexDirection: "column", gap: 8, 
          borderLeft: "4px solid #DC2626", 
          background: kpis.totalCredit > 0 ? "#FEF2F2" : "#FFFFFF"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: "#991B1B", textTransform: "uppercase" }}>
              Reste à Payer (Créances)
            </span>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "#FEE2E2", color: "#DC2626", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <AlertTriangle size={18} />
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#B91C1C" }}>
            {cur(kpis.totalCredit)}
          </div>
          <div style={{ fontSize: 12, color: "#7F1D1D", display: "flex", justifyContent: "space-between" }}>
            <span>{selectedEmployee ? `Créances : ${selectedEmployee.nom}` : "Dettes clients globales"}</span>
            <span style={{ fontWeight: 700 }}>Encaissé: {cur(kpis.totalEncaisse)}</span>
          </div>
        </div>

        {/* DÉPENSES ACHATS */}
        <div className="bs-panel" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 8, borderLeft: "4px solid #EA580C" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Dépenses Achats Fournisseurs</span>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "#FFEDD5", color: "#EA580C", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ShoppingBag size={18} />
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#9A3412" }}>
            {cur(kpis.totalAchats)}
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>
            {kpis.nombreAchats} bon(s) d'achat de réapprovisionnement
          </div>
        </div>

        {/* MARGE BRUTE */}
        <div className="bs-panel" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 8, borderLeft: "4px solid #2563EB" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Marge Commerciale Brute</span>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "#DBEAFE", color: "#2563EB", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Percent size={18} />
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#1E40AF" }}>
            {cur(kpis.margeBrute)}
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", display: "flex", justifyContent: "space-between" }}>
            <span>Taux de marque : <strong>{tauxMargeBrute}%</strong></span>
            <span>Coût sorties : {cur(kpis.cogsVentes)}</span>
          </div>
        </div>

        {/* BÉNÉFICE NET DE TRÉSORERIE */}
        <div className="bs-panel" style={{ 
          padding: 20, display: "flex", flexDirection: "column", gap: 8, 
          borderLeft: isNetPositive ? "4px solid #16A34A" : "4px solid #DC2626",
          background: isNetPositive ? "#F0FDF4" : "#FEF2F2"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: isNetPositive ? "#166534" : "#991B1B", textTransform: "uppercase" }}>
              Solde Net (CA - Achats)
            </span>
            <div style={{ 
              width: 34, height: 34, borderRadius: 10, 
              background: isNetPositive ? "#DCFCE7" : "#FEE2E2", 
              color: isNetPositive ? "#16A34A" : "#DC2626", 
              display: "flex", alignItems: "center", justifyContent: "center" 
            }}>
              {isNetPositive ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />}
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: isNetPositive ? "#14532D" : "#7F1D1D" }}>
            {isNetPositive ? `+${cur(kpis.beneficeNet)}` : cur(kpis.beneficeNet)}
          </div>
          <div style={{ fontSize: 12, color: isNetPositive ? "#15803D" : "#B91C1C", fontWeight: 600 }}>
            {isNetPositive 
              ? `Rentabilité nette positive (${tauxMargeNette}% du CA généré)` 
              : "Solde négatif : période d'investissement en stock supérieure aux encaissements"}
          </div>
        </div>
      </div>

      {/* GRAPHIC TIMELINE: RECHARTS EVOLUTION */}
      <div className="bs-panel" style={{ padding: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 17, color: "var(--forest-dark)" }}>Évolution Chiffre d'Affaires vs Achats Fournisseurs</h3>
            <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--muted)" }}>Suivi temporel de l'activité commerciale ({storeDevise})</p>
          </div>
        </div>

        {timeline.length === 0 ? (
          <div style={{ height: 260, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", fontSize: 14 }}>
            Aucune donnée enregistrée pour les filtres sélectionnés.
          </div>
        ) : (
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeline} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCA" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1E5C45" stopOpacity={0.6}/>
                    <stop offset="95%" stopColor="#1E5C45" stopOpacity={0.05}/>
                  </linearGradient>
                  <linearGradient id="colorAchats" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EA580C" stopOpacity={0.5}/>
                    <stop offset="95%" stopColor="#EA580C" stopOpacity={0.05}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="date" stroke="#64748B" fontSize={12} />
                <YAxis stroke="#64748B" fontSize={12} tickFormatter={(val) => `${val.toLocaleString()} ${storeDevise}`} />
                <Tooltip 
                  formatter={(val) => [cur(val), ""]} 
                  contentStyle={{ borderRadius: 10, border: "1px solid #CBD5E1", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }} 
                />
                <Legend verticalAlign="top" height={36} />
                <Area type="monotone" dataKey="ca" name="Ventes (CA)" stroke="#1E5C45" strokeWidth={2.5} fillOpacity={1} fill="url(#colorCA)" />
                <Area type="monotone" dataKey="achats" name="Achats Fournisseurs" stroke="#EA580C" strokeWidth={2} fillOpacity={1} fill="url(#colorAchats)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* TWO COLUMNS: PERFORMANCE EMPLOYÉS & TOP PRODUITS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 20 }}>
        {/* EMPLOYEE PERFORMANCE */}
        <div className="bs-panel" style={{ padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <Users size={20} color="var(--forest)" />
            <h3 style={{ margin: 0, fontSize: 16, color: "var(--forest-dark)" }}>Performance par Vendeur / Caisse</h3>
          </div>

          {employeeStats.length === 0 ? (
            <div style={{ padding: 30, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
              Aucune vente avec vendeur assigné pour les filtres sélectionnés.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="bs-table" style={{ width: "100%", fontSize: 13 }}>
                <thead>
                  <tr>
                    <th>Employé / Vendeur</th>
                    <th style={{ textAlign: "center" }}>Nb Ventes</th>
                    <th style={{ textAlign: "right" }}>CA Total</th>
                    <th style={{ textAlign: "right" }}>Encaissé</th>
                    <th style={{ textAlign: "right" }}>Reste à Payer (Dette)</th>
                    <th style={{ textAlign: "right" }}>Bénéfice Marge</th>
                  </tr>
                </thead>
                <tbody>
                  {employeeStats.map((emp, i) => {
                    const credit = Number(emp.totalCredit || emp.resteAPayer || 0);
                    const encaisse = Number(emp.totalEncaisse || 0);
                    const totalCA = Number(emp.totalCA || emp.ca || 0);
                    const nbVentes = emp.ventesCount || emp.nbVentes || 0;
                    return (
                      <tr key={i}>
                        <td style={{ fontWeight: 700, color: "var(--ink)" }}>{emp.nom}</td>
                        <td style={{ textAlign: "center" }}>
                          <span style={{ background: "var(--paper)", padding: "2px 8px", borderRadius: 8, fontWeight: 700 }}>
                            {nbVentes}
                          </span>
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 700, color: "var(--forest-dark)" }}>
                          {cur(totalCA)}
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 700, color: "#166534" }}>
                          {cur(encaisse)}
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 700 }}>
                          {credit > 0 ? (
                            <span style={{ background: "#FEE2E2", color: "#DC2626", padding: "2px 8px", borderRadius: 6, fontSize: 11.5, fontWeight: 800 }}>
                              {cur(credit)}
                            </span>
                          ) : (
                            <span style={{ color: "var(--muted)", fontSize: 12 }}>0 {storeDevise}</span>
                          )}
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 700, color: "#16A34A" }}>
                          +{cur(emp.benefice || 0)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* TOP PRODUITS VENDUS */}
        <div className="bs-panel" style={{ padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <Award size={20} color="#D97706" />
            <h3 style={{ margin: 0, fontSize: 16, color: "var(--forest-dark)" }}>Top Produits Générateurs de Revenu</h3>
          </div>

          {topProducts.length === 0 ? (
            <div style={{ padding: 30, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
              Aucun produit vendu sur cette période.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="bs-table" style={{ width: "100%", fontSize: 13 }}>
                <thead>
                  <tr>
                    <th>Produit</th>
                    <th style={{ textAlign: "center" }}>Qté Vendue</th>
                    <th style={{ textAlign: "right" }}>CA Généré</th>
                    <th style={{ textAlign: "right" }}>Marge Estimée</th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.map((prod, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 700, color: "var(--ink)" }}>{prod.nom}</td>
                      <td style={{ textAlign: "center" }}>
                        <span style={{ background: "#EFF6FF", color: "#1E40AF", padding: "2px 8px", borderRadius: 8, fontWeight: 700 }}>
                          {prod.quantite}
                        </span>
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 700, color: "var(--forest-dark)" }}>
                        {cur(prod.ca)}
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 700, color: "#16A34A" }}>
                        +{cur(prod.marge)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
