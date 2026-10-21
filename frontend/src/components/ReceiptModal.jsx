import React from "react";
import { Printer, X, CheckCircle, Smartphone, CreditCard, ShoppingBag, Clock, Package, Truck } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";

import { formatPrice as fcfa } from "../utils/currency.js";

const STATUT_LABELS = {
  en_attente_paiement: "PAIEMENT EN ATTENTE",
  en_attente: "EN ATTENTE DE CONFIRMATION",
  validee: "COMMANDE CONFIRMÉE",
  en_preparation: "EN COURS DE PRÉPARATION",
  pret_retrait: "PRÊT À RÉCUPÉRER EN BOUTIQUE",
  en_livraison: "EN COURS DE LIVRAISON",
  recuperee: "RÉCUPÉRÉE / RÉGLÉE",
  livree: "LIVRÉE / RÉGLÉE",
  annulee: "COMMANDE ANNULÉE"
};

const MOYEN_LABELS = {
  cash: "CASH / ESPÈCES",
  especes: "CASH / ESPÈCES",
  mvola: "MVOLA MOBILE MONEY",
  wero: "WERO",
  holam: "WERO",
  carte: "CARTE BANCAIRE (VISA / MASTERCARD)",
  wave: "WAVE (UNITECHPAY)",
  orange: "ORANGE MONEY (UNITECHPAY)",
  unitechpay: "UNITECHPAY (MOBILE MONEY)",
  whatsapp: "COMMANDE WHATSAPP"
};

export default function ReceiptModal({ order, boutique, onClose }) {
  const { user } = useAuth();
  if (!order) return null;

  const storeName = boutique?.nom || "Marché Vert";
  const activeDevise = boutique?.devise || "EUR";

  // 1. DYNAMIC CLIENT NAME
  const clientName = order.client?.nom || order.nomClient || user?.nom || "Client connecté";
  const clientPhone = order.client?.telephone || order.telephoneClient || user?.telephone || "";

  // 2. DYNAMIC SALE TYPE
  const isRecharge = order.typeVente === "recharge_mobile" || order.notes?.includes("recharge_mobile") || order.items?.some(it => it.product?.nom?.toLowerCase().includes("recharge"));
  const isPOS = !isRecharge && (order.typeVente === "vente_directe" || order.adresseLivraison?.includes("Achat direct"));
  const isRetraitEnLigne = !isRecharge && !isPOS && order.modeLivraison === "retrait";

  const typeLabel = isRecharge 
    ? "Recharge Crédit Mobile" 
    : isPOS 
      ? "Vente Directe POS (Comptoir)" 
      : isRetraitEnLigne
        ? "Commande en Ligne (Retrait boutique)"
        : "Commande en Ligne (Livraison à domicile)";

  // 3. DYNAMIC STATUS & PAYMENT
  const statusLabel = STATUT_LABELS[order.statut] || (order.statut ? order.statut.toUpperCase() : "RÉGLÉ / CONFIRMÉ");
  const isPaidOrDelivered = ["livree", "recuperee", "validee", "pret_retrait", "en_livraison"].includes(order.statut);
  const statusColor = order.statut === "annulee" ? "#B4483A" : isPaidOrDelivered ? "#15803D" : "#CA8A04";
  
  const paymentLabel = MOYEN_LABELS[order.moyenPaiement] || (order.moyenPaiement ? order.moyenPaiement.toUpperCase() : "CARTE BANCAIRE");

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 99999,
        background: "rgba(15, 23, 42, 0.75)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16
      }}
    >
      <div
        className="bs-receipt-paper"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#FFFFFF", color: "#0F172A", borderRadius: 16, padding: 24,
          maxWidth: 420, width: "100%", boxShadow: "0 20px 30px rgba(0,0,0,0.4)",
          fontFamily: "Courier, monospace, sans-serif", border: "1px solid #CBD5E1",
          position: "relative"
        }}
      >
        {/* CLOSE BUTTON */}
        <button
          type="button"
          onClick={onClose}
          style={{
            position: "absolute", top: 12, right: 12, background: "#F1F5F9",
            border: "none", borderRadius: "50%", width: 30, height: 30,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", color: "#64748B"
          }}
        >
          <X size={16} />
        </button>

        {/* TICKET HEADER */}
        <div style={{ textAlign: "center", borderBottom: "1px dashed #64748B", paddingBottom: 12, marginBottom: 12 }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: "#0F172A", letterSpacing: 1 }}>{storeName.toUpperCase()}</div>
          <div style={{ fontSize: 11, color: "#475569", marginTop: 2, fontWeight: 600 }}>BOUTIQUE & SERVICE EN LIGNE</div>
          <div style={{ fontSize: 11, color: "#475569", marginTop: 4, fontWeight: 700 }}>
            REÇU OFFICIEL N° #COM-B{String(order.id).padStart(3, "0")}
          </div>
          <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>
            {new Date(order.createdAt).toLocaleString("fr-FR")}
          </div>
        </div>

        {/* DYNAMIC METADATA */}
        <div style={{ fontSize: 12, color: "#1E293B", marginBottom: 12, lineHeight: 1.6 }}>
          <div><strong style={{ color: "#0F172A" }}>Client:</strong> {clientName}</div>
          {clientPhone && clientPhone !== "non_renseigne" && (
            <div><strong style={{ color: "#0F172A" }}>Téléphone:</strong> {clientPhone}</div>
          )}
          <div><strong style={{ color: "#0F172A" }}>Type:</strong> {typeLabel}</div>
          <div><strong style={{ color: "#0F172A" }}>Statut:</strong> <span style={{ color: statusColor, fontWeight: 800 }}>{statusLabel}</span></div>
        </div>

        {/* ITEMS TABLE */}
        <div style={{ borderTop: "1px dashed #64748B", borderBottom: "1px dashed #64748B", padding: "10px 0", marginBottom: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "2.2fr 0.6fr 1fr 1fr", fontSize: 11, fontWeight: 800, color: "#0F172A", borderBottom: "1px solid #E2E8F0", paddingBottom: 4, marginBottom: 6 }}>
            <span>{isRecharge ? "N° DESTINATAIRE" : "ARTICLE"}</span>
            <span style={{ textAlign: "center" }}>QTÉ</span>
            <span style={{ textAlign: "right" }}>PRIX U.</span>
            <span style={{ textAlign: "right" }}>TOTAL</span>
          </div>

          {(order.items && order.items.length > 0 ? order.items : (isRecharge ? [{
            nom: order.notes ? order.notes.replace('Recharge Crédit Mobile ', '') : "Recharge Crédit",
            quantite: 1,
            prixUnitaire: order.total
          }] : [])).map((it, idx) => {
            const pu = Number(it.prixUnitaire || it.product?.prix || 0);
            const totLine = pu * (it.quantite || 1);

            let displayName = it.product?.nom || it.nom || "Article";
            if (isRecharge) {
               const phoneMatch = (order.notes || "").match(/\+?\d{7,15}/);
               const destPhone = phoneMatch ? phoneMatch[0] : (clientPhone && clientPhone !== "non_renseigne" ? clientPhone : "Inconnu");
               const matchKmf = (order.notes || "").match(/(\d[\d\s]*)\s*KMF/i);
               const creditKmf = matchKmf ? matchKmf[1].trim() + " KMF" : "";
               
               displayName = `N° ${destPhone}${creditKmf ? ` (${creditKmf})` : ""}`;
            }

            return (
              <div key={idx} style={{ display: "grid", gridTemplateColumns: "2.2fr 0.6fr 1fr 1fr", fontSize: 11.5, color: "#0F172A", marginBottom: 5, fontWeight: 600 }}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={displayName}>
                  {displayName}
                </span>
                <span style={{ textAlign: "center" }}>{it.quantite || 1}</span>
                <span style={{ textAlign: "right" }}>{fcfa(pu, activeDevise)}</span>
                <span style={{ textAlign: "right", fontWeight: 800 }}>{fcfa(totLine, activeDevise)}</span>
              </div>
            );
          })}
        </div>

        {/* TOTALS SUMMARY */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "#0F172A", marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#475569" }}>Sous-Total:</span>
            <span style={{ fontWeight: 700 }}>{fcfa(order.sousTotal || order.total, activeDevise)}</span>
          </div>
          {(order.fraisLivraison && order.fraisLivraison !== 0 && order.fraisLivraison !== "0") && (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#475569" }}>Frais de livraison:</span>
              <span style={{ fontWeight: 700 }}>{isNaN(Number(order.fraisLivraison)) ? order.fraisLivraison : fcfa(Number(order.fraisLivraison), activeDevise)}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 900, color: "#0F172A", borderTop: "1px dashed #64748B", paddingTop: 8, marginTop: 4 }}>
            <span>TOTAL RÉGLÉ:</span>
            <div style={{ textAlign: "right" }}>
              <div style={{ color: "#15803D" }}>{fcfa(order.total, activeDevise)}</div>
              {(order.moyenPaiement === "wave" || order.moyenPaiement === "orange") && (
                <div style={{ fontSize: 12, color: "#0284C7", fontWeight: 800, marginTop: 2 }}>
                  ≈ {Math.round(Number(order.total) * 655.957).toLocaleString("fr-FR")} FCFA
                </div>
              )}
              {isRecharge && (
                <div style={{ fontSize: 11, color: "#64748B", fontWeight: 700, marginTop: 2 }}>
                  {(() => {
                    const match = (order.notes || "").match(/(\d[\d\s]*)\s*KMF/i);
                    return match ? `Crédit destiné : ${match[1].trim()} KMF` : "";
                  })()}
                </div>
              )}
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#475569", marginTop: 4 }}>
            <span>Paiement:</span>
            <span style={{ fontWeight: 800, textTransform: "uppercase", color: "#0F172A" }}>{paymentLabel}</span>
          </div>
        </div>

        {/* FOOTER MESSAGE */}
        <div style={{ textAlign: "center", fontSize: 11, color: "#475569", borderTop: "1px dashed #64748B", paddingTop: 10, marginBottom: 16, fontWeight: 600 }}>
          Merci pour votre confiance !<br />
          À bientôt chez {storeName}.
        </div>

        {/* PRINT BUTTON */}
        <button
          type="button"
          onClick={handlePrint}
          style={{
            width: "100%", padding: "12px", borderRadius: 10, background: "#0F172A",
            color: "#FFFFFF", border: "none", fontWeight: 700, fontSize: 13,
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8
          }}
        >
          <Printer size={16} /> Imprimer le reçu / Sauvegarder PDF
        </button>
      </div>
    </div>
  );
}
