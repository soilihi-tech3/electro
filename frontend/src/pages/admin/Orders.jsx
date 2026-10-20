import React, { useEffect, useState } from "react";
import {
  Search, Filter, ShoppingBag, DollarSign, Clock, CheckCircle2,
  Truck, UserCheck, Eye, X, Phone, MapPin, CreditCard, Calendar, Smartphone
} from "lucide-react";
import api from "../../api";
import TablePagination from "../../components/TablePagination";
import { SkeletonStatCards, SkeletonTableRows } from "../../components/Skeleton.jsx";
import { readCache, writeCache } from "../../utils/swrCache.js";

import { formatPrice as fcfa } from "../../utils/currency.js";
const formatOrderNum = (id) => `COM-B${String(id).padStart(3, "0")}`;

const STATUTS_FILTER = [
  { value: "tous", label: "Tous les statuts" },
  { value: "en_attente", label: "En attente" },
  { value: "validee", label: "Confirmées" },

  { value: "pret_retrait", label: "Prêtes à récupérer" },
  { value: "en_livraison", label: "En livraison" },
  { value: "recuperee", label: "Récupérées" },
  { value: "livree", label: "Livrées" },
  { value: "annulee", label: "Annulées" }
];

const STATUT_LABEL = {
  en_attente: "En attente",
  validee: "Confirmée",

  pret_retrait: "Prête à récupérer",
  en_livraison: "En livraison",
  recuperee: "Récupérée",
  livree: "Livrée",
  annulee: "Annulée"
};

const STATUT_STYLE = {
  en_attente: { bg: "#FEF3C7", color: "#92400E", border: "#FCD34D" },
  validee: { bg: "#E0F2FE", color: "#075985", border: "#7DD3FC" },
  en_preparation: { bg: "#E0F2FE", color: "#075985", border: "#7DD3FC" },
  pret_retrait: { bg: "#E0F2FE", color: "#075985", border: "#7DD3FC" },
  en_livraison: { bg: "#ECFDF5", color: "#065F46", border: "#6EE7B7" },
  recuperee: { bg: "#D1FAE5", color: "#064E3B", border: "#34D399" },
  livree: { bg: "#D1FAE5", color: "#064E3B", border: "#34D399" },
  annulee: { bg: "#FEE2E2", color: "#991B1B", border: "#FCA5A5" }
};

const MOYEN_LABEL = {
  cash: "Paiement à la livraison",
  mvola: "Mvola",
  holam: "Wero",
  carte: "Carte bancaire",
  whatsapp: "Commande via WhatsApp"
};

const MOIS = [
  { value: "tous", label: "Tous les mois" },
  { value: "0", label: "Janvier" },
  { value: "1", label: "Février" },
  { value: "2", label: "Mars" },
  { value: "3", label: "Avril" },
  { value: "4", label: "Mai" },
  { value: "5", label: "Juin" },
  { value: "6", label: "Juillet" },
  { value: "7", label: "Août" },
  { value: "8", label: "Septembre" },
  { value: "9", label: "Octobre" },
  { value: "10", label: "Novembre" },
  { value: "11", label: "Décembre" }
];

import { useCart } from "../../context/CartContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { subscribeRealtime } from "../../utils/realtime.js";

export default function AdminOrders() {
  const { showToast } = useCart();
  const { user } = useAuth();
  const [orders, setOrders] = useState(() => readCache("admin_orders:tous") || []);
  const [loaded, setLoaded] = useState(() => readCache("admin_orders:tous") !== undefined);
  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("tous");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("tous");
  const [employeeFilter, setEmployeeFilter] = useState("tous");
  const [dateFilter, setDateFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("tous");
  const [yearFilter, setYearFilter] = useState("tous");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  function load() {
    const cacheKey = `admin_orders:${statusFilter}`;
    api.get("/admin/orders", {
      params: statusFilter !== "tous" ? { statut: statusFilter } : {}
    }).then((res) => {
      const freshOrders = res.data || [];
      setOrders(freshOrders);
      writeCache(cacheKey, freshOrders);
      setLoaded(true);

      // Auto update selected order if modal is open
      setSelectedOrder(prev => {
        if (!prev) return null;
        const found = freshOrders.find(o => o.id === prev.id);
        return found || prev;
      });
    }).catch(() => setLoaded(true));
  }

  useEffect(() => {
    const cached = readCache(`admin_orders:${statusFilter}`);
    if (cached) { setOrders(cached); setLoaded(true); }
    else setLoaded(false);
  }, [statusFilter]);

  useEffect(() => {
    load();

    // 1. Realtime SSE push listener
    const unsubscribe = subscribeRealtime((detail) => {
      if (detail.type === "order_updated" || detail.type === "order_created") {
        load();
      }
    });

    // 2. Filet de sécurité léger (le SSE assure le temps réel)
    const interval = setInterval(() => { if (!document.hidden) load(); }, 30000);

    // 3. Window focus refresh
    const onFocus = () => { if (!document.hidden) load(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    return () => {
      unsubscribe();
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [statusFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, employeeFilter, dateFilter, monthFilter, yearFilter]);

  useEffect(() => {
    api.get("/admin/employees")
      .then((res) => setEmployees(res.data || []))
      .catch(() => { });
  }, []);

  async function changeStatus(id, statut) {
    const targetOrder = orders.find((o) => o.id === id);
    const currentUserEmployee = employees.find(e => e.userId === user?.id || e.email === user?.email) || (user?.id ? { id: user.id, nom: user.nom || user.email?.split("@")[0] || "Agent" } : null);
    
    // Auto assign connected person when status becomes recuperee / livree, or if unassigned
    let assignedEmpId = targetOrder?.employeAssigneId;
    let assignedEmp = targetOrder?.employeAssigne;
    
    if ((statut === "recuperee" || statut === "livree" || !assignedEmpId) && currentUserEmployee) {
      assignedEmpId = currentUserEmployee.id;
      assignedEmp = currentUserEmployee;
    }

    // 0ms Optimistic local update
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, statut, employeAssigneId: assignedEmpId, employeAssigne: assignedEmp } : o))
    );
    if (selectedOrder && selectedOrder.id === id) {
      setSelectedOrder((prev) => ({ ...prev, statut, employeAssigneId: assignedEmpId, employeAssigne: assignedEmp }));
    }

    try {
      await api.patch(`/admin/orders/${id}/status`, { statut, employeId: assignedEmpId });
      if (assignedEmpId) {
        api.patch(`/admin/orders/${id}/assign`, { employeId: assignedEmpId }).catch(() => {});
      }
      const cmdNum = formatOrderNum(id);
      const label = STATUT_LABEL[statut] || statut;
      if (showToast) {
        showToast(`La commande #${cmdNum} a été mise à jour : ${label}.`, "success", "Commande validée !");
      }
    } catch (err) {
      load(); // Revert to server state on error
    }
  }

  async function assign(id, employeId) {
    const targetOrder = orders.find(o => o.id === id);
    if (targetOrder?.statut === "recuperee" || targetOrder?.statut === "livree") {
      if (showToast) showToast("L'agent responsable d'une commande récupérée/livrée est définitivement attribué et ne peut plus être modifié.", "warning");
      return;
    }

    if (targetOrder?.employeAssigneId && user?.role !== "admin") {
      if (showToast) showToast("Seul un administrateur peut modifier l'agent d'une commande déjà assignée.", "warning");
      return;
    }

    const empId = employeId || null;
    const emp = employees.find((e) => e.id === Number(empId));

    // 0ms Optimistic local update
    setOrders((prev) =>
      prev.map((o) =>
        o.id === id ? { ...o, employeAssigneId: empId, employeAssigne: emp } : o
      )
    );
    if (selectedOrder && selectedOrder.id === id) {
      setSelectedOrder((prev) => ({ ...prev, employeAssigneId: empId, employeAssigne: emp }));
    }

    try {
      await api.patch(`/admin/orders/${id}/assign`, { employeId: empId });
      const cmdNum = formatOrderNum(id);
      const empName = emp ? emp.nom : "aucun agent";
      if (showToast) {
        showToast(`La commande #${cmdNum} a été attribuée à ${empName}.`, "info", "Assignation mise à jour");
      }
    } catch (err) {
      load(); // Revert to server state on error
    }
  }

  // Calculate available years dynamically (starting from current year e.g. 2026 onwards)
  const currentYear = new Date().getFullYear();
  const availableYears = Array.from(
    new Set(
      orders
        .map(o => new Date(o.createdAt).getFullYear())
        .filter(y => !isNaN(y) && y >= currentYear)
        .concat(currentYear)
    )
  ).sort((a, b) => a - b);

  // Filtering logic with COM-B001 format, product name matching, month, year, and date
  const filteredOrders = orders.filter(o => {
    const q = search.trim().toLowerCase();
    const formattedNum = formatOrderNum(o.id).toLowerCase();
    const rawId = String(o.id);

    // Match by product name
    const matchProduct = o.items?.some(it => it.product?.nom?.toLowerCase().includes(q));

    const matchSearch = !q ||
      formattedNum.includes(q) ||
      rawId.includes(q) ||
      o.client?.nom?.toLowerCase().includes(q) ||
      o.client?.telephone?.includes(q) ||
      o.moyenPaiement?.toLowerCase().includes(q) ||
      matchProduct;

    const matchEmp = employeeFilter === "tous" ||
      (employeeFilter === "non_assigne" && !o.employeAssigneId) ||
      (o.employeAssigneId === Number(employeeFilter));

    // Date & Time parsing
    const orderDate = new Date(o.createdAt);
    const orderDateStr = orderDate.toISOString().slice(0, 10);
    const matchDate = !dateFilter || orderDateStr === dateFilter;

    // Month filter (0 = Janvier, 11 = Décembre)
    const matchMonth = monthFilter === "tous" || orderDate.getMonth() === Number(monthFilter);

    // Year filter
    const matchYear = yearFilter === "tous" || orderDate.getFullYear() === Number(yearFilter);

    // Payment status filter (paye en ligne vs a l'encaissement)
    const isOnlinePaid = o.statutPaiement === "paye" || ["carte", "mvola", "wero", "holam"].includes(o.moyenPaiement);
    const matchPaymentStatus = paymentStatusFilter === "tous" ||
      (paymentStatusFilter === "paye_en_ligne" && isOnlinePaid) ||
      (paymentStatusFilter === "a_encaissement" && !isOnlinePaid);

    return matchSearch && matchEmp && matchDate && matchMonth && matchYear && matchPaymentStatus;
  });

  // Summary stats
  const totalAmount = filteredOrders.reduce((sum, o) => sum + Number(o.total), 0);
  const pendingCount = orders.filter(o => ["en_attente", "validee", "en_livraison"].includes(o.statut)).length;
  const deliveredCount = orders.filter(o => o.statut === "recuperee" || o.statut === "livree").length;

  const paginatedOrders = filteredOrders.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <>
      {/* ── TITLE & TOOLBAR ── */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, margin: 0, color: "var(--forest-dark)" }}>Gestion des Commandes</h1>
        <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 14 }}>
          Suivez, filtrez et assignez les commandes en temps réel à vos employés.
        </p>
      </div>

      {/* ── SUMMARY KPI CARDS ── */}
      {!loaded ? <SkeletonStatCards count={4} /> : (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 28 }}>
        <div className="bs-panel" style={{ padding: 18, display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ background: "var(--forest-light)", color: "var(--forest)", borderRadius: 12, padding: 12 }}>
            <ShoppingBag size={22} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase" }}>Total Commandes</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--ink)" }}>{filteredOrders.length}</div>
          </div>
        </div>

        <div className="bs-panel" style={{ padding: 18, display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ background: "var(--accent-light)", color: "var(--accent)", borderRadius: 12, padding: 12 }}>
            <DollarSign size={22} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase" }}>Montant Total</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--forest-dark)" }}>{fcfa(totalAmount)}</div>
          </div>
        </div>

        <div className="bs-panel" style={{ padding: 18, display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ background: "#FEF3C7", color: "#D97706", borderRadius: 12, padding: 12 }}>
            <Clock size={22} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: "#B45309", fontWeight: 600, textTransform: "uppercase" }}>À Traiter / En cours</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#92400E" }}>{pendingCount}</div>
          </div>
        </div>

        <div className="bs-panel" style={{ padding: 18, display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ background: "#D1FAE5", color: "#059669", borderRadius: 12, padding: 12 }}>
            <CheckCircle2 size={22} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: "#047857", fontWeight: 600, textTransform: "uppercase" }}>Commandes Livrées</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#064E3B" }}>{deliveredCount}</div>
          </div>
        </div>
      </div>
      )}

      {/* ── SEARCH & FILTER CONTROLS ── */}
      <div className="bs-panel" style={{ padding: 18, marginBottom: 20 }}>
        {/* Row 1: Search bar + Reset button if any filter is active */}
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 14 }}>
          <div style={{ position: "relative", flex: 1 }}>
            <Search size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
            <input
              className="bs-input"
              placeholder="Rechercher par n° #COM-B001, produit, client, téléphone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 38, borderRadius: 10, fontSize: 13.5, height: 40 }}
            />
          </div>
          {(search || dateFilter || monthFilter !== "tous" || yearFilter !== "tous" || statusFilter !== "tous" || paymentStatusFilter !== "tous" || employeeFilter !== "tous") && (
            <button
              onClick={() => {
                setSearch("");
                setDateFilter("");
                setMonthFilter("tous");
                setYearFilter("tous");
                setStatusFilter("tous");
                setPaymentStatusFilter("tous");
                setEmployeeFilter("tous");
              }}
              style={{
                background: "#FEE2E2", color: "#991B1B", border: "1px solid #FCA5A5",
                borderRadius: 10, padding: "0 14px", height: 40, cursor: "pointer",
                fontSize: 12.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 6,
                whiteSpace: "nowrap"
              }}
            >
              <X size={14} /> Réinitialiser
            </button>
          )}
        </div>

        {/* Row 2: Filter Controls Pills */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          {/* Encaissement / Paiement Filter */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--paper)", padding: "4px 10px", borderRadius: 10, border: "1px solid var(--line)" }}>
            <CreditCard size={14} color="var(--muted)" />
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", whiteSpace: "nowrap" }}>Encaissement :</span>
            <select
              className="bs-select"
              value={paymentStatusFilter}
              onChange={(e) => setPaymentStatusFilter(e.target.value)}
              style={{ border: "none", background: "transparent", fontSize: 12.5, padding: "2px 4px", outline: "none", cursor: "pointer", fontWeight: 700 }}
            >
              <option value="tous">Tous les paiements</option>
              <option value="paye_en_ligne">Payé en ligne</option>
              <option value="a_encaissement">À l'encaissement (Livraison/Comptoir)</option>
            </select>
          </div>
          {/* Date Specific Filter */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--paper)", padding: "4px 10px", borderRadius: 10, border: "1px solid var(--line)" }}>
            <Calendar size={14} color="var(--muted)" />
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", whiteSpace: "nowrap" }}>Date :</span>
            <input
              type="date"
              className="bs-input"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              style={{ border: "none", background: "transparent", fontSize: 12.5, padding: "2px 4px", outline: "none", width: "auto" }}
            />
            {dateFilter && (
              <button
                onClick={() => setDateFilter("")}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 0, display: "flex" }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Month Filter */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--paper)", padding: "4px 10px", borderRadius: 10, border: "1px solid var(--line)" }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", whiteSpace: "nowrap" }}>Mois :</span>
            <select
              className="bs-select"
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              style={{ border: "none", background: "transparent", fontSize: 12.5, padding: "2px 4px", outline: "none", cursor: "pointer" }}
            >
              {MOIS.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          {/* Year Filter */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--paper)", padding: "4px 10px", borderRadius: 10, border: "1px solid var(--line)" }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", whiteSpace: "nowrap" }}>Année :</span>
            <select
              className="bs-select"
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              style={{ border: "none", background: "transparent", fontSize: 12.5, padding: "2px 4px", outline: "none", cursor: "pointer" }}
            >
              <option value="tous">Toutes</option>
              {availableYears.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--paper)", padding: "4px 10px", borderRadius: 10, border: "1px solid var(--line)" }}>
            <Filter size={14} color="var(--muted)" />
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", whiteSpace: "nowrap" }}>Statut :</span>
            <select
              className="bs-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ border: "none", background: "transparent", fontSize: 12.5, padding: "2px 4px", outline: "none", cursor: "pointer" }}
            >
              {STATUTS_FILTER.map(sf => (
                <option key={sf.value} value={sf.value}>{sf.label}</option>
              ))}
            </select>
          </div>

          {/* Agent Filter */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--paper)", padding: "4px 10px", borderRadius: 10, border: "1px solid var(--line)" }}>
            <UserCheck size={14} color="var(--muted)" />
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", whiteSpace: "nowrap" }}>Agent :</span>
            <select
              className="bs-select"
              value={employeeFilter}
              onChange={(e) => setEmployeeFilter(e.target.value)}
              style={{ border: "none", background: "transparent", fontSize: 12.5, padding: "2px 4px", outline: "none", cursor: "pointer" }}
            >
              <option value="tous">Tous les agents</option>
              <option value="non_assigne">Non assigné</option>
              {employees.map(e => (
                <option key={e.id} value={e.id}>{e.nom}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── ORDERS TABLE (SEPARATE COLUMNS FOR CMD, MODE LIVRAISON, DATE/TIME, CLIENT, TEL) ── */}
      <div className="bs-panel" style={{ padding: 0, overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
        <table className="bs-table" style={{ minWidth: 950 }}>
          <thead>
            <tr>
              <th>N° CMD</th>
              <th>Mode Livraison</th>
              <th>Date & Heure</th>
              <th>Nom & Prénom Client</th>
              <th>Téléphone</th>
              <th>Produits</th>
              <th>Montant Total</th>
              <th>Statut</th>
              <th>Agent responsable</th>
              <th style={{ textAlign: "center" }}>Détails</th>
            </tr>
          </thead>
          <tbody>
            {!loaded ? (
              <SkeletonTableRows rows={6} cols={10} />
            ) : paginatedOrders.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ textAlign: "center", padding: 36, color: "var(--muted)" }}>
                  Aucune commande ne correspond aux filtres sélectionnés.
                </td>
              </tr>
            ) : (
              paginatedOrders.map((o) => {
                const badgeStyle = STATUT_STYLE[o.statut] || STATUT_STYLE.en_attente;
                const dateObj = new Date(o.createdAt);
                const dateFormatted = dateObj.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
                const timeFormatted = dateObj.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
                
                const isRecharge = o.typeVente === "recharge_mobile" || o.notes?.includes("recharge_mobile");
                const productNames = isRecharge ? "Recharge de crédit" : (o.items?.map(it => it.product?.nom).filter(Boolean).join(", ") || "Produit(s)");
                const itemSubtitle = isRecharge ? "Crédit" : `${o.items?.length || 0} article(s)`;

                return (
                  <tr key={o.id}>
                    {/* 1. N° Commande COM-B001 format */}
                    <td>
                      <div style={{ fontWeight: 800, fontSize: 14.5, color: "var(--forest-dark)" }}>
                        {formatOrderNum(o.id)}
                      </div>
                    </td>

                    {/* 2. Mode Livraison en colonne séparée */}
                    <td>
                      <span style={{
                        padding: "5px 10px", borderRadius: 8, fontSize: 11.5, fontWeight: 700,
                        background: o.modeLivraison === "domicile" ? "var(--forest-light)" : "var(--paper)",
                        color: o.modeLivraison === "domicile" ? "var(--forest)" : "var(--muted)",
                        border: "1px solid var(--line)", display: "inline-block"
                      }}>
                        {o.modeLivraison === "domicile" ? "Livraison à domicile" : "Point de relais"}
                      </span>
                    </td>

                    {/* 3. Date & Heure */}
                    <td>
                      <div style={{ fontWeight: 700, fontSize: 13, color: "var(--ink)" }}>
                        {dateFormatted}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                        {timeFormatted}
                      </div>
                    </td>

                    {/* 4. Nom & Prénom Client */}
                    <td>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)" }}>
                        {o.client?.nom || "Client invité"}
                      </div>
                    </td>

                    {/* 5. Téléphone Client */}
                    <td>
                      <div style={{ fontSize: 13, color: "var(--forest-dark)", fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>
                        <Phone size={13} color="var(--forest)" />
                        <span>{o.client?.telephone || o.adresseLivraison?.split(",")[0] || "Non renseigné"}</span>
                      </div>
                    </td>

                    {/* 6. Produits en texte clair */}
                    <td>
                      <div style={{
                        fontWeight: 600, fontSize: 13, color: "var(--ink)",
                        maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
                      }} title={productNames}>
                        {productNames}
                      </div>
                      <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>
                        {itemSubtitle}
                      </div>
                    </td>

                    {/* 7. Montant Total */}
                    <td>
                      <div style={{ fontWeight: 800, fontSize: 15, color: "var(--forest-dark)" }}>
                        {fcfa(o.total)}
                      </div>
                      <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 4 }}>
                        {MOYEN_LABEL[o.moyenPaiement] || o.moyenPaiement || "Paiement à la livraison"}
                      </div>
                      {o.statutPaiement === 'paye' ? (
                        <span style={{ background: "#D1FAE5", color: "#064E3B", fontSize: 10.5, fontWeight: 700, padding: "3px 8px", borderRadius: 12, display: "inline-block" }}>Payé en ligne</span>
                      ) : (
                        <span style={{ background: "#FEF3C7", color: "#92400E", fontSize: 10.5, fontWeight: 700, padding: "3px 8px", borderRadius: 12, display: "inline-block" }}>À l'encaissement</span>
                      )}
                    </td>

                    {/* 8. Statut */}
                    <td>
                      {(() => {
                        if (o.statut === "en_attente_paiement") {
                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              <span
                                style={{
                                  background: "#FFFBEB",
                                  color: "#B45309",
                                  border: `1px solid #FDE68A`,
                                  borderRadius: 20,
                                  padding: "6px 14px",
                                  fontWeight: 700,
                                  fontSize: 12,
                                  display: "inline-block",
                                  cursor: "not-allowed"
                                }}
                                title="Le client n'a pas encore validé son paiement en ligne. Attendez que la transaction soit terminée."
                              >
                                Paiement en attente
                              </span>
                              <button
                                onClick={() => updateStatus(o.id, "annulee")}
                                style={{ fontSize: 11, color: "var(--danger)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", textAlign: "left", padding: 0 }}
                              >
                                Annuler (abandon)
                              </button>
                            </div>
                          );
                        }

                        const isLocked = ["annulee", "livree", "recuperee"].includes(o.statut);
                        const isDelivery = o.modeLivraison === "domicile";

                        const options = isDelivery
                          ? [
                            { key: "en_attente", label: "En attente" },
                            { key: "validee", label: "Confirmée" },

                            { key: "en_livraison", label: "En livraison" },
                            { key: "livree", label: "Livrée" },
                            { key: "annulee", label: "Annulée" }
                          ]
                          : [
                            { key: "en_attente", label: "En attente" },
                            { key: "validee", label: "Confirmée" },

                            { key: "pret_retrait", label: "Prête à récupérer" },
                            { key: "recuperee", label: "Récupérée" },
                            { key: "annulee", label: "Annulée" }
                          ];

                        const currentLabel = STATUT_LABEL[o.statut] || o.statut;

                        if (isLocked) {
                          return (
                            <span
                              style={{
                                background: badgeStyle.bg,
                                color: badgeStyle.color,
                                border: `1px solid ${badgeStyle.border}`,
                                borderRadius: 20,
                                padding: "6px 14px",
                                fontWeight: 700,
                                fontSize: 12,
                                display: "inline-block",
                                opacity: 0.85,
                                cursor: "not-allowed"
                              }}
                              title={`Cette commande est ${currentLabel.toLowerCase()}. Son statut ne peut plus être modifié.`}
                            >
                              {currentLabel}
                            </span>
                          );
                        }

                        return (
                          <select
                            value={o.statut}
                            onChange={(e) => changeStatus(o.id, e.target.value)}
                            style={{
                              background: badgeStyle.bg,
                              color: badgeStyle.color,
                              border: `1px solid ${badgeStyle.border}`,
                              borderRadius: 20,
                              padding: "6px 12px",
                              fontWeight: 700,
                              fontSize: 12,
                              cursor: "pointer",
                              outline: "none"
                            }}
                          >
                            {options.map((opt) => (
                              <option key={opt.key} value={opt.key} style={{ background: "#fff", color: "#000" }}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        );
                      })()}
                    </td>

                    {/* 9. Agent responsable */}
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{
                          width: 26, height: 26, borderRadius: "50%",
                          background: o.employeAssigne ? "var(--forest)" : "var(--line)",
                          color: o.employeAssigne ? "#fff" : "var(--muted)",
                          fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center",
                          flexShrink: 0
                        }}>
                          {o.employeAssigne ? o.employeAssigne.nom.charAt(0).toUpperCase() : "?"}
                        </div>
                        {(o.statut === "recuperee" || o.statut === "livree" || (o.employeAssigneId && user?.role !== "admin")) ? (
                          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--forest-dark)", padding: "4px 8px", background: "var(--forest-light)", borderRadius: 8, whiteSpace: "nowrap" }} title="L'agent qui a traité/récupéré cette commande est définitivement attribué sans possibilité de modification.">
                            {o.employeAssigne?.nom || "Assigné"}
                          </span>
                        ) : (
                          <select
                            className="bs-select"
                            value={o.employeAssigneId || ""}
                            onChange={(e) => assign(o.id, e.target.value)}
                            style={{ fontSize: 12, padding: "5px 8px", borderRadius: 10, flex: 1 }}
                          >
                            <option value="">Non assigné</option>
                            {employees.map((e) => (
                              <option key={e.id} value={e.id}>{e.nom}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    </td>

                    {/* 10. Action Button */}
                    <td style={{ textAlign: "center" }}>
                      <button
                        onClick={() => setSelectedOrder(o)}
                        style={{
                          background: "var(--paper)", border: "1px solid var(--line)",
                          borderRadius: 8, padding: "6px 12px", cursor: "pointer",
                          display: "inline-flex", alignItems: "center", gap: 4,
                          fontSize: 12, fontWeight: 600, color: "var(--forest)"
                        }}
                      >
                        <Eye size={14} /> Voir
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        <TablePagination
          totalItems={filteredOrders.length}
          currentPage={currentPage}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(sz) => { setPageSize(sz); setCurrentPage(1); }}
        />
      </div>

      {/* ── MODAL DETAIL COMMANDE (PHOTOS ET DETAILS COMPLETS) ── */}
      {selectedOrder && (
        <div
          onClick={() => setSelectedOrder(null)}
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
              maxWidth: 580, width: "90%", maxHeight: "90vh", overflowY: "auto",
              boxShadow: "0 12px 40px rgba(0,0,0,0.2)"
            }}
          >
            {/* Header modal avec format COM-B001 */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, borderBottom: "1px solid var(--line)", paddingBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 20, color: "var(--forest-dark)" }}>
                  Commande {formatOrderNum(selectedOrder.id)}
                </h2>
                <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>
                  Passée le {new Date(selectedOrder.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
              <button onClick={() => setSelectedOrder(null)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                <X size={20} />
              </button>
            </div>

            {/* Client & Delivery Info */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
              <div style={{ background: "var(--paper)", borderRadius: 12, padding: 14, border: "1px solid var(--line)" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", marginBottom: 6 }}>Client</div>
                <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)" }}>{selectedOrder.client?.nom || "Client"}</div>
                <div style={{ fontSize: 13, color: "var(--muted)", display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                  <Phone size={13} /> {selectedOrder.client?.telephone || "Non renseigné"}
                </div>
              </div>

              <div style={{ background: "var(--paper)", borderRadius: 12, padding: 14, border: "1px solid var(--line)" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", marginBottom: 6 }}>Mode & Adresse</div>
                <div style={{ fontWeight: 700, fontSize: 13.5, color: "var(--forest-dark)" }}>
                  {selectedOrder.modeLivraison === "domicile" ? "Livraison à domicile" : "Point de relais"}
                </div>
                <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 4 }}>
                  {selectedOrder.adresseLivraison || "Retrait en boutique"}
                </div>
              </div>
            </div>

            {/* Agent in charge panel */}
            <div style={{ background: "var(--forest-light)", borderRadius: 12, padding: 14, marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <UserCheck size={18} color="var(--forest)" />
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--sage)", textTransform: "uppercase" }}>Agent responsable de la commande</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--forest-dark)" }}>
                    {selectedOrder.employeAssigne?.nom || "Aucun agent assigné pour l'instant"}
                  </div>
                </div>
              </div>
              {(selectedOrder.statut === "recuperee" || selectedOrder.statut === "livree" || (selectedOrder.employeAssigneId && user?.role !== "admin")) ? (
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--forest-dark)", padding: "6px 12px", background: "var(--paper)", borderRadius: 8, border: "1px solid var(--line)" }} title="L'agent qui a traité/récupéré cette commande est définitivement attribué sans possibilité de modification.">
                  {selectedOrder.employeAssigne?.nom ? `Assigné à ${selectedOrder.employeAssigne.nom}` : "Agent attribué"}
                </span>
              ) : (
                <select
                  className="bs-select"
                  value={selectedOrder.employeAssigneId || ""}
                  onChange={(e) => assign(selectedOrder.id, e.target.value)}
                  style={{ fontSize: 12, padding: "6px 10px", borderRadius: 10 }}
                >
                  <option value="">Assigner un agent</option>
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>{e.nom}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Items list with full photos and details */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: "var(--ink)" }}>Articles commandés (Photos & Détails)</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {selectedOrder.typeVente === "recharge_mobile" || selectedOrder.notes?.includes("recharge_mobile") ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 10, background: "var(--paper)", borderRadius: 10, border: "1px solid var(--line)" }}>
                    <div style={{ width: 44, height: 44, borderRadius: 8, background: "#E0F2FE", color: "#0284C7", display: "flex", alignItems: "center", justifyContent: "center" }}>
                       <Smartphone size={24} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 13.5, color: "var(--ink)" }}>Recharge Crédit Mobile</div>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>
                         {(() => {
                            const phoneMatch = (selectedOrder.notes || "").match(/\+?\d{7,15}/);
                            const kmfMatch = (selectedOrder.notes || "").match(/(\d[\d\s]*)\s*KMF/i);
                            const phone = phoneMatch ? phoneMatch[0] : (selectedOrder.client?.telephone || "");
                            const kmf = kmfMatch ? kmfMatch[1].trim() + " KMF" : "";
                            return `N° ${phone}${kmf ? ` - ${kmf}` : ""}`;
                         })()}
                      </div>
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 14, color: "var(--forest-dark)" }}>
                      {fcfa(selectedOrder.total)}
                    </div>
                  </div>
                ) : selectedOrder.items?.map((it, idx) => (
                  <div key={idx} style={{ display: "flex", alignItems: "center", gap: 12, padding: 10, background: "var(--paper)", borderRadius: 10, border: "1px solid var(--line)" }}>
                    <img
                      src={it.product?.imageUrl || "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=60&q=80"}
                      alt={it.product?.nom}
                      style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover", border: "1px solid var(--line)" }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 13.5, color: "var(--ink)" }}>{it.product?.nom}</div>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>{fcfa(it.prixUnitaire)} x {it.quantite}</div>
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 14, color: "var(--forest-dark)" }}>
                      {fcfa(it.prixUnitaire * it.quantite)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pricing Summary */}
            <div style={{ borderTop: "1.5px solid var(--line)", paddingTop: 16, display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--muted)" }}>
                <span>Sous-total</span>
                <span>{fcfa(selectedOrder.sousTotal || selectedOrder.total)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--muted)" }}>
                <span>Frais de livraison</span>
                <span>{fcfa(selectedOrder.fraisLivraison || 0)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--muted)", alignItems: "center" }}>
                <span>Statut du paiement</span>
                {selectedOrder.statutPaiement === 'paye' ? (
                  <span style={{ background: "#D1FAE5", color: "#064E3B", fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 12 }}>Payé en ligne</span>
                ) : selectedOrder.statut === 'en_attente_paiement' ? (
                  <span style={{ background: "#FFFBEB", color: "#B45309", fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 12 }}>Paiement en attente</span>
                ) : (
                  <span style={{ background: "#FEF3C7", color: "#92400E", fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 12 }}>À l'encaissement</span>
                )}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 800, color: "var(--forest-dark)", marginTop: 6, paddingTop: 10, borderTop: "1px solid var(--line)" }}>
                <span>Total</span>
                <span>{fcfa(selectedOrder.total)}</span>
              </div>
              {selectedOrder.receiptUrl && (
                <div style={{ marginTop: 12 }}>
                  <a href={selectedOrder.receiptUrl} target="_blank" rel="noopener noreferrer" style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 10, padding: "10px", textDecoration: "none", color: "var(--forest-dark)", fontWeight: 700, fontSize: 13 }}>
                    Voir le reçu du paiement
                  </a>
                </div>
              )}
            </div>

            {/* Close button */}
            <button
              onClick={() => setSelectedOrder(null)}
              className="bs-btn-primary"
              style={{ width: "100%", marginTop: 24, padding: "12px" }}
            >
              Fermer les détails
            </button>
          </div>
        </div>
      )}
    </>
  );
}
