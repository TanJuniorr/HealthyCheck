import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../src/constants/colors';
import { Typography } from '../src/constants/typography';
import { Spacing, Radius, Shadows } from '../src/constants/spacing';
import { AppHeader, SectionHeader } from '../src/components/common/AppHeader';
import { ScreenContainer } from '../src/components/common/ScreenContainer';
import { AppTextInput } from '../src/components/common/AppTextInput';
import { PrimaryButton } from '../src/components/common/Buttons';

interface DataCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  bgColor: string;
  enabled: boolean;
}

const PRIVACY_LEVELS = [
  {
    id: 'specific',
    title: 'Specific People',
    description: 'Only individuals you explicitly invite can view selected categories.',
    icon: 'lock-closed-outline',
  },
  {
    id: 'family',
    title: 'Family & Friends',
    description: 'Connected family circle can view high-level summaries and streaks.',
    icon: 'people-outline',
  },
  {
    id: 'community',
    title: 'Community',
    description: 'Contribute anonymized statistics to group wellness challenges.',
    icon: 'globe-outline',
  },
];

export default function SharingSetupScreen() {
  const router = useRouter();

  const [recipient, setRecipient] = useState('');
  const [privacyLevel, setPrivacyLevel] = useState('specific');

  const [categories, setCategories] = useState<DataCategory[]>([
    {
      id: 'steps',
      name: 'Steps & Activity',
      description: 'Daily step count, distance, active minutes',
      icon: 'walk-outline',
      color: Colors.primary,
      bgColor: Colors.primaryLight,
      enabled: true,
    },
    {
      id: 'sleep',
      name: 'Sleep Quality',
      description: 'Sleep duration, sleep score, and phases',
      icon: 'moon-outline',
      color: Colors.purple,
      bgColor: Colors.purpleLight,
      enabled: true,
    },
    {
      id: 'nutrition',
      name: 'Nutrition & Calories',
      description: 'Calorie summary and macronutrient totals',
      icon: 'restaurant-outline',
      color: Colors.orange,
      bgColor: Colors.orangeLight,
      enabled: false,
    },
    {
      id: 'heart',
      name: 'Heart Rate',
      description: 'Resting BPM and daily heart rate trends',
      icon: 'heart-outline',
      color: Colors.coral,
      bgColor: Colors.coralLight,
      enabled: true,
    },
    {
      id: 'cycle',
      name: 'Cycle Tracking',
      description: 'Cycle day, phase, and logged symptoms',
      icon: 'flower-outline',
      color: Colors.coral,
      bgColor: Colors.coralLight,
      enabled: false,
    },
  ]);

  const [notifyOnView, setNotifyOnView] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(false);

  const toggleCategory = (id: string) => {
    setCategories((prev) =>
      prev.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c))
    );
  };

  const handleStartSharing = () => {
    const activeCount = categories.filter((c) => c.enabled).length;
    Alert.alert(
      'Sharing Invitation Created',
      `You have invited ${recipient || 'your contact'} to view ${activeCount} health categories. Access can be revoked anytime.`,
      [{ text: 'Done', onPress: () => router.back() }]
    );
  };

  return (
    <View style={styles.container}>
      <AppHeader title="Sharing Setup" showBack />

      <ScreenContainer>
        {/* Intro Card */}
        <View style={styles.introCard}>
          <View style={styles.introIconWrapper}>
            <Ionicons name="share-social" size={24} color={Colors.primary} />
          </View>
          <View style={styles.introTextWrapper}>
            <Text style={styles.introTitle}>Share Your Health Journey</Text>
            <Text style={styles.introDescription}>
              Easily share vitals and wellness milestones with your doctor, coach, or loved ones.
            </Text>
          </View>
        </View>

        {/* Invite Recipient Section */}
        <SectionHeader title="Invite Recipient" />
        <View style={styles.card}>
          <AppTextInput
            label="Recipient Email or Name"
            placeholder="doctor@clinic.com or family member"
            value={recipient}
            onChangeText={setRecipient}
            keyboardType="email-address"
            autoCapitalize="none"
            leftIcon="person-add-outline"
            style={styles.inputSpacing}
          />
        </View>

        {/* Privacy Level Selector */}
        <SectionHeader title="Privacy Level" />
        <View style={styles.privacyContainer}>
          {PRIVACY_LEVELS.map((level) => {
            const isSelected = privacyLevel === level.id;
            return (
              <TouchableOpacity
                key={level.id}
                style={[styles.privacyCard, isSelected && styles.privacyCardSelected]}
                onPress={() => setPrivacyLevel(level.id)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.privacyIconWrapper,
                    isSelected && styles.privacyIconWrapperSelected,
                  ]}
                >
                  <Ionicons
                    name={level.icon as any}
                    size={20}
                    color={isSelected ? Colors.primary : Colors.textSecondary}
                  />
                </View>

                <View style={styles.privacyContent}>
                  <Text style={[styles.privacyTitle, isSelected && styles.privacyTitleSelected]}>
                    {level.title}
                  </Text>
                  <Text style={styles.privacyDescription}>{level.description}</Text>
                </View>

                <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
                  {isSelected && <View style={styles.radioDot} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Data Categories with Toggles */}
        <SectionHeader title="Data Categories to Share" />
        <View style={styles.card}>
          {categories.map((cat, idx) => {
            const isLast = idx === categories.length - 1;
            return (
              <View
                key={cat.id}
                style={[styles.categoryRow, isLast && styles.categoryRowLast]}
              >
                <View style={[styles.categoryIconBg, { backgroundColor: cat.bgColor }]}>
                  <Ionicons name={cat.icon as any} size={20} color={cat.color} />
                </View>

                <View style={styles.categoryInfo}>
                  <Text style={styles.categoryName}>{cat.name}</Text>
                  <Text style={styles.categoryDesc}>{cat.description}</Text>
                </View>

                <Switch
                  value={cat.enabled}
                  onValueChange={() => toggleCategory(cat.id)}
                  trackColor={{ false: Colors.border, true: Colors.primary }}
                  thumbColor={Colors.white}
                />
              </View>
            );
          })}
        </View>

        {/* Notification Preferences */}
        <SectionHeader title="Notification Preferences" />
        <View style={styles.card}>
          <View style={styles.prefRow}>
            <View style={styles.prefTextWrapper}>
              <Text style={styles.prefTitle}>Notify when viewed</Text>
              <Text style={styles.prefDescription}>
                Receive a notification when recipient checks your health data
              </Text>
            </View>
            <Switch
              value={notifyOnView}
              onValueChange={setNotifyOnView}
              trackColor={{ false: Colors.border, true: Colors.primary }}
              thumbColor={Colors.white}
            />
          </View>

          <View style={[styles.prefRow, styles.categoryRowLast]}>
            <View style={styles.prefTextWrapper}>
              <Text style={styles.prefTitle}>Weekly summary digest</Text>
              <Text style={styles.prefDescription}>
                Send an automated weekly health report via email
              </Text>
            </View>
            <Switch
              value={weeklyDigest}
              onValueChange={setWeeklyDigest}
              trackColor={{ false: Colors.border, true: Colors.primary }}
              thumbColor={Colors.white}
            />
          </View>
        </View>

        {/* Start Sharing CTA Button */}
        <View style={styles.actionContainer}>
          <PrimaryButton
            title="Start Sharing"
            onPress={handleStartSharing}
            style={styles.submitButton}
          />
        </View>

        {/* Privacy Notice */}
        <View style={styles.privacyNoticeContainer}>
          <Ionicons name="shield-checkmark-outline" size={18} color={Colors.primary} />
          <Text style={styles.privacyNoticeText}>
            Your health data is end-to-end encrypted. You can pause or revoke access at any time
            from your settings.
          </Text>
        </View>
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  introCard: {
    flexDirection: 'row',
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginTop: Spacing.lg,
    borderWidth: 1,
    borderColor: '#D8F1EE',
    gap: Spacing.md,
  },
  introIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  introTextWrapper: {
    flex: 1,
  },
  introTitle: {
    ...Typography.cardTitle,
    color: Colors.primaryDark,
    marginBottom: 4,
  },
  introDescription: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
    ...Shadows.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inputSpacing: {
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  privacyContainer: {
    gap: Spacing.sm,
  },
  privacyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  privacyCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  privacyIconWrapper: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  privacyIconWrapperSelected: {
    backgroundColor: Colors.white,
  },
  privacyContent: {
    flex: 1,
    paddingRight: Spacing.sm,
  },
  privacyTitle: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  privacyTitleSelected: {
    color: Colors.primaryDark,
  },
  privacyDescription: {
    ...Typography.supporting,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleSelected: {
    borderColor: Colors.primary,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  categoryRowLast: {
    borderBottomWidth: 0,
  },
  categoryIconBg: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  categoryInfo: {
    flex: 1,
    paddingRight: Spacing.sm,
  },
  categoryName: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  categoryDesc: {
    ...Typography.supporting,
    color: Colors.textMuted,
    marginTop: 2,
  },
  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  prefTextWrapper: {
    flex: 1,
    paddingRight: Spacing.md,
  },
  prefTitle: {
    ...Typography.body,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  prefDescription: {
    ...Typography.supporting,
    color: Colors.textMuted,
    marginTop: 2,
  },
  actionContainer: {
    marginTop: Spacing.xxl,
    marginBottom: Spacing.lg,
  },
  submitButton: {
    minHeight: 52,
  },
  privacyNoticeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: Radius.md,
    marginBottom: Spacing.xxl,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  privacyNoticeText: {
    ...Typography.labelSmall,
    color: Colors.textMuted,
    flex: 1,
    lineHeight: 17,
  },
});
