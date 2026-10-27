import { useTranslation } from 'react-i18next';
import { localizeMessage } from '../src/i18n/localize';
import React, { useRef, useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../src/contexts/AuthContext';
import { authErrorMessage } from '../src/lib/authErrors';
import { Colors } from '../src/constants/colors';
import { Spacing } from '../src/constants/spacing';
import { Typography } from '../src/constants/typography';
import { AppHeader } from '../src/components/common/AppHeader';
import { AppTextInput } from '../src/components/common/AppTextInput';
import { PrimaryButton, TextButton } from '../src/components/common/Buttons';

export default function ResetPasswordScreen() {
  const { t } = useTranslation();

  const { isRecovery, session, finishRecovery, signOut, isAuthenticated } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const pending = useRef(false);
  const authorized = isRecovery && Boolean(session);
  const submit = async () => {
    if (pending.current || !authorized) return;
    if (password.length < 8) { setFeedback("validation.passwordLength"); return; }
    if (password !== confirmation) { setFeedback("validation.passwordMatch"); return; }
    pending.current = true; setBusy(true); setFeedback('');
    try { await finishRecovery(password); setPassword(''); setConfirmation(''); setDone(true); }
    catch (error) { setFeedback(authErrorMessage(error)); }
    finally { pending.current = false; setBusy(false); }
  };
  const cancel = async () => {
    if (pending.current) return;
    pending.current = true; setBusy(true);
    try { if (isRecovery) await signOut(); router.replace('/login'); }
    catch (error) { setFeedback(authErrorMessage(error)); }
    finally { pending.current = false; setBusy(false); }
  };
  return <View style={{ flex: 1, backgroundColor: Colors.white }}>
    <AppHeader title={t("auth.reset")} showBack={false} />
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: Spacing.screenPadding, paddingBottom: insets.bottom + Spacing.xl, gap: Spacing.md }}>
        <Text style={{ ...Typography.largeTitle, color: Colors.textPrimary }}>{t("auth.resetTitle")}</Text>
        {done ? <><Text style={{ ...Typography.body, color: Colors.success }}>{t("auth.passwordUpdated")}</Text><PrimaryButton title={t("common.continue")} onPress={() => router.replace(isAuthenticated ? '/(tabs)' : '/login')} /></> : authorized ? <>
          <AppTextInput label={t("auth.newPassword")} value={password} onChangeText={setPassword} secureTextEntry leftIcon="lock-closed-outline" />
          <AppTextInput label={t("auth.confirmPassword")} value={confirmation} onChangeText={setConfirmation} secureTextEntry leftIcon="lock-closed-outline" />
          <PrimaryButton title={t("auth.updatePassword")} onPress={submit} loading={busy} />
          <TextButton title={t("common.cancel")} onPress={cancel} disabled={busy} />
        </> : <><Text style={{ ...Typography.body, color: Colors.textSecondary }}>{t("auth.openRecovery")}</Text><PrimaryButton title={t("auth.backToLogin")} onPress={cancel} loading={busy} /></>}
        {feedback ? <Text accessibilityRole="alert" style={{ ...Typography.body, color: Colors.error }}>{localizeMessage(feedback)}</Text> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  </View>;
}
