// Browser IndexedDB and LocalStorage Manager for Offline Mode & Auto Sync

const DB_NAME = "MarchVertOfflineDB";
const DB_VERSION = 1;
const CACHE_STORE = "api_cache";
const QUEUE_STORE = "sync_queue";

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      return reject(new Error("IndexedDB not supported"));
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(CACHE_STORE)) {
        db.createObjectStore(CACHE_STORE);
      }
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        db.createObjectStore(QUEUE_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function notifyQueueUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("offline_queue_updated"));
  }
}

export function buildCacheKey(url, params) {
  if (!url) return "";
  if (!params || typeof params !== "object" || Object.keys(params).length === 0) {
    return url;
  }
  const sortedKeys = Object.keys(params).sort();
  const query = sortedKeys
    .filter((k) => params[k] !== undefined && params[k] !== null && params[k] !== "")
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
    .join("&");
  return query ? `${url}?${query}` : url;
}

// ---- API DATA CACHING ----
export async function saveCache(key, data) {
  try {
    const db = await openDB();
    const tx = db.transaction(CACHE_STORE, "readwrite");
    tx.objectStore(CACHE_STORE).put(data, key);
    return true;
  } catch (e) {
    try {
      localStorage.setItem(`offline_cache_${key}`, JSON.stringify(data));
    } catch (err) {}
    return false;
  }
}

export async function getCache(key) {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(CACHE_STORE, "readonly");
      const req = tx.objectStore(CACHE_STORE).get(key);
      req.onsuccess = () => {
        if (req.result !== undefined) {
          resolve(req.result);
        } else {
          const fallback = localStorage.getItem(`offline_cache_${key}`);
          resolve(fallback ? JSON.parse(fallback) : null);
        }
      };
      req.onerror = () => {
        const fallback = localStorage.getItem(`offline_cache_${key}`);
        resolve(fallback ? JSON.parse(fallback) : null);
      };
    });
  } catch (e) {
    const fallback = localStorage.getItem(`offline_cache_${key}`);
    return fallback ? JSON.parse(fallback) : null;
  }
}

// Optimistically update cached list when offline POST/PUT/DELETE happens
export async function applyOptimisticMutation(url, method, payload, tempId) {
  if (!url) return null;
  const upper = (method || "GET").toUpperCase();
  // Determine base collection URL (e.g., /admin/fournisseurs/5 -> /admin/fournisseurs)
  const parts = url.split("?")[0].split("/").filter(Boolean);
  const lastSegment = parts[parts.length - 1];
  const isItemUrl = upper === "PUT" || upper === "DELETE" || /^\d+$|^offline_temp_/.test(lastSegment);
  const collectionUrl = isItemUrl ? "/" + parts.slice(0, -1).join("/") : "/" + parts.join("/");
  const itemId = isItemUrl ? lastSegment : tempId;

  try {
    const current = await getCache(collectionUrl);
    if (Array.isArray(current)) {
      let updated = [...current];
      if (upper === "POST") {
        const newItem = {
          id: tempId || `offline_temp_${Date.now()}`,
          createdAt: new Date().toISOString(),
          ...(payload && typeof payload === "object" ? payload : {}),
          offline: true
        };
        updated = [newItem, ...updated];
      } else if (upper === "PUT") {
        updated = updated.map((item) =>
          String(item.id) === String(itemId)
            ? { ...item, ...(payload && typeof payload === "object" ? payload : {}), offline: true }
            : item
        );
      } else if (upper === "DELETE") {
        updated = updated.filter((item) => String(item.id) !== String(itemId));
      }
      await saveCache(collectionUrl, updated);
      return updated;
    }
  } catch (e) {}
  return null;
}

// ---- QUEUE MANAGEMENT FOR MUTATIONS (POST/PUT/DELETE) ----
export async function enqueueAction(action) {
  const item = {
    id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    timestamp: Date.now(),
    ...action
  };
  try {
    const db = await openDB();
    const tx = db.transaction(QUEUE_STORE, "readwrite");
    tx.objectStore(QUEUE_STORE).put(item);
  } catch (e) {
    const queue = JSON.parse(localStorage.getItem("offline_sync_queue") || "[]");
    queue.push(item);
    localStorage.setItem("offline_sync_queue", JSON.stringify(queue));
  }
  notifyQueueUpdated();
  return item;
}

export async function getPendingActions() {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(QUEUE_STORE, "readonly");
      const req = tx.objectStore(QUEUE_STORE).getAll();
      req.onsuccess = () => {
        const dbItems = req.result || [];
        const localItems = JSON.parse(localStorage.getItem("offline_sync_queue") || "[]");
        const all = [...dbItems, ...localItems];
        // Deduplicate by id
        const unique = Array.from(new Map(all.map(i => [i.id, i])).values());
        resolve(unique.sort((a, b) => a.timestamp - b.timestamp));
      };
      req.onerror = () => {
        const localItems = JSON.parse(localStorage.getItem("offline_sync_queue") || "[]");
        resolve(localItems);
      };
    });
  } catch (e) {
    const localItems = JSON.parse(localStorage.getItem("offline_sync_queue") || "[]");
    return localItems;
  }
}

export async function removeAction(id) {
  try {
    const db = await openDB();
    const tx = db.transaction(QUEUE_STORE, "readwrite");
    tx.objectStore(QUEUE_STORE).delete(id);
  } catch (e) {}
  try {
    const queue = JSON.parse(localStorage.getItem("offline_sync_queue") || "[]");
    const filtered = queue.filter(item => item.id !== id);
    localStorage.setItem("offline_sync_queue", JSON.stringify(filtered));
  } catch (e) {}
  notifyQueueUpdated();
}

export async function clearQueue() {
  try {
    const db = await openDB();
    const tx = db.transaction(QUEUE_STORE, "readwrite");
    tx.objectStore(QUEUE_STORE).clear();
  } catch (e) {}
  localStorage.removeItem("offline_sync_queue");
  notifyQueueUpdated();
}
