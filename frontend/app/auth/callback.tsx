import { useTranslation } from 'react-i18next';
import { localizeMessage } from '../../src/i18n/localize';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { exchangeAuthCode } from '../../src/lib/authRecovery';
import { authErrorMessage } from '../../src/lib/authErrors';
import { Colors } from '../../src/constants/colors';
import { Spacing } from '../../src/constants/spacing';
import { Typography } from '../../src/constants/typography';
import { PrimaryButton } from '../../src/components/common/Buttons';
import { useTheme } from '../../src/contexts/ThemeContext';

export default function AuthCallbackScreen() {
  useTheme();
  const { t } = useTranslation();

  const params = useLocalSearchParams<{
    code?: string | string[];
    flowId?: string | string[];
    sb_flow_id?: string | string[];
    error?: string | string[];
    error_description?: string | string[];
  }>();
  const firstParam = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
  const code = firstParam(params.code) ?? null;
  const flowId = firstParam(params.flowId) ?? firstParam(params.sb_flow_id) ?? null;
  const providerError = firstParam(params.error_description) ?? firstParam(params.error) ?? null;
  const { isRecovery } = useAuth();
  const [result, setResult] = useState<{ code: string; error: string | null } | null>(null);
  const complete = Boolean(code && result?.code === code && !result.error);
  const feedback = !code ? (providerError ? authErrorMessage(new Error(providerError)) : t("errors.invalidLink")) : result?.code === code ? result.error : null;
  const router = useRouter();
  useEffect(() => {
    let alive = true;
    // PKCE validates the code against this installation's stored verifier. Never log params.
    if (!code || providerError) return;
    void exchangeAuthCode(code, flowId).then(() => {
      if (alive) setResult({ code, error: null });
    }).catch(error => {
      if (!alive) return;
      const details = error as { name?: unknown; code?: unknown; status?: unknown } | null;
      if (__DEV__) console.error('[auth] PKCE callback exchange failed.', {
        name: typeof details?.name === 'string' ? details.name : null,
        code: typeof details?.code === 'string' ? details.code : null,
        status: typeof details?.status === 'number' ? details.status : null,
        flowIdProvided: Boolean(flowId),
      });
      setResult({ code, error: authErrorMessage(error) });
    });
    return () => { alive = false; };
  }, [code, flowId, providerError]);
  if (complete) return <Redirect href={isRecovery ? '/reset-password' : '/(tabs)'} />;
  return <View style={{ flex: 1, justifyContent: 'center', padding: Spacing.screenPadding, backgroundColor: Colors.background, gap: Spacing.lg }}>
    {feedback ? <><Text accessibilityRole="alert" style={{ ...Typography.body, color: Colors.error }}>{localizeMessage(feedback)}</Text><PrimaryButton title={t("auth.backToLogin")} onPress={() => router.replace('/login')} /></> : <ActivityIndicator color={Colors.primary} accessibilityLabel={t("auth.verifying")} />}
  </View>;
}
