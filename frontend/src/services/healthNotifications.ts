import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { toLocalDateKey } from '../lib/dateUtils';
import { HEALTH_SCORE_LOW_THRESHOLD } from '../lib/healthScore';
import { getNotificationPreferences } from './notificationPreferencesService';

export const notificationChannelId = 'healthycheck-reminders';
export const missingSleepKind = 'sleep_missing';
export const wellnessKind = 'wellness_daily';
export const stepGoalKind = 'step_goal';
export const lowHealthScoreKind = 'health_score_low';
const EVENT_PREFIX = 'healthy-check:notification-event:';
const pendingEvents = new Set<string>();
let dailyReminderQueue: Promise<void> = Promise.resolve();

export async function requestNotificationPermission() {
  if (Platform.OS === 'web') return false;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(notificationChannelId, {
      name: 'Healthy Check reminders',
      importance: AndroidImportance.DEFAULT,
    });
  }
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;
  return (await Notifications.requestPermissionsAsync()).granted;
}

async function notificationPermissionGranted() {
  if (Platform.OS === 'web') return false;
  try {
    return (await Notifications.getPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

export async function notifyStepGoalReached(ownerId: string, steps: number, goal: number, title: string, body: string) {
  if (!Number.isFinite(steps) || !Number.isFinite(goal) || goal <= 0) return;
  const preferences = await getNotificationPreferences(ownerId);
  if (!preferences.notificationsEnabled || !(await notificationPermissionGranted())) return;

  const date = toLocalDateKey();
  const eventKey = `${stepGoalKind}:${date}`;
  const storageKey = `${EVENT_PREFIX}${ownerId}:step_goal`;
  if (pendingEvents.has(storageKey)) return;
  pendingEvents.add(storageKey);
  try {
    if ((await AsyncStorage.getItem(storageKey)) === date) return;
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { kind: stepGoalKind, owner: ownerId, eventKey, steps, goal },
        ...(Platform.OS === 'android' ? { channelId: notificationChannelId } : {}),
      },
      trigger: null,
    });
    await AsyncStorage.setItem(storageKey, date);
  } finally {
    pendingEvents.delete(storageKey);
  }
}

export async function notifyLowHealthScore(ownerId: string, score: number, title: string, body: string) {
  if (!Number.isFinite(score) || score < 0 || score >= HEALTH_SCORE_LOW_THRESHOLD) return;
  const preferences = await getNotificationPreferences(ownerId);
  if (!preferences.notificationsEnabled || !(await notificationPermissionGranted())) return;

  const date = toLocalDateKey();
  const storageKey = `${EVENT_PREFIX}${ownerId}:${lowHealthScoreKind}`;
  if (pendingEvents.has(storageKey)) return;
  pendingEvents.add(storageKey);
  try {
    if ((await AsyncStorage.getItem(storageKey)) === date) return;
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { kind: lowHealthScoreKind, owner: ownerId, eventKey: `${lowHealthScoreKind}:${date}`, score },
        ...(Platform.OS === 'android' ? { channelId: notificationChannelId } : {}),
      },
      trigger: null,
    });
    await AsyncStorage.setItem(storageKey, date);
  } finally {
    pendingEvents.delete(storageKey);
  }
}

export async function notifyIncomingShare(ownerId: string, notificationId: string, title: string, body: string, payload: Record<string, unknown>) {
  if (Platform.OS === 'web') return;
  const preferences = await getNotificationPreferences(ownerId);
  if (!preferences.notificationsEnabled || !(await notificationPermissionGranted())) return;
  const storageKey = `${EVENT_PREFIX}${ownerId}:sharing_received:${notificationId}`;
  if (pendingEvents.has(storageKey)) return;
  pendingEvents.add(storageKey);
  try {
    if (await AsyncStorage.getItem(storageKey)) return;
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { ...payload, kind: 'sharing_received', owner: ownerId, eventKey: notificationId },
        ...(Platform.OS === 'android' ? { channelId: notificationChannelId } : {}),
      },
      trigger: null,
    });
    await AsyncStorage.setItem(storageKey, '1');
  } finally {
    pendingEvents.delete(storageKey);
  }
}

type ReminderCopy = { title: string; body: string };

async function reconcileDailyHealthRemindersNow(input: {
  ownerId: string | null;
  enabled: boolean;
  dailyRemindersEnabled: boolean;
  hasSleepSchedule: boolean | null;
  sleep: ReminderCopy;
  wellness: ReminderCopy;
}): Promise<void> {
  if (Platform.OS === 'web') return;
  const kinds = new Set([missingSleepKind, wellnessKind]);
  const existing = (await Notifications.getAllScheduledNotificationsAsync()).filter(notification =>
    kinds.has(String(notification.content.data?.kind))
  );
  const cancelKind = async (kind: string) => {
    for (const notification of existing.filter(item => item.content.data?.kind === kind)) {
      await Notifications.cancelScheduledNotificationAsync(notification.identifier);
    }
  };

  if (!input.ownerId) {
    for (const notification of existing) await Notifications.cancelScheduledNotificationAsync(notification.identifier);
    return;
  }
  if (!input.enabled || !input.dailyRemindersEnabled || !(await notificationPermissionGranted())) {
    await cancelKind(missingSleepKind);
    await cancelKind(wellnessKind);
    return;
  }

  const shouldScheduleSleep = !input.hasSleepSchedule;
  const desired = [
    { kind: missingSleepKind, hour: 21, minute: 0, copy: input.sleep, shouldSchedule: shouldScheduleSleep },
    { kind: wellnessKind, hour: 17, minute: 30, copy: input.wellness, shouldSchedule: true },
  ];
  for (const reminder of desired) {
    const current = existing.filter(item => item.content.data?.kind === reminder.kind && item.content.data?.owner === input.ownerId);
    if (reminder.kind === missingSleepKind && input.hasSleepSchedule === null) continue;
    if (!reminder.shouldSchedule) {
      await cancelKind(reminder.kind);
      continue;
    }
    const signature = `${input.ownerId}:${reminder.hour}:${reminder.minute}:${reminder.copy.title}:${reminder.copy.body}`;
    if (current.length === 1 && current[0].content.data?.signature === signature) {
      // Reuse the existing daily trigger to avoid creating duplicate reminders on app resume.
      continue;
    }
    await cancelKind(reminder.kind);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: reminder.copy.title,
        body: reminder.copy.body,
        data: { kind: reminder.kind, owner: input.ownerId, signature },
        ...(Platform.OS === 'android' ? { channelId: notificationChannelId } : {}),
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: reminder.hour, minute: reminder.minute,
        ...(Platform.OS === 'android' ? { channelId: notificationChannelId } : {}) },
    });
  }
}

export function reconcileDailyHealthReminders(input: Parameters<typeof reconcileDailyHealthRemindersNow>[0]): Promise<void> {
  const next = dailyReminderQueue.then(
    () => reconcileDailyHealthRemindersNow(input),
    () => reconcileDailyHealthRemindersNow(input),
  );
  dailyReminderQueue = next.catch(() => {});
  return next;
}

async function cancelUserHealthRemindersNow(ownerId: string | null) {
  if (Platform.OS === 'web') return;
  const ownedKinds = new Set([missingSleepKind, wellnessKind, stepGoalKind, lowHealthScoreKind, 'healthycheck-sleep', 'cycle_reminder']);
  const existing = await Notifications.getAllScheduledNotificationsAsync();
  for (const item of existing) {
    const data = item.content.data;
    if (ownedKinds.has(String(data?.kind)) && (!ownerId || data?.owner === ownerId)) {
      await Notifications.cancelScheduledNotificationAsync(item.identifier);
    }
  }
}

export function cancelUserHealthReminders(ownerId: string | null): Promise<void> {
  const next = dailyReminderQueue.then(
    () => cancelUserHealthRemindersNow(ownerId),
    () => cancelUserHealthRemindersNow(ownerId),
  );
  dailyReminderQueue = next.catch(() => {});
  return next;
}
