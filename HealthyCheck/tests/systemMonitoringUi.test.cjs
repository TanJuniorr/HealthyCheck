/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { uiFixture, elements } = require('./ui-fixture.cjs');
const tick = () => new Promise(resolve => setImmediate(resolve));

test('monitor displays the complete dataset without sample controls or labels', async () => {
  const calls = [];
  let focusedCallback, cleanup;
  const f = uiFixture({
    __timers: { setInterval: () => 1, clearInterval: () => {} },
    'expo-router': { router: {}, useFocusEffect: callback => {
      if (focusedCallback === callback) return;
      cleanup?.();
      focusedCallback = callback;
      cleanup = callback();
    } },
    [path.resolve(__dirname, '../src/services/systemMonitorService.ts')]: {
      getSystemMonitorSnapshot: async (includeDemo = true) => {
        calls.push(['snapshot', includeDemo]);
        const metrics = { total_requests: includeDemo ? 241 : 1, successful_requests: includeDemo ? 193 : 1,
          failed_requests: includeDemo ? 48 : 0, success_rate_percent: includeDemo ? 80.1 : 100,
          average_duration_ms: 1200, p95_duration_ms: 3000, demo_requests: includeDemo ? 240 : 0 };
        return { database: { status: 'ok', latency_ms: 20 }, edge_functions: {
          ai_chat: { status: 'ok', http_status: 200, latency_ms: 15 },
          food_scan: { status: 'ok', http_status: 200, latency_ms: 15 } },
        request_metrics_available: true, request_metrics: { ai_chat: metrics, food_scan: { ...metrics, total_requests: 0, demo_requests: 0 } },
        errors_last_24h: includeDemo ? 30 : 0, demo_errors_last_24h: includeDemo ? 30 : 0 };
      },
      getRecentMonitorEvents: async (includeDemo = true) => {
        calls.push(['events', includeDemo]);
        return includeDemo ? [{ id: 'demo', is_demo: true, event_code: 'unhandled_type_error', severity: 'fatal', platform: 'web', app_version: '1.0.0', created_at: new Date().toISOString() }] : [];
      },
    },
  });
  const Screen = f.load('app/admin/monitoring').default;
  const render = () => f.render(() => Screen());
  try {
    let tree = render();
    await tick();
    tree = render();
    assert.equal(calls.length, 2);
    assert.ok(calls.every(([, includeDemo]) => includeDemo));
    assert.ok(!elements(tree).some(node => node.props.children === 'Dữ liệu mẫu'));
    assert.ok(!elements(tree).some(node => node.type === 'Switch'));
    assert.ok(elements(tree).some(node => node.props.children === 241));
    assert.ok(elements(tree).some(node => node.props.children === 'Lỗi kiểu dữ liệu'));
    assert.ok(!JSON.stringify(tree).includes('NaN'));
    await elements(tree).find(node => node.props.title === 'Kiểm tra lại').props.onPress();
    tree = render();
    assert.equal(calls.length, 4);
    assert.ok(calls.slice(2).every(([, includeDemo]) => includeDemo));
    assert.ok(elements(tree).some(node => node.props.children === 241));
  } finally {
    cleanup?.();
    f.unmount();
  }
});

test('failed snapshot and log queries display feedback without crashing and allow a successful retry', async () => {
  let focusedCallback, cleanup, fail = true, calls = 0;
  const f = uiFixture({
    __timers: { setInterval: () => 1, clearInterval: () => {} },
    'expo-router': { router: {}, useFocusEffect: callback => {
      if (focusedCallback === callback) return;
      focusedCallback = callback;
      cleanup = callback();
    } },
    [path.resolve(__dirname, '../src/services/systemMonitorService.ts')]: {
      getSystemMonitorSnapshot: async () => {
        calls++;
        if (fail) throw new Error('Edge Function returned a non-2xx status code');
        return { database: { status: 'ok', latency_ms: 15 },
          edge_functions: { ai_chat: { status: 'ok', latency_ms: null }, food_scan: { status: 'ok', latency_ms: null } },
          request_metrics_available: false, request_metrics: {}, errors_last_24h: 0 };
      },
      getRecentMonitorEvents: async () => {
        calls++;
        if (fail) return Promise.reject({ code: '42703', message: 'private database detail' });
        return [];
      },
    },
  });
  const Screen = f.load('app/admin/monitoring').default;
  const render = () => f.render(() => Screen());
  const t = f.load('src/i18n/index').default.t.bind(f.load('src/i18n/index').default);
  try {
    render();
    await tick();
    let tree = render();
    assert.equal(elements(tree).filter(node => node.props.accessibilityRole === 'alert').length, 2);
    assert.ok(!JSON.stringify(tree).includes('private database detail'));
    const refreshButton = elements(tree).find(node => node.props.title === t('monitor.refresh'));
    assert.equal(refreshButton.props.loading, false);
    fail = false;
    await refreshButton.props.onPress();
    tree = render();
    assert.equal(calls, 4);
    assert.equal(elements(tree).filter(node => node.props.accessibilityRole === 'alert').length, 0);
    assert.equal(elements(tree).find(node => node.props.title === t('monitor.refresh')).props.loading, false);
  } finally {
    cleanup?.();
    f.unmount();
  }
});
