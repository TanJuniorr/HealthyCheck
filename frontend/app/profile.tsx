import { useTranslation } from 'react-i18next';
import { ageFromBirthDate, healthDecimal } from '../src/lib/healthOnboarding';
import { formatNumber } from '../src/i18n/formatting';
import { localizeMessage } from '../src/i18n/localize';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Image } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../src/constants/colors';
import { Typography } from '../src/constants/typography';
import { Spacing, Radius, Shadows } from '../src/constants/spacing';
import { AppHeader, SectionHeader } from '../src/components/common/AppHeader';
import { ScreenContainer } from '../src/components/common/ScreenContainer';
import { TextButton } from '../src/components/common/Buttons';
import { PersonalProfileModal, HealthGoalsModal, formatBirthDate, type EditableHealthGoals, type PersonalProfileDraft } from '../src/components/profile/ProfileEditModals';
import { MockAvatar } from '../src/components/common/MockAvatar';
import { SettingsRow } from '../src/components/health/HealthComponents';
import { useAuth } from '../src/contexts/AuthContext';
import { displayName, initials, profileText } from '../src/lib/profileRepository';
import { useHealthQuery } from '../src/hooks/useHealthQuery';
import { createGoals, getCurrentGoals } from '../src/services/healthGoalsService';
import { addWeightRecord, getLatestWeight } from '../src/services/weightService';
import { updateMyProfile, ensureMyProfile } from '../src/services/profileService';
import { DataFeedback } from '../src/components/common/DataFeedback';
import { authErrorMessage } from '../src/lib/authErrors';
import * as ImagePicker from 'expo-image-picker';
import { uploadAvatar, createAvatarSignedUrl, deleteAvatar } from '../src/services/avatarService';
import { DataAccessError, dataError } from '../src/lib/dataErrors';
import { toLocalDateKey } from '../src/lib/dateUtils';
import { useThemedStyles } from '../src/contexts/ThemeContext';

export default function ProfileScreen() {
  const styles = useThemedStyles(baseStyles);
  const { t } = useTranslation();

  const router = useRouter();

  const { user, profile, profileLoading, profileError, refreshProfile, signOut } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [avatarBusy,setAvatarBusy] = useState(false);
  const [personalEditorOpen, setPersonalEditorOpen] = useState(false);
  const [goalsEditorOpen, setGoalsEditorOpen] = useState(false);
  const submittingRef = useRef(false);
  const avatarLock = useRef(false);
  const records = useHealthQuery(async () => { const [goals,weight] = await Promise.all([getCurrentGoals(),getLatestWeight()]); return { goals,weight }; },'profile-health');
  const hasName = Boolean(profile?.full_name?.trim() || (typeof user?.user_metadata.full_name === 'string' && user.user_metadata.full_name.trim()));
  const name = hasName ? displayName(user,profile) : t('profile.member');
  const avatar = profileText(profile, 'avatar_url');
  const avatarQuery = useHealthQuery(async () => {
    if (!avatar) return null;
    return /^https:\/\//i.test(avatar) ? avatar : createAvatarSignedUrl(avatar);
  },'profile-avatar:'+String(user?.id ?? 'signed-out')+':'+String(avatar ?? 'none'));
  const avatarImageUrl = avatarQuery.data;
  const height = profile?.height_cm ?? '—';
  const birthDate = profileText(profile, 'date_of_birth') ?? '—';
  const personalDraft = useMemo<PersonalProfileDraft>(() => {
    const metadataName = user?.user_metadata.full_name;
    return {
      fullName: profile?.full_name ?? (typeof metadataName === 'string' ? metadataName : ''),
      dateOfBirth: birthDate === '—' ? '' : birthDate,
      heightCm: height === '—' ? '' : String(height),
      weightKg: records.data?.weight?.weight_kg == null ? '' : String(records.data.weight.weight_kg),
      gender: profile?.gender ?? '',
    };
  }, [birthDate, height, profile?.full_name, profile?.gender, records.data?.weight?.weight_kg, user?.user_metadata.full_name]);
  const goalsDraft = useMemo(() => ({
    daily_steps: records.data?.goals?.daily_steps ?? 8000,
    daily_calories: records.data?.goals?.daily_calories ?? 2000,
    daily_water_ml: records.data?.goals?.daily_water_ml ?? 2000,
    target_sleep_minutes: records.data?.goals?.target_sleep_minutes ?? 480,
  }), [records.data?.goals]);
  // Refresh on focus; provider fetches once on session restoration as well.
  useFocusEffect(useCallback(() => { void refreshProfile(); }, [refreshProfile]));
  const handlePickAvatar = async () => {
    if (!user || avatarLock.current) return;
    avatarLock.current = true;
    setAvatarBusy(true);
    setFeedback('');
    let uploadedPath: string | null = null;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes:['images'],allowsEditing:true,aspect:[1,1],quality:0.72,base64:true });
      if (result.canceled) return;
      const image = result.assets[0];
      if (!image?.base64 || (image.fileSize != null && image.fileSize > 4 * 1024 * 1024)) {
        setFeedback(t('profile.avatarTooLarge'));
        return;
      }
      if (!profile) await ensureMyProfile();
      uploadedPath = await uploadAvatar(image.base64);
      try {
        await updateMyProfile({ avatar_url:uploadedPath });
      } catch (error) {
        await deleteAvatar(uploadedPath).catch(() => {});
        uploadedPath = null;
        throw error;
      }
      await refreshProfile();
      setAvatarFailed(false);
      setFeedback(t('profile.avatarSaved'));
      const oldPath = avatar?.startsWith(`${user.id}/`) ? avatar : null;
      if (oldPath && oldPath !== uploadedPath) void deleteAvatar(oldPath).catch(() => {});
    } catch (error) {
      if (uploadedPath) await deleteAvatar(uploadedPath).catch(() => {});
      setFeedback(dataError(error).message || t('profile.avatarSaveFailed'));
    } finally {
      avatarLock.current = false;
      setAvatarBusy(false);
    }
  };
  const handleSignOut = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsSigningOut(true);
    setFeedback('');
    try { await signOut(); }
    catch (error) { setFeedback(authErrorMessage(error)); }
    finally { submittingRef.current = false; setIsSigningOut(false); }
  };
  const handleSavePersonal = async (draft: PersonalProfileDraft) => {
    if (!user) throw new Error('Vui lòng đăng nhập để cập nhật hồ sơ.');
    const heightValue = draft.heightCm.trim() ? healthDecimal(draft.heightCm) : null;
    const weightValue = draft.weightKg.trim() ? healthDecimal(draft.weightKg) : null;
    if ((draft.heightCm.trim() && heightValue===null) || (draft.weightKg.trim() && weightValue===null)) throw new DataAccessError('INVALID_INPUT',t('profile.invalidPersonal'));
    if (heightValue !== null && (!Number.isFinite(heightValue) || heightValue < 30 || heightValue > 300)) throw new DataAccessError('INVALID_INPUT', t('profile.invalidPersonal'));
    if (draft.fullName.trim().length > 120) throw new DataAccessError('INVALID_INPUT', t('profile.invalidPersonal'));
    if (weightValue !== null && (!Number.isFinite(weightValue) || weightValue <= 0 || weightValue > 500)) throw new DataAccessError('INVALID_INPUT', t('profile.invalidPersonal'));
    await ensureMyProfile();
    await updateMyProfile({
      full_name: draft.fullName.trim() || null,
      date_of_birth: draft.dateOfBirth || null,
      height_cm: heightValue,
      gender: draft.gender || null,
    });
    const previousWeight = Number(records.data?.weight?.weight_kg);
    if (weightValue !== null && (!Number.isFinite(previousWeight) || Math.abs(previousWeight - weightValue) > 0.001)) {
      await addWeightRecord({ weight_kg: weightValue });
    }
    await Promise.all([refreshProfile(), records.refresh()]);
  };
  const handleSaveGoals = async (values: EditableHealthGoals) => {
    await createGoals({ ...values, effective_from: toLocalDateKey() });
    await records.refresh();
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
        {feedback ? <Text accessibilityRole={feedback === t('profile.avatarSaved') ? undefined : 'alert'} style={{ color:feedback === t('profile.avatarSaved') ? Colors.success : Colors.error }}>{localizeMessage(feedback)}</Text> : null}
        {(avatarQuery.error && avatar) ? <Text accessibilityRole="alert" style={{ color:Colors.error }}>{localizeMessage(avatarQuery.error)}</Text> : null}
        {/* Profile Header Card */}
        <View style={styles.headerCard}>
          <View style={styles.avatarWrapper}>
            {avatarImageUrl && !avatarFailed ? (
              <Image source={{ uri: avatarImageUrl }} style={{ width: 80, height: 80, borderRadius: 40 }} onError={() => setAvatarFailed(true)} accessibilityLabel={t("profile.avatar")} />
            ) : <MockAvatar initials={initials(name)} size={80} />}
            <TouchableOpacity style={styles.editAvatarBadge} activeOpacity={0.8} onPress={handlePickAvatar} disabled={avatarBusy} accessibilityRole="button" accessibilityLabel={t('profile.changeAvatar')}>
              {avatarBusy ? <ActivityIndicator size="small" color={Colors.white} /> : <Ionicons name="camera" size={14} color={Colors.white} />}
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
        <SectionHeader title={t("profile.personal")} actionText={t('common.edit')} onAction={() => setPersonalEditorOpen(true)} />
        <View style={styles.personalInfoGrid}>
          <View style={styles.infoBox}>
            <View style={[styles.infoIconBg, { backgroundColor: Colors.primaryLight }]}>
              <Ionicons name="calendar-outline" size={18} color={Colors.primary} />
            </View>
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>{t("profile.birthDate")}</Text>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={styles.infoValue}>{birthDate === '—' ? birthDate : formatBirthDate(birthDate)}</Text>
              <Text style={styles.infoLabel}>{t('onboarding.age',{value:formatNumber(ageFromBirthDate(birthDate))})}</Text>
            </View>
          </View>

          <View style={styles.infoBox}>
            <View style={[styles.infoIconBg, { backgroundColor: Colors.blueLight }]}>
              <Ionicons name="resize-outline" size={18} color={Colors.blue} />
            </View>
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>{t("health.height")}</Text>
              <Text numberOfLines={1} style={styles.infoValue}>
                {formatNumber(height)} <Text style={styles.infoUnit}>cm</Text>
              </Text>
            </View>
          </View>

          <View style={styles.infoBox}>
            <View style={[styles.infoIconBg, { backgroundColor: Colors.orangeLight }]}>
              <Ionicons name="scale-outline" size={18} color={Colors.orange} />
            </View>
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>{t("health.weight")}</Text>
              <Text numberOfLines={1} style={styles.infoValue}>
                {formatNumber(records.data?.weight?.weight_kg)} <Text style={styles.infoUnit}>kg</Text>
              </Text>
            </View>
          </View>

          <View style={styles.infoBox}>
            <View style={[styles.infoIconBg, { backgroundColor: Colors.purpleLight }]}>
              <Ionicons name="person-outline" size={18} color={Colors.purple} />
            </View>
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>{t("health.gender")}</Text>
              <Text numberOfLines={1} style={styles.infoValue}>{profile?.gender ? t(`profile.genderOptions.${profile.gender}`) : '—'}</Text>
            </View>
          </View>
        </View>

        {/* Daily Goals Section */}
        <SectionHeader title={t("profile.dailyGoals")} actionText={t('common.edit')} onAction={() => setGoalsEditorOpen(true)} />
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
      {personalEditorOpen ? <PersonalProfileModal
          visible
          initial={personalDraft}
          onClose={() => setPersonalEditorOpen(false)}
          onSave={handleSavePersonal}
        /> : null}
      {goalsEditorOpen ? <HealthGoalsModal
          visible
          initial={goalsDraft}
          onClose={() => setGoalsEditorOpen(false)}
          onSave={handleSaveGoals}
        /> : null}
    </View>
  );
}

const baseStyles = StyleSheet.create({
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
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  infoBox: {
    flexGrow: 1,
    flexBasis: '47%',
    minHeight: 68,
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    ...Shadows.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  infoIconBg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
    flexShrink: 0,
  },
  infoTextContainer: {
    flex: 1,
    minWidth: 0,
  },
  infoLabel: {
    ...Typography.labelSmall,
    color: Colors.textMuted,
    fontSize: 11,
    marginBottom: 2,
  },
  infoValue: {
    ...Typography.cardTitle,
    fontSize: 14,
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
