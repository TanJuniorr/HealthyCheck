import "react-native-url-polyfill/auto";
import "expo-sqlite/localStorage/install";

import type { Database } from '../types/database';
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

function hasValidConfiguration(): boolean {
  if (!supabaseUrl || !supabasePublishableKey || supabasePublishableKey.startsWith('sb_secret_')) return false;
  try {
    const url = new URL(supabaseUrl);
    return Boolean(url.hostname) && ['https:', 'http:'].includes(url.protocol);
  } catch { return false; }
}
export const authConfigurationError = hasValidConfiguration() ? null
  : 'Cấu hình Supabase chưa hợp lệ. Vui lòng kiểm tra URL và publishable key.';

// Keep the UI available to explain missing configuration; auth actions fail closed.
export const supabase = createClient<Database>(authConfigurationError ? 'https://unconfigured.invalid' : supabaseUrl!, authConfigurationError ? 'unconfigured' : supabasePublishableKey!, {
  auth: {
    storage: localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});
