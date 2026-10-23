import React, { createContext, useContext, useEffect, useState } from "react";
import api, { SLUG } from "../api";
import { clearSwrCache } from "../utils/swrCache.js";

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [boutique, setBoutique] = useState(() => {
    try {
      const cached = localStorage.getItem("cached_boutique");
      return cached ? JSON.parse(cached) : null;
    } catch (e) {
      return null;
    }
  });
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("app_theme") || "light";
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("app_theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === "dark" ? "light" : "dark"));
  };

  const sanitizeBoutique = (data) => {
    if (!data) return data;
    // modesPaiement
    if (typeof data.modesPaiement === "string") {
      try { data.modesPaiement = JSON.parse(data.modesPaiement); } catch (e) { data.modesPaiement = null; }
    }
    const sanitizedModes = { especes: true, mvola: true, holam: true, carte: false, wave: true, orange: true };
    if (data.modesPaiement && typeof data.modesPaiement === "object" && !data.modesPaiement["0"]) {
      if (typeof data.modesPaiement.especes === "boolean") sanitizedModes.especes = data.modesPaiement.especes;
      if (typeof data.modesPaiement.mvola === "boolean") sanitizedModes.mvola = data.modesPaiement.mvola;
      if (typeof data.modesPaiement.holam === "boolean") sanitizedModes.holam = data.modesPaiement.holam;
      if (typeof data.modesPaiement.carte === "boolean") sanitizedModes.carte = data.modesPaiement.carte;
      if (typeof data.modesPaiement.wave === "boolean") sanitizedModes.wave = data.modesPaiement.wave;
      if (typeof data.modesPaiement.orange === "boolean") sanitizedModes.orange = data.modesPaiement.orange;
    }
    data.modesPaiement = sanitizedModes;

    // modulesActifs
    if (typeof data.modulesActifs === "string") {
      try { data.modulesActifs = JSON.parse(data.modulesActifs); } catch (e) { data.modulesActifs = null; }
    }
    if (!data.modulesActifs || typeof data.modulesActifs !== "object" || data.modulesActifs["0"]) {
      data.modulesActifs = { vente: true, ventesHistorique: true, achats: true, fournisseurs: true, unites: true, homeBanners: true, sideBanners: true, commandes: true, categories: true, produits: true, employes: true, parametres: true, commanderWhatsapp: true };
    }

    // bannerSlides
    if (typeof data.bannerSlides === "string") {
      try { data.bannerSlides = JSON.parse(data.bannerSlides); } catch (e) { data.bannerSlides = []; }
    }
    if (!Array.isArray(data.bannerSlides)) data.bannerSlides = [];

    // sideBanners
    if (typeof data.sideBanners === "string") {
      try { data.sideBanners = JSON.parse(data.sideBanners); } catch (e) { data.sideBanners = []; }
    }
    if (!Array.isArray(data.sideBanners)) data.sideBanners = [];

    return data;
  };

  const refreshBoutique = () => {
    const timestamp = Date.now();
    api.get(`/admin/boutique?t=${timestamp}`)
      .then((res) => {
        if (res.data) {
          const b = sanitizeBoutique(res.data);
          setBoutique(b);
          try { localStorage.setItem("cached_boutique", JSON.stringify(b)); } catch (e) {}
        }
      })
      .catch(() => {
        api.get(`/store/${SLUG}?t=${timestamp}`).then((res) => {
          if (res.data) {
            const b = sanitizeBoutique(res.data);
            setBoutique(b);
            try { localStorage.setItem("cached_boutique", JSON.stringify(b)); } catch (e) {}
          }
        }).catch(() => {});
      });
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    refreshBoutique();
    if (!token) { 
      setLoading(false); 
      return; 
    }
    // Restauration instantanée de la session (affichage uniquement ; le serveur vérifie chaque requête)
    try {
      const cachedUser = JSON.parse(localStorage.getItem("cached_user") || "null");
      if (cachedUser) {
        setUser(cachedUser);
        setLoading(false);
      }
    } catch (e) {}
    api.get("/auth/me").then((res) => {
      setUser(res.data.user);
      try { localStorage.setItem("cached_user", JSON.stringify(res.data.user)); } catch (e) {}
    })
      .catch((err) => {
        // Jeton invalide/expiré → déconnexion. Erreur réseau → on garde la session en cache.
        if (err?.response && [401, 403].includes(err.response.status)) {
          localStorage.removeItem("token");
          localStorage.removeItem("cached_user");
          clearSwrCache();
          setUser(null);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(identifiant, motDePasse) {
    const res = await api.post("/auth/login", { identifiant, email: identifiant, telephone: identifiant, motDePasse });
    clearSwrCache();
    localStorage.setItem("token", res.data.token);
    try { localStorage.setItem("cached_user", JSON.stringify(res.data.user)); } catch (e) {}
    setUser(res.data.user);
    refreshBoutique();
    return res.data.user;
  }

  async function register(nom, email, telephone, motDePasse) {
    const res = await api.post("/auth/register", { nom, email, telephone, motDePasse });
    if (res.data.token) {
      localStorage.setItem("token", res.data.token);
      setUser(res.data.user);
      refreshBoutique();
    }
    return res.data;
  }

  async function verifyOtp(email, telephone, otpCode) {
    const res = await api.post("/auth/verify-otp", { email, telephone, otpCode });
    if (res.data.token) {
      localStorage.setItem("token", res.data.token);
      setUser(res.data.user);
      refreshBoutique();
    }
    return res.data;
  }

  async function resendOtp(email, telephone) {
    const res = await api.post("/auth/resend-otp", { email, telephone });
    return res.data;
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("cached_user");
    clearSwrCache();
    setUser(null);
  }

  function updateUser(updatedUserData) {
    setUser((prev) => (prev ? { ...prev, ...updatedUserData } : null));
  }

  return (
    <AuthContext.Provider value={{ user, boutique, refreshBoutique, loading, login, register, verifyOtp, resendOtp, logout, updateUser, theme, toggleTheme }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}


