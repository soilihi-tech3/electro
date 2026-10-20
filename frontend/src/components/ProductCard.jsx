import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ShoppingCart, Heart, AlertTriangle, Trash2 } from "lucide-react";
import Stars from "./Stars.jsx";
import { useCart } from "../context/CartContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";

import { formatPrice as fcfa } from "../utils/currency.js";

export default function ProductCard({ product, isFavorisPage }) {
  const navigate = useNavigate();
  const { cart, addToCart, showToast } = useCart();
  const { user } = useAuth();
  
  const noteMoyenne = product.avis?.length
    ? product.avis.reduce((s, a) => s + a.note, 0) / product.avis.length
    : (product.noteEtoiles !== undefined && product.noteEtoiles !== null ? Number(product.noteEtoiles) : 5.0);

  const defaultImg = "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80";
  const mainImage = product.imageUrl || defaultImg;
  const secondaryImage = product.imageUrl2 || null;

  // User-scoped favorites logic
  const [isFavorite, setIsFavorite] = useState(false);
  const getFavKey = () => (user && user.id ? `favorites_user_${user.id}` : "favorites_guest");

  useEffect(() => {
    const key = getFavKey();
    const favs = JSON.parse(localStorage.getItem(key) || "[]");
    setIsFavorite(favs.includes(product.id));
  }, [product.id, user?.id]);

  function toggleFavorite(e) {
    e.stopPropagation();
    const key = getFavKey();
    let favs = JSON.parse(localStorage.getItem(key) || "[]");
    if (isFavorite) {
      favs = favs.filter(id => id !== product.id);
      setIsFavorite(false);
      showToast(`"${product.nom}" retiré de vos favoris.`, "info", "Favoris");
    } else {
      favs.push(product.id);
      setIsFavorite(true);
      showToast(`"${product.nom}" ajouté à vos favoris !`, "success");
    }
    localStorage.setItem(key, JSON.stringify(favs));
    window.dispatchEvent(new Event("favorites_updated"));
  }

  // Calculate discount percentage
  const hasPromo = product.enPromo || (product.prixPromo && Number(product.prixPromo) < Number(product.prix));
  const promoPercent = hasPromo && product.prixPromo ? Math.round(((Number(product.prix) - Number(product.prixPromo)) / Number(product.prix)) * 100) : 0;

  // Check stock out status (expiration retirée pour matériel électrique & outillage)
  const isOutOfStock = product.stock <= 0;

  // Cart quantity check
  const itemInCart = cart.find((l) => l.product.id === product.id);
  const qtyInCart = itemInCart ? itemInCart.quantite : 0;
  const isMaxStockReached = !isOutOfStock && qtyInCart >= product.stock;

  const weightUnitText = product.unite 
    ? `/ ${product.poids && product.poids !== "1" ? `${product.poids} ` : ""}${product.unite}`
    : "";

  return (
    <div className="bs-card" onClick={() => navigate(`/produit/${product.id}`, { state: { product } })} style={{ opacity: isOutOfStock ? 0.75 : 1, position: "relative" }}>
      <div className="bs-thumb-container">
        <img 
          src={mainImage} 
          alt={product.nom} 
          loading="lazy"
          decoding="async"
          className={`bs-thumb-img ${secondaryImage ? "has-hover" : "zoom-hover"}`} 
        />
        {secondaryImage && (
          <img 
            src={secondaryImage} 
            alt={`${product.nom} 2`} 
            loading="lazy"
            decoding="async"
            className="bs-thumb-img secondary zoom-hover" 
          />
        )}
        
        <button 
          className="bs-fav-btn" 
          onClick={toggleFavorite}
          title={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
          style={{
            position: "absolute", top: 12, right: 12, 
            background: isFavorite ? "#FDF2F0" : "rgba(255,255,255,0.9)", 
            border: isFavorite ? "1px solid #F8D7D2" : "none", 
            borderRadius: "50%", width: 34, height: 34, 
            display: "flex", alignItems: "center", justifyContent: "center", 
            cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.1)", zIndex: 10
          }}
        >
          <Heart size={18} color={isFavorite ? "#B4483A" : "var(--muted)"} fill={isFavorite ? "#B4483A" : "none"} />
        </button>

        {/* BLUE DISCOUNT PERCENTAGE BADGE */}
        {hasPromo ? (
          <span style={{
            position: "absolute", top: 12, left: 12,
            background: "#0284C7", color: "#fff",
            padding: "4px 10px", borderRadius: 16,
            fontWeight: 800, fontSize: 12, zIndex: 10,
            boxShadow: "0 2px 6px rgba(2,132,199,0.3)"
          }}>
            {promoPercent > 0 ? `-${promoPercent}%` : "PROMO"}
          </span>
        ) : product.isNouveau ? (
          <span style={{
            position: "absolute", top: 12, left: 12,
            background: "#163424", color: "#fff",
            padding: "4px 10px", borderRadius: 16,
            fontWeight: 800, fontSize: 11.5, zIndex: 10,
            boxShadow: "0 2px 6px rgba(22,52,36,0.35)"
          }}>
            NOUVEAU
          </span>
        ) : null}

        {/* OUT OF STOCK OR MAX IN CART BADGES */}
        {isOutOfStock ? (
          <span style={{
            position: "absolute", bottom: 12, left: 12,
            background: "#64748B", color: "#fff",
            padding: "4px 10px", borderRadius: 16,
            fontWeight: 800, fontSize: 11, zIndex: 10
          }}>
            Épuisé / Stock 0
          </span>
        ) : isMaxStockReached ? (
          <span style={{
            position: "absolute", bottom: 12, left: 12,
            background: "#D97706", color: "#fff",
            padding: "4px 10px", borderRadius: 16,
            fontWeight: 800, fontSize: 11, zIndex: 10,
            display: "flex", alignItems: "center", gap: 4
          }}>
            <AlertTriangle size={12} /> Stock max en panier ({qtyInCart}/{product.stock})
          </span>
        ) : product.stock <= product.seuilAlerte ? (
          <span className="bs-stockflag">Stock limité ({product.stock})</span>
        ) : null}
      </div>

      <div className="bs-card-body">
        <div className="cat-name">{product.Category?.nom || "Produit"}</div>
        <div className="nom">{product.nom}</div>

        <div className="bs-price-row">
          {hasPromo && product.prixPromo ? (
            <>
              <span className="bs-price" style={{ color: "var(--accent)", fontWeight: 800 }}>{fcfa(product.prixPromo)}</span>
              <span className="bs-price barre">{fcfa(product.prix)}</span>
            </>
          ) : (
            <span className="bs-price">{fcfa(product.prix)}</span>
          )}
          {weightUnitText && (
            <span style={{ color: "var(--muted)", fontSize: 12.5, fontWeight: 600 }}>
              {weightUnitText}
            </span>
          )}
        </div>

        <div className="bs-rating">
          <Stars note={noteMoyenne} size={12} />
          <span>{noteMoyenne.toFixed(1)} ({product.avis?.length || 0})</span>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button 
            className="bs-add-btn" 
            onClick={(e) => { 
              e.stopPropagation(); 
              if (isOutOfStock) {
                showToast(`Désolé, le produit "${product.nom}" est actuellement en rupture de stock. Il sera de nouveau disponible bientôt !`, "warning");
                return;
              }
              addToCart(product, 1); 
            }}
            style={{
              flex: 1,
              marginTop: 0,
              background: isOutOfStock ? "var(--line)" : isMaxStockReached ? "#FEF3C7" : undefined,
              color: isOutOfStock ? "var(--muted)" : isMaxStockReached ? "#B45309" : undefined,
              borderColor: isMaxStockReached ? "#F59E0B" : undefined,
              cursor: isOutOfStock ? "pointer" : "pointer"
            }}
          >
            <ShoppingCart size={15} /> 
            {isOutOfStock 
              ? (isExpired ? "Expiré" : "Épuisé") 
              : isMaxStockReached 
              ? `Stock max (${qtyInCart}/${product.stock})` 
              : "Ajouter au panier"}
          </button>

          {isFavorisPage && (
            <button
              onClick={toggleFavorite}
              title="Supprimer ce favori"
              style={{
                marginTop: 0,
                background: "#FDF2F0",
                color: "#B4483A",
                border: "1px solid #F8D7D2",
                borderRadius: "var(--radius-sm)",
                padding: "0 12px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.2s ease"
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#F8D7D2")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#FDF2F0")}
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

