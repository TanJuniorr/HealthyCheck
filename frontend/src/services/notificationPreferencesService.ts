import AsyncStorage from '@react-native-async-storage/async-storage';

export type NotificationPreferences = {
  notificationsEnabled: boolean;
  dailyRemindersEnabled: boolean;
};

const STORAGE_PREFIX = 'healthy-check:notification-preferences:';
const defaults: NotificationPreferences = {
  notificationsEnabled: true,
  dailyRemindersEnabled: true,
};

function key(ownerId: string) {
  return `${STORAGE_PREFIX}${ownerId}`;
}

export async function getNotificationPreferences(ownerId: string): Promise<NotificationPreferences> {
  try {
    const stored = await AsyncStorage.getItem(key(ownerId));
    if (!stored) return defaults;
    const value: unknown = JSON.parse(stored);
    if (!value || typeof value !== 'object') return defaults;
    const data = value as Partial<NotificationPreferences>;
    return {
      notificationsEnabled: typeof data.notificationsEnabled === 'boolean' ? data.notificationsEnabled : defaults.notificationsEnabled,
      dailyRemindersEnabled: typeof data.dailyRemindersEnabled === 'boolean' ? data.dailyRemindersEnabled : defaults.dailyRemindersEnabled,
    };
  } catch {
    return defaults;
  }
}

export async function saveNotificationPreferences(ownerId: string, value: NotificationPreferences) {
  await AsyncStorage.setItem(key(ownerId), JSON.stringify(value));
}
