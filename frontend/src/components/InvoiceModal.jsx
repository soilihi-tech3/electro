import React, { useState } from "react";
import { Printer, Download, X, CheckCircle, AlertTriangle, FileText, Phone, Mail, MapPin, Globe, User, Calendar, CreditCard, DollarSign } from "lucide-react";
import html2pdf from "html2pdf.js";
import { useAuth } from "../context/AuthContext.jsx";
import { formatPrice } from "../utils/currency.js";

export default function InvoiceModal({ order, boutique: propBoutique, onClose }) {
  const { boutique: authBoutique } = useAuth();
  const boutique = propBoutique || authBoutique;
  const [downloading, setDownloading] = useState(false);

  if (!order) return null;

  const storeName = boutique?.nom || order.boutique?.nom || "Boutique";
  const storePhone = boutique?.telephone || order.boutique?.telephone || "";
  const storeEmail = boutique?.email || order.boutique?.email || "";
  const storeAddress = boutique?.adresse || order.boutique?.adresse || "";
  const storeDevise = boutique?.devise || order.boutique?.devise || order.devise || "KMF";

  const isDevis = order.typeDocument === "devis" || order.typeVente === "devis";
  const docTitle = isDevis ? "DEVIS / FACTURE PROFORMA" : "FACTURE";
  const docNum = isDevis 
    ? `DEV-${String(order.id).padStart(4, "0")}`
    : `FAC-${String(order.id).padStart(4, "0")}`;

  const clientName = (order.client?.nom || order.nomClient || "Client Achat direct").replace(/comptoir/gi, "Achat direct");
  const clientPhone = order.client?.telephone || order.telephoneClient || "";
  const rawAddress = (order.adresseLivraison || "").replace(/ \/ comptoir/gi, "").replace(/comptoir/gi, "Achat direct");
  const clientAddress = rawAddress.trim() === "Achat direct" ? "Achat direct en boutique" : rawAddress;
  const caissierName = order.creeParNom || order.employeAssigne?.nom || "Responsable Caisse";

  const total = Number(order.total || order.sousTotal || 0);
  const montantRecu = Number(order.montantRecu !== undefined ? order.montantRecu : (order.statutPaiement === "paye" ? total : 0));
  const monnaieRendue = Number(order.monnaieRendue || 0);
  const montantRestant = Number(order.montantRestant !== undefined ? order.montantRestant : Math.max(0, total - montantRecu));
  const dateEcheance = order.dateEcheance ? new Date(order.dateEcheance).toLocaleDateString("fr-FR") : null;

  // Statut de paiement
  let statutPaiement = order.statutPaiement || (montantRestant > 0 ? (montantRecu > 0 ? "partiel" : "non_paye") : "paye");
  if (isDevis) statutPaiement = "devis";

  const dateDoc = new Date(order.createdAt || Date.now()).toLocaleDateString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
  });

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    const element = document.getElementById("invoice-printable-card");
    const wrapper = document.getElementById("invoice-scroll-wrapper");
    if (!element) return;
    
    // Remise à zéro impérative du défilement avant la capture
    if (wrapper) wrapper.scrollTop = 0;
    element.scrollTop = 0;

    setDownloading(true);
    const opt = {
      margin: [6, 6, 6, 6],
      filename: `${docNum}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { 
        scale: 2, 
        useCORS: true, 
        logging: false,
        scrollY: 0,
        scrollX: 0
      },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
    };

    try {
      await html2pdf().set(opt).from(element).save();
    } catch (err) {
      console.error("Erreur html2pdf:", err);
      window.print();
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="bs-invoice-modal-overlay"
      style={{
        position: "fixed", inset: 0, zIndex: 99999,
        background: "rgba(15, 23, 42, 0.75)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
        overflowY: "auto"
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#FFFFFF",
          borderRadius: 16,
          maxWidth: 860,
          width: "100%",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          display: "flex",
          flexDirection: "column",
          maxHeight: "92vh",
          overflow: "hidden"
        }}
      >
        {/* TOP CONTROLS (NON IMPRIMÉS) */}
        <div 
          className="bs-invoice-no-print"
          style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "12px 24px", background: "#0F172A", color: "#fff", borderBottom: "1px solid #1E293B"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <FileText size={18} color="#F59E0B" />
            <span style={{ fontWeight: 800, fontSize: 14 }}>
              Aperçu {isDevis ? "du Devis Proforma" : "de la Facture"}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* BOUTON TÉLÉCHARGER LE PDF DIRECTEMENT */}
            <button
              onClick={handleDownloadPDF}
              disabled={downloading}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                background: "#10B981", color: "#FFFFFF", border: "none",
                padding: "8px 16px", borderRadius: 8, fontWeight: 800, fontSize: 13,
                cursor: downloading ? "not-allowed" : "pointer", opacity: downloading ? 0.8 : 1,
                boxShadow: "0 2px 6px rgba(16, 185, 129, 0.3)"
              }}
              title="Télécharger le document sous format fichier PDF"
            >
              <Download size={16} /> {downloading ? "Génération PDF..." : "Télécharger PDF"}
            </button>

            {/* BOUTON IMPRIMER */}
            <button
              onClick={handlePrint}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                background: "#F59E0B", color: "#0F172A", border: "none",
                padding: "8px 16px", borderRadius: 8, fontWeight: 800, fontSize: 13,
                cursor: "pointer"
              }}
              title="Imprimer ou enregistrer via la boîte d'impression"
            >
              <Printer size={16} /> Imprimer
            </button>

            <button
              onClick={onClose}
              style={{
                background: "#334155", color: "#fff", border: "none",
                borderRadius: "50%", width: 32, height: 32, display: "flex",
                alignItems: "center", justifyContent: "center", cursor: "pointer"
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* CONTENEUR DE DÉFILEMENT POUR L'ÉCRAN (SÉPARÉ DE LA ZONE D'IMPRESSION) */}
        <div 
          id="invoice-scroll-wrapper"
          style={{
            overflowY: "auto",
            flex: 1,
            background: "#F1F5F9",
            padding: "24px 16px",
            display: "flex",
            justifyContent: "center"
          }}
        >
          {/* CARTE FACTURE IMPRIMABLE & EXPORTABLE PDF (INTÉGRALE, SANS OVERFLOW) */}
          <div 
            id="invoice-printable-card"
            className="bs-invoice-print-area"
            style={{
              width: "100%",
              maxWidth: 800,
              padding: "40px 44px",
              background: "#FFFFFF",
              color: "#0F172A",
              borderRadius: 12,
              boxShadow: "0 4px 15px rgba(0,0,0,0.06)",
              fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif"
            }}
          >
          {/* HEADER AVEC BANDE GÉOMÉTRIQUE MODERNE (STYLE MAQUETTE) */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #E2E8F0", paddingBottom: 24, marginBottom: 24 }}>
            {/* LOGO & NOM BOUTIQUE */}
            <div>
              <div style={{ fontSize: 28, fontWeight: 900, color: "#0F172A", letterSpacing: -0.5, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: "#F59E0B" }}>●</span> {storeName}
              </div>
              <div style={{ fontSize: 12, color: "#64748B", marginTop: 4, maxWidth: 300 }}>
                Votre partenaire de confiance en équipement, matériel et services.
              </div>
            </div>

            {/* COORDONNÉES DE LA BOUTIQUE */}
            <div style={{ textAlign: "right", fontSize: 12, color: "#334155", lineHeight: 1.6 }}>
              {storePhone && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
                  <span>{storePhone}</span>
                  <Phone size={13} color="#F59E0B" />
                </div>
              )}
              {storeEmail && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
                  <span>{storeEmail}</span>
                  <Mail size={13} color="#F59E0B" />
                </div>
              )}
              {storeAddress && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
                  <span>{storeAddress}</span>
                  <MapPin size={13} color="#F59E0B" />
                </div>
              )}
            </div>
          </div>

          {/* TITRE AU MILIEU (CENTRÉ ET NET) */}
          <div style={{ textAlign: "center", margin: "10px 0 24px" }}>
            <div style={{
              display: "inline-block",
              fontSize: 24,
              fontWeight: 900,
              letterSpacing: 2,
              textTransform: "uppercase",
              padding: "6px 32px",
              background: isDevis ? "#FEF3C7" : "#F1F5F9",
              color: isDevis ? "#B45309" : "#0F172A",
              border: isDevis ? "2px solid #FCD34D" : "2px solid #CBD5E1",
              borderRadius: 30
            }}>
              {isDevis ? "DEVIS PROFORMA" : "FACTURE OFFICIELLE"}
            </div>
          </div>

          {/* MÉTADONNÉES CLIENT À GAUCHE & INFOS DOCUMENT TOTALEMENT À DROITE */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "stretch", marginBottom: 26, gap: 20 }}>
            {/* FACTURÉ À (À GAUCHE) */}
            <div style={{ flex: 1, minWidth: 240, background: "#F8FAFC", padding: "14px 18px", borderRadius: 10, border: "1px solid #E2E8F0" }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
                Facturé à (Client) :
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#0F172A" }}>
                {clientName}
              </div>
              {clientPhone && clientPhone !== "non_renseigne" && (
                <div style={{ fontSize: 12.5, color: "#475569", marginTop: 2 }}>
                  Tél : {clientPhone}
                </div>
              )}
              {clientAddress && (
                <div style={{ fontSize: 12.5, color: "#475569", marginTop: 2 }}>
                  {clientAddress}
                </div>
              )}
            </div>

            {/* DÉTAILS DOCUMENT (TOTALEMENT À DROITE) */}
            <div style={{ minWidth: 260, textAlign: "right", background: "#F8FAFC", padding: "14px 18px", borderRadius: 10, border: "1px solid #E2E8F0", display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div style={{ display: "grid", gridTemplateColumns: "auto auto", gap: "5px 14px", justifyContent: "end", fontSize: 12.5 }}>
                <span style={{ color: "#64748B", fontWeight: 700 }}>{isDevis ? "N° Devis :" : "N° Facture :"}</span>
                <span style={{ fontWeight: 900, color: "#DC2626", fontSize: 13.5, letterSpacing: 0.5 }}>#{docNum}</span>

                <span style={{ color: "#64748B", fontWeight: 600 }}>Date d'émission :</span>
                <span style={{ fontWeight: 700, color: "#0F172A" }}>{dateDoc}</span>

                <span style={{ color: "#64748B", fontWeight: 600 }}>Vendeur / Caissier :</span>
                <span style={{ fontWeight: 700, color: "#0F172A" }}>{caissierName}</span>

                {dateEcheance && statutPaiement !== "paye" && (
                  <>
                    <span style={{ color: "#DC2626", fontWeight: 700 }}>Date d'échéance :</span>
                    <span style={{ fontWeight: 800, color: "#DC2626" }}>{dateEcheance}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* TABLEAU DES PRODUITS (STYLE GRAPHIQUE ÉLÉGANT) */}
          <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid #E2E8F0", marginBottom: 24 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#0F172A", color: "#FFFFFF" }}>
                  <th style={{ padding: "12px 16px", fontWeight: 800, letterSpacing: 0.5, fontSize: 11.5, textTransform: "uppercase" }}>
                    Désignation du Produit
                  </th>
                  <th style={{ padding: "12px 16px", fontWeight: 800, letterSpacing: 0.5, fontSize: 11.5, textTransform: "uppercase", textAlign: "right" }}>
                    Prix Unitaire
                  </th>
                  <th style={{ padding: "12px 16px", fontWeight: 800, letterSpacing: 0.5, fontSize: 11.5, textTransform: "uppercase", textAlign: "center" }}>
                    Qté
                  </th>
                  <th style={{ padding: "12px 16px", fontWeight: 800, letterSpacing: 0.5, fontSize: 11.5, textTransform: "uppercase", textAlign: "right", background: "#D97706" }}>
                    Total ({storeDevise})
                  </th>
                </tr>
              </thead>
              <tbody>
                {order.items && order.items.length > 0 ? (
                  order.items.map((it, idx) => {
                    const pName = it.product?.nom || it.nomProduit || "Article";
                    const pu = Number(it.prixUnitaire || it.product?.prix || 0);
                    const qte = Number(it.quantite || 1);
                    const totLine = pu * qte;
                    
                    // Extraire le libellé de variante si disponible
                    let variantInfo = it.variantLabel || "";
                    if (!variantInfo && it.selectedColor?.nom) {
                      variantInfo = `Couleur: ${it.selectedColor.nom}`;
                    }
                    if (!variantInfo && it.selectedOption?.nom) {
                      variantInfo = `${it.selectedOption.titre || "Option"}: ${it.selectedOption.nom}`;
                    }
                    if (!variantInfo && order.notes && typeof order.notes === "string") {
                      // Tentative de récupération depuis les notes
                      const lines = order.notes.split("|").map(s => s.trim());
                      const matchingLine = lines.find(l => l.toLowerCase().includes(pName.toLowerCase()) && l.includes("("));
                      if (matchingLine) {
                        const m = matchingLine.match(/\(([^)]+)\)/);
                        if (m && m[1]) variantInfo = m[1];
                      }
                    }

                    return (
                      <tr 
                        key={idx} 
                        style={{ 
                          borderBottom: "1px solid #F1F5F9", 
                          background: idx % 2 === 0 ? "#FFFFFF" : "#F8FAFC" 
                        }}
                      >
                        <td style={{ padding: "12px 16px", fontWeight: 700, color: "#1E293B" }}>
                          <div>{pName}</div>
                          {variantInfo && (
                            <div style={{ display: "inline-block", fontSize: 11.5, color: "#0F766E", background: "#F0FDFA", border: "1px solid #99F6E4", padding: "1px 8px", borderRadius: 6, marginTop: 3, fontWeight: 700 }}>
                              {variantInfo}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 600, color: "#334155" }}>
                          {formatPrice(pu, storeDevise)}
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: "center", fontWeight: 700, color: "#0F172A" }}>
                          {qte}
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 800, color: "#0F172A" }}>
                          {formatPrice(totLine, storeDevise)}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={4} style={{ padding: 24, textAlign: "center", color: "#64748B" }}>
                      Aucun article répertorié.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* RÉCAPITULATIF FINANCIER & MOYEN DE PAIEMENT */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 20, marginBottom: 28 }}>
            {/* BLOC GAUCHE : STATUT ET MODE DE RÈGLEMENT */}
            <div style={{ flex: 1, minWidth: 260 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", marginBottom: 6 }}>
                Mode de Règlement :
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", textTransform: "capitalize" }}>
                {order.moyenPaiement === "cash" || order.moyenPaiement === "especes" 
                  ? "Espèces / Cash" 
                  : order.moyenPaiement === "mvola" 
                    ? "Mvola (Mobile Money)"
                    : order.moyenPaiement === "devis"
                      ? "Devis Proforma (En attente)"
                      : (order.moyenPaiement || "Non spécifié")}
              </div>

              {/* TAMPON / BADGE DE STATUT OFFICIEL */}
              <div style={{ marginTop: 14 }}>
                {isDevis ? (
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, background: "#FEF3C7", color: "#B45309", border: "1px solid #FDE68A", fontWeight: 800, fontSize: 12 }}>
                    <FileText size={16} /> DEVIS PROFORMA (NON ENCAISSÉ)
                  </div>
                ) : statutPaiement === "paye" ? (
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, background: "#DCFCE7", color: "#166534", border: "1px solid #86EFAC", fontWeight: 800, fontSize: 12 }}>
                    <CheckCircle size={16} /> FACTURE PAYÉE INTÉGRALEMENT
                  </div>
                ) : statutPaiement === "partiel" ? (
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, background: "#FFFBEB", color: "#B45309", border: "1px solid #FCD34D", fontWeight: 800, fontSize: 12 }}>
                    <AlertTriangle size={16} /> PAIEMENT PARTIEL (ACOMPTE REÇU)
                  </div>
                ) : (
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, background: "#FEF2F2", color: "#991B1B", border: "1px solid #FCA5A5", fontWeight: 800, fontSize: 12 }}>
                    <AlertTriangle size={16} /> EN ATTENTE DE PAIEMENT / À CRÉDIT
                  </div>
                )}
              </div>
            </div>

            {/* BLOC DROIT : CALCULS DÉTAILLÉS */}
            <div style={{ width: 320, background: "#F8FAFC", borderRadius: 12, padding: 18, border: "1px solid #E2E8F0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#475569", marginBottom: 6 }}>
                <span>Sous-total HT :</span>
                <span style={{ fontWeight: 700, color: "#0F172A" }}>{formatPrice(total, storeDevise)}</span>
              </div>

              {Number(order.fraisLivraison) > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#475569", marginBottom: 6 }}>
                  <span>Frais de livraison :</span>
                  <span style={{ fontWeight: 700, color: "#0F172A" }}>{formatPrice(order.fraisLivraison, storeDevise)}</span>
                </div>
              )}

              {/* GRAND TOTAL BANNER */}
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                background: "#0F172A", color: "#FFFFFF", padding: "10px 14px",
                borderRadius: 8, marginTop: 8, marginBottom: 12
              }}>
                <span style={{ fontWeight: 800, fontSize: 13.5, textTransform: "uppercase" }}>Total TTC :</span>
                <span style={{ fontWeight: 900, fontSize: 18, color: "#F59E0B" }}>
                  {formatPrice(total, storeDevise)}
                </span>
              </div>

              {/* MONTANT VERSÉ & MONNAIE OU RESTE */}
              {!isDevis && (
                <div style={{ borderTop: "1px dashed #CBD5E1", paddingTop: 10, display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", color: "#334155" }}>
                    <span>Montant Reçu / Versé :</span>
                    <span style={{ fontWeight: 800, color: "#0F172A" }}>{formatPrice(montantRecu, storeDevise)}</span>
                  </div>

                  {monnaieRendue > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", color: "#166534", fontWeight: 700, background: "#DCFCE7", padding: "4px 8px", borderRadius: 6 }}>
                      <span>Monnaie Rendue :</span>
                      <span>{formatPrice(monnaieRendue, storeDevise)}</span>
                    </div>
                  )}

                  {montantRestant > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", color: "#991B1B", fontWeight: 800, background: "#FEE2E2", padding: "6px 8px", borderRadius: 6 }}>
                      <span>Reste à Payer (Crédit) :</span>
                      <span>{formatPrice(montantRestant, storeDevise)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* BAS DE PAGE & SIGNATURE (STYLE MAQUETTE) */}
          <div style={{ borderTop: "2px solid #E2E8F0", paddingTop: 20, marginTop: 30, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div style={{ maxWidth: 420 }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: "#0F172A", textTransform: "uppercase", letterSpacing: 0.5 }}>
                Merci de votre fidélité !
              </div>
              <div style={{ fontSize: 11, color: "#64748B", marginTop: 4, lineHeight: 1.5 }}>
                {isDevis 
                  ? "Ce devis proforma est valable 15 jours à compter de sa date d'émission. Ne constitue pas une preuve de paiement."
                  : "Les marchandises vendues ne sont ni reprises ni échangées après validation sans accord préalable de la direction."}
              </div>
            </div>

            {/* CADRE SIGNATURE ET CACHET */}
            <div style={{ textAlign: "center", minWidth: 200 }}>
              <div style={{ height: 45 }}></div>
              <div style={{ borderTop: "1px solid #94A3B8", paddingTop: 6, fontSize: 12, fontWeight: 700, color: "#334155" }}>
                Signature & Cachet
              </div>
              <div style={{ fontSize: 11, color: "#64748B" }}>{caissierName}</div>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
