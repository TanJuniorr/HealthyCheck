import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import { Typography } from '../../src/constants/typography';
import { Spacing, Radius, Layout } from '../../src/constants/spacing';
import { PrimaryButton } from '../../src/components/common/Buttons';

interface SharingFeature {
  icon: string;
  title: string;
  description: string;
}

const SHARING_FEATURES: SharingFeature[] = [
  {
    icon: 'share-social',
    title: 'Share selected health summaries',
    description:
      'Choose which health indicators, daily activity totals, and trends you want to share with trusted individuals.',
  },
  {
    icon: 'shield-checkmark',
    title: 'Control what others can see',
    description:
      'You decide exactly what is visible. Specific metrics, sensitive logs, and private details stay protected.',
  },
  {
    icon: 'close-circle',
    title: 'Stop sharing whenever desired',
    description:
      'You can pause or permanently revoke access at any moment with a single tap. Sharing stops immediately.',
  },
];

export default function SharingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + Layout.tabBarHeight + Spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Visual Anchor */}
        <View style={styles.heroGraphicWrapper}>
          <View style={styles.heroOuterCircle}>
            <View style={styles.heroInnerCircle}>
              <Ionicons name="people" size={36} color={Colors.primary} />
            </View>
          </View>
        </View>

        {/* 1. Header Section */}
        <View style={styles.header}>
          <Text style={styles.title}>Sharing</Text>
          <Text style={styles.subtitle}>
            Securely share your health and activity summaries with family members, caregivers, or doctors.
          </Text>
        </View>

        {/* 2. Feature Explanations (Clean, Card-Free Layout) */}
        <View style={styles.featuresList}>
          {SHARING_FEATURES.map((feature, index) => (
            <View key={index} style={styles.featureItem}>
              <View style={styles.featureIconContainer}>
                <Ionicons name={feature.icon as any} size={22} color={Colors.primary} />
              </View>
              <View style={styles.featureTextContent}>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDescription}>{feature.description}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* 3. Primary Action & 4. Privacy Note */}
        <View style={styles.footerSection}>
          <PrimaryButton
            title="Start Sharing"
            onPress={() => router.push('/sharing-setup' as any)}
            style={styles.primaryButton}
          />

          <View style={styles.privacyNoteContainer}>
            <Ionicons
              name="lock-closed-outline"
              size={14}
              color={Colors.textMuted}
              style={styles.lockIcon}
            />
            <Text style={styles.privacyNoteText}>
              Your data is always under your control. No information is shared without your explicit permission.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.lg,
    justifyContent: 'space-between',
  },
  heroGraphicWrapper: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
    marginTop: Spacing.sm,
  },
  heroOuterCircle: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: 'rgba(14, 165, 164, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroInnerCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    marginBottom: Spacing.xxl,
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
  },
  title: {
    ...Typography.largeTitle,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.sm,
    lineHeight: 22,
  },
  featuresList: {
    marginBottom: Spacing.xxl,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.xxl,
  },
  featureIconContainer: {
    width: 44,
    height: 44,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.lg,
    borderWidth: 1,
    borderColor: '#D4EFEB',
  },
  featureTextContent: {
    flex: 1,
  },
  featureTitle: {
    ...Typography.cardTitle,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  featureDescription: {
    ...Typography.supporting,
    color: Colors.textSecondary,
    lineHeight: 19,
  },
  footerSection: {
    paddingTop: Spacing.md,
  },
  primaryButton: {
    marginBottom: Spacing.lg,
  },
  privacyNoteContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
    gap: 6,
  },
  lockIcon: {
    marginTop: 2,
  },
  privacyNoteText: {
    ...Typography.labelSmall,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 16,
    flex: 1,
  },
});
