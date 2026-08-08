import {
  clearQueryCache,
  invalidateQuery,
  loadQuery,
  queryUpdatedAt,
  readQuery,
  seedQuery,
  subscribeToQueryCache,
  writeQuery,
} from "@/lib/query-cache";

beforeEach(() => clearQueryCache());

/**
 * The cache is what stops a screen re-fetching everything it already had. The
 * behaviours worth pinning down are the ones that made the old version slow:
 * a value surviving between screens, one request serving two callers, and a
 * disk snapshot never being mistaken for fresh data.
 */
describe("the screen data cache", () => {
  it("keeps a value after the screen that loaded it has gone", async () => {
    await loadQuery("people", async () => ["ada"]);

    // Nothing is holding a reference; a new screen mounting reads it straight
    // back, which is the difference between instant and a round trip.
    expect(readQuery<string[]>("people")).toEqual(["ada"]);
  });

  it("serves two simultaneous callers from one request", async () => {
    let calls = 0;
    const loader = async () => {
      calls += 1;
      return calls;
    };

    const [first, second] = await Promise.all([
      loadQuery("people", loader),
      loadQuery("people", loader),
    ]);

    expect(calls).toBe(1);
    expect(first).toBe(second);
  });

  it("lets a later request run once the first has finished", async () => {
    let calls = 0;
    const loader = async () => {
      calls += 1;
      return calls;
    };

    await loadQuery("people", loader);
    await loadQuery("people", loader);

    expect(calls).toBe(2);
  });

  it("treats a disk snapshot as something to redraw, not something to trust", () => {
    seedQuery("people", ["from disk"]);

    expect(readQuery<string[]>("people")).toEqual(["from disk"]);
    // Timestamped as long expired, so the refresh that follows is never
    // skipped for being recent.
    expect(queryUpdatedAt("people")).toBe(0);
  });

  it("marks a real load as fresh", () => {
    writeQuery("people", ["ada"]);

    expect(queryUpdatedAt("people")).toBeGreaterThan(0);
  });

  it("tells subscribers when a value lands", async () => {
    const listener = jest.fn();
    const unsubscribe = subscribeToQueryCache(listener);

    await loadQuery("people", async () => ["ada"]);

    expect(listener).toHaveBeenCalled();
    unsubscribe();
  });

  it("stops telling a subscriber that has gone away", async () => {
    const listener = jest.fn();
    subscribeToQueryCache(listener)();

    await loadQuery("people", async () => ["ada"]);

    expect(listener).not.toHaveBeenCalled();
  });

  it("does not cache a failed load", async () => {
    await expect(
      loadQuery("people", async () => {
        throw new Error("offline");
      }),
    ).rejects.toThrow("offline");

    expect(readQuery("people")).toBeUndefined();
    // And the key is not left holding a rejected promise, which would make
    // every later attempt fail with the same stale error.
    await expect(loadQuery("people", async () => ["ada"])).resolves.toEqual(["ada"]);
  });

  it("keeps different people apart", async () => {
    await loadQuery("person:a", async () => "Ada");
    await loadQuery("person:b", async () => "Grace");

    expect(readQuery("person:a")).toBe("Ada");
    expect(readQuery("person:b")).toBe("Grace");
  });

  it("forgets one key on request, leaving the rest alone", async () => {
    await loadQuery("people", async () => ["ada"]);
    await loadQuery("reminders", async () => ["call"]);

    invalidateQuery("people");

    expect(readQuery("people")).toBeUndefined();
    expect(readQuery("reminders")).toEqual(["call"]);
  });

  it("throws away a request that was already running when an account signed out", async () => {
    let release: (value: string[]) => void = () => undefined;
    const slow = new Promise<string[]>((resolve) => {
      release = resolve;
    });

    const request = loadQuery("people", () => slow);
    // The previous account signs out while their request is still in the air.
    clearQueryCache();
    release(["someone else's people"]);
    await request;

    // Written back, it would have been marked fresh, so the next account
    // would have been shown it without even revalidating.
    expect(readQuery("people")).toBeUndefined();
  });

  it("leaves nothing of the previous account behind", async () => {
    await loadQuery("people", async () => ["ada"]);

    clearQueryCache();

    expect(readQuery("people")).toBeUndefined();
  });
});
