const { test } = require('node:test'), assert = require('node:assert/strict');
const { fixture, table, requestedOwner, profile, weight, A, B } = require('./recommendation-fixture.cjs');
const service = f => f.load('src/services/waterRecommendationService');
const readOnly = f => assert.ok(f.calls.every(request => request.method === 'GET' && ['profiles', 'weight_records'].includes(table(request))));

test('water service uses latest numeric-string weight, independent of calorie eligibility or weight goal', async () => {
  let kg = '65';
  const f = fixture(request => ({ data: table(request) === 'profiles' ? [profile(A, { gender: 'other', height_cm: null, weight_goal: 'gain_weight' })] : [weight(A, kg)] }));
  const first = await service(f).getMyWaterRecommendation(); assert.equal(first.status, 'success'); assert.equal(first.weightKg, 65); assert.equal(first.recommendedWaterMl, 2250);
  assert.equal(first.fluidRestrictionAssessment, 'not_assessed'); assert.equal(first.limitations.canApplyDirectlyToWaterOnlyGoal, false);
  const query = f.calls.find(request => table(request) === 'weight_records').url.searchParams;
  assert.equal(query.get('user_id'), 'eq.' + A); assert.equal(query.get('limit'), '1'); assert.equal(query.get('offset'), '0');
  assert.match(query.get('order'), /^recorded_at.desc/);
  kg = '80'; assert.equal((await service(f).getMyWaterRecommendation()).recommendedWaterMl, 2700);
  assert.equal(f.calls.length, 4); readOnly(f);
});
test('missing profile fields/weight and abnormal weights have distinct non-approved results', async () => {
  for (const [savedProfile, savedWeight, expected] of [[profile(), null, 'missing_data'], [profile(A, { activity_level: null }), weight(), 'missing_data'], [null, weight(), 'missing_data'], [profile(), weight(A, '150'), 'needs_review']]) {
    const f = fixture(request => ({ data: table(request) === 'profiles' ? savedProfile ? [savedProfile] : [] : savedWeight ? [savedWeight] : [] }));
    const result = await service(f).getMyWaterRecommendation(); assert.equal(result.status, expected); assert.equal('recommendedWaterMl' in result, false); readOnly(f);
  }
});
test('water service is authenticated and checks both profile and weight row ownership', async () => {
  const guest = fixture(); guest.setOwner(null); await assert.rejects(service(guest).getMyWaterRecommendation(), error => error.code === 'UNAUTHENTICATED'); assert.equal(guest.calls.length, 0);
  for (const foreign of ['profiles', 'weight_records']) {
    const f = fixture(request => ({ data: table(request) === 'profiles' ? [profile(foreign === 'profiles' ? B : A)] : [weight(foreign === 'weight_records' ? B : A)] }));
    await assert.rejects(service(f).getMyWaterRecommendation(), error => error.code === 'AUTH_CHANGED'); readOnly(f);
  }
});
test('water network errors can retry, and invalid database numerics do not become missing data or defaults', async () => {
  let offline = true;
  const f = fixture(request => table(request) === 'weight_records' && offline ? { status: 400, data: { message: 'Network unavailable' } } : { data: table(request) === 'profiles' ? [profile()] : [weight()] });
  await assert.rejects(service(f).getMyWaterRecommendation(), error => error.code === 'NETWORK'); offline = false;
  assert.equal((await service(f).getMyWaterRecommendation()).status, 'success'); readOnly(f);
  const g = fixture(request => ({ data: table(request) === 'profiles' ? [profile()] : [weight(A, 'NaN')] }));
  await assert.rejects(service(g).getMyWaterRecommendation(), error => error.code === 'DATABASE');
});
test('water session change or logout in flight invalidates the result', async () => {
  for (const nextOwner of [B, null]) {
    let release, started, count = 0;
    const gate = new Promise(resolve => { release = resolve; }), ready = new Promise(resolve => { started = resolve; });
    const f = fixture(async request => {
      const owner = requestedOwner(request); if (++count === 2) started(); await gate;
      return { data: table(request) === 'profiles' ? [profile(owner)] : [weight(owner)] };
    });
    const pending = service(f).getMyWaterRecommendation(); await ready; f.setOwner(nextOwner); release();
    await assert.rejects(pending, error => error.code === (nextOwner ? 'AUTH_CHANGED' : 'UNAUTHENTICATED')); readOnly(f);
  }
});
