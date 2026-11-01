/* global __dirname */
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  path = require('node:path');
const createLoader = require('./load-ts.cjs'),
  { uiFixture, elements } = require('./ui-fixture.cjs');
const boundary = (name) => path.resolve(__dirname, '../' + name),
  tick = () => new Promise((resolve) => setImmediate(resolve));
const A = '11111111-1111-4111-8111-111111111111',
  B = '22222222-2222-4222-8222-222222222222';
const category = {
  id: A,
  name_vi: 'Giấc ngủ',
  name_en: 'Sleep',
  is_active: true,
};
const row = {
  id: B,
  slug: 'old-slug',
  category_id: A,
  status: 'draft',
  updated_at: 'version-1',
  cover_image_path: null,
  is_featured: false,
  author_id: A,
};
const content = createLoader()('src/lib/articleContent'),
  logic = createLoader()('src/lib/articleEditor');
const complete = {
  ...content.emptyArticleTranslation('vi'),
  title: 'Giấc ngủ',
  summary: 'Một hướng dẫn',
  content: 'Nội dung đã kiểm chứng. '.repeat(10),
  source_name: 'WHO',
  source_url: 'https://www.who.int/',
};
function fixture(
  overrides = {},
  initial = row,
  initialTranslations = [],
  imageOverrides = {}
) {
  const timers = new Map(),
    writes = [],
    checks = [],
    deletions = [];
  let next = 0,
    version = 1;
  const f = uiFixture({
    __timers: {
      setTimeout(fn, ms) {
        timers.set(++next, { fn, ms });
        return next;
      },
      clearTimeout(id) {
        timers.delete(id);
      },
    },
    [boundary('src/services/articlesService.ts')]: {
      saveArticle: async (...args) => {
        writes.push(args);
        return { ...row, ...args[2], updated_at: 'version-' + ++version };
      },
      isArticleSlugAvailable: async (...args) => {
        checks.push(args);
        return true;
      },
      deleteArticle: async (...args) => {
        deletions.push(args);
      },
      ...overrides,
    },
    [boundary('src/services/articleImages.ts')]: {
      pickArticleImage: async () => ({
        uri: 'file:///image.jpg',
        mime: 'image/jpeg',
        bytes: new Uint8Array([255, 216, 255]),
      }),
      uploadArticleImage: async () => A + '/' + B + '/' + A + '.jpg',
      deleteArticleImage: () => {
        throw Error('Existing images must never be deleted automatically');
      },
      ...imageOverrides,
    },
  });
  const useEditor = f.load('src/hooks/useArticleEditor').useArticleEditor;
  const props = {
    initial,
    initialTranslations,
    categories: [category],
    owner: A,
  };
  const render = () => f.render(() => useEditor(props));
  const fire = async () => {
    const timer = [...timers.entries()].find(([, value]) => value.ms === 12000);
    assert.ok(timer, '12 second autosave is scheduled');
    timers.delete(timer[0]);
    timer[1].fn();
    await tick();
  };
  return { ...f, props, render, timers, writes, checks, deletions, fire };
}
test('editor slug folds Vietnamese, never ends in a truncated hyphen, and preserves manual and legacy slugs', () => {
  assert.equal(
    content.articleSlug('Đường dẫn Tiếng Việt!'),
    'duong-dan-tieng-viet'
  );
  assert.equal(content.articleSlug('a'.repeat(159) + ' xyz'), 'a'.repeat(159));
  const f = fixture({}, null);
  let e = f.render();
  e.changeTranslation('title', 'Đường dẫn mới');
  e = f.render();
  assert.equal(e.values.slug, 'duong-dan-moi');
  e.setField('slug', 'custom');
  e = f.render();
  e.changeTranslation('title', 'Tên khác');
  assert.equal(f.render().values.slug, 'custom');
  const g = fixture();
  g.render().changeTranslation('title', 'Tên mới cho bài cũ');
  assert.equal(g.render().values.slug, 'old-slug');
  f.unmount();
  g.unmount();
});
test('draft validation permits missing publication fields and payloads exclude server-managed metadata', () => {
  const values = logic.initialEditorValues(
    row,
    [{ ...complete, id: A, article_id: B, updated_at: 'server' }],
    [category]
  );
  values.translations.vi.summary = '';
  values.translations.vi.content = '';
  values.translations.vi.source_url = '';
  assert.equal(logic.editorIssues(values, 'draft', [category]).length, 0);
  const issues = logic.editorIssues(values, 'published', [category]);
  assert.ok(issues.some((i) => i.field === 'summary'));
  assert.ok(issues.some((i) => i.field === 'content' && i.step === 1));
  assert.ok(issues.some((i) => i.field === 'source_url' && i.step === 2));
  const payload = logic.editorPayload(values, 'draft');
  assert.equal(payload.translations[0].id, undefined);
  assert.equal(payload.translations[0].updated_at, undefined);
  assert.equal(payload.article.author_id, undefined);
});
test('publication checks entered translations, schema lengths, active categories, valid sources and private images', () => {
  const values = logic.initialEditorValues(row, [complete], [category]);
  assert.equal(logic.editorIssues(values, 'published', [category]).length, 0);
  values.translations.en.title = 'English';
  assert.ok(
    logic
      .editorIssues(values, 'published', [category])
      .some((i) => i.language === 'en' && i.field === 'content')
  );
  values.translations.en = content.emptyArticleTranslation('en');
  values.translations.vi.summary = 'x'.repeat(1201);
  assert.ok(
    logic
      .editorIssues(values, 'draft', [category])
      .some((i) => i.field === 'summary')
  );
  values.translations.vi.summary = 'valid';
  values.translations.vi.content += '\n[Bad](javascript:alert)';
  assert.ok(
    logic
      .editorIssues(values, 'published', [category])
      .some((i) => i.key === 'cms.editor.contentLinks')
  );
  values.translations.vi.content =
    complete.content + '\n![Remote](https://example.com/a.png)';
  assert.ok(
    logic
      .editorIssues(values, 'published', [category])
      .some((i) => i.key === 'cms.editor.contentLinks')
  );
  values.translations.vi.content =
    complete.content +
    '\n![Private](article-image:' +
    A +
    '/' +
    B +
    '/' +
    A +
    '.jpg)';
  assert.equal(logic.editorIssues(values, 'published', [category]).length, 0);
  values.references.vi = 'https://example.com';
  assert.ok(
    logic
      .editorIssues(values, 'draft', [category])
      .some((i) => i.field === 'references')
  );
  assert.ok(
    logic
      .editorIssues(values, 'published', [{ ...category, is_active: false }])
      .some((i) => i.key === 'cms.hiddenCategory')
  );
});
test('formatting changes only selected text and renders ordered lists and quotes through the shared renderer', () => {
  const value = 'Mở đầu\nMột\nHai\nKết';
  const start = value.indexOf('Một'),
    end = value.indexOf('\nKết');
  const formatted = content.formatArticleSelection(
    value,
    { start, end },
    'ordered',
    'Text'
  );
  assert.equal(formatted.content, 'Mở đầu\n1. Một\n2. Hai\nKết');
  const quoted = content.formatArticleSelection(
    value,
    { start, end },
    'quote',
    'Text'
  );
  assert.equal(quoted.content, 'Mở đầu\n> Một\n> Hai\nKết');
  const blocks = content.articleBlocks('1. Một\n2. Hai\n\n> Trích dẫn');
  assert.equal(blocks[1].marker, '2.');
  assert.equal(blocks[2].type, 'quote');
  const inline = logic.insertArticleImage(
    'Trước SAU',
    { start: 6, end: 6 },
    A + '/' + B + '/' + A + '.jpg',
    'Ảnh'
  );
  assert.ok(inline.content.startsWith('Trước \n\n![Ảnh]'));
  assert.ok(inline.content.endsWith('\n\nSAU'));
});
test('manual draft creation is allowed before content is complete and autosave never creates blank records', async () => {
  const f = fixture({}, null);
  let e = f.render();
  e.changeTranslation('title', 'Bản nháp');
  e = f.render();
  assert.equal(f.timers.size, 0);
  const saved = await e.save('draft');
  assert.equal(saved.status, 'draft');
  assert.equal(f.writes.length, 1);
  assert.equal(f.writes[0][0], null);
  assert.equal(f.writes[0][2].slug, 'ban-nhap');
  assert.equal(f.render().dirty, false);
  f.unmount();
  const g = fixture({}, null);
  assert.equal(await g.render().save('draft'), null);
  assert.equal(g.writes.length, 0);
  assert.ok(g.render().issues.some((i) => i.field === 'slug'));
  g.unmount();
});
test('language switching keeps both unsaved translations and reading time respects manual overrides', () => {
  const f = fixture();
  let e = f.render();
  e.changeTranslation('title', 'Tiếng Việt');
  e.changeTranslation('content', 'word '.repeat(450));
  e = f.render();
  assert.equal(e.values.readingTimes.vi, '3');
  e.setReadingTime('7');
  e.changeTranslation('content', 'word '.repeat(800));
  e.setLanguage('en');
  e = f.render();
  e.changeTranslation('title', 'English');
  e.changeTranslation('content', 'English content');
  e.setLanguage('vi');
  e = f.render();
  assert.equal(e.values.translations.vi.title, 'Tiếng Việt');
  assert.equal(e.values.translations.en.title, 'English');
  assert.equal(e.values.readingTimes.vi, '7');
  e.estimate();
  assert.equal(f.render().values.readingTimes.vi, '4');
  f.unmount();
});
test('autosave debounces for 12 seconds, serializes requests and never marks newer typing as saved', async () => {
  const pending = [],
    writes = [];
  const f = fixture({
    saveArticle: (...args) => {
      writes.push(args);
      return new Promise((resolve) => pending.push(resolve));
    },
  });
  f.render().changeTranslation('title', 'First edit');
  f.render();
  assert.equal([...f.timers.values()][0].ms, 12000);
  const previous = [...f.timers.keys()][0];
  f.render().changeTranslation('summary', 'Newer edit');
  f.render();
  assert.equal(f.timers.has(previous), false);
  await f.fire();
  assert.equal(writes.length, 1);
  let e = f.render();
  assert.equal(e.autosaving, true);
  assert.equal(e.busy, false);
  e.changeTranslation('title', 'Typing during request');
  assert.equal(await e.save('published'), null);
  assert.equal(writes.length, 1);
  pending[0]({ ...row, updated_at: 'version-2' });
  await tick();
  e = f.render();
  assert.equal(e.values.translations.vi.title, 'Typing during request');
  assert.equal(e.dirty, true);
  await f.fire();
  assert.equal(writes.length, 2);
  assert.equal(writes[1][1], 'version-2');
  assert.equal(writes[1][3][0].title, 'Typing during request');
  pending[1]({ ...row, updated_at: 'version-3' });
  await tick();
  assert.equal(f.render().dirty, false);
  f.unmount();
});
test('published and archived articles require manual saving without changing their status', async () => {
  for (const status of ['published', 'archived']) {
    const f = fixture({}, { ...row, status }, [complete]);
    f.render().changeTranslation('title', 'Updated title');
    const e = f.render();
    assert.equal(f.timers.size, 0);
    await e.save(status);
    assert.equal(f.writes[0][2].status, status);
    assert.equal(f.render().record.status, status);
    f.unmount();
  }
});
test('autosave pauses during confirmation and version conflicts stop retries without losing edits', async () => {
  let conflict,
    calls = 0;
  const f = fixture({
    saveArticle: async () => {
      calls++;
      throw conflict;
    },
  });
  conflict = new (f.load('src/lib/dataErrors').DataAccessError)(
    'CONSTRAINT',
    'cms.conflict'
  );
  let e = f.render();
  e.changeTranslation('title', 'Unsaved');
  e.suspendAutosave(true);
  f.render();
  assert.equal(f.timers.size, 0);
  e.suspendAutosave(false);
  f.render();
  assert.equal(f.timers.size, 1);
  await f.fire();
  e = f.render();
  assert.equal(e.saveState, 'conflict');
  assert.equal(e.values.translations.vi.title, 'Unsaved');
  assert.equal(e.dirty, true);
  assert.equal(f.timers.size, 0);
  e.changeTranslation('summary', 'Keep this too');
  f.render();
  assert.equal(f.timers.size, 0);
  assert.equal(calls, 1);
  f.unmount();
});
test('failed autosave retains form and staged cover; manual retry uses the original expected version', async () => {
  let attempts = 0;
  const f = fixture({
    saveArticle: async (...args) => {
      attempts++;
      assert.equal(args[1], 'version-1');
      if (attempts === 1) throw Error('Network unavailable');
      return {
        ...row,
        cover_image_path: args[2].cover_image_path,
        updated_at: 'version-2',
      };
    },
  });
  let e = f.render();
  e.changeTranslation('title', 'Keep this');
  e.setField('cover', A + '/' + B + '/' + A + '.jpg');
  f.render();
  await f.fire();
  e = f.render();
  assert.equal(e.saveState, 'failed');
  assert.equal(e.dirty, true);
  assert.equal(e.values.translations.vi.title, 'Keep this');
  assert.equal(f.timers.size, 0);
  await e.save('draft');
  e = f.render();
  assert.equal(e.dirty, false);
  assert.equal(e.record.cover_image_path, A + '/' + B + '/' + A + '.jpg');
  f.unmount();
});
test('late response from an unmounted article cannot replace another editor session', async () => {
  let release;
  const a = fixture({
    saveArticle: () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  });
  a.render().changeTranslation('title', 'Article A');
  const saving = a.render().save('draft');
  a.unmount();
  const b = fixture({}, { ...row, id: A, slug: 'article-b' });
  release({ ...row, slug: 'stale-a' });
  assert.equal(await saving, null);
  assert.equal(b.render().record.slug, 'article-b');
  b.unmount();
});
test('image upload inserts at captured selection in the original language and retains the existing cover', async () => {
  const path = A + '/' + B + '/' + A + '.jpg',
    f = fixture({}, { ...row, cover_image_path: path });
  let e = f.render();
  e.changeTranslation('content', 'Trước SAU');
  e = f.render();
  await e.chooseImage(true, { start: 6, end: 6 });
  e = f.render();
  assert.equal(e.pickedImage.image.mime, 'image/jpeg');
  e.setLanguage('en');
  await e.upload('Minh họa');
  e = f.render();
  assert.equal(e.values.cover, path);
  assert.match(e.values.translations.vi.content, /Trước \n\n!\[Minh họa\]/);
  assert.equal(e.values.translations.en.content, '');
  assert.ok(e.message);
  assert.equal(e.pickedImage, null);
  f.unmount();
});
test('publication preflights duplicate slugs and reports the slug field without writing', async () => {
  const f = fixture({ isArticleSlugAvailable: async () => false }, row, [
    complete,
  ]);
  assert.equal(await f.render().save('published'), null);
  assert.equal(f.writes.length, 0);
  assert.equal(f.render().issues[0].field, 'slug');
  assert.equal(f.render().issues[0].key, 'cms.duplicate');
  f.unmount();
});
test('publish, unpublish and archive send the expected version and delete keeps optimistic locking', async () => {
  const f = fixture({}, row, [complete]);
  await f.render().save('published');
  await f.render().save('draft');
  await f.render().save('archived');
  assert.deepEqual(
    f.writes.map((args) => args[2].status),
    ['published', 'draft', 'archived']
  );
  assert.deepEqual(
    f.writes.map((args) => args[1]),
    ['version-1', 'version-2', 'version-3']
  );
  await f.render().remove();
  assert.deepEqual(f.deletions[0], [B, 'version-4']);
  f.unmount();
});
test('Markdown editor supports stable selection, undo/redo, Vietnamese and real preview modes', async () => {
  const f = uiFixture({
    [boundary('src/components/articles/ArticleMarkdown.tsx')]: {
      ArticleMarkdown: 'ArticleMarkdown',
    },
    [boundary('src/components/articles/ArticleImage.tsx')]: {
      ArticleImage: 'ArticleImage',
    },
  });
  const Component = f.load('src/components/articles/ArticleMarkdownEditor')
      .ArticleMarkdownEditor.type,
    i18n = f.load('src/i18n/index').default;
  await i18n.changeLanguage('vi');
  const props = {
    content: 'Một đoạn văn',
    onChange: (value) => {
      props.content = value;
    },
    onImage() {},
    disabled: false,
    wide: true,
    readingTime: '1',
    onReadingTime() {},
    onEstimate() {},
    issues: [],
    register() {},
  };
  const render = () => f.render(() => Component(props)),
    label = (tree, key) =>
      elements(tree).find((e) => e.props.accessibilityLabel === i18n.t(key));
  let tree = render();
  label(tree, 'cms.content').props.onSelectionChange({
    nativeEvent: { selection: { start: 4, end: 8 } },
  });
  label(tree, 'cms.format.bold').props.onPress();
  tree = render();
  assert.equal(props.content, 'Một **đoạn** văn');
  assert.equal(label(tree, 'cms.content').props.selection.start, 12);
  label(tree, 'cms.editor.undo').props.onPress();
  tree = render();
  assert.equal(props.content, 'Một đoạn văn');
  label(tree, 'cms.editor.redo').props.onPress();
  tree = render();
  assert.equal(props.content, 'Một **đoạn** văn');
  label(tree, 'cms.content').props.onChangeText('Gõ tiếng Việt có dấu');
  tree = render();
  assert.equal(label(tree, 'cms.content').props.selection, undefined);
  label(tree, 'cms.editor.mode.split').props.onPress();
  tree = render();
  assert.ok(
    elements(tree).some(
      (e) => e.type === 'ArticleMarkdown' && e.props.content === props.content
    )
  );
  assert.ok(label(tree, 'cms.content'));
  label(tree, 'cms.editor.mode.preview').props.onPress();
  tree = render();
  assert.equal(label(tree, 'cms.content'), undefined);
  assert.ok(elements(tree).some((e) => e.type === 'ArticleMarkdown'));
  f.unmount();
});
test('field feedback appears below invalid titles and summary limits before submission', () => {
  const f = uiFixture({
      [boundary('src/components/articles/ArticleImage.tsx')]: {
        ArticleImage: 'ArticleImage',
      },
    }),
    Field = f.load(
      'src/components/articles/ArticleEditorFields'
    ).EditorFieldInput;
  const props = { field: 'title', label: 'Title', value: '', limit: 240 };
  const render = () => f.render(() => Field(props));
  let tree = render();
  elements(tree)
    .find((e) => e.type === 'TextInput')
    .props.onBlur({});
  tree = render();
  assert.ok(elements(tree).some((e) => e.props.accessibilityRole === 'alert'));
  props.value = 'A valid title';
  tree = render();
  assert.equal(
    elements(tree).some((e) => e.props.accessibilityRole === 'alert'),
    false
  );
  props.field = 'summary';
  props.limit = 1200;
  props.value = 'x'.repeat(1201);
  assert.ok(
    elements(render()).some((e) => e.props.accessibilityRole === 'alert')
  );
  f.unmount();
});
test('failed uploads keep the picked image and existing cover available for retry', async () => {
  let attempts = 0;
  const original = A + '/' + B + '/' + A + '.jpg',
    replacement = A + '/' + B + '/' + B + '.png';
  const f = fixture({}, { ...row, cover_image_path: original }, [], {
    uploadArticleImage: async () => {
      if (++attempts === 1) throw Error('Network unavailable');
      return replacement;
    },
  });
  await f.render().chooseImage(false);
  let e = f.render();
  await e.upload('Image');
  e = f.render();
  assert.ok(e.pickedImage);
  assert.ok(e.error);
  assert.equal(e.values.cover, original);
  assert.equal(e.busy, false);
  await e.upload('Image');
  e = f.render();
  assert.equal(e.values.cover, replacement);
  assert.equal(e.pickedImage, null);
  assert.equal(e.dirty, true);
  f.unmount();
});
