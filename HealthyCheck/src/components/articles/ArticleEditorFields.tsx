import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  ScrollView,
  Switch,
  StyleSheet,
  type TextInputProps,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useThemedStyles } from '../../contexts/ThemeContext';
import { Colors } from '../../constants/colors';
import { categoryName, safeArticleUrl } from '../../lib/articleContent';
import type {
  EditorField,
  EditorIssue,
  EditorValues,
} from '../../lib/articleEditor';
import type { ArticleCategory, ArticleLanguage } from '../../types/articles';
import { TextButton } from '../common/Buttons';
import { ArticleImage } from './ArticleImage';

export const editorStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 20,
    padding: 20,
    gap: 16,
    minWidth: 0,
  },
  heading: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  label: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  note: { fontSize: 13, lineHeight: 20, color: Colors.textSecondary },
  error: { fontSize: 13, lineHeight: 20, color: Colors.error },
  field: { gap: 7, minWidth: 0 },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 12,
    minHeight: 48,
    color: Colors.textPrimary,
    backgroundColor: Colors.background,
    fontSize: 16,
    lineHeight: 24,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  counter: {
    fontSize: 12,
    lineHeight: 18,
    color: Colors.textSecondary,
    textAlign: 'right',
  },
  selected: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
  },
  tab: {
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  dialog: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '85%',
    padding: 20,
    gap: 16,
    borderRadius: 20,
    backgroundColor: Colors.surface,
  },
  option: {
    minHeight: 48,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cover: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
export function EditorCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const s = useThemedStyles(editorStyles);
  return (
    <View style={s.card}>
      <Text accessibilityRole="header" style={s.heading}>
        {title}
      </Text>
      {children}
    </View>
  );
}
export type InputRegistry = (
  field: EditorField,
  input: React.ComponentRef<typeof TextInput> | null
) => void;
export function EditorFieldInput({
  label,
  error,
  limit,
  register,
  field,
  ...props
}: TextInputProps & {
  label: string;
  error?: string;
  limit?: number;
  register?: InputRegistry;
  field: EditorField;
}) {
  const s = useThemedStyles(editorStyles),
    { t } = useTranslation(),
    [height, setHeight] = useState(100),
    [touched, setTouched] = useState(false);
  const value = props.value ?? '';
  const lengthKey =
    field === 'title'
      ? 'cms.editor.titleLong'
      : field === 'summary'
        ? 'cms.editor.summaryLong'
        : 'cms.invalidSlug';
  const localError =
    limit && value.length > limit
      ? t(lengthKey)
      : touched && field === 'title' && !value.trim()
        ? t('cms.editor.titleRequired')
        : touched && field === 'slug' && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(value)
          ? t('cms.invalidSlug')
          : field === 'readingTime' &&
              (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 120)
            ? t('cms.invalidReadingTime')
            : touched &&
                field === 'source_url' &&
                value &&
                !safeArticleUrl(value)
              ? t('cms.editor.sourceUrlInvalid')
              : undefined;
  const feedback = error ?? localError;
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        {...props}
        ref={(input) => register?.(field, input)}
        onBlur={(event) => {
          setTouched(true);
          props.onBlur?.(event);
        }}
        accessibilityLabel={label}
        placeholderTextColor={Colors.textMuted}
        style={[
          s.input,
          props.multiline && {
            minHeight: 100,
            height,
            maxHeight: 220,
            textAlignVertical: 'top',
          },
          feedback && { borderColor: Colors.error },
          props.style,
        ]}
        onContentSizeChange={
          props.multiline
            ? (event) =>
                setHeight(
                  Math.min(
                    220,
                    Math.max(100, event.nativeEvent.contentSize.height + 24)
                  )
                )
            : undefined
        }
      />
      {limit ? (
        <Text
          style={[(props.value?.length ?? 0) > limit ? s.error : s.counter]}
        >
          {t('cms.editor.characters', {
            count: props.value?.length ?? 0,
            limit,
          })}
        </Text>
      ) : null}
      {feedback ? (
        <Text accessibilityRole="alert" style={s.error}>
          {feedback}
        </Text>
      ) : null}
    </View>
  );
}
export function ArticleLanguageTabs({
  language,
  onChange,
  disabled = false,
}: {
  language: ArticleLanguage;
  onChange: (l: ArticleLanguage) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation(),
    s = useThemedStyles(editorStyles);
  return (
    <View style={s.row} accessibilityRole="tablist">
      {(['vi', 'en'] as const).map((l) => (
        <Pressable
          key={l}
          accessibilityRole="tab"
          accessibilityLabel={t(`cms.languages.${l}`)}
          accessibilityState={{ selected: language === l, disabled }}
          disabled={disabled}
          onPress={() => onChange(l)}
          style={[s.tab, language === l && s.selected]}
        >
          <Text style={[s.label, language === l && { color: Colors.primary }]}>
            {t(`cms.languages.${l}`)}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
export function ArticleCategoryPicker({
  categories,
  value,
  onChange,
  disabled,
  error,
}: {
  categories: ArticleCategory[];
  value: string;
  onChange: (id: string) => void;
  disabled: boolean;
  error?: string;
}) {
  const [open, setOpen] = useState(false),
    { t, i18n } = useTranslation(),
    s = useThemedStyles(editorStyles),
    selected = categories.find((c) => c.id === value);
  const name = (c: ArticleCategory) =>
    categoryName(c, i18n.resolvedLanguage ?? 'vi') +
    (c.is_active ? '' : ` · ${t('cms.hidden')}`);
  return (
    <View style={s.field}>
      <Text style={s.label}>{t('cms.category')}</Text>
      <Pressable
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={t('cms.category')}
        accessibilityState={{ expanded: open, disabled }}
        onPress={() => setOpen(true)}
        style={s.option}
      >
        <Text style={[s.label, { flex: 1 }]}>
          {selected ? name(selected) : t('cms.editor.chooseCategory')}
        </Text>
        <Ionicons name="chevron-down" size={18} color={Colors.textSecondary} />
      </Pressable>
      {error ? (
        <Text accessibilityRole="alert" style={s.error}>
          {error}
        </Text>
      ) : null}
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View style={s.overlay}>
          <View style={s.dialog}>
            <Text accessibilityRole="header" style={s.heading}>
              {t('cms.category')}
            </Text>
            <ScrollView contentContainerStyle={{ gap: 8 }}>
              {categories.map((c) => (
                <Pressable
                  key={c.id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: c.id === value }}
                  accessibilityLabel={name(c)}
                  onPress={() => {
                    onChange(c.id);
                    setOpen(false);
                  }}
                  style={[s.option, c.id === value && s.selected]}
                >
                  <Text style={[s.label, { flex: 1 }]}>{name(c)}</Text>
                  {c.id === value ? (
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color={Colors.primary}
                    />
                  ) : null}
                </Pressable>
              ))}
            </ScrollView>
            <TextButton
              title={t('common.cancel')}
              onPress={() => setOpen(false)}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}
export function ArticleCoverUploader({
  cover,
  disabled,
  onChoose,
  onRemove,
  error,
}: {
  cover: string | null;
  disabled: boolean;
  onChoose: () => void;
  onRemove: () => void;
  error?: string;
}) {
  const { t } = useTranslation(),
    s = useThemedStyles(editorStyles);
  return (
    <View style={s.field}>
      <Text style={s.label}>{t('cms.coverImage')}</Text>
      {cover ? (
        <ArticleImage path={cover} label={t('cms.coverImage')} widescreen />
      ) : (
        <View style={s.cover}>
          <Ionicons name="image-outline" size={34} color={Colors.primary} />
          <Text style={s.note}>{t('cms.editor.coverHint')}</Text>
        </View>
      )}
      <View style={s.row}>
        <TextButton
          title={t('cms.uploadCover')}
          disabled={disabled}
          onPress={onChoose}
        />
        {cover ? (
          <TextButton
            title={t('cms.removeCover')}
            disabled={disabled}
            onPress={onRemove}
          />
        ) : null}
      </View>
      <Text style={s.note}>{t('cms.imageRules')}</Text>
      {error ? (
        <Text accessibilityRole="alert" style={s.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
type FieldsProps = {
  values: EditorValues;
  language: ArticleLanguage;
  disabled: boolean;
  issues: EditorIssue[];
  register: InputRegistry;
  change: (
    key: 'title' | 'summary' | 'source_name' | 'source_url',
    value: string
  ) => void;
};
export function ArticleTitleFields({
  values,
  language,
  disabled,
  issues,
  register,
  change,
}: FieldsProps) {
  const { t } = useTranslation(),
    tr = values.translations[language];
  const error = (field: EditorField) => {
    const issue = issues.find(
      (i) => i.field === field && i.language === language
    );
    return issue ? t(issue.key) : undefined;
  };
  return (
    <>
      <EditorFieldInput
        field="title"
        register={register}
        label={t('cms.articleTitle')}
        value={tr.title}
        onChangeText={(v) => change('title', v)}
        placeholder={t('cms.editor.titlePlaceholder')}
        limit={240}
        error={error('title')}
        editable={!disabled}
      />
      <EditorFieldInput
        field="summary"
        register={register}
        label={t('cms.summary')}
        value={tr.summary}
        onChangeText={(v) => change('summary', v)}
        multiline
        placeholder={t('cms.editor.summaryPlaceholder')}
        limit={1200}
        error={error('summary')}
        editable={!disabled}
      />
    </>
  );
}
export function ArticleSourceFields({
  values,
  language,
  disabled,
  issues,
  register,
  change,
  onReferences,
  authorId,
}: FieldsProps & {
  onReferences: (value: string) => void;
  authorId: string | null;
}) {
  const { t } = useTranslation(),
    s = useThemedStyles(editorStyles),
    tr = values.translations[language];
  const error = (field: EditorField) => {
    const issue = issues.find(
      (i) => i.field === field && i.language === language
    );
    return issue ? t(issue.key) : undefined;
  };
  return (
    <EditorCard title={t('cms.references')}>
      <EditorFieldInput
        field="source_name"
        register={register}
        label={t('cms.sourceName')}
        placeholder={t('cms.editor.sourcePlaceholder')}
        value={tr.source_name}
        onChangeText={(v) => change('source_name', v)}
        editable={!disabled}
        error={error('source_name')}
      />
      <EditorFieldInput
        field="source_url"
        register={register}
        label={t('cms.sourceUrl')}
        placeholder="https://"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        value={tr.source_url}
        onChangeText={(v) => change('source_url', v)}
        editable={!disabled}
        error={error('source_url')}
      />
      <EditorFieldInput
        field="references"
        register={register}
        label={t('cms.extraReferences')}
        placeholder={t('cms.editor.referencesPlaceholder')}
        multiline
        value={values.references[language]}
        onChangeText={onReferences}
        editable={!disabled}
        error={error('references')}
      />
      <Text style={s.note}>{t('cms.editor.authorHint')}</Text>
      {authorId ? (
        <Text selectable style={s.note}>
          {t('cms.editor.authorId', { id: authorId })}
        </Text>
      ) : null}
    </EditorCard>
  );
}
export function ArticleFeaturedSwitch({
  value,
  onChange,
  disabled,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  disabled: boolean;
}) {
  const { t } = useTranslation(),
    s = useThemedStyles(editorStyles);
  return (
    <View style={[s.row, { justifyContent: 'space-between' }]}>
      <Text style={[s.label, { flex: 1 }]}>{t('articles.featured')}</Text>
      <Switch
        accessibilityLabel={t('articles.featured')}
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ true: Colors.primary }}
      />
    </View>
  );
}
