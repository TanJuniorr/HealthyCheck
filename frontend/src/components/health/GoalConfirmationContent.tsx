import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Colors } from '../../constants/colors';
import { useThemedStyles } from '../../contexts/ThemeContext';
import { EDITABLE_GOAL_KEYS, type GoalChanges } from '../../lib/healthGoalEditing';
import { formatGoalAmount } from '../../lib/healthGoalPresentation';
import { formatDate } from '../../i18n/formatting';
import type { HealthGoalRow, ProfileGender } from '../../types/database';
import { PrimaryButton, TextButton } from '../common/Buttons';
import { GoalAdvisory } from './GoalAdvisory';

type Props = {
  current: HealthGoalRow | null;
  changes: GoalChanges;
  effectiveDate: string;
  gender?: ProfileGender | null;
  busy: boolean;
  error?: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
};

/** Display the captured preview, never replace it with a background refresh. */
export function GoalConfirmationContent({ current, changes, effectiveDate, gender, busy, error, onConfirm, onCancel }: Props) {
  const { t } = useTranslation(), styles = useThemedStyles(baseStyles);
  const changed = EDITABLE_GOAL_KEYS.filter(key => changes[key] !== undefined);
  const unchanged = EDITABLE_GOAL_KEYS.filter(key => changes[key] === undefined);
  return <View accessibilityViewIsModal testID="goal-confirmation" style={styles.dialog}>
    <View style={styles.header}>
      <Text accessibilityRole="header" style={styles.title}>{t('goals.confirmTitle')}</Text>
      <Text style={styles.text}>{t('goals.confirmBody', { date: formatDate(effectiveDate) })}</Text>
    </View>
    <ScrollView style={styles.scroll} contentContainerStyle={styles.body}>
      <View testID="goals-changing" style={styles.group}>
        <Text accessibilityRole="header" style={styles.groupTitle}>{t('goals.willChange')}</Text>
        {changed.map(key => <View key={key} testID={`goal-change-${key}`} style={styles.change}>
          <Text style={styles.goalName}>{t(`goals.labels.${key}`)}</Text>
          <View style={styles.valueRow}><Text style={styles.text}>{t('goals.before')}</Text><Text style={styles.amount}>{formatGoalAmount(key, current?.[key])}</Text></View>
          <View style={styles.valueRow}><Text style={styles.text}>{t('goals.after')}</Text><Text style={styles.newAmount}>{formatGoalAmount(key, changes[key])}</Text></View>
        </View>)}
      </View>
      <View testID="goals-unchanged" style={styles.group}>
        <Text accessibilityRole="header" style={styles.groupTitle}>{t('goals.keptSame')}</Text>
        {unchanged.map(key => <View key={key} testID={`goal-unchanged-${key}`} style={styles.valueRow}>
          <Text style={styles.text}>{t(`goals.labels.${key}`)}</Text><Text style={styles.amount}>{formatGoalAmount(key, current?.[key])}</Text>
        </View>)}
      </View>
      <GoalAdvisory values={{ ...current, ...changes }} gender={gender}/>
      {!current ? <Text style={styles.text}>{t('goals.completeFirst')}</Text> : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </ScrollView>
    <View style={styles.actions}>
      <PrimaryButton title={t('goals.confirmApply')} disabled={!current} loading={busy} onPress={onConfirm}/>
      <TextButton title={t('common.cancel')} disabled={busy} onPress={onCancel}/>
    </View>
  </View>;
}
const baseStyles = StyleSheet.create({
  dialog: { width: '100%', maxWidth: 560, maxHeight: '90%', borderRadius: 20, backgroundColor: Colors.white, overflow: 'hidden' },
  header: { padding: 18, paddingBottom: 14, gap: 8 },
  title: { fontSize: 20, lineHeight: 27, fontWeight: '700', color: Colors.textPrimary },
  text: { fontSize: 14, lineHeight: 21, color: Colors.textSecondary, flexShrink: 1 },
  scroll: { flexGrow: 0, flexShrink: 1 },
  body: { paddingHorizontal: 18, paddingBottom: 18, gap: 18 },
  group: { gap: 10 },
  groupTitle: { fontSize: 15, lineHeight: 22, fontWeight: '700', color: Colors.textPrimary },
  change: { padding: 12, gap: 8, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background },
  goalName: { fontSize: 15, lineHeight: 22, fontWeight: '600', color: Colors.textPrimary },
  valueRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: 6 },
  amount: { fontSize: 14, lineHeight: 21, fontWeight: '500', color: Colors.textPrimary, flexShrink: 1 },
  newAmount: { fontSize: 15, lineHeight: 22, fontWeight: '700', color: Colors.primary, flexShrink: 1 },
  actions: { padding: 14, gap: 2, borderTopWidth: 1, borderTopColor: Colors.border },
  error: { color: Colors.error, fontSize: 14, lineHeight: 21 },
});
