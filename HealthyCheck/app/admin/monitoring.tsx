import React, { useCallback, useRef, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Colors } from '../../src/constants/colors';
import { useThemedStyles } from '../../src/contexts/ThemeContext';
import {
  getRecentMonitorEvents,
  getSystemMonitorSnapshot,
  type MonitorComponentStatus,
  type SystemMonitorSnapshot,
} from '../../src/services/systemMonitorService';
import type { AppMonitorEventRow } from '../../src/types/database';
import { TextButton } from '../../src/components/common/Buttons';
import { localizeMessage } from '../../src/i18n/localize';

function statusLabel(
  status: MonitorComponentStatus | 'configured' | 'not_configured' | 'unknown',
  t: (key: string) => string,
) {
  if (status === 'ok' || status === 'configured') return t('monitor.statusOk');
  if (status === 'missing' || status === 'not_configured') return t('monitor.statusMissing');
  if (status === 'unknown') return t('monitor.statusUnknown');
  return t('monitor.statusUnavailable');
}

function statusColor(status: MonitorComponentStatus | 'configured' | 'not_configured' | 'unknown') {
  if (status === 'ok' || status === 'configured') return Colors.success;
  if (status === 'missing' || status === 'not_configured') return Colors.warning;
  if (status === 'unknown') return Colors.textMuted;
  return Colors.error;
}

const eventLabelKey: Record<AppMonitorEventRow['event_code'], string> = {
  unhandled_js_error: 'monitor.eventJsError',
  unhandled_type_error: 'monitor.eventTypeError',
  unhandled_reference_error: 'monitor.eventReferenceError',
  unhandled_syntax_error: 'monitor.eventSyntaxError',
  unhandled_unknown_error: 'monitor.eventUnknownError',
};

export default function SystemMonitoringScreen() {
  const { t, i18n } = useTranslation();
  const styles = useThemedStyles(baseStyles);
  const [snapshot, setSnapshot] = useState<SystemMonitorSnapshot | null>(null);
  const [events, setEvents] = useState<AppMonitorEventRow[]>([]);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const active = useRef(false);
  const requestLock = useRef(false);

  const refresh = useCallback(async () => {
    if (requestLock.current) return;
    requestLock.current = true;
    if (active.current) setRefreshing(true);
    try {
      const [snapshotResult, eventsResult] = await Promise.allSettled([
        getSystemMonitorSnapshot(),
        getRecentMonitorEvents(),
      ]);
      if (active.current) {
        if (snapshotResult.status === 'fulfilled') {
          setSnapshot(snapshotResult.value);
          setSnapshotError(null);
        } else {
          setSnapshotError(localizeMessage(snapshotResult.reason));
        }
        if (eventsResult.status === 'fulfilled') {
          setEvents(eventsResult.value);
          setEventsError(null);
        } else {
          setEventsError(localizeMessage(eventsResult.reason));
        }
      }
    } finally {
      if (active.current) setRefreshing(false);
      requestLock.current = false;
    }
  }, []);

  useFocusEffect(useCallback(() => {
    active.current = true;
    void refresh();
    const timer = setInterval(() => void refresh(), 60_000);
    return () => {
      active.current = false;
      clearInterval(timer);
    };
  }, [refresh]));

  const errorsLastDay = snapshot?.errors_last_24h ?? '—';
  const requestMetrics = snapshot?.request_metrics_available ? Object.values(snapshot.request_metrics) : null;
  const totalRequests = requestMetrics?.reduce((sum, metrics) => sum + metrics.total_requests, 0) ?? '—';
  const failedRequests = requestMetrics?.reduce((sum, metrics) => sum + metrics.failed_requests, 0) ?? '—';
  const locale = i18n.resolvedLanguage?.startsWith('en') ? 'en-US' : 'vi-VN';

  const renderStatus = (
    title: string,
    status: MonitorComponentStatus | 'configured' | 'not_configured' | 'unknown',
    detail?: string,
  ) => (
    <View key={title} style={styles.statusCard}>
      <View style={[styles.statusDot, { backgroundColor: statusColor(status) }]} />
      <View style={styles.statusBody}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={[styles.statusText, { color: statusColor(status) }]}>
          {statusLabel(status, t)}
        </Text>
        {detail ? <Text style={styles.muted}>{detail}</Text> : null}
      </View>
    </View>
  );

  const functionStatus = (kind: 'ai_chat' | 'food_scan'): MonitorComponentStatus | 'unknown' =>
    snapshot?.edge_functions[kind].status ?? 'unknown';

  const endpointDetail = (kind: 'ai_chat' | 'food_scan') => {
    const endpoint = snapshot?.edge_functions[kind];
    if (!endpoint) return undefined;
    if (endpoint.latency_ms === null) return t('monitor.endpointNoLatency');
    return t('monitor.endpointLatency', {
      ms: endpoint.latency_ms,
      status: endpoint.http_status ?? '—',
    });
  };

  const renderRequestMetrics = (kind: 'ai_chat' | 'food_scan', title: string) => {
    const metrics = snapshot?.request_metrics[kind];
    return (
      <View key={kind} style={styles.metricCard}>
        <Text style={styles.cardTitle}>{title}</Text>
        {!snapshot ? (
          <Text style={styles.muted}>{t('monitor.statusUnknown')}</Text>
        ) : !snapshot.request_metrics_available || !metrics ? (
          <Text style={styles.muted}>{t('monitor.metricsUnavailable')}</Text>
        ) : metrics.total_requests === 0 ? (
          <Text style={styles.muted}>{t('monitor.noRequests')}</Text>
        ) : (
          <>
            <Text style={styles.metricTotal}>
              {t('monitor.requestTotal', { count: metrics.total_requests })}
            </Text>
            <View style={styles.metricRow}>
              <Text style={styles.muted}>{t('monitor.requestSuccess')}</Text>
              <Text style={[styles.metricValue, { color: Colors.success }]}>
                {metrics.successful_requests}
              </Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.muted}>{t('monitor.requestFailure')}</Text>
              <Text style={[styles.metricValue, { color: metrics.failed_requests ? Colors.error : Colors.textPrimary }]}>
                {metrics.failed_requests}
              </Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.muted}>{t('monitor.successRate')}</Text>
              <Text style={styles.metricValue}>
                {metrics.success_rate_percent === null ? '—' : `${metrics.success_rate_percent}%`}
              </Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.muted}>{t('monitor.failureRate')}</Text>
              <Text style={styles.metricValue}>
                {metrics.success_rate_percent === null
                  ? '—'
                  : `${Math.round((100 - metrics.success_rate_percent) * 10) / 10}%`}
              </Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.muted}>{t('monitor.averageProcessing')}</Text>
              <Text style={styles.metricValue}>
                {metrics.average_duration_ms === null ? '—' : `${metrics.average_duration_ms} ms`}
              </Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.muted}>{t('monitor.p95Processing')}</Text>
              <Text style={styles.metricValue}>
                {metrics.p95_duration_ms === null ? '—' : `${metrics.p95_duration_ms} ms`}
              </Text>
            </View>
          </>
        )}
      </View>
    );
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={Colors.primary} />
      }
    >
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          style={styles.back}
          onPress={() => router.replace('/admin')}
        >
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </Pressable>
        <View style={styles.headerText}>
          <Text accessibilityRole="header" style={styles.title}>{t('monitor.title')}</Text>
          <Text style={styles.muted}>{t('monitor.description')}</Text>
        </View>
        <TextButton title={t('monitor.refresh')} loading={refreshing} onPress={refresh} />
      </View>

      <View style={styles.summary}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{totalRequests}</Text>
          <Text style={styles.muted}>{t('monitor.requestsLastDay')}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{failedRequests}</Text>
          <Text style={styles.muted}>{t('monitor.failedRequestsLastDay')}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{errorsLastDay}</Text>
          <Text style={styles.muted}>{t('monitor.errorsLastDay')}</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>{t('monitor.services')}</Text>
      <View style={styles.statusGrid}>
        {renderStatus(
          t('monitor.database'),
          snapshot?.database.status ?? 'unknown',
          snapshot?.database.status === 'ok'
            ? t('monitor.latency', { ms: snapshot.database.latency_ms })
            : undefined,
        )}
        {renderStatus(t('monitor.aiChat'), functionStatus('ai_chat'), endpointDetail('ai_chat'))}
        {renderStatus(t('monitor.foodScan'), functionStatus('food_scan'), endpointDetail('food_scan'))}
      </View>

      {snapshot?.checked_at ? (
        <Text style={styles.muted}>
          {t('monitor.lastChecked', { time: new Date(snapshot.checked_at).toLocaleString(locale) })}
        </Text>
      ) : null}
      {snapshotError ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {t('monitor.snapshotFailed')} {snapshotError}
        </Text>
      ) : null}

      <View style={styles.eventsHeader}>
        <Text style={styles.sectionTitle}>{t('monitor.requestsLastDay')}</Text>
        <Text style={styles.muted}>{t('monitor.realRequestsWindow')}</Text>
      </View>
      <View style={styles.metricGrid}>
        {renderRequestMetrics('ai_chat', t('monitor.aiChat'))}
        {renderRequestMetrics('food_scan', t('monitor.foodScan'))}
      </View>

      <View style={styles.eventsHeader}>
        <Text style={styles.sectionTitle}>{t('monitor.recentErrors')}</Text>
        <Text style={styles.muted}>{t('monitor.retention')}</Text>
      </View>
      {eventsError ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {t('monitor.eventsFailed')} {eventsError}
        </Text>
      ) : events.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="checkmark-circle-outline" size={28} color={Colors.success} />
          <Text style={styles.body}>{t('monitor.noErrors')}</Text>
        </View>
      ) : (
        <View style={styles.eventList}>
          {events.map(event => (
            <View key={event.id} style={styles.eventCard}>
              <Ionicons
                name={event.severity === 'fatal' ? 'alert-circle' : 'warning'}
                size={22}
                color={event.severity === 'fatal' ? Colors.error : Colors.warning}
              />
              <View style={styles.eventBody}>
                <Text style={styles.cardTitle}>{t(eventLabelKey[event.event_code])}</Text>
                <Text style={styles.muted}>
                  {event.platform} · {event.app_version} · {t(event.severity === 'fatal' ? 'monitor.fatal' : 'monitor.error')}
                </Text>
                <Text style={styles.muted}>{new Date(event.created_at).toLocaleString(locale)}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      <Text style={styles.privacy}>{t('monitor.privacy')}</Text>
    </ScrollView>
  );
}

const baseStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  content: { width: '100%', maxWidth: 1080, alignSelf: 'center', padding: 20, gap: 16 },
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 },
  back: { minWidth: 44, minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surface },
  headerText: { flex: 1, minWidth: 220, gap: 4 },
  title: { color: Colors.textPrimary, fontSize: 26, fontWeight: '700' },
  sectionTitle: { color: Colors.textPrimary, fontSize: 19, fontWeight: '700' },
  muted: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20 },
  body: { color: Colors.textPrimary, fontSize: 16, lineHeight: 23 },
  summary: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  summaryItem: { flex: 1, minWidth: 160, padding: 16, borderRadius: 14, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, gap: 5 },
  summaryValue: { color: Colors.primary, fontSize: 24, fontWeight: '700' },
  statusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statusCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, flexGrow: 1, flexBasis: 260, padding: 16, borderRadius: 14, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  statusDot: { width: 11, height: 11, marginTop: 5, borderRadius: 6 },
  statusBody: { flex: 1, gap: 4 },
  cardTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '700' },
  statusText: { fontSize: 15, fontWeight: '600' },
  latency: { color: Colors.textSecondary, fontSize: 13 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metricCard: { flexGrow: 1, flexBasis: 280, padding: 16, borderRadius: 14, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, gap: 9 },
  metricTotal: { color: Colors.primary, fontSize: 18, fontWeight: '700' },
  metricRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  metricValue: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  eventsHeader: { gap: 4, marginTop: 4 },
  eventList: { gap: 9 },
  eventCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 15, borderRadius: 12, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  eventBody: { flex: 1, gap: 3 },
  empty: { alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 110, padding: 18, borderRadius: 14, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  error: { color: Colors.error, fontSize: 14, lineHeight: 20, padding: 12, borderRadius: 10, backgroundColor: Colors.errorLight },
  privacy: { color: Colors.textMuted, fontSize: 13, lineHeight: 19, marginTop: 6 },
});
