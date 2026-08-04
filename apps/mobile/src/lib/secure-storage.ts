type SecureStorageBackend = {
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string) => Promise<void>;
  deleteItemAsync: (key: string) => Promise<void>;
};

const allowedKeyCharacter = /^[A-Za-z0-9._-]$/;
const maximumStoredChunks = 128;

export function normalizeSecureStoreKey(key: string) {
  const normalized = Array.from(key, (character) =>
    allowedKeyCharacter.test(character)
      ? character
      : `_${character.codePointAt(0)!.toString(16)}_`,
  ).join("");

  return normalized || "supabase.session";
}

function chunkCountKey(key: string) {
  return `${normalizeSecureStoreKey(key)}.count`;
}

function chunkKey(key: string, index: number) {
  return `${normalizeSecureStoreKey(key)}.part.${index}`;
}

function validChunkCount(value: string | null) {
  if (value === null) return null;
  const count = Number(value);
  return Number.isSafeInteger(count) &&
    count > 0 &&
    count <= maximumStoredChunks
    ? count
    : null;
}

export function createChunkedSecureStorage(
  backend: SecureStorageBackend,
  chunkSize = 1800,
) {
  return {
    async getItem(key: string) {
      const normalizedKey = normalizeSecureStoreKey(key);
      const countStorageKey = chunkCountKey(key);
      const storedCount = await backend.getItemAsync(countStorageKey);

      if (storedCount === null) {
        return backend.getItemAsync(normalizedKey);
      }

      const chunkCount = validChunkCount(storedCount);
      if (chunkCount === null) {
        await backend.deleteItemAsync(countStorageKey);
        return backend.getItemAsync(normalizedKey);
      }

      const chunks = await Promise.all(
        Array.from({ length: chunkCount }, (_, index) =>
          backend.getItemAsync(chunkKey(key, index)),
        ),
      );
      return chunks.every((chunk) => chunk !== null) ? chunks.join("") : null;
    },

    async setItem(key: string, value: string) {
      const normalizedKey = normalizeSecureStoreKey(key);
      const countStorageKey = chunkCountKey(key);
      const previousCount = validChunkCount(
        await backend.getItemAsync(countStorageKey),
      );
      const chunks =
        value.match(new RegExp(`.{1,${chunkSize}}`, "gs")) || [""];

      await Promise.all(
        chunks.map((chunk, index) =>
          backend.setItemAsync(chunkKey(key, index), chunk),
        ),
      );
      await backend.setItemAsync(countStorageKey, String(chunks.length));
      await backend.deleteItemAsync(normalizedKey);

      if (previousCount && previousCount > chunks.length) {
        await Promise.all(
          Array.from(
            { length: previousCount - chunks.length },
            (_, index) =>
              backend.deleteItemAsync(chunkKey(key, chunks.length + index)),
          ),
        );
      }
    },

    async removeItem(key: string) {
      const normalizedKey = normalizeSecureStoreKey(key);
      const countStorageKey = chunkCountKey(key);
      const chunkCount =
        validChunkCount(await backend.getItemAsync(countStorageKey)) || 0;

      await Promise.all([
        backend.deleteItemAsync(normalizedKey),
        backend.deleteItemAsync(countStorageKey),
        ...Array.from({ length: chunkCount }, (_, index) =>
          backend.deleteItemAsync(chunkKey(key, index)),
        ),
      ]);
    },
  };
}
