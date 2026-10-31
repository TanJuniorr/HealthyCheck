
import { Platform } from "react-native";
import * as Linking from "expo-linking";
import { authConfigurationError, supabase } from "./supabase";

// --------------------------------------------------
// Callback URLs
// --------------------------------------------------

function getWebCallbackUrl(): string {
  return `${window.location.origin}/auth/callback`;
}

export function recoveryRedirectUrl(): string {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return getWebCallbackUrl();
  }

  return "healthycheck://auth/callback";
}

export function oauthRedirectUrl(): string {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return getWebCallbackUrl();
  }

  return Linking.createURL("/auth/callback");
}

// --------------------------------------------------
// Prevent duplicate PKCE exchanges
// --------------------------------------------------

type ExchangeCache = {
  code: string;
  flowId: string | null;
  promise: Promise<void>;
};

let lastExchange: ExchangeCache | null = null;

export function exchangeAuthCode(
  code: string,
  flowId?: string | null
): Promise<void> {
  const exchangeFlowId = flowId || null;

  // Reuse the existing promise for the same authorization code.
  if (
    lastExchange?.code === code &&
    lastExchange.flowId === exchangeFlowId
  ) {
    return lastExchange.promise;
  }

  const promise = (async () => {
    if (authConfigurationError) {
      throw new Error(authConfigurationError);
    }

    const { data, error } =
      await supabase.auth.exchangeCodeForSession(
        code,
        exchangeFlowId
          ? { flowId: exchangeFlowId }
          : undefined
      );

    if (error) {
      throw error;
    }

    if (!data.session) {
      throw new Error("Missing callback session");
    }
  })();

  // Cache the promise so the same code is never exchanged twice.
  lastExchange = {
    code,
    flowId: exchangeFlowId,
    promise,
  };

  return promise;
}

// --------------------------------------------------
// Password recovery
// --------------------------------------------------

let sending = false;
let nextAllowedSend = 0;

export async function sendRecoveryEmail(email: string) {
  if (authConfigurationError) {
    throw new Error(authConfigurationError);
  }

  if (sending || Date.now() < nextAllowedSend) {
    throw { status: 429 };
  }

  sending = true;
  nextAllowedSend = Date.now() + 60_000;

  try {
    const { error } =
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: recoveryRedirectUrl(),
      });

    if (error) {
      throw error;
    }
  } finally {
    sending = false;
  }
}
