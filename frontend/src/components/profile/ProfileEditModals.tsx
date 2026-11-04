import React, { useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Colors } from '../../constants/colors';
import { Radius, Spacing } from '../../constants/spacing';
import { Typography } from '../../constants/typography';
import { formatDate } from '../../i18n/formatting';
import { BirthDateField, GenderField } from './PersonalHealthFields';
import { localizeMessage } from '../../i18n/localize';
import { dataError } from '../../lib/dataErrors';
import type { HealthGoalInsert, ProfileGender, ActivityLevel, WeightGoal } from '../../types/database';
import { HealthPreferenceField } from './HealthPreferenceField';
import { ACTIVITY_LEVELS, WEIGHT_GOALS } from '../../lib/healthPreferences';
import { AppTextInput } from '../common/AppTextInput';
import { PrimaryButton, TextButton } from '../common/Buttons';
import { useThemedStyles } from '../../contexts/ThemeContext';
import { GoalAdvisory } from '../health/GoalAdvisory';
import { formatGoalDuration } from '../../lib/healthGoalPresentation';

export type PersonalProfileDraft = {
  fullName: string;
  dateOfBirth: string;
  heightCm: string;
  weightKg: string;
  gender: ProfileGender | '';
  activityLevel: ActivityLevel | '';
  weightGoal: WeightGoal | '';
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
  const pending = useRef(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmingExit, setConfirmingExit] = useState(false);
  const formDisabled = saving || confirmingExit;
  const hasChanges = (Object.keys(initial) as (keyof PersonalProfileDraft)[])
    .some(field => initial[field] !== draft[field]);

  const requestClose = () => {
    if (pending.current) return;
    if (confirmingExit) {
      setConfirmingExit(false);
    } else if (hasChanges) {
      Keyboard.dismiss();
      setConfirmingExit(true);
    } else {
      onClose();
    }
  };

  const save = async () => {
    if (pending.current) return;
    pending.current = true;
    setSaving(true);
    setError('');
    try {
      await onSave(draft);
      setSaving(false);
      onClose();
    } catch (failure) {
      setError(dataError(failure).message);
      setSaving(false);
    } finally {
      pending.current = false;
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={requestClose}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.container} accessibilityElementsHidden={confirmingExit} importantForAccessibility={confirmingExit ? 'no-hide-descendants' : 'auto'}>
          <View style={[styles.editorHeader, { paddingTop: insets.top + Spacing.sm }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('profile.back')}
              accessibilityState={{ disabled: formDisabled }}
              disabled={formDisabled}
              style={styles.backButton}
              onPress={requestClose}
            >
              <Ionicons name="arrow-back" size={24} color={styles.title.color} />
            </Pressable>
            <Text accessibilityRole="header" style={[styles.title, styles.editorTitle]}>{t('profile.editPersonal')}</Text>
            <View style={styles.backButton} />
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xl }]}>
            <AppTextInput editable={!formDisabled} label={t('profile.fullName')} value={draft.fullName} onChangeText={fullName => setDraft(previous => ({ ...previous, fullName }))} autoCapitalize="words" />
            <BirthDateField value={draft.dateOfBirth} disabled={formDisabled} onChange={dateOfBirth => setDraft(previous => ({ ...previous, dateOfBirth }))}/>
            <GenderField value={draft.gender} disabled={formDisabled} onChange={gender => setDraft(previous => ({ ...previous, gender }))}/>
            <AppTextInput editable={!formDisabled} label={`${t('health.height')} (cm)`} value={draft.heightCm} onChangeText={heightCm => setDraft(previous => ({ ...previous, heightCm }))} keyboardType="decimal-pad" />
            <AppTextInput editable={!formDisabled} label={`${t('health.weight')} (kg)`} value={draft.weightKg} onChangeText={weightKg => setDraft(previous => ({ ...previous, weightKg }))} keyboardType="decimal-pad" />
            <HealthPreferenceField field="activityLevel" options={ACTIVITY_LEVELS} value={draft.activityLevel} disabled={formDisabled} onChange={activityLevel => setDraft(previous => ({ ...previous, activityLevel }))}/>
            <HealthPreferenceField field="weightGoal" options={WEIGHT_GOALS} value={draft.weightGoal} disabled={formDisabled} onChange={weightGoal => setDraft(previous => ({ ...previous, weightGoal }))}/>
            {error ? <Text accessibilityRole="alert" style={styles.error}>{localizeMessage(error)}</Text> : null}
            <PrimaryButton title={t(saving ? 'profile.saving' : 'common.save')} onPress={save} loading={saving} disabled={confirmingExit} />
            <TextButton title={t('common.cancel')} onPress={requestClose} disabled={formDisabled} />
          </ScrollView>
        </View>
        {confirmingExit ? (
          <View style={[styles.exitBackdrop, { paddingTop: insets.top + Spacing.md, paddingBottom: insets.bottom + Spacing.md }]}>
            <View accessibilityViewIsModal style={styles.exitDialog}>
              <ScrollView style={styles.exitScroll} contentContainerStyle={styles.exitContent}>
                <Text accessibilityRole="header" style={styles.title}>{t('profile.saveChangesPrompt')}</Text>
                {error ? <Text accessibilityRole="alert" style={styles.error}>{localizeMessage(error)}</Text> : null}
                <PrimaryButton title={t('profile.saveAndBack')} loading={saving} onPress={save} />
                <TextButton title={t('profile.discardChanges')} color={styles.error.color} disabled={saving} onPress={() => {
                  if (!pending.current) onClose();
                }}/>
                <TextButton title={t('profile.keepEditing')} disabled={saving} onPress={() => {
                  if (!pending.current) setConfirmingExit(false);
                }}/>
              </ScrollView>
            </View>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </Modal>
  );
}

type GoalsModalProps = {
  visible: boolean;
  initial: HealthGoalInsert;
  onClose: () => void;
  onSave: (goals: EditableHealthGoals) => Promise<void>;
  gender?: ProfileGender | null;
};

const goalKeys = ['daily_steps', 'daily_calories', 'daily_water_ml', 'target_sleep_minutes'] as const;
export type EditableHealthGoals = Required<Pick<HealthGoalInsert, (typeof goalKeys)[number]>>;

export function HealthGoalsModal({ visible, initial, onClose, onSave, gender }: GoalsModalProps) {
  const styles = useThemedStyles(baseStyles);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [values, setValues] = useState<Record<(typeof goalKeys)[number], string>>({
    daily_steps: initial.daily_steps==null?'':String(initial.daily_steps),
    daily_calories: initial.daily_calories==null?'':String(initial.daily_calories),
    daily_water_ml: initial.daily_water_ml==null?'':String(initial.daily_water_ml),
    target_sleep_minutes: initial.target_sleep_minutes==null?'':String(initial.target_sleep_minutes),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const pending=useRef(false);

  const close = () => { if (!saving) onClose(); };
  const save = async () => {
    if(pending.current)return;
    const parsed = Object.fromEntries(goalKeys.map(key => [key, Number(values[key].trim())])) as EditableHealthGoals;
    if (goalKeys.some(key => !values[key].trim() || !Number.isInteger(parsed[key]) || parsed[key] < 0 || (parsed[key]===0&&initial[key]!==0))) {
      setError('profile.invalidGoals');
      return;
    }
    pending.current=true;setSaving(true);
    setError('');
    try {
      await onSave(parsed);
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
          <Text accessibilityRole="header" style={styles.title}>{t('profile.editGoals')}</Text>
          <Text style={styles.hint}>{t('goals.manualIntro')}</Text>
          <Text style={styles.hint}>{t('goals.waterScope')}</Text>
          {goalKeys.map(key => <AppTextInput key={key} editable={!saving} label={t(`fields.${key}`)} value={values[key]} onChangeText={value => setValues(previous => ({ ...previous, [key]: value }))} keyboardType="numeric" />)}
          {values.target_sleep_minutes.trim() && Number.isInteger(Number(values.target_sleep_minutes)) && Number(values.target_sleep_minutes) >= 0 ?
            <Text style={styles.hint}>{t('goals.sleepEquivalent', { value: formatGoalDuration(Number(values.target_sleep_minutes)) })}</Text> : null}
          <GoalAdvisory gender={gender} values={Object.fromEntries(goalKeys
            .filter(key => values[key].trim() && Number.isFinite(Number(values[key])))
            .map(key => [key, Number(values[key])]))}/>
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
  editorHeader: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.screenPadding,
    paddingBottom: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  editorTitle: { flex: 1, textAlign: 'center' },
  backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  exitBackdrop: {
    position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing.screenPadding,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  exitDialog: { width: '100%', maxWidth: 460, flexShrink: 1, borderRadius: Radius.lg, backgroundColor: Colors.white },
  exitScroll: { flexGrow: 0, flexShrink: 1 },
  exitContent: { padding: Spacing.lg, gap: Spacing.sm },
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
