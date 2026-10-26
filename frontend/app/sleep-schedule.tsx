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
import { PrimaryButton } from '../src/components/common/Buttons';
import { sleepData, sleepTips } from '../src/data/sleep';

const DAYS_OF_WEEK = [
  { id: 'M', label: 'Mon', full: 'Monday' },
  { id: 'T', label: 'Tue', full: 'Tuesday' },
  { id: 'W', label: 'Wed', full: 'Wednesday' },
  { id: 'Th', label: 'Thu', full: 'Thursday' },
  { id: 'F', label: 'Fri', full: 'Friday' },
  { id: 'Sa', label: 'Sat', full: 'Saturday' },
  { id: 'Su', label: 'Sun', full: 'Sunday' },
];

export default function SleepScheduleScreen() {
  const router = useRouter();

  // Active days state (all active by default)
  const [activeDays, setActiveDays] = useState<Record<string, boolean>>({
    M: true,
    T: true,
    W: true,
    Th: true,
    F: true,
    Sa: true,
    Su: true,
  });

  // Schedule times
  const [bedtime] = useState(sleepData.bedtime); // '10:00 PM'
  const [wakeUp] = useState(sleepData.wakeUp); // '7:30 AM'
  const duration = '9h 30m';

  // Toggle states
  const [bedtimeReminder, setBedtimeReminder] = useState(true);
  const [smartAlarm, setSmartAlarm] = useState(true);
  const [sleepFocus, setSleepFocus] = useState(true);

  const toggleDay = (id: string) => {
    setActiveDays((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleApplyPreset = (type: 'all' | 'weekdays' | 'weekends') => {
    if (type === 'all') {
      setActiveDays({ M: true, T: true, W: true, Th: true, F: true, Sa: true, Su: true });
    } else if (type === 'weekdays') {
      setActiveDays({ M: true, T: true, W: true, Th: true, F: true, Sa: false, Su: false });
    } else {
      setActiveDays({ M: false, T: false, W: false, Th: false, F: false, Sa: true, Su: true });
    }
  };

  const handleSaveSchedule = () => {
    Alert.alert(
      'Schedule Saved',
      `Your sleep schedule (${bedtime} – ${wakeUp}, ${duration}) is active.`,
      [{ text: 'OK', onPress: () => router.back() }]
    );
  };

  return (
    <View style={styles.container}>
      <AppHeader title="Sleep Schedule" showBack />

      <ScreenContainer>
        {/* Current Schedule Hero Card */}
        <View style={styles.scheduleHeroCard}>
          <View style={styles.heroTimeRow}>
            {/* Bedtime */}
            <View style={styles.timeBlock}>
              <View style={[styles.timeIconWrapper, { backgroundColor: Colors.purpleLight }]}>
                <Ionicons name="moon" size={22} color={Colors.purple} />
              </View>
              <Text style={styles.timeLabel}>Bedtime</Text>
              <Text style={styles.timeDisplay}>{bedtime}</Text>
              <Text style={styles.timeSubtext}>Wind down 9:30 PM</Text>
            </View>

            {/* Connecting visual divider */}
            <View style={styles.timeConnector}>
              <View style={styles.connectorLine} />
              <View style={styles.durationPill}>
                <Ionicons name="timer-outline" size={14} color={Colors.purple} />
                <Text style={styles.durationPillText}>{duration}</Text>
              </View>
              <View style={styles.connectorLine} />
            </View>

            {/* Wake-up */}
            <View style={styles.timeBlock}>
              <View style={[styles.timeIconWrapper, { backgroundColor: Colors.orangeLight }]}>
                <Ionicons name="sunny" size={22} color={Colors.orange} />
              </View>
              <Text style={styles.timeLabel}>Wake-up</Text>
              <Text style={styles.timeDisplay}>{wakeUp}</Text>
              <Text style={styles.timeSubtext}>Gentle alarm</Text>
            </View>
          </View>

          <View style={styles.targetBanner}>
            <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
            <Text style={styles.targetBannerText}>
              Exceeds your 8h daily target by 1h 30m
            </Text>
          </View>
        </View>

        {/* Days of Week Section */}
        <SectionHeader title="Active Days" />
        <View style={styles.daysCard}>
          <View style={styles.daysRow}>
            {DAYS_OF_WEEK.map((day) => {
              const isActive = !!activeDays[day.id];
              return (
                <TouchableOpacity
                  key={day.id}
                  style={[styles.dayButton, isActive && styles.dayButtonActive]}
                  onPress={() => toggleDay(day.id)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.dayButtonLabel, isActive && styles.dayButtonLabelActive]}>
                    {day.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Quick preset chips */}
          <View style={styles.presetsRow}>
            <TouchableOpacity
              style={styles.presetChip}
              onPress={() => handleApplyPreset('all')}
              activeOpacity={0.7}
            >
              <Text style={styles.presetText}>Every Day</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.presetChip}
              onPress={() => handleApplyPreset('weekdays')}
              activeOpacity={0.7}
            >
              <Text style={styles.presetText}>Weekdays</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.presetChip}
              onPress={() => handleApplyPreset('weekends')}
              activeOpacity={0.7}
            >
              <Text style={styles.presetText}>Weekends</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Reminders & Alarms Section */}
        <SectionHeader title="Reminders & Alarms" />
        <View style={styles.card}>
          <View style={styles.switchRow}>
            <View style={styles.switchLeft}>
              <View style={[styles.switchIconBg, { backgroundColor: Colors.purpleLight }]}>
                <Ionicons name="notifications-outline" size={18} color={Colors.purple} />
              </View>
              <View style={styles.switchTextWrapper}>
                <Text style={styles.switchTitle}>Bedtime Reminder</Text>
                <Text style={styles.switchDescription}>Alert 30 minutes before bedtime</Text>
              </View>
            </View>
            <Switch
              value={bedtimeReminder}
              onValueChange={setBedtimeReminder}
              trackColor={{ false: Colors.border, true: Colors.primary }}
              thumbColor={Colors.white}
            />
          </View>

          <View style={styles.switchRow}>
            <View style={styles.switchLeft}>
              <View style={[styles.switchIconBg, { backgroundColor: Colors.orangeLight }]}>
                <Ionicons name="alarm-outline" size={18} color={Colors.orange} />
              </View>
              <View style={styles.switchTextWrapper}>
                <Text style={styles.switchTitle}>Smart Wake-Up Alarm</Text>
                <Text style={styles.switchDescription}>Gentle sound window before 7:30 AM</Text>
              </View>
            </View>
            <Switch
              value={smartAlarm}
              onValueChange={setSmartAlarm}
              trackColor={{ false: Colors.border, true: Colors.primary }}
              thumbColor={Colors.white}
            />
          </View>

          <View style={[styles.switchRow, styles.rowLast]}>
            <View style={styles.switchLeft}>
              <View style={[styles.switchIconBg, { backgroundColor: Colors.blueLight }]}>
                <Ionicons name="moon-outline" size={18} color={Colors.blue} />
              </View>
              <View style={styles.switchTextWrapper}>
                <Text style={styles.switchTitle}>Sleep Focus Mode</Text>
                <Text style={styles.switchDescription}>Dim display and mute interruptions</Text>
              </View>
            </View>
            <Switch
              value={sleepFocus}
              onValueChange={setSleepFocus}
              trackColor={{ false: Colors.border, true: Colors.primary }}
              thumbColor={Colors.white}
            />
          </View>
        </View>

        {/* Consistent Sleep Tip Card */}
        <View style={styles.tipCard}>
          <View style={styles.tipHeader}>
            <Ionicons name="bulb-outline" size={20} color={Colors.primary} />
            <Text style={styles.tipTitle}>Sleep Insight</Text>
          </View>
          <Text style={styles.tipText}>
            {sleepTips[0]} Regular sleep patterns help keep your circadian rhythm in sync, leading
            to deeper REM rest and easier mornings.
          </Text>
        </View>

        {/* Save Schedule Button */}
        <View style={styles.actionContainer}>
          <PrimaryButton
            title="Save Schedule"
            onPress={handleSaveSchedule}
            style={styles.saveButton}
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
  scheduleHeroCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    marginTop: Spacing.lg,
    ...Shadows.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  heroTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeBlock: {
    alignItems: 'center',
    flex: 1,
  },
  timeIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  timeLabel: {
    ...Typography.labelSmall,
    color: Colors.textMuted,
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timeDisplay: {
    ...Typography.statMedium,
    fontSize: 20,
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  timeSubtext: {
    ...Typography.supporting,
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  timeConnector: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xs,
  },
  connectorLine: {
    width: 2,
    height: 12,
    backgroundColor: Colors.divider,
  },
  durationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.purpleLight,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 5,
    borderRadius: Radius.full,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: '#EFE8F9',
  },
  durationPillText: {
    ...Typography.labelSmall,
    color: Colors.purple,
    fontWeight: '700',
    fontSize: 11,
  },
  targetBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.successLight,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    marginTop: Spacing.xl,
  },
  targetBannerText: {
    ...Typography.labelSmall,
    color: Colors.success,
    fontWeight: '600',
  },
  daysCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    ...Shadows.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dayButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  dayButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  dayButtonLabel: {
    ...Typography.labelSmall,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  dayButtonLabelActive: {
    color: Colors.white,
    fontWeight: '700',
  },
  presetsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  presetChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  presetText: {
    ...Typography.labelSmall,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    ...Shadows.sm,
    borderWidth: 1,
    borderColor: Colors.border,
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
  switchIconBg: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  switchTextWrapper: {
    flex: 1,
  },
  switchTitle: {
    ...Typography.body,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  switchDescription: {
    ...Typography.supporting,
    color: Colors.textMuted,
    marginTop: 2,
  },
  tipCard: {
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginTop: Spacing.xxl,
    borderWidth: 1,
    borderColor: '#D8F1EE',
  },
  tipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
    marginBottom: Spacing.xs,
  },
  tipTitle: {
    ...Typography.cardTitle,
    fontSize: 14,
    color: Colors.primaryDark,
  },
  tipText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  actionContainer: {
    marginTop: Spacing.xxl,
    marginBottom: Spacing.lg,
  },
  saveButton: {
    minHeight: 52,
  },
});
