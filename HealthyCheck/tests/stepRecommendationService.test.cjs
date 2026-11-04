const { test } = require('node:test'), assert = require('node:assert/strict');
const { fixture, table, requestedOwner, profile, history, dates, A, B } = require('./recommendation-fixture.cjs');
const service = f => f.load('src/services/stepRecommendationService');
const readOnly = f => assert.ok(f.calls.every(request => request.method === 'GET' && ['profiles', 'step_records'].includes(table(request))));

test('step service reads only its owner profile and one ordered 14-day page, with no weight, gender or calorie dependency', async () => {
  const f = fixture(request => ({ data: table(request) === 'profiles' ? [profile(A, { gender: null, height_cm: null })] : history() }));
  const result = await service(f).getMyStepRecommendation(); assert.equal(result.status, 'success'); assert.equal(result.recommendedSteps, 7000);
  assert.equal(result.validHistoryDays, 0); assert.equal(result.baselineSteps, null); assert.equal(result.historyQuality, 'unverified'); assert.equal(result.confidence, 'low');
  assert.equal(result.observedHistoryDays, 14); assert.equal(result.explanationKey, 'recommendations.steps.unverifiedHistory');
  assert.equal(f.calls.length, 2); readOnly(f);
  const p = f.calls.find(request => table(request) === 'profiles'); assert.equal(p.url.searchParams.get('id'), 'eq.' + A);
  const query = f.calls.find(request => table(request) === 'step_records').url.searchParams;
  assert.equal(query.get('user_id'), 'eq.' + A); assert.equal(query.get('limit'), '14'); assert.equal(query.get('offset'), '0');
  assert.ok(query.getAll('record_date').includes('gte.' + dates.shiftDay(dates.toLocalDateKey(), -14)));
  assert.ok(query.getAll('record_date').includes('lte.' + dates.shiftDay(dates.toLocalDateKey(), -1)));
  assert.equal(query.get('order'), 'record_date.desc.nullslast,created_at.desc.nullslast,id.desc');
});
test('no history and recorded zero with unknown coverage remain different from verified zero-step days', async () => {
  for (const rows of [[], history(A, 1, 0)]) {
    const f = fixture(request => ({ data: table(request) === 'profiles' ? [profile()] : rows }));
    const result = await service(f).getMyStepRecommendation(); assert.equal(result.baselineSteps, null); assert.equal(result.validHistoryDays, 0);
    assert.equal(result.historyQuality, rows.length ? 'unverified' : 'none'); assert.equal(result.observedHistoryDays, rows.length);
  }
});
test('step service rejects unauthenticated and foreign rows without exposing a recommendation', async () => {
  const guest = fixture(); guest.setOwner(null); await assert.rejects(service(guest).getMyStepRecommendation(), error => error.code === 'UNAUTHENTICATED'); assert.equal(guest.calls.length, 0);
  for (const foreign of ['profiles', 'step_records']) {
    const f = fixture(request => ({ data: table(request) === 'profiles' ? [profile(foreign === 'profiles' ? B : A)] : history(foreign === 'step_records' ? B : A) }));
    await assert.rejects(service(f).getMyStepRecommendation(), error => error.code === 'AUTH_CHANGED'); readOnly(f);
  }
});
test('history network failures propagate; a fresh request can retry without writing or caching failure', async () => {
  let offline = true;
  const f = fixture(request => table(request) === 'step_records' && offline ? { status: 400, data: { message: 'Network unavailable' } } : { data: table(request) === 'profiles' ? [profile()] : history() });
  await assert.rejects(service(f).getMyStepRecommendation(), error => error.code === 'NETWORK');
  offline = false; assert.equal((await service(f).getMyStepRecommendation()).status, 'success'); assert.equal(f.calls.length, 4); readOnly(f);
});
test('step session changes in flight discard old-account results and subsequent calls read the new owner', async () => {
  let release, started, count = 0, delayed = true;
  const gate = new Promise(resolve => { release = resolve; }), ready = new Promise(resolve => { started = resolve; });
  const f = fixture(async request => {
    const owner = requestedOwner(request);
    if (delayed) { if (++count === 2) started(); await gate; }
    return { data: table(request) === 'profiles' ? [profile(owner, { activity_level: owner === A ? 'lightly_active' : 'sedentary' })] : history(owner) };
  });
  const pending = service(f).getMyStepRecommendation(); await ready; f.setOwner(B); release();
  await assert.rejects(pending, error => error.code === 'AUTH_CHANGED'); delayed = false;
  assert.equal((await service(f).getMyStepRecommendation()).recommendedSteps, 4000); readOnly(f);
});
