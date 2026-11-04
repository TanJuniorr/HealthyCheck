import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useThemedStyles } from '../../contexts/ThemeContext';
import { Colors } from '../../constants/colors';
import {
  formatArticleSelection,
  type MarkdownFormat,
} from '../../lib/articleContent';
import {
  estimateArticleReadingTime,
  type EditorIssue,
} from '../../lib/articleEditor';
import { ArticleMarkdown } from './ArticleMarkdown';
import {
  EditorFieldInput,
  editorStyles,
  type InputRegistry,
} from './ArticleEditorFields';
import { TextButton } from '../common/Buttons';

const tools: {
  kind: MarkdownFormat;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
}[] = [
  { kind: 'h2', icon: 'format-header-2' },
  { kind: 'h3', icon: 'format-header-3' },
  { kind: 'bold', icon: 'format-bold' },
  { kind: 'italic', icon: 'format-italic' },
  { kind: 'list', icon: 'format-list-bulleted' },
  { kind: 'ordered', icon: 'format-list-numbered' },
  { kind: 'quote', icon: 'format-quote-close' },
  { kind: 'link', icon: 'link-variant' },
];
type Selection = { start: number; end: number };
type Edit = { content: string; selection: Selection };
export const ArticleMarkdownEditor = React.memo(function ArticleMarkdownEditor({
  content,
  onChange,
  onImage,
  disabled,
  imageDisabled = disabled,
  focusRequest,
  wide,
  readingTime,
  onReadingTime,
  onEstimate,
  issues,
  register,
}: {
  content: string;
  onChange: (value: string) => void;
  onImage: (selection: Selection) => void;
  disabled: boolean;
  imageDisabled?: boolean;
  focusRequest?: object | null;
  wide: boolean;
  readingTime: string;
  onReadingTime: (value: string) => void;
  onEstimate: () => void;
  issues: EditorIssue[];
  register: InputRegistry;
}) {
  const { t } = useTranslation(),
    s = useThemedStyles(baseStyles),
    common = useThemedStyles(editorStyles);
  const [mode, setMode] = useState<'edit' | 'preview' | 'split'>('edit'),
    [selectionOverride, setSelectionOverride] = useState<
      Selection | undefined
    >();
  const input = useRef<React.ComponentRef<typeof TextInput>>(null),
    selection = useRef<Selection>({ start: 0, end: 0 });
  const history = useRef<{
    past: Edit[];
    future: Edit[];
    current: Edit;
    time: number;
  }>({
    past: [],
    future: [],
    current: { content, selection: { start: 0, end: 0 } },
    time: 0,
  });
  const [, refreshHistory] = useState(0);
  useEffect(() => {
    if (focusRequest) setMode('edit');
  }, [focusRequest]);
  // External content changes (an uploaded image) join this same undo history.
  useEffect(() => {
    const h = history.current;
    if (h.current.content !== content) {
      const caret = Math.max(
        0,
        Math.min(
          content.length,
          selection.current.end + content.length - h.current.content.length
        )
      );
      selection.current = { start: caret, end: caret };
      setSelectionOverride(selection.current);
      h.past.push(h.current);
      h.past = h.past.slice(-40);
      h.future = [];
      h.current = { content, selection: selection.current };
      h.time = 0;
      refreshHistory((n) => n + 1);
    }
  }, [content]);
  const edit = (next: Edit, force = false) => {
    const h = history.current,
      now = Date.now();
    if (force || now - h.time > 800) {
      h.past.push({ ...h.current, selection: selection.current });
      h.past = h.past.slice(-40);
    }
    h.future = [];
    h.current = next;
    h.time = force ? 0 : now;
    onChange(next.content);
    refreshHistory((n) => n + 1);
  };
  const apply = (kind: MarkdownFormat) => {
    const next = formatArticleSelection(
      content,
      selection.current,
      kind,
      t('cms.formatText')
    );
    if (next.content.length > 100000) return;
    edit(next, true);
    selection.current = next.selection;
    setSelectionOverride(next.selection);
    input.current?.focus();
  };
  const travel = (redo: boolean) => {
    const h = history.current,
      from = redo ? h.future : h.past,
      to = redo ? h.past : h.future,
      next = from.pop();
    if (!next) return;
    to.push(h.current);
    h.current = next;
    h.time = 0;
    selection.current = next.selection;
    setSelectionOverride(next.selection);
    onChange(next.content);
    refreshHistory((n) => n + 1);
    input.current?.focus();
  };
  const button = (
    label: string,
    icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'],
    onPress: () => void,
    off = false
  ) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || off }}
      disabled={disabled || off}
      onPress={onPress}
      style={[s.tool, (disabled || off) && s.disabled]}
    >
      <MaterialCommunityIcons
        name={icon}
        size={20}
        color={Colors.textPrimary}
      />
    </Pressable>
  );
  const contentError = issues.find((i) => i.field === 'content'),
    readingError = issues.find((i) => i.field === 'readingTime');
  return (
    <View style={common.card}>
      <View style={[common.row, { justifyContent: 'space-between' }]}>
        <Text accessibilityRole="header" style={common.heading}>
          {t('cms.editor.writeContent')}
        </Text>
        <Text style={common.note}>
          {t('cms.editor.estimatedTime', {
            minutes: estimateArticleReadingTime(content),
          })}
        </Text>
      </View>
      <View style={common.row} accessibilityRole="tablist">
        {(
          ['edit', 'preview', ...(wide ? (['split'] as const) : [])] as const
        ).map((value) => (
          <Pressable
            key={value}
            accessibilityRole="tab"
            accessibilityLabel={t(`cms.editor.mode.${value}`)}
            accessibilityState={{ selected: mode === value }}
            onPress={() => setMode(value)}
            style={[common.tab, mode === value && common.selected]}
          >
            <Text style={common.label}>{t(`cms.editor.mode.${value}`)}</Text>
          </Pressable>
        ))}
      </View>
      {mode !== 'preview' ? (
        <ScrollView
          horizontal
          keyboardShouldPersistTaps="always"
          showsHorizontalScrollIndicator
          contentContainerStyle={s.toolbar}
        >
          {tools.map((tool) =>
            button(
              t(`cms.format.${tool.kind}`),
              tool.icon,
              () => apply(tool.kind),
              false
            )
          )}
          {button(
            t('cms.insertImage'),
            'image-plus',
            () => onImage(selection.current),
            imageDisabled
          )}
          {button(
            t('cms.editor.undo'),
            'undo',
            () => travel(false),
            !history.current.past.length
          )}
          {button(
            t('cms.editor.redo'),
            'redo',
            () => travel(true),
            !history.current.future.length
          )}
        </ScrollView>
      ) : null}
      <View style={[s.panes, mode === 'split' && wide && s.split]}>
        {mode !== 'preview' ? (
          <View style={s.pane}>
            <TextInput
              ref={(value) => {
                input.current = value;
                register('content', value);
              }}
              accessibilityLabel={t('cms.content')}
              value={content}
              onChangeText={(value) => {
                setSelectionOverride(undefined);
                edit({ content: value, selection: selection.current });
              }}
              onSelectionChange={(event) => {
                selection.current = event.nativeEvent.selection;
                setSelectionOverride(undefined);
              }}
              selection={selectionOverride}
              editable={!disabled}
              multiline
              maxLength={100000}
              placeholder={t('cms.editor.contentPlaceholder')}
              placeholderTextColor={Colors.textMuted}
              style={s.editor}
              textAlignVertical="top"
            />
            <Text style={common.counter}>
              {t('cms.editor.characters', {
                count: content.length,
                limit: 100000,
              })}
            </Text>
          </View>
        ) : null}
        {mode !== 'edit' ? (
          <View style={s.pane}>
            {content.trim() ? (
              <ArticleMarkdown content={content} />
            ) : (
              <Text style={common.note}>{t('cms.editor.previewEmpty')}</Text>
            )}
          </View>
        ) : null}
      </View>
      {contentError ? (
        <Text accessibilityRole="alert" style={common.error}>
          {t(contentError.key)}
        </Text>
      ) : null}
      <EditorFieldInput
        field="readingTime"
        register={register}
        label={t('cms.readingTime')}
        value={readingTime}
        onChangeText={onReadingTime}
        keyboardType="number-pad"
        maxLength={3}
        editable={!disabled}
        error={readingError ? t(readingError.key) : undefined}
      />
      <TextButton
        title={t('cms.estimateReadingTime')}
        disabled={disabled}
        onPress={onEstimate}
      />
    </View>
  );
});
const baseStyles = StyleSheet.create({
  toolbar: { gap: 4, paddingVertical: 4 },
  tool: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: Colors.background,
    flexDirection: 'row',
  },
  badge: { fontSize: 11, color: Colors.textSecondary },
  disabled: { opacity: 0.35 },
  panes: { gap: 20 },
  split: { flexDirection: 'row' },
  pane: { flex: 1, minWidth: 0 },
  editor: {
    padding: 14,
    minHeight: 360,
    maxHeight: 620,
    fontSize: 16,
    lineHeight: 26,
    color: Colors.textPrimary,
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
});
