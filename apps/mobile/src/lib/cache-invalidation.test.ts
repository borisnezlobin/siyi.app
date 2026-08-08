import { startCacheInvalidation } from "@/lib/cache-invalidation";

jest.mock(
  "@react-native-async-storage/async-storage",
  () =>
    jest.requireActual(
      "@react-native-async-storage/async-storage/jest/async-storage-mock",
    ),
);

jest.mock("@react-native-community/netinfo", () => ({
  __esModule: true,
  default: {
    fetch: jest.fn(async () => ({
      isConnected: true,
      isInternetReachable: true,
    })),
  },
}));

const mockCurrentUserId = jest.fn(async () => "user-1" as string | null);
jest.mock("@/lib/data", () => ({
  currentUserIdForCache: () => mockCurrentUserId(),
}));

import { updateOfflineSnapshot } from "@/lib/offline-store";
import { clearQueryCache, readQuery, writeQuery } from "@/lib/query-cache";

const person = { id: "p-1", fullName: "Ada Lovelace" };

async function settle() {
  // The listener coalesces a burst of writes, so give it time to land.
  await new Promise((resolve) => setTimeout(resolve, 120));
}

beforeEach(() => {
  clearQueryCache();
  mockCurrentUserId.mockClear();
});

/**
 * The failure being prevented is a saved change that does not appear until the
 * app is restarted. The first version of this invalidated instead of writing
 * through, which emptied the cache on every *read* — reads save the snapshot
 * too — and could leave a focused screen showing its spinner with no way back.
 */
describe("keeping the screen cache in step with the device's copy", () => {
  it("writes the new values through rather than emptying the cache", async () => {
    const stop = startCacheInvalidation();
    writeQuery("people", []);

    await updateOfflineSnapshot("user-1", (current) => ({
      ...current,
      people: [person] as never,
    }));
    await settle();

    // Never undefined at any point: a screen holding this cannot fall back to
    // a full-screen spinner it has no way to recover from.
    expect(readQuery("people")).toEqual([person]);
    stop();
  });

  it("ignores keys nobody has asked for, so an unopened screen costs nothing", async () => {
    const stop = startCacheInvalidation();

    await updateOfflineSnapshot("user-1", (current) => ({
      ...current,
      people: [person] as never,
    }));
    await settle();

    expect(readQuery("people")).toBeUndefined();
    // The snapshot is a parse of the whole dataset; it is not worth reading
    // for a screen that has never been opened.
    expect(mockCurrentUserId).not.toHaveBeenCalled();
    stop();
  });

  it("reads the file once for a burst of writes", async () => {
    const stop = startCacheInvalidation();
    writeQuery("people", []);

    await updateOfflineSnapshot("user-1", (current) => current);
    await updateOfflineSnapshot("user-1", (current) => current);
    await updateOfflineSnapshot("user-1", (current) => current);
    await settle();

    expect(mockCurrentUserId).toHaveBeenCalledTimes(1);
    stop();
  });
});
