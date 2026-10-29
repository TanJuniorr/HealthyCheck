import { useTranslation } from 'react-i18next';
import { localizeStaticData } from '../src/i18n/localize';
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../src/constants/colors';
import { Typography } from '../src/constants/typography';
import { Spacing, Radius } from '../src/constants/spacing';
import { AppHeader, SectionHeader } from '../src/components/common/AppHeader';
import { ScreenContainer } from '../src/components/common/ScreenContainer';
import { AppTextInput } from '../src/components/common/AppTextInput';
import { PrimaryButton } from '../src/components/common/Buttons';
import { useThemedStyles } from '../src/contexts/ThemeContext';
import {
  createSharingInvite,
  getSharingInviteById,
  updateSharingInvite,
} from '../src/services/sharingService';
import type { PrivacyLevel } from '../src/types/database';
import { dataError } from '../src/lib/dataErrors';

interface CategoryItem {
  id: 'steps' | 'sleep' | 'nutrition' | 'heart' | 'cycle';
  name: string;
  description: string;
  icon: string;
  color: string;
  bgColor: string;
  enabled: boolean;
  disabled?: boolean;
}

const rawPRIVACY_LEVELS = [
  {
    id: 'specific',
    title: 'sharing.specific',
    description: 'sharing.specificHint',
    icon: 'lock-closed-outline',
  },
  {
    id: 'family',
    title: 'sharing.family',
    description: 'sharing.familyHint',
    icon: 'people-outline',
  },
  {
    id: 'community',
    title: 'sharing.community',
    description: 'sharing.communityHint',
    icon: 'globe-outline',
  },
];

export default function SharingSetupScreen() {
  const styles = useThemedStyles(baseStyles);
  const { t } = useTranslation();
  const PRIVACY_LEVELS = localizeStaticData(rawPRIVACY_LEVELS);

  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEditing = Boolean(id);

  const [isLoadingOldData, setIsLoadingOldData] = useState(isEditing);
  const [loadError, setLoadError] = useState('');
  const [recipient, setRecipient] = useState('');
  const [recipientError, setRecipientError] = useState('');
  const [privacyLevel, setPrivacyLevel] = useState<PrivacyLevel>('specific');
  const [isRevoked, setIsRevoked] = useState(false);

  const [categories, setCategories] = useState<CategoryItem[]>([
    {
      id: 'steps',
      name: 'sharing.steps',
      description: 'sharing.stepsHint',
      icon: 'walk-outline',
      color: Colors.primary,
      bgColor: Colors.primaryLight,
      enabled: true,
    },
    {
      id: 'sleep',
      name: 'sharing.sleep',
      description: 'sharing.sleepHint',
      icon: 'moon-outline',
      color: Colors.purple,
      bgColor: Colors.purpleLight,
      enabled: true,
    },
    {
      id: 'nutrition',
      name: 'sharing.nutrition',
      description: 'sharing.nutritionHint',
      icon: 'restaurant-outline',
      color: Colors.orange,
      bgColor: Colors.orangeLight,
      enabled: false,
    },
    {
      id: 'heart',
      name: 'sharing.heart',
      description: 'sharing.heartHint',
      icon: 'heart-outline',
      color: Colors.coral,
      bgColor: Colors.coralLight,
      enabled: false,
      disabled: true,
    },
    {
      id: 'cycle',
      name: 'sharing.cycle',
      description: 'sharing.cycleHint',
      icon: 'flower-outline',
      color: Colors.coral,
      bgColor: Colors.coralLight,
      enabled: false,
      disabled: true,
    },
  ]);

  const [notifyOnView, setNotifyOnView] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const submittingRef = useRef(false);

  // Load existing data if editing
  useEffect(() => {
    if (!id) return;
    let alive = true;

    async function loadData() {
      setIsLoadingOldData(true);
      setLoadError('');
      try {
        const record = await getSharingInviteById(id as string);
        if (!alive) return;
        if (!record) {
          setLoadError(t('sharing.loadError'));
          return;
        }

        setRecipient(record.recipient_email || record.recipient_label);
        setPrivacyLevel(record.privacy_level);
        setNotifyOnView(record.notify_on_view);
        setWeeklyDigest(record.weekly_digest);

        if (record.status === 'revoked') {
          setIsRevoked(true);
          setFormError(t('sharing.errorRevokedCannotEdit'));
        }

        setCategories((prev) =>
          prev.map((c) => {
            if (c.id === 'steps') return { ...c, enabled: record.share_steps };
            if (c.id === 'sleep') return { ...c, enabled: record.share_sleep };
            if (c.id === 'nutrition') return { ...c, enabled: record.share_nutrition };
            return { ...c, enabled: false, disabled: true };
          })
        );
      } catch (err) {
        if (!alive) return;
        setLoadError(dataError(err).message || t('sharing.loadError'));
      } finally {
        if (alive) setIsLoadingOldData(false);
      }
    }

    void loadData();
    return () => {
      alive = false;
    };
  }, [id, t]);

  const toggleCategory = (catId: CategoryItem['id']) => {
    setFormError('');
    setCategories((prev) =>
      prev.map((c) => {
        if (c.id === catId) {
          if (c.disabled) {
            setFormError(t('sharing.errorHeartCycleUnavailable'));
            return c;
          }
          return { ...c, enabled: !c.enabled };
        }
        return c;
      })
    );
  };

  const handleSave = async () => {
    if (submittingRef.current || isSaving || isRevoked) return;
    setFormError('');
    setRecipientError('');

    const trimmed = recipient.trim();
    if (!trimmed) {
      setRecipientError(t('sharing.errorRecipientRequired'));
      setFormError(t('sharing.errorRecipientRequired'));
      return;
    }
    if (trimmed.length > 120) {
      setRecipientError(t('sharing.errorRecipientTooLong'));
      setFormError(t('sharing.errorRecipientTooLong'));
      return;
    }

    if (trimmed.includes('@')) {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(trimmed)) {
        setRecipientError(t('sharing.errorInvalidEmail'));
        setFormError(t('sharing.errorInvalidEmail'));
        return;
      }
    } else if (trimmed.length < 2) {
      setRecipientError(t('sharing.errorRecipientTooShort'));
      setFormError(t('sharing.errorRecipientTooShort'));
      return;
    }

    const stepsEnabled = categories.find((c) => c.id === 'steps')?.enabled ?? false;
    const sleepEnabled = categories.find((c) => c.id === 'sleep')?.enabled ?? false;
    const nutritionEnabled = categories.find((c) => c.id === 'nutrition')?.enabled ?? false;

    if (!stepsEnabled && !sleepEnabled && !nutritionEnabled) {
      setFormError(t('sharing.errorNoCategorySelected'));
      return;
    }

    submittingRef.current = true;
    setIsSaving(true);

    try {
      if (isEditing && id) {
        await updateSharingInvite(id, {
          recipient: trimmed,
          privacy_level: privacyLevel,
          share_steps: stepsEnabled,
          share_sleep: sleepEnabled,
          share_nutrition: nutritionEnabled,
          share_heart: false,
          share_cycle: false,
          notify_on_view: notifyOnView,
          weekly_digest: weeklyDigest,
        });
      } else {
        await createSharingInvite({
          recipient: trimmed,
          privacy_level: privacyLevel,
          share_steps: stepsEnabled,
          share_sleep: sleepEnabled,
          share_nutrition: nutritionEnabled,
          share_heart: false,
          share_cycle: false,
          notify_on_view: notifyOnView,
          weekly_digest: weeklyDigest,
        });
      }

      router.back();
    } catch (err: any) {
      const msg = err?.message || '';
      const displayMsg = msg.startsWith('sharing.') ? t(msg) : dataError(err).message;
      setFormError(displayMsg);
    } finally {
      submittingRef.current = false;
      setIsSaving(false);
    }
  };

  if (isLoadingOldData) {
    return (
      <View style={styles.container}>
        <AppHeader title={t('sharing.editTitle')} showBack />
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={styles.container}>
        <AppHeader title={isEditing ? t('sharing.editTitle') : t('sharing.setup')} showBack />
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={36} color={Colors.coral} />
          <Text style={styles.errorText}>{loadError}</Text>
          <PrimaryButton
            title={t('sharing.retry')}
            onPress={() => router.replace('/(tabs)/sharing')}
            style={styles.retryButton}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppHeader
        title={isEditing ? t('sharing.editTitle') : t('sharing.setup')}
        showBack
      />

      <ScreenContainer>
        {/* Intro Card */}
        <View style={styles.introCard}>
          <View style={styles.introIconWrapper}>
            <Ionicons name="share-social" size={24} color={Colors.primary} />
          </View>
          <View style={styles.introTextWrapper}>
            <Text style={styles.introTitle}>{t('sharing.journey')}</Text>
            <Text style={styles.introDescription}>{t('sharing.journeyHint')}</Text>
          </View>
        </View>

        {/* Inline Global Error Banner */}
        {formError ? (
          <View style={styles.alertBanner} accessibilityRole="alert">
            <Ionicons name="alert-circle" size={18} color={Colors.coral} />
            <Text style={styles.alertBannerText}>{formError}</Text>
          </View>
        ) : null}

        {/* Invite Recipient Section */}
        <SectionHeader title={t('sharing.invite')} />
        <View style={styles.card}>
          <AppTextInput
            label={t('sharing.recipient')}
            placeholder={t('sharing.recipientPlaceholder')}
            value={recipient}
            onChangeText={(text) => {
              setRecipient(text);
              if (recipientError) setRecipientError('');
              if (formError) setFormError('');
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            leftIcon="person-add-outline"
            error={recipientError}
            style={styles.inputSpacing}
          />
        </View>

        {/* Privacy Level Selector */}
        <SectionHeader title={t('sharing.privacyLevel')} />
        <View style={styles.privacyContainer}>
          {PRIVACY_LEVELS.map((level) => {
            const isSelected = privacyLevel === level.id;
            return (
              <TouchableOpacity
                key={level.id}
                style={[styles.privacyCard, isSelected && styles.privacyCardSelected]}
                onPress={() => {
                  setPrivacyLevel(level.id as PrivacyLevel);
                  if (formError) setFormError('');
                }}
                activeOpacity={0.7}
                disabled={isRevoked || isSaving}
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
        <SectionHeader title={t('sharing.categories')} />
        <View style={styles.card}>
          {categories.map((cat, idx) => {
            const isLast = idx === categories.length - 1;
            return (
              <View
                key={cat.id}
                style={[
                  styles.categoryRow,
                  isLast && styles.categoryRowLast,
                  cat.disabled && styles.categoryRowDisabled,
                ]}
              >
                <View
                  style={[
                    styles.categoryIconBg,
                    { backgroundColor: cat.disabled ? Colors.divider : cat.bgColor },
                  ]}
                >
                  <Ionicons
                    name={cat.icon as any}
                    size={20}
                    color={cat.disabled ? Colors.textMuted : cat.color}
                  />
                </View>

                <View style={styles.categoryInfo}>
                  <Text
                    style={[
                      styles.categoryName,
                      cat.disabled && styles.categoryNameDisabled,
                    ]}
                  >
                    {t(cat.name)}
                  </Text>
                  <Text style={styles.categoryDesc}>
                    {cat.disabled ? t('sharing.categoryDemoNotice') : t(cat.description)}
                  </Text>
                </View>

                <Switch
                  value={cat.enabled}
                  disabled={cat.disabled || isRevoked || isSaving}
                  onValueChange={() => toggleCategory(cat.id)}
                  trackColor={{ false: Colors.border, true: Colors.primary }}
                  thumbColor={Colors.white}
                />
              </View>
            );
          })}
        </View>

        {/* Notification Preferences */}
        <SectionHeader title={t('sharing.notificationPreferences')} />
        <View style={styles.card}>
          <View style={styles.prefRow}>
            <View style={styles.prefTextWrapper}>
              <Text style={styles.prefTitle}>{t('sharing.viewed')}</Text>
              <Text style={styles.prefDescription}>{t('sharing.viewedHint')}</Text>
            </View>
            <Switch
              value={notifyOnView}
              disabled={isRevoked || isSaving}
              onValueChange={setNotifyOnView}
              trackColor={{ false: Colors.border, true: Colors.primary }}
              thumbColor={Colors.white}
            />
          </View>

          <View style={[styles.prefRow, styles.categoryRowLast]}>
            <View style={styles.prefTextWrapper}>
              <Text style={styles.prefTitle}>{t('sharing.weeklyDigest')}</Text>
              <Text style={styles.prefDescription}>{t('sharing.weeklyDigestHint')}</Text>
            </View>
            <Switch
              value={weeklyDigest}
              disabled={isRevoked || isSaving}
              onValueChange={setWeeklyDigest}
              trackColor={{ false: Colors.border, true: Colors.primary }}
              thumbColor={Colors.white}
            />
          </View>

          <View style={styles.prefNoteContainer}>
            <Text style={styles.prefNoteText}>{t('sharing.notificationSettingNote')}</Text>
          </View>
        </View>

        {/* CTA Button */}
        <View style={styles.actionContainer}>
          <PrimaryButton
            title={
              isSaving
                ? t('sharing.saving')
                : isEditing
                ? t('sharing.saveChanges')
                : t('sharing.start')
            }
            onPress={handleSave}
            loading={isSaving}
            disabled={isSaving || isRevoked}
            style={styles.submitButton}
          />
        </View>

        {/* Honest Privacy Notice */}
        <View style={styles.privacyNoticeContainer}>
          <Ionicons name="shield-checkmark-outline" size={18} color={Colors.primary} />
          <Text style={styles.privacyNoticeText}>{t('sharing.encryptionHint')}</Text>
        </View>
      </ScreenContainer>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centerLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  errorText: {
    ...Typography.body,
    color: Colors.coral,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: Spacing.md,
    minWidth: 160,
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
    borderRadius: 22,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  introTextWrapper: {
    flex: 1,
  },
  introTitle: {
    ...Typography.cardTitle,
    color: Colors.primary,
    marginBottom: 4,
  },
  introDescription: {
    ...Typography.supporting,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FDF2F2',
    borderWidth: 1,
    borderColor: '#F8B4B4',
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  alertBannerText: {
    ...Typography.supporting,
    color: Colors.coral,
    flex: 1,
    fontWeight: '500',
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inputSpacing: {
    marginBottom: 0,
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
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.md,
  },
  privacyCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: '#F4FAF9',
  },
  privacyIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  privacyIconWrapperSelected: {
    backgroundColor: Colors.primaryLight,
  },
  privacyContent: {
    flex: 1,
  },
  privacyTitle: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  privacyTitleSelected: {
    color: Colors.primary,
  },
  privacyDescription: {
    ...Typography.supporting,
    color: Colors.textMuted,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.border,
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
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    gap: Spacing.md,
  },
  categoryRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  categoryRowDisabled: {
    opacity: 0.65,
  },
  categoryIconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  categoryNameDisabled: {
    color: Colors.textMuted,
  },
  categoryDesc: {
    ...Typography.supporting,
    color: Colors.textMuted,
  },
  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
  },
  prefTextWrapper: {
    flex: 1,
    marginRight: Spacing.md,
  },
  prefTitle: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  prefDescription: {
    ...Typography.supporting,
    color: Colors.textMuted,
  },
  prefNoteContainer: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  prefNoteText: {
    ...Typography.supporting,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  actionContainer: {
    marginTop: Spacing.xl,
    marginBottom: Spacing.sm,
  },
  submitButton: {
    width: '100%',
  },
  privacyNoticeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.xl,
  },
  privacyNoticeText: {
    ...Typography.supporting,
    color: Colors.textMuted,
    textAlign: 'center',
    flex: 1,
  },
});
