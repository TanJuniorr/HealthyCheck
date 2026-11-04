import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Colors } from '../../constants/colors';
import { useThemedStyles } from '../../contexts/ThemeContext';
import { lowGoalNotes } from '../../lib/healthGoalPresentation';
import type { GoalValues } from '../../lib/healthGoalEditing';
import type { ProfileGender } from '../../types/database';

type Props = {
  values: Partial<Record<keyof GoalValues, number | null>>;
  gender?: ProfileGender | null;
  compact?: boolean;
};

export function GoalAdvisory({ values, gender, compact = false }: Props) {
  const { t } = useTranslation(), styles = useThemedStyles(baseStyles);
  const notes = lowGoalNotes(values, gender);
  if (!notes.length) return null;
  return <View testID="goal-advisory" style={styles.box}>
    {!compact ? <Text style={styles.title}>{t('goals.advisoryTitle')}</Text> : null}
    {notes.map(kind => <Text key={kind} style={styles.text}>{t(compact ? `goals.lowTargetShort.${kind}` : `goals.lowTarget.${kind}`)}</Text>)}
    {!compact ? <Text style={styles.text}>{t('goals.advisoryContext')}</Text> : null}
  </View>;
}
const baseStyles = StyleSheet.create({
  box: { gap: 6, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: Colors.orange, backgroundColor: Colors.orangeLight },
  title: { fontSize: 14, lineHeight: 20, fontWeight: '700', color: Colors.textPrimary },
  text: { fontSize: 13, lineHeight: 20, color: Colors.textSecondary },
});
