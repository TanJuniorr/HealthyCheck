import React, { useState } from 'react';
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
import { AppHeader } from '../src/components/common/AppHeader';
import { AppTextInput } from '../src/components/common/AppTextInput';
import { PrimaryButton } from '../src/components/common/Buttons';
import { mockUser } from '../src/data/user';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState(mockUser.email);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSendResetLink = () => {
    // Visual feedback only
    setIsSubmitted(true);
  };

  return (
    <View style={styles.screen}>
      <AppHeader title="Forgot Password" showBack />

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
          {isSubmitted ? (
            /* Success confirmation state */
            <View style={styles.successContainer}>
              <View style={styles.successIconCircle}>
                <Ionicons name="mail-open-outline" size={44} color={Colors.primary} />
              </View>

              <Text style={styles.title}>Check your email</Text>
              <Text style={styles.subtitle}>
                We've sent a password reset link to{' '}
                <Text style={styles.emailHighlight}>{email || 'your email'}</Text>. Please follow
                the instructions in the email to reset your password.
              </Text>

              <PrimaryButton
                title="Back to Sign In"
                onPress={() => router.push('/login')}
                style={styles.primaryActionButton}
              />

              <TouchableOpacity
                style={styles.resendButton}
                onPress={() => setIsSubmitted(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.resendText}>Didn't receive an email? Try again</Text>
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
                <Text style={styles.title}>Reset your password</Text>
                <Text style={styles.subtitle}>
                  Enter the email associated with your account and we'll send you instructions to
                  reset your password.
                </Text>
              </View>

              {/* Email Input */}
              <AppTextInput
                label="Email Address"
                placeholder="name@example.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                leftIcon="mail-outline"
              />

              {/* Action Button */}
              <PrimaryButton
                title="Send Reset Link"
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
                  <Text style={styles.footerLink}>Back to Sign In</Text>
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
