
import "react-native-url-polyfill/auto";
import "expo-sqlite/localStorage/install";

import type { Database } from "../types/database";
import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

function hasValidConfiguration(): boolean {
  if (
    !supabaseUrl ||
    !supabasePublishableKey ||
    supabasePublishableKey.startsWith("sb_secret_")
  ) {
    return false;
  }

  try {
    const url = new URL(supabaseUrl);
    return (
      Boolean(url.hostname) &&
      ["https:", "http:"].includes(url.protocol)
    );
  } catch {
    return false;
  }
}

export const authConfigurationError = hasValidConfiguration()
  ? null
  : "Cấu hình Supabase chưa hợp lệ. Vui lòng kiểm tra URL và publishable key.";

// --------------------------------------------------
// Web storage
// --------------------------------------------------

function getBrowserStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const webAuthStorage = {
  async getItem(key: string): Promise<string | null> {
    return getBrowserStorage()?.getItem(key) ?? null;
  },

  async setItem(key: string, value: string): Promise<void> {
    const storage = getBrowserStorage();

    if (!storage) {
      throw new Error("Browser localStorage is unavailable.");
    }

    storage.setItem(key, value);
  },

  async removeItem(key: string): Promise<void> {
    getBrowserStorage()?.removeItem(key);
  },
};

// --------------------------------------------------
// Native storage (Android / iOS)
// --------------------------------------------------

const nativeAuthStorage = {
  async getItem(key: string): Promise<string | null> {
    const current = await AsyncStorage.getItem(key);

    if (current !== null) {
      return current;
    }

    // Migrate legacy values from expo-sqlite localStorage.
    const legacy = globalThis.localStorage?.getItem(key) ?? null;

    if (legacy !== null) {
      await AsyncStorage.setItem(key, legacy);
      globalThis.localStorage?.removeItem(key);
    }

    return legacy;
  },

  async setItem(key: string, value: string): Promise<void> {
    await AsyncStorage.setItem(key, value);
    globalThis.localStorage?.removeItem(key);
  },

  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
    globalThis.localStorage?.removeItem(key);
  },
};

// --------------------------------------------------
// Select storage by platform
// --------------------------------------------------

const authStorage =
  Platform.OS === "web"
    ? webAuthStorage
    : nativeAuthStorage;

// --------------------------------------------------
// Supabase client
// --------------------------------------------------

export const supabase = createClient<Database>(
  authConfigurationError
    ? "https://unconfigured.invalid"
    : supabaseUrl!,

  authConfigurationError
    ? "unconfigured"
    : supabasePublishableKey!,

  {
    auth: {
      storage: authStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: "pkce",
    },
  }
);
