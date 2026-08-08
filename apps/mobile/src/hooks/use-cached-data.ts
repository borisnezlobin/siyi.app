import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import {
  loadQuery,
  queryUpdatedAt,
  readQuery,
  seedQuery,
  subscribeToQueryCache,
} from "@/lib/query-cache";

/**
 * How long a value is treated as fresh enough to skip a background refresh.
 * Moving between tabs is normal navigation, not a request for new data, so a
 * few seconds of quiet stops every hop turning into a round trip.
 */
const freshForMs = 15_000;

type Options<T> = {
  /**
   * Reads whatever is already on the device, without touching the network.
   * Runs before `fresh` on a cold start so the first paint costs a disk read
   * rather than a request.
   */
  cached?: () => Promise<T | null>;
  /** Skips the network entirely — for screens that must not refetch yet. */
  enabled?: boolean;
};

export function useCachedData<T>(
  key: string,
  fresh: () => Promise<T>,
  { cached, enabled = true }: Options<T> = {},
) {
  const data = useSyncExternalStore(
    subscribeToQueryCache,
    () => readQuery<T>(key),
    () => readQuery<T>(key),
  );
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Both loaders are almost always inline closures, so their identity changes
  // on every render. Holding them in refs keeps the key — not the callback —
  // as what identifies the request, otherwise the focus effect tears down and
  // re-runs constantly and any local state change past the freshness window
  // becomes an unasked-for refetch.
  const freshRef = useRef(fresh);
  freshRef.current = fresh;
  const cachedRef = useRef(cached);
  cachedRef.current = cached;

  const revalidate = useCallback(
    async (showSpinner: boolean) => {
      if (showSpinner) setRefreshing(true);
      setError(null);
      try {
        await loadQuery(key, () => freshRef.current());
      } catch (loadError) {
        // A failed refresh over data already on screen is not an error state:
        // the screen keeps showing what it has.
        if (readQuery<T>(key) === undefined) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "This screen could not be loaded.",
          );
        }
      } finally {
        if (showSpinner) setRefreshing(false);
      }
    },
    [key],
  );

  useFocusEffect(
    useCallback(() => {
      if (!enabled) return;
      let cancelled = false;

      void (async () => {
        if (readQuery<T>(key) === undefined && cachedRef.current) {
          try {
            const fromDisk = await cachedRef.current();
            // Only seed if the network has not already answered.
            if (!cancelled && fromDisk !== null && readQuery<T>(key) === undefined) {
              seedQuery(key, fromDisk);
            }
          } catch {
            // A missing or unreadable cache just means there is nothing to show
            // before the request lands.
          }
        }

        if (cancelled) return;
        const updatedAt = queryUpdatedAt(key) ?? 0;
        if (Date.now() - updatedAt < freshForMs) return;
        await revalidate(false);
      })();

      return () => {
        cancelled = true;
      };
    }, [enabled, key, revalidate]),
  );

  return {
    data,
    /** Only true when there is nothing at all to draw yet. */
    loading: data === undefined && error === null,
    refreshing,
    error,
    refresh: () => revalidate(true),
    reload: () => revalidate(false),
  };
}
