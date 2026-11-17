import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import api from "../api";
import { getPendingActions, removeAction } from "../utils/offlineStorage";
import { clearSwrCache } from "../utils/swrCache";
import { emitRealtimeEvent } from "../utils/realtime";

export const OfflineContext = createContext(null);

export function OfflineProvider({ children }) {
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncToast, setSyncToast] = useState(null);

  const checkPending = useCallback(async () => {
    const actions = await getPendingActions();
    setPendingCount(actions.length);
    return actions;
  }, []);

  useEffect(() => {
    checkPending();
    const handleQueueUpdated = () => {
      checkPending();
    };
    window.addEventListener("offline_queue_updated", handleQueueUpdated);
    return () => {
      window.removeEventListener("offline_queue_updated", handleQueueUpdated);
    };
  }, [checkPending]);

  const syncOfflineQueue = useCallback(async () => {
    if (!navigator.onLine || isSyncing) return;
    const actions = await checkPending();
    if (actions.length === 0) return;

    setIsSyncing(true);
    let successCount = 0;

    for (const action of actions) {
      try {
        if (action.method === "POST" || action.method === "post") {
          await api.post(action.url, action.data);
        } else if (action.method === "PUT" || action.method === "put") {
          await api.put(action.url, action.data);
        } else if (action.method === "DELETE" || action.method === "delete") {
          await api.delete(action.url);
        }
        await removeAction(action.id);
        successCount++;
      } catch (err) {
        console.error("Erreur lors de la synchronisation de l'action", action, err);
        // If server 4xx or bad payload, remove to prevent blocking queue
        if (err.response && err.response.status < 500) {
          await removeAction(action.id);
        }
      }
    }

    await checkPending();
    setIsSyncing(false);

    if (successCount > 0) {
      clearSwrCache();
      emitRealtimeEvent("sync_completed", { syncedCount: successCount });
      setSyncToast(`Internet rétabli : ${successCount} action(s) synchronisée(s) sans actualiser !`);
      setTimeout(() => setSyncToast(null), 5000);
    }
  }, [checkPending, isSyncing]);

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
      syncOfflineQueue();
    }
    function handleOffline() {
      setIsOnline(false);
      checkPending();
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial sync check if back online
    if (navigator.onLine) {
      syncOfflineQueue();
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [syncOfflineQueue, checkPending]);

  return (
    <OfflineContext.Provider value={{ isOnline, isSyncing, pendingCount, syncOfflineQueue, syncToast }}>
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline() {
  return useContext(OfflineContext);
}
