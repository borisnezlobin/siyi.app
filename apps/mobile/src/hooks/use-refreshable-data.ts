import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { AppState } from "react-native";
import { readableError } from "@/lib/error-text";

/** Matches `useCachedData`: a hop away and back is navigation, not a request. */
const freshForMs = 15_000;

export function useRefreshableData<T>(loader: () => Promise<T>) {
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const [data, setData] = useState<T | null>(null);
  const dataRef = useRef<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedAt = useRef(0);

  const load = useCallback(
    async (showRefresh = false) => {
      if (showRefresh) setRefreshing(true);
      else if (!dataRef.current) setLoading(true);
      setError(null);
      try {
        const nextData = await loaderRef.current();
        dataRef.current = nextData;
        loadedAt.current = Date.now();
        setData(nextData);
      } catch (loadError) {
        setError(readableError(loadError, "This screen could not be loaded."));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useFocusEffect(
    useCallback(() => {
      void load();

      /**
       * Coming back to the app is not a focus change — the screen never lost
       * focus while the app was in the background — so without this a phone
       * picked back up shows whatever it was showing when it was put down.
       *
       * Gated on how long ago the last load was, because `active` fires for far
       * more than picking the phone up: control centre, the app switcher, and
       * every system permission dialog. Ungated, granting photo access from the
       * edit screen refetched the whole person underneath the form.
       */
      const subscription = AppState.addEventListener("change", (state) => {
        if (state !== "active") return;
        if (Date.now() - loadedAt.current < freshForMs) return;
        void load();
      });
      return () => subscription.remove();
    }, [load]),
  );

  return {
    data,
    loading,
    refreshing,
    error,
    refresh: () => load(true),
    reload: () => load(false),
    setData: (nextData: T) => {
      dataRef.current = nextData;
      setData(nextData);
    },
  };
}
