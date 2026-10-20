import React, { useState, useEffect } from "react";
import { Download, X, Share, Smartphone, Monitor } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";

export default function PWAInstallPrompt() {
  const { boutique } = useAuth();
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  const storeName = boutique?.nom || "Boutique";
  const storeLogo = boutique?.logoUrl || "https://images.unsplash.com/photo-1543083477-4f785aeafaa9?auto=format&fit=crop&w=192&h=192&q=80";

  // Inject Dynamic Manifest and Page Title / Icons based on Settings
  useEffect(() => {
    const currentName = boutique?.nom || storeName;
    const currentLogo = boutique?.logoUrl || storeLogo;

    if (currentName) {
      document.title = currentName;

      // Update Apple PWA App Title
      let appleTitleMeta = document.querySelector('meta[name="apple-mobile-web-app-title"]');
      if (!appleTitleMeta) {
        appleTitleMeta = document.createElement("meta");
        appleTitleMeta.name = "apple-mobile-web-app-title";
        document.head.appendChild(appleTitleMeta);
      }
      appleTitleMeta.content = currentName;

      // Update Standard Web Application Name
      let appNameMeta = document.querySelector('meta[name="application-name"]');
      if (!appNameMeta) {
        appNameMeta = document.createElement("meta");
        appNameMeta.name = "application-name";
        document.head.appendChild(appNameMeta);
      }
      appNameMeta.content = currentName;
    }

    // Connect to dynamic backend manifest route
    let linkTag = document.querySelector('link[rel="manifest"]');
    if (!linkTag) {
      linkTag = document.createElement("link");
      linkTag.rel = "manifest";
      document.head.appendChild(linkTag);
    }
    linkTag.href = `/manifest.json?t=${Date.now()}`;

    let appleIcon = document.querySelector('link[rel="apple-touch-icon"]');
    if (!appleIcon) {
      appleIcon = document.createElement("link");
      appleIcon.rel = "apple-touch-icon";
      document.head.appendChild(appleIcon);
    }
    appleIcon.href = currentLogo;
  }, [boutique, storeName, storeLogo]);

  useEffect(() => {
    // Check if already running in standalone mode (already installed as PWA)
    const inStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
    setIsStandalone(inStandalone);

    if (inStandalone) return;

    // Detect iOS
    const ua = window.navigator.userAgent;
    const isAppleDevice = /iPhone|iPad|iPod/i.test(ua) && !window.MSStream;
    setIsIOS(isAppleDevice);

    if (isAppleDevice) {
      const dismissed = localStorage.getItem("pwa_ios_dismissed");
      if (!dismissed) {
        setShowPrompt(true);
      }
    }

    // Android & Desktop Chrome/Edge beforeinstallprompt event
    function handleBeforeInstallPrompt(e) {
      e.preventDefault();
      setDeferredPrompt(e);
      const dismissed = localStorage.getItem("pwa_prompt_dismissed");
      if (!dismissed) {
        setShowPrompt(true);
      }
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  async function handleInstallClick() {
    if (isIOS) {
      setShowIOSGuide(true);
      return;
    }

    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setShowPrompt(false);
        setDeferredPrompt(null);
      }
    }
  }

  function dismissPrompt() {
    setShowPrompt(false);
    setShowIOSGuide(false);
    if (isIOS) {
      localStorage.setItem("pwa_ios_dismissed", "true");
    } else {
      localStorage.setItem("pwa_prompt_dismissed", "true");
    }
  }

  if (isStandalone || (!showPrompt && !showIOSGuide)) return null;

  return (
    <>
      {/* Floating Bottom-Right Banner for 1-Click PWA Installation */}
      {showPrompt && !showIOSGuide && (
        <div style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 9999,
          background: "linear-gradient(135deg, #163424 0%, #224B35 100%)",
          color: "#ffffff",
          padding: "16px 20px",
          borderRadius: 16,
          boxShadow: "0 12px 36px rgba(0, 0, 0, 0.28)",
          border: "1px solid rgba(255, 255, 255, 0.15)",
          maxWidth: 360,
          width: "calc(100% - 48px)",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          animation: "slideUpToast 0.35s ease"
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {storeLogo ? (
                <img
                  src={storeLogo}
                  alt={storeName}
                  style={{ width: 42, height: 42, borderRadius: 10, objectFit: "cover", border: "1px solid rgba(255,255,255,0.2)", flexShrink: 0 }}
                />
              ) : (
                <div style={{ background: "rgba(255,255,255,0.15)", padding: 8, borderRadius: 10 }}>
                  {isIOS ? <Smartphone size={20} color="#fff" /> : <Download size={20} color="#fff" />}
                </div>
              )}
              <div>
                <div style={{ fontWeight: 800, fontSize: 14, color: "#ffffff" }}>
                  {isIOS ? `Installer ${storeName}` : `Installer ${storeName}`}
                </div>
                <div style={{ fontSize: 12, color: "#DDE8DF", marginTop: 2 }}>
                  Accédez à la boutique en 1-clic comme une application native.
                </div>
              </div>
            </div>
            <button
              onClick={dismissPrompt}
              style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", cursor: "pointer", borderRadius: "50%", padding: 4, display: "flex" }}
            >
              <X size={16} />
            </button>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <button
              onClick={handleInstallClick}
              style={{
                flex: 1, background: "var(--accent)", color: "#fff", border: "none",
                padding: "9px 14px", borderRadius: 10, fontWeight: 700, fontSize: 13,
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6
              }}
            >
              <Download size={15} /> Installer maintenant
            </button>
            <button
              onClick={dismissPrompt}
              style={{
                background: "transparent", color: "#DDE8DF", border: "1px solid rgba(255,255,255,0.2)",
                padding: "9px 12px", borderRadius: 10, fontWeight: 600, fontSize: 12.5, cursor: "pointer"
              }}
            >
              Plus tard
            </button>
          </div>
        </div>
      )}

      {/* iOS Installation Guide Modal */}
      {showIOSGuide && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 100000,
          background: "rgba(15, 23, 42, 0.75)", backdropFilter: "blur(6px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20
        }}>
          <div style={{
            background: "#ffffff", borderRadius: 20, padding: 24,
            maxWidth: 380, width: "100%", textAlign: "center",
            boxShadow: "0 20px 40px rgba(0,0,0,0.3)"
          }}>
            <div style={{ width: 50, height: 50, borderRadius: "50%", background: "var(--forest-light)", color: "var(--forest)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
              <Smartphone size={24} />
            </div>
            <h3 style={{ margin: "0 0 8px", fontSize: 18, color: "var(--forest-dark)" }}>
              Installation sur iOS (Safari)
            </h3>
            <p style={{ fontSize: 13.5, color: "var(--muted)", margin: "0 0 20px", lineHeight: 1.5 }}>
              Pour installer l'application sur votre écran d'accueil iPhone ou iPad :
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 12, textAlign: "left", background: "var(--paper)", padding: 14, borderRadius: 12, marginBottom: 20, fontSize: 13, color: "var(--ink)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ background: "var(--forest)", color: "#fff", width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12, flexShrink: 0 }}>1</div>
                <span>Appuyez sur le bouton <strong>Partager</strong> <Share size={15} style={{ verticalAlign: "middle", display: "inline" }} /> en bas du navigateur Safari.</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ background: "var(--forest)", color: "#fff", width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12, flexShrink: 0 }}>2</div>
                <span>Faites défiler vers le bas et sélectionnez <strong>« Sur l'écran d'accueil »</strong>.</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ background: "var(--forest)", color: "#fff", width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12, flexShrink: 0 }}>3</div>
                <span>Cliquez sur <strong>« Ajouter »</strong> en haut à droite.</span>
              </div>
            </div>

            <button
              onClick={dismissPrompt}
              className="bs-btn-primary"
              style={{ width: "100%", padding: 12, fontSize: 14 }}
            >
              Compris !
            </button>
          </div>
        </div>
      )}
    </>
  );
}
