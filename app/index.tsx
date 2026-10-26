import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../src/constants/colors';
import { Typography } from '../src/constants/typography';
import { Spacing, Radius, Shadows } from '../src/constants/spacing';
import { PrimaryButton } from '../src/components/common/Buttons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom + Spacing.lg }]}>
      {/* Top Hero Section */}
      <View style={styles.heroSection}>
        <View style={styles.heroCard}>
          {/* Decorative concentric background rings */}
          <View style={styles.ringOuter}>
            <View style={styles.ringInner}>
              <View style={styles.iconCircle}>
                <Ionicons name="fitness-outline" size={54} color={Colors.primary} />
              </View>
            </View>
          </View>

          {/* Floating Health Badges */}
          <View style={[styles.floatingBadge, styles.badgeTopRight]}>
            <View style={[styles.badgeIconBg, { backgroundColor: Colors.coralLight }]}>
              <Ionicons name="heart" size={16} color={Colors.coral} />
            </View>
            <View>
              <Text style={styles.badgeLabel}>Heart Rate</Text>
              <Text style={styles.badgeValue}>72 bpm</Text>
            </View>
          </View>

          <View style={[styles.floatingBadge, styles.badgeBottomLeft]}>
            <View style={[styles.badgeIconBg, { backgroundColor: Colors.orangeLight }]}>
              <Ionicons name="flame" size={16} color={Colors.orange} />
            </View>
            <View>
              <Text style={styles.badgeLabel}>Daily Active</Text>
              <Text style={styles.badgeValue}>1,600 kcal</Text>
            </View>
          </View>

          <View style={[styles.floatingBadge, styles.badgeBottomRight]}>
            <View style={[styles.badgeIconBg, { backgroundColor: Colors.blueLight }]}>
              <Ionicons name="water" size={16} color={Colors.blue} />
            </View>
            <View>
              <Text style={styles.badgeLabel}>Hydration</Text>
              <Text style={styles.badgeValue}>2.5 L</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Middle Content Section */}
      <View style={styles.contentSection}>
        <View style={styles.brandTag}>
          <Ionicons name="leaf" size={14} color={Colors.primary} style={styles.brandIcon} />
          <Text style={styles.brandText}>HEALTHY CHECK</Text>
        </View>

        <Text style={styles.headline}>Your health, one day at a time.</Text>

        <Text style={styles.description}>
          Track your daily vitals, monitor activity, and build lasting healthy habits with
          personalized wellness insights.
        </Text>
      </View>

      {/* Bottom CTA Section */}
      <View style={styles.actionSection}>
        <PrimaryButton
          title="Get Started"
          onPress={() => router.replace('/(tabs)')}
          style={styles.primaryButton}
        />

        <TouchableOpacity
          style={styles.signInButton}
          onPress={() => router.push('/login')}
          activeOpacity={0.7}
        >
          <Text style={styles.signInText}>
            I already have an account <Text style={styles.signInHighlight}>Sign In</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.screenPadding,
    justifyContent: 'space-between',
  },
  heroSection: {
    flex: 1.25,
    justifyContent: 'center',
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  heroCard: {
    flex: 1,
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#D8F1EE',
  },
  ringOuter: {
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(14, 165, 164, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringInner: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(14, 165, 164, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.md,
  },
  floatingBadge: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.lg,
    ...Shadows.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  badgeTopRight: {
    top: 24,
    right: 18,
  },
  badgeBottomLeft: {
    bottom: 24,
    left: 18,
  },
  badgeBottomRight: {
    bottom: 24,
    right: 18,
  },
  badgeIconBg: {
    width: 30,
    height: 30,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  badgeLabel: {
    ...Typography.labelSmall,
    color: Colors.textMuted,
    fontSize: 10,
    lineHeight: 12,
  },
  badgeValue: {
    ...Typography.label,
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  contentSection: {
    paddingVertical: Spacing.md,
  },
  brandTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.full,
    alignSelf: 'flex-start',
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: '#D8F1EE',
  },
  brandIcon: {
    marginRight: 6,
  },
  brandText: {
    ...Typography.labelSmall,
    color: Colors.primaryDark,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  headline: {
    ...Typography.largeTitle,
    fontSize: 32,
    lineHeight: 38,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  description: {
    ...Typography.body,
    color: Colors.textSecondary,
    lineHeight: 24,
  },
  actionSection: {
    paddingTop: Spacing.lg,
  },
  primaryButton: {
    marginBottom: Spacing.md,
  },
  signInButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingVertical: Spacing.sm,
  },
  signInText: {
    ...Typography.buttonSmall,
    color: Colors.textSecondary,
    fontWeight: '400',
  },
  signInHighlight: {
    color: Colors.primary,
    fontWeight: '600',
  },
});
