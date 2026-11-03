const { test } = require('node:test'), assert = require('node:assert/strict');
const { fixture, table, requestedOwner, profile, weight, history, defaultResponse, boundary, A, B } = require('./recommendation-fixture.cjs');
const service = f => f.load('src/services/healthRecommendationService');
function threeReads(f) {
  assert.equal(f.calls.length, 3);
  for (const name of ['profiles', 'weight_records', 'step_records']) assert.equal(f.calls.filter(request => table(request) === name).length, 1);
  assert.ok(f.calls.every(request => request.method === 'GET'));
  assert.ok(f.calls.every(request => !['health_goals', 'water_records', 'meal_records'].includes(table(request))));
}
test('aggregate shares each source once and keeps recommended/saved/actual values separate', async () => {
  const f = fixture(); const result = await service(f).getMyHealthRecommendations();
  for (const key of ['calories', 'steps', 'water']) assert.equal(result[key].status, 'success');
  assert.equal(result.steps.recommendedSteps, 7000); assert.equal(result.water.recommendedWaterMl, 2250); threeReads(f);
  assert.equal('daily_steps' in result, false); assert.equal('actualWaterMl' in result, false);
});
test('unsupported calorie coefficient still allows independent step and water success', async () => {
  const f = fixture(request => table(request) === 'profiles' ? { data: [profile(A, { gender: 'prefer_not_to_say', height_cm: null })] } : defaultResponse(request));
  const result = await service(f).getMyHealthRecommendations(); assert.equal(result.calories.status, 'missing_data'); assert.equal(result.steps.status, 'success'); assert.equal(result.water.status, 'success'); threeReads(f);
});
test('missing weight blocks calories and water without blocking steps or inventing values', async () => {
  const f = fixture(request => table(request) === 'weight_records' ? { data: [] } : defaultResponse(request));
  const result = await service(f).getMyHealthRecommendations(); assert.equal(result.calories.status, 'missing_data'); assert.equal(result.water.status, 'missing_data'); assert.equal(result.steps.status, 'success'); threeReads(f);
});
test('source query failures affect only dependent estimates and remain distinct from missing data', async () => {
  for (const failing of ['weight_records', 'step_records']) {
    const f = fixture(request => table(request) === failing ? { status: 400, data: { message: 'Network unavailable' } } : defaultResponse(request));
    const result = await service(f).getMyHealthRecommendations(); threeReads(f);
    if (failing === 'weight_records') {
      assert.equal(result.calories.status, 'query_error'); assert.equal(result.water.status, 'query_error'); assert.equal(result.steps.status, 'success');
      assert.equal(result.water.error.code, 'NETWORK'); assert.equal('recommendedWaterMl' in result.water, false);
    } else { assert.equal(result.steps.status, 'query_error'); assert.equal(result.steps.error.code, 'NETWORK'); assert.equal(result.calories.status, 'success'); assert.equal(result.water.status, 'success'); }
  }
});
test('a failed shared profile read is not mistaken for three incomplete profiles; fresh calls retry', async () => {
  let offline = true, profileReads = 0;
  const f = fixture(defaultResponse, { [boundary('services/profileService.ts')]: { getMyProfile: async () => { profileReads++; if (offline) throw Error('Network unavailable'); return profile(); } } });
  const failed = await service(f).getMyHealthRecommendations(); assert.equal(profileReads, 1);
  for (const key of ['calories', 'steps', 'water']) { assert.equal(failed[key].status, 'query_error'); assert.equal(failed[key].error.code, 'NETWORK'); }
  offline = false; const retry = await service(f).getMyHealthRecommendations(); assert.equal(profileReads, 2);
  for (const key of ['calories', 'steps', 'water']) assert.equal(retry[key].status, 'success');
});
test('aggregate invokes the existing calorie service instead of duplicating its algorithm', async () => {
  const sentinel = { status: 'missing_data', reason: 'formula_coefficient_required' }; let calls = 0;
  const f = fixture(defaultResponse, { [boundary('services/calorieRecommendationService.ts')]: { getMyCalorieRecommendation: async context => { calls++; assert.equal(context.ownerId, A); return sentinel; } } });
  const result = await service(f).getMyHealthRecommendations(); assert.equal(result.calories, sentinel); assert.equal(calls, 1); threeReads(f);
});
test('aggregate rejects session changes and foreign rows globally; new account results are never cached', async () => {
  let release, started, count = 0, delayed = true;
  const gate = new Promise(resolve => { release = resolve; }), ready = new Promise(resolve => { started = resolve; });
  const f = fixture(async request => {
    const owner = requestedOwner(request); if (delayed) { if (++count === 3) started(); await gate; }
    return { data: table(request) === 'profiles' ? [profile(owner)] : table(request) === 'weight_records' ? [weight(owner, owner === A ? '65' : '80')] : history(owner) };
  });
  const pending = service(f).getMyHealthRecommendations(); await ready; f.setOwner(B); release();
  await assert.rejects(pending, error => error.code === 'AUTH_CHANGED'); delayed = false;
  const next = await service(f).getMyHealthRecommendations(); assert.equal(next.water.weightKg, 80);
  f.setOwner(A); const original = await service(f).getMyHealthRecommendations(); assert.equal(original.water.weightKg, 65);
  assert.equal(f.calls.length, 9); assert.ok(f.calls.every(request => request.method === 'GET'));
  const foreign = fixture(request => table(request) === 'step_records' ? { data: history(B) } : defaultResponse(request));
  await assert.rejects(service(foreign).getMyHealthRecommendations(), error => error.code === 'AUTH_CHANGED');
});
test('a missing profile is an independent missing-data result, and guests issue no data requests', async () => {
  const f = fixture(request => table(request) === 'profiles' ? { data: [] } : defaultResponse(request));
  const result = await service(f).getMyHealthRecommendations(); for (const key of ['calories', 'steps', 'water']) assert.equal(result[key].status, 'missing_data'); threeReads(f);
  const guest = fixture(); guest.setOwner(null); await assert.rejects(service(guest).getMyHealthRecommendations(), error => error.code === 'UNAUTHENTICATED'); assert.equal(guest.calls.length, 0);
});
test('detail screens request only selected recommendation sources, without fetching unused history or inventing skipped results',async()=>{
 for(const selected of [['calories'],['steps'],['water'],['calories','water']]){
  const f=fixture();const result=await service(f).getMySelectedHealthRecommendations(selected);
  assert.deepEqual(Object.keys(result).sort(),[...selected].sort());assert.equal(f.calls.length,2);
  assert.equal(f.calls.filter(request=>table(request)==='profiles').length,1);
  assert.equal(f.calls.filter(request=>table(request)==='step_records').length,selected.includes('steps')?1:0);
  assert.equal(f.calls.filter(request=>table(request)==='weight_records').length,selected.includes('steps')?0:1);
 }
 const f=fixture();for(const selected of [[],['bad'],['water','water']])await assert.rejects(service(f).getMySelectedHealthRecommendations(selected));assert.equal(f.calls.length,0);
});
