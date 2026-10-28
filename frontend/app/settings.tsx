import { useTranslation } from 'react-i18next';
import { LanguageSelector } from '../src/components/common/LanguageSelector';
import React, { useState } from 'react';
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
import { SettingsRow } from '../src/components/health/HealthComponents';
import { useTheme, useThemedStyles } from '../src/contexts/ThemeContext';

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
  const styles = useThemedStyles(baseStyles);
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
  const styles = useThemedStyles(baseStyles);
  const { t } = useTranslation();
  const { isDark: darkMode, setDarkMode } = useTheme();

  const router = useRouter();

  const [pushNotifications, setPushNotifications] = useState(true);
  const [dailyReminders, setDailyReminders] = useState(true);
  const [analytics, setAnalytics] = useState(false);

  return (
    <View style={styles.container}>
      <AppHeader title={t("navigation.settings")} showBack />

      <ScreenContainer>
        <SectionHeader title={t("settings.language")} />
        <LanguageSelector />
        <Text style={{ ...Typography.supporting,color:Colors.textSecondary }}>{t("settings.previewNotice")}</Text>
        {/* Appearance Section */}
        <SectionHeader title={t("settings.appearance")} />
        <View style={styles.card}>
          <SettingsSwitchRow
            title={t("settings.dark")}
            icon="moon-outline"
            value={darkMode}
            onValueChange={setDarkMode}
            isLast
          />
        </View>

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

const baseStyles = StyleSheet.create({
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
