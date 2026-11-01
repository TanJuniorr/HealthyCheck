/* global __dirname */
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  path = require('node:path');
const { uiFixture, elements } = require('./ui-fixture.cjs');
const boundary = (p) => path.resolve(__dirname, '../' + p),
  tick = () => new Promise((resolve) => setImmediate(resolve));
test('category chips start with All, expose selection and render only supplied categories', () => {
  const f = uiFixture(),
    Component = f.load(
      'src/components/articles/ExploreControls'
    ).ExploreCategories;
  let selected;
  const tree = f.render(() =>
    Component({
      categories: [{ id: 'sleep', name_vi: 'Giấc ngủ', name_en: 'Sleep' }],
      value: 'sleep',
      onChange: (id) => {
        selected = id;
      },
    })
  );
  const chips = elements(tree).filter((e) => e.type === 'Pressable');
  assert.equal(chips.length, 2);
  assert.equal(chips[1].props.accessibilityState.selected, true);
  chips[0].props.onPress();
  assert.equal(selected, null);
  f.unmount();
});
test('card bookmark is a sibling of the article link and all variants reserve 16:9 images', () => {
  const f = uiFixture({
      'expo-router': { router: {} },
      [boundary('src/components/articles/BookmarkButton.tsx')]: {
        BookmarkButton: 'BookmarkButton',
      },
    }),
    Card = f.load('src/components/articles/ArticleCard').ArticleCard;
  const article = {
    id: 'a',
    title: 'Title',
    summary: 'Summary',
    category: { name_vi: 'Sức khỏe', name_en: 'Health' },
    reading_time_minutes: 2,
    language: 'vi',
    is_bookmarked: false,
  };
  for (const width of [320, 375, 390, 768, 1024, 1440]) {
    let tree = f.render(() => Card({ article }));
    tree.props.onLayout({ nativeEvent: { layout: { width } } });
    tree = f.render(() => Card({ article }));
    const link = elements(tree).find((e) => e.type === 'TouchableOpacity');
    assert.equal(
      elements(link).some((e) => e.type === 'BookmarkButton'),
      false
    );
    assert.ok(
      elements(tree).find((e) => e.type === 'ArticleImage').props.widescreen
    );
    assert.equal(
      elements(tree).find((e) => e.props.children === 'Summary').props
        .numberOfLines,
      2
    );
  }
  f.unmount();
});
test('bookmark stops propagation and confirmed changes synchronize other controls for the same owner', async () => {
  const shared = require('./load-ts.cjs')()('src/lib/articleBookmarkEvents');
  let writes = 0;
  const overrides = {
    [boundary('src/contexts/AuthContext.tsx')]: {useAuth:()=>({user:{id:'owner'}})},
    [boundary('src/lib/articleBookmarkEvents.ts')]: shared,
    [boundary('src/services/articlesService.ts')]: {
      setArticleBookmark: async () => {
        writes++;
      },
    },
  };
  const a = uiFixture(overrides),
    b = uiFixture(overrides),
    A = a.load('src/components/articles/BookmarkButton').BookmarkControl,
    B = b.load('src/components/articles/BookmarkButton').BookmarkControl;
  const props = { id: 'a', owner: 'owner', saved: false },
    renderA = () => a.render(() => A(props)),
    renderB = () => b.render(() => B(props));
  renderB();
  let stopped = 0;
  await elements(renderA())
    .find((e) => e.type === 'Pressable')
    .props.onPress({
      stopPropagation() {
        stopped++;
      },
    });
  assert.equal(writes, 1);
  assert.equal(stopped, 1);
  assert.equal(
    elements(renderB()).find((e) => e.type === 'Pressable').props
      .accessibilityState.selected,
    true
  );
  shared.publishArticleBookmark({ id: 'a', owner: 'foreign', saved: false });
  assert.equal(
    elements(renderB()).find((e) => e.type === 'Pressable').props
      .accessibilityState.selected,
    true
  );
  a.unmount();
  b.unmount();
});
test('returning to a feed revalidates loaded pages without discarding pagination and applies bookmark events', async () => {
  const timers = new Map(),
    calls = [];
  let focus, cleanup;
  const f = uiFixture({
    __timers: {
      setTimeout(fn) {
        timers.set(1, fn);
        return 1;
      },
      clearTimeout(id) {
        timers.delete(id);
      },
    },
    'expo-router': {
      useFocusEffect(fn) {
        if (focus !== fn) {
          cleanup?.();
          focus = fn;
          cleanup = fn();
        }
      },
    },
    [boundary('src/contexts/AuthContext.tsx')]: {
      useAuth: () => ({ user: { id: 'owner' } }),
    },
    [boundary('src/services/articlesService.ts')]: {
      getArticleFeed: async (options) => {
        calls.push(options.page);
        return {
          data: [{ id: String(options.page), is_bookmarked: false }],
          total: 3,
          page: options.page,
          hasMore: options.page < 3,
        };
      },
    },
  });
  const hook = f.load('src/hooks/useArticleFeed').useArticleFeed,
    render = () => f.render(() => hook({ language: 'vi' })),
    flush = async () => {
      const fn = timers.get(1);
      timers.clear();
      fn();
      await tick();
    };
  render();
  await flush();
  await render().loadMore();
  assert.equal(render().data.length, 2);
  cleanup();
  cleanup = focus();
  await flush();
  assert.deepEqual(calls, [1, 2, 1, 2]);
  assert.equal(render().data.length, 2);
  f.load('src/lib/articleBookmarkEvents').publishArticleBookmark({
    owner: 'owner',
    id: '2',
    saved: true,
  });
  assert.equal(render().data[1].is_bookmarked, true);
  cleanup();
  f.unmount();
});
