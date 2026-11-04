/* global __dirname */
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  path = require('node:path');
const { uiFixture, elements } = require('./ui-fixture.cjs');
const boundary = (p) => path.resolve(__dirname, '../' + p);
const item = {
  id: 'article',
  title: 'Một tiêu đề bài viết dài vẫn có đủ không gian để đọc',
  category: { name_vi: 'Sức khỏe', name_en: 'Health' },
  status: 'draft',
  updated_at: '2026-11-01T00:00:00Z',
  language: 'vi',
  cover_image_path: null,
};
test('management cards separate mobile actions from information and allocate the largest desktop column to the title', () => {
  const f = uiFixture({
      [boundary('src/components/articles/ArticleImage.tsx')]: {
        ArticleImage: 'ArticleImage',
      },
    }),
    Card = f.load('src/components/articles/AdminDashboardParts')
      .AdminArticleManagementCard.type;
  for (const width of [320, 375, 390, 768, 1024, 1440]) {
    const wide = width >= 1100,
      tree = f.render(() =>
        Card({ item, wide, onEdit() {}, onPreview() {}, onMore() {} })
      );
    const title = elements(tree).find((e) => e.props.children === item.title);
    assert.equal(title.props.numberOfLines, 3);
    assert.ok(
      elements(tree).some((e) =>
        e.props.accessibilityLabel?.includes(item.title)
      )
    );
    assert.equal(
      tree.props.children[0].props.style.some((s) => s?.flex === 3),
      wide
    );
  }
  f.unmount();
});
test('stats use two mobile columns, four desktop columns and no fabricated zero while loading', () => {
  const f = uiFixture({
      [boundary('src/components/articles/ArticleImage.tsx')]: {
        ArticleImage: 'ArticleImage',
      },
    }),
    Stats = f.load(
      'src/components/articles/AdminDashboardParts'
    ).AdminDashboardStats;
  let tree = f.render(() => Stats({ data: null, wide: false }));
  assert.equal(tree.props.children.length, 4);
  assert.equal(tree.props.children[0].props.style[1].width, '48%');
  assert.equal(
    elements(tree).filter((e) => e.props.children === '—').length,
    4
  );
  tree = f.render(() =>
    Stats({
      data: { total: 12, published: 8, draft: 3, archived: 1 },
      wide: true,
    })
  );
  assert.equal(tree.props.children[0].props.style[1].width, '23.5%');
  assert.ok(elements(tree).some((e) => e.props.children === '12'));
  f.unmount();
});
function dashboard(service = {}) {
  const calls = [],
    routes = [];
  let filters;
  const f = uiFixture({
    'expo-router': { router: { push: (r) => routes.push(r) } },
    [boundary('src/hooks/useHealthQuery.ts')]: {
      useHealthQuery: () => ({
        data: { total: 1, published: 0, draft: 1, archived: 0 },
        isLoading: false,
        error: null,
        refresh: async () => calls.push('stats'),
      }),
    },
    [boundary('src/hooks/useArticleFeed.ts')]: {
      useArticleFeed: (options) => {
        filters = options;
        return {
          data: [item],
          isLoading: false,
          error: null,
          hasMore: true,
          refresh: async () => calls.push('feed'),
          loadMore: async () => calls.push('more'),
        };
      },
    },
    [boundary('src/services/articlesService.ts')]: {
      changeArticleStatus: async (...args) => calls.push(args),
      deleteArticle: async () => {},
      ...service,
    },
    [boundary('src/components/articles/ArticleImage.tsx')]: {
      ArticleImage: 'ArticleImage',
    },
  });
  const Dashboard = f.load('app/admin/index').default,
    render = () => f.render(() => Dashboard());
  return {
    ...f,
    render,
    calls,
    routes,
    get filters() {
      return filters;
    },
  };
}
test('dashboard preserves search across filters, routes by ID and confirms mutations before refreshing stats and feed', async () => {
  const f = dashboard();
  let tree = f.render(),
    list = () => elements(tree).find((e) => e.props.renderItem),
    header = () => elements(list().props.ListHeaderComponent);
  header()
    .find((e) => e.type.name === 'AdminArticleSearch')
    .props.onChange('sleep');
  tree = f.render();
  header()
    .find((e) => e.type.name === 'AdminArticleStatusFilter')
    .props.onChange('published');
  tree = f.render();
  assert.equal(f.filters.search, 'sleep');
  assert.equal(f.filters.status, 'published');
  let card = list().props.renderItem({ item });
  card.props.onEdit();
  card.props.onPreview();
  assert.equal(f.routes[0].params.id, item.id);
  assert.equal(f.routes[1].pathname, '/article/[id]');
  card.props.onMore();
  tree = f.render();
  const t = f
    .load('src/i18n/index')
    .default.t.bind(f.load('src/i18n/index').default);
  elements(tree)
    .find((e) => e.props.title === t('cms.publish'))
    .props.onPress();
  tree = f.render();
  assert.equal(f.calls.length, 0);
  await elements(tree)
    .find((e) => e.props.title === t('cms.confirm'))
    .props.onPress();
  assert.equal(f.calls[0][0], item.id);
  assert.equal(f.calls[0][2], 'published');
  assert.deepEqual(f.calls.slice(1), ['stats', 'feed']);
  f.unmount();
});
test('failed status updates retain the modal and never refresh as a successful mutation; double taps are locked', async () => {
  let release,
    writes = 0;
  const f = dashboard({
    changeArticleStatus: async () => {
      writes++;
      await new Promise((resolve) => {
        release = resolve;
      });
      throw Error('Network unavailable');
    },
  });
  let tree = f.render();
  elements(tree)
    .find((e) => e.props.renderItem)
    .props.renderItem({ item })
    .props.onMore();
  tree = f.render();
  const t = f
    .load('src/i18n/index')
    .default.t.bind(f.load('src/i18n/index').default);
  elements(tree)
    .find((e) => e.props.title === t('cms.archive'))
    .props.onPress();
  tree = f.render();
  const press = elements(tree).find((e) => e.props.title === t('cms.confirm'))
      .props.onPress,
    pending = press();
  await press();
  assert.equal(writes, 1);
  release();
  await pending;
  tree = f.render();
  assert.ok(elements(tree).some((e) => e.props.accessibilityRole === 'alert'));
  assert.equal(f.calls.length, 0);
  f.unmount();
});
