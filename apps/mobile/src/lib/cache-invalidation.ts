import { getOfflineSnapshot, subscribeToOfflineStore } from "@/lib/offline-store";
import { currentUserIdForCache } from "@/lib/data";
import { markStale, queryKeys, readQuery, seedQuery } from "@/lib/query-cache";

/**
 * Keeps the screen cache in step with the device's own copy of the data.
 *
 * The first attempt at this *invalidated* on every snapshot write, which was
 * wrong twice over. Reads write the snapshot too — `getPeople` ends by saving
 * what it fetched — so every screen load emptied the cache it had just filled.
 * And emptying it meant a focused screen could re-render with nothing to show,
 * fall back to its full-screen spinner, and have no way to recover because
 * nothing re-triggers a focus effect on a screen that never lost focus.
 *
 * Writing the new values through instead fixes both: the cache is corrected
 * rather than emptied, so no screen is ever left holding nothing, and a
 * mutation's result appears immediately without a refetch.
 */
let stop: (() => void) | null = null;

/** Coalesces the burst of writes a sync produces into one read of the file. */
const settleMs = 50;

export function startCacheInvalidation() {
  if (stop) return stop;

  let timer: ReturnType<typeof setTimeout> | null = null;

  const unsubscribe = subscribeToOfflineStore(() => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void syncCacheFromSnapshot();
    }, settleMs);
  });

  stop = () => {
    if (timer) clearTimeout(timer);
    unsubscribe();
    stop = null;
  };
  return stop;
}

/**
 * Only refreshes keys somebody has already asked for. Reading the snapshot is
 * a parse of the whole dataset, so it is not worth doing for a screen nobody
 * has opened.
 */
async function syncCacheFromSnapshot() {
  const cachedKeys = queryKeys().filter(
    (key) => key === "people" || key.startsWith("person:"),
  );
  // The tab screens combine the dataset with account settings and classes,
  // which the snapshot cannot rebuild on its own. They keep what they have and
  // reload on next focus — dropping it would strand a focused tab on its
  // spinner with nothing left to trigger a reload.
  for (const key of queryKeys()) {
    if (key === "peopleTab" || key === "today" || key === "classes") {
      markStale(key);
    }
  }
  if (cachedKeys.length === 0) return;

  const userId = await currentUserIdForCache();
  if (!userId) return;
  const snapshot = await getOfflineSnapshot(userId);

  if (readQuery("people") !== undefined) {
    seedQuery("people", snapshot.people);
  }
  for (const [personId, details] of Object.entries(snapshot.personDetails)) {
    const key = `person:${personId}`;
    if (readQuery(key) !== undefined) seedQuery(key, details);
  }
}
