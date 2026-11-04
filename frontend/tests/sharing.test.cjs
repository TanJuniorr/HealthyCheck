const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fixture, table, boundary, A, B } = require('./recommendation-fixture.cjs');
const { uiFixture, elements } = require('./ui-fixture.cjs');
const load = require('./load-ts.cjs')({ [boundary('lib/supabase.ts')]: { supabase: {} } });
const service = load('src/services/sharingService');
const permissions = { share_steps: true, share_sleep: false, share_nutrition: true };
const inviteId = '33333333-3333-4333-8333-333333333333';
const row = {
  id: inviteId, owner_id: A, recipient_user_id: B, recipient_email: 'b@example.test',
  status: 'pending', version: 0, ...permissions,
};
const received = { invite_id: inviteId, owner_id: A, status: 'active', version: 1, ...permissions };

test('sharing requires an email and at least one explicitly selected category', () => {
  for (const input of ['', ' ', 'Person', 'person@', 'person@local']) {
    assert.throws(() => service.validateRecipient(input));
  }
  assert.equal(service.validateRecipient('  B@Example.Test '), 'b@example.test');
  assert.throws(() => service.validateCategories({ share_steps: false, share_sleep: false, share_nutrition: false }));
  assert.throws(() => service.validateCategories({ ...permissions, share_sleep: 'true' }));
  service.validateCategories(permissions);
  assert.equal(service.expandsSharing(permissions, { ...permissions, share_sleep: true }), true);
  assert.equal(service.expandsSharing(permissions, { ...permissions, share_steps: false }), false);
});

test('sender creates a pending invitation with one RPC and no client-selected recipient id or status', async () => {
  const f = fixture(request => {
    assert.equal(table(request), 'create_private_sharing_invite');
    assert.deepEqual(request.body, {
      p_actor: A, p_email: 'b@example.test', p_steps: true, p_sleep: false, p_nutrition: true,
    });
    return { data: [row] };
  });
  const result = await f.load('src/services/sharingService').createSharingInvite(A, ' B@Example.Test ', {
    ...permissions, owner_id: B, recipient_user_id: A, status: 'active', share_cycle: true,
  });
  assert.equal(result.status, 'pending');
  assert.equal(f.calls.length, 1);
});

test('missing RPC, duplicate, offline and unconfirmed writes do not fall back to direct inserts', async () => {
  for (const response of [
    { status: 404, data: { code: 'PGRST202', message: 'Missing function' } },
    { status: 409, data: { code: '23505', message: 'sharing.errorDuplicateInvite' } },
    { status: 400, data: { message: 'Network unavailable' } },
    { data: [] },
  ]) {
    const f = fixture(() => response);
    await assert.rejects(f.load('src/services/sharingService').createSharingInvite(A, 'b@example.test', permissions));
    assert.deepEqual(f.calls.map(table), ['create_private_sharing_invite']);
  }
});

test('responses and permission edits use the version displayed at confirmation', async () => {
  const f = fixture(request => ({ data: [{ ...row, status: 'active', version: request.body.p_version + 1 }] }));
  const api = f.load('src/services/sharingService');
  f.setOwner(B);
  await api.changeSharingInvite(B, inviteId, 0, 'accept');
  assert.deepEqual(f.calls[0].body, { p_actor: B, p_id: inviteId, p_version: 0, p_action: 'accept' });
  f.setOwner(A);
  await api.changeSharingInvite(A, inviteId, 1, 'edit', { ...permissions, share_sleep: true }, true);
  assert.deepEqual(f.calls[1].body, {
    p_actor: A, p_id: inviteId, p_version: 1, p_action: 'edit',
    p_steps: true, p_sleep: true, p_nutrition: true, p_confirm_expansion: true,
  });
  assert.ok(f.calls.every(call => table(call) === 'change_private_sharing_invite'));
});

test('account switches invalidate write confirmations and permission-scoped reads', async () => {
  const before = fixture(() => assert.fail('Must not query after a switch'));
  before.setOwner(B);
  await assert.rejects(before.load('src/services/sharingService').createSharingInvite(A, 'b@example.test', permissions),
    error => error.code === 'AUTH_CHANGED');
  assert.equal(before.calls.length, 0);

  const duringWrite = fixture(() => {
    duringWrite.setOwner(B);
    return { data: [row] };
  });
  await assert.rejects(duringWrite.load('src/services/sharingService').createSharingInvite(A, 'b@example.test', permissions),
    error => error.code === 'AUTH_CHANGED');

  const duringRead = fixture(() => {
    duringRead.setOwner(A);
    return { data: { stepsToday: 8000, sleep: null, nutrition: null } };
  });
  duringRead.setOwner(B);
  await assert.rejects(duringRead.load('src/services/sharedWithMeService').getSharedMetrics(B, received),
    error => error.code === 'AUTH_CHANGED');
});

test('shared data never reads raw profiles or records and fails closed after a permission change', async () => {
  const f = fixture(request => {
    if (table(request) === 'list_private_sharing_invitations') return { data: [received] };
    if (table(request) === 'sharing_invites') {
      assert.equal(request.url.searchParams.get('recipient_user_id'), 'eq.' + B);
      assert.equal(request.url.searchParams.get('select'), 'id,version,updated_at');
      return { data: [{ id: inviteId, version: 1, updated_at: '2026-11-04T12:00:00Z' }] };
    }
    assert.equal(table(request), 'get_private_shared_metrics');
    assert.equal(request.body.p_actor, B);
    assert.equal(request.body.p_id, inviteId);
    assert.equal(request.body.p_version, 1);
    assert.ok(request.body.p_time_zone);
    return { data: null };
  });
  f.setOwner(B);
  const api = f.load('src/services/sharedWithMeService');
  const [listed] = await api.getMySharedOwners(B);
  assert.equal(listed.invite_id, inviteId);
  assert.equal(listed.updated_at, '2026-11-04T12:00:00Z');
  await assert.rejects(api.getSharedMetrics(B, { ...received, status: 'paused' }));
  assert.equal(f.calls.length, 2);
  await assert.rejects(api.getSharedMetrics(B, received), error => error.message === 'sharedWithMe.notActive');
  assert.deepEqual(f.calls.map(table).sort(), ['get_private_shared_metrics', 'list_private_sharing_invitations', 'sharing_invites']);
});

test('all server sharing notifications localize and open the correct scoped invitation', () => {
  const { notificationPresentation, sharingNoticeDestination } = load('src/services/notificationPresentation');
  for (const event of ['received','accepted','rejected','permissions_updated','paused','resumed','revoked']) {
    const kind = 'sharing_' + event;
    const item = { source: 'remote', kind, referenceId: inviteId, payload: { sharerEmail: 'private@example.test', shareSteps: true } };
    for (const language of ['vi', 'en']) {
      const resource = load(`src/i18n/resources/${language}.json`);
      const translate = key => key.split('.').reduce((value, part) => value?.[part], resource);
      const { title, body } = notificationPresentation(item, translate);
      assert.ok(title && body);
      assert.ok(!body.includes('private@example.test'));
    }
    assert.deepEqual({ ...sharingNoticeDestination(item).params }, { inviteId });
    assert.equal(sharingNoticeDestination(item).pathname, ['accepted','rejected'].includes(event) ? '/(tabs)/sharing' : '/shared-with-me');
    assert.equal(sharingNoticeDestination({ ...item, source: 'local' }), null);
  }
});

test('invalidation immediately clears metrics and ignores late responses and old subscriptions', async () => {
  let focus, invalidate, disconnected = 0, removed = 0, nextTimer = 0;
  const scheduled = new Map(), intervals = new Set(), pending = [];
  const f = uiFixture({
    'expo-router': { useFocusEffect: callback => { focus = callback; } },
    'react-native': { AppState: {
      currentState: 'active',
      addEventListener: () => ({ remove: () => { removed++; } }),
    } },
    [boundary('services/sharingService.ts')]: {
      subscribeSharingChanges: (_owner, _side, callback) => {
        invalidate = callback;
        return () => { disconnected++; };
      },
    },
    __timers: {
      setTimeout: callback => { scheduled.set(++nextTimer, callback); return nextTimer; },
      clearTimeout: id => scheduled.delete(id),
      setInterval: () => { intervals.add(++nextTimer); return nextTimer; },
      clearInterval: id => intervals.delete(id),
    },
  });
  const useFeed = f.load('src/hooks/useSharingFeed').useSharingFeed;
  const fetch = () => new Promise((resolve, reject) => pending.push({ resolve, reject }));
  const render = (owner = A) => f.render(() => useFeed(owner, 'recipient', owner, fetch));
  const runTimer = () => {
    const [id, callback] = scheduled.entries().next().value;
    scheduled.delete(id);
    void callback();
  };
  const tick = () => new Promise(resolve => setImmediate(resolve));
  render();
  const blur = focus();
  runTimer();
  pending[0].resolve({ stepsToday: 8123 });
  await tick();
  assert.equal(render().data.stepsToday, 8123);
  invalidate();
  assert.equal(render().data, null);
  runTimer();
  invalidate();
  runTimer();
  pending[1].resolve({ stepsToday: 8124 });
  await tick();
  assert.equal(render().data, null);
  pending[2].reject(Error('Network unavailable'));
  await tick();
  assert.equal(render().data, null);
  assert.ok(render().error);
  blur();
  assert.equal(disconnected, 1);
  assert.equal(removed, 1);
  assert.equal(intervals.size, 0);
  assert.equal(render(B).data, null);
  f.unmount();
});

const textContent = tree => elements(tree).filter(e => e.type === 'Text').flatMap(e => e.props.children).join(' ');
const actionButton = (tree, title) => elements(tree).find(e => e.props.title === title);
const disclosure = (tree, title) => elements(tree).find(e => e.type === 'Pressable' && textContent(e) === title);
const tick = () => new Promise(resolve => setImmediate(resolve));
const screenBoundaries = {
  [boundary('components/common/AppHeader.tsx')]: { AppHeader: 'AppHeader' },
  [boundary('components/common/ScreenContainer.tsx')]: { ScreenContainer: 'ScreenContainer' },
  [boundary('components/common/DataFeedback.tsx')]: { DataFeedback: 'DataFeedback' },
  [boundary('lib/supabase.ts')]: { supabase: {} },
};

test('Sharing groups preserve every invitation and use localized date and time', async () => {
  const presentation = load('src/lib/sharingPresentation');
  const sample = ['pending', 'active', 'paused', 'revoked', 'rejected'].map((status, id) => ({ status, id }));
  const groups = presentation.groupSharingInvites(sample);
  assert.deepEqual([...groups.pending, ...groups.active, ...groups.paused, ...groups.history], sample);
  assert.deepEqual([...groups.history].map(item => item.status), ['revoked', 'rejected']);
  const i18n = load('src/i18n/index').default;
  const local = new Date(2026, 9, 30, 18, 0).toISOString();
  await i18n.changeLanguage('vi');
  assert.equal(presentation.formatSharingDateTime(local), '30/10/2026, 18:00');
  await i18n.changeLanguage('en');
  assert.match(presentation.formatSharingDateTime(local), /Oct 30, 2026.*6:00\s*PM/);
});

test('recipient groups keep prior invitations in collapsed history and clear metrics on revocation', async () => {
  const old = { ...received, invite_id: 'prior', status: 'revoked', owner_name: 'User A', created_at: '2026-10-20T12:00:00Z' };
  const current = { ...received, status: 'pending', owner_name: 'User A', share_nutrition: false, created_at: '2026-11-04T12:00:00Z' };
  let invites = [current, old], resolveMetrics, detailCalls = 0;
  const f = uiFixture({
    ...screenBoundaries,
    __dimensions: { width: 320, height: 600 },
    'expo-router': { useLocalSearchParams: () => ({ inviteId }) },
    [boundary('contexts/AuthContext.tsx')]: { useAuth: () => ({ user: { id: B } }) },
    [boundary('hooks/useSharingFeed.ts')]: { useSharingFeed: () => ({ data: invites, isLoading: false, error: null, refresh() {} }) },
    [boundary('services/sharedWithMeService.ts')]: {
      getMySharedOwners: async () => invites,
      getSharedMetrics: async () => {
        detailCalls++;
        if (detailCalls > 1) return new Promise(resolve => { resolveMetrics = resolve; });
        return { stepsToday: 8123, nutrition: { calories: 9999 }, sleep: null, updatedAt: '2026-11-04T12:00:00Z' };
      },
    },
  });
  const Screen = f.load('app/shared-with-me').default;
  const i18n = f.load('src/i18n/index').default;
  await i18n.changeLanguage('en');
  const render = () => f.renderDeep(Screen);
  let tree = render();
  assert.ok(actionButton(tree, i18n.t('sharing.acceptAction')));
  assert.ok(actionButton(tree, i18n.t('sharing.rejectAction')));
  assert.ok(textContent(tree).includes(i18n.t('sharedWithMe.sections.pending')));
  assert.ok(!textContent(tree).includes(i18n.t('sharing.statusRevoked')));
  assert.equal(detailCalls, 0);

  invites = [{ ...current, status: 'active' }, old];
  render();
  await tick();
  tree = render();
  assert.match(textContent(tree), /8,123 steps/);
  assert.ok(!textContent(tree).includes('9,999'));
  disclosure(tree, i18n.t('sharing.historyCount', { count: 1 })).props.onPress();
  tree = render();
  assert.ok(textContent(tree).includes(i18n.t('sharing.statusRevoked')));
  assert.ok(textContent(tree).includes(i18n.t('sharedWithMe.earlierInvite')));

  const detailTitle = i18n.t('sharedWithMe.metricsDetails');
  disclosure(tree, detailTitle).props.onPress();
  tree = render();
  disclosure(tree, detailTitle).props.onPress();
  render();
  assert.equal(detailCalls, 2);
  invites = [{ ...current, status: 'revoked', version: 2 }, old];
  render();
  resolveMetrics({ stepsToday: 9000, sleep: null, nutrition: null, updatedAt: '2026-11-04T12:00:00Z' });
  await tick();
  assert.ok(!textContent(render()).includes('9,000'));
  assert.ok(!textContent(render()).includes('8,123'));
  f.unmount();
});

test('health details distinguish zero and no records, and display both dates for overnight sleep', async () => {
  const f = uiFixture({ ...screenBoundaries });
  const { SharedMetricsContent } = f.load('src/components/sharing/SharedHealthDetails');
  const i18n = f.load('src/i18n/index').default;
  await i18n.changeLanguage('vi');
  const invite = { ...received, share_sleep: true };
  const start = new Date(2026, 9, 30, 23, 0).toISOString();
  const end = new Date(2026, 9, 31, 1, 0).toISOString();
  const data = { stepsToday: 0, sleep: { start, end }, nutrition: null, updatedAt: end };
  const show = metrics => textContent(f.renderDeep(() => SharedMetricsContent({ invite, metrics })));
  const valid = show(data);
  assert.ok(valid.includes('0 bước'));
  assert.ok(valid.includes('2 giờ'));
  assert.ok(valid.includes('Ngủ lúc 30/10/2026, 23:00'));
  assert.ok(valid.includes('Thức lúc 31/10/2026, 01:00'));
  assert.ok(valid.includes(i18n.t('sharedWithMe.noNutritionData')));
  const missing = show({ ...data, stepsToday: null, sleep: { start: end, end: start } });
  assert.ok(missing.includes(i18n.t('sharedWithMe.noStepsData')));
  assert.ok(missing.includes(i18n.t('sharedWithMe.invalidSleep')));
  assert.ok(!missing.includes('0 bước'));
  f.unmount();
});

test('a failed metrics query shows an error and retries without turning the failure into an empty state', async () => {
  let fail = true, calls = 0;
  const f = uiFixture({
    ...screenBoundaries,
    [boundary('services/sharedWithMeService.ts')]: { getSharedMetrics: async () => {
      calls++;
      if (fail) throw Error('Network unavailable');
      return { stepsToday: 0, sleep: null, nutrition: null, updatedAt: '2026-11-04T12:00:00Z' };
    } },
  });
  const { SharedHealthDetails } = f.load('src/components/sharing/SharedHealthDetails');
  const i18n = f.load('src/i18n/index').default;
  const props = { recipient: B, invite: received, refreshInvites() {} };
  const render = () => f.renderDeep(() => SharedHealthDetails(props));
  render();
  await tick();
  const tree = render();
  const feedback = elements(tree).find(e => e.type === 'DataFeedback');
  assert.ok(feedback.props.error);
  assert.ok(!textContent(tree).includes(i18n.t('sharedWithMe.noStepsData')));
  fail = false;
  await feedback.props.refresh();
  render();
  await tick();
  assert.equal(calls, 2);
  assert.ok(textContent(render()).includes('0 steps'));
  f.unmount();
});

test('sharing setup validates email inline, requires a category and preserves the review draft after a failed send', async () => {
  const api = load('src/services/sharingService');
  let sent = 0;
  const f = uiFixture({
    ...screenBoundaries,
    __dimensions: { width: 320, height: 600 },
    'expo-router': { useLocalSearchParams: () => ({}), useRouter: () => ({}) },
    [boundary('contexts/AuthContext.tsx')]: { useAuth: () => ({ user: { id: A } }) },
    [boundary('components/common/AppTextInput.tsx')]: { AppTextInput: 'AppTextInput' },
    [boundary('lib/dataErrors.ts')]: load('src/lib/dataErrors'),
    [boundary('services/sharingService.ts')]: {
      ...api,
      createSharingInvite: async () => { sent++; throw Error('Network unavailable'); },
    },
  });
  const Screen = f.load('app/sharing-setup').default;
  const i18n = f.load('src/i18n/index').default;
  const render = () => f.renderDeep(Screen);
  const input = tree => elements(tree).find(e => e.type === 'AppTextInput');
  let tree = render();
  assert.equal(actionButton(tree, i18n.t('sharing.reviewAction')).props.disabled, true);
  input(tree).props.onChangeText('not-an-email');
  tree = render();
  assert.equal(input(tree).props.error, 'sharing.errorInvalidEmail');
  const switchRow = elements(tree).find(e => e.props.accessibilityRole === 'switch');
  assert.ok(textContent(switchRow).includes(i18n.t('sharing.groupDescription.steps')));
  switchRow.props.onPress();
  tree = render();
  actionButton(tree, i18n.t('sharing.reviewAction')).props.onPress();
  assert.equal(actionButton(render(), i18n.t('sharing.sendInvite')), undefined);
  input(render()).props.onChangeText('B@Example.Test');
  actionButton(render(), i18n.t('sharing.reviewAction')).props.onPress();
  tree = render();
  assert.ok(textContent(tree).includes('b@example.test'));
  assert.ok(textContent(tree).includes(i18n.t('sharing.readOnly')));
  assert.ok(textContent(tree).includes(i18n.t('sharing.reviewPending')));
  await actionButton(tree, i18n.t('sharing.sendInvite')).props.onPress();
  assert.equal(sent, 1);
  actionButton(render(), i18n.t('common.cancel')).props.onPress();
  tree = render();
  assert.equal(input(tree).props.value, 'B@Example.Test');
  assert.equal(elements(tree).find(e => e.props.accessibilityRole === 'switch').props.accessibilityState.checked, true);
  f.unmount();
});
