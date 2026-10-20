import { SkeletonTableRows } from "../../components/Skeleton.jsx";
import React, { useEffect, useState } from "react";
import { 
  Search, FileText, Download, Printer, Eye, Calendar, DollarSign, 
  CreditCard, Smartphone, CheckCircle, User, ShoppingBag, History, X, Building
} from "lucide-react";
import api from "../../api";
import TablePagination from "../../components/TablePagination.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { subscribeRealtime } from "../../utils/realtime.js";
import ReceiptModal from "../../components/ReceiptModal.jsx";

import { formatPrice as fcfa } from "../../utils/currency.js";

const MONTHS = [
  { value: "01", label: "Janvier" },
  { value: "02", label: "Février" },
  { value: "03", label: "Mars" },
  { value: "04", label: "Avril" },
  { value: "05", label: "Mai" },
  { value: "06", label: "Juin" },
  { value: "07", label: "Juillet" },
  { value: "08", label: "Août" },
  { value: "09", label: "Septembre" },
  { value: "10", label: "Octobre" },
  { value: "11", label: "Novembre" },
  { value: "12", label: "Décembre" }
];

export default function SalesHistory() {
  const { user, boutique } = useAuth();
  const storeName = boutique?.nom || "Marché Vert";
  const [orders, setOrders] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("tous"); // "tous" | "vente_directe" | "commande_enligne"
  const [filterPaiement, setFilterPaiement] = useState("tous"); // "tous" | "cash" | "mvola" | "wero" | "carte"
  const [filterEmploye, setFilterEmploye] = useState("tous");
  const [filterAnnee, setFilterAnnee] = useState(new Date().getFullYear().toString());
  const [filterMois, setFilterMois] = useState("");
  const [isTodayOnly, setIsTodayOnly] = useState(false);

  // Detail Modal
  const [selectedOrder, setSelectedOrder] = useState(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  function loadData() {
    setLoading(true);
    api.get("/admin/orders")
      .then((res) => setOrders(res.data || []))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));

    api.get("/admin/employees")
      .then((res) => setEmployees(res.data || []))
      .catch(() => setEmployees([]));
  }

  useEffect(() => {
    loadData();
    const unsub = subscribeRealtime((detail) => {
      if (detail.type === "order_created" || detail.type === "order_updated") {
        loadData();
      }
    });
    return unsub;
  }, []);

  // Filter logic
  const filteredOrders = orders.filter((o) => {
    // Type detection
    const isRecharge = o.typeVente === "recharge_mobile" || o.notes?.includes("recharge_mobile") || o.items?.some(it => it.product?.nom?.toLowerCase().includes("recharge"));
    const isPOS = !isRecharge && (o.typeVente === "vente_directe" || o.adresseLivraison?.includes("Achat direct") || o.modeLivraison === "retrait");
    
    let saleType = "commande_enligne";
    if (isRecharge) saleType = "recharge_mobile";
    else if (isPOS) saleType = "vente_directe";

    if (filterType !== "tous" && saleType !== filterType) return false;

    // Paiement filter
    if (filterPaiement !== "tous") {
      const p = o.moyenPaiement;
      if (filterPaiement === "cash" && p !== "cash" && p !== "especes") return false;
      if (filterPaiement === "mvola" && p !== "mvola") return false;
      if (filterPaiement === "wero" && p !== "wero" && p !== "holam") return false;
      if (filterPaiement === "carte" && p !== "carte") return false;
    }

    // Employe filter
    if (filterEmploye !== "tous") {
      if (filterEmploye === "non_assigne") {
        if (o.employeAssigneId) return false;
      } else if (String(o.employeAssigneId) !== String(filterEmploye)) {
        return false;
      }
    }

    // Date filters
    const orderDate = new Date(o.createdAt);
    const orderYear = orderDate.getFullYear().toString();
    const orderMonth = String(orderDate.getMonth() + 1).padStart(2, "0");

    if (isTodayOnly) {
      const today = new Date();
      const isSameDay = orderDate.getDate() === today.getDate() &&
        orderDate.getMonth() === today.getMonth() &&
        orderDate.getFullYear() === today.getFullYear();
      if (!isSameDay) return false;
    } else {
      if (filterAnnee && orderYear !== filterAnnee) return false;
      if (filterMois && orderMonth !== filterMois) return false;
    }

    // Search query
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      const matchClient = o.client?.nom?.toLowerCase().includes(q) || o.client?.telephone?.includes(q);
      const matchId = `com-b${String(o.id).padStart(3, "0")}`.includes(q) || String(o.id).includes(q);
      const matchItems = o.items?.some(it => it.product?.nom?.toLowerCase().includes(q));
      if (!matchClient && !matchId && !matchItems) return false;
    }

    return true;
  });

  // Calculate totals for KPI cards
  const totalCash = filteredOrders
    .filter(o => o.moyenPaiement === "cash" || o.moyenPaiement === "especes")
    .reduce((sum, o) => sum + Number(o.total || 0), 0);

  const totalMvola = filteredOrders
    .filter(o => o.moyenPaiement === "mvola")
    .reduce((sum, o) => sum + Number(o.total || 0), 0);

  const totalWero = filteredOrders
    .filter(o => o.moyenPaiement === "wero" || o.moyenPaiement === "holam")
    .reduce((sum, o) => sum + Number(o.total || 0), 0);

  const totalCarte = filteredOrders
    .filter(o => o.moyenPaiement === "carte")
    .reduce((sum, o) => sum + Number(o.total || 0), 0);

  const totalAchatCredit = filteredOrders
    .filter(o => o.typeVente === "recharge_mobile" || o.notes?.includes("recharge_mobile") || o.items?.some(it => it.product?.nom?.toLowerCase().includes("recharge")))
    .reduce((sum, o) => sum + Number(o.total || 0), 0);

  const totalGlobal = filteredOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);

  // Reset page
  useEffect(() => { setCurrentPage(1); }, [search, filterType, filterPaiement, filterEmploye, filterAnnee, filterMois, isTodayOnly]);

  const totalItems = filteredOrders.length;
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // Export CSV
  function handleExportExcel() {
    const headers = ["ID Vente", "Date", "Client", "Téléphone", "Type", "Employé", "Mode Paiement", "Total (€)"];
    const rows = filteredOrders.map(o => {
      const isRecharge = o.typeVente === "recharge_mobile" || o.notes?.includes("recharge_mobile") || o.items?.some(it => it.product?.nom?.toLowerCase().includes("recharge"));
      const isPOS = !isRecharge && (o.typeVente === "vente_directe" || o.adresseLivraison?.includes("Achat direct"));
      const dateStr = new Date(o.createdAt).toLocaleString("fr-FR");
      const typeStr = isRecharge ? "Recharge Crédit Mobile" : isPOS ? "Vente Directe (POS)" : "Commande en Ligne";
      const empStr = o.employeAssigne?.nom || "Admin / Système";
      const payStr = (o.moyenPaiement === "cash" || o.moyenPaiement === "especes") ? "Cash / Espèces"
        : o.moyenPaiement === "mvola" ? "MVola"
        : (o.moyenPaiement === "wero" || o.moyenPaiement === "holam") ? "Wero"
        : "Carte Bancaire";
      return [
        `#COM-B${String(o.id).padStart(3, "0")}`,
        `"${dateStr}"`,
        `"${o.client?.nom || "Client comptoir"}"`,
        `"${o.client?.telephone || "-"}"`,
        `"${typeStr}"`,
        `"${empStr}"`,
        `"${payStr}"`,
        Number(o.total || 0).toFixed(2)
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `historique_ventes_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function handleExportPDF() {
    window.print();
  }

  return (
    <>
      {/* HEADER PAGE */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 26, margin: 0, color: "var(--forest-dark)" }}>Historique des Ventes</h1>
          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 14 }}>
            Consultez, filtrez et analysez toutes les ventes directes, recharges mobile et commandes en ligne.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={handleExportPDF}
            className="bs-btn-primary"
            style={{ background: "#F1F5F9", color: "#334155", border: "1px solid #CBD5E1", fontSize: 13, padding: "8px 16px", boxShadow: "none" }}
          >
            <Printer size={15} style={{ marginRight: 6 }} /> Imprimer / PDF
          </button>
          <button
            onClick={handleExportExcel}
            className="bs-btn-primary"
            style={{ background: "var(--forest-light)", color: "var(--forest-dark)", fontSize: 13, padding: "8px 16px", boxShadow: "none" }}
          >
            <Download size={15} style={{ marginRight: 6 }} /> Export Excel
          </button>
        </div>
      </div>

      {/* FILTER BAR ROW */}
      <div className="bs-panel" style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          {/* SEARCH INPUT */}
          <div style={{ position: "relative", flex: 2, minWidth: 220 }}>
            <Search size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
            <input
              className="bs-input"
              placeholder="Rechercher par client, produit, N° vente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 38, height: 40, fontSize: 13.5 }}
            />
          </div>

          {/* FILTER: TYPE VENTE */}
          <select
            className="bs-select"
            style={{ flex: 1, minWidth: 160, height: 40 }}
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="tous">Tout type de vente</option>
            <option value="vente_directe">Vente Directe (POS)</option>
            <option value="commande_enligne">Commande en Ligne</option>
            <option value="recharge_mobile">Recharge Crédit Mobile</option>
          </select>

          {/* FILTER: PAIEMENT */}
          <select
            className="bs-select"
            style={{ flex: 1, minWidth: 150, height: 40 }}
            value={filterPaiement}
            onChange={(e) => setFilterPaiement(e.target.value)}
          >
            <option value="tous">Tous les paiements</option>
            <option value="cash">Espèces / Cash</option>
            <option value="mvola">MVola</option>
            <option value="wero">Wero</option>
            <option value="carte">Carte Bancaire</option>
          </select>

          {/* FILTER: EMPLOYÉ */}
          <select
            className="bs-select"
            style={{ flex: 1, minWidth: 160, height: 40 }}
            value={filterEmploye}
            onChange={(e) => setFilterEmploye(e.target.value)}
          >
            <option value="tous">Tous les employés</option>
            {employees.map(emp => (
              <option key={emp.id} value={emp.id}>{emp.nom} ({emp.role === "admin" ? "Admin" : "Employé"})</option>
            ))}
            <option value="non_assigne">Admin / Système</option>
          </select>

          {/* FILTER: ANNÉE */}
          <select
            className="bs-select"
            style={{ width: 130, height: 40 }}
            value={filterAnnee}
            onChange={(e) => { setFilterAnnee(e.target.value); setIsTodayOnly(false); }}
          >
            <option value="">Toutes années</option>
            <option value={new Date().getFullYear().toString()}>{new Date().getFullYear()}</option>
          </select>

          {/* FILTER: MOIS */}
          <select
            className="bs-select"
            style={{ width: 130, height: 40 }}
            value={filterMois}
            onChange={(e) => { setFilterMois(e.target.value); setIsTodayOnly(false); }}
          >
            <option value="">Tous les mois</option>
            {MONTHS.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>

          {/* QUICK TODAY BUTTON */}
          <button
            onClick={() => setIsTodayOnly(!isTodayOnly)}
            style={{
              height: 40, padding: "0 16px", borderRadius: 8, border: "1px solid var(--line)",
              background: isTodayOnly ? "var(--forest)" : "var(--paper)",
              color: isTodayOnly ? "#fff" : "var(--forest-dark)",
              fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6
            }}
          >
            <Calendar size={15} /> Aujourd'hui
          </button>
        </div>
      </div>

      {/* KPI SUMMARY CARDS (6 CARDS) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 14, marginBottom: 20 }}>
        {/* TOTAL CASH */}
        <div className="bs-panel" style={{ padding: 16, background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#166534", fontSize: 11.5, fontWeight: 800, textTransform: "uppercase" }}>
            <DollarSign size={15} /> TOTAL CASH
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#15803D", marginTop: 6 }}>
            {fcfa(totalCash)}
          </div>
        </div>

        {/* TOTAL MVOLA */}
        <div className="bs-panel" style={{ padding: 16, background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#047857", fontSize: 11.5, fontWeight: 800, textTransform: "uppercase" }}>
            <Smartphone size={15} /> TOTAL MVOLA
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#059669", marginTop: 6 }}>
            {fcfa(totalMvola)}
          </div>
        </div>

        {/* TOTAL WERO */}
        <div className="bs-panel" style={{ padding: 16, background: "#FEFCE8", border: "1px solid #FEF08A", borderRadius: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#854D0E", fontSize: 11.5, fontWeight: 800, textTransform: "uppercase" }}>
            <Smartphone size={15} /> TOTAL WERO
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#CA8A04", marginTop: 6 }}>
            {fcfa(totalWero)}
          </div>
        </div>

        {/* TOTAL CARTE */}
        <div className="bs-panel" style={{ padding: 16, background: "#F5F3FF", border: "1px solid #DDD6FE", borderRadius: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#6D28D9", fontSize: 11.5, fontWeight: 800, textTransform: "uppercase" }}>
            <CreditCard size={15} /> TOTAL CARTE
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#7C3AED", marginTop: 6 }}>
            {fcfa(totalCarte)}
          </div>
        </div>

        {/* TOTAL ACHAT CRÉDIT */}
        <div className="bs-panel" style={{ padding: 16, background: "#E0F2FE", border: "1px solid #BAE6FD", borderRadius: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#0369A1", fontSize: 11.5, fontWeight: 800, textTransform: "uppercase" }}>
            <Smartphone size={15} color="#0284C7" /> ACHAT CRÉDIT
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#0284C7", marginTop: 6 }}>
            {fcfa(totalAchatCredit)}
          </div>
        </div>

        {/* TOTAL GLOBAL */}
        <div className="bs-panel" style={{ padding: 16, background: "var(--forest-light)", border: "1px solid #A7F3D0", borderRadius: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--forest-dark)", fontSize: 11.5, fontWeight: 800, textTransform: "uppercase" }}>
            <ShoppingBag size={15} /> TOTAL GLOBAL
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: "var(--forest-dark)", marginTop: 6 }}>
            {fcfa(totalGlobal)}
          </div>
        </div>
      </div>

      {/* SALES HISTORY DATA TABLE */}
      <div className="bs-panel" style={{ padding: 0, overflow: "hidden" }}>
        <table className="bs-table">
          <thead>
            <tr>
              <th>DATE</th>
              <th>CLIENT</th>
              <th>PRODUIT(S)</th>
              <th>TYPE</th>
              <th>EMPLOYÉ</th>
              <th>PAIEMENT</th>
              <th>MONTANT</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <SkeletonTableRows rows={6} cols={8} />
            )}
            {!loading && paginatedOrders.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>
                  Aucune vente enregistrée pour les filtres sélectionnés.
                </td>
              </tr>
            )}
            {!loading && paginatedOrders.map((o) => {
              const isRecharge = o.typeVente === "recharge_mobile" || o.notes?.includes("recharge_mobile") || o.items?.some(it => it.product?.nom?.toLowerCase().includes("recharge"));
              const isPOS = !isRecharge && (o.typeVente === "vente_directe" || o.adresseLivraison?.includes("Achat direct") || o.modeLivraison === "retrait");
              const dateFormatted = new Date(o.createdAt).toLocaleDateString("fr-FR", {
                day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
              });

              // Format items: Max 2 displayed cleanly without bullet point, then "+ X autres"
              const itemsList = o.items || [];
              const displayItems = itemsList.slice(0, 2);
              const extraCount = itemsList.length - 2;

              const isCash = o.moyenPaiement === "cash" || o.moyenPaiement === "especes";
              const isMvola = o.moyenPaiement === "mvola";
              const isWero = o.moyenPaiement === "wero" || o.moyenPaiement === "holam";

              return (
                <tr key={o.id}>
                  <td style={{ fontSize: 12.5, whiteSpace: "nowrap" }}>
                    <div style={{ fontWeight: 700, color: "var(--ink)" }}>{dateFormatted}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>#COM-B{String(o.id).padStart(3, "0")}</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 700, color: "var(--ink)" }}>{o.client?.nom || "Client comptoir"}</div>
                    {o.client?.telephone && o.client.telephone !== "non_renseigne" && (
                      <div style={{ fontSize: 11.5, color: "var(--muted)" }}>Tél: {o.client.telephone}</div>
                    )}
                  </td>
                  <td>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 12.5 }}>
                      {displayItems.map((it, i) => (
                        <div key={i} style={{ color: "var(--ink)", fontWeight: 500 }}>
                          <span style={{ fontWeight: 700 }}>{it.product?.nom || "Produit"}</span>
                          <span style={{ color: "var(--muted)", marginLeft: 4, fontSize: 11.5 }}>x{it.quantite}</span>
                        </div>
                      ))}
                      {extraCount > 0 && (
                        <div style={{ fontSize: 11.5, color: "var(--forest-dark)", fontWeight: 700, marginTop: 2 }}>
                          + {extraCount} autre{extraCount > 1 ? "s" : ""}...
                        </div>
                      )}
                    </div>
                  </td>
                  <td>
                    {isRecharge ? (
                      <span style={{ background: "#E0F2FE", color: "#0284C7", padding: "4px 10px", borderRadius: 20, fontSize: 11.5, fontWeight: 800, whiteSpace: "nowrap" }}>
                        Recharge Mobile
                      </span>
                    ) : isPOS ? (
                      <span style={{ background: "#DCFCE7", color: "#166534", padding: "4px 10px", borderRadius: 20, fontSize: 11.5, fontWeight: 800, whiteSpace: "nowrap" }}>
                        Vente Directe (POS)
                      </span>
                    ) : (
                      <span style={{ background: "#DBEAFE", color: "#1E40AF", padding: "4px 10px", borderRadius: 20, fontSize: 11.5, fontWeight: 800, whiteSpace: "nowrap" }}>
                        Commande en ligne
                      </span>
                    )}
                  </td>
                  <td style={{ fontSize: 12.5 }}>
                    <span style={{ fontWeight: 600, color: "var(--forest-dark)" }}>
                      {o.employeAssigne?.nom || "Admin / Système"}
                    </span>
                  </td>
                  <td>
                    <span style={{
                      padding: "4px 10px", borderRadius: 12, fontSize: 11.5, fontWeight: 800,
                      background: isCash ? "#FEF3C7" : isMvola ? "#DCFCE7" : isWero ? "#FEF9C3" : "#F3E8FF",
                      color: isCash ? "#92400E" : isMvola ? "#15803D" : isWero ? "#854D0E" : "#6B21A8"
                    }}>
                      {isCash ? "Cash / Espèces" : isMvola ? "MVola" : isWero ? "Wero" : "Carte"}
                    </span>
                  </td>
                  <td style={{ fontWeight: 800, fontSize: 14, color: "var(--forest-dark)", whiteSpace: "nowrap" }}>
                    {fcfa(o.total)}
                  </td>
                  <td>
                    <button
                      className="bs-icon-btn"
                      title="Voir le reçu / ticket de caisse"
                      onClick={() => setSelectedOrder(o)}
                    >
                      <Eye size={16} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* PAGINATION */}
        <TablePagination
          totalItems={totalItems}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* MODAL REÇU / TICKET DE CAISSE AUTHENTIQUE */}
      {selectedOrder && (
        <ReceiptModal
          order={selectedOrder}
          boutique={boutique}
          onClose={() => setSelectedOrder(null)}
        />
      )}
    </>
  );
}
