const { test } = require('node:test'), assert = require('node:assert/strict');
const load = require('./load-ts.cjs')();
const { calculateWaterRecommendation: calculate } = load('src/lib/waterRecommendation');
const today = '2026-11-03', input = { age: 30, weightKg: 65, activityLevel: 'sedentary' };
const recommend = (patch = {}) => calculate({ ...input, ...patch }, today);
const noTarget = (result, status, reason) => { assert.equal(result.status, status); assert.equal(result.reason, reason); assert.equal('recommendedWaterMl' in result, false); };

test('50, 65 and 80 kg generate independent weight-based fluid estimates in ml per day', () => {
  for (const [weightKg, expected] of [[50, 1500], [65, 1950], [80, 2400]]) {
    const result = recommend({ weightKg }); assert.equal(result.status, 'success'); assert.equal(result.baseWaterMl, expected); assert.equal(result.recommendedWaterMl, expected);
  }
  assert.equal(recommend({ weightKg: '65' }).weightKg, 65);
});
test('all five configurable activity adjustments are estimates, with no assumed sweat measurement', () => {
  for (const [activityLevel, adjustment, target] of [['sedentary', 0, 1950], ['lightly_active', 150, 2100], ['moderately_active', 300, 2250], ['very_active', 450, 2400], ['extremely_active', 600, 2550]]) {
    const result = recommend({ activityLevel }); assert.equal(result.activityAdjustmentMl, adjustment); assert.equal(result.recommendedWaterMl, target);
    assert.equal(result.limitations.activityAdjustmentIsNotMeasuredSweatLoss, true);
  }
});
test('weight goals never increase or decrease fluid estimates and no BMR or gender is required', () => {
  for (const weightGoal of ['lose_fat_slow', 'lose_fat', 'maintain', 'gain_weight_slow', 'gain_weight', null]) assert.equal(recommend({ weightGoal }).recommendedWaterMl, 1950);
});
test('round only the final estimate: do not round the base before adding activity', () => {
  const result = recommend({ weightKg: '65.83', activityLevel: 'lightly_active' });
  assert.ok(Math.abs(result.baseWaterMl - 1974.9) < 1e-9); assert.equal(result.recommendedWaterMl, 2100);
  assert.equal(recommend({ weightKg: 65.84, activityLevel: 'lightly_active' }).recommendedWaterMl, 2150);
});
test('under-18 scope and current local age from birth date are checked; conflicting ages are invalid', () => {
  noTarget(recommend({ age: 17 }), 'out_of_scope', 'under_18');
  assert.equal(recommend({ age: 18 }).status, 'success');
  assert.equal(recommend({ age: undefined, dateOfBirth: '1996-11-03' }).age, 30);
  assert.equal(calculate({ dateOfBirth: '1996-11-03', weightKg: 65, activityLevel: 'sedentary' }, '2026-11-02').age, 29);
  noTarget(recommend({ dateOfBirth: '1995-11-03' }), 'out_of_scope', 'invalid_data');
  noTarget(recommend({ dateOfBirth: '2026-11-04' }), 'out_of_scope', 'invalid_data');
  for (const age of [NaN, Infinity, -1, 121, 30.5, '30']) noTarget(recommend({ age }), 'out_of_scope', 'invalid_data');
});
test('missing required information never becomes a 2,000 ml default', () => {
  for (const field of ['age', 'weightKg', 'activityLevel']) for (const value of [null, undefined, '']) noTarget(recommend({ [field]: value }), 'missing_data', 'required_fields_missing');
  noTarget(calculate({}, today), 'missing_data', 'required_fields_missing');
});
test('invalid numeric inputs and enums are rejected without returning NaN or an approved target', () => {
  for (const weightKg of [0, -1, 501, NaN, Infinity, 'NaN', 'Infinity', '0x41', {}, true, [65]]) noTarget(recommend({ weightKg }), 'out_of_scope', 'invalid_data');
  for (const activityLevel of ['bad', '__proto__', 0, {}]) noTarget(recommend({ activityLevel }), 'out_of_scope', 'invalid_data');
  noTarget(recommend({ weightGoal: 'bad' }), 'out_of_scope', 'invalid_data');
  noTarget(recommend({ fluidRestrictionRequired: 'no' }), 'out_of_scope', 'invalid_data');
  noTarget(calculate(input, 'bad'), 'out_of_scope', 'invalid_data');
});
test('very low/high weights and unusual estimates need review, without clamping to an alleged safe target', () => {
  for (const weightKg of [20, 39.99, 120.01, 150, 500]) noTarget(recommend({ weightKg }), 'needs_review', 'unusual_weight');
  noTarget(recommend({ weightKg: 120, activityLevel: 'extremely_active' }), 'needs_review', 'unusual_water_estimate');
  noTarget(recommend({ weightKg: 116.67 }), 'needs_review', 'unusual_water_estimate');
  assert.equal(recommend({ weightKg: 40 }).recommendedWaterMl, 1200);
  assert.equal(recommend({ weightKg: 116.66 }).recommendedWaterMl, 3500);
});
test('known fluid restriction blocks a target; unknown medical status is explicitly unassessed', () => {
  const blocked = recommend({ fluidRestrictionRequired: true }); noTarget(blocked, 'needs_review', 'fluid_restriction');
  assert.equal(blocked.data.fluidRestrictionAssessment, 'reported_required'); assert.equal('baseWaterMl' in blocked.data, false);
  assert.equal(recommend().fluidRestrictionAssessment, 'not_assessed');
  assert.equal(recommend({ fluidRestrictionRequired: false }).fluidRestrictionAssessment, 'reported_not_required');
  assert.ok(recommend().limitations.notDesignedFor.includes('kidney_disease')); assert.ok(recommend().limitations.notDesignedFor.includes('heart_failure'));
});
test('total dietary water, drinking fluids and logged app water remain distinct; unrecorded food/beverages are unknown', () => {
  const result = recommend(); assert.equal(result.limitations.intakeScope, 'drinking_fluids');
  assert.equal(result.limitations.trackingScope, 'user_logged_water_entries'); assert.equal(result.limitations.canApplyDirectlyToWaterOnlyGoal, false);
  assert.equal(result.limitations.isTotalWaterFromFoodAndBeverages, false);
  assert.equal(result.limitations.foodWaterContributionMl, null); assert.equal(result.limitations.unloggedBeverageContributionMl, null);
  assert.equal('actualWaterMl' in result, false); assert.equal(result.confidence, 'low');
});
test('inputs are immutable and all water explanations have both translations', () => {
  assert.equal(calculate(Object.freeze({ ...input }), today).recommendedWaterMl, 1950);
  for (const language of ['en', 'vi']) {
    const strings = load(`src/i18n/resources/${language}.json`).recommendations.water;
    for (const key of ['drinkingFluidsEstimate', 'fluidRestriction', 'reviewWeight', 'reviewEstimate', 'missingData', 'invalidData', 'under18']) assert.ok(strings[key]?.trim());
  }
});
