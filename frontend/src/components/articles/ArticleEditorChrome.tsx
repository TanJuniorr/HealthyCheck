import React from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useThemedStyles } from '../../contexts/ThemeContext';
import { Colors } from '../../constants/colors';
import {
  editorIssues,
  type EditorIssue,
  type EditorStep,
  type EditorValues,
} from '../../lib/articleEditor';
import type {
  ArticleCategory,
  ArticleLanguage,
  ArticleStatus,
} from '../../types/articles';
import { PrimaryButton, TextButton } from '../common/Buttons';
import { EditorCard, editorStyles } from './ArticleEditorFields';

export function ArticleEditorHeader({
  exists,
  status,
  onBack,
  onPreview,
  onMore,
  disabled,
}: {
  exists: boolean;
  status: ArticleStatus;
  onBack: () => void;
  onPreview: () => void;
  onMore: () => void;
  disabled: boolean;
}) {
  const { t } = useTranslation(),
    s = useThemedStyles(editorStyles),
    styles = useThemedStyles(baseStyles);
  return (
    <View style={styles.header}>
      <View style={[s.row, { flex: 1 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          disabled={disabled}
          onPress={onBack}
          style={styles.icon}
        >
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 100 }}>
          <Text accessibilityRole="header" style={styles.title}>
            {t(exists ? 'cms.editArticle' : 'cms.newArticle')}
          </Text>
          <Text style={styles.status}>{t(`cms.status.${status}`)}</Text>
        </View>
      </View>
      <View style={s.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('cms.preview')}
          onPress={onPreview}
          disabled={disabled}
          style={styles.icon}
        >
          <Ionicons name="eye-outline" size={22} color={Colors.primary} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('cms.actions')}
          onPress={onMore}
          disabled={disabled}
          style={styles.icon}
        >
          <Ionicons
            name="ellipsis-horizontal"
            size={22}
            color={Colors.textPrimary}
          />
        </Pressable>
      </View>
    </View>
  );
}
export function ArticleEditorSteps({
  step,
  onChange,
  disabled,
}: {
  step: EditorStep;
  onChange: (value: EditorStep) => void;
  disabled: boolean;
}) {
  const { t } = useTranslation(),
    s = useThemedStyles(editorStyles),
    styles = useThemedStyles(baseStyles);
  return (
    <View style={styles.steps} accessibilityRole="tablist">
      {([0, 1, 2] as const).map((index) => (
        <Pressable
          key={index}
          accessibilityRole="tab"
          accessibilityLabel={t('cms.editor.stepLabel', {
            step: index + 1,
            name: t(`cms.editor.steps.${index}`),
          })}
          accessibilityState={{ selected: step === index, disabled }}
          disabled={disabled}
          onPress={() => onChange(index)}
          style={[styles.step, step === index && s.selected]}
        >
          <View style={[styles.number, step >= index && styles.activeNumber]}>
            {step > index ? (
              <Ionicons name="checkmark" size={16} color={Colors.white} />
            ) : (
              <Text
                style={[s.label, step === index && { color: Colors.white }]}
              >
                {index + 1}
              </Text>
            )}
          </View>
          <Text
            style={[
              s.note,
              step === index && { color: Colors.primary, fontWeight: '700' },
              styles.stepText,
            ]}
          >
            {t(`cms.editor.steps.${index}`)}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
export function ArticleEditorValidation({
  issues,
  onSelect,
}: {
  issues: EditorIssue[];
  onSelect: (issue: EditorIssue) => void;
}) {
  const { t } = useTranslation(),
    s = useThemedStyles(editorStyles);
  if (!issues.length) return null;
  return (
    <View style={[s.card, { borderColor: Colors.error }]}>
      <Text accessibilityRole="alert" style={s.heading}>
        {t('cms.editor.validationTitle', { count: issues.length })}
      </Text>
      {issues.map((issue, i) => (
        <Pressable
          key={`${issue.field}:${issue.language}:${i}`}
          accessibilityRole="button"
          onPress={() => onSelect(issue)}
          style={{ minHeight: 44, justifyContent: 'center' }}
        >
          <Text style={s.error}>
            {issue.language ? `${t(`cms.languages.${issue.language}`)} · ` : ''}
            {t(issue.key)}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
export function ArticlePublishPanel({
  values,
  categories,
  language,
  status,
  onPreview,
}: {
  values: EditorValues;
  categories: ArticleCategory[];
  language: ArticleLanguage;
  status: ArticleStatus;
  onPreview: () => void;
}) {
  const { t } = useTranslation(),
    s = useThemedStyles(editorStyles),
    issues = editorIssues(values, 'published', categories);
  const checks = [
    { key: 'basics', ok: !issues.some((i) => i.step === 0) },
    { key: 'content', ok: !issues.some((i) => i.step === 1) },
    { key: 'sources', ok: !issues.some((i) => i.step === 2) },
  ];
  return (
    <EditorCard title={t('cms.editor.publishSettings')}>
      <Text style={s.label}>{t(`cms.status.${status}`)}</Text>
      {checks.map((check) => (
        <View key={check.key} style={s.row}>
          <Ionicons
            name={check.ok ? 'checkmark-circle' : 'ellipse-outline'}
            size={20}
            color={check.ok ? Colors.success : Colors.textMuted}
          />
          <Text style={[s.note, { flex: 1 }]}>
            {t(`cms.editor.checks.${check.key}`)}
          </Text>
        </View>
      ))}
      <Text style={s.note}>{t('cms.missingTranslationHint')}</Text>
      <Text style={s.note}>
        {t('cms.previewLanguage', { language: t(`cms.languages.${language}`) })}
      </Text>
      <TextButton title={t('cms.preview')} onPress={onPreview} />
    </EditorCard>
  );
}
export function ArticleEditorActions({
  exists,
  status,
  disabled,
  saving,
  onSave,
  onPublish,
}: {
  exists: boolean;
  status: ArticleStatus;
  disabled: boolean;
  saving: boolean;
  onSave: () => void;
  onPublish: () => void;
}) {
  const { t } = useTranslation(),
    styles = useThemedStyles(baseStyles);
  return (
    <View style={styles.actions}>
      {status === 'published' ? (
        <PrimaryButton
          title={t('cms.editor.saveChanges')}
          loading={saving}
          disabled={disabled}
          onPress={onSave}
          style={{ flex: 1 }}
        />
      ) : (
        <>
          <TextButton
            title={t(
              exists ? 'cms.editor.saveChanges' : 'cms.editor.saveDraft'
            )}
            disabled={disabled}
            loading={saving}
            onPress={onSave}
            style={styles.secondary}
          />
          <PrimaryButton
            title={t('cms.publish')}
            disabled={disabled}
            onPress={onPublish}
            style={{ flex: 1 }}
          />
        </>
      )}
    </View>
  );
}
export function EditorDialog({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const s = useThemedStyles(editorStyles);
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={s.overlay}>
        <View style={s.dialog}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: 16 }}
          >
            <Text accessibilityRole="header" style={s.heading}>
              {title}
            </Text>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
const baseStyles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    fontSize: 22,
    lineHeight: 30,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  status: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
    marginTop: 4,
  },
  icon: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: Colors.surface,
  },
  steps: { flexDirection: 'row', gap: 6 },
  step: {
    flex: 1,
    minWidth: 0,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 10,
    gap: 8,
    alignItems: 'center',
  },
  stepText: { textAlign: 'center', fontSize: 12, lineHeight: 18 },
  number: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.divider,
  },
  activeNumber: { backgroundColor: Colors.primary },
  actions: { flexDirection: 'row', gap: 10, alignItems: 'stretch' },
  secondary: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 14,
    minHeight: 50,
  },
});
