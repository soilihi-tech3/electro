import { SLUG } from "../api";

const getBaseUrl = () => {
  const isBrowser = typeof window !== "undefined";
  const hostname = isBrowser && window.location.hostname ? window.location.hostname : "localhost";
  const isLocal = hostname === "localhost" || hostname === "127.0.0.1";

  if (isLocal) {
    return import.meta.env.VITE_API_URL || `http://${hostname}:4000/api`;
  }

  return "https://electro-backend-8hfq.onrender.com/api";
};

const REALTIME_EVENTS = [
  "order_updated",
  "order_created",
  "order_deleted",
  "product_updated",
  "boutique_updated",
  "category_updated",
  "fournisseur_updated",
  "achat_updated",
  "unite_updated",
  "marque_updated",
  "user_updated",
  "user_registered",
  "sync_completed"
];

let eventSource = null;
let reconnectTimer = null;
let broadcastChannel = null;

function initBroadcastChannel() {
  if (typeof window === "undefined" || broadcastChannel || typeof BroadcastChannel === "undefined") return;
  try {
    broadcastChannel = new BroadcastChannel("easymarket_sync_channel");
    broadcastChannel.onmessage = (event) => {
      if (event?.data?.type) {
        window.dispatchEvent(
          new CustomEvent("app_realtime_event", {
            detail: {
              type: event.data.type,
              data: event.data.data || {},
              timestamp: event.data.timestamp || Date.now(),
              fromChannel: true
            }
          })
        );
      }
    };
  } catch (e) {}
}

export function emitRealtimeEvent(type, data = {}) {
  if (typeof window === "undefined") return;
  const payload = { type, data, timestamp: Date.now() };
  window.dispatchEvent(new CustomEvent("app_realtime_event", { detail: payload }));
  try {
    initBroadcastChannel();
    if (broadcastChannel) {
      broadcastChannel.postMessage(payload);
    }
  } catch (e) {}
}

export function initRealtimeSync() {
  if (typeof window === "undefined") return;
  initBroadcastChannel();
  if (eventSource) return;

  const streamUrl = `${getBaseUrl()}/store/${SLUG}/realtime/events`;

  try {
    eventSource = new EventSource(streamUrl);

    const handleEvent = (type) => (e) => {
      let data = {};
      try {
        data = JSON.parse(e.data || "{}");
      } catch (err) {}

      emitRealtimeEvent(type, data);
    };

    REALTIME_EVENTS.forEach((evtName) => {
      eventSource.addEventListener(evtName, handleEvent(evtName));
    });

    eventSource.onerror = () => {
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
      clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(initRealtimeSync, 5000);
    };
  } catch (err) {
    console.warn("Realtime sync warning:", err);
  }
}

export function subscribeRealtime(callback) {
  const handler = (e) => {
    if (callback && e.detail) {
      callback(e.detail);
    }
  };
  window.addEventListener("app_realtime_event", handler);
  return () => window.removeEventListener("app_realtime_event", handler);
}
