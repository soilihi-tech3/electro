import React, { createContext, useContext, useEffect, useState } from "react";
import api, { SLUG } from "../api";

const BoutiqueContext = createContext(null);

const DEFAULT_FALLBACK_BOUTIQUE = {
  id: 1,
  nom: "A2ELEC",
  slug: "electro-pro",
  logoUrl: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRwXCzHPxEU7yFGviVbPuXzSwtISwrgUsYltf6K2OdEbg&s=10",
  couleurPrincipale: "#1565C0",
  statut: "active",
  devise: "KMF",
  telephone: "+269 395 35 50",
  telephone2: "+33 777 80 07 24",
  adresse: "MORONI ,MBOUENI ",
  emailContact: "a2elec@gmail.com",
  fraisLivraison: 1500,
  zonesLivraison: "Moroni, Mitsamiouli, Foumbouni, Grand Comore, Régions",
  horairesOuverture: "Tous les jours de 08h30 à 23h00",
  modulesActifs: {
    commandes: true,
    rechargeCredit: true,
    homeBanners: true,
    sideBanners: true,
    vente: true,
    achats: true,
    commanderWhatsapp: true
  },
  modesPaiement: {
    carte: true,
    wave: true,
    orange: true,
    holam: true,
    especes: true
  }
};

export function BoutiqueProvider({ children }) {
  const [boutique, setBoutique] = useState(() => {
    try {
      const cached = localStorage.getItem("cached_boutique");
      if (cached) return JSON.parse(cached);
    } catch (e) {}
    return DEFAULT_FALLBACK_BOUTIQUE;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refreshBoutique = async () => {
    setError(null);
    const timestamp = Date.now();

    try {
      // 1. Appeler l'API de résolution automatique du sous-domaine / header
      const res = await api.get(`/boutique/current?t=${timestamp}`);
      if (res.data && res.data.nom) {
        setBoutique(res.data);
        try { localStorage.setItem("cached_boutique", JSON.stringify(res.data)); } catch (e) {}
        document.title = `${res.data.nom} | E-commerce & Vente Directe`;
        setLoading(false);
        return;
      }
    } catch (err) {}

    try {
      // 2. Fallback via le slug du store
      const effectiveSlug = SLUG || "electro-pro";
      const fallbackRes = await api.get(`/store/${effectiveSlug}?t=${timestamp}`);
      if (fallbackRes.data && fallbackRes.data.nom) {
        setBoutique(fallbackRes.data);
        try { localStorage.setItem("cached_boutique", JSON.stringify(fallbackRes.data)); } catch (e) {}
        document.title = `${fallbackRes.data.nom} | E-commerce & Vente Directe`;
        setLoading(false);
        return;
      }
    } catch (e) {}

    // 3. Si les requêtes réseau ont échoué, conserver la boutique courante ou le fallback garanti
    try {
      const cached = localStorage.getItem("cached_boutique");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.nom) {
          setBoutique(parsed);
          setLoading(false);
          return;
        }
      }
    } catch (e) {}

    // Si vraiment rien n'a été trouvé, appliquer la boutique par défaut pour ne JAMAIS bloquer l'utilisateur
    setBoutique(DEFAULT_FALLBACK_BOUTIQUE);
    setLoading(false);
  };

  useEffect(() => {
    refreshBoutique();
  }, []);

  return (
    <BoutiqueContext.Provider value={{ boutique, setBoutique, loading, error, refreshBoutique }}>
      {children}
    </BoutiqueContext.Provider>
  );
}

export const useBoutique = () => {
  const ctx = useContext(BoutiqueContext);
  if (!ctx) {
    throw new Error("useBoutique must be used within a BoutiqueProvider");
  }
  return ctx;
};
