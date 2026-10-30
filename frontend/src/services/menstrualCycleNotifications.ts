import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import type { MenstrualCycleSettingsRow } from '../types/database';
import { getNextPeriodReminderDates, localDateAtHour } from '../lib/menstrualCycleCalculations';
import { getNotificationPreferences } from './notificationPreferencesService';
import { notificationChannelId } from './healthNotifications';

export const menstrualCycleReminderKind = 'cycle_reminder';
export type CycleReminderStatus = 'ready' | 'off' | 'denied' | 'unsupported';

let reminderQueue = Promise.resolve();

function enqueueReminderWork<T>(work: () => Promise<T>): Promise<T> {
  const next = reminderQueue.then(work, work);
  reminderQueue = next.then(() => undefined, () => undefined);
  return next;
}

export function cancelMenstrualCycleReminder(ownerId: string | null) {
  return enqueueReminderWork(async () => {
    if (Platform.OS === 'web') return;
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const item of scheduled) {
      if (item.content.data?.kind === menstrualCycleReminderKind && (!ownerId || item.content.data?.owner === ownerId)) {
        await Notifications.cancelScheduledNotificationAsync(item.identifier);
      }
    }
  });
}

export function reconcileMenstrualCycleReminder(
  ownerId: string | null,
  settings: MenstrualCycleSettingsRow | null,
  title: string,
  body: (expectedDate: string) => string,
): Promise<CycleReminderStatus> {
  return enqueueReminderWork(() => reconcileMenstrualCycleReminderNow(ownerId, settings, title, body));
}

async function reconcileMenstrualCycleReminderNow(
  ownerId: string | null,
  settings: MenstrualCycleSettingsRow | null,
  title: string,
  body: (expectedDate: string) => string,
): Promise<CycleReminderStatus> {
  if (Platform.OS === 'web') return 'unsupported';
  const scheduled = (await Notifications.getAllScheduledNotificationsAsync()).filter(item => item.content.data?.kind === menstrualCycleReminderKind);
  const cancelAll = async () => {
    for (const item of scheduled) await Notifications.cancelScheduledNotificationAsync(item.identifier);
  };
  if (!ownerId || !settings?.reminder_enabled || !settings.last_period_start) {
    await cancelAll();
    return 'off';
  }
  const preferences = await getNotificationPreferences(ownerId);
  if (!preferences.notificationsEnabled) {
    await cancelAll();
    return 'off';
  }
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) {
    await cancelAll();
    return 'denied';
  }

  const dates = getNextPeriodReminderDates(settings);
  if (!dates) {
    await cancelAll();
    return 'off';
  }
  const signature = `${ownerId}:${dates.expectedPeriodStart}:${settings.reminder_days_before}`;
  const current = scheduled.filter(item => item.content.data?.owner === ownerId && item.content.data?.signature === signature);
  if (current.length === 1 && scheduled.length === 1) return 'ready';

  await cancelAll();
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(notificationChannelId, {
      name: 'Healthy Check reminders', importance: AndroidImportance.DEFAULT,
    });
  }
  let triggerDate = localDateAtHour(dates.reminderDate, 9, 0);
  if (triggerDate.getTime() <= Date.now() + 60_000) triggerDate = new Date(Date.now() + 10 * 60_000);
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body: body(dates.expectedPeriodStart),
      data: {
        kind: menstrualCycleReminderKind,
        owner: ownerId,
        eventKey: `${menstrualCycleReminderKind}:${dates.expectedPeriodStart}`,
        expectedPeriodStart: dates.expectedPeriodStart,
        signature,
      },
      ...(Platform.OS === 'android' ? { channelId: notificationChannelId } : {}),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
      ...(Platform.OS === 'android' ? { channelId: notificationChannelId } : {}),
    },
  });
  return 'ready';
}
