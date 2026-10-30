import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Notification } from 'expo-notifications';
import { toLocalDateKey } from '../lib/dateUtils';
import { supabase } from '../lib/supabase';

export type InboxNotification = {
  id: string;
  title: string;
  body: string;
  receivedAt: string;
  readAt: string | null;
  source?: 'local' | 'remote';
  kind?: string;
  payload?: Record<string, unknown>;
};

const STORAGE_PREFIX = 'healthy-check:notification-inbox:';
const MAX_NOTIFICATIONS = 100;
let writeQueue: Promise<void> = Promise.resolve();
export type RemoteInboxStatus = 'ready' | 'missing' | 'unknown';

function storageKey(ownerId: string) {
  return `${STORAGE_PREFIX}${ownerId}`;
}

async function getLocalNotificationInbox(ownerId: string): Promise<InboxNotification[]> {
  try {
    const stored = await AsyncStorage.getItem(storageKey(ownerId));
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is InboxNotification =>
      Boolean(item && typeof item === 'object' &&
        typeof item.id === 'string' && typeof item.title === 'string' &&
        typeof item.body === 'string' && typeof item.receivedAt === 'string' &&
        (item.readAt === null || typeof item.readAt === 'string'))
    ).map(item => ({ ...item, source: 'local' }));
  } catch {
    return [];
  }
}

export async function getNotificationInboxSnapshot(ownerId: string): Promise<{ items: InboxNotification[]; remoteStatus: RemoteInboxStatus }> {
  const localItems = await getLocalNotificationInbox(ownerId);
  try {
    const { data, error } = await supabase
      .from('app_notifications')
      .select('id,kind,payload,created_at,read_at')
      .eq('recipient_user_id', ownerId)
      .order('created_at', { ascending: false })
      .limit(MAX_NOTIFICATIONS);
    if (error || !data) {
      const missing = error?.code === '42P01' || error?.code === 'PGRST205';
      return { items: localItems, remoteStatus: missing ? 'missing' : 'unknown' };
    }
    const remoteItems: InboxNotification[] = data.map(row => ({
      id: row.id,
      title: '',
      body: '',
      receivedAt: row.created_at,
      readAt: row.read_at,
      source: 'remote',
      kind: row.kind,
      payload: row.payload && typeof row.payload === 'object' ? row.payload : {},
    }));
    const byId = new Map<string, InboxNotification>();
    for (const item of [...localItems, ...remoteItems]) byId.set(item.id, item);
    return {
      items: [...byId.values()].sort((a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt)).slice(0, MAX_NOTIFICATIONS),
      remoteStatus: 'ready',
    };
  } catch {
    // Local reminders remain available until the app_notifications migration is applied.
    return { items: localItems, remoteStatus: 'unknown' };
  }
}

export async function getNotificationInbox(ownerId: string): Promise<InboxNotification[]> {
  return (await getNotificationInboxSnapshot(ownerId)).items;
}

async function updateInbox(ownerId: string, update: (items: InboxNotification[]) => InboxNotification[]) {
  const operation = writeQueue.then(async () => {
    const items = await getLocalNotificationInbox(ownerId);
    const next = update(items).slice(0, MAX_NOTIFICATIONS);
    await AsyncStorage.setItem(storageKey(ownerId), JSON.stringify(next));
  });
  writeQueue = operation.catch(() => {});
  await operation;
}

export async function saveReceivedNotification(ownerId: string, notification: Notification): Promise<void> {
  const content = notification.request.content;
  const data = content.data ?? {};
  const deliveredAt = new Date(notification.date);
  const kind = typeof data.kind === 'string' ? data.kind : undefined;
  const explicitEventKey = typeof data.eventKey === 'string' ? data.eventKey : undefined;
  const eventKey = explicitEventKey ?? (
    kind === 'sleep_missing' || kind === 'wellness_daily' || kind === 'healthycheck-sleep'
      ? `${kind}:${toLocalDateKey(deliveredAt)}`
      : undefined
  );
  const id = eventKey ?? notification.request.identifier;
  if (!id) return;
  const payload = Object.fromEntries(Object.entries(data).filter(([key]) => key !== 'owner'));
  const item: InboxNotification = {
    id,
    title: content.title?.trim() || content.subtitle?.trim() || 'Healthy Check',
    body: content.body?.trim() || '',
    receivedAt: deliveredAt.toISOString(),
    readAt: null,
    source: 'local',
    kind,
    payload,
  };
  await updateInbox(ownerId, items => {
    const previous = items.find(existing => existing.id === id);
    return [previous ? { ...item, readAt: previous.readAt } : item, ...items.filter(existing => existing.id !== id)];
  });
}

export async function markNotificationRead(ownerId: string, id: string): Promise<void> {
  const items = await getNotificationInbox(ownerId);
  const item = items.find(existing => existing.id === id);
  if (item?.source === 'remote') {
    await supabase
      .from('app_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)
      .eq('recipient_user_id', ownerId);
    return;
  }
  await updateInbox(ownerId, localItems => localItems.map(entry => entry.id === id && !entry.readAt
    ? { ...entry, readAt: new Date().toISOString() }
    : entry));
}
