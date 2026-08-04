import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";

export function useRefreshableData<T>(loader: () => Promise<T>) {
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const [data, setData] = useState<T | null>(null);
  const dataRef = useRef<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (showRefresh = false) => {
      if (showRefresh) setRefreshing(true);
      else if (!dataRef.current) setLoading(true);
      setError(null);
      try {
        const nextData = await loaderRef.current();
        dataRef.current = nextData;
        setData(nextData);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "This screen could not be loaded.",
        );
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
