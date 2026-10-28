import { useTranslation } from 'react-i18next';
import { localizeMessage } from '../src/i18n/localize';
import { LanguageSelector } from '../src/components/common/LanguageSelector';
import React, { useRef, useState } from 'react';
import { useAuth } from '../src/contexts/AuthContext';
import { authErrorMessage, isValidEmail } from '../src/lib/authErrors';
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
import { Spacing, Radius } from '../src/constants/spacing';
import { AppTextInput } from '../src/components/common/AppTextInput';
import { PrimaryButton } from '../src/components/common/Buttons';
import { useThemedStyles } from '../src/contexts/ThemeContext';

export default function LoginScreen() {
  const styles = useThemedStyles(baseStyles);
  const { t } = useTranslation();

  const router = useRouter();
  const { signIn, initializationError } = useAuth();
  const submittingRef = useRef(false);
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSignIn = async () => {
    if (submittingRef.current) return;
    const normalizedEmail = email.trim().toLowerCase();
    setFeedback('');
    if (!isValidEmail(normalizedEmail) || !password) {
      setFeedback("validation.login");
      return;
    }
    submittingRef.current = true;
    setIsSubmitting(true);
    try { await signIn(normalizedEmail, password); }
    catch (error) { setFeedback(authErrorMessage(error)); }
    finally { submittingRef.current = false; setIsSubmitting(false); }
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + Spacing.lg, paddingBottom: insets.bottom + Spacing.lg },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Brand Mark */}
        <View style={styles.brandMarkContainer}>
          <View style={styles.brandBadge}>
            <Text style={styles.brandBadgeText}>HC</Text>
          </View>
          <Text style={styles.brandName}>Healthy Check</Text>
        </View>

        {/* Header Titles */}
        <View style={styles.headerContainer}>
          <Text style={styles.title}>{t("auth.welcomeBack")}</Text>
          <Text style={styles.subtitle}>{t("auth.loginDescription")}</Text>
        </View>

        {/* Input Form */}
        <View style={styles.formContainer}>
          <AppTextInput
            label={t("auth.email")}
            placeholder="name@example.com"
            value={email}
            onChangeText={value => { setEmail(value); setFeedback(''); }}
            keyboardType="email-address"
            autoCapitalize="none"
            leftIcon="mail-outline"
          />

          <AppTextInput
            label={t("auth.password")}
            placeholder={t("auth.passwordPlaceholder")}
            value={password}
            onChangeText={value => { setPassword(value); setFeedback(''); }}
            secureTextEntry
            autoCapitalize="none"
            leftIcon="lock-closed-outline"
          />

          {/* Forgot Password Link */}
          <TouchableOpacity
            style={styles.forgotPasswordContainer}
            onPress={() => router.push('/forgot-password')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.forgotPasswordText}>{t("auth.forgotLink")}</Text>
          </TouchableOpacity>

          {/* Inline feedback also works on Expo Web; Alert.alert may be invisible there. */}
          {feedback || initializationError ? (
            <Text accessibilityRole="alert" style={styles.feedbackText}>
              {localizeMessage(feedback || initializationError)}
            </Text>
          ) : null}

          {/* Primary Sign In Button */}
          <PrimaryButton
            title={isSubmitting ? t("auth.signingIn") : t("auth.signIn")}
            onPress={handleSignIn}
            loading={isSubmitting}
            disabled={isSubmitting}
            style={styles.signInButton}
          />
        </View>

        {/* Divider */}
        <View style={styles.dividerContainer}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>{t("auth.socialSoon")}</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Social Login Buttons */}
        <View style={styles.socialContainer}>
          <TouchableOpacity
            style={[styles.socialButton, { opacity: 0.5 }]}
            disabled
            accessibilityState={{ disabled: true }}
            activeOpacity={0.7}
            accessibilityLabel={t("auth.google")}
          >
            <Ionicons name="logo-google" size={20} color="#DB4437" />
            <Text style={styles.socialButtonText}>Google</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.socialButton, { opacity: 0.5 }]}
            disabled
            accessibilityState={{ disabled: true }}
            activeOpacity={0.7}
            accessibilityLabel={t("auth.apple")}
          >
            <Ionicons name="logo-apple" size={20} color={Colors.textPrimary} />
            <Text style={styles.socialButtonText}>Apple</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.socialButton, { opacity: 0.5 }]}
            disabled
            accessibilityState={{ disabled: true }}
            activeOpacity={0.7}
            accessibilityLabel={t("auth.facebook")}
          >
            <Ionicons name="logo-facebook" size={20} color="#1877F2" />
            <Text style={styles.socialButtonText}>Facebook</Text>
          </TouchableOpacity>
        </View>

        <LanguageSelector compact />
        {/* Bottom Sign Up Link */}
        <View style={styles.footerContainer}>
          <Text style={styles.footerText}>{t("auth.noAccount")}{' '}</Text>
          <TouchableOpacity
            onPress={() => router.push('/signup')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.footerLink}>{t("auth.signUp")}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const baseStyles = StyleSheet.create({
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
    marginBottom: Spacing.xxl,
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
    marginBottom: Spacing.xxl,
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
    marginBottom: Spacing.xl,
  },
  forgotPasswordContainer: {
    alignSelf: 'flex-end',
    marginBottom: Spacing.xl,
    marginTop: -Spacing.xs,
    paddingVertical: Spacing.xs,
  },
  forgotPasswordText: {
    ...Typography.buttonSmall,
    color: Colors.primary,
    fontWeight: '500',
  },
  feedbackText: {
    ...Typography.body,
    color: '#B42318',
    backgroundColor: '#FEF3F2',
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  signInButton: {
    marginTop: Spacing.xs,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.xl,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    ...Typography.supporting,
    color: Colors.textMuted,
    paddingHorizontal: Spacing.md,
  },
  socialContainer: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.xxl,
  },
  socialButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    gap: Spacing.xs + 2,
  },
  socialButtonText: {
    ...Typography.buttonSmall,
    color: Colors.textPrimary,
    fontWeight: '600',
    fontSize: 13,
  },
  footerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
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
