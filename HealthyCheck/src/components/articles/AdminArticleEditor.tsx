import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { router, usePreventRemove } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useThemedStyles } from '../../contexts/ThemeContext';
import { Colors } from '../../constants/colors';
import { useArticleEditor } from '../../hooks/useArticleEditor';
import type {
  EditorField,
  EditorIssue,
  EditorStep,
} from '../../lib/articleEditor';
import { localizeMessage } from '../../i18n/localize';
import type {
  ArticleCategory,
  ArticleDetail,
  ArticleStatus,
  ArticleTranslation,
} from '../../types/articles';
import { TextButton, PrimaryButton } from '../common/Buttons';
import {
  ArticleCategoryPicker,
  ArticleCoverUploader,
  ArticleFeaturedSwitch,
  ArticleLanguageTabs,
  ArticleSourceFields,
  ArticleTitleFields,
  EditorCard,
  EditorFieldInput,
  editorStyles,
} from './ArticleEditorFields';
import { ArticleMarkdownEditor } from './ArticleMarkdownEditor';
import {
  ArticleEditorActions,
  ArticleEditorHeader,
  ArticleEditorSteps,
  ArticleEditorValidation,
  ArticlePublishPanel,
  EditorDialog,
} from './ArticleEditorChrome';
import { ArticleEditorPreview } from './ArticleEditorPreview';

type Props = {
  initial: ArticleDetail | null;
  initialTranslations: ArticleTranslation[];
  categories: ArticleCategory[];
  reload: () => Promise<void>;
};
export function AdminArticleEditor({
  initial,
  initialTranslations,
  categories,
  reload,
}: Props) {
  const { t } = useTranslation(),
    { user } = useAuth(),
    styles = useThemedStyles(baseStyles),
    common = useThemedStyles(editorStyles),
    wide = useWindowDimensions().width >= 1000;
  const editor = useArticleEditor({
    initial,
    initialTranslations,
    categories,
    owner: user?.id ?? null,
  });
  const {
    record,
    values,
    language,
    busy,
    autosaving,
    issues,
    changeTranslation,
    chooseImage,
    suspendAutosave,
    setLanguage,
    pickedImage,
  } = editor;
  const [step, setStep] = useState<EditorStep>(0),
    [preview, setPreview] = useState(false),
    [more, setMore] = useState(false);
  const [confirm, setConfirm] = useState<
      ArticleStatus | 'delete' | 'reload' | null
    >(null),
    [leave, setLeave] = useState<(() => void) | null>(null),
    [discarded, setDiscarded] = useState(false);
  const fields = useRef<
      Partial<Record<EditorField, React.ComponentRef<typeof TextInput> | null>>
    >({}),
    scroll = useRef<React.ComponentRef<typeof ScrollView>>(null),
    [focusTarget, setFocusTarget] = useState<EditorIssue | null>(null);
  const register = useCallback(
    (
      field: EditorField,
      input: React.ComponentRef<typeof TextInput> | null
    ) => {
      fields.current[field] = input;
    },
    []
  );
  const disabled = busy || autosaving || !!editor.pickedImage,
    fieldDisabled = busy || !!editor.pickedImage;
  const changeContent = useCallback(
    (value: string) => changeTranslation('content', value),
    [changeTranslation]
  );
  const chooseContentImage = useCallback(
    (selection: { start: number; end: number }) => chooseImage(true, selection),
    [chooseImage]
  );
  const markdownIssues = useMemo(
    () => issues.filter((issue) => issue.language === language),
    [issues, language]
  );
  const disablePrevention = usePreventRemove(
    !discarded && (editor.dirty || busy || autosaving),
    ({ repeat }) => {
      if (!editor.locked()) setLeave(() => repeat);
    }
  );
  useEffect(() => {
    suspendAutosave(!!leave || !!confirm || !!pickedImage);
  }, [suspendAutosave, leave, confirm, pickedImage]);
  useEffect(() => {
    if (!focusTarget) return;
    scroll.current?.scrollTo({ y: 0, animated: false });
    const timer = setTimeout(
      () => fields.current[focusTarget.field]?.focus(),
      100
    );
    return () => clearTimeout(timer);
  }, [focusTarget]);
  const selectIssue = useCallback(
    (issue: EditorIssue) => {
      if (issue.language) setLanguage(issue.language);
      setStep(issue.step);
      setFocusTarget({ ...issue });
    },
    [setLanguage]
  );
  const attemptIssues = useRef(false);
  useEffect(() => {
    if (attemptIssues.current && issues.length) {
      attemptIssues.current = false;
      selectIssue(issues[0]);
    }
  }, [issues, selectIssue]);
  const exit = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/admin');
  };
  const finishLeave = () => {
    setDiscarded(true);
    disablePrevention();
    const next = leave;
    setLeave(null);
    next?.();
  };
  const save = async (status: ArticleStatus, thenLeave = false) => {
    attemptIssues.current = true;
    const saved = await editor.save(status);
    if (!saved) {
      // Reveal validation/network feedback in the editor while keeping removal
      // protection active. A failed save must never silently dismiss edits.
      if (thenLeave) setLeave(null);
      return;
    }
    attemptIssues.current = false;
    setConfirm(null);
    if (thenLeave) {
      finishLeave();
      return;
    }
    if (!record) {
      disablePrevention();
      router.replace({
        pathname: '/admin/editor/[id]',
        params: { id: saved.id },
      });
    }
  };
  const confirmAction = async () => {
    if (confirm === 'delete') {
      if (await editor.remove()) {
        setDiscarded(true);
        disablePrevention();
        router.replace('/admin');
      }
      return;
    }
    if (confirm === 'reload') {
      setConfirm(null);
      setDiscarded(true);
      disablePrevention();
      await reload();
      return;
    }
    if (confirm) await save(confirm);
  };
  const issueError = (field: EditorField) => {
    const issue = issues.find((i) => i.field === field);
    return issue ? t(issue.key) : undefined;
  };
  const titleFields = (
    <ArticleTitleFields
      values={values}
      language={language}
      disabled={fieldDisabled}
      issues={issues}
      register={register}
      change={editor.changeTranslation}
    />
  );
  const basic = (
    <EditorCard title={t('cms.editor.basicInfo')}>
      {!wide ? titleFields : null}
      <ArticleCategoryPicker
        categories={categories}
        value={values.category}
        onChange={(value) => editor.setField('category', value)}
        disabled={fieldDisabled}
        error={issueError('category')}
      />
      <EditorFieldInput
        field="slug"
        register={register}
        label={t('cms.slug')}
        value={values.slug}
        onChangeText={(value) => editor.setField('slug', value)}
        editable={!fieldDisabled}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder={t('cms.editor.slugPlaceholder')}
        limit={160}
        error={issueError('slug')}
      />
      <ArticleFeaturedSwitch
        value={values.featured}
        onChange={(value) => editor.setField('featured', value)}
        disabled={fieldDisabled}
      />
      <ArticleCoverUploader
        cover={values.cover}
        disabled={disabled}
        onChoose={() => editor.chooseImage(false)}
        onRemove={() => editor.setField('cover', null)}
        error={issueError('cover')}
      />
    </EditorCard>
  );
  const markdown = (
    <ArticleMarkdownEditor
      key={language}
      content={values.translations[language].content}
      onChange={changeContent}
      onImage={chooseContentImage}
      focusRequest={focusTarget?.field === 'content' ? focusTarget : null}
      imageDisabled={disabled}
      disabled={fieldDisabled}
      wide={wide}
      readingTime={values.readingTimes[language]}
      onReadingTime={editor.setReadingTime}
      onEstimate={editor.estimate}
      issues={markdownIssues}
      register={register}
    />
  );
  const sources = (
    <ArticleSourceFields
      values={values}
      language={language}
      disabled={fieldDisabled}
      issues={issues}
      register={register}
      change={editor.changeTranslation}
      onReferences={(value) =>
        editor.setField('references', {
          ...values.references,
          [language]: value,
        })
      }
      authorId={record?.author_id ?? null}
    />
  );
  const publish = (
    <ArticlePublishPanel
      values={values}
      categories={categories}
      language={language}
      status={record?.status ?? 'draft'}
      onPreview={() => setPreview(true)}
    />
  );
  const statusKey = autosaving
    ? 'cms.editor.autosaving'
    : editor.saveState === 'conflict'
      ? 'cms.conflict'
      : editor.saveState === 'failed'
        ? 'cms.editor.saveFailed'
        : editor.dirty
          ? 'cms.editor.unsaved'
          : editor.saveState === 'saved'
            ? 'cms.editor.saved'
            : record?.status === 'draft'
              ? 'cms.editor.autosaveHint'
              : 'cms.editor.manualSaveHint';
  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={
        Platform.OS === 'ios'
          ? 'padding'
          : Platform.OS === 'android'
            ? 'height'
            : undefined
      }
    >
      <ScrollView
        ref={scroll}
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, !wide && styles.mobileContent]}
      >
        <ArticleEditorHeader
          exists={!!record}
          status={record?.status ?? 'draft'}
          onBack={exit}
          onPreview={() => setPreview(true)}
          onMore={() => setMore(true)}
          disabled={disabled}
        />
        <View style={common.row}>
          <ArticleLanguageTabs
            language={language}
            onChange={editor.setLanguage}
            disabled={fieldDisabled}
          />
          <Text
            style={[common.note, { flex: 1, minWidth: 140 }]}
            accessibilityLiveRegion="polite"
          >
            {t(statusKey)}
          </Text>
        </View>
        {!wide ? (
          <ArticleEditorSteps
            step={step}
            onChange={setStep}
            disabled={fieldDisabled}
          />
        ) : null}
        {editor.error ? (
          <Text accessibilityRole="alert" style={common.error}>
            {localizeMessage(editor.error)}
          </Text>
        ) : null}
        {editor.message &&
        (!editor.dirty || editor.message === 'cms.imageStaged') ? (
          <Text accessibilityLiveRegion="polite" style={common.note}>
            {t(editor.message)}
          </Text>
        ) : null}
        {editor.saveState === 'conflict' ? (
          <TextButton
            title={t('cms.reload')}
            onPress={() => setConfirm('reload')}
          />
        ) : null}
        <ArticleEditorValidation issues={issues} onSelect={selectIssue} />
        {wide ? (
          <View style={styles.columns}>
            <View style={styles.main}>
              <EditorCard title={t('cms.editor.articleDetails')}>
                {titleFields}
              </EditorCard>
              {markdown}
            </View>
            <View style={styles.sidebar}>
              {basic}
              {sources}
              {publish}
            </View>
          </View>
        ) : (
          <View style={{ gap: 16 }}>
            {step === 0 ? (
              basic
            ) : step === 1 ? (
              markdown
            ) : (
              <>
                {sources}
                {publish}
              </>
            )}
          </View>
        )}
        {!wide ? (
          <View style={[common.row, { justifyContent: 'space-between' }]}>
            <TextButton
              title={t('cms.editor.previous')}
              disabled={step === 0 || fieldDisabled}
              onPress={() => {
                setStep((s) => (s - 1) as EditorStep);
                scroll.current?.scrollTo({ y: 0, animated: false });
              }}
            />
            <TextButton
              title={t(step === 2 ? 'cms.preview' : 'cms.editor.next')}
              disabled={fieldDisabled}
              onPress={() => {
                if (step === 2) setPreview(true);
                else {
                  setStep((s) => (s + 1) as EditorStep);
                  scroll.current?.scrollTo({ y: 0, animated: false });
                }
              }}
            />
          </View>
        ) : null}
      </ScrollView>
      <View style={styles.footer}>
        <View style={styles.footerInner}>
          <ArticleEditorActions
            exists={!!record}
            status={record?.status ?? 'draft'}
            disabled={disabled}
            saving={busy}
            onSave={() => save(record?.status ?? 'draft')}
            onPublish={() => setConfirm('published')}
          />
        </View>
      </View>
      {preview ? (
        <ArticleEditorPreview
          visible
          onClose={() => setPreview(false)}
          values={values}
          language={language}
          onLanguage={editor.setLanguage}
          categories={categories}
        />
      ) : null}
      <EditorDialog
        visible={more}
        title={t('cms.actions')}
        onClose={() => setMore(false)}
      >
        <TextButton
          title={t('cms.preview')}
          disabled={disabled}
          onPress={() => {
            setMore(false);
            setPreview(true);
          }}
        />
        {record?.status === 'published' ? (
          <TextButton
            title={t('cms.unpublish')}
            disabled={disabled}
            onPress={() => {
              setMore(false);
              setConfirm('draft');
            }}
          />
        ) : record?.status === 'archived' ? (
          <TextButton
            title={t('cms.editor.restoreDraft')}
            disabled={disabled}
            onPress={() => {
              setMore(false);
              setConfirm('draft');
            }}
          />
        ) : null}
        {record && record.status !== 'archived' ? (
          <TextButton
            title={t('cms.archive')}
            disabled={disabled}
            onPress={() => {
              setMore(false);
              setConfirm('archived');
            }}
          />
        ) : null}
        {record ? (
          <>
            <TextButton
              title={t('cms.reload')}
              disabled={disabled}
              onPress={() => {
                setMore(false);
                setConfirm('reload');
              }}
            />
            <TextButton
              title={t('common.delete')}
              color={Colors.error}
              disabled={disabled}
              onPress={() => {
                setMore(false);
                setConfirm('delete');
              }}
            />
          </>
        ) : null}
        <TextButton
          title={t('common.cancel')}
          onPress={() => {
            setMore(false);
            exit();
          }}
        />
        <TextButton
          title={t('cms.editor.closeMenu')}
          onPress={() => setMore(false)}
        />
      </EditorDialog>
      <EditorDialog
        visible={!!confirm}
        title={t(
          confirm === 'delete'
            ? 'cms.confirmDelete'
            : confirm === 'reload'
              ? 'cms.confirmReload'
              : confirm === 'published'
                ? 'cms.confirmPublish'
                : 'cms.confirmStatus'
        )}
        onClose={() => {
          if (!disabled) setConfirm(null);
        }}
      >
        {confirm === 'published' ? (
          <Text style={common.note}>{t('cms.missingTranslationHint')}</Text>
        ) : null}
        {editor.error ? (
          <Text accessibilityRole="alert" style={common.error}>
            {localizeMessage(editor.error)}
          </Text>
        ) : null}
        {issues.length ? (
          <Text style={common.error}>
            {t('cms.editor.validationTitle', { count: issues.length })}
          </Text>
        ) : null}
        <PrimaryButton
          title={t('cms.confirm')}
          disabled={autosaving}
          loading={busy}
          onPress={async () => {
            await confirmAction();
            if (!editor.locked()) setConfirm(null);
          }}
        />
        <TextButton
          title={t('common.cancel')}
          disabled={disabled}
          onPress={() => setConfirm(null)}
        />
      </EditorDialog>
      <EditorDialog
        visible={!!editor.pickedImage}
        title={t('cms.previewImage')}
        onClose={editor.cancelImage}
      >
        {editor.pickedImage ? (
          <>
            <Image
              source={{ uri: editor.pickedImage.image.uri }}
              style={{ width: '100%', aspectRatio: 16 / 9 }}
              resizeMode="contain"
              accessibilityLabel={t('cms.coverImage')}
            />
            <Text style={common.note}>
              {t('cms.editor.imageSize', {
                size: (
                  editor.pickedImage.image.bytes.byteLength /
                  1024 /
                  1024
                ).toFixed(2),
                format: editor.pickedImage.image.mime,
              })}
            </Text>
          </>
        ) : null}
        <Text style={common.note}>{t('cms.imageRules')}</Text>
        {editor.error ? (
          <Text accessibilityRole="alert" style={common.error}>
            {localizeMessage(editor.error)}
          </Text>
        ) : null}
        <PrimaryButton
          title={t('cms.uploadImage')}
          loading={busy}
          onPress={() => editor.upload(t('cms.imageAlt'))}
        />
        <TextButton
          title={t('common.cancel')}
          disabled={busy}
          onPress={editor.cancelImage}
        />
      </EditorDialog>
      <EditorDialog
        visible={!!leave}
        title={t('cms.unsavedChanges')}
        onClose={() => setLeave(null)}
      >
        {editor.error ? (
          <Text accessibilityRole="alert" style={common.error}>
            {localizeMessage(editor.error)}
          </Text>
        ) : null}
        <PrimaryButton
          title={t('cms.editor.saveAndLeave')}
          loading={busy}
          onPress={() => save(record?.status ?? 'draft', true)}
        />
        <TextButton
          title={t('cms.discardChanges')}
          color={Colors.error}
          disabled={disabled}
          onPress={finishLeave}
        />
        <TextButton
          title={t('cms.keepEditing')}
          disabled={disabled}
          onPress={() => setLeave(null)}
        />
      </EditorDialog>
    </KeyboardAvoidingView>
  );
}
const baseStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  content: {
    padding: 24,
    gap: 20,
    width: '100%',
    maxWidth: 1440,
    alignSelf: 'center',
  },
  mobileContent: { padding: 16, gap: 16 },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: 24 },
  main: { flex: 1.8, minWidth: 0, gap: 20 },
  sidebar: { flex: 1, minWidth: 0, gap: 20 },
  footer: {
    borderTopWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  footerInner: { width: '100%', maxWidth: 1392, alignSelf: 'center' },
});
