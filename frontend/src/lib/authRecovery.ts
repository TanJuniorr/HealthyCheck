import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { authConfigurationError, supabase } from './supabase';

export function recoveryRedirectUrl() {
  return Platform.OS === 'web' ? Linking.createURL('/auth/callback') : 'healthycheck://auth/callback';
}

export function oauthRedirectUrl() {
  // Expo Go uses an exp:// URL; installed builds use the app scheme from app.json.
  return Linking.createURL('/auth/callback');
}

let pendingExchange: { code: string; promise: Promise<void> } | null = null;
// Share an in-flight exchange across Strict Mode effects; never replay a consumed code.
export function exchangeAuthCode(code: string): Promise<void> {
  if (pendingExchange?.code === code) return pendingExchange.promise;
  const promise = (async () => {
    if (authConfigurationError) throw new Error(authConfigurationError);
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    if (!data.session) throw new Error('Missing callback session');
    // AuthProvider receives PASSWORD_RECOVERY from the SDK's verified PKCE exchange.
  })();
  pendingExchange = { code, promise };
  void promise.finally(() => { if (pendingExchange?.promise === promise) pendingExchange = null; }).catch(() => {});
  return promise;
}

let sending = false;
let nextAllowedSend = 0;
export async function sendRecoveryEmail(email: string) {
  if (authConfigurationError) throw new Error(authConfigurationError);
  if (sending || Date.now() < nextAllowedSend) throw { status: 429 };
  sending = true;
  nextAllowedSend = Date.now() + 60_000;
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: recoveryRedirectUrl() });
    if (error) throw error;
  } finally { sending = false; }
}
