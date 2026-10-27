import { useTranslation } from 'react-i18next';
import { localizeMessage } from '../src/i18n/localize';
import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../src/constants/colors';
import { Typography } from '../src/constants/typography';
import { Spacing } from '../src/constants/spacing';
import { AppHeader } from '../src/components/common/AppHeader';
import { AppTextInput } from '../src/components/common/AppTextInput';
import { PrimaryButton } from '../src/components/common/Buttons';
import { sendRecoveryEmail } from '../src/lib/authRecovery';
import { authErrorMessage, isValidEmail } from '../src/lib/authErrors';

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();

  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState('');
  const submittingRef = useRef(false);
  const handleSendResetLink = async () => {
    if (submittingRef.current) return;
    const normalizedEmail = email.trim().toLowerCase();
    setFeedback('');
    if (!isValidEmail(normalizedEmail)) { setFeedback("validation.email"); return; }
    submittingRef.current = true; setIsSubmitting(true);
    try {
      await sendRecoveryEmail(normalizedEmail);
      setEmail(normalizedEmail);
      setIsSubmitted(true);
    } catch (error) { setFeedback(authErrorMessage(error)); }
    finally { submittingRef.current = false; setIsSubmitting(false); }
  };

  return (
    <View style={styles.screen}>
      <AppHeader title={t("auth.forgot")} showBack />

      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + Spacing.xl },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {feedback ? <Text accessibilityRole="alert" style={{ ...Typography.body, color: Colors.error, marginBottom: Spacing.md }}>{localizeMessage(feedback)}</Text> : null}
          {isSubmitted ? (
            /* Success confirmation state */
            <View style={styles.successContainer}>
              <View style={styles.successIconCircle}>
                <Ionicons name="mail-open-outline" size={44} color={Colors.primary} />
              </View>

              <Text style={styles.title}>{t("auth.checkEmail")}</Text>
              <Text style={styles.subtitle}>
                {t('auth.recoveryConfirmation',{ email:email || t('auth.yourEmail') })}
              </Text>

              <PrimaryButton
                title={t("auth.backToLogin")}
                onPress={() => router.push('/login')}
                style={styles.primaryActionButton}
              />

              <TouchableOpacity
                style={styles.resendButton}
                onPress={handleSendResetLink}
                disabled={isSubmitting}
                activeOpacity={0.7}
              >
                <Text style={styles.resendText}>{isSubmitting ? t("auth.sending") : t("auth.resend")}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* Form state */
            <View style={styles.formSection}>
              {/* Icon Visual */}
              <View style={styles.iconContainer}>
                <View style={styles.iconCircle}>
                  <Ionicons name="key-outline" size={36} color={Colors.primary} />
                </View>
              </View>

              {/* Title & instructions */}
              <View style={styles.headerContainer}>
                <Text style={styles.title}>{t("auth.resetTitle")}</Text>
                <Text style={styles.subtitle}>
                  {t("auth.resetDescription")}</Text>
              </View>

              {/* Email Input */}
              <AppTextInput
                label={t("auth.email")}
                placeholder="name@example.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                leftIcon="mail-outline"
              />

              {/* Action Button */}
              <PrimaryButton
                title={isSubmitting ? t("auth.sending") : t("auth.sendLink")}
                loading={isSubmitting}
                onPress={handleSendResetLink}
                style={styles.primaryActionButton}
              />

              {/* Back to Sign In Link */}
              <View style={styles.footerContainer}>
                <TouchableOpacity
                  style={styles.backToSignInButton}
                  onPress={() => router.push('/login')}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="arrow-back" size={16} color={Colors.textSecondary} />
                  <Text style={styles.footerLink}>{t("auth.backToLogin")}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.xl,
    justifyContent: 'center',
  },
  formSection: {
    width: '100%',
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  iconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D8F1EE',
  },
  headerContainer: {
    marginBottom: Spacing.xxl,
    alignItems: 'center',
  },
  title: {
    ...Typography.largeTitle,
    fontSize: 24,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: Spacing.sm,
  },
  primaryActionButton: {
    marginTop: Spacing.sm,
  },
  footerContainer: {
    alignItems: 'center',
    marginTop: Spacing.xl,
  },
  backToSignInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  footerLink: {
    ...Typography.buttonSmall,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  // Success state styles
  successContainer: {
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
  },
  successIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: '#D8F1EE',
  },
  emailHighlight: {
    color: Colors.primaryDark,
    fontWeight: '600',
  },
  resendButton: {
    marginTop: Spacing.lg,
    paddingVertical: Spacing.sm,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resendText: {
    ...Typography.buttonSmall,
    color: Colors.primary,
    fontWeight: '500',
  },
});
