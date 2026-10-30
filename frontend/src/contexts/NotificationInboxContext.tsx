import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { useTranslation } from 'react-i18next';
import { useAuth } from './AuthContext';
import { getNotificationInboxSnapshot, markNotificationRead, saveReceivedNotification, type InboxNotification, type RemoteInboxStatus } from '../services/notificationInboxService';
import { getNotificationPreferences, saveNotificationPreferences, type NotificationPreferences } from '../services/notificationPreferencesService';
import { cancelUserHealthReminders, notificationChannelId, notifyIncomingShare, notifyStepGoalReached, reconcileDailyHealthReminders, requestNotificationPermission } from '../services/healthNotifications';
import { getMySleepSchedule } from '../services/sleepScheduleService';
import { subscribeSleepChanges } from '../lib/healthQueryEvents';
import { supabase } from '../lib/supabase';
import { notificationPresentation } from '../services/notificationPresentation';
import { getMyMenstrualCycleSettings, subscribeCycleSettingsChanges } from '../services/menstrualCycleService';
import { cancelMenstrualCycleReminder, reconcileMenstrualCycleReminder } from '../services/menstrualCycleNotifications';
import { formatDate } from '../i18n/formatting';

const basePreferences: NotificationPreferences = { notificationsEnabled: false, dailyRemindersEnabled: true };

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

type NotificationInboxValue = {
  items: InboxNotification[];
  unreadCount: number;
  remoteInboxStatus: RemoteInboxStatus;
  notificationsEnabled: boolean;
  dailyRemindersEnabled: boolean;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  setNotificationsEnabled: (value: boolean) => Promise<boolean>;
  setDailyRemindersEnabled: (value: boolean) => Promise<void>;
  sendStepGoalReached: (steps: number, goal: number) => Promise<void>;
};

const NotificationInboxContext = createContext<NotificationInboxValue | null>(null);

export function NotificationInboxProvider({ children }: React.PropsWithChildren) {
  const { user, profile, profileChecked } = useAuth();
  const { t, i18n } = useTranslation();
  const ownerId = user?.id ?? null;
  const [items, setItems] = useState<InboxNotification[]>([]);
  const [itemsOwnerId, setItemsOwnerId] = useState<string | null>(null);
  const [remoteStatusState, setRemoteStatusState] = useState<{ ownerId: string; status: RemoteInboxStatus } | null>(null);
  const [preferences, setPreferences] = useState<NotificationPreferences>(basePreferences);
  const [preferencesOwnerId, setPreferencesOwnerId] = useState<string | null>(null);
  const previousOwnerId = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    if (!ownerId) return;
    const snapshot = await getNotificationInboxSnapshot(ownerId);
    setItemsOwnerId(ownerId);
    setItems(snapshot.items);
    setRemoteStatusState({ ownerId, status: snapshot.remoteStatus });
  }, [ownerId]);

  const persistNativeNotification = useCallback(async (notification: Notifications.Notification) => {
    if (!ownerId) return;
    const notificationOwner = notification.request.content.data?.owner;
    if (typeof notificationOwner === 'string' && notificationOwner !== ownerId) return;
    await saveReceivedNotification(ownerId, notification);
    await refresh();
  }, [ownerId, refresh]);

  useEffect(() => {
    if (!ownerId) return;
    let alive = true;
    void getNotificationPreferences(ownerId).then(async loaded => {
      let next = loaded;
      // Request local notification permission once on first use; users can change it later in Settings.
      if (Platform.OS !== 'web' && loaded.notificationsEnabled) {
        const granted = await requestNotificationPermission();
        if (!granted) {
          next = { ...loaded, notificationsEnabled: false };
          await saveNotificationPreferences(ownerId, next);
        }
      }
      if (!alive) return;
      setPreferences(next);
      setPreferencesOwnerId(ownerId);
    }).catch(() => {
      if (alive) {
        setPreferences(basePreferences);
        setPreferencesOwnerId(ownerId);
      }
    });
    return () => { alive = false; };
  }, [ownerId]);

  useEffect(() => {
    const previousOwner = previousOwnerId.current;
    if (previousOwner && previousOwner !== ownerId) void cancelUserHealthReminders(previousOwner);
    previousOwnerId.current = ownerId;
  }, [ownerId]);

  useEffect(() => {
    if (!ownerId || preferencesOwnerId !== ownerId) return;
    let alive = true;
    const reconcile = async () => {
      let hasSleepSchedule: boolean | null = null;
      if (preferences.notificationsEnabled && preferences.dailyRemindersEnabled) {
        try {
          hasSleepSchedule = Boolean(await getMySleepSchedule());
        } catch {
          // Leave the existing sleep reminder unchanged if the query failed.
          hasSleepSchedule = null;
        }
      }
      if (!alive) return;
      try {
        await reconcileDailyHealthReminders({
          ownerId,
          enabled: preferences.notificationsEnabled,
          dailyRemindersEnabled: preferences.dailyRemindersEnabled,
          hasSleepSchedule,
          sleep: { title: t('notifications.missingSleepTitle'), body: t('notifications.missingSleepBody') },
          wellness: { title: t('notifications.wellnessTitle'), body: t('notifications.wellnessBody') },
        });
      } catch {
        // A failed local scheduler must not block the notification inbox.
      }
    };
    void reconcile();
    const unsubscribe = subscribeSleepChanges((changedOwner, kind) => {
      if (changedOwner === ownerId && kind === 'schedule') void reconcile();
    });
    const appState = AppState.addEventListener('change', state => {
      if (state === 'active') void reconcile();
    });
    return () => { alive = false; unsubscribe(); appState.remove(); };
  }, [ownerId, preferences, preferencesOwnerId, i18n.resolvedLanguage, t]);

  useEffect(() => {
    if (!ownerId || !profileChecked || preferencesOwnerId !== ownerId) return;
    let alive = true;
    const reconcileCycle = async () => {
      try {
        if (profile?.gender !== 'female') {
          await cancelMenstrualCycleReminder(ownerId);
          return;
        }
        const settings = await getMyMenstrualCycleSettings();
        if (!alive) return;
        await reconcileMenstrualCycleReminder(
          ownerId,
          settings,
          t('cycle.notificationTitle'),
          expectedDate => t('cycle.notificationBody', { date: formatDate(expectedDate) }),
        );
      } catch {
        // Keep an existing reminder if a cycle settings refresh fails temporarily.
      }
    };
    void reconcileCycle();
    const unsubscribe = subscribeCycleSettingsChanges(changedOwner => {
      if (changedOwner === ownerId) void reconcileCycle();
    });
    const appState = AppState.addEventListener('change', state => {
      if (state === 'active') void reconcileCycle();
    });
    return () => { alive = false; unsubscribe(); appState.remove(); };
  }, [ownerId, preferences.notificationsEnabled, preferencesOwnerId, profile?.gender, profileChecked, i18n.resolvedLanguage, t]);

  useEffect(() => {
    if (!ownerId) return;
    let alive = true;
    const received = Platform.OS === 'web' ? null : Notifications.addNotificationReceivedListener(notification => {
      void persistNativeNotification(notification);
    });
    const response = Platform.OS === 'web' ? null : Notifications.addNotificationResponseReceivedListener(event => {
      void persistNativeNotification(event.notification);
    });

    const syncNotifications = async () => {
      if (Platform.OS !== 'web') {
        try {
          const [presented, lastResponse] = await Promise.all([
            Notifications.getPresentedNotificationsAsync(),
            Notifications.getLastNotificationResponseAsync(),
          ]);
          for (const notification of presented) {
            const notificationOwner = notification.request.content.data?.owner;
            if (typeof notificationOwner !== 'string' || notificationOwner === ownerId) {
              await saveReceivedNotification(ownerId, notification);
            }
          }
          if (lastResponse) {
            const notification = lastResponse.notification;
            const notificationOwner = notification.request.content.data?.owner;
            if (typeof notificationOwner !== 'string' || notificationOwner === ownerId) {
              await saveReceivedNotification(ownerId, notification);
            }
          }
        } catch {
          // The inbox remains usable if the OS notification tray is unavailable.
        }
      }
      if (alive) await refresh();
    };
    void syncNotifications();
    const appState = AppState.addEventListener('change', state => {
      if (state === 'active') void syncNotifications();
    });
    const realtime = supabase.channel(`app-notifications:${ownerId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'app_notifications',
        filter: `recipient_user_id=eq.${ownerId}`,
      }, event => {
        void (async () => {
          await refresh();
          if (event.eventType !== 'INSERT') return;
          const row = event.new as { id?: string; kind?: string; payload?: Record<string, unknown> };
          if (!row.id || row.kind !== 'sharing_received') return;
          const copy = notificationPresentation({
            id: row.id, title: '', body: '', receivedAt: new Date().toISOString(),
            readAt: null, source: 'remote', kind: row.kind, payload: row.payload ?? {},
          }, t);
          await notifyIncomingShare(ownerId, row.id, copy.title, copy.body, row.payload ?? {});
        })().catch(() => {});
      })
      .subscribe();

    return () => {
      alive = false;
      received?.remove();
      response?.remove();
      appState.remove();
      void supabase.removeChannel(realtime);
    };
  }, [ownerId, persistNativeNotification, refresh, t]);

  const setNotificationsEnabled = useCallback(async (value: boolean) => {
    if (!ownerId) return false;
    try {
      if (value && Platform.OS !== 'web') {
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync(notificationChannelId, {
            name: 'Healthy Check reminders', importance: AndroidImportance.DEFAULT,
          });
        }
        if (!(await requestNotificationPermission())) return false;
      }
      const next = { ...preferences, notificationsEnabled: value };
      await saveNotificationPreferences(ownerId, next);
      setPreferences(next);
      setPreferencesOwnerId(ownerId);
      if (!value) await cancelUserHealthReminders(ownerId);
      return true;
    } catch {
      return false;
    }
  }, [ownerId, preferences]);

  const setDailyRemindersEnabled = useCallback(async (value: boolean) => {
    if (!ownerId) return;
    const next = { ...preferences, dailyRemindersEnabled: value };
    try {
      await saveNotificationPreferences(ownerId, next);
      setPreferences(next);
      setPreferencesOwnerId(ownerId);
    } catch {
      // Keep the prior value if device storage cannot save the preference.
    }
  }, [ownerId, preferences]);

  const sendStepGoalReached = useCallback(async (steps: number, goal: number) => {
    if (!ownerId) return;
    const title = t('notifications.stepGoalTitle');
    const body = t('notifications.stepGoalBody', { steps, goal });
    await notifyStepGoalReached(ownerId, steps, goal, title, body);
    await refresh();
  }, [ownerId, refresh, t]);

  const value = useMemo(() => {
    const visibleItems = itemsOwnerId === ownerId ? items : [];
    const activePreferences = preferencesOwnerId === ownerId ? preferences : basePreferences;
    return {
      items: visibleItems,
      unreadCount: visibleItems.reduce((count, item) => count + (item.readAt ? 0 : 1), 0),
      remoteInboxStatus: remoteStatusState?.ownerId === ownerId ? remoteStatusState.status : 'unknown',
      notificationsEnabled: activePreferences.notificationsEnabled,
      dailyRemindersEnabled: activePreferences.dailyRemindersEnabled,
      refresh,
      markRead: async (id: string) => {
        if (!ownerId) return;
        await markNotificationRead(ownerId, id);
        await refresh();
      },
      setNotificationsEnabled,
      setDailyRemindersEnabled,
      sendStepGoalReached,
    };
  }, [items, itemsOwnerId, ownerId, preferences, preferencesOwnerId, refresh, remoteStatusState, sendStepGoalReached, setDailyRemindersEnabled, setNotificationsEnabled]);

  return <NotificationInboxContext.Provider value={value}>{children}</NotificationInboxContext.Provider>;
}

export function useNotificationInbox() {
  const value = useContext(NotificationInboxContext);
  if (!value) throw new Error('useNotificationInbox requires NotificationInboxProvider');
  return value;
}
