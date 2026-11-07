import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import type { AppMonitorEventCode, AppMonitorEventRow } from '../types/database';

export type MonitorComponentStatus = 'ok' | 'missing' | 'unavailable';
export type MonitoredFunctionMetrics = {
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  success_rate_percent: number | null;
  average_duration_ms: number | null;
  p95_duration_ms: number | null;
};
export type SystemMonitorSnapshot = {
  checked_at: string;
  metrics_window_start: string;
  database: { status: MonitorComponentStatus; latency_ms: number };
  edge_functions: {
    ai_chat: { status: MonitorComponentStatus; http_status: number | null; latency_ms: number | null };
    food_scan: { status: MonitorComponentStatus; http_status: number | null; latency_ms: number | null };
  };
  request_metrics_available: boolean;
  request_metrics: {
    ai_chat: MonitoredFunctionMetrics;
    food_scan: MonitoredFunctionMetrics;
  };
  errors_last_24h: number | null;
};

export async function getSystemMonitorSnapshot(): Promise<SystemMonitorSnapshot> {
  const { data, error } = await supabase.functions.invoke('system-monitor', {
    body: { action: 'snapshot' },
  });
  if (error) throw error;
  return data as SystemMonitorSnapshot;
}

export async function getRecentMonitorEvents(): Promise<AppMonitorEventRow[]> {
  const { data, error } = await supabase
    .from('app_monitor_events')
    .select('id,user_id,source,severity,event_code,platform,app_version,created_at')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return data ?? [];
}

const reportedRecently = new Map<string, number>();
const REPORT_DEDUPE_MS = 60_000;

function eventCodeFor(error: unknown): AppMonitorEventCode {
  const name = error instanceof Error ? error.name : '';
  if (name === 'TypeError') return 'unhandled_type_error';
  if (name === 'ReferenceError') return 'unhandled_reference_error';
  if (name === 'SyntaxError') return 'unhandled_syntax_error';
  if (name === 'Error') return 'unhandled_js_error';
  return 'unhandled_unknown_error';
}

function platformForEvent(): AppMonitorEventRow['platform'] {
  if (Platform.OS === 'android' || Platform.OS === 'ios' || Platform.OS === 'web') return Platform.OS;
  return 'other';
}

export async function reportUnhandledAppError(error: unknown, isFatal = false): Promise<void> {
  const code = eventCodeFor(error);
  const dedupeKey = `${code}:${isFatal ? 'fatal' : 'error'}`;
  const now = Date.now();
  if (now - (reportedRecently.get(dedupeKey) ?? 0) < REPORT_DEDUPE_MS) return;
  reportedRecently.set(dedupeKey, now);

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user.id) return;
    await supabase.from('app_monitor_events').insert({
      user_id: session.user.id,
      source: 'app',
      severity: isFatal ? 'fatal' : 'error',
      event_code: code,
      platform: platformForEvent(),
      app_version: (Constants.expoConfig?.version ?? 'unknown').slice(0, 32),
    });
  } catch {
    // Monitoring must never cause or replace an application error.
  }
}

type GlobalErrorHandler = (error: unknown, isFatal?: boolean) => void;
type ErrorUtilsApi = {
  getGlobalHandler?: () => GlobalErrorHandler;
  setGlobalHandler?: (handler: GlobalErrorHandler) => void;
};

let globalHandlerInstalled = false;

export function installGlobalAppErrorReporter(): void {
  if (globalHandlerInstalled) return;
  const errorUtils = (globalThis as typeof globalThis & { ErrorUtils?: ErrorUtilsApi }).ErrorUtils;
  if (!errorUtils?.setGlobalHandler) return;

  const previousHandler = errorUtils.getGlobalHandler?.();
  errorUtils.setGlobalHandler((error, isFatal) => {
    void reportUnhandledAppError(error, Boolean(isFatal));
    previousHandler?.(error, isFatal);
  });
  globalHandlerInstalled = true;
}
