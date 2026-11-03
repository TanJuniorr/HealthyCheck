import { useTranslation } from 'react-i18next';
import { ageFromBirthDate } from '../src/lib/healthOnboarding';
import { formatNumber } from '../src/i18n/formatting';
import { localizeMessage } from '../src/i18n/localize';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Image } from 'react-native';
import { useFocusEffect, useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../src/constants/colors';
import { Typography } from '../src/constants/typography';
import { Spacing, Radius, Shadows } from '../src/constants/spacing';
import { AppHeader, SectionHeader } from '../src/components/common/AppHeader';
import { ScreenContainer } from '../src/components/common/ScreenContainer';
import { TextButton } from '../src/components/common/Buttons';
import { PersonalProfileModal, formatBirthDate, type PersonalProfileDraft } from '../src/components/profile/ProfileEditModals';
import { MockAvatar } from '../src/components/common/MockAvatar';
import { SettingsRow } from '../src/components/health/HealthComponents';
import { useAuth } from '../src/contexts/AuthContext';
import { displayName, initials, profileText } from '../src/lib/profileRepository';
import { useHealthQuery } from '../src/hooks/useHealthQuery';
import { getCurrentGoals } from '../src/services/healthGoalsService';
import { addWeightRecord, getLatestWeight } from '../src/services/weightService';
import { updateMyProfile, ensureMyProfile } from '../src/services/profileService';
import { DataFeedback } from '../src/components/common/DataFeedback';
import { authErrorMessage } from '../src/lib/authErrors';
import * as ImagePicker from 'expo-image-picker';
import { uploadAvatar, createAvatarSignedUrl, deleteAvatar } from '../src/services/avatarService';
import { dataError } from '../src/lib/dataErrors';
import { personalHealthEdits } from '../src/lib/profileHealthEditing';
import { assertIdentity } from '../src/services/queryCore';
import { HealthRecommendationsSection } from '../src/components/health/HealthRecommendationsSection';
import { useLocalToday } from '../src/hooks/useLocalToday';
import { useThemedStyles } from '../src/contexts/ThemeContext';

export default function ProfileScreen(){const {user}=useAuth();return <ProfileContent key={user?.id??'guest'}/>;}
function ProfileContent() {
  const styles = useThemedStyles(baseStyles);
  const { t } = useTranslation();

  const router = useRouter();

  const { user, profile, profileLoading, profileError, refreshProfile, signOut } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [avatarBusy,setAvatarBusy] = useState(false);
  const [personalEditor, setPersonalEditor] = useState<PersonalProfileDraft|null>(null);
  const params=useLocalSearchParams<{edit?:string}>(),requestedEditor=useRef(''),today=useLocalToday();
  const submittingRef = useRef(false);
  const avatarLock = useRef(false);
  const records = useHealthQuery(async () => { const [goals,weight] = await Promise.all([getCurrentGoals(),getLatestWeight()]); return { goals,weight }; },'profile-health:'+today);
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
      activityLevel:profile?.activity_level??'',weightGoal:profile?.weight_goal??'',
    };
  }, [birthDate, height, profile?.full_name, profile?.gender, profile?.activity_level, profile?.weight_goal, records.data?.weight?.weight_kg, user?.user_metadata.full_name]);
  useEffect(()=>{if(params.edit==='personal'&&requestedEditor.current!==user?.id&&!profileLoading&&!records.isLoading){requestedEditor.current=user?.id??'';setPersonalEditor(personalDraft);}},[params.edit,user?.id,profileLoading,records.isLoading,personalDraft]);
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
      if (!profile) await ensureMyProfile(user.id);
      uploadedPath = await uploadAvatar(image.base64);
      try {
        await updateMyProfile({ avatar_url:uploadedPath },user.id);
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
  const handleSavePersonal = async (draft: PersonalProfileDraft,initial:PersonalProfileDraft) => {
    if(!user)return;
    const {patch,weightKg}=personalHealthEdits(initial,draft);
    await assertIdentity(user.id);
    if(Object.keys(patch).length){if(!profile)await ensureMyProfile(user.id);await assertIdentity(user.id);await updateMyProfile(patch,user.id);}
    try {if(weightKg!==null){await assertIdentity(user.id);await addWeightRecord({weight_kg:weightKg},user.id);}}
    finally {await refreshProfile();}
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
        <SectionHeader title={t("profile.personal")} actionText={t('common.edit')} onAction={() => setPersonalEditor(personalDraft)} />
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

        <View style={styles.card}>
          <SettingsRow title={t('onboarding.activityLevel')} value={profile?.activity_level?t(`onboarding.activityLevelOptions.${profile.activity_level}.label`):t('common.unavailable')} icon="walk-outline" onPress={()=>setPersonalEditor(personalDraft)}/>
          <SettingsRow title={t('onboarding.weightGoal')} value={profile?.weight_goal?t(`onboarding.weightGoalOptions.${profile.weight_goal}.label`):t('common.unavailable')} icon="flag-outline" onPress={()=>setPersonalEditor(personalDraft)}/>
        </View>
        <HealthRecommendationsSection goalsQuery={{data:records.data?.goals??null,isLoading:records.isLoading,error:records.error,refresh:records.refresh}} onEditProfile={()=>setPersonalEditor(personalDraft)}/>

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
      {personalEditor ? <PersonalProfileModal key={user?.id} visible initial={personalEditor} onClose={()=>setPersonalEditor(null)} onSave={draft=>handleSavePersonal(draft,personalEditor)}/> : null}
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
