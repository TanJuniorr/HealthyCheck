import React, { useState } from 'react';
import {
  Modal,
  ScrollView,
  Text,
  View,
  StyleSheet,
  Linking,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemedStyles } from '../../contexts/ThemeContext';
import { Colors } from '../../constants/colors';
import {
  categoryName,
  parseArticleReferences,
  safeArticleUrl,
} from '../../lib/articleContent';
import type { EditorValues } from '../../lib/articleEditor';
import type { ArticleCategory, ArticleLanguage } from '../../types/articles';
import { TextButton } from '../common/Buttons';
import { ArticleImage } from './ArticleImage';
import { ArticleMarkdown } from './ArticleMarkdown';
import { ArticleLanguageTabs, editorStyles } from './ArticleEditorFields';

export function ArticleEditorPreview({
  visible,
  onClose,
  values,
  language,
  onLanguage,
  categories,
}: {
  visible: boolean;
  onClose: () => void;
  values: EditorValues;
  language: ArticleLanguage;
  onLanguage: (l: ArticleLanguage) => void;
  categories: ArticleCategory[];
}) {
  const { t } = useTranslation(),
    insets = useSafeAreaInsets(),
    s = useThemedStyles(baseStyles),
    common = useThemedStyles(editorStyles),
    [failed, setFailed] = useState(false);
  const tr = values.translations[language],
    category = categories.find((c) => c.id === values.category);
  const open = async (url: string) => {
    try {
      const safe = safeArticleUrl(url);
      if (!safe) {
        setFailed(true);
        return;
      }
      await Linking.openURL(safe);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  };
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={s.screen}>
        <ScrollView
          contentContainerStyle={[
            s.content,
            { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 28 },
          ]}
        >
          <TextButton title={t('cms.editor.closePreview')} onPress={onClose} />
          <ArticleLanguageTabs language={language} onChange={onLanguage} />
          <Text style={common.note}>
            {t('cms.previewLanguage', {
              language: t(`cms.languages.${language}`),
            })}
          </Text>
          {category ? (
            <Text style={s.category}>{categoryName(category, language)}</Text>
          ) : null}
          {values.cover ? (
            <ArticleImage
              widescreen
              path={values.cover}
              label={tr.title || t('cms.coverImage')}
            />
          ) : null}
          <Text accessibilityRole="header" style={s.title}>
            {tr.title || t('cms.untitled')}
          </Text>
          <Text style={common.note}>
            {t('cms.editor.estimatedTime', {
              minutes: values.readingTimes[language],
            })}
          </Text>
          <Text style={s.summary}>{tr.summary}</Text>
          <ArticleMarkdown content={tr.content} />
          <Text accessibilityRole="header" style={common.heading}>
            {t('cms.references')}
          </Text>
          <TextButton
            title={tr.source_name || t('cms.sourceName')}
            onPress={() => open(tr.source_url)}
          />
          {parseArticleReferences(values.references[language]).map(
            (reference, index) => (
              <TextButton
                key={index}
                title={reference.name || reference.url}
                onPress={() => open(reference.url)}
              />
            )
          )}
          {failed ? (
            <Text accessibilityRole="alert" style={common.error}>
              {t('cms.linkFailed')}
            </Text>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}
const baseStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  content: {
    width: '100%',
    maxWidth: 820,
    alignSelf: 'center',
    padding: 20,
    gap: 18,
  },
  title: {
    fontSize: 30,
    lineHeight: 40,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  summary: { fontSize: 18, lineHeight: 28, color: Colors.textSecondary },
  category: { fontSize: 14, color: Colors.primary, fontWeight: '700' },
});
