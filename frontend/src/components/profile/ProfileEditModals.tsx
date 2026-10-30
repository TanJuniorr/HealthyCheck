import React, { useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Colors } from '../../constants/colors';
import { Radius, Spacing } from '../../constants/spacing';
import { Typography } from '../../constants/typography';
import { formatDate } from '../../i18n/formatting';
import { BirthDateField, GenderField } from './PersonalHealthFields';
import { localizeMessage } from '../../i18n/localize';
import { dataError } from '../../lib/dataErrors';
import type { HealthGoalInsert, ProfileGender } from '../../types/database';
import { AppTextInput } from '../common/AppTextInput';
import { PrimaryButton, TextButton } from '../common/Buttons';
import { useThemedStyles } from '../../contexts/ThemeContext';

export type PersonalProfileDraft = {
  fullName: string;
  dateOfBirth: string;
  heightCm: string;
  weightKg: string;
  gender: ProfileGender | '';
};

type PersonalProfileModalProps = {
  visible: boolean;
  initial: PersonalProfileDraft;
  onClose: () => void;
  onSave: (draft: PersonalProfileDraft) => Promise<void>;
};

export function formatBirthDate(date: string) { return formatDate(date); }

export function PersonalProfileModal({ visible, initial, onClose, onSave }: PersonalProfileModalProps) {
  const styles = useThemedStyles(baseStyles);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState(initial);
  const pending=useRef(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const close = () => {
    if (!saving) {
      onClose();
    }
  };

  const save = async () => {
    if(pending.current)return;pending.current=true;
    setSaving(true);
    setError('');
    try {
      await onSave(draft);
      setSaving(false);
      onClose();
    } catch (failure) {
      setError(dataError(failure).message);
      setSaving(false);
    } finally {pending.current=false;}
  };


  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.lg, paddingBottom: insets.bottom + Spacing.xl }]}>
          <Text accessibilityRole="header" style={styles.title}>{t('profile.editPersonal')}</Text>
          <AppTextInput label={t('profile.fullName')} value={draft.fullName} onChangeText={fullName => setDraft(previous => ({ ...previous, fullName }))} autoCapitalize="words" />
          <BirthDateField value={draft.dateOfBirth} disabled={saving} onChange={dateOfBirth=>setDraft(previous=>({...previous,dateOfBirth}))}/>
          <GenderField value={draft.gender} disabled={saving} onChange={gender=>setDraft(previous=>({...previous,gender}))}/>
          <AppTextInput label={`${t('health.height')} (cm)`} value={draft.heightCm} onChangeText={heightCm => setDraft(previous => ({ ...previous, heightCm }))} keyboardType="decimal-pad" />
          <AppTextInput label={`${t('health.weight')} (kg)`} value={draft.weightKg} onChangeText={weightKg => setDraft(previous => ({ ...previous, weightKg }))} keyboardType="decimal-pad" />
          {error ? <Text accessibilityRole="alert" style={styles.error}>{localizeMessage(error)}</Text> : null}
          <PrimaryButton title={t(saving ? 'profile.saving' : 'common.save')} onPress={save} loading={saving} />
          <TextButton title={t('common.cancel')} onPress={close} disabled={saving} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

type GoalsModalProps = {
  visible: boolean;
  initial: HealthGoalInsert;
  onClose: () => void;
  onSave: (goals: EditableHealthGoals) => Promise<void>;
};

const goalKeys = ['daily_steps', 'daily_calories', 'daily_water_ml', 'target_sleep_minutes'] as const;
export type EditableHealthGoals = Required<Pick<HealthGoalInsert, (typeof goalKeys)[number]>>;

export function HealthGoalsModal({ visible, initial, onClose, onSave }: GoalsModalProps) {
  const styles = useThemedStyles(baseStyles);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [values, setValues] = useState<Record<(typeof goalKeys)[number], string>>({
    daily_steps: String(initial.daily_steps ?? 8000),
    daily_calories: String(initial.daily_calories ?? 2000),
    daily_water_ml: String(initial.daily_water_ml ?? 2000),
    target_sleep_minutes: String(initial.target_sleep_minutes ?? 480),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const close = () => { if (!saving) onClose(); };
  const save = async () => {
    const parsed = Object.fromEntries(goalKeys.map(key => [key, Number(values[key].trim())])) as EditableHealthGoals;
    if (goalKeys.some(key => !values[key].trim() || !Number.isInteger(parsed[key]) || parsed[key] <= 0)) {
      setError('profile.invalidGoals');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave(parsed);
      setSaving(false);
      onClose();
    } catch (failure) {
      setError(dataError(failure).message);
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.lg, paddingBottom: insets.bottom + Spacing.xl }]}>
          <Text accessibilityRole="header" style={styles.title}>{t('profile.editGoals')}</Text>
          <Text style={styles.hint}>{t('profile.goalsApplyEverywhere')}</Text>
          {goalKeys.map(key => <AppTextInput key={key} label={t(`fields.${key}`)} value={values[key]} onChangeText={value => setValues(previous => ({ ...previous, [key]: value }))} keyboardType="numeric" />)}
          {error ? <Text accessibilityRole="alert" style={styles.error}>{localizeMessage(error)}</Text> : null}
          <PrimaryButton title={t(saving ? 'profile.saving' : 'settings.saveGoals')} onPress={save} loading={saving} />
          <TextButton title={t('common.cancel')} onPress={close} disabled={saving} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const baseStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.screenPadding, gap: Spacing.lg, width: '100%', maxWidth: 640, alignSelf: 'center' },
  title: { ...Typography.sectionTitle, color: Colors.textPrimary },
  hint: { ...Typography.bodySmall, color: Colors.textSecondary },
  label: { ...Typography.label, color: Colors.textSecondary, marginBottom: Spacing.sm },
  field: { gap: Spacing.xs },
  dateButton: { minHeight: 52, justifyContent: 'center', paddingHorizontal: Spacing.lg, backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md },
  dateText: { ...Typography.body, color: Colors.textPrimary },
  placeholder: { color: Colors.textMuted },
  doneButton: { alignSelf: 'flex-end', minHeight: 44, justifyContent: 'center', paddingHorizontal: Spacing.md },
  doneText: { ...Typography.button, color: Colors.primary },
  genderChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  genderChoice: { minHeight: 44, justifyContent: 'center', paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.full, backgroundColor: Colors.white },
  genderChoiceSelected: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  genderChoiceText: { ...Typography.bodySmall, color: Colors.textPrimary },
  genderChoiceTextSelected: { color: Colors.primaryDark, fontWeight: '700' },
  error: { ...Typography.bodySmall, color: Colors.error },
});
