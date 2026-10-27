
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
import { supabase } from '../src/lib/supabase';

export default function SignUpScreen() {
  const router = useRouter();
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
      showFeedback('Vui lòng điền đầy đủ các trường.', 'error');
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(normalizedEmail)) {
      showFeedback('Email chưa đúng định dạng. Vui lòng kiểm tra lại.', 'error');
      return;
    }

    if (password.length < 6) {
      showFeedback('Mật khẩu cần có ít nhất 6 ký tự.', 'error');
      return;
    }

    if (password !== confirmPassword) {
      showFeedback('Mật khẩu xác nhận không khớp.', 'error');
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    showFeedback('Đang tạo tài khoản, vui lòng chờ...', 'info');

    try {
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: {
            full_name: normalizedName,
          },
        },
      });

      if (error) {
        console.error('Supabase signup error:', error);

        if (error.status === 429) {
          showFeedback(
            'Bạn đã thử đăng ký quá nhiều lần. Vui lòng chờ rồi thử lại, không bấm liên tục.',
            'error',
          );
        } else {
          showFeedback(error.message, 'error');
        }

        return;
      }

      if (!data.user) {
        showFeedback(
          'Chưa nhận được thông tin tài khoản. Vui lòng thử lại sau.',
          'error',
        );
        return;
      }

      if (!data.session) {
        showFeedback(
          'Yêu cầu đăng ký đã được xử lý. Hãy kiểm tra email để xác nhận tài khoản, sau đó đăng nhập.',
          'success',
        );

        return;
      }

      showFeedback('Đăng ký thành công! Đang chuyển đến ứng dụng...', 'success');
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Unexpected signup error:', error);

      showFeedback(
        error instanceof Error
          ? `Không thể đăng ký: ${error.message}`
          : 'Không thể kết nối máy chủ. Vui lòng thử lại sau.',
        'error',
      );
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
          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.subtitle}>
            Start your health journey today.
          </Text>
        </View>

        {/* Form */}
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

          {/* Terms */}
          <View style={styles.termsContainer}>
            <Text style={styles.termsText}>
              By creating an account, you agree to our{' '}
              <Text style={styles.termsHighlight}>Terms of Service</Text>
              {' '}and{' '}
              <Text style={styles.termsHighlight}>Privacy Policy</Text>.
            </Text>
          </View>

          {/* Feedback hiển thị trực tiếp trên web và mobile */}
          {feedback !== '' && (
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
                {feedback}
              </Text>
            </View>
          )}

          {/* Submit */}
          <PrimaryButton
            title={isSubmitting ? 'Đang tạo tài khoản...' : 'Create Account'}
            onPress={handleCreateAccount}
            style={styles.createButton}
            disabled={isSubmitting}
          />
        </View>

        {/* Footer */}
        <View style={styles.footerContainer}>
          <Text style={styles.footerText}>
            Already have an account?{' '}
          </Text>
          <TouchableOpacity
            disabled={isSubmitting}
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
