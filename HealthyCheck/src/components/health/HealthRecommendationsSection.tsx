import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useThemedStyles } from '../../contexts/ThemeContext';
import { Colors } from '../../constants/colors';
import { useHealthGoals, useHealthRecommendations } from '../../hooks/healthHooks';
import { useLocalToday } from '../../hooks/useLocalToday';
import type { QueryState } from '../../hooks/useHealthQuery';
import type { HealthGoalRow } from '../../types/database';
import type { HealthRecommendations } from '../../services/healthRecommendationService';
import { applyHealthGoalRecommendation, saveManualHealthGoals, type GoalSaveContext } from '../../services/healthGoalSnapshotService';
import {
  EDITABLE_GOAL_KEYS,
  RECOMMENDATION_GOAL_FIELDS,
  goalValues,
  recommendationValue,
  type RecommendationKind,
} from '../../lib/healthGoalEditing';
import { dataError } from '../../lib/dataErrors';
import { localizeMessage } from '../../i18n/localize';
import { formatNumber } from '../../i18n/formatting';
import { formatGoalAmount } from '../../lib/healthGoalPresentation';
import { GoalAdvisory } from './GoalAdvisory';
import { GoalConfirmationContent, GoalDialog } from './GoalConfirmationContent';
import { DataFeedback } from '../common/DataFeedback';
import { PrimaryButton, TextButton } from '../common/Buttons';
import { HealthGoalsModal } from '../profile/ProfileEditModals';

const kinds: RecommendationKind[] = ['calories', 'steps', 'water'];
const fields = RECOMMENDATION_GOAL_FIELDS;

type Props = {
  kinds?: RecommendationKind[];
  actual?: Partial<Record<RecommendationKind, number | null>>;
  goalsQuery?: QueryState<HealthGoalRow | null>;
  onEditProfile?: () => void;
};
type Recommendation = HealthRecommendations[RecommendationKind];
type Dialog =
  | { type: 'detail'; kind: RecommendationKind; result: Recommendation }
  | { type: 'edit'; context: GoalSaveContext }
  | {
      type: 'apply';
      context: GoalSaveContext;
      selected: RecommendationKind[];
      recommendations: Partial<HealthRecommendations>;
      waterAcknowledged: boolean;
    };

export function HealthRecommendationsSection(props: Props) {
  const { user } = useAuth();
  return <RecommendationContent key={user?.id ?? 'guest'} {...props}/>;
}

function RecommendationContent(props: Props) {
  const query = useHealthRecommendations(props.kinds ?? kinds);
  return props.goalsQuery
    ? <RecommendationPanel {...props} goalsQuery={props.goalsQuery} query={query}/>
    : <WithGoals {...props} query={query}/>;
}

function WithGoals(props: Props & { query: QueryState<Partial<HealthRecommendations>> }) {
  const date = useLocalToday();
  const goals = useHealthGoals(date);
  return <RecommendationPanel {...props} goalsQuery={goals}/>;
}

export function RecommendationPanel({
  kinds: visible = kinds, actual = {}, goalsQuery, query, onEditProfile,
}: Props & { goalsQuery: QueryState<HealthGoalRow | null>; query: QueryState<Partial<HealthRecommendations>> }) {
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const styles = useThemedStyles(baseStyles);
  const { width } = useWindowDimensions();
  const date = useLocalToday();
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const requiresReopen = ['goals.recommendationChanged', 'goals.conflict', 'goals.dayChanged'].includes(error);
  const lock = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const editProfile = onEditProfile ?? (() => router.push({ pathname: '/profile', params: { edit: 'personal' } }));
  const context = (): GoalSaveContext => ({ ownerId: user!.id, expectedGoal: goalsQuery.data, date });
  const available = !query.isLoading && !query.error ? query.data : null;
  const canChange = Boolean(user) && !goalsQuery.isLoading && !goalsQuery.error && !busy;
  const eligible = visible.filter(kind => {
    if (kind === 'water') return false;
    const value = recommendationValue(kind, available?.[kind]);
    return value !== null && value !== goalsQuery.data?.[fields[kind]];
  });
  const closeDialog = () => {
    if (!lock.current) setDialog(null);
  };
  const openApply = (selected: RecommendationKind[]) => {
    if (!canChange || !available || lock.current) return;
    setError('');
    setNotice('');
    setDialog({ type: 'apply', context: context(), selected, recommendations: available, waterAcknowledged: false });
  };
  const save = async () => {
    if (dialog?.type !== 'apply' || lock.current || requiresReopen) return;
    if (dialog.selected.includes('water') && !dialog.waterAcknowledged) return;

    lock.current = true;
    setBusy(true);
    setError('');
    try {
      await applyHealthGoalRecommendation(dialog.context, dialog.selected, dialog.recommendations, dialog.waterAcknowledged);
      if (mounted.current) {
        setDialog(null);
        setNotice('goals.saved');
      }
    } catch (failure) {
      if (mounted.current) {
        const message = dataError(failure).message;
        setError(message);
        if (message === 'goals.recommendationChanged') void query.refresh();
        if (message === 'goals.conflict') void goalsQuery.refresh();
      }
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  const units = (kind: RecommendationKind) => kind === 'calories' ? 'kcal' : kind === 'water' ? 'ml' : t('units.steps');
  const sourceLabel = (kind: RecommendationKind, result: Recommendation) => {
    if (kind === 'calories') return t('goals.calorieMethod');
    if (kind === 'water') return t('goals.fluidMethod');
    return t('recommendationMethod' in result && result.recommendationMethod === 'verified_history_progression'
      ? 'goals.historyMethod' : 'goals.startMethod');
  };
  const explain = (result: Recommendation) => {
    if (result.status === 'query_error') return localizeMessage(result.error.message);
    if ('explanationKey' in result) return t(result.explanationKey);
    if (result.status !== 'success') return t(`goals.calorieReasons.${result.reason}`);
    return t('goals.calorieDetails');
  };

  const preview = dialog?.type === 'apply' ? dialog : null;
  const editing = dialog?.type === 'edit' ? dialog.context : null;
  const detail = dialog?.type === 'detail' ? dialog : null;
  const detailValue = detail ? recommendationValue(detail.kind, detail.result) : null;

  return (
    <View style={styles.section}>
      <View style={styles.intro}>
        <Text accessibilityRole="header" style={styles.title}>{t('goals.forYou')}</Text>
        <Text style={styles.text}>{t('goals.intro')}</Text>
      </View>
      {query.isLoading || query.error ? <DataFeedback {...query}/> : null}
      {goalsQuery.isLoading || goalsQuery.error ? <DataFeedback {...goalsQuery}/> : null}
      {!goalsQuery.isLoading && !goalsQuery.error && !goalsQuery.data
        ? <Text style={styles.text}>{t('goals.completeFirst')}</Text> : null}
      {notice ? <Text accessibilityRole="alert" style={styles.success}>{t(notice)}</Text> : null}

      <View style={styles.grid}>
        {visible.map(kind => {
          const result = available?.[kind];
          const value = recommendationValue(kind, result);
          const saved = goalsQuery.data?.[fields[kind]] ?? null;
          const done = actual[kind];
          const percent = saved !== null && saved > 0 && done != null
            ? Math.max(0, Math.min(100, done / saved * 100)) : null;
          const label = kind === 'water' ? 'goals.trackedWaterGoal' : kind === 'calories' ? 'goals.currentCalorieGoal' : 'goals.current';
          const restriction = kind === 'water' && result?.status === 'needs_review' && result.reason === 'fluid_restriction';

          return (
            <View key={kind} testID={`recommendation-${kind}`} style={[styles.card, {
              width: visible.length > 1 && width >= 1100 ? '31.8%' : '100%',
              minWidth: width >= 1100 ? 240 : 0,
              flexGrow: 1,
            }]}>
              <View style={styles.heading}>
                <Text style={styles.cardTitle}>{t(`goals.kinds.${kind}`)}</Text>
                {result && value === null
                  ? <Text style={styles.badge}>{t(result.status === 'success' ? 'goals.status.needs_review' : `goals.status.${result.status}`)}</Text> : null}
              </View>
              {value !== null && result ? (
                <>
                  <Text style={styles.label}>{t(kind === 'water' ? 'goals.fluidEstimate' : 'goals.recommended')}</Text>
                  <Text style={styles.value}>{formatGoalAmount(fields[kind], value)}</Text>
                  <Text style={styles.text}>{sourceLabel(kind, result)}</Text>
                </>
              ) : null}
              {restriction ? <Text style={styles.text}>{t('goals.waterRestrictionShort')}</Text> : null}
              <View style={styles.saved}>
                <Text style={styles.label}>{t(label)}</Text>
                <Text style={styles.savedValue}>{formatGoalAmount(fields[kind], saved)}</Text>
              </View>
              <GoalAdvisory compact values={{ [fields[kind]]: saved }} gender={profile?.gender}/>
              {done != null ? <Text style={styles.text}>{t(`goals.actual.${kind}`, { value: formatNumber(done, 0), unit: units(kind) })}</Text> : null}
              {percent !== null ? (
                <View accessibilityRole="progressbar" accessibilityLabel={t('goals.savedProgress')} accessibilityValue={{ min: 0, max: 100, now: percent }} style={styles.track}>
                  <View style={[styles.fill, { width: `${percent}%` }]}/>
                </View>
              ) : null}
              {result ? <TextButton title={t('goals.details')} onPress={() => setDialog({ type: 'detail', kind, result })}/> : null}
              {result?.status === 'missing_data' ? <TextButton title={t('goals.completeProfile')} onPress={editProfile}/> : null}
              {result?.status === 'query_error' ? <TextButton title={t('common.retry')} disabled={query.isLoading} onPress={query.refresh}/> : null}
              {value !== null ? (
                <PrimaryButton
                  title={saved === value ? t('goals.alreadyCurrent') : t('goals.applyAmount', { amount: formatGoalAmount(fields[kind], value) })}
                  disabled={!canChange || saved === value}
                  onPress={() => openApply([kind])}
                />
              ) : null}
              <TextButton title={t(kind === 'water' ? 'goals.editWater' : 'goals.editManually')} disabled={!canChange} onPress={() => {
                if (canChange && !lock.current) {
                  setNotice('');
                  setDialog({ type: 'edit', context: context() });
                }
              }}/>
            </View>
          );
        })}
      </View>

      {eligible.length > 1
        ? <TextButton title={t('goals.applyEligible')} disabled={!canChange} onPress={() => openApply(eligible)}/> : null}

      {editing ? (
        <HealthGoalsModal
          key={editing.ownerId + ':' + (editing.expectedGoal?.id ?? 'new')}
          visible
          initial={goalValues(editing.expectedGoal) ?? {}}
          gender={profile?.gender}
          onClose={closeDialog}
          onSave={async values => {
            const changes = Object.fromEntries(EDITABLE_GOAL_KEYS.filter(key => values[key] !== editing.expectedGoal?.[key]).map(key => [key, values[key]]));
            if (Object.keys(changes).length) await saveManualHealthGoals(editing, changes);
            if (mounted.current) setNotice('goals.saved');
          }}
        />
      ) : null}

      {detail ? (
        <GoalDialog
          title={detail.kind === 'steps' && detailValue !== null
            ? t('goals.stepDetailsTitle', { amount: formatGoalAmount('daily_steps', detailValue) })
            : t(`goals.kinds.${detail.kind}`)}
          onClose={closeDialog}
          actions={<TextButton title={t('common.done')} onPress={closeDialog}/>}
        >
          <Text style={styles.text}>{explain(detail.result)}</Text>
          {detail.kind === 'steps' && detailValue !== null
            ? <Text style={styles.text}>{t('goals.stepDetailsNotice')}</Text> : null}
          {detail.kind === 'calories' && 'bmr' in detail.result && detail.result.status === 'success' ? (
            <Text style={styles.text}>{t('goals.energyEstimates', {
              bmr: formatNumber(detail.result.bmr, 0),
              tdee: formatNumber(detail.result.tdee, 0),
            })}</Text>
          ) : null}
          {detail.kind === 'water' && detailValue !== null
            ? <Text style={styles.text}>{t('goals.waterScope')}</Text> : null}
          <GoalAdvisory values={{ [fields[detail.kind]]: goalsQuery.data?.[fields[detail.kind]] }} gender={profile?.gender}/>
        </GoalDialog>
      ) : null}

      {preview ? (
        <GoalConfirmationContent
          current={preview.context.expectedGoal}
          changes={Object.fromEntries(preview.selected.map(kind => [fields[kind], recommendationValue(kind, preview.recommendations[kind])!]))}
          effectiveDate={preview.context.date}
          gender={profile?.gender}
          busy={busy}
          confirmDisabled={requiresReopen}
          error={error ? localizeMessage(error) : undefined}
          waterAcknowledgment={preview.selected.includes('water') ? {
            checked: preview.waterAcknowledged,
            onChange: checked => {
              if (!lock.current) setDialog(current => current?.type === 'apply' ? { ...current, waterAcknowledged: checked } : current);
            },
          } : undefined}
          onConfirm={save}
          onCancel={closeDialog}
        />
      ) : null}
    </View>
  );
}

const baseStyles = StyleSheet.create({
  section: { gap: 12, marginVertical: 20 },
  intro: { gap: 4 },
  title: { fontSize: 21, fontWeight: '700', color: Colors.textPrimary },
  text: { fontSize: 14, lineHeight: 21, color: Colors.textSecondary, flexShrink: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  card: { backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border, borderRadius: 20, padding: 18, gap: 8 },
  heading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  badge: { fontSize: 12, color: Colors.primary, fontWeight: '600', flexShrink: 1 },
  label: { fontSize: 13, color: Colors.textSecondary },
  value: { fontSize: 24, fontWeight: '800', color: Colors.primary },
  saved: { paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.border, gap: 4 },
  savedValue: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary },
  track: { height: 8, borderRadius: 4, backgroundColor: Colors.border, overflow: 'hidden' },
  fill: { height: 8, backgroundColor: Colors.primary },
  success: { color: Colors.success },
});
