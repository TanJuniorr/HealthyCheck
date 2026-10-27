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
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '../src/constants/colors';
import { Typography } from '../src/constants/typography';
import { Spacing, Radius } from '../src/constants/spacing';
import { AppTextInput } from '../src/components/common/AppTextInput';
import { PrimaryButton } from '../src/components/common/Buttons';
import { useAuth } from '../src/contexts/AuthContext';
import { authErrorMessage } from '../src/lib/authErrors';

export default function SignUpScreen() {
  const { t } = useTranslation();

  const router = useRouter();
  const { signUp, initializationError } = useAuth();
  const insets = useSafeAreaInsets();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'error' | 'success' | 'info'>('info');

  // Chặn nhiều lần bấm trước khi React kịp cập nhật state
  const submittingRef = useRef(false);

  const showFeedback = (
    message: string,
    type: 'error' | 'success' | 'info' = 'info',
  ) => {
    setFeedback(message);
    setFeedbackType(type);
  };

  const handleCreateAccount = async () => {
    if (submittingRef.current) return;

    const normalizedName = fullName.trim();
    const normalizedEmail = email.trim().toLowerCase();

    setFeedback('');

    if (!normalizedName || !normalizedEmail || !password || !confirmPassword) {
      showFeedback("validation.required", 'error');
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(normalizedEmail)) {
      showFeedback("validation.emailFormat", 'error');
      return;
    }

    if (password.length < 8) {
      showFeedback("validation.passwordLength", 'error');
      return;
    }

    if (password !== confirmPassword) {
      showFeedback("validation.passwordMatch", 'error');
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    showFeedback("auth.creatingWait", 'info');

    try {
      const hasSession = await signUp(normalizedName, normalizedEmail, password);
      if (!hasSession) {
        showFeedback("auth.confirmEmail", 'success');
      }
    } catch (error) {
      showFeedback(authErrorMessage(error), 'error');
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const feedbackColor =
    feedbackType === 'error'
      ? '#D93025'
      : feedbackType === 'success'
        ? '#188038'
        : Colors.textSecondary;

  return (
    <KeyboardAvoidingView
      style={styles.keyboardContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + Spacing.lg,
            paddingBottom: insets.bottom + Spacing.lg,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Brand */}
        <View style={styles.brandMarkContainer}>
          <View style={styles.brandBadge}>
            <Text style={styles.brandBadgeText}>HC</Text>
          </View>
          <Text style={styles.brandName}>Healthy Check</Text>
        </View>

        {/* Header */}
        <View style={styles.headerContainer}>
          <Text style={styles.title}>{t("auth.createTitle")}</Text>
          <Text style={styles.subtitle}>
            {t("auth.createDescription")}</Text>
        </View>

        {/* Form */}
        <View style={styles.formContainer}>
          <AppTextInput
            label={t("auth.fullName")}
            placeholder={t("auth.namePlaceholder")}
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
            leftIcon="person-outline"
          />

          <AppTextInput
            label={t("auth.email")}
            placeholder="alex.johnson@email.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            leftIcon="mail-outline"
          />

          <AppTextInput
            label={t("auth.password")}
            placeholder={t("auth.strongPassword")}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            leftIcon="lock-closed-outline"
          />

          <AppTextInput
            label={t("auth.confirmPassword")}
            placeholder={t("auth.confirmPlaceholder")}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoCapitalize="none"
            leftIcon="lock-closed-outline"
          />

          {/* Terms */}
          <View style={styles.termsContainer}>
            <Text style={styles.termsText}>
              {t("auth.agreePrefix")}{' '}
              <Text style={styles.termsHighlight}>{t("common.terms")}</Text>
              {' '}{t("auth.and")}{' '}
              <Text style={styles.termsHighlight}>{t("common.privacy")}</Text>.
            </Text>
          </View>

          {/* Feedback hiển thị trực tiếp trên web và mobile */}
          {(feedback !== '' || initializationError) && (
            <View
              accessibilityRole="alert"
              style={[
                styles.feedbackContainer,
                feedbackType === 'error' && styles.feedbackError,
                feedbackType === 'success' && styles.feedbackSuccess,
                feedbackType === 'info' && styles.feedbackInfo,
              ]}
            >
              {isSubmitting && (
                <ActivityIndicator
                  size="small"
                  color={Colors.primary}
                  style={styles.feedbackSpinner}
                />
              )}
              <Text style={[styles.feedbackText, { color: feedbackColor }]}>
                {localizeMessage(feedback || initializationError)}
              </Text>
            </View>
          )}

          {/* Submit */}
          <PrimaryButton
            title={isSubmitting ? t("auth.creating") : t("auth.createAccount")}
            onPress={handleCreateAccount}
            style={styles.createButton}
            disabled={isSubmitting}
            loading={isSubmitting}
          />
        </View>

        {/* Footer */}
        <View style={styles.footerContainer}>
          <Text style={styles.footerText}>
            {t("auth.hasAccount")}{' '}
          </Text>
          <TouchableOpacity
            disabled={isSubmitting}
            onPress={() => router.push('/login')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.footerLink}>{t("auth.signIn")}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.screenPadding,
    justifyContent: 'center',
  },
  brandMarkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  brandBadge: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm + 2,
  },
  brandBadgeText: {
    ...Typography.buttonSmall,
    color: Colors.white,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  brandName: {
    ...Typography.cardTitle,
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  headerContainer: {
    marginBottom: Spacing.xl,
  },
  title: {
    ...Typography.largeTitle,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  formContainer: {
    marginBottom: Spacing.lg,
  },
  termsContainer: {
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.xs,
  },
  termsText: {
    ...Typography.supporting,
    color: Colors.textSecondary,
    lineHeight: 19,
    textAlign: 'center',
  },
  termsHighlight: {
    color: Colors.primary,
    fontWeight: '600',
  },
  feedbackContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  feedbackError: {
    backgroundColor: '#FDECEC',
  },
  feedbackSuccess: {
    backgroundColor: '#E8F5E9',
  },
  feedbackInfo: {
    backgroundColor: '#F2F6FC',
  },
  feedbackSpinner: {
    marginRight: Spacing.sm,
  },
  feedbackText: {
    ...Typography.supporting,
    flex: 1,
    lineHeight: 20,
  },
  createButton: {
    marginTop: Spacing.xs,
  },
  footerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
  },
  footerText: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  footerLink: {
    ...Typography.body,
    color: Colors.primary,
    fontWeight: '600',
  },
});
