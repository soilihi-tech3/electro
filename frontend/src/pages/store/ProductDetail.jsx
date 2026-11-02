import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import { ArrowLeft, Tag, Star, ShoppingBag, CheckCircle, Heart, Minus, Plus, Search, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import api, { SLUG } from "../../api";
import Stars from "../../components/Stars.jsx";
import ProductCard from "../../components/ProductCard.jsx";
import { useCart } from "../../context/CartContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { subscribeRealtime } from "../../utils/realtime.js";
import { Skel } from "../../components/Skeleton.jsx";
import { readCache, writeCache } from "../../utils/swrCache.js";

import { formatPrice as fcfa } from "../../utils/currency.js";

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { cart, addToCart, showToast } = useCart();
  const { user } = useAuth();
  
  // Instant render using passed state from ProductCard, fallback to null
  const [product, setProduct] = useState(() => location.state?.product || readCache(`product:${id}`) || null);
  const [selectedImgIndex, setSelectedImgIndex] = useState(0);
  const [selectedColor, setSelectedColor] = useState(null);
  const [selectedOption, setSelectedOption] = useState(null);
  const [reviewDraft, setReviewDraft] = useState({ note: 5, commentaire: "" });
  const [erreur, setErreur] = useState("");
  const [added, setAdded] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [related, setRelated] = useState([]);
  const [isFavorite, setIsFavorite] = useState(false);
  const [hasPurchasedProduct, setHasPurchasedProduct] = useState(false);

  useEffect(() => {
    if (user) {
      api.get(`/store/${SLUG}/orders/mine`)
        .then((res) => {
          const orders = res.data || [];
          const bought = orders.some((order) => {
            const isCompleted = order.statut === "recuperee" || order.statut === "livree";
            if (!isCompleted) return false;
            return order.items?.some((it) => {
              const pid = it.product?.id || it.productId || it.product_id;
              return Number(pid) === Number(id);
            });
          });
          setHasPurchasedProduct(bought);
        })
        .catch(() => setHasPurchasedProduct(false));
    } else {
      setHasPurchasedProduct(false);
    }
  }, [user, id]);

  // Scroll to top immediately on navigate
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  // Hover zoom state
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 });
  const [isZoomed, setIsZoomed] = useState(false);

  const getFavKey = () => (user && user.id ? `favorites_user_${user.id}` : "favorites_guest");

  useEffect(() => {
    const key = getFavKey();
    const favs = JSON.parse(localStorage.getItem(key) || "[]");
    if (favs.includes(Number(id))) setIsFavorite(true);
    else setIsFavorite(false);
  }, [id, user?.id]);

  function toggleFavorite() {
    const key = getFavKey();
    let favs = JSON.parse(localStorage.getItem(key) || "[]");
    if (isFavorite) {
      favs = favs.filter(fid => fid !== Number(id));
      setIsFavorite(false);
      showToast(`"${product?.nom || 'Produit'}" retiré de vos favoris.`, "info", "Favoris");
    } else {
      favs.push(Number(id));
      setIsFavorite(true);
      showToast(`"${product?.nom || 'Produit'}" ajouté à vos favoris !`, "success");
    }
    localStorage.setItem(key, JSON.stringify(favs));
    window.dispatchEvent(new Event("favorites_updated"));
  }

  const sliderRef = useRef(null);

  function load() {
    // If product was passed via location.state, we already have it rendered instantly!
    api.get(`/store/${SLUG}/products/${id}`).then((res) => {
      setProduct(res.data);
      writeCache(`product:${id}`, res.data);
      if (res.data.categoryId) {
        api.get(`/store/${SLUG}/products?categoryId=${res.data.categoryId}`).then(r => {
          setRelated(r.data.filter(p => p.id !== res.data.id).slice(0, 10));
        }).catch(() => {});
      }
    }).catch(() => {});
  }

  const scrollSlider = (direction) => {
    if (sliderRef.current) {
      const scrollAmount = direction === "left" ? -300 : 300;
      sliderRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  useEffect(() => {
    load();
    const unsub = subscribeRealtime((detail) => {
      if (detail.type === "product_updated") {
        load();
      }
    });
    return unsub;
  }, [id]);

  async function submitReview() {
    setErreur("");
    try {
      await api.post(`/store/${SLUG}/products/${id}/reviews`, reviewDraft);
      setReviewDraft({ note: 5, commentaire: "" });
      load();
    } catch (err) {
      setErreur(err.response?.data?.message || "Impossible d'envoyer l'avis.");
    }
  }

  function handleMouseMove(e) {
    const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - left) / width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - top) / height) * 100));
    setZoomPos({ x, y });
  }

  if (!product) return (
    <div className="container" role="status" aria-label="Chargement" style={{ minHeight: "75vh", padding: "32px 16px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 32 }}>
      <Skel h={420} r={18} />
      <div style={{ display: "grid", gap: 14, alignContent: "start" }}>
        <Skel w="70%" h={28} />
        <Skel w="30%" h={14} />
        <Skel w="40%" h={30} />
        <Skel h={12} /><Skel h={12} /><Skel w="80%" h={12} />
        <Skel w="60%" h={48} r={14} style={{ marginTop: 12 }} />
      </div>
    </div>
  );

  // Helper pour désérialiser les variantes/photos en toute sécurité (JSON string ou Object/Array)
  const parseJsonSafe = (val, fallback) => {
    if (!val) return fallback;
    if (typeof val === "object") return val;
    if (typeof val === "string") {
      try {
        const p = JSON.parse(val);
        return typeof p === "string" ? parseJsonSafe(p, fallback) : (p ?? fallback);
      } catch {
        return fallback;
      }
    }
    return fallback;
  };

  // Variantes
  const parsedColors = parseJsonSafe(product.variantesCouleurs, []);
  const variantesCouleurs = Array.isArray(parsedColors) ? parsedColors : [];

  const rawOptionsObj = parseJsonSafe(product.variantesOptions, { titre: "Option", options: [] });
  let optionTitre = "Option";
  let variantesOptions = [];
  if (rawOptionsObj && typeof rawOptionsObj === "object" && !Array.isArray(rawOptionsObj) && rawOptionsObj.options) {
    optionTitre = rawOptionsObj.titre || "Option";
    variantesOptions = Array.isArray(rawOptionsObj.options) ? rawOptionsObj.options : [];
  } else if (Array.isArray(rawOptionsObj)) {
    variantesOptions = rawOptionsObj;
  }

  // Stock spécifique à la variante sélectionnée
  const hasVariants = variantesCouleurs.length > 0 || variantesOptions.length > 0;
  let activeVariantStock = product.stock ?? 0;
  let isVariantOutOfStock = false;
  let activeVariantName = "";

  if (selectedColor) {
    activeVariantName = `Couleur ${selectedColor.nom}`;
    if (selectedColor.stock !== undefined && selectedColor.stock !== "") {
      activeVariantStock = Math.min(Number(selectedColor.stock), Number(product.stock ?? 0));
    }
  } else if (selectedOption) {
    activeVariantName = `${optionTitre} ${selectedOption.nom}`;
    if (selectedOption.stock !== undefined && selectedOption.stock !== "") {
      activeVariantStock = Math.min(Number(selectedOption.stock), Number(product.stock ?? 0));
    }
  }

  // Cart quantity check pour l'article précis
  const variantSuffix = [selectedColor?.nom, selectedOption?.nom].filter(Boolean).join(" · ");
  const currentCartItemId = `${product.id}_${selectedColor?.nom || ""}_${selectedOption?.nom || ""}`;
  const itemInCart = cart.find(l => (l.product.cartItemId || String(l.product.id)) === currentCartItemId || (l.product.id === product.id && !l.product.cartItemId && !variantSuffix));
  const qtyInCart = itemInCart ? itemInCart.quantite : 0;
  const stockDisponible = Math.max(0, activeVariantStock - qtyInCart);
  const isMaxStockReached = activeVariantStock > 0 && stockDisponible <= 0;
  isVariantOutOfStock = activeVariantStock <= 0;

  // Calcul du prix effectif
  const basePrice = (product.enPromo && product.prixPromo) ? Number(product.prixPromo) : Number(product.prix);
  let effectivePrice = basePrice;
  if (selectedColor && selectedColor.prix && Number(selectedColor.prix) > 0) {
    effectivePrice = Number(selectedColor.prix);
  } else if (selectedOption && selectedOption.prix && Number(selectedOption.prix) > 0) {
    effectivePrice = Number(selectedOption.prix);
  }

  function handleAddToCart() {
    if (!product) return;
    if (product.stock <= 0) {
      showToast(`Désolé, le produit "${product.nom}" est actuellement en rupture de stock.`, "warning");
      return;
    }
    if (isVariantOutOfStock) {
      showToast(`Cette sélection (${activeVariantName}) est actuellement épuisée. Veuillez choisir un autre modèle ou une autre couleur.`, "warning");
      return;
    }

    const selectedVariantPhoto = selectedColor?.photo || selectedOption?.photo || product.imageUrl;
    const productToAdd = {
      ...product,
      cartItemId: currentCartItemId,
      nom: variantSuffix ? `${product.nom} (${variantSuffix})` : product.nom,
      prix: effectivePrice,
      stock: activeVariantStock,
      imageUrl: selectedVariantPhoto,
      selectedColor,
      selectedOption
    };
    const ok = addToCart(productToAdd, quantity);
    if (ok) {
      setAdded(true);
      setTimeout(() => setAdded(false), 2000);
      setQuantity(1);
    }
  }

  function incrementQty() {
    if (quantity < stockDisponible) setQuantity(q => q + 1);
  }
  function decrementQty() {
    if (quantity > 1) setQuantity(q => q - 1);
  }

  const images = [];
  if (product.imageUrl) images.push(product.imageUrl);
  if (product.imageUrl2) images.push(product.imageUrl2);
  const parsedGallery = parseJsonSafe(product.galeriePhotos, []);
  if (Array.isArray(parsedGallery)) {
    parsedGallery.forEach(g => {
      if (g && !images.includes(g)) images.push(g);
    });
  }
  if (Array.isArray(variantesCouleurs)) {
    variantesCouleurs.forEach(vc => {
      if (vc?.photo && !images.includes(vc.photo)) images.push(vc.photo);
    });
  }
  if (Array.isArray(variantesOptions)) {
    variantesOptions.forEach(vo => {
      if (vo?.photo && !images.includes(vo.photo)) images.push(vo.photo);
    });
  }
  if (images.length === 0) {
    images.push("https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80");
  }

  const noteMoyenne = product.avis?.length
    ? product.avis.reduce((s, a) => s + a.note, 0) / product.avis.length 
    : (product.noteEtoiles !== undefined && product.noteEtoiles !== null ? Number(product.noteEtoiles) : 5.0);

  return (
    <div style={{ minHeight: "75vh" }}>
      <button 
        className="bs-back" 
        onClick={() => {
          if (window.history.length > 1) {
            navigate(-1);
          } else if (product.categoryId) {
            navigate(`/catalogue?categoryId=${product.categoryId}`);
          } else {
            navigate("/catalogue");
          }
        }}
      >
        <ArrowLeft size={16} /> Retour au catalogue
      </button>

      <div className="bs-detail">
        {/* GALERIE D'IMAGES AVEC HOVER ZOOM */}
        <div className="bs-gallery">
          <div 
            className="bs-zoom-wrapper"
            onMouseEnter={() => setIsZoomed(true)}
            onMouseLeave={() => setIsZoomed(false)}
            onMouseMove={handleMouseMove}
          >
            <img 
              src={images[selectedImgIndex] || images[0]} 
              alt={product.nom} 
              className="bs-main-image"
              style={{
                transformOrigin: `${zoomPos.x}% ${zoomPos.y}%`,
                transform: isZoomed ? "scale(2.2)" : "scale(1)"
              }} 
            />
            <div className="bs-zoom-badge">
              <Search size={13} /> Survolez pour zoomer
            </div>
          </div>

          {images.length > 1 && (
            <div className="bs-thumbs">
              {images.map((img, idx) => {
                const isSelected = idx === selectedImgIndex;
                return (
                  <img 
                    key={idx}
                    src={img} 
                    alt={`Vignette ${idx + 1}`} 
                    className={`bs-gallery-thumb ${isSelected ? "active" : ""}`}
                    onClick={() => {
                      setSelectedImgIndex(idx);
                      // Détection automatique de la variante associée à cette photo
                      const matchOption = variantesOptions.find(vo => vo.photo === img);
                      if (matchOption) {
                        setSelectedOption(matchOption);
                      }
                      const matchColor = variantesCouleurs.find(vc => vc.photo === img);
                      if (matchColor) {
                        setSelectedColor(matchColor);
                      }
                    }} 
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* INFOS PRODUIT */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
            <span style={{ color: "var(--sage)", fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {product.Category?.nom || "Électrique"}
            </span>

            {(product.marque?.nom || product.Marque?.nom) && (
              <span style={{ 
                display: "inline-flex", alignItems: "center", gap: 6,
                background: "var(--forest-light)", color: "var(--forest-dark)", 
                padding: "3px 10px", borderRadius: 12, fontSize: 12, fontWeight: 800,
                border: "1px solid var(--line)"
              }}>
                {(product.marque?.logoUrl || product.Marque?.logoUrl) && (
                  <img src={product.marque?.logoUrl || product.Marque?.logoUrl} alt="" style={{ width: 16, height: 16, objectFit: "contain" }} />
                )}
                Marque : {product.marque?.nom || product.Marque?.nom}
              </span>
            )}

            {product.etat === "occasion" ? (
              <span style={{ 
                display: "inline-flex", alignItems: "center", gap: 5,
                background: "#FFFBEB", color: "#B45309", border: "1.5px solid #FDE68A",
                padding: "3px 10px", borderRadius: 12, fontSize: 12, fontWeight: 800 
              }}>
                Matériel Occasion (2nde main)
              </span>
            ) : (
              <span style={{ 
                display: "inline-flex", alignItems: "center", gap: 5,
                background: "#F0FDFA", color: "#0F766E", border: "1.5px solid #99F6E4",
                padding: "3px 10px", borderRadius: 12, fontSize: 12, fontWeight: 800 
              }}>
                Matériel Neuf
              </span>
            )}
          </div>
          <h1 style={{ fontSize: 32, margin: "0 0 12px", color: "var(--forest-dark)", display: "flex", alignItems: "center", gap: 12 }}>
            {product.nom}
            <button onClick={toggleFavorite} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", padding: 0 }}>
              <Heart size={28} color={isFavorite ? "#B4483A" : "var(--muted)"} fill={isFavorite ? "#B4483A" : "none"} />
            </button>
          </h1>

          <div className="bs-rating" style={{ marginBottom: 16 }}>
            <Stars note={noteMoyenne} size={18} /> 
            <span style={{ fontWeight: 600, color: "var(--ink)", fontSize: 16 }}>{noteMoyenne.toFixed(1)}</span>
            <span style={{ fontSize: 14 }}>· {product.avis?.length || 0} avis client(s)</span>
          </div>

          {/* STOCK BADGES */}
          {product.stock <= 0 ? (
            <div style={{ display: "inline-block", padding: "6px 14px", borderRadius: 20, fontSize: 13, fontWeight: 700, marginBottom: 16, background: "#FAD2CD", color: "#B4483A" }}>
              Rupture de stock globale
            </div>
          ) : isVariantOutOfStock ? (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 14, fontSize: 13, fontWeight: 700, marginBottom: 16, background: "#FEF2F2", color: "#DC2626", border: "1.5px solid #FCA5A5" }}>
              <AlertTriangle size={16} /> 
              <span>Épuisé : <strong>{activeVariantName}</strong> n'est plus en stock. Veuillez choisir un autre modèle ou une autre couleur.</span>
            </div>
          ) : isMaxStockReached ? (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 20, fontSize: 13, fontWeight: 700, marginBottom: 16, background: "#FEF3C7", color: "#B45309", border: "1px solid #F59E0B" }}>
              <AlertTriangle size={15} /> Stock maximal dans votre panier ({qtyInCart}/{activeVariantStock} restants)
            </div>
          ) : (
            <div style={{ display: "inline-block", padding: "6px 14px", borderRadius: 20, fontSize: 13, fontWeight: 700, marginBottom: 16, background: "rgba(31, 77, 58, 0.1)", color: "var(--forest)" }}>
              {activeVariantName ? (
                <>En stock pour {activeVariantName} : <strong>{activeVariantStock} restant{activeVariantStock > 1 ? "s" : ""}</strong>{qtyInCart > 0 ? ` (${qtyInCart} dans votre panier)` : ""}</>
              ) : (
                <>En stock ({product.stock} restants{qtyInCart > 0 ? ` · ${qtyInCart} dans le panier` : ""})</>
              )}
            </div>
          )}

          <div className="bs-price-row" style={{ fontSize: 24, marginBottom: 20 }}>
            {effectivePrice !== Number(product.prix) ? (
              <>
                <span className="bs-price barre" style={{ fontSize: 20, color: "var(--muted)", textDecoration: "line-through" }}>{fcfa(product.prix)}</span>
                <span className="bs-price" style={{ fontSize: 32, color: "#B4483A", fontWeight: 900 }}>{fcfa(effectivePrice)}</span>
              </>
            ) : (
              <span className="bs-price" style={{ fontSize: 32, fontWeight: 900 }}>{fcfa(effectivePrice)}</span>
            )}
          </div>

          {/* SÉLECTEUR DE VARIANTES DE COULEURS ENCADRÉ ET MIS EN VALEUR */}
          {variantesCouleurs.length > 0 && (
            <div style={{
              marginBottom: 20,
              padding: "16px 18px",
              borderRadius: 16,
              background: "var(--paper)",
              border: "1.5px solid var(--line)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.02)"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: "var(--forest-dark)", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 6 }}>
                  <span>Couleur :</span>
                  <span style={{ color: "var(--forest)", fontWeight: 900 }}>{selectedColor?.nom || "Toutes"}</span>
                </div>
                {selectedColor && (
                  <span style={{ fontSize: 11.5, fontWeight: 800, color: "#059669", background: "#ECFDF5", border: "1px solid #A7F3D0", padding: "2px 8px", borderRadius: 8 }}>
                    {(selectedColor.stock !== undefined && selectedColor.stock !== "") ? `${selectedColor.stock} disponible(s)` : "En stock"}
                  </span>
                )}
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                {variantesCouleurs.map((vc, idx) => {
                  const isCur = selectedColor?.nom === vc.nom;
                  const vStock = (vc.stock !== undefined && vc.stock !== "") ? Number(vc.stock) : product.stock;
                  const isVDepleted = vStock <= 0;

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        const nextCur = isCur ? null : vc;
                        setSelectedColor(nextCur);
                        if (nextCur?.photo) {
                          const pIdx = images.indexOf(nextCur.photo);
                          if (pIdx >= 0) setSelectedImgIndex(pIdx);
                        } else if (!nextCur && product.imageUrl) {
                          const pIdx = images.indexOf(product.imageUrl);
                          if (pIdx >= 0) setSelectedImgIndex(pIdx);
                        }
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "7px 14px",
                        borderRadius: 14,
                        border: isCur ? "2px solid var(--forest)" : "1.5px solid var(--line)",
                        background: isCur ? "var(--forest-light)" : "#ffffff",
                        color: isCur ? "var(--forest-dark)" : "var(--ink)",
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: "pointer",
                        boxShadow: isCur ? "0 2px 8px rgba(31, 77, 58, 0.15)" : "none",
                        opacity: isVDepleted ? 0.6 : 1,
                        transition: "all 0.15s ease"
                      }}
                    >
                      {vc.photo ? (
                        <img src={vc.photo} alt={vc.nom} style={{ width: 22, height: 22, borderRadius: 6, objectFit: "cover" }} />
                      ) : (
                        <span style={{ width: 16, height: 16, borderRadius: "50%", background: vc.couleur || "#163424", border: "1px solid rgba(0,0,0,0.15)" }} />
                      )}
                      <span>{vc.nom}</span>
                      <span style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "1px 6px",
                        borderRadius: 6,
                        background: isVDepleted ? "#FEE2E2" : (isCur ? "#E6F4EA" : "#F3F4F6"),
                        color: isVDepleted ? "#DC2626" : (isCur ? "var(--forest-dark)" : "var(--muted)")
                      }}>
                        {isVDepleted ? "Épuisé" : `${vStock} dispo`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* SÉLECTEUR DE VARIANTES PERSONNALISABLES (SENTEURS, MODÈLES...) ENCADRÉ */}
          {variantesOptions.length > 0 && (
            <div style={{
              marginBottom: 20,
              padding: "16px 18px",
              borderRadius: 16,
              background: "var(--paper)",
              border: "1.5px solid var(--line)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.02)"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: "var(--forest-dark)", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 6 }}>
                  <span>{optionTitre} :</span>
                  <span style={{ color: "var(--forest)", fontWeight: 900 }}>{selectedOption?.nom || "Tous"}</span>
                </div>
                {selectedOption && (
                  <span style={{ fontSize: 11.5, fontWeight: 800, color: "#059669", background: "#ECFDF5", border: "1px solid #A7F3D0", padding: "2px 8px", borderRadius: 8 }}>
                    {(selectedOption.stock !== undefined && selectedOption.stock !== "") ? `${selectedOption.stock} disponible(s)` : "En stock"}
                  </span>
                )}
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                {variantesOptions.map((vo, idx) => {
                  const isCur = selectedOption?.nom === vo.nom;
                  const vStock = (vo.stock !== undefined && vo.stock !== "") ? Number(vo.stock) : product.stock;
                  const isVDepleted = vStock <= 0;

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        const nextCur = isCur ? null : vo;
                        setSelectedOption(nextCur);
                        if (nextCur?.photo) {
                          const pIdx = images.indexOf(nextCur.photo);
                          if (pIdx >= 0) setSelectedImgIndex(pIdx);
                        } else if (!nextCur && product.imageUrl) {
                          const pIdx = images.indexOf(product.imageUrl);
                          if (pIdx >= 0) setSelectedImgIndex(pIdx);
                        }
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "8px 16px",
                        borderRadius: 14,
                        border: isCur ? "2px solid var(--forest)" : "1.5px solid var(--line)",
                        background: isCur ? "var(--forest-light)" : "#ffffff",
                        color: isCur ? "var(--forest-dark)" : "var(--ink)",
                        fontWeight: 700,
                        fontSize: 13.5,
                        cursor: "pointer",
                        boxShadow: isCur ? "0 2px 8px rgba(31, 77, 58, 0.15)" : "none",
                        opacity: isVDepleted ? 0.6 : 1,
                        transition: "all 0.15s ease"
                      }}
                    >
                      {vo.photo && (
                        <img src={vo.photo} alt={vo.nom} style={{ width: 24, height: 24, borderRadius: 6, objectFit: "cover" }} />
                      )}
                      <span>{vo.nom}</span>
                      <span style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "1px 6px",
                        borderRadius: 6,
                        background: isVDepleted ? "#FEE2E2" : (isCur ? "#E6F4EA" : "#F3F4F6"),
                        color: isVDepleted ? "#DC2626" : (isCur ? "var(--forest-dark)" : "var(--muted)")
                      }}>
                        {isVDepleted ? "Épuisé" : `${vStock} dispo`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <p style={{ color: "var(--muted)", fontSize: 15, maxWidth: 520, lineHeight: 1.6, marginBottom: 24 }}>
            {product.description || (product.stock > 0 ? `Produit de qualité supérieure disponible en stock (${product.stock} disponibles).` : "Rupture de stock temporaire.")}
          </p>

          <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 40 }}>
            <div style={{ display: "flex", alignItems: "center", border: "1px solid var(--line)", borderRadius: 30, overflow: "hidden", height: 48, opacity: isMaxStockReached || isVariantOutOfStock || product.stock === 0 ? 0.6 : 1 }}>
              <button onClick={decrementQty} disabled={quantity <= 1 || isVariantOutOfStock} style={{ width: 44, height: "100%", background: "var(--paper)", border: "none", cursor: quantity <= 1 || isVariantOutOfStock ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Minus size={18} color="var(--ink)" />
              </button>
              <input
                type="number"
                min="1"
                max={stockDisponible}
                disabled={isVariantOutOfStock}
                value={quantity}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (isNaN(val) || val < 1) {
                    setQuantity(1);
                  } else if (val > stockDisponible) {
                    setQuantity(stockDisponible);
                    showToast(`Quantité ajustée au stock disponible (${stockDisponible}).`, "warning");
                  } else {
                    setQuantity(val);
                  }
                }}
                style={{
                  width: 54, textAlign: "center", fontWeight: 700, fontSize: 16,
                  border: "none", background: "transparent", color: "var(--ink)", outline: "none",
                  MozAppearance: "textfield"
                }}
              />
              <button onClick={incrementQty} disabled={quantity >= stockDisponible || isVariantOutOfStock} style={{ width: 44, height: "100%", background: "var(--paper)", border: "none", cursor: quantity >= stockDisponible || isVariantOutOfStock ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Plus size={18} color="var(--ink)" />
              </button>
            </div>

            <button 
              className="bs-btn-primary" 
              style={{ 
                flex: 1, 
                height: 48, 
                padding: "0 20px", 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center", 
                gap: 8, 
                fontSize: 16,
                background: (product.stock <= 0 || isVariantOutOfStock) ? "var(--line)" : isMaxStockReached ? "#D97706" : undefined,
                color: (product.stock <= 0 || isVariantOutOfStock) ? "var(--muted)" : undefined,
                cursor: (product.stock <= 0 || isVariantOutOfStock) ? "not-allowed" : "pointer"
              }} 
              disabled={product.stock <= 0 || isVariantOutOfStock}
              onClick={handleAddToCart}
            >
              {added ? (
                <><CheckCircle size={20} /> Ajouté au panier !</>
              ) : isVariantOutOfStock ? (
                <><AlertTriangle size={20} /> {activeVariantName || "Variante"} épuisé(e)</>
              ) : isMaxStockReached ? (
                <><AlertTriangle size={20} /> Stock max en panier ({qtyInCart}/{activeVariantStock})</>
              ) : (
                <><ShoppingBag size={20} /> Ajouter au panier</>
              )}
            </button>
          </div>

          {/* AVIS CLIENTS */}
          <div className="bs-reviews">
            <h3 style={{ fontSize: 18, color: "var(--forest-dark)" }}>Avis et commentaires clients</h3>
            {(!product.avis || product.avis.length === 0) && (
              <p style={{ color: "var(--muted)", fontSize: 14 }}>Aucun avis pour l'instant. Soyez le premier client à donner votre avis !</p>
            )}
            {product.avis?.map((a) => (
              <div className="bs-review" key={a.id}>
                <div className="who">{a.auteur?.nom || "Client vérifié"}</div>
                <Stars note={a.note} size={13} />
                <div style={{ fontSize: 14, marginTop: 4, color: "var(--ink)" }}>{a.commentaire}</div>
              </div>
            ))}

          </div>
        </div>
      </div>
      
      {/* RELATED PRODUCTS */}
      {related.length > 0 && (
        <div style={{ marginTop: 60, paddingTop: 40, borderTop: "1px solid var(--line)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h2 style={{ fontSize: 24, color: "var(--forest-dark)", margin: 0 }}>Produits similaires</h2>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => scrollSlider("left")}
                aria-label="Défiler à gauche"
                style={{
                  width: 38, height: 38, borderRadius: "50%",
                  background: "#fff", border: "1px solid var(--line)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
                  transition: "all 0.2s"
                }}
              >
                <ChevronLeft size={20} color="var(--forest-dark)" />
              </button>
              <button
                onClick={() => scrollSlider("right")}
                aria-label="Défiler à droite"
                style={{
                  width: 38, height: 38, borderRadius: "50%",
                  background: "#fff", border: "1px solid var(--line)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
                  transition: "all 0.2s"
                }}
              >
                <ChevronRight size={20} color="var(--forest-dark)" />
              </button>
            </div>
          </div>

          <div
            ref={sliderRef}
            style={{
              display: "flex",
              gap: 16,
              overflowX: "auto",
              scrollSnapType: "x mandatory",
              scrollBehavior: "smooth",
              paddingBottom: 16,
              scrollbarWidth: "none",
              msOverflowStyle: "none"
            }}
          >
            {related.map(p => (
              <div key={p.id} style={{ flex: "0 0 260px", minWidth: 260, scrollSnapAlign: "start" }}>
                <ProductCard product={p} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

