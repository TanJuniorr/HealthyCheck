import { useTranslation } from 'react-i18next';
import { formatNumber,formatDate } from '../src/i18n/formatting';
import { localizeMessage } from '../src/i18n/localize';
import React, { useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Image } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../src/constants/colors';
import { Typography } from '../src/constants/typography';
import { Spacing, Radius, Shadows } from '../src/constants/spacing';
import { AppHeader, SectionHeader } from '../src/components/common/AppHeader';
import { ScreenContainer } from '../src/components/common/ScreenContainer';
import { TextButton } from '../src/components/common/Buttons';
import { MockAvatar } from '../src/components/common/MockAvatar';
import { SettingsRow } from '../src/components/health/HealthComponents';
import { useAuth } from '../src/contexts/AuthContext';
import { displayName, initials, profileText } from '../src/lib/profileRepository';
import { useHealthQuery } from '../src/hooks/useHealthQuery';
import { getCurrentGoals } from '../src/services/healthGoalsService';
import { getLatestWeight } from '../src/services/weightService';
import { ensureMyProfile } from '../src/services/profileService';
import { DataFeedback } from '../src/components/common/DataFeedback';
import { authErrorMessage } from '../src/lib/authErrors';

export default function ProfileScreen() {
  const { t } = useTranslation();

  const router = useRouter();

  const { user, profile, profileLoading, profileError, refreshProfile, signOut } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [avatarFailed, setAvatarFailed] = useState(false);
  const submittingRef = useRef(false);
  const records = useHealthQuery(async () => { const [goals,weight] = await Promise.all([getCurrentGoals(),getLatestWeight()]); return { goals,weight }; },'profile-health');
  const hasName = Boolean(profile?.full_name?.trim() || (typeof user?.user_metadata.full_name === 'string' && user.user_metadata.full_name.trim()));
  const name = hasName ? displayName(user,profile) : t('profile.member');
  const avatar = profileText(profile, 'avatar_url');
  const height = profile?.height_cm ?? '—';
  const birthDate = profileText(profile, 'date_of_birth') ?? '—';
  // Refresh on focus; provider fetches once on session restoration as well.
  useFocusEffect(useCallback(() => { void refreshProfile(); }, [refreshProfile]));
  const handleSignOut = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsSigningOut(true);
    setFeedback('');
    try { await signOut(); }
    catch (error) { setFeedback(authErrorMessage(error)); }
    finally { submittingRef.current = false; setIsSigningOut(false); }
  };

  return (
    <View style={styles.container}>
      <AppHeader
        title={t("navigation.profile")}
        showBack
        rightIcon="settings-outline"
        onRightPress={() => router.push('/settings')}
      />

      <ScreenContainer>
        <DataFeedback {...records} />
        {profileLoading ? <ActivityIndicator color={Colors.primary} accessibilityLabel={t("profile.loading")} /> : null}
        {profileError ? <Text accessibilityRole="alert" style={{ color: Colors.error }}>{localizeMessage(profileError)}</Text> : null}
        {!profileLoading && !profileError && !profile ? <Text style={{ color: Colors.textSecondary }}>{t("profile.missing")}</Text> : null}
        {feedback ? <Text accessibilityRole="alert" style={{ color: Colors.error }}>{localizeMessage(feedback)}</Text> : null}
        {/* Profile Header Card */}
        <View style={styles.headerCard}>
          <View style={styles.avatarWrapper}>
            {avatar && /^https:\/\//i.test(avatar) && !avatarFailed ? (
              <Image source={{ uri: avatar }} style={{ width: 80, height: 80, borderRadius: 40 }} onError={() => setAvatarFailed(true)} accessibilityLabel={t("profile.avatar")} />
            ) : <MockAvatar initials={initials(name)} size={80} />}
            <TouchableOpacity style={styles.editAvatarBadge} activeOpacity={0.8}>
              <Ionicons name="camera" size={14} color={Colors.white} />
            </TouchableOpacity>
          </View>

          <Text style={styles.userName}>{name}</Text>
          <Text style={styles.userEmail}>{user?.email ?? '—'}</Text>

          <View style={styles.memberBadge}>
            <Ionicons name="shield-checkmark" size={14} color={Colors.primary} />
            <Text style={styles.memberBadgeText}>{t("profile.member")}</Text>
          </View>
        </View>

        {!profile && !profileLoading ? <TextButton title={t("profile.create")} onPress={async () => { try { await ensureMyProfile(); await refreshProfile(); } catch (error) { setFeedback(error instanceof Error ? error.message : "profile.createError"); } }} /> : null}
        {/* Personal Info Grid */}
        <SectionHeader title={t("profile.personal")} />
        <View style={styles.personalInfoGrid}>
          <View style={styles.infoBox}>
            <View style={[styles.infoIconBg, { backgroundColor: Colors.primaryLight }]}>
              <Ionicons name="calendar-outline" size={18} color={Colors.primary} />
            </View>
            <Text style={styles.infoLabel}>{t("profile.birthDate")}</Text>
            <Text style={styles.infoValue}>
              {birthDate === '—' ? birthDate : formatDate(birthDate)}
            </Text>
          </View>

          <View style={styles.infoBox}>
            <View style={[styles.infoIconBg, { backgroundColor: Colors.blueLight }]}>
              <Ionicons name="resize-outline" size={18} color={Colors.blue} />
            </View>
            <Text style={styles.infoLabel}>{t("health.height")}</Text>
            <Text style={styles.infoValue}>
              {formatNumber(height)} <Text style={styles.infoUnit}>cm</Text>
            </Text>
          </View>

          <View style={styles.infoBox}>
            <View style={[styles.infoIconBg, { backgroundColor: Colors.orangeLight }]}>
              <Ionicons name="scale-outline" size={18} color={Colors.orange} />
            </View>
            <Text style={styles.infoLabel}>{t("health.weight")}</Text>
            <Text style={styles.infoValue}>
              {formatNumber(records.data?.weight?.weight_kg)} <Text style={styles.infoUnit}>kg</Text>
            </Text>
          </View>

          <View style={styles.infoBox}>
            <View style={[styles.infoIconBg, { backgroundColor: Colors.purpleLight }]}>
              <Ionicons name="person-outline" size={18} color={Colors.purple} />
            </View>
            <Text style={styles.infoLabel}>{t("health.gender")}</Text>
            <Text style={styles.infoValue}>{'—'}</Text>
          </View>
        </View>

        {/* Daily Goals Section */}
        <SectionHeader title={t("profile.dailyGoals")} />
        <View style={styles.card}>
          {/* Steps */}
          <View style={styles.goalItem}>
            <View style={[styles.goalIconBg, { backgroundColor: Colors.primaryLight }]}>
              <Ionicons name="footsteps-outline" size={20} color={Colors.primary} />
            </View>
            <View style={styles.goalDetails}>
              <Text style={styles.goalTitle}>{t("health.steps")}</Text>
              <Text style={styles.goalSubtitle}>{t("profile.walking")}</Text>
            </View>
            <Text style={styles.goalValue}>
              {formatNumber(records.data?.goals?.daily_steps)} <Text style={styles.goalUnit}>{t("units.steps")}</Text>
            </Text>
          </View>

          {/* Calories */}
          <View style={styles.goalItem}>
            <View style={[styles.goalIconBg, { backgroundColor: Colors.orangeLight }]}>
              <Ionicons name="flame-outline" size={20} color={Colors.orange} />
            </View>
            <View style={styles.goalDetails}>
              <Text style={styles.goalTitle}>{t("calories.active")}</Text>
              <Text style={styles.goalSubtitle}>{t("profile.calorieTarget")}</Text>
            </View>
            <Text style={styles.goalValue}>
              {formatNumber(records.data?.goals?.daily_calories)} <Text style={styles.goalUnit}>kcal</Text>
            </Text>
          </View>

          {/* Water */}
          <View style={styles.goalItem}>
            <View style={[styles.goalIconBg, { backgroundColor: Colors.blueLight }]}>
              <Ionicons name="water-outline" size={20} color={Colors.blue} />
            </View>
            <View style={styles.goalDetails}>
              <Text style={styles.goalTitle}>{t("health.hydration")}</Text>
              <Text style={styles.goalSubtitle}>{t("profile.waterHint")}</Text>
            </View>
            <Text style={styles.goalValue}>
              {formatNumber(records.data?.goals?.daily_water_ml)} <Text style={styles.goalUnit}>ml</Text>
            </Text>
          </View>

          {/* Sleep */}
          <View style={[styles.goalItem, styles.goalItemLast]}>
            <View style={[styles.goalIconBg, { backgroundColor: Colors.purpleLight }]}>
              <Ionicons name="moon-outline" size={20} color={Colors.purple} />
            </View>
            <View style={styles.goalDetails}>
              <Text style={styles.goalTitle}>{t("health.sleep")}</Text>
              <Text style={styles.goalSubtitle}>{t("profile.sleepHint")}</Text>
            </View>
            <Text style={styles.goalValue}>
              {records.data?.goals?.target_sleep_minutes != null ? formatNumber((records.data.goals.target_sleep_minutes/60),1) : '—'} <Text style={styles.goalUnit}>{t("units.hours")}</Text>
            </Text>
          </View>
        </View>

        {/* Preferences & Quick Links */}
        <SectionHeader title={t("profile.preferences")} />
        <View style={styles.card}>
          <SettingsRow
            title={t("navigation.settings")}
            value={t("profile.config")}
            icon="options-outline"
            onPress={() => router.push('/settings')}
          />
          <SettingsRow
            title={t("schedule.title")}
            value={t("common.preview")}
            icon="alarm-outline"
            onPress={() => router.push('/sleep-schedule')}
          />
          <SettingsRow
            title={t("sharing.setup")}
            value={t("common.preview")}
            icon="people-outline"
            onPress={() => router.push('/sharing-setup')}
          />
        </View>

        {/* About Section */}
        <SectionHeader title={t("common.about")} />
        <View style={styles.card}>
          <SettingsRow
            title={t("common.appVersion")}
            value={t("common.buildVersion",{version:"1.0.0",build:42})}
            icon="information-circle-outline"
            showChevron={false}
          />
          <SettingsRow
            title={t("common.privacy")}
            icon="lock-closed-outline"
            onPress={() => Alert.alert(t("common.privacy"), t("profile.policy"))}
          />
          <SettingsRow
            title={t("common.terms")}
            icon="document-text-outline"
            onPress={() => Alert.alert(t("common.terms"), t("profile.terms"))}
          />
        </View>

        {/* Sign Out Action */}
        <View style={styles.signOutContainer}>
          <TextButton
            title={isSigningOut ? t("auth.signingOut") : t("auth.signOut")}
            disabled={isSigningOut}
            loading={isSigningOut}
            onPress={handleSignOut}
            color={Colors.error}
            style={styles.signOutButton}
          />
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
  headerCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    marginTop: Spacing.lg,
    ...Shadows.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: Spacing.md,
  },
  editAvatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: Colors.primary,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.white,
  },
  userName: {
    ...Typography.largeTitle,
    fontSize: 22,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  userEmail: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },
  memberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: '#D8F1EE',
  },
  memberBadgeText: {
    ...Typography.labelSmall,
    color: Colors.primaryDark,
    fontWeight: '600',
  },
  personalInfoGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  infoBox: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xs,
    alignItems: 'center',
    ...Shadows.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  infoIconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  infoLabel: {
    ...Typography.labelSmall,
    color: Colors.textMuted,
    fontSize: 11,
    marginBottom: 2,
  },
  infoValue: {
    ...Typography.cardTitle,
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  infoUnit: {
    ...Typography.labelSmall,
    fontSize: 10,
    color: Colors.textSecondary,
    fontWeight: '400',
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
  goalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  goalItemLast: {
    borderBottomWidth: 0,
  },
  goalIconBg: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  goalDetails: {
    flex: 1,
  },
  goalTitle: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  goalSubtitle: {
    ...Typography.supporting,
    color: Colors.textMuted,
    marginTop: 1,
  },
  goalValue: {
    ...Typography.cardTitle,
    fontSize: 15,
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  goalUnit: {
    ...Typography.supporting,
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '400',
  },
  signOutContainer: {
    alignItems: 'center',
    marginTop: Spacing.xxl,
    marginBottom: Spacing.xl,
  },
  signOutButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xxl,
  },
});
