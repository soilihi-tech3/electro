import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, ArrowRight, Smartphone } from "lucide-react";
import api, { SLUG } from "../../api";
import ProductCard from "../../components/ProductCard.jsx";
import { subscribeRealtime } from "../../utils/realtime.js";
import { useData } from "../../context/DataContext.jsx";
import { DEFAULT_SLIDES } from "../../utils/defaultBannerSlides.js";

const parseSlides = (bannerSlides) => {
  if (!bannerSlides) return DEFAULT_SLIDES;
  let parsed = bannerSlides;
  if (typeof bannerSlides === "string") {
    try {
      parsed = JSON.parse(bannerSlides);
    } catch (e) {
      return DEFAULT_SLIDES;
    }
  }
  if (Array.isArray(parsed) && parsed.length > 0) {
    // Purge old grocery/cosmetics or default seed Unsplash URLs so home-banner.html default slides appear unless customized
    const isOldDemo = parsed.some(s => 
      s.title?.toLowerCase().includes("cosmétique") || 
      s.title?.toLowerCase().includes("beauté") || 
      s.title?.toLowerCase().includes("légume") ||
      s.imageUrl?.includes("photo-1542838132") ||
      s.imageUrl?.includes("photo-1581092160607") ||
      s.imageUrl?.includes("photo-1621905252507") ||
      s.imageUrl?.includes("photo-1504917599217")
    );
    if (isOldDemo) {
      return DEFAULT_SLIDES;
    }
    return parsed;
  }
  return DEFAULT_SLIDES;
};

function renderSlideTitle(slide) {
  const rawTitle = (slide?.title || "").trim();
  if (slide?.titleHighlight) {
    return (
      <>
        {rawTitle}
        <br />
        <span>{slide.titleHighlight}</span>
      </>
    );
  }
  if (!rawTitle) return null;
  if (rawTitle.includes("\n") || rawTitle.includes("|")) {
    const parts = rawTitle.split(/\n|\|/).map(s => s.trim()).filter(Boolean);
    if (parts.length >= 2) {
      return (
        <>
          {parts[0]}
          <br />
          <span>{parts.slice(1).join(" ")}</span>
        </>
      );
    }
  }
  const dotIdx = rawTitle.indexOf(". ");
  if (dotIdx !== -1 && dotIdx < rawTitle.length - 2) {
    return (
      <>
        {rawTitle.slice(0, dotIdx + 1)}
        <br />
        <span>{rawTitle.slice(dotIdx + 2)}</span>
      </>
    );
  }
  const words = rawTitle.split(/\s+/);
  if (words.length >= 3) {
    const splitAt = Math.ceil(words.length / 2);
    return (
      <>
        {words.slice(0, splitAt).join(" ")}
        <br />
        <span>{words.slice(splitAt).join(" ")}</span>
      </>
    );
  }
  return rawTitle;
}

const parseBanners = (banners) => {
  if (!banners) return [];
  let parsed = banners;
  if (typeof banners === "string") {
    try {
      parsed = JSON.parse(banners);
    } catch (e) {
      return [];
    }
  }
  return Array.isArray(parsed) ? parsed : [];
};

function CategoryScrollSection({ category, products, onNavigate }) {
  const scrollRef = useRef(null);

  const scroll = (direction) => {
    if (scrollRef.current) {
      const scrollAmount = direction === "left" ? -320 : 320;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  return (
    <div style={{ marginTop: 40, marginBottom: 40 }}>
      {/* SECTION HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 18 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: "var(--ink)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            {category.nom}
          </h2>
          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 13 }}>
            Ne manquez pas les sélections de la catégorie {category.nom}.
          </p>
        </div>

        <button
          onClick={() => onNavigate(`/catalogue?categoryId=${category.id}`)}
          style={{
            background: "none", border: "1px solid var(--line)", borderRadius: 20,
            padding: "8px 18px", fontSize: 13, fontWeight: 700, color: "var(--forest-dark)",
            cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
            transition: "all 0.15s", whiteSpace: "nowrap"
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--forest-light)"; e.currentTarget.style.borderColor = "var(--forest)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "none"; e.currentTarget.style.borderColor = "var(--line)"; }}
        >
          Voir tout <ArrowRight size={15} />
        </button>
      </div>

      {/* SCROLL CONTAINER WITH ARROW CONTROLS */}
      <div style={{ position: "relative" }}>
        <button
          className="bs-scroll-arrow left"
          onClick={() => scroll("left")}
          style={{
            position: "absolute", left: 4, top: "50%", transform: "translateY(-50%)", zIndex: 10,
            width: 36, height: 36, borderRadius: "50%", background: "#fff", border: "1px solid var(--line)",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center"
          }}
        >
          <ChevronLeft size={20} color="var(--forest-dark)" />
        </button>

        <div
          ref={scrollRef}
          style={{
            display: "flex", gap: 16, overflowX: "auto", scrollbarWidth: "none",
            msOverflowStyle: "none", padding: "8px 4px 16px 4px", scrollBehavior: "smooth"
          }}
        >
          {products.map((p) => (
            <div key={p.id} style={{ minWidth: 220, maxWidth: 220, flexShrink: 0 }}>
              <ProductCard product={p} />
            </div>
          ))}
        </div>

        <button
          className="bs-scroll-arrow right"
          onClick={() => scroll("right")}
          style={{
            position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)", zIndex: 10,
            width: 36, height: 36, borderRadius: "50%", background: "#fff", border: "1px solid var(--line)",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center"
          }}
        >
          <ChevronRight size={20} color="var(--forest-dark)" />
        </button>
      </div>
    </div>
  );
}

export default function Home() {
  const { getData, setData, isStale, invalidate } = useData();

  const [categories, setCategories] = useState(() => {
    const cached = getData(`categories:${SLUG}`);
    if (cached && Array.isArray(cached) && cached.length > 0) return cached;
    try {
      const ls = localStorage.getItem(`cached_categories_${SLUG}`);
      return ls ? JSON.parse(ls) : [];
    } catch (e) { return []; }
  });

  const [familles, setFamilles] = useState(() => {
    const cached = getData(`familles:${SLUG}`);
    if (cached && Array.isArray(cached) && cached.length > 0) return cached;
    try {
      const ls = localStorage.getItem(`cached_familles_${SLUG}`);
      return ls ? JSON.parse(ls) : [];
    } catch (e) { return []; }
  });

  const [products, setProducts] = useState(() => {
    const cached = getData(`products:${SLUG}:::`);
    if (cached && Array.isArray(cached) && cached.length > 0) return cached;
    try {
      const ls = localStorage.getItem(`cached_products_${SLUG}`);
      return ls ? JSON.parse(ls) : [];
    } catch (e) { return []; }
  });

  const [boutique, setBoutique] = useState(() => {
    try {
      const cached = localStorage.getItem(`cached_boutique_${SLUG}`);
      return cached ? JSON.parse(cached) : null;
    } catch (e) {
      return null;
    }
  });

  const [activeSlide, setActiveSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const navigate = useNavigate();

  function loadData(force = false) {
    api.get(`/store/${SLUG}`).then((res) => {
      if (res.data) {
        setBoutique(res.data);
        try {
          localStorage.setItem(`cached_boutique_${SLUG}`, JSON.stringify(res.data));
        } catch (e) {}
      }
    }).catch(() => {});

    if (!force && !isStale(`categories:${SLUG}`) && categories.length > 0 && products.length > 0) {
      // Data is fresh in cache, no un-necessary refetch!
      return;
    }

    api.get(`/store/${SLUG}/categories`).then((res) => {
      if (Array.isArray(res.data)) {
        setData(`categories:${SLUG}`, res.data, 300000);
        setCategories(res.data);
        try { localStorage.setItem(`cached_categories_${SLUG}`, JSON.stringify(res.data)); } catch (e) {}
      }
    }).catch(() => {});

    api.get(`/store/${SLUG}/familles`).then((res) => {
      if (Array.isArray(res.data)) {
        setData(`familles:${SLUG}`, res.data, 600000);
        setFamilles(res.data);
        try { localStorage.setItem(`cached_familles_${SLUG}`, JSON.stringify(res.data)); } catch (e) {}
      }
    }).catch(() => {});

    api.get(`/store/${SLUG}/products`).then((res) => {
      if (Array.isArray(res.data)) {
        setData(`products:${SLUG}:::`, res.data, 120000);
        setProducts(res.data);
        try { localStorage.setItem(`cached_products_${SLUG}`, JSON.stringify(res.data)); } catch (e) {}
      }
    }).catch(() => {});
  }

  useEffect(() => {
    loadData(false);
    const unsub = subscribeRealtime((detail) => {
      if (
        detail.type === "product_updated" ||
        detail.type === "category_updated" ||
        detail.type === "boutique_updated" ||
        detail.type === "sync_completed"
      ) {
        invalidate("products");
        invalidate("categories");
        loadData(true);
      }
    });
    return unsub;
  }, []);

  const slides = parseSlides(boutique?.bannerSlides);
  const sideBanners = parseBanners(boutique?.sideBanners);

  useEffect(() => {
    if (activeSlide >= slides.length && slides.length > 0) {
      setActiveSlide(0);
    }
  }, [slides.length, activeSlide]);

  useEffect(() => {
    const total = slides.length;
    if (total <= 1 || isPaused) return;
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % total);
    }, 5000);
    return () => clearInterval(timer);
  }, [slides.length, isPaused, activeSlide]);

  const safeProducts = Array.isArray(products) ? products : [];
  const safeCategories = Array.isArray(categories) ? categories : [];
  const safeFamilles = Array.isArray(familles) && familles.length > 0
    ? familles
    : [
        { id: 1, nom: "Alimentation" },
        { id: 2, nom: "Cosmétique" },
        { id: 3, nom: "Maison & Entretien" }
      ];

  // Helper to normalize family names (removes duplicate "Section " prefixes & fixes casing)
  function getNormalizedFamilleName(str) {
    if (!str) return "";
    let s = String(str).trim();
    if (s.toLowerCase().startsWith("section ")) {
      s = s.slice(8).trim();
    } else if (s.toLowerCase() === "section") {
      s = "";
    }
    if (!s) return "";
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  // Deduplicate active family names strictly
  const familleMap = new Map();
  safeFamilles.forEach(f => {
    const norm = getNormalizedFamilleName(f.nom);
    if (norm && !familleMap.has(norm.toLowerCase())) {
      familleMap.set(norm.toLowerCase(), norm);
    }
  });

  safeProducts.forEach(p => {
    const raw = p.Category?.famille || p.famille;
    const norm = getNormalizedFamilleName(raw);
    if (norm && !familleMap.has(norm.toLowerCase())) {
      familleMap.set(norm.toLowerCase(), norm);
    }
  });

  const uniqueFamilles = Array.from(familleMap.values());
  const promos = safeProducts.filter((p) => p && (p.enPromo || p.prixPromo));

  function handleBannerClick(banner) {
    if (banner.categoryId) {
      navigate(`/catalogue?categoryId=${banner.categoryId}`);
    } else if (banner.linkUrl) {
      navigate(banner.linkUrl);
    } else {
      navigate("/catalogue");
    }
  }

  return (
    <>
      {/* ---- HERO BANNER DYNAMIQUE (DESIGN HOME-BANNER.HTML) ---- */}
      <section
        className="hb-hero"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {slides.map((slide, idx) => {
          const isActive = idx === activeSlide;
          const matchedCategory = slide.categoryId
            ? safeCategories.find((c) => String(c.id) === String(slide.categoryId))
            : null;
          const tagLabel =
            slide.tag ||
            slide.badge ||
            matchedCategory?.nom ||
            boutique?.nom ||
            "Matériel électrique pro";

          return (
            <article
              key={slide.id || idx}
              className={`hb-slide ${isActive ? "active" : ""}`}
            >
              <div className="hb-text">
                <span className="hb-tag">
                  <b></b>
                  {tagLabel}
                </span>
                <h1>{renderSlideTitle(slide)}</h1>
                {slide.subtitle && <p>{slide.subtitle}</p>}
                <button
                  type="button"
                  className="hb-btn"
                  onClick={() => handleBannerClick(slide)}
                >
                  {slide.buttonText || "Voir le catalogue"}{" "}
                  <svg
                    viewBox="0 0 24 24"
                    width="20"
                    height="20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </button>
              </div>
              <div
                className="hb-photo"
                style={{ background: slide.photoBg || "#ffffff", cursor: "pointer" }}
                onClick={() => handleBannerClick(slide)}
              >
                <img
                  src={slide.imageUrl}
                  alt={slide.title || tagLabel}
                  style={{
                    "--r": slide.aspectRatio || "735/490",
                    "--f": slide.feather || "7%"
                  }}
                  onLoad={(e) => {
                    if (!slide.aspectRatio && e.currentTarget.naturalWidth && e.currentTarget.naturalHeight) {
                      e.currentTarget.style.setProperty(
                        "--r",
                        `${e.currentTarget.naturalWidth}/${e.currentTarget.naturalHeight}`
                      );
                    }
                  }}
                />
              </div>
            </article>
          );
        })}

        {slides.length > 1 && (
          <>
            <button
              type="button"
              className="hb-arrow prev"
              aria-label="Précédent"
              onClick={(e) => {
                e.stopPropagation();
                setActiveSlide((prev) => (prev - 1 + slides.length) % slides.length);
              }}
            >
              ‹
            </button>
            <button
              type="button"
              className="hb-arrow next"
              aria-label="Suivant"
              onClick={(e) => {
                e.stopPropagation();
                setActiveSlide((prev) => (prev + 1) % slides.length);
              }}
            >
              ›
            </button>
            <div className="hb-dots">
              {slides.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  className={idx === activeSlide ? "active" : ""}
                  aria-label={`Slide ${idx + 1}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveSlide(idx);
                  }}
                />
              ))}
            </div>
          </>
        )}
      </section>

      {/* ---- CATÉGORIES VISUELLES ---- */}
      <div className="bs-section-title">
        <h2>Catégories</h2>
      </div>
      <div className="bs-cats">
        {safeCategories.map((c) => (
          <div 
            key={c.id} 
            className="bs-cat-card" 
            onClick={() => navigate(`/catalogue?categoryId=${c.id}`)}
          >
            <img 
              src={c.imageUrl || "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=300&q=80"} 
              alt={c.nom} 
              loading="lazy"
              decoding="async"
              className="bs-cat-img" 
            />
            <div className="bs-cat-name">{c.nom}</div>
          </div>
        ))}
      </div>

      {/* ---- PROMOTIONS ---- */}
      {promos.length > 0 && (
        <>
          <div className="bs-section-title" style={{ marginTop: 36 }}>
            <h2>Offres & Promotions</h2>
          </div>
          <div className="bs-grid">
            {promos.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </>
      )}

      {/* ---- HOME SIDE BANNERS (PLACED BELOW PROMOTIONS) ---- */}
      {sideBanners.length > 0 && (
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16,
          marginTop: 36, marginBottom: 36
        }}>
          {sideBanners.map((sb, idx) => (
            <div
              key={idx}
              onClick={() => handleBannerClick(sb)}
              style={{
                borderRadius: 16, overflow: "hidden", position: "relative", height: 180,
                cursor: "pointer", boxShadow: "0 4px 16px rgba(0,0,0,0.08)", transition: "transform 0.2s"
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = "translateY(-4px)"}
              onMouseLeave={(e) => e.currentTarget.style.transform = "translateY(0)"}
            >
              <img src={sb.imageUrl} alt={sb.title || "Banner"} loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              <div style={{
                position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 60%)",
                padding: 16, display: "flex", flexDirection: "column", justifyContent: "flex-end"
              }}>
                {sb.title && <div style={{ color: "#fff", fontWeight: 800, fontSize: 16 }}>{sb.title}</div>}
                {sb.subtitle && <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 12, marginTop: 4 }}>{sb.subtitle}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ---- NOUVEAUX PRODUITS ---- */}
      {safeProducts.length > 0 && (() => {
        const customNouveaux = safeProducts.filter(p => p.isNouveau || p.isNouveau === true || p.isNouveau === 1);
        const displayNouveaux = customNouveaux.length > 0 
          ? customNouveaux 
          : [...safeProducts].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 8);

        return (
          <CategoryScrollSection
            category={{ id: "new", nom: "Nouveaux Produits" }}
            products={displayNouveaux}
            onNavigate={() => navigate("/catalogue")}
          />
        );
      })()}

      {/* ---- SECTIONS SCROLLABLES CRÉÉES AUTOMATIQUEMENT PAR FAMILLE (UNIQUES ET STRICTES) ---- */}
      {uniqueFamilles.map((famName) => {
        const normTarget = famName.toLowerCase();
        const famProds = safeProducts.filter(p => {
          const pFam = getNormalizedFamilleName(p.Category?.famille || p.famille);
          return pFam.toLowerCase() === normTarget;
        });

        if (famProds.length === 0) return null;

        const sectionTitle = `Section ${famName}`;

        return (
          <CategoryScrollSection
            key={normTarget}
            category={{ id: `fam-${normTarget}`, nom: sectionTitle }}
            products={famProds}
            onNavigate={() => navigate(`/catalogue?famille=${encodeURIComponent(famName)}`)}
          />
        );
      })}
    </>
  );
}

