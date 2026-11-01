import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { articleSlug } from '../lib/articleContent';
import { dataError } from '../lib/dataErrors';
import {
  editorIssues,
  editorPayload,
  estimateArticleReadingTime,
  initialEditorValues,
  insertArticleImage,
  type EditorIssue,
  type EditorValues,
} from '../lib/articleEditor';
import {
  deleteArticle,
  isArticleSlugAvailable,
  saveArticle,
} from '../services/articlesService';
import {
  pickArticleImage,
  uploadArticleImage,
  type PickedArticleImage,
} from '../services/articleImages';
import type {
  ArticleCategory,
  ArticleLanguage,
  ArticleRow,
  ArticleStatus,
  ArticleTranslation,
} from '../types/articles';

type Options = {
  initial: ArticleRow | null;
  initialTranslations: ArticleTranslation[];
  categories: ArticleCategory[];
  owner: string | null;
};
type SaveState = 'idle' | 'saving' | 'saved' | 'failed' | 'conflict';
type Selection = { start: number; end: number };
const NO_ISSUES: EditorIssue[] = [];
export function useArticleEditor({
  initial,
  initialTranslations,
  categories,
  owner,
}: Options) {
  const [record, setRecord] = useState(initial);
  const [values, setValues] = useState(() =>
    initialEditorValues(initial, initialTranslations, categories)
  );
  const [savedSnapshot, setSavedSnapshot] = useState(() =>
    JSON.stringify(values)
  );
  const [language, setLanguage] = useState<ArticleLanguage>('vi');
  const [busy, setBusy] = useState(false),
    [autosaving, setAutosaving] = useState(false),
    [saveState, setSaveState] = useState<SaveState>('idle');
  const [error, setError] = useState<string | null>(null),
    [message, setMessage] = useState<string | null>(null);
  const [validationStatus, setValidationStatus] =
      useState<ArticleStatus | null>(null),
    [serverIssues, setServerIssues] = useState<EditorIssue[]>([]);
  const [pickedImage, setPickedImage] = useState<{
    image: PickedArticleImage;
    inline: boolean;
    language: ArticleLanguage;
    selection: Selection;
  } | null>(null);
  const lock = useRef(false),
    alive = useRef(true),
    slugManual = useRef(!!initial),
    manualReading = useRef({
      vi: !!initialTranslations.find((tr) => tr.language === 'vi'),
      en: !!initialTranslations.find((tr) => tr.language === 'en'),
    });
  const recordRef = useRef(record),
    latest = useRef(values),
    savedRef = useRef(savedSnapshot),
    conflict = useRef(false),
    suspended = useRef(false);
  const snapshot = useMemo(() => JSON.stringify(values), [values]),
    dirty = snapshot !== savedSnapshot;
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const update = useCallback((apply: (value: EditorValues) => EditorValues) => {
    const next = apply(latest.current);
    latest.current = next;
    setValues(next);
    setServerIssues([]);
  }, []);
  const setField = useCallback(
    <K extends keyof EditorValues>(key: K, value: EditorValues[K]) => {
      if (key === 'slug') slugManual.current = true;
      update((s) => ({ ...s, [key]: value }));
    },
    [update]
  );
  const changeTranslation = useCallback(
    (
      key: 'title' | 'summary' | 'content' | 'source_name' | 'source_url',
      value: string,
      target: ArticleLanguage = language
    ) => {
      update((s) => {
        const next = {
          ...s,
          translations: {
            ...s.translations,
            [target]: { ...s.translations[target], [key]: value },
          },
        };
        if (key === 'title' && !slugManual.current)
          next.slug = articleSlug(
            next.translations.vi.title || next.translations.en.title
          );
        if (key === 'content' && !manualReading.current[target])
          next.readingTimes = {
            ...s.readingTimes,
            [target]: String(estimateArticleReadingTime(value)),
          };
        return next;
      });
    },
    [language, update]
  );
  const setReadingTime = useCallback(
    (value: string) => {
      manualReading.current[language] = true;
      update((s) => ({
        ...s,
        readingTimes: { ...s.readingTimes, [language]: value },
      }));
    },
    [language, update]
  );
  const estimate = useCallback(() => {
    manualReading.current[language] = false;
    update((s) => ({
      ...s,
      readingTimes: {
        ...s.readingTimes,
        [language]: String(
          estimateArticleReadingTime(s.translations[language].content)
        ),
      },
    }));
  }, [language, update]);
  const issues = useMemo(
    () =>
      !validationStatus && !serverIssues.length
        ? NO_ISSUES
        : [
            ...(validationStatus
              ? editorIssues(values, validationStatus, categories)
              : []),
            ...serverIssues,
          ],
    [values, validationStatus, categories, serverIssues]
  );
  const save = useCallback(
    async (
      status: ArticleStatus,
      automatic = false
    ): Promise<ArticleRow | null> => {
      if (
        lock.current ||
        !alive.current ||
        pickedImage ||
        (automatic &&
          (conflict.current ||
            suspended.current ||
            recordRef.current?.status !== 'draft'))
      )
        return null;
      const captured = latest.current,
        capturedSnapshot = JSON.stringify(captured),
        current = recordRef.current;
      if (automatic && capturedSnapshot === savedRef.current) return null;
      const problems = editorIssues(captured, status, categories);
      if (!automatic) {
        setValidationStatus(status);
        setServerIssues([]);
        setError(null);
      }
      if (problems.length) {
        if (automatic) {
          setSaveState('failed');
          setError('cms.editor.autosaveInvalid');
        }
        return null;
      }
      lock.current = true;
      if (automatic) setAutosaving(true);
      else setBusy(true);
      setSaveState('saving');
      setMessage(null);
      try {
        // Advisory preflight for a useful field error. The unique constraint remains
        // authoritative if another administrator claims the slug during this request.
        if (
          status === 'published' &&
          !(await isArticleSlugAvailable(captured.slug, current?.id ?? null))
        ) {
          if (alive.current) {
            setServerIssues([{ field: 'slug', step: 0, key: 'cms.duplicate' }]);
            setSaveState('failed');
          }
          return null;
        }
        const payload = editorPayload(captured, status);
        const saved = await saveArticle(
          current?.id ?? null,
          current?.updated_at ?? null,
          payload.article,
          payload.translations
        );
        if (!alive.current) return null;
        recordRef.current = saved;
        savedRef.current = capturedSnapshot;
        conflict.current = false;
        setRecord(saved);
        setSavedSnapshot(capturedSnapshot);
        setSaveState('saved');
        setError(null);
        setValidationStatus(null);
        setMessage('cms.saved');
        // Never replace live form values with a response: typing during autosave must
        // remain dirty and use this returned version on the next serialized save.
        return saved;
      } catch (e) {
        if (alive.current) {
          const key = dataError(e).message;
          setError(key);
          conflict.current = key === 'cms.conflict';
          setSaveState(conflict.current ? 'conflict' : 'failed');
          if (key === 'cms.duplicate')
            setServerIssues([{ field: 'slug', step: 0, key }]);
        }
        return null;
      } finally {
        lock.current = false;
        if (alive.current) {
          setBusy(false);
          setAutosaving(false);
        }
      }
    },
    [categories, pickedImage]
  );
  const [pauseAutosave, setPauseAutosave] = useState(false);
  const suspendAutosave = useCallback((value: boolean) => {
    suspended.current = value;
    setPauseAutosave(value);
  }, []);
  useEffect(() => {
    if (
      !record ||
      record.status !== 'draft' ||
      !dirty ||
      busy ||
      autosaving ||
      pickedImage ||
      pauseAutosave ||
      saveState === 'conflict' ||
      saveState === 'failed'
    )
      return;
    const timer = setTimeout(() => {
      void save('draft', true);
    }, 12000);
    return () => clearTimeout(timer);
  }, [
    snapshot,
    record,
    dirty,
    busy,
    autosaving,
    pickedImage,
    pauseAutosave,
    saveState,
    save,
  ]);
  const chooseImage = useCallback(
    async (inline: boolean, selection: Selection = { start: 0, end: 0 }) => {
      if (lock.current || pickedImage) return;
      if (!recordRef.current) {
        setError('cms.saveBeforeImage');
        return;
      }
      if (!owner) return;
      lock.current = true;
      setBusy(true);
      setError(null);
      setMessage(null);
      try {
        const image = await pickArticleImage(owner);
        if (image && alive.current)
          setPickedImage({ image, inline, language, selection });
      } catch (e) {
        if (alive.current) setError(dataError(e).message);
      } finally {
        lock.current = false;
        if (alive.current) setBusy(false);
      }
    },
    [owner, language, pickedImage]
  );
  const upload = async (alt: string) => {
    if (lock.current || !recordRef.current || !owner || !pickedImage) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      const path = await uploadArticleImage(
        recordRef.current.id,
        owner,
        pickedImage.image
      );
      if (!path || !alive.current) return;
      if (pickedImage.inline) {
        const tr = latest.current.translations[pickedImage.language];
        changeTranslation(
          'content',
          insertArticleImage(tr.content, pickedImage.selection, path, alt)
            .content,
          pickedImage.language
        );
      } else setField('cover', path);
      setPickedImage(null);
      setMessage('cms.imageStaged');
    } catch (e) {
      if (alive.current) setError(dataError(e).message);
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  };
  const remove = async () => {
    if (lock.current || !recordRef.current) return false;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      await deleteArticle(recordRef.current.id, recordRef.current.updated_at);
      return alive.current;
    } catch (e) {
      if (alive.current) setError(dataError(e).message);
      return false;
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  };
  return {
    record,
    values,
    language,
    setLanguage,
    setField,
    changeTranslation,
    setReadingTime,
    estimate,
    dirty,
    busy,
    autosaving,
    saveState,
    error,
    message,
    issues,
    save,
    chooseImage,
    upload,
    pickedImage,
    cancelImage: () => {
      if (!lock.current) setPickedImage(null);
    },
    remove,
    suspendAutosave,
    locked: () => lock.current,
  };
}
