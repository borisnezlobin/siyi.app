import {
  createChunkedSecureStorage,
  normalizeSecureStoreKey,
} from "@/lib/secure-storage";

function memoryBackend() {
  const values = new Map<string, string>();
  const touchedKeys: string[] = [];

  return {
    values,
    touchedKeys,
    backend: {
      async getItemAsync(key: string) {
        touchedKeys.push(key);
        return values.get(key) ?? null;
      },
      async setItemAsync(key: string, value: string) {
        touchedKeys.push(key);
        values.set(key, value);
      },
      async deleteItemAsync(key: string) {
        touchedKeys.push(key);
        values.delete(key);
      },
    },
  };
}

describe("chunked SecureStore storage", () => {
  it("encodes unsupported key characters without producing invalid keys", () => {
    expect(normalizeSecureStoreKey("sb:auth/token")).toBe(
      "sb_3a_auth_2f_token",
    );
    expect(normalizeSecureStoreKey("")).toBe("supabase.session");
  });

  it("stores and reconstructs a session using only valid SecureStore keys", async () => {
    const memory = memoryBackend();
    const storage = createChunkedSecureStorage(memory.backend, 5);
    const session = "a-long-session-token";

    await storage.setItem("sb:auth/token", session);

    expect(await storage.getItem("sb:auth/token")).toBe(session);
    expect(
      memory.touchedKeys.every((key) => /^[A-Za-z0-9._-]+$/.test(key)),
    ).toBe(true);
  });

  it("removes stale chunks when a refreshed session becomes shorter", async () => {
    const memory = memoryBackend();
    const storage = createChunkedSecureStorage(memory.backend, 4);

    await storage.setItem("session", "abcdefghijkl");
    await storage.setItem("session", "short");

    expect(await storage.getItem("session")).toBe("short");
    expect(memory.values.has("session.part.2")).toBe(false);
  });

  it("reads and removes a legacy unchunked value", async () => {
    const memory = memoryBackend();
    const storage = createChunkedSecureStorage(memory.backend);
    memory.values.set("session", "legacy-token");

    expect(await storage.getItem("session")).toBe("legacy-token");
    await storage.removeItem("session");
    expect(memory.values.size).toBe(0);
  });
});
