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

  // Cart quantity check
  const itemInCart = cart.find(l => l.product.id === product.id);
  const qtyInCart = itemInCart ? itemInCart.quantite : 0;
  const stockDisponible = Math.max(0, (product.stock ?? 0) - qtyInCart);
  const isMaxStockReached = product.stock > 0 && stockDisponible <= 0;

  function handleAddToCart() {
    if (!product) return;
    if (product.stock <= 0) {
      showToast(`Désolé, le produit "${product.nom}" est actuellement en rupture de stock. Il sera de nouveau disponible bientôt !`, "warning");
      return;
    }
    const ok = addToCart(product, quantity);
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
  if (images.length === 0) {
    images.push("https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80");
  }

  const noteMoyenne = product.avis?.length
    ? product.avis.reduce((s, a) => s + a.note, 0) / product.avis.length 
    : (product.noteEtoiles !== undefined && product.noteEtoiles !== null ? Number(product.noteEtoiles) : 5.0);

  return (
    <div style={{ minHeight: "75vh" }}>
      <button className="bs-back" onClick={() => navigate("/catalogue")}>
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
              {images.map((img, idx) => (
                <img 
                  key={idx}
                  src={img} 
                  alt={`Vignette ${idx + 1}`} 
                  className={`bs-gallery-thumb ${idx === selectedImgIndex ? "active" : ""}`}
                  onClick={() => setSelectedImgIndex(idx)} 
                />
              ))}
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
                ♻️ Matériel Occasion (2nde main)
              </span>
            ) : (
              <span style={{ 
                display: "inline-flex", alignItems: "center", gap: 5,
                background: "#F0FDFA", color: "#0F766E", border: "1.5px solid #99F6E4",
                padding: "3px 10px", borderRadius: 12, fontSize: 12, fontWeight: 800 
              }}>
                ✨ Matériel Neuf
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
              Rupture de stock
            </div>
          ) : isMaxStockReached ? (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 20, fontSize: 13, fontWeight: 700, marginBottom: 16, background: "#FEF3C7", color: "#B45309", border: "1px solid #F59E0B" }}>
              <AlertTriangle size={15} /> Stock maximal dans votre panier ({qtyInCart}/{product.stock} restants)
            </div>
          ) : (
            <div style={{ display: "inline-block", padding: "6px 14px", borderRadius: 20, fontSize: 13, fontWeight: 700, marginBottom: 16, background: "rgba(31, 77, 58, 0.1)", color: "var(--forest)" }}>
              En stock ({product.stock} {product.unite} restants{qtyInCart > 0 ? ` · ${qtyInCart} dans le panier` : ""})
            </div>
          )}

          <div className="bs-price-row" style={{ fontSize: 24, marginBottom: 20 }}>
            {product.prixPromo ? (
              <>
                <span className="bs-price barre" style={{ fontSize: 20, color: "var(--muted)", textDecoration: "line-through" }}>{fcfa(product.prix)}</span>
                <span className="bs-price" style={{ fontSize: 32, color: "#B4483A", fontWeight: 900 }}>{fcfa(product.prixPromo)}</span>
              </>
            ) : (
              <span className="bs-price" style={{ fontSize: 32, fontWeight: 900 }}>{fcfa(product.prix)}</span>
            )}
            <span style={{ color: "var(--muted)", fontSize: 15, fontWeight: 600 }}>
              / {product.poids && product.poids !== "1" ? `${product.poids} ` : ""}{product.unite}
            </span>
          </div>

          <p style={{ color: "var(--muted)", fontSize: 15, maxWidth: 520, lineHeight: 1.6, marginBottom: 24 }}>
            {product.description || (product.stock > 0 ? `Produit de qualité supérieure disponible en stock (${product.stock} ${product.unite}).` : "Rupture de stock temporaire.")}
          </p>

          <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 40 }}>
            <div style={{ display: "flex", alignItems: "center", border: "1px solid var(--line)", borderRadius: 30, overflow: "hidden", height: 48, opacity: isMaxStockReached || product.stock === 0 ? 0.6 : 1 }}>
              <button onClick={decrementQty} disabled={quantity <= 1} style={{ width: 44, height: "100%", background: "var(--paper)", border: "none", cursor: quantity <= 1 ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Minus size={18} color="var(--ink)" />
              </button>
              <input
                type="number"
                min="1"
                max={stockDisponible}
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
              <button onClick={incrementQty} disabled={quantity >= stockDisponible} style={{ width: 44, height: "100%", background: "var(--paper)", border: "none", cursor: quantity >= stockDisponible ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
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
                background: product.stock <= 0 ? "var(--line)" : isMaxStockReached ? "#D97706" : undefined,
                color: product.stock <= 0 ? "var(--muted)" : undefined,
                cursor: "pointer"
              }} 
              onClick={handleAddToCart}
            >
              {added ? (
                <><CheckCircle size={20} /> Ajouté au panier !</>
              ) : isMaxStockReached ? (
                <><AlertTriangle size={20} /> Stock max en panier ({qtyInCart}/{product.stock})</>
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

