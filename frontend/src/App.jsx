import React from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import Header from "./components/Header.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";



function ScrollToTop() {
  const { pathname } = useLocation();
  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

import Home from "./pages/store/Home.jsx";
import Catalogue from "./pages/store/Catalogue.jsx";
import ProductDetail from "./pages/store/ProductDetail.jsx";
import Checkout from "./pages/store/Checkout.jsx";
import Confirmation from "./pages/store/Confirmation.jsx";
import MyOrders from "./pages/store/MyOrders.jsx";
import Login from "./pages/store/Login.jsx";
import Register from "./pages/store/Register.jsx";
import About from "./pages/store/About.jsx";
import Profile from "./pages/store/Profile.jsx";
import RechargeMobile from "./pages/store/RechargeMobile.jsx";

const AdminLayout = React.lazy(() => import("./pages/admin/AdminLayout.jsx"));
const Dashboard = React.lazy(() => import("./pages/admin/Dashboard.jsx"));
const AdminProduits = React.lazy(() => import("./pages/admin/Produits.jsx"));
const AdminCategories = React.lazy(() => import("./pages/admin/Categories.jsx"));
const AdminOrders = React.lazy(() => import("./pages/admin/Orders.jsx"));
const AdminEmployees = React.lazy(() => import("./pages/admin/Employees.jsx"));
const AdminClients = React.lazy(() => import("./pages/admin/Clients.jsx"));
const AdminSettings = React.lazy(() => import("./pages/admin/Settings.jsx"));


const VenteDirecte = React.lazy(() => import("./pages/admin/VenteDirecte.jsx"));
const Fournisseurs = React.lazy(() => import("./pages/admin/Fournisseurs.jsx"));
const UnitesVente = React.lazy(() => import("./pages/admin/UnitesVente.jsx"));
const AdminMarques = React.lazy(() => import("./pages/admin/Marques.jsx"));
const Achats = React.lazy(() => import("./pages/admin/Achats.jsx"));
const SalesHistory = React.lazy(() => import("./pages/admin/SalesHistory.jsx"));

const SuperAdmin = React.lazy(() => import("./pages/superadmin/SuperAdmin.jsx"));

import BoutiqueGuard from "./components/BoutiqueGuard.jsx";
import Footer from "./components/Footer.jsx";

function StoreLayout({ children }) {
  return (
    <BoutiqueGuard>
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <Header />
        <div className="bs-shell" style={{ flex: 1 }}>{children}</div>
        <Footer />
      </div>
    </BoutiqueGuard>
  );
}

function WideLayout({ children }) {
  return (
    <BoutiqueGuard>
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <Header />
        <div style={{ flex: 1, width: "100%", display: "flex", flexDirection: "column" }}>{children}</div>
        <Footer />
      </div>
    </BoutiqueGuard>
  );
}

import PWAInstallPrompt from "./components/PWAInstallPrompt.jsx";
import MustChangePasswordModal from "./components/MustChangePasswordModal.jsx";
import { initRealtimeSync, subscribeRealtime } from "./utils/realtime.js";
import { Toaster, toast } from "react-hot-toast";

function RealtimeToastNotifier() {
  React.useEffect(() => {
    const unsub = subscribeRealtime((detail) => {
      if (!detail || !detail.type) return;
      const type = detail.type;

      if (type === "order_created") {
        toast("Nouvelle commande enregistrée en direct !", { icon: "ℹ️" });
      } else if (type === "order_updated") {
        // Optionnel : ne pas afficher de toast pour order_updated si ça spamme, 
        // ou le garder s'il est jugé utile
        // toast("Statut de commande mis à jour !", { icon: "ℹ️" });
      }
    });

    return unsub;
  }, []);

  return null;
}

export default function App() {
  React.useEffect(() => {
    initRealtimeSync();
  }, []);

  return (
    <>
      <ScrollToTop />
      <Toaster 
        position="top-center" 
        toastOptions={{
          style: {
            borderRadius: '12px',
            background: '#333',
            color: '#fff',
            fontSize: '14px',
            fontWeight: 500,
            padding: '12px 20px',
            boxShadow: '0 8px 16px rgba(0,0,0,0.15)'
          },
        }} 
      />
      <PWAInstallPrompt />
      <MustChangePasswordModal />
      <RealtimeToastNotifier />
      <Routes>
        {/* --- Boutique (front-office) --- */}
        <Route path="/" element={<StoreLayout><Home /></StoreLayout>} />
        <Route path="/a-propos" element={<StoreLayout><About /></StoreLayout>} />
        <Route path="/catalogue" element={<StoreLayout><Catalogue /></StoreLayout>} />
        <Route path="/produit/:id" element={<StoreLayout><ProductDetail /></StoreLayout>} />
        <Route path="/connexion" element={<StoreLayout><Login /></StoreLayout>} />
        <Route path="/inscription" element={<StoreLayout><Register /></StoreLayout>} />
        <Route path="/profil" element={
          <ProtectedRoute roles={["client", "admin", "employe", "super_admin"]}><WideLayout><Profile /></WideLayout></ProtectedRoute>
        } />
        <Route path="/commander" element={
          <ProtectedRoute roles={["client"]}><WideLayout><Checkout /></WideLayout></ProtectedRoute>
        } />
        <Route path="/confirmation/:id" element={
          <ProtectedRoute roles={["client"]}><WideLayout><Confirmation /></WideLayout></ProtectedRoute>
        } />
        <Route path="/mes-commandes" element={
          <ProtectedRoute roles={["client"]}><WideLayout><MyOrders /></WideLayout></ProtectedRoute>
        } />
        <Route path="/recharge-credit" element={<StoreLayout><RechargeMobile /></StoreLayout>} />
        <Route path="/recharge-mobile" element={<StoreLayout><RechargeMobile /></StoreLayout>} />

        {/* --- Back-office Admin / Employé --- */}
        <Route path="/admin" element={
          <ProtectedRoute roles={["admin", "employe"]}><React.Suspense fallback={<div className="bs-admin-loading-spinner" />}><AdminLayout /></React.Suspense></ProtectedRoute>
        }>
          <Route index element={<React.Suspense fallback={<div className="bs-admin-loading-spinner" />}><Dashboard /></React.Suspense>} />
          <Route path="vente" element={<React.Suspense fallback={<div className="bs-admin-loading-spinner" />}><VenteDirecte /></React.Suspense>} />
          <Route path="ventes-historique" element={<React.Suspense fallback={<div className="bs-admin-loading-spinner" />}><SalesHistory /></React.Suspense>} />
          <Route path="achats" element={<React.Suspense fallback={<div className="bs-admin-loading-spinner" />}><Achats /></React.Suspense>} />
          <Route path="fournisseurs" element={<React.Suspense fallback={<div className="bs-admin-loading-spinner" />}><Fournisseurs /></React.Suspense>} />
          <Route path="unites" element={<React.Suspense fallback={<div className="bs-admin-loading-spinner" />}><UnitesVente /></React.Suspense>} />
          <Route path="marques" element={<React.Suspense fallback={<div className="bs-admin-loading-spinner" />}><AdminMarques /></React.Suspense>} />
          <Route path="home-banners" element={<React.Suspense fallback={<div className="bs-admin-loading-spinner" />}><AdminSettings defaultTab="home_banners" /></React.Suspense>} />
          <Route path="side-banners" element={<React.Suspense fallback={<div className="bs-admin-loading-spinner" />}><AdminSettings defaultTab="side_banners" /></React.Suspense>} />
          <Route path="produits" element={<React.Suspense fallback={<div className="bs-admin-loading-spinner" />}><AdminProduits /></React.Suspense>} />
          <Route path="categories" element={<React.Suspense fallback={<div className="bs-admin-loading-spinner" />}><AdminCategories /></React.Suspense>} />
          <Route path="commandes" element={<React.Suspense fallback={<div className="bs-admin-loading-spinner" />}><AdminOrders /></React.Suspense>} />
          <Route path="clients" element={<React.Suspense fallback={<div className="bs-admin-loading-spinner" />}><AdminClients /></React.Suspense>} />
          <Route path="employes" element={<React.Suspense fallback={<div className="bs-admin-loading-spinner" />}><AdminEmployees /></React.Suspense>} />


          <Route path="utilisateurs" element={<React.Suspense fallback={<div className="bs-admin-loading-spinner" />}><AdminEmployees /></React.Suspense>} />
          <Route path="parametres" element={<React.Suspense fallback={<div className="bs-admin-loading-spinner" />}><AdminSettings defaultTab="general" /></React.Suspense>} />
        </Route>

        {/* --- Console Super Admin --- */}
        <Route path="/super-admin" element={
          <ProtectedRoute roles={["super_admin"]}><React.Suspense fallback={<div className="bs-admin-loading-spinner" />}><SuperAdmin /></React.Suspense></ProtectedRoute>
        } />
      </Routes>
    </>
  );
}
