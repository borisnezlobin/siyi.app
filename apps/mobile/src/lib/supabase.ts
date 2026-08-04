import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { AppState, Platform } from "react-native";
import "react-native-url-polyfill/auto";

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const supabasePublishableKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "missing-publishable-key";
const secureStoreChunkSize = 1800;

export const isSupabaseConfigured = Boolean(
  process.env.EXPO_PUBLIC_SUPABASE_URL &&
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);

const secureStorage = {
  async getItem(key: string) {
    const chunkCountValue = await SecureStore.getItemAsync(`${key}:count`);
    if (!chunkCountValue) return SecureStore.getItemAsync(key);

    const chunkCount = Number(chunkCountValue);
    const chunks = await Promise.all(
      Array.from({ length: chunkCount }, (_, index) =>
        SecureStore.getItemAsync(`${key}:${index}`),
      ),
    );
    return chunks.every((chunk) => chunk !== null) ? chunks.join("") : null;
  },
  async setItem(key: string, value: string) {
    const previousCount = Number(
      (await SecureStore.getItemAsync(`${key}:count`)) || "0",
    );
    const chunks = value.match(
      new RegExp(`.{1,${secureStoreChunkSize}}`, "gs"),
    ) || [""];

    await Promise.all(
      chunks.map((chunk, index) =>
        SecureStore.setItemAsync(`${key}:${index}`, chunk),
      ),
    );
    await SecureStore.setItemAsync(`${key}:count`, String(chunks.length));
    await SecureStore.deleteItemAsync(key);

    if (previousCount > chunks.length) {
      await Promise.all(
        Array.from(
          { length: previousCount - chunks.length },
          (_, index) =>
            SecureStore.deleteItemAsync(`${key}:${chunks.length + index}`),
        ),
      );
    }
  },
  async removeItem(key: string) {
    const chunkCount = Number(
      (await SecureStore.getItemAsync(`${key}:count`)) || "0",
    );
    await Promise.all([
      SecureStore.deleteItemAsync(key),
      SecureStore.deleteItemAsync(`${key}:count`),
      ...Array.from({ length: chunkCount }, (_, index) =>
        SecureStore.deleteItemAsync(`${key}:${index}`),
      ),
    ]);
  },
};

export const supabase = createClient(
  supabaseUrl,
  supabasePublishableKey,
  {
    auth: {
      storage: Platform.OS === "web" ? AsyncStorage : secureStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: "pkce",
    },
  },
);

if (Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
