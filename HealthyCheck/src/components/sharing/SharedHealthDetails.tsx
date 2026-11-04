import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Colors } from '../../constants/colors';
import { Spacing } from '../../constants/spacing';
import { Typography } from '../../constants/typography';
import { useThemedStyles } from '../../contexts/ThemeContext';
import { formatDate, formatNumber, formatTime } from '../../i18n/formatting';
import { dataError } from '../../lib/dataErrors';
import { toLocalDateKey } from '../../lib/dateUtils';
import { formatGoalDuration } from '../../lib/healthGoalPresentation';
import { formatSharingDateTime, sharingDateOptions } from '../../lib/sharingPresentation';
import { getSharedMetrics } from '../../services/sharedWithMeService';
import type { IncomingSharingInvite, SharedMetrics } from '../../types/database';
import { DataFeedback } from '../common/DataFeedback';

type DetailState = { data: SharedMetrics | null; error: string | null; loading: boolean };
const loadingState: DetailState = { data: null, error: null, loading: true };

export function SharedHealthDetails({ recipient, invite, refreshInvites }: {
  recipient: string;
  invite: IncomingSharingInvite;
  refreshInvites: () => void;
}) {
  const [state, setState] = useState(loadingState);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void getSharedMetrics(recipient, invite).then(data => {
      if (active) setState({ data, error: null, loading: false });
    }).catch(error => {
      if (active) setState({ data: null, error: dataError(error).message, loading: false });
    });
    return () => { active = false; };
  }, [recipient, invite, attempt]);

  if (!state.data) {
    return <DataFeedback isLoading={state.loading} error={state.error} refresh={async () => {
      if (state.error === 'sharedWithMe.notActive') {
        refreshInvites();
      } else {
        setState(loadingState);
        setAttempt(value => value + 1);
      }
    }}/>;
  }
  return <SharedMetricsContent invite={invite} metrics={state.data}/>;
}

export function SharedMetricsContent({ invite, metrics }: { invite: IncomingSharingInvite; metrics: SharedMetrics }) {
  const { t } = useTranslation();
  const styles = useThemedStyles(baseStyles);
  const sleep = metrics.sleep;
  const startMs = sleep ? Date.parse(sleep.start) : NaN;
  const endMs = sleep ? Date.parse(sleep.end) : NaN;
  const validSleep = Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs;
  const overnight = validSleep && toLocalDateKey(new Date(startMs)) !== toLocalDateKey(new Date(endMs));
  const nutrition = metrics.nutrition;

  if (invite.status !== 'active') return null;
  return <View style={styles.metrics}>
    {Number.isFinite(Date.parse(metrics.updatedAt))
      ? <Text style={styles.text}>{t('sharedWithMe.lastRefreshed', { date: formatSharingDateTime(metrics.updatedAt) })}</Text> : null}
    {invite.share_steps ? <View style={styles.metric}>
      <Text style={styles.title}>{t('sharedWithMe.stepsToday')}</Text>
      {metrics.stepsToday === null
        ? <Text style={styles.text}>{t('sharedWithMe.noStepsData')}</Text>
        : <Text style={styles.value}>{t('units.stepCount', { count: metrics.stepsToday, value: formatNumber(metrics.stepsToday, 0) })}</Text>}
    </View> : null}
    {invite.share_sleep ? <View style={styles.metric}>
      <Text style={styles.title}>{t('sharedWithMe.sleepLast')}</Text>
      {sleep && validSleep ? <>
        <Text style={styles.text}>{formatDate(sleep.end, sharingDateOptions)}</Text>
        <Text style={styles.value}>{formatGoalDuration((endMs - startMs) / 60_000)}</Text>
        <Text style={styles.text}>{t('sharedWithMe.sleepStarted', { time: overnight ? formatSharingDateTime(sleep.start) : formatTime(sleep.start) })}</Text>
        <Text style={styles.text}>{t('sharedWithMe.sleepEnded', { time: overnight ? formatSharingDateTime(sleep.end) : formatTime(sleep.end) })}</Text>
      </> : <Text style={styles.text}>{t(sleep ? 'sharedWithMe.invalidSleep' : 'sharedWithMe.noSleepData')}</Text>}
    </View> : null}
    {invite.share_nutrition ? <View style={styles.metric}>
      <Text style={styles.title}>{t('sharedWithMe.nutritionToday')}</Text>
      {nutrition ? <>
        <Text style={styles.value}>{formatNumber(nutrition.calories, 0)} kcal</Text>
        {(['protein', 'carbs', 'fat'] as const).map(key => nutrition[key] == null ? null :
          <Text key={key} style={styles.text}>{t(`nutrition.${key}`)} · {formatNumber(nutrition[key], 1)} g</Text>
        )}
      </> : <Text style={styles.text}>{t('sharedWithMe.noNutritionData')}</Text>}
    </View> : null}
  </View>;
}

const baseStyles = StyleSheet.create({
  metrics: { gap: Spacing.sm },
  metric: { gap: Spacing.xs, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border },
  title: { ...Typography.label, color: Colors.textPrimary },
  value: { ...Typography.sectionTitle, color: Colors.textPrimary },
  text: { ...Typography.bodySmall, color: Colors.textSecondary },
});
