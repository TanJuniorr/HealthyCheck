/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const tick = () => new Promise(resolve => setImmediate(resolve));

function reporterFixture(platform = 'web') {
  const listeners = {}, inserts = [], queries = [], invocations = [];
  let signedIn = true, insertError = null, nativeHandler, previousCalls = 0;
  const supabase = {
    auth: { getSession: async () => ({ data: { session: signedIn ? { user: { id: 'owner' } } : null } }) },
    functions: { invoke: async (...args) => { invocations.push(args); return { data: {}, error: null }; } },
    from: () => ({
      insert: async row => { inserts.push(row); return { error: insertError }; },
      select: () => {
        const query = { eq: (...args) => { queries.push(args); return query; }, order: () => query, limit: async () => ({ data: [], error: null }) };
        return query;
      },
    }),
  };
  class ErrorEvent { constructor(error) { this.error = error; } }
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../src/services/systemMonitorService.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, {
    exports, Date, Map, Error, ErrorEvent,
    window: { addEventListener: (name, handler) => { assert.equal(listeners[name], undefined); listeners[name] = handler; } },
    ErrorUtils: { getGlobalHandler: () => () => { previousCalls++; }, setGlobalHandler: handler => { nativeHandler = handler; } },
    require: name => name === 'expo-constants' ? { expoConfig: { version: '1.0.0' } }
      : name === 'react-native' ? { Platform: { OS: platform } } : { supabase },
  });
  return { api: exports, listeners, inserts, queries, invocations, ErrorEvent,
    signIn: value => { signedIn = value; }, failInsert: value => { insertError = value; },
    native: (...args) => nativeHandler(...args), previousCalls: () => previousCalls };
}

test('web exceptions and unhandled promise rejections are captured once without retaining private messages', async () => {
  const f = reporterFixture();
  f.api.installGlobalAppErrorReporter();
  f.api.installGlobalAppErrorReporter();
  f.listeners.error({ target: 'image' });
  f.listeners.error(new f.ErrorEvent({ name: 'TypeError', message: 'private health data' }));
  f.listeners.unhandledrejection({ reason: { name: 'ReferenceError', message: 'private chat' } });
  await tick();
  assert.equal(f.inserts.length, 2);
  assert.deepEqual(f.inserts.map(row => row.event_code), ['unhandled_type_error', 'unhandled_reference_error']);
  assert.ok(f.inserts.every(row => row.platform === 'web' && row.user_id === 'owner'));
  assert.ok(!JSON.stringify(f.inserts).includes('private'));
  f.listeners.error(new f.ErrorEvent({ name: 'TypeError' }));
  await tick();
  assert.equal(f.inserts.length, 2);
});

test('native reports preserve the previous handler and fatal severity', async () => {
  const f = reporterFixture('android');
  f.api.installGlobalAppErrorReporter();
  f.native(new Error('private'), true);
  await tick();
  assert.equal(f.previousCalls(), 1);
  assert.equal(f.inserts[0].severity, 'fatal');
  assert.equal(f.inserts[0].platform, 'android');
});

test('missing sessions and failed writes do not prevent a subsequent successful report', async () => {
  const f = reporterFixture();
  f.signIn(false);
  await f.api.reportUnhandledAppError(new Error('private'));
  f.signIn(true);
  f.failInsert({ code: 'network' });
  await f.api.reportUnhandledAppError(new Error('private'));
  f.failInsert(null);
  await f.api.reportUnhandledAppError(new Error('private'));
  await f.api.reportUnhandledAppError(new Error('private'));
  assert.equal(f.inserts.length, 2);
});

test('the data filter is sent to both snapshot and event queries', async () => {
  const f = reporterFixture();
  await f.api.getSystemMonitorSnapshot(false);
  await f.api.getRecentMonitorEvents(false);
  assert.equal(f.invocations[0][1].body.include_demo, false);
  assert.equal(f.queries[0][0], 'is_demo');
  assert.equal(f.queries[0][1], false);
  await f.api.getSystemMonitorSnapshot();
  await f.api.getRecentMonitorEvents();
  assert.equal(f.invocations[1][1].body.include_demo, true);
  assert.equal(f.queries.length, 1);
});

function endpointFixture(role = 'admin') {
  let handler;
  const calls = [];
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: 'owner' } }, error: null }) },
    from: table => {
      const filters = [];
      const query = {
        select: () => query, eq: (...args) => { filters.push(args); return query; },
        gte: () => query, limit: async () => ({ error: null }),
        maybeSingle: async () => ({ data: { role }, error: null }),
        then: resolve => {
          calls.push({ table, filters });
          return Promise.resolve({ error: null, count: filters.some(([, value]) => value === false) ? 0 : 30 }).then(resolve);
        },
      };
      return query;
    },
    rpc: async (name, args) => {
      calls.push({ name, args });
      return { error: null, data: [{ function_name: 'ai-chat', total_requests: args.p_include_demo ? '241' : '1',
        successful_requests: args.p_include_demo ? '193' : '1', failed_requests: args.p_include_demo ? '48' : '0',
        success_rate_percent: '80.1', average_duration_ms: '1200', p95_duration_ms: '3000', demo_requests: args.p_include_demo ? '240' : '0' }] };
    },
  };
  const code = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../supabase/functions/system-monitor/index.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, {
    exports: {}, Response, AbortController, setTimeout, clearTimeout, performance,
    fetch: async () => new Response('ok'),
    Deno: { env: { get: name => name === 'SUPABASE_URL' ? 'https://example.test' : name === 'SUPABASE_PUBLISHABLE_KEYS' ? undefined : 'test-key' }, serve: callback => { handler = callback; } },
    require: () => ({ createClient: () => client, corsHeaders: {} }),
  });
  return { calls, request: (body, token = 'test') => handler(new Request('https://example.test', {
    method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: JSON.stringify(body),
  })) };
}

test('snapshot requires an admin and validates the sample filter before reading metrics', async () => {
  const guest = endpointFixture();
  assert.equal((await guest.request({ action: 'snapshot' }, null)).status, 401);
  const regular = endpointFixture('user');
  assert.equal((await regular.request({ action: 'snapshot' })).status, 403);
  const admin = endpointFixture();
  assert.equal((await admin.request({ action: 'snapshot', include_demo: 'true' })).status, 400);
  assert.equal(admin.calls.length, 0);
  assert.equal(regular.calls.length, 0);
});

test('snapshot includes all data by default and supports an explicit internal filter', async () => {
  const f = endpointFixture();
  let response = await f.request({ action: 'snapshot', include_demo: true });
  assert.equal(response.status, 200);
  let snapshot = await response.json();
  assert.equal(snapshot.request_metrics.ai_chat.total_requests, 241);
  assert.equal(snapshot.request_metrics.ai_chat.demo_requests, 240);
  assert.equal(snapshot.request_metrics.food_scan.total_requests, 0);
  assert.equal(snapshot.demo_errors_last_24h, 30);
  response = await f.request({ action: 'snapshot', include_demo: false });
  snapshot = await response.json();
  assert.equal(snapshot.request_metrics.ai_chat.total_requests, 1);
  assert.equal(snapshot.request_metrics.ai_chat.demo_requests, 0);
  assert.equal(snapshot.errors_last_24h, 0);
  assert.equal(snapshot.demo_errors_last_24h, 0);
  assert.ok(f.calls.some(call => call.filters?.some(([key, value]) => key === 'is_demo' && value === false)));
  snapshot = await (await f.request({ action: 'snapshot' })).json();
  assert.equal(snapshot.request_metrics.ai_chat.total_requests, 241);
});
