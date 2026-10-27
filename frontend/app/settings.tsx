import { useTranslation } from 'react-i18next';
import { localizeMessage } from '../src/i18n/localize';
import { LanguageSelector } from '../src/components/common/LanguageSelector';
import { formatNumber } from '../src/i18n/formatting';
import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
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
import { useHealthGoals } from '../src/hooks/healthHooks';
import { createGoals } from '../src/services/healthGoalsService';
import { toLocalDateKey } from '../src/lib/dateUtils';
import { dataError } from '../src/lib/dataErrors';
import { DataFeedback } from '../src/components/common/DataFeedback';
import { AppTextInput } from '../src/components/common/AppTextInput';
import { PrimaryButton,TextButton } from '../src/components/common/Buttons';
import { SettingsRow } from '../src/components/health/HealthComponents';

interface SettingsSwitchRowProps {
  title: string;
  icon: string;
  value: boolean;
  onValueChange: (val: boolean) => void;
  description?: string;
  isLast?: boolean;
}

function SettingsSwitchRow({
  title,
  icon,
  value,
  onValueChange,
  description,
  isLast = false,
}: SettingsSwitchRowProps) {
  useTranslation();

  return (
    <View style={[styles.switchRow, isLast && styles.rowLast]}>
      <View style={styles.switchLeft}>
        <View style={styles.iconWrapper}>
          <Ionicons name={icon as any} size={20} color={Colors.textSecondary} />
        </View>
        <View style={styles.titleWrapper}>
          <Text style={styles.rowTitle}>{title}</Text>
          {description && <Text style={styles.rowDescription}>{description}</Text>}
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: Colors.border, true: Colors.primary }}
        thumbColor={Colors.white}
      />
    </View>
  );
}

export default function SettingsScreen() {
  const { t } = useTranslation();

  const router = useRouter();
  const goals = useHealthGoals();
  const [editing,setEditing] = useState(false);
  const [goalInputs,setGoalInputs] = useState({ daily_steps:'',daily_calories:'',daily_water_ml:'',target_sleep_minutes:'' });
  const [saving,setSaving] = useState(false); const [saveError,setSaveError] = useState(''); const pending = useRef(false);
  const editGoals = () => { const current = goals.data; setGoalInputs({ daily_steps:String(current?.daily_steps ?? 8000),daily_calories:String(current?.daily_calories ?? 2000),daily_water_ml:String(current?.daily_water_ml ?? 2000),target_sleep_minutes:String(current?.target_sleep_minutes ?? 480) }); setEditing(true); };
  const saveGoals = async () => { if (pending.current) return; pending.current = true; setSaving(true); setSaveError(''); try { await createGoals({ daily_steps:Number(goalInputs.daily_steps.trim() || NaN),daily_calories:Number(goalInputs.daily_calories.trim() || NaN),daily_water_ml:Number(goalInputs.daily_water_ml.trim() || NaN),target_sleep_minutes:Number(goalInputs.target_sleep_minutes.trim() || NaN),effective_from:toLocalDateKey() }); await goals.refresh(); setEditing(false); } catch (error) { setSaveError(dataError(error).message); } finally { pending.current = false; setSaving(false); } };

  // Local state for settings switches
  const [darkMode, setDarkMode] = useState(false);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [dailyReminders, setDailyReminders] = useState(true);
  const [analytics, setAnalytics] = useState(false);
  const [units, setUnits] = useState<'Metric' | 'Imperial'>('Metric');

  const toggleUnits = () => {
    const nextUnit = units === 'Metric' ? 'Imperial' : 'Metric';
    setUnits(nextUnit);
  };

  return (
    <View style={styles.container}>
      <AppHeader title={t("navigation.settings")} showBack />

      <ScreenContainer>
        <SectionHeader title={t("settings.language")} />
        <LanguageSelector />
        <DataFeedback {...goals} />
        <Text style={{ ...Typography.supporting,color:Colors.textSecondary }}>{t("settings.previewNotice")}</Text>
        {/* Appearance Section */}
        <SectionHeader title={t("settings.appearance")} />
        <View style={styles.card}>
          <SettingsRow
            title={t("settings.theme")}
            value={t("settings.light")}
            icon="sunny-outline"
            onPress={() => Alert.alert(t("settings.theme"), t("settings.lightNotice"))}
          />
          <SettingsSwitchRow
            title={t("settings.dark")}
            icon="moon-outline"
            value={darkMode}
            onValueChange={setDarkMode}
            description={t("settings.darkHint")}
            isLast
          />
        </View>

        {/* Health Preferences Section */}
        <SectionHeader title={t("settings.healthPreferences")} />
        <View style={styles.card}>
          <SettingsRow
            title={t("settings.units")}
            value={units === 'Metric' ? t("settings.metric") : t("settings.imperial")}
            icon="speedometer-outline"
            onPress={toggleUnits}
          />
          <SettingsRow
            title={t("settings.stepGoal")}
            value={goals.data?.daily_steps != null ? t('units.stepCount',{ count:goals.data.daily_steps,value:formatNumber(goals.data.daily_steps) }) : '—'}
            icon="footsteps-outline"
            onPress={editGoals}
          />
          <SettingsRow
            title={t("settings.calorieGoal")}
            value={goals.data?.daily_calories != null ? `${formatNumber(goals.data.daily_calories)} kcal` : '—'}
            icon="flame-outline"
            onPress={editGoals}
          />
          <SettingsRow
            title={t("schedule.title")}
            value={t("common.preview")}
            icon="alarm-outline"
            onPress={() => router.push('/sleep-schedule')}
            showChevron
          />
        </View>

        <TextButton title={t("settings.editGoals")} onPress={editGoals} />
        {editing ? <View style={styles.card}>
          <Text style={styles.rowTitle}>{t("settings.newGoals")}</Text>
          {(Object.keys(goalInputs) as (keyof typeof goalInputs)[]).map(key => <AppTextInput key={key} label={t(`fields.${key}`)} value={goalInputs[key]} keyboardType="numeric" onChangeText={value => setGoalInputs(previous => ({ ...previous,[key]:value }))} />)}
          {saveError ? <Text accessibilityRole="alert" style={{ color:Colors.error }}>{localizeMessage(saveError)}</Text> : null}
          <PrimaryButton title={t("settings.saveGoals")} onPress={saveGoals} loading={saving} />
          <TextButton title={t("common.cancel")} onPress={() => setEditing(false)} disabled={saving} />
        </View> : null}
        {/* Notifications Section */}
        <SectionHeader title={t("settings.notifications")} />
        <View style={styles.card}>
          <SettingsSwitchRow
            title={t("settings.push")}
            icon="notifications-outline"
            value={pushNotifications}
            onValueChange={setPushNotifications}
            description={t("settings.pushHint")}
          />
          <SettingsSwitchRow
            title={t("settings.reminders")}
            icon="time-outline"
            value={dailyReminders}
            onValueChange={setDailyReminders}
            description={t("settings.remindersHint")}
            isLast
          />
        </View>

        {/* Privacy & Sharing Section */}
        <SectionHeader title={t("settings.privacyData")} />
        <View style={styles.card}>
          <SettingsRow
            title={t("settings.sharing")}
            value={t("settings.configure")}
            icon="share-social-outline"
            onPress={() => router.push('/sharing-setup')}
          />
          <SettingsSwitchRow
            title={t("settings.analytics")}
            icon="analytics-outline"
            value={analytics}
            onValueChange={setAnalytics}
            description={t("settings.analyticsHint")}
          />
          <SettingsRow
            title={t("settings.export")}
            value="JSON / CSV"
            icon="download-outline"
            onPress={() => Alert.alert(t("common.comingSoon"), t("settings.exportNotice"))}
          />
        </View>

        {/* About Section */}
        <SectionHeader title={t("common.about")} />
        <View style={[styles.card, styles.lastCard]}>
          <SettingsRow
            title={t("common.version")}
            value={t("common.buildVersion",{version:"1.0.0",build:42})}
            icon="information-circle-outline"
            showChevron={false}
          />
          <SettingsRow
            title={t("common.terms")}
            icon="document-text-outline"
            onPress={() => Alert.alert(t("common.terms"), t("settings.termsNotice"))}
          />
          <SettingsRow
            title={t("common.privacy")}
            icon="lock-closed-outline"
            onPress={() => Alert.alert(t("common.privacy"), t("settings.privacyNotice"))}
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
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    ...Shadows.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  lastCard: {
    marginBottom: Spacing.xxl,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  switchLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: Spacing.md,
  },
  iconWrapper: {
    width: 24,
    marginRight: Spacing.md,
    alignItems: 'center',
  },
  titleWrapper: {
    flex: 1,
  },
  rowTitle: {
    ...Typography.body,
    color: Colors.textPrimary,
  },
  rowDescription: {
    ...Typography.supporting,
    color: Colors.textMuted,
    marginTop: 2,
  },
});
