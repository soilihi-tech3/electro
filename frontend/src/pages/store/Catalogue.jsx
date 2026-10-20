import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Heart, Trash2 } from "lucide-react";
import api, { SLUG } from "../../api";
import ProductCard from "../../components/ProductCard.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { useCart } from "../../context/CartContext.jsx";
import { useData } from "../../context/DataContext.jsx";
import { subscribeRealtime } from "../../utils/realtime.js";
import { Skel } from "../../components/Skeleton.jsx";

export default function Catalogue() {
  const [params, setParams] = useSearchParams();
  const { user } = useAuth();
  const { showToast } = useCart();
  const { invalidate, getData, setData, isStale } = useData();

  const categoryId = params.get("categoryId") || "";
  const famille = params.get("famille") || "";
  const search = params.get("search") || "";
  const etat = params.get("etat") || "";
  const marqueId = params.get("marqueId") || "";
  const onlyFavoris = params.get("favoris") === "1";

  const cacheKey = `products:${SLUG}:${categoryId}:${famille}:${search}:${etat}:${marqueId}`;

  const [marques, setMarques] = useState([]);
  const [categories, setCategories] = useState(() => {
    const cached = getData(`categories:${SLUG}`);
    if (cached && Array.isArray(cached) && cached.length > 0) return cached;
    try {
      const ls = localStorage.getItem(`cached_categories_${SLUG}`);
      return ls ? JSON.parse(ls) : [];
    } catch (e) { return []; }
  });

  const [products, setProducts] = useState(() => {
    const cached = getData(cacheKey) || getData(`products:${SLUG}:::::`);
    if (cached && Array.isArray(cached) && cached.length > 0) return cached;
    try {
      const ls = localStorage.getItem(`cached_products_${SLUG}`);
      return ls ? JSON.parse(ls) : [];
    } catch (e) { return []; }
  });

  const [loading, setLoading] = useState(() => {
    const hasCat = categories && categories.length > 0;
    const hasProd = products && products.length > 0;
    return !hasCat && !hasProd;
  });

  const [favIds, setFavIds] = useState([]);

  // Scroll to top on filter change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [categoryId, famille, search, etat, marqueId, onlyFavoris]);

  useEffect(() => {
    api.get(`/store/${SLUG}/marques`).then((res) => setMarques(res.data || [])).catch(() => {});
  }, []);

  // User-scoped favorites sync
  useEffect(() => {
    function updateFavs() {
      const key = user && user.id ? `favorites_user_${user.id}` : "favorites_guest";
      const list = JSON.parse(localStorage.getItem(key) || "[]");
      setFavIds(list);
    }
    updateFavs();
    window.addEventListener("favorites_updated", updateFavs);
    return () => window.removeEventListener("favorites_updated", updateFavs);
  }, [user?.id]);

  function loadCategories(force = false) {
    const key = `categories:${SLUG}`;
    if (!force && !isStale(key)) {
      const cached = getData(key);
      if (cached && Array.isArray(cached) && cached.length > 0) {
        setCategories(cached);
        return;
      }
    }
    api.get(`/store/${SLUG}/categories`).then((res) => {
      setData(key, res.data, 300000);
      setCategories(res.data);
      try { localStorage.setItem(`cached_categories_${SLUG}`, JSON.stringify(res.data)); } catch(e) {}
    }).catch(() => {});
  }

  function loadProducts(force = false) {
    const ck = `products:${SLUG}:${categoryId}:${famille}:${search}:${etat}:${marqueId}`;
    if (!force && !isStale(ck)) {
      const cached = getData(ck);
      if (cached && Array.isArray(cached) && cached.length > 0) {
        setProducts(cached);
        setLoading(false);
        return;
      }
    }
    // Only show skeleton if we truly have nothing to show
    if (products.length === 0) {
      setLoading(true);
    }
    const query = {};
    if (categoryId) query.categoryId = categoryId;
    if (famille) query.famille = famille;
    if (search) query.search = search;
    if (etat) query.etat = etat;
    if (marqueId) query.marqueId = marqueId;
    api.get(`/store/${SLUG}/products`, { params: query })
      .then((res) => {
        setData(ck, res.data, 120000);
        setProducts(res.data);
        // Persist base catalogue to localStorage for instant load next time
        if (!categoryId && !famille && !search && !etat && !marqueId) {
          try { localStorage.setItem(`cached_products_${SLUG}`, JSON.stringify(res.data)); } catch(e) {}
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  useEffect(() => {
    loadCategories(false);
  }, []);

  useEffect(() => {
    loadProducts(false);
  }, [categoryId, famille, search, etat, marqueId]);

  useEffect(() => {
    const unsub = subscribeRealtime((detail) => {
      if (detail.type === "product_updated") {
        invalidate("products");
        loadProducts(true);
      } else if (detail.type === "category_updated") {
        invalidate("categories");
        loadCategories(true);
      }
    });
    return unsub;
  }, [categoryId, famille, search, etat, marqueId, invalidate]);

  const stripAccents = (str) =>
    (str || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

  let displayedProducts = products;
  if (onlyFavoris) {
    displayedProducts = displayedProducts.filter((p) => favIds.includes(p.id));
  }
  if (etat) {
    displayedProducts = displayedProducts.filter((p) => p.etat === etat);
  }
  if (marqueId) {
    displayedProducts = displayedProducts.filter((p) => String(p.marqueId) === String(marqueId));
  }
  if (famille) {
    const fClean = stripAccents(famille);
    displayedProducts = displayedProducts.filter((p) => {
      const pFam = stripAccents(p.Category?.famille || p.famille);
      const pCatNom = stripAccents(p.Category?.nom);
      const pNom = stripAccents(p.nom);
      return (
        pFam.includes(fClean) ||
        fClean.includes(pFam) ||
        pCatNom.includes(fClean) ||
        fClean.includes(pCatNom) ||
        pNom.includes(fClean)
      );
    });
  }

  function clearAllFavorites() {
    if (!window.confirm("Voulez-vous vraiment vider tous vos favoris ?")) return;
    const key = user && user.id ? `favorites_user_${user.id}` : "favorites_guest";
    localStorage.setItem(key, JSON.stringify([]));
    window.dispatchEvent(new Event("favorites_updated"));
    showToast("Tous vos favoris ont \u00e9t\u00e9 supprim\u00e9s.", "info", "Favoris");
  }

  // ── SKELETON CARD ──
  const SkeletonCard = ({ delay = 0 }) => (
    <div className="bs-skeleton-card" style={{ animationDelay: `${delay}ms` }}>
      <div className="bs-skeleton-img" />
      <div className="bs-skeleton-body">
        <div className="bs-skeleton-line bs-skeleton-title" />
        <div className="bs-skeleton-line bs-skeleton-sub" />
        <div className="bs-skeleton-line bs-skeleton-price" />
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "65vh" }}>
      {/* Categories strip */}
      <div className="bs-cats">
        <div
          className={"bs-cat-card" + (!categoryId && !famille && !onlyFavoris ? " on" : "")}
          onClick={() => setParams({})}
        >
          <div className="bs-cat-name" style={{ padding: "20px 0" }}>Tout afficher</div>
        </div>

        <div
          className={"bs-cat-card" + (onlyFavoris ? " on" : "")}
          onClick={() => setParams({ favoris: "1" })}
          style={{
            borderColor: onlyFavoris ? "#B4483A" : undefined,
            background: onlyFavoris ? "#FAD2CD" : undefined,
          }}
        >
          <div
            className="bs-cat-name"
            style={{
              padding: "16px 0",
              color: onlyFavoris ? "#B4483A" : "var(--ink)",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <Heart
              size={16}
              fill={onlyFavoris ? "#B4483A" : "none"}
              color={onlyFavoris ? "#B4483A" : "var(--ink)"}
            />{" "}
            Mes Favoris ({favIds.length})
          </div>
        </div>

        {categories.map((c) => (
          <div
            key={c.id}
            className={"bs-cat-card" + (categoryId == c.id && !onlyFavoris ? " on" : "")}
            onClick={() => setParams({ categoryId: c.id })}
          >
            <img
              src={
                c.imageUrl ||
                "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=300&q=80"
              }
              alt={c.nom}
              loading="lazy"
              decoding="async"
              className="bs-cat-img"
            />
            <div className="bs-cat-name">{c.nom}</div>
          </div>
        ))}
      </div>

      {/* ---- FILTRES ÉTAT (NEUF / OCCASION) & MARQUES ---- */}
      <div style={{
        margin: "18px 0 24px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        background: "var(--card)",
        padding: "16px 20px",
        borderRadius: 18,
        border: "1px solid var(--line)",
        boxShadow: "0 2px 10px rgba(0,0,0,0.03)"
      }}>
        {/* LIGNE 1 : SÉLECTION ÉTAT */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: "var(--forest-dark)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            État du matériel :
          </span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={() => {
                const next = new URLSearchParams(params);
                next.delete("etat");
                setParams(next);
              }}
              style={{
                padding: "7px 16px",
                borderRadius: 20,
                fontSize: 13,
                fontWeight: 700,
                border: !etat ? "2px solid var(--forest)" : "1px solid var(--line)",
                background: !etat ? "var(--forest)" : "var(--paper)",
                color: !etat ? "#fff" : "var(--ink)",
                cursor: "pointer",
                transition: "all 0.2s"
              }}
            >
              Tous les produits
            </button>

            <button
              onClick={() => {
                const next = new URLSearchParams(params);
                next.set("etat", "neuf");
                setParams(next);
              }}
              style={{
                padding: "7px 16px",
                borderRadius: 20,
                fontSize: 13,
                fontWeight: 700,
                border: etat === "neuf" ? "2px solid #0D9488" : "1px solid var(--line)",
                background: etat === "neuf" ? "#0D9488" : "var(--paper)",
                color: etat === "neuf" ? "#fff" : "var(--ink)",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                transition: "all 0.2s"
              }}
            >
              ✨ Matériel Neuf
            </button>

            <button
              onClick={() => {
                const next = new URLSearchParams(params);
                next.set("etat", "occasion");
                setParams(next);
              }}
              style={{
                padding: "7px 16px",
                borderRadius: 20,
                fontSize: 13,
                fontWeight: 700,
                border: etat === "occasion" ? "2px solid #D97706" : "1px solid var(--line)",
                background: etat === "occasion" ? "#D97706" : "var(--paper)",
                color: etat === "occasion" ? "#fff" : "var(--ink)",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                transition: "all 0.2s"
              }}
            >
              ♻️ Occasion (Reconditionné)
            </button>
          </div>
        </div>

        {/* LIGNE 2 : SÉLECTION MARQUES */}
        {marques.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", paddingTop: 10, borderTop: "1px dashed var(--line)" }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: "var(--forest-dark)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Marques :
            </span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <button
                onClick={() => {
                  const next = new URLSearchParams(params);
                  next.delete("marqueId");
                  setParams(next);
                }}
                style={{
                  padding: "5px 12px",
                  borderRadius: 14,
                  fontSize: 12.5,
                  fontWeight: 700,
                  border: !marqueId ? "1.5px solid var(--forest)" : "1px solid var(--line)",
                  background: !marqueId ? "var(--forest-light)" : "var(--paper)",
                  color: !marqueId ? "var(--forest-dark)" : "var(--muted)",
                  cursor: "pointer"
                }}
              >
                Toutes les marques
              </button>

              {marques.map(m => {
                const isSelected = String(marqueId) === String(m.id);
                return (
                  <button
                    key={m.id}
                    onClick={() => {
                      const next = new URLSearchParams(params);
                      if (isSelected) next.delete("marqueId");
                      else next.set("marqueId", m.id);
                      setParams(next);
                    }}
                    style={{
                      padding: "5px 12px",
                      borderRadius: 14,
                      fontSize: 12.5,
                      fontWeight: 700,
                      border: isSelected ? "1.5px solid var(--forest)" : "1px solid var(--line)",
                      background: isSelected ? "var(--forest-light)" : "var(--paper)",
                      color: isSelected ? "var(--forest-dark)" : "var(--ink)",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6
                    }}
                  >
                    {m.logoUrl && <img src={m.logoUrl} alt="" style={{ width: 14, height: 14, objectFit: "contain" }} />}
                    {m.nom}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Section header */}
      <div
        className="bs-section-title"
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
      >
        {loading ? (
          <Skel w={240} h={22} />
        ) : (
          <h2>
            {onlyFavoris
              ? `Mes produits favoris (${displayedProducts.length})`
              : famille
              ? `Produits de la section "${famille}" (${displayedProducts.length})`
              : `${displayedProducts.length} produit(s) trouv\u00e9(s)`}
          </h2>
        )}

        {onlyFavoris && displayedProducts.length > 0 && (
          <button
            onClick={clearAllFavorites}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "#FDF2F0",
              color: "#B4483A",
              border: "1px solid #F8D7D2",
              padding: "8px 16px",
              borderRadius: 20,
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
            title="Supprimer tous les favoris"
          >
            <Trash2 size={15} /> Supprimer tous les favoris
          </button>
        )}
      </div>

      {loading ? (
        /* ── PREMIUM SHIMMER SKELETON LOADER ── */
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 20,
            padding: "4px 0 20px",
          }}
        >
          {[0, 80, 160, 240, 320, 400, 480, 560].map((delay, i) => (
            <SkeletonCard key={i} delay={delay} />
          ))}
        </div>
      ) : (
        /* ── PRODUCTS GRID with fade-in ── */
        <div style={{ animation: "catalogueReveal 0.4s ease" }}>
          {onlyFavoris && displayedProducts.length === 0 && (
            <div
              style={{
                padding: 60,
                textAlign: "center",
                color: "var(--muted)",
                background: "#fff",
                borderRadius: 16,
              }}
            >
              <Heart size={44} color="#B4483A" style={{ marginBottom: 12, opacity: 0.8 }} />
              <h3 style={{ margin: "0 0 8px", color: "var(--forest-dark)" }}>
                Aucun produit dans vos favoris
              </h3>
              <p style={{ margin: 0, fontSize: 14 }}>
                Parcourez le catalogue et cliquez sur l&apos;ic\u00f4ne c\u0153ur d&apos;un produit pour
                l&apos;ajouter \u00e0 vos favoris personnels !
              </p>
            </div>
          )}

          {!onlyFavoris && displayedProducts.length === 0 && (
            <div
              style={{
                padding: 60,
                textAlign: "center",
                color: "var(--muted)",
                background: "#fff",
                borderRadius: 16,
              }}
            >
              Aucun produit ne correspond \u00e0 vos crit\u00e8res de recherche.
            </div>
          )}

          <div className="bs-grid">
            {displayedProducts.map((p) => (
              <ProductCard key={p.id} product={p} isFavorisPage={onlyFavoris} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
