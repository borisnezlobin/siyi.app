/**
 * One cache for screen data, shared across every screen and every visit.
 *
 * Before this existed each screen held its own copy in component state, so
 * leaving a screen threw the data away and coming back re-fetched it. Opening
 * the map, going back, and opening it again ran the whole remote dataset fetch
 * twice — which is why an "info page" whose contents were already on the
 * device took seconds to appear.
 *
 * The rule here is stale-while-revalidate: whatever is already known is
 * returned immediately and synchronously, and freshness is a background
 * concern. A screen only ever blocks on the network when there is genuinely
 * nothing to show yet.
 */

type Entry = {
  data: unknown;
  /** When the value was last written, so callers can decide it is stale. */
  at: number;
};

const entries = new Map<string, Entry>();
/**
 * Bumped whenever the cache is emptied. A request that was already running
 * when an account signed out completes afterwards and would otherwise write
 * the previous user's data back in — marked fresh, so the next account would
 * be shown it without even revalidating.
 */
let generation = 0;
const listeners = new Set<() => void>();
/** Deduplicates concurrent loads of the same key across screens. */
const inFlight = new Map<string, Promise<unknown>>();

function notify() {
  for (const listener of listeners) listener();
}

export function subscribeToQueryCache(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function readQuery<T>(key: string): T | undefined {
  return entries.get(key)?.data as T | undefined;
}

export function queryUpdatedAt(key: string): number | undefined {
  return entries.get(key)?.at;
}

export function writeQuery<T>(key: string, data: T) {
  entries.set(key, { data, at: Date.now() });
  notify();
}

/**
 * Runs `loader` unless the same key is already loading, in which case both
 * callers wait on the one request. Two screens mounting at once — the tab and
 * the detail page it pushes — must not become two identical fetches.
 */
export function loadQuery<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key) as Promise<T> | undefined;
  if (existing) return existing;

  const startedIn = generation;
  const request = (async () => {
    try {
      const data = await loader();
      // Dropped rather than written if the cache was emptied while this ran:
      // it belongs to whoever was signed in when it started.
      if (generation === startedIn) writeQuery(key, data);
      return data;
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, request);
  return request;
}

/**
 * Writes a value read off the device without marking it fresh, so the
 * background refresh that follows is never skipped. A disk snapshot is good
 * enough to draw immediately and never good enough to trust as current.
 */
export function seedQuery<T>(key: string, data: T) {
  entries.set(key, { data, at: 0 });
  notify();
}

/**
 * Keeps the value but marks it old, so the screen showing it keeps showing it
 * and reloads next time it is looked at. Deleting instead would leave a
 * focused screen with nothing to draw and no event to recover from, because
 * nothing re-fires a focus effect on a screen that never lost focus.
 */
export function markStale(key: string) {
  const entry = entries.get(key);
  if (!entry) return;
  entries.set(key, { data: entry.data, at: 0 });
  notify();
}

/** Every key currently held, so callers can invalidate by pattern. */
export function queryKeys(): string[] {
  return [...entries.keys()];
}

/** Signing out has to leave nothing of the previous account behind. */
export function clearQueryCache() {
  generation += 1;
  entries.clear();
  inFlight.clear();
  notify();
}

/**
 * Drops one key so the next read reloads it. Used after a mutation that the
 * screen cannot patch into the cached value itself.
 */
export function invalidateQuery(key: string) {
  entries.delete(key);
  inFlight.delete(key);
  notify();
}
