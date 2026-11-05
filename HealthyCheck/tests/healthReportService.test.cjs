/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { createClient } = require('@supabase/supabase-js');
const createLoader = require('./load-ts.cjs');
const { A, B, food, source, goal } = require('./health-report-fixture.cjs');
const start = '2026-10-27', end = '2026-11-02';
function fixture(handler = () => null, overrides = {}) {
  let owner = A; const calls = [];
  const data = {
    profiles: [source().profile], health_goals: [goal()], step_records: [], sleep_records: [], weight_records: [],
    water_records: Array.from({ length: 450 }, (_, i) => ({ id: `water-${i}`, user_id: A, amount_ml: 250, recorded_at: `${start}T08:00:00Z` })),
    meal_records: Array.from({ length: 250 }, (_, i) => ({ id: `meal-${i}`, user_id: A, food_id: B, quantity_g: 100, meal_type: 'lunch', consumed_at: `${start}T12:00:00Z`, food: food() })),
  };
  const client = createClient('https://unit-test.invalid', 'sb_publishable_test', { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: async (input, init) => {
    const request = { url: new URL(String(input)), method: init.method, headers: new Headers(init.headers) }; calls.push(request);
    const custom = await handler(request);
    if (custom) return new Response(JSON.stringify(custom.data), { status: custom.status ?? 200, headers: { 'Content-Type': 'application/json' } });
    const table = request.url.pathname.split('/').at(-1), params = request.url.searchParams;
    const rows = data[table] ?? [], offset = Number(params.get('offset') ?? 0), limit = Math.min(70, Number(params.get('limit') ?? 200));
    const body = request.headers.get('Accept')?.includes('vnd.pgrst.object') ? rows[0] ?? null : rows.slice(offset, offset + limit);
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json', 'Content-Range': `${offset}-${offset + limit - 1}/${rows.length}` } });
  } } });
  client.auth.getUser = async () => ({ data: { user: owner ? { id: owner } : null }, error: null });
  client.auth.getSession = async () => ({ data: { session: owner ? { user: { id: owner } } : null }, error: null });
  const load = createLoader({ [path.resolve(__dirname, '../src/lib/supabase.ts')]: { supabase: client }, ...overrides });
  return { calls, data, load, setOwner(value) { owner = value; }, service: load('src/services/healthReportService') };
}
test('report reuses real SDK range services, exhausts server-capped pages and never writes user data', async () => {
  const f = fixture();
  const result = await f.service.loadHealthReport(start, end, A);
  assert.equal(result.water.total, 450 * 250); assert.equal(result.nutrition.total, 250 * 130);
  assert.equal(f.calls.filter(call => call.url.pathname.endsWith('/water_records')).length, 7);
  assert.equal(f.calls.filter(call => call.url.pathname.endsWith('/meal_records')).length, 4);
  assert.ok(f.calls.every(call => call.method === 'GET'));
  for (const call of f.calls) {
    const params = call.url.searchParams, table = call.url.pathname.split('/').at(-1);
    assert.equal(params.get(table === 'profiles' ? 'id' : 'user_id'), `eq.${A}`);
    if (table === 'water_records') {
      assert.ok(params.getAll('recorded_at').some(filter => filter.startsWith('gte.')));
      assert.ok(params.getAll('recorded_at').some(filter => filter.startsWith('lt.')));
    }
  }
  f.data.water_records.push({ ...f.data.water_records[0], id: 'new', amount_ml: 100 });
  assert.equal((await f.service.loadHealthReport(start, end, A)).water.total, 450 * 250 + 100);
});
test('a failed source blocks the whole report instead of quietly producing zero', async () => {
  const f = fixture(request => request.url.pathname.endsWith('/water_records') ? { status: 403, data: { code: '42501' } } : null);
  await assert.rejects(f.service.loadHealthReport(start, end, A), error => error.code === 'PERMISSION_DENIED');
});
test('invalid dates, unauthenticated users and mismatched expected owners fail before reading health data', async () => {
  const f = fixture();
  await assert.rejects(f.service.loadHealthReport(end, start, A), /report.invalidRange/);
  f.setOwner(null); await assert.rejects(f.service.loadHealthReport(start, end, A), error => error.code === 'UNAUTHENTICATED');
  f.setOwner(B); await assert.rejects(f.service.loadHealthReport(start, end, A), error => error.code === 'AUTH_CHANGED');
  assert.equal(f.calls.length, 0);
});
test('an account switch while data loads rejects the old report', async () => {
  let release, entered;
  const started = new Promise(resolve => { entered = resolve; });
  const f = fixture(async request => { if (request.url.pathname.endsWith('/step_records')) { entered(); await new Promise(resolve => { release = resolve; }); } });
  const job = f.service.loadHealthReport(start, end, A);
  await started; f.setOwner(B); release();
  await assert.rejects(job, error => error.code === 'AUTH_CHANGED');
});
test('a stalled read ends with a retryable timeout and clears its timer after success', async () => {
  const f = fixture();
  await assert.rejects(f.service.reportTimeout(new Promise(() => {}), 10), /report.timeout/);
  assert.equal(await f.service.reportTimeout(Promise.resolve(42), 100), 42);
});

function pdfFixture(overrides = {}) {
  let owner = A; const calls = [], files = new Set(['file:///generated.pdf']);
  class File {
    constructor(...segments) { this.uri = segments.map(segment => segment.uri ?? segment).join('/'); }
    get exists() { return files.has(this.uri); }
    get size() { return 1000; }
    async move(destination) { files.delete(this.uri); files.add(destination.uri); calls.push(['move', destination.uri]); this.uri = destination.uri; }
    delete() { files.delete(this.uri); calls.push(['delete', this.uri]); }
    async canPreview() { return true; }
    async preview() { calls.push(['preview', this.uri]); }
  }
  class Directory { constructor(...segments) { this.uri = segments.map(segment => segment.uri ?? segment).join('/'); } create() {} }
  const auth = { assertIdentity: async id => { if (id !== owner) throw Object.assign(new Error('account changed'), { code: 'AUTH_CHANGED' }); } };
  const load = createLoader({
    'expo-print': { printToFileAsync: async options => { calls.push(['create', options]); return { uri: 'file:///generated.pdf', numberOfPages: 2 }; }, printAsync: async options => { calls.push(['print', options]); } },
    'expo-sharing': { isAvailableAsync: async () => true, shareAsync: async (uri, options) => { calls.push(['share', uri, options]); } },
    'expo-file-system': { File, Directory, Paths: { cache: 'file:///cache' } },
    [path.resolve(__dirname, '../src/services/queryCore.ts')]: auth,
    [path.resolve(__dirname, '../src/services/healthReportService.ts')]: { reportTimeout: async promise => promise },
    ...overrides,
  });
  return { service: load('src/services/healthReportPdfService'), calls, files, setOwner(value) { owner = value; } };
}
test('native PDF uses A4 dimensions, a readable .pdf name, preview capabilities and platform PDF sharing', async () => {
  const f = pdfFixture();
  const pdf = await f.service.createHealthReportPdf({ owner: A, start, end }, '<html>report</html>');
  assert.equal(pdf.filename, `HealthyCheck_Report_${start}_${end}.pdf`);
  assert.match(pdf.uri, /health-reports/); assert.ok(pdf.canPreview); assert.ok(pdf.canShare);
  const options = f.calls.find(call => call[0] === 'create')[1];
  assert.equal(options.width, 595.28); assert.equal(options.height, 841.89);
  await f.service.openReportPdf(pdf); await f.service.shareReportPdf(pdf); await f.service.printReportPdf(pdf);
  const share = f.calls.find(call => call[0] === 'share');
  assert.equal(share[2].mimeType, 'application/pdf'); assert.equal(share[2].UTI, 'com.adobe.pdf');
  f.setOwner(B);
  await assert.rejects(f.service.openReportPdf(pdf), error => error.code === 'AUTH_CHANGED');
  await assert.rejects(f.service.shareReportPdf(pdf), error => error.code === 'AUTH_CHANGED');
});
test('native generation serializes duplicate taps and removes a generated PDF after an account switch', async () => {
  let release, entered;
  const started = new Promise(resolve => { entered = resolve; });
  const f = pdfFixture({ 'expo-print': { printToFileAsync: async () => { entered(); await new Promise(resolve => { release = resolve; }); return { uri: 'file:///generated.pdf', numberOfPages: 1 }; } } });
  const pending = f.service.createHealthReportPdf({ owner: A, start, end }, '<html/>');
  await started;
  await assert.rejects(f.service.createHealthReportPdf({ owner: A, start, end }, '<html/>'), /report.busy/);
  f.setOwner(B); release();
  await assert.rejects(pending, error => error.code === 'AUTH_CHANGED');
  assert.equal(f.files.has('file:///generated.pdf'), false);
});
test('native generation cleans up late output after timeout and offers only available viewer/share actions', async () => {
  let release, entered;
  const started = new Promise(resolve => { entered = resolve; });
  const f = pdfFixture({
    'expo-print': { printToFileAsync: async () => { entered(); await new Promise(resolve => { release = resolve; }); return { uri: 'file:///generated.pdf', numberOfPages: 1 }; } },
    [path.resolve(__dirname, '../src/services/healthReportService.ts')]: { reportTimeout: async promise => { await started; void promise.catch(() => {}); throw new Error('report.timeout'); } },
  });
  await assert.rejects(f.service.createHealthReportPdf({ owner: A, start, end }, '<html/>'), /report.timeout/);
  release(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.files.size, 0);
});
