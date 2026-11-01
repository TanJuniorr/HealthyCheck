import type {
  ArticleCategory,
  ArticleInput,
  ArticleLanguage,
  ArticleRow,
  ArticleStatus,
  ArticleTranslation,
} from '../types/articles';
import {
  emptyArticleTranslation,
  parseArticleReferences,
  safeArticleUrl,
  validArticleImagePath,
} from './articleContent';

export type EditorStep = 0 | 1 | 2;
export type EditorField =
  | 'slug'
  | 'category'
  | 'cover'
  | 'title'
  | 'summary'
  | 'content'
  | 'readingTime'
  | 'source_name'
  | 'source_url'
  | 'references';
export type EditorIssue = {
  field: EditorField;
  step: EditorStep;
  key: string;
  language?: ArticleLanguage;
};
export type EditorValues = {
  slug: string;
  category: string;
  cover: string | null;
  featured: boolean;
  translations: Record<ArticleLanguage, ArticleTranslation>;
  references: Record<ArticleLanguage, string>;
  readingTimes: Record<ArticleLanguage, string>;
};
export const EDITOR_LANGUAGES: ArticleLanguage[] = ['vi', 'en'];
export function initialEditorValues(
  record: ArticleRow | null,
  translations: ArticleTranslation[],
  categories: ArticleCategory[]
): EditorValues {
  const localized = (language: ArticleLanguage) => {
    const tr =
      translations.find((tr) => tr.language === language) ??
      emptyArticleTranslation(language);
    return {
      ...tr,
      reference_links: tr.reference_links.map((reference) => ({
        ...reference,
      })),
    };
  };
  const vi = localized('vi'),
    en = localized('en');
  return {
    slug: record?.slug ?? '',
    category: record?.category_id ?? categories[0]?.id ?? '',
    cover: record?.cover_image_path ?? null,
    featured: record?.is_featured ?? false,
    translations: { vi, en },
    references: {
      vi: vi.reference_links.map((r) => `${r.name} | ${r.url}`).join('\n'),
      en: en.reference_links.map((r) => `${r.name} | ${r.url}`).join('\n'),
    },
    readingTimes: {
      vi: String(vi.reading_time_minutes),
      en: String(en.reading_time_minutes),
    },
  };
}
export function estimateArticleReadingTime(content: string) {
  return Math.min(
    120,
    Math.max(1, Math.ceil((content.trim().match(/\S+/g)?.length ?? 0) / 200))
  );
}
export function hasEditorTranslation(
  values: EditorValues,
  language: ArticleLanguage
) {
  const tr = values.translations[language];
  return (
    !!tr.id ||
    [
      tr.title,
      tr.summary,
      tr.content,
      tr.source_name,
      tr.source_url,
      values.references[language],
    ].some((v) => !!v.trim())
  );
}
export function editorPayload(
  values: EditorValues,
  status: ArticleStatus
): { article: ArticleInput; translations: ArticleTranslation[] } {
  return {
    article: {
      slug: values.slug.trim(),
      category_id: values.category,
      cover_image_path: values.cover,
      is_featured: values.featured,
      status,
    },
    translations: EDITOR_LANGUAGES.filter((l) =>
      hasEditorTranslation(values, l)
    ).map((language) => {
      const tr = values.translations[language];
      return {
        language,
        title: tr.title.trim(),
        summary: tr.summary.trim(),
        content: tr.content.trim(),
        source_name: tr.source_name.trim(),
        source_url: tr.source_url.trim(),
        reading_time_minutes: Number(values.readingTimes[language]),
        reference_links: parseArticleReferences(values.references[language]),
      };
    }),
  };
}
// Match the existing database's per-translation publication rule. A second
// language is optional, but an entered/stored translation must be complete.
export function editorIssues(
  values: EditorValues,
  status: ArticleStatus,
  categories: ArticleCategory[]
): EditorIssue[] {
  const issues: EditorIssue[] = [],
    published = status === 'published';
  const add = (
    field: EditorField,
    step: EditorStep,
    key: string,
    language?: ArticleLanguage
  ) => {
    issues.push({ field, step, key, language });
  };
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(values.slug) || values.slug.length > 160)
    add('slug', 0, 'cms.invalidSlug');
  const category = categories.find((c) => c.id === values.category);
  if (!category) add('category', 0, 'cms.editor.categoryRequired');
  else if (published && !category.is_active)
    add('category', 0, 'cms.hiddenCategory');
  if (values.cover && !validArticleImagePath(values.cover))
    add('cover', 0, 'cms.invalidImage');
  const languages = EDITOR_LANGUAGES.filter((l) =>
    hasEditorTranslation(values, l)
  );
  if (published && !languages.length)
    add('title', 0, 'cms.editor.titleRequired', 'vi');
  for (const language of languages) {
    const tr = values.translations[language];
    if (published && !tr.title.trim())
      add('title', 0, 'cms.editor.titleRequired', language);
    if (tr.title.length > 240)
      add('title', 0, 'cms.editor.titleLong', language);
    if (published && !tr.summary.trim())
      add('summary', 0, 'cms.editor.summaryRequired', language);
    if (tr.summary.length > 1200)
      add('summary', 0, 'cms.editor.summaryLong', language);
    if (published && tr.content.trim().length < 100)
      add('content', 1, 'cms.editor.contentRequired', language);
    if (tr.content.length > 100000)
      add('content', 1, 'cms.editor.contentLong', language);
    if (
      !/^\d+$/.test(values.readingTimes[language]) ||
      !Number.isInteger(Number(values.readingTimes[language])) ||
      Number(values.readingTimes[language]) < 1 ||
      Number(values.readingTimes[language]) > 120
    )
      add('readingTime', 1, 'cms.invalidReadingTime', language);
    if (published && !tr.source_name.trim())
      add('source_name', 2, 'cms.editor.sourceRequired', language);
    if (tr.source_name.length > 240)
      add('source_name', 2, 'cms.editor.sourceLong', language);
    if (
      (published || !!tr.source_url) &&
      (!safeArticleUrl(tr.source_url) || tr.source_url.length > 2048)
    )
      add('source_url', 2, 'cms.editor.sourceUrlInvalid', language);
    const refs = parseArticleReferences(values.references[language]);
    if (
      refs.length > 20 ||
      refs.some(
        (r) =>
          !r.name ||
          r.name.length > 240 ||
          r.url.length > 2048 ||
          !safeArticleUrl(r.url)
      ) ||
      values.references[language]
        .split('\n')
        .some((line) => line.trim() && !line.includes('|'))
    )
      add('references', 2, 'cms.invalidReferences', language);
    // The renderer only supports private article-image paths and safe HTTPS links.
    // Keep legacy drafts editable; report unsupported links before publication.
    if (published) {
      const links = tr.content.matchAll(/(!?)\[[^\]\n]*\]\(([^\s)]*)\)/g);
      for (const link of links) {
        if (
          link[1]
            ? !link[2].startsWith('article-image:') ||
              !validArticleImagePath(link[2].slice(14))
            : !safeArticleUrl(link[2])
        ) {
          add('content', 1, 'cms.editor.contentLinks', language);
          break;
        }
      }
    }
  }
  return issues;
}
export function insertArticleImage(
  content: string,
  selection: { start: number; end: number },
  path: string,
  alt: string
) {
  const start = Math.max(0, Math.min(content.length, selection.start)),
    end = Math.max(start, Math.min(content.length, selection.end));
  const markdown = `\n\n![${alt.replace(/[\[\]\r\n]/g, '')}](article-image:${path})\n\n`;
  return {
    content: content.slice(0, start) + markdown + content.slice(end),
    selection: { start: start + markdown.length, end: start + markdown.length },
  };
}
