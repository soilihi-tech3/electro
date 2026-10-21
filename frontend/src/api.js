import axios from "axios";
import { saveCache, getCache, enqueueAction } from "./utils/offlineStorage";

const getBaseUrl = () => {
  const isBrowser = typeof window !== "undefined";
  const hostname = isBrowser && window.location.hostname ? window.location.hostname : "localhost";
  const isLocal = hostname === "localhost" || hostname === "127.0.0.1";

  if (isLocal) {
    return import.meta.env.VITE_API_URL || `http://${hostname}:4000/api`;
  }

  // En production (Vercel, mobile, domaine personnalisé), toujours contacter directement l'API en ligne
  return "https://electro-backend-8hfq.onrender.com/api";
};

export const SLUG = import.meta.env.VITE_BOUTIQUE_SLUG || "electro-pro";
const api = axios.create({ baseURL: getBaseUrl() });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;

  if (typeof window !== "undefined" && window.location && window.location.hostname) {
    config.headers["x-boutique-domain"] = window.location.hostname;
  }
  return config;
});

// Response Interceptor for Offline Mode Data Caching & Auto Queueing
api.interceptors.response.use(
  async (response) => {
    // Cache GET request data for offline usage
    if (response.config.method?.toUpperCase() === "GET" && response.data) {
      saveCache(response.config.url, response.data);
    }
    return response;
  },
  async (error) => {
    const config = error.config;
    const isNetworkError = !navigator.onLine || !error.response || error.code === "ERR_NETWORK" || error.code === "ECONNABORTED";

    if (isNetworkError && config) {
      const method = config.method?.toUpperCase() || "GET";

      if (method === "GET") {
        // Return cached GET data if offline
        const cachedData = await getCache(config.url);
        if (cachedData !== null && cachedData !== undefined) {
          return { data: cachedData, status: 200, statusText: "OK", headers: {}, config, offline: true };
        }
      } else if (["POST", "PUT", "DELETE"].includes(method)) {
        // Queue POST/PUT/DELETE mutation for auto-sync when network returns
        let parsedData = null;
        if (config.data) {
          try {
            parsedData = typeof config.data === "string" ? JSON.parse(config.data) : config.data;
          } catch (e) {
            parsedData = config.data;
          }
        }

        await enqueueAction({
          url: config.url,
          method,
          data: parsedData
        });

        // Return a mock successful response to keep user flow seamless
        return {
          data: {
            id: `offline_temp_${Date.now()}`,
            total: parsedData?.total || 0,
            statut: "validee",
            message: "Enregistré hors ligne. Synchronisation automatique au retour du réseau.",
            offline: true
          },
          status: 200,
          statusText: "OK (Offline Queued)",
          headers: {},
          config,
          offline: true
        };
      }
    }

    return Promise.reject(error);
  }
);

export default api;
