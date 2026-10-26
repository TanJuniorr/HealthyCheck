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
import { Colors } from '../src/constants/colors';
import { Typography } from '../src/constants/typography';
import { Spacing, Radius } from '../src/constants/spacing';
import { AppTextInput } from '../src/components/common/AppTextInput';
import { PrimaryButton } from '../src/components/common/Buttons';

export default function SignUpScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleCreateAccount = () => {
    // Visual auth only — navigate directly to main tabs
    router.replace('/(tabs)');
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
          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.subtitle}>Start your health journey today.</Text>
        </View>

        {/* Input Form */}
        <View style={styles.formContainer}>
          <AppTextInput
            label="Full Name"
            placeholder="Alex Johnson"
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
            leftIcon="person-outline"
          />

          <AppTextInput
            label="Email Address"
            placeholder="alex.johnson@email.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            leftIcon="mail-outline"
          />

          <AppTextInput
            label="Password"
            placeholder="Create a strong password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            leftIcon="lock-closed-outline"
          />

          <AppTextInput
            label="Confirm Password"
            placeholder="Re-enter your password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoCapitalize="none"
            leftIcon="lock-closed-outline"
          />

          {/* Terms & Conditions Notice */}
          <View style={styles.termsContainer}>
            <Text style={styles.termsText}>
              By creating an account, you agree to our{' '}
              <Text style={styles.termsHighlight}>Terms of Service</Text> and{' '}
              <Text style={styles.termsHighlight}>Privacy Policy</Text>.
            </Text>
          </View>

          {/* Primary Create Account Button */}
          <PrimaryButton
            title="Create Account"
            onPress={handleCreateAccount}
            style={styles.createButton}
          />
        </View>

        {/* Bottom Sign In Link */}
        <View style={styles.footerContainer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <TouchableOpacity
            onPress={() => router.push('/login')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.footerLink}>Sign In</Text>
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
