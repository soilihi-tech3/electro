import { SkeletonTableRows } from "../../components/Skeleton.jsx";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Search, FileText, Download, Printer, Eye, Calendar, DollarSign, 
  CreditCard, Smartphone, CheckCircle, User, ShoppingBag, History, X, Building, AlertTriangle,
  Edit2, Trash2, ArrowRight, MessageCircle, Bell
} from "lucide-react";
import { toast } from "react-hot-toast";
import api from "../../api";
import TablePagination from "../../components/TablePagination.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { subscribeRealtime } from "../../utils/realtime.js";
import InvoiceModal from "../../components/InvoiceModal.jsx";

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
  const { user, boutique, hasPerm } = useAuth();
  const navigate = useNavigate();
  const storeName = boutique?.nom || "Marché Vert";
  const [orders, setOrders] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("tous"); // "tous" | "vente_directe" | "commande_enligne"
  const [filterPaiement, setFilterPaiement] = useState("tous"); // "tous" | "cash" | "mvola" | "wero" | "carte"
  const [filterStatutPaiement, setFilterStatutPaiement] = useState("tous"); // "tous" | "paye" | "partiel" | "non_paye"
  const [filterEmploye, setFilterEmploye] = useState("tous");
  const [filterAnnee, setFilterAnnee] = useState(new Date().getFullYear().toString());
  const [filterMois, setFilterMois] = useState("");
  const [isTodayOnly, setIsTodayOnly] = useState(false);

  // Detail Modal (Facture A4)
  const [selectedOrder, setSelectedOrder] = useState(null);

  // Payment Modal (Régler solde / Encaisser versement)
  const [paymentModalOrder, setPaymentModalOrder] = useState(null);
  const [versementMontant, setVersementMontant] = useState("");
  const [versementMoyen, setVersementMoyen] = useState("cash");
  const [versementLoading, setVersementLoading] = useState(false);

  // Edit Modal (Modifier vente)
  const [editModalOrder, setEditModalOrder] = useState(null);
  const [editForm, setEditForm] = useState({ adresseLivraison: "", moyenPaiement: "cash", notesAdmin: "" });
  const [editLoading, setEditLoading] = useState(false);

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
    // Exclure expressément les devis proforma de l'historique des ventes
    const isDevis = o.typeDocument === "devis" || o.statut === "devis" || o.typeVente === "devis" || o.moyenPaiement === "devis";
    if (isDevis) return false;

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

    // Statut de paiement filter
    if (filterStatutPaiement !== "tous") {
      const rest = Number(o.montantRestant !== undefined ? o.montantRestant : (o.statutPaiement === "paye" ? 0 : o.total));
      const recu = Number(o.montantRecu !== undefined ? o.montantRecu : (o.statutPaiement === "paye" ? o.total : 0));
      const st = o.statutPaiement || (rest <= 0 ? "paye" : recu > 0 ? "partiel" : "non_paye");
      if (filterStatutPaiement === "paye" && st !== "paye") return false;
      if (filterStatutPaiement === "partiel" && st !== "partiel") return false;
      if (filterStatutPaiement === "non_paye" && st !== "non_paye") return false;
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

  // Calculate totals for KPI cards (Suppression carte, wero et achat crédit demandée par le client)
  const totalCash = filteredOrders
    .filter(o => o.moyenPaiement === "cash" || o.moyenPaiement === "especes")
    .reduce((sum, o) => sum + Number(o.total || 0), 0);

  const totalMvola = filteredOrders
    .filter(o => o.moyenPaiement === "mvola")
    .reduce((sum, o) => sum + Number(o.total || 0), 0);

  const totalCreditsEnCours = filteredOrders
    .reduce((sum, o) => {
      const rest = Number(o.montantRestant !== undefined ? o.montantRestant : (o.statutPaiement === "paye" ? 0 : o.total));
      return sum + (rest > 0 ? rest : 0);
    }, 0);

  const totalGlobal = filteredOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);

  // Reset page
  useEffect(() => { setCurrentPage(1); }, [search, filterType, filterPaiement, filterStatutPaiement, filterEmploye, filterAnnee, filterMois, isTodayOnly]);

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

  // SUPPRIMER UNE VENTE
  async function handleDeleteSale(o) {
    const num = `COM-B${String(o.id).padStart(3, "0")}`;
    if (!window.confirm(`Supprimer définitivement la vente #${num} ?\nLes articles vendus seront automatiquement réintégrés en stock.`)) {
      return;
    }
    try {
      await api.delete(`/admin/orders/${o.id}`);
      toast.success("Vente supprimée et stocks réintégrés avec succès.");
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de la suppression de la vente.");
    }
  }

  // RÉGLER LE SOLDE / VERSEMENT COMPLÉMENTAIRE
  function openPaymentModal(o) {
    const rest = Number(o.montantRestant !== undefined ? o.montantRestant : (o.statutPaiement === "paye" ? 0 : o.total));
    setPaymentModalOrder(o);
    setVersementMontant(String(rest > 0 ? rest : ""));
    setVersementMoyen(o.moyenPaiement === "mvola" ? "mvola" : "cash");
  }

  async function handleValiderVersement(e) {
    e.preventDefault();
    if (!versementMontant || isNaN(versementMontant) || Number(versementMontant) <= 0) {
      toast.error("Veuillez saisir un montant de versement supérieur à 0.");
      return;
    }
    setVersementLoading(true);
    try {
      await api.put(`/admin/orders/${paymentModalOrder.id}`, {
        versementComplementaire: Number(versementMontant),
        moyenPaiement: versementMoyen
      });
      toast.success("Paiement complémentaire enregistré avec succès !");
      setPaymentModalOrder(null);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de l'enregistrement du versement.");
    } finally {
      setVersementLoading(false);
    }
  }

  // MODIFIER LA VENTE (Redirige vers la caisse pour les ventes directes)
  function handleEditSale(o) {
    const isRecharge = o.typeVente === "recharge_mobile" || o.notes?.includes("recharge_mobile");
    const isPOS = !isRecharge && (o.typeVente === "vente_directe" || o.adresseLivraison?.includes("Achat direct") || o.modeLivraison === "retrait");

    if (isPOS) {
      navigate(`/admin/vente?modifierVenteId=${o.id}`);
    } else {
      toast("Seules les ventes directes de caisse peuvent être ajustées dans le panier POS. Les commandes en ligne se gèrent via l'onglet Commandes.", {
        icon: "ℹ️"
      });
    }
  }

  // RAPPEL WHATSAPP POUR LES FACTURES EN DETTE / RETARD
  function handleSendWhatsAppReminder(o) {
    const rawPhone = o.client?.telephone || "";
    const cleanPhone = rawPhone.replace(/\D/g, "");
    if (!cleanPhone || cleanPhone === "non_renseigne") {
      toast.error(`Aucun numéro de téléphone valide n'est enregistré pour ${o.client?.nom || "ce client"}.`);
      return;
    }
    const rest = Number(o.montantRestant !== undefined ? o.montantRestant : (o.statutPaiement === "paye" ? 0 : o.total));
    const numFacture = `#COM-B${String(o.id).padStart(3, "0")}`;
    const echeanceStr = o.dateEcheance ? ` (date limite d'échéance : ${new Date(o.dateEcheance).toLocaleDateString("fr-FR")})` : "";
    
    let formattedPhone = cleanPhone;
    if (cleanPhone.length === 7) {
      formattedPhone = `269${cleanPhone}`;
    }

    const message = `Bonjour ${o.client?.nom || "cher client"},\n\nNous vous contactons de la part de ${storeName} concernant votre facture ${numFacture}.\nUn montant restant de ${fcfa(rest, boutique?.devise)} est en attente de règlement${echeanceStr}.\n\nMerci de bien vouloir passer à la boutique pour régulariser votre situation.\n\nCordialement,\n${storeName}`;

    window.open(`https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodeURIComponent(message)}`, "_blank");
    toast.success("Discussion WhatsApp ouverte pour le rappel de facture.");
  }

  // Liste des factures avec échéance dépassée et reste à payer > 0 (hors devis proforma)
  const overdueSales = orders.filter((o) => {
    const isDevis = o.typeDocument === "devis" || o.statut === "devis" || o.typeVente === "devis" || o.moyenPaiement === "devis";
    if (isDevis) return false;
    const rest = Number(o.montantRestant !== undefined ? o.montantRestant : (o.statutPaiement === "paye" ? 0 : o.total));
    if (rest <= 0) return false;
    if (!o.dateEcheance) return false;
    const ech = new Date(o.dateEcheance);
    ech.setHours(23, 59, 59, 999);
    return ech < new Date();
  });

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

      {/* NOTIFICATION D'ALERTE : CRÉANCES & ÉCHÉANCES DÉPASSÉES */}
      {overdueSales.length > 0 && (
        <div style={{
          background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 14, padding: "14px 18px",
          display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20,
          boxShadow: "0 2px 10px rgba(220, 38, 38, 0.08)", flexWrap: "wrap", gap: 14
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 42, height: 42, borderRadius: 10, background: "#FEE2E2",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
            }}>
              <AlertTriangle size={22} color="#DC2626" />
            </div>
            <div>
              <div style={{ fontWeight: 800, color: "#991B1B", fontSize: 14 }}>
                Alerte Recouvrement : {overdueSales.length} facture{overdueSales.length > 1 ? "s ont" : " a"} dépassé la date d'échéance !
              </div>
              <div style={{ fontSize: 12.5, color: "#7F1D1D", marginTop: 2 }}>
                Ces clients ont des créances impayées échues. Utilisez l'icône WhatsApp verte dans les actions pour leur envoyer un rappel immédiat.
              </div>
            </div>
          </div>
          <button
            onClick={() => setFilterStatutPaiement("non_paye")}
            style={{
              background: "#DC2626", color: "#fff", border: "none", borderRadius: 8,
              padding: "8px 16px", fontSize: 12.5, fontWeight: 800, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6
            }}
          >
            <Bell size={14} /> Filtrer les impayés ({overdueSales.length})
          </button>
        </div>
      )}

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

          {/* FILTER: STATUT DE PAIEMENT */}
          <select
            className="bs-select"
            style={{ flex: 1, minWidth: 160, height: 40, fontWeight: 600 }}
            value={filterStatutPaiement}
            onChange={(e) => setFilterStatutPaiement(e.target.value)}
          >
            <option value="tous">Tous statuts de paiement</option>
            <option value="paye">Payé (Intégralement)</option>
            <option value="partiel">Paiement partiel (Acompte)</option>
            <option value="non_paye">Non payé (À crédit)</option>
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

      {/* KPI SUMMARY CARDS (5 CARDS DYNAMIQUES: NB VENTES, CASH, MVOLA, RESTE À RECOUVRER, TOTAL GLOBAL) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14, marginBottom: 20 }}>
        {/* NOMBRE TOTAL DE VENTES */}
        <div className="bs-panel" style={{ padding: 18, background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#475569", fontSize: 11.5, fontWeight: 800, textTransform: "uppercase" }}>
            <ShoppingBag size={16} color="var(--forest)" /> NB TOTAL VENTES
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "var(--forest-dark)", marginTop: 6 }}>
            {filteredOrders.length} <span style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>vente(s)</span>
          </div>
        </div>

        {/* TOTAL CASH */}
        <div className="bs-panel" style={{ padding: 18, background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#166534", fontSize: 11.5, fontWeight: 800, textTransform: "uppercase" }}>
            <DollarSign size={16} /> TOTAL CASH
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#15803D", marginTop: 6 }}>
            {fcfa(totalCash, boutique?.devise)}
          </div>
        </div>

        {/* TOTAL MVOLA */}
        <div className="bs-panel" style={{ padding: 18, background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#047857", fontSize: 11.5, fontWeight: 800, textTransform: "uppercase" }}>
            <Smartphone size={16} /> TOTAL MVOLA
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#059669", marginTop: 6 }}>
            {fcfa(totalMvola, boutique?.devise)}
          </div>
        </div>

        {/* RESTE À RECOUVRER (DYNAMIQUE PAR EMPLOYÉ ET FILTRES) */}
        <div className="bs-panel" style={{ padding: 18, background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#991B1B", fontSize: 11.5, fontWeight: 800, textTransform: "uppercase" }}>
            <AlertTriangle size={16} color="#DC2626" /> RESTE À RECOUVRER {filterEmploye !== "tous" && employees.find(e => String(e.id) === String(filterEmploye)) ? `(${employees.find(e => String(e.id) === String(filterEmploye)).nom})` : ""}
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#DC2626", marginTop: 6 }}>
            {fcfa(totalCreditsEnCours, boutique?.devise)}
          </div>
        </div>

        {/* TOTAL GLOBAL */}
        <div className="bs-panel" style={{ padding: 18, background: "var(--forest-light)", border: "1px solid #A7F3D0", borderRadius: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--forest-dark)", fontSize: 11.5, fontWeight: 800, textTransform: "uppercase" }}>
            <ShoppingBag size={16} /> TOTAL GLOBAL VENTES
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "var(--forest-dark)", marginTop: 6 }}>
            {fcfa(totalGlobal, boutique?.devise)}
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
              <th>STATUT</th>
              <th>MONTANT</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <SkeletonTableRows rows={6} cols={9} />
            )}
            {!loading && paginatedOrders.length === 0 && (
              <tr>
                <td colSpan={9} style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>
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

              const rest = Number(o.montantRestant !== undefined ? o.montantRestant : (o.statutPaiement === "paye" ? 0 : o.total));
              const recu = Number(o.montantRecu !== undefined ? o.montantRecu : (o.statutPaiement === "paye" ? o.total : 0));
              const isPaye = o.statutPaiement === "paye" || rest <= 0;
              const isPartiel = o.statutPaiement === "partiel" || (recu > 0 && rest > 0);

              const isOverdue = rest > 0 && o.dateEcheance && (() => {
                const ech = new Date(o.dateEcheance);
                ech.setHours(23, 59, 59, 999);
                return ech < new Date();
              })();

              return (
                <tr key={o.id}>
                  <td style={{ fontSize: 12.5, whiteSpace: "nowrap" }}>
                    <div style={{ fontWeight: 700, color: "var(--ink)" }}>{dateFormatted}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>#COM-B{String(o.id).padStart(3, "0")}</div>
                    {o.dateEcheance && rest > 0 && (
                      <div style={{ 
                        fontSize: 10.5, 
                        fontWeight: 700, 
                        color: isOverdue ? "#DC2626" : "#D97706",
                        display: "flex",
                        alignItems: "center",
                        gap: 3,
                        marginTop: 3
                      }}>
                        <Calendar size={11} /> Échéance : {new Date(o.dateEcheance).toLocaleDateString("fr-FR")}
                      </div>
                    )}
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
                  <td>
                    {isPaye ? (
                      <span style={{ background: "#DCFCE7", color: "#166534", padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 800, whiteSpace: "nowrap" }}>
                        Payé
                      </span>
                    ) : isPartiel ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        <span style={{ background: "#FEF3C7", color: "#B45309", padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 800, whiteSpace: "nowrap" }}>
                          Partiel (Reste {fcfa(rest, boutique?.devise)})
                        </span>
                        {o.dateEcheance && (
                          <span style={{ 
                            fontSize: 10.5, 
                            fontWeight: 700, 
                            color: isOverdue ? "#DC2626" : "#B45309",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 3
                          }}>
                            <Calendar size={10} /> Échéance : {new Date(o.dateEcheance).toLocaleDateString("fr-FR")}
                          </span>
                        )}
                        {isOverdue && (
                          <span style={{ background: "#FEE2E2", color: "#DC2626", padding: "2px 8px", borderRadius: 12, fontSize: 10, fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 3 }}>
                            <AlertTriangle size={10} /> Échéance dépassée
                          </span>
                        )}
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        <span style={{ background: "#FEE2E2", color: "#991B1B", padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 800, whiteSpace: "nowrap" }}>
                          Non payé / Crédit
                        </span>
                        {o.dateEcheance && (
                          <span style={{ 
                            fontSize: 10.5, 
                            fontWeight: 700, 
                            color: isOverdue ? "#DC2626" : "#B45309",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 3
                          }}>
                            <Calendar size={10} /> Échéance : {new Date(o.dateEcheance).toLocaleDateString("fr-FR")}
                          </span>
                        )}
                        {isOverdue && (
                          <span style={{ background: "#FEE2E2", color: "#DC2626", padding: "2px 8px", borderRadius: 12, fontSize: 10, fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 3 }}>
                            <AlertTriangle size={10} /> Échéance dépassée
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td style={{ fontWeight: 800, fontSize: 14, color: "var(--forest-dark)", whiteSpace: "nowrap" }}>
                    {fcfa(o.total, boutique?.devise)}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {/* 1. VOIR / IMPRIMER FACTURE */}
                      <button
                        className="bs-icon-btn"
                        title="Voir / Imprimer la Facture officielle (A4)"
                        onClick={() => setSelectedOrder(o)}
                        style={{ width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}
                      >
                        <Eye size={15} />
                      </button>

                      {/* 2. RÉALISER UN PAIEMENT / COMPLÉTER LE PAIEMENT (DÉSACTIVÉ SI DÉJÀ PAYÉ OU NON AUTORISÉ) */}
                      {hasPerm("encaisser_paiement") && (
                        <button
                          className="bs-icon-btn"
                          disabled={isPaye}
                          title={isPaye ? "Vente entièrement soldée (aucun versement restant)" : `Encaisser un versement (${fcfa(rest, boutique?.devise)} restant)`}
                          onClick={() => !isPaye && openPaymentModal(o)}
                          style={{
                            width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                            background: isPaye ? "#F1F5F9" : "#DCFCE7",
                            color: isPaye ? "#94A3B8" : "#15803D",
                            border: isPaye ? "1px solid #E2E8F0" : "1px solid #86EFAC",
                            cursor: isPaye ? "not-allowed" : "pointer",
                            opacity: isPaye ? 0.35 : 1,
                            pointerEvents: isPaye ? "none" : "auto"
                          }}
                        >
                          <DollarSign size={15} />
                        </button>
                      )}

                      {/* 3. RAPPEL WHATSAPP (SI CRÉANCE / RESTE > 0) */}
                      {rest > 0 && (
                        <button
                          className="bs-icon-btn"
                          title={`Envoyer un rappel de paiement WhatsApp à ${o.client?.nom || "ce client"}`}
                          onClick={() => handleSendWhatsAppReminder(o)}
                          style={{
                            width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                            background: "#DCFCE7", color: "#16A34A", border: "1px solid #86EFAC", cursor: "pointer"
                          }}
                        >
                          <MessageCircle size={15} />
                        </button>
                      )}

                      {/* 4. MODIFIER LA VENTE (RAMÈNE SUR LA CAISSE SI VENTE DIRECTE) */}
                      {hasPerm("modifier_vente") && (
                        <button
                          className="bs-icon-btn"
                          title={isPOS ? "Modifier cette vente sur la caisse (ajuster panier, articles, montants)" : "Commande en ligne (gérée dans Commandes)"}
                          onClick={() => handleEditSale(o)}
                          style={{
                            width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                            color: isPOS ? "var(--forest)" : "#94A3B8",
                            background: isPOS ? "#F0FDF4" : "#F8FAFC",
                            border: isPOS ? "1px solid #BBF7D0" : "1px solid #E2E8F0",
                            cursor: isPOS ? "pointer" : "not-allowed"
                          }}
                        >
                          <Edit2 size={15} />
                        </button>
                      )}

                      {/* 5. SUPPRIMER LA VENTE */}
                      {hasPerm("supprimer_vente") && (
                        <button
                          className="bs-icon-btn"
                          title="Supprimer cette vente (réintègre les articles en stock)"
                          onClick={() => handleDeleteSale(o)}
                          style={{
                            width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                            color: "#DC2626", background: "#FEF2F2", border: "1px solid #FECACA"
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
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

      {/* MODAL ENCAISSEMENT / RÈGLEMENT DU SOLDE */}
      {paymentModalOrder && (
        <div 
          onClick={() => setPaymentModalOrder(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(15, 23, 42, 0.7)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 16
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#FFFFFF", borderRadius: 16, maxWidth: 440, width: "100%",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)", overflow: "hidden"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", background: "var(--forest)", color: "#fff" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 800, fontSize: 15 }}>
                <DollarSign size={18} /> Réaliser un Paiement / Règlement
              </div>
              <button onClick={() => setPaymentModalOrder(null)} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer" }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleValiderVersement} style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
              {/* RÉCAP VENTE */}
              <div style={{ background: "#F8FAFC", borderRadius: 10, padding: 12, border: "1px solid var(--line)", fontSize: 13, display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--muted)" }}>N° Vente :</span>
                  <span style={{ fontWeight: 800 }}>#COM-B{String(paymentModalOrder.id).padStart(3, "0")}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--muted)" }}>Client :</span>
                  <span style={{ fontWeight: 700 }}>{paymentModalOrder.client?.nom || "Client comptoir"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--muted)" }}>Total Vente :</span>
                  <span style={{ fontWeight: 800, color: "var(--forest-dark)" }}>{fcfa(paymentModalOrder.total, boutique?.devise)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--muted)" }}>Déjà encaissé :</span>
                  <span style={{ fontWeight: 700, color: "#166534" }}>{fcfa(paymentModalOrder.montantRecu || 0, boutique?.devise)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px dashed var(--line)", paddingTop: 6, marginTop: 2 }}>
                  <span style={{ color: "#DC2626", fontWeight: 800 }}>Reste à payer actuel :</span>
                  <span style={{ fontWeight: 900, color: "#DC2626", fontSize: 15 }}>
                    {fcfa(paymentModalOrder.montantRestant !== undefined ? paymentModalOrder.montantRestant : Math.max(0, paymentModalOrder.total - (paymentModalOrder.montantRecu || 0)), boutique?.devise)}
                  </span>
                </div>
                {paymentModalOrder.dateEcheance && (
                  <div style={{ display: "flex", justifyContent: "space-between", color: "#DC2626", fontSize: 12 }}>
                    <span style={{ fontWeight: 600 }}>Date d'échéance :</span>
                    <span style={{ fontWeight: 800 }}>
                      {new Date(paymentModalOrder.dateEcheance).toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                )}
              </div>

              {/* MONTANT À VERSER */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 800, color: "var(--ink)", display: "block", marginBottom: 6, textTransform: "uppercase" }}>
                  Montant Versé Aujourd'hui ({boutique?.devise || "FCFA"}) * :
                </label>
                <input
                  type="number"
                  min="1"
                  className="bs-input"
                  style={{ height: 42, fontSize: 16, fontWeight: 800 }}
                  value={versementMontant}
                  onChange={(e) => setVersementMontant(e.target.value)}
                  placeholder="ex: 5000"
                  required
                />
              </div>

              {/* MOYEN DE PAIEMENT */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 800, color: "var(--ink)", display: "block", marginBottom: 6, textTransform: "uppercase" }}>
                  Mode de Versement :
                </label>
                <select
                  className="bs-select"
                  style={{ height: 40, fontSize: 13 }}
                  value={versementMoyen}
                  onChange={(e) => setVersementMoyen(e.target.value)}
                >
                  <option value="cash">Espèces / Cash</option>
                  <option value="mvola">MVola</option>
                  <option value="holam">Holam</option>
                  <option value="carte">Carte Bancaire</option>
                </select>
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  className="bs-btn-secondary"
                  onClick={() => setPaymentModalOrder(null)}
                  style={{ flex: 1, padding: "10px", borderRadius: 10 }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="bs-btn-primary"
                  disabled={versementLoading}
                  style={{ flex: 1.5, padding: "10px", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                >
                  {versementLoading ? "Validation..." : <><CheckCircle size={16} /> Valider le Versement</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL MODIFIER LA VENTE */}
      {editModalOrder && (
        <div 
          onClick={() => setEditModalOrder(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(15, 23, 42, 0.7)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 16
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#FFFFFF", borderRadius: 16, maxWidth: 460, width: "100%",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)", overflow: "hidden"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", background: "#0F172A", color: "#fff" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 800, fontSize: 15 }}>
                <Edit2 size={17} color="#F59E0B" /> Modifier la Vente #COM-B{String(editModalOrder.id).padStart(3, "0")}
              </div>
              <button onClick={() => setEditModalOrder(null)} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer" }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleValiderEdit} style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: 6 }}>
                  Mode de Paiement :
                </label>
                <select
                  className="bs-select"
                  style={{ height: 40 }}
                  value={editForm.moyenPaiement}
                  onChange={(e) => setEditForm(prev => ({ ...prev, moyenPaiement: e.target.value }))}
                >
                  <option value="cash">Espèces / Cash</option>
                  <option value="mvola">MVola</option>
                  <option value="holam">Holam / Wero</option>
                  <option value="carte">Carte Bancaire</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: 6 }}>
                  Adresse / Lieu de Livraison :
                </label>
                <input
                  type="text"
                  className="bs-input"
                  style={{ height: 40 }}
                  value={editForm.adresseLivraison}
                  onChange={(e) => setEditForm(prev => ({ ...prev, adresseLivraison: e.target.value }))}
                  placeholder="ex: Comptoir Moroni ou adresse client"
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: 6 }}>
                  Notes Administratives :
                </label>
                <textarea
                  className="bs-input"
                  rows="3"
                  style={{ height: "auto", padding: "8px 12px" }}
                  value={editForm.notesAdmin}
                  onChange={(e) => setEditForm(prev => ({ ...prev, notesAdmin: e.target.value }))}
                  placeholder="Notes internes, historique d'accord ou détails de paiement..."
                />
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  className="bs-btn-secondary"
                  onClick={() => setEditModalOrder(null)}
                  style={{ flex: 1, padding: "10px", borderRadius: 10 }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="bs-btn-primary"
                  disabled={editLoading}
                  style={{ flex: 1.5, padding: "10px", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                >
                  {editLoading ? "Enregistrement..." : <><CheckCircle size={16} /> Enregistrer Modifications</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VÉRITABLE FACTURE / DEVIS MODERNE FORMAT A4 & IMPRESSION PDF */}
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
