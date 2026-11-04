import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Colors } from '../../constants/colors';
import { useThemedStyles } from '../../contexts/ThemeContext';

type Props<T extends string> = {
  field: 'activityLevel' | 'weightGoal';
  options: readonly T[];
  value: T | '';
  onChange: (value: T) => void;
  disabled?: boolean;
  error?: string;
};

export function HealthPreferenceField<T extends string>({ field, options, value, onChange, disabled = false, error }: Props<T>) {
  const { t } = useTranslation();
  const styles = useThemedStyles(baseStyles);
  return <View style={styles.field}>
    <Text accessibilityRole="header" style={styles.label}>{t(`onboarding.${field}`)}</Text>
    <View accessibilityRole="radiogroup" accessibilityLabel={t(`onboarding.${field}`)} style={styles.options}>
      {options.map(option => {
        const selected = value === option;
        const label = t(`onboarding.${field}Options.${option}.label`);
        const description = t(`onboarding.${field}Options.${option}.description`);
        return <TouchableOpacity key={option} accessibilityRole="radio" accessibilityLabel={`${label}. ${description}`}
          accessibilityState={{ checked: selected, selected, disabled }} disabled={disabled}
          onPress={() => { if (!disabled) onChange(option); }}
          style={[styles.choice, selected && styles.selected, disabled && styles.disabled]}>
          <View style={[styles.indicator, selected && styles.selectedIndicator]}>
            {selected && <View style={styles.dot} />}
          </View>
          <View style={styles.copy}>
            <Text style={styles.choiceLabel}>{label}</Text>
            <Text style={styles.description}>{description}</Text>
          </View>
        </TouchableOpacity>;
      })}
    </View>
    {error ? <Text accessibilityRole="alert" style={styles.error}>{t(error)}</Text> : null}
  </View>;
}

const baseStyles = StyleSheet.create({
  field: { gap: 10 },
  label: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  options: { gap: 10 },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, padding: 14, borderWidth: 2, borderRadius: 14, borderColor: Colors.border, backgroundColor: Colors.white },
  selected: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  disabled: { opacity: 0.6 },
  indicator: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  selectedIndicator: { borderColor: Colors.primary },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary },
  copy: { flex: 1, gap: 4 },
  choiceLabel: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  description: { fontSize: 14, lineHeight: 21, color: Colors.textSecondary },
  error: { fontSize: 13, lineHeight: 20, color: Colors.error },
});
