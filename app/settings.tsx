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
  const router = useRouter();

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
      <AppHeader title="Settings" showBack />

      <ScreenContainer>
        {/* Appearance Section */}
        <SectionHeader title="Appearance" />
        <View style={styles.card}>
          <SettingsRow
            title="Theme"
            value="Light"
            icon="sunny-outline"
            onPress={() => Alert.alert('Theme', 'Light mode is currently active.')}
          />
          <SettingsSwitchRow
            title="Dark Mode"
            icon="moon-outline"
            value={darkMode}
            onValueChange={setDarkMode}
            description="Adjust display based on time or preference"
            isLast
          />
        </View>

        {/* Health Preferences Section */}
        <SectionHeader title="Health Preferences" />
        <View style={styles.card}>
          <SettingsRow
            title="Units of Measure"
            value={units === 'Metric' ? 'Metric (kg, cm)' : 'Imperial (lb, in)'}
            icon="speedometer-outline"
            onPress={toggleUnits}
          />
          <SettingsRow
            title="Daily Step Goal"
            value="15,000 steps"
            icon="footsteps-outline"
            onPress={() => Alert.alert('Step Goal', 'Daily goal is set to 15,000 steps.')}
          />
          <SettingsRow
            title="Calorie Goal"
            value="1,600 kcal"
            icon="flame-outline"
            onPress={() => Alert.alert('Calorie Goal', 'Daily goal is set to 1,600 kcal.')}
          />
          <SettingsRow
            title="Sleep Schedule"
            value="10:00 PM - 7:30 AM"
            icon="alarm-outline"
            onPress={() => router.push('/sleep-schedule')}
            showChevron
          />
        </View>

        {/* Notifications Section */}
        <SectionHeader title="Notifications" />
        <View style={styles.card}>
          <SettingsSwitchRow
            title="Push Notifications"
            icon="notifications-outline"
            value={pushNotifications}
            onValueChange={setPushNotifications}
            description="Receive daily health updates & alerts"
          />
          <SettingsSwitchRow
            title="Health Reminders"
            icon="time-outline"
            value={dailyReminders}
            onValueChange={setDailyReminders}
            description="Gentle nudges for hydration and movement"
            isLast
          />
        </View>

        {/* Privacy & Sharing Section */}
        <SectionHeader title="Privacy & Data" />
        <View style={styles.card}>
          <SettingsRow
            title="Data Sharing"
            value="Configure"
            icon="share-social-outline"
            onPress={() => router.push('/sharing-setup')}
          />
          <SettingsSwitchRow
            title="Share Analytics"
            icon="analytics-outline"
            value={analytics}
            onValueChange={setAnalytics}
            description="Help improve Healthy Check with anonymous usage data"
          />
          <SettingsRow
            title="Export Health Data"
            value="JSON / CSV"
            icon="download-outline"
            onPress={() => Alert.alert('Export Data', 'Your health data summary is ready for download.')}
          />
        </View>

        {/* About Section */}
        <SectionHeader title="About" />
        <View style={[styles.card, styles.lastCard]}>
          <SettingsRow
            title="Version"
            value="1.0.0 (Build 42)"
            icon="information-circle-outline"
            showChevron={false}
          />
          <SettingsRow
            title="Terms of Service"
            icon="document-text-outline"
            onPress={() => Alert.alert('Terms of Service', 'Standard terms and conditions apply.')}
          />
          <SettingsRow
            title="Privacy Policy"
            icon="lock-closed-outline"
            onPress={() => Alert.alert('Privacy Policy', 'Your personal health data is encrypted and confidential.')}
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
