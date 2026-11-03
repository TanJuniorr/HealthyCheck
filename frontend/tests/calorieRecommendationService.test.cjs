/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { createClient } = require('@supabase/supabase-js');
const createLoader = require('./load-ts.cjs');
const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222';
const boundary = file => path.resolve(__dirname, '../src/' + file);
const profile = (id = A) => ({ id, date_of_birth: '2001-05-01', gender: 'male', height_cm: '175', activity_level: 'sedentary', weight_goal: 'maintain' });
const weight = (id = A, kg = '70') => ({ id: B, user_id: id, weight_kg: kg, recorded_at: '2026-01-01T01:00:00Z', created_at: '2026-01-01T01:00:00Z' });
function independentAge() {
  const now = new Date();
  return now.getFullYear() - 2001 - (now.getMonth() < 4 || (now.getMonth() === 4 && now.getDate() < 1) ? 1 : 0);
}
function fixture(handler, overrides = {}) {
  let owner = A; const calls = [];
  const client = createClient('https://unit-test.invalid', 'sb_publishable_test', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (input, init) => {
      const request = { url: new URL(String(input)), method: init.method, headers: new Headers(init.headers), body: init.body ? JSON.parse(init.body) : null };
      calls.push(request); const response = await handler(request);
      const status = response.status ?? 200; let data = response.data ?? [];
      if (request.headers.get('Accept')?.includes('vnd.pgrst.object') && Array.isArray(data)) data = data[0] ?? null;
      return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Content-Range': '0-0/1' } });
    } },
  });
  client.auth.getUser = async () => ({ data: { user: owner ? { id: owner, user_metadata: {} } : null }, error: null });
  client.auth.getSession = async () => ({ data: { session: owner ? { user: { id: owner }, access_token: 'unit-test-only' } : null }, error: null });
  const load = createLoader({ [boundary('lib/supabase.ts')]: { supabase: client }, ...overrides });
  return { load, calls, service: load('src/services/calorieRecommendationService'), setOwner(value) { owner = value; } };
}
const fromTable = request => request.url.pathname.endsWith('/profiles');
const readOnly = calls => {
  assert.ok(calls.every(request => request.method === 'GET'));
  assert.ok(calls.every(request => /\/(profiles|weight_records)$/.test(request.url.pathname)));
};

test('recommendation uses the current owner profile and exactly one bounded latest-weight read; no goals or sensor requests', async () => {
  const f = fixture(request => ({ data: [fromTable(request) ? { ...profile(), weight_kg: 40 } : weight()] }));
  const result = await f.service.getMyCalorieRecommendation();
  assert.equal(result.status, 'success'); assert.equal(result.age, independentAge()); assert.equal(result.weightKg, 70);
  assert.equal(result.bmr, 1798.75 - 5 * independentAge());
  assert.equal(result.tdee, (1798.75 - 5 * independentAge()) * 1.2);
  assert.equal(f.calls.length, 2); readOnly(f.calls);
  const profileRequest = f.calls.find(fromTable), weightRequest = f.calls.find(request => !fromTable(request));
  assert.equal(profileRequest.url.searchParams.get('id'), 'eq.' + A);
  assert.ok(profileRequest.url.searchParams.get('select').split(',').includes('activity_level'));
  assert.ok(profileRequest.url.searchParams.get('select').split(',').includes('weight_goal'));
  const params = weightRequest.url.searchParams;
  assert.equal(params.get('user_id'), 'eq.' + A); assert.equal(params.get('limit'), '1'); assert.equal(params.get('offset'), '0');
  assert.equal(params.get('order'), 'recorded_at.desc.nullslast,created_at.desc.nullslast,id.desc');
  assert.ok(params.get('recorded_at').startsWith('lt.'));
});

test('weight/profile changes recalculate while every request remains limited to reading profiles and weights', async () => {
  let kg = '70', activity = 'sedentary', goal = 'maintain';
  const f = fixture(request => ({ data: [fromTable(request) ? { ...profile(), activity_level: activity, weight_goal: goal } : weight(A, kg)] }));
  const first = await f.service.getMyCalorieRecommendation(); kg = '80';
  const heavier = await f.service.getMyCalorieRecommendation(); assert.equal(heavier.weightKg, 80);
  assert.ok(Math.abs(heavier.recommendedCalories - first.recommendedCalories - 120) < 1e-9);
  activity = 'moderately_active'; goal = 'gain_weight_slow';
  const updated = await f.service.getMyCalorieRecommendation(); assert.equal(updated.activityMultiplier, 1.55); assert.equal(updated.calorieAdjustment, 150);
  assert.equal(f.calls.length, 6); readOnly(f.calls);
});

test('missing weight, missing profile and legacy NULL preferences return missing data without guessing', async () => {
  for (const [savedProfile, savedWeight, missingFields] of [
    [profile(), null, ['weightKg']], [null, weight(), ['dateOfBirth', 'gender', 'heightCm', 'activityLevel', 'weightGoal']],
    [{ ...profile(), activity_level: null, weight_goal: null }, weight(), ['activityLevel', 'weightGoal']],
  ]) {
    const f = fixture(request => ({ data: fromTable(request) ? (savedProfile ? [savedProfile] : []) : (savedWeight ? [savedWeight] : []) }));
    const result = await f.service.getMyCalorieRecommendation(); assert.equal(result.status, 'missing_data');
    for (const field of missingFields) assert.ok(result.missingFields.includes(field));
    assert.equal('recommendedCalories' in result, false); readOnly(f.calls);
  }
});

test('an unauthenticated request performs no data read', async () => {
  const f = fixture(() => { throw Error('Unexpected request'); }); f.setOwner(null);
  await assert.rejects(f.service.getMyCalorieRecommendation(), error => error.code === 'UNAUTHENTICATED'); assert.equal(f.calls.length, 0);
});

test('network and database failures propagate and can retry, rather than becoming a recommendation or missing data', async () => {
  let offline = true;
  const f = fixture(request => !fromTable(request) && offline ? { status: 503, data: { message: 'Network unavailable' } } : { data: [fromTable(request) ? profile() : weight()] });
  await assert.rejects(f.service.getMyCalorieRecommendation(), error => error.code === 'NETWORK');
  offline = false; assert.equal((await f.service.getMyCalorieRecommendation()).status, 'success'); readOnly(f.calls);
  // Profile service is the boundary here: model a missing migration/schema error
  // without changing the existing profile service's Expo __DEV__ logging behavior.
  const g = fixture(() => ({ data: [weight()] }), {
    [boundary('services/profileService.ts')]: { getMyProfile: async () => { throw Error('column profiles.activity_level does not exist'); } },
  });
  await assert.rejects(g.service.getMyCalorieRecommendation(), /activity_level does not exist/); readOnly(g.calls);
});

test('a session change while profile and weight requests are in flight rejects all stale results', async () => {
  let release, started, reads = 0; const gate = new Promise(resolve => { release = resolve; });
  const ready = new Promise(resolve => { started = resolve; });
  let delayed = true;
  const f = fixture(async request => {
    const requestedOwner = request.url.searchParams.get(fromTable(request) ? 'id' : 'user_id').slice(3);
    if (delayed) { reads++; if (reads === 2) started(); await gate; }
    return { data: [fromTable(request) ? profile(requestedOwner) : weight(requestedOwner, requestedOwner === A ? '70' : '90')] };
  });
  const pending = f.service.getMyCalorieRecommendation(); await ready; f.setOwner(B); release();
  await assert.rejects(pending, error => error.code === 'AUTH_CHANGED');
  delayed = false; const next = await f.service.getMyCalorieRecommendation(); assert.equal(next.weightKg, 90);
  f.setOwner(A); const original = await f.service.getMyCalorieRecommendation(); assert.equal(original.weightKg, 70); readOnly(f.calls);
});

test('foreign returned profile or weight rows fail ownership checks even if the final session is unchanged', async () => {
  for (const foreign of ['profile', 'weight']) {
    const f = fixture(request => ({ data: [fromTable(request) ? profile(foreign === 'profile' ? B : A) : weight(foreign === 'weight' ? B : A)] }));
    await assert.rejects(f.service.getMyCalorieRecommendation(), error => error.code === 'AUTH_CHANGED'); readOnly(f.calls);
  }
});

test('numeric errors in stored rows stay errors and valid out-of-range data is classified by the algorithm', async () => {
  for (const kg of ['NaN', 'Infinity', '-1']) {
    const f = fixture(request => ({ data: [fromTable(request) ? profile() : weight(A, kg)] }));
    await assert.rejects(f.service.getMyCalorieRecommendation(), error => error.code === 'DATABASE'); readOnly(f.calls);
  }
  const f = fixture(request => ({ data: [fromTable(request) ? profile() : weight(A, '501')] }));
  const result = await f.service.getMyCalorieRecommendation(); assert.equal(result.status, 'out_of_scope'); assert.ok(result.invalidFields.includes('weightKg'));
});
