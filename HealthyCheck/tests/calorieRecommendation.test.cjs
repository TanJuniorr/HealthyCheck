const { test } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load-ts.cjs')();
const calorie = load('src/lib/calorieRecommendation');
const config = load('src/lib/calorieRecommendationConfig');
const male = { dateOfBirth: '2001-11-03', gender: 'male', heightCm: 175, weightKg: 70, activityLevel: 'sedentary', weightGoal: 'maintain' };
const today = '2026-11-03';
const calculate = (patch = {}, date = today) => calorie.calculateCalorieRecommendation({ ...male, ...patch }, date);
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
function noInvalidNumbers(value) {
  if (typeof value === 'number') assert.ok(Number.isFinite(value));
  else if (value && typeof value === 'object') for (const child of Object.values(value)) noInvalidNumbers(child);
}
function unavailable(result, status, reason) {
  assert.equal(result.status, status); assert.equal(result.reason, reason);
  assert.equal('recommendedCalories' in result, false); noInvalidNumbers(result);
}

test('male age 25, 175 cm, 70 kg, sedentary maintenance uses independent hand-calculated values', () => {
  const result = calculate();
  assert.equal(result.status, 'success'); assert.equal(result.age, 25);
  assert.equal(result.bmr, 1673.75); assert.equal(result.activityMultiplier, 1.2);
  assert.equal(result.tdee, 2008.5); assert.equal(result.calorieAdjustment, 0);
  assert.equal(result.recommendedCalories, 2008.5); assert.equal(result.calculationMethod, 'mifflin_st_jeor');
});

test('female age 30, 160 cm, 55 kg, moderately active, slow fat loss keeps full precision', () => {
  const result = calculate({ dateOfBirth: '1996-11-03', gender: 'female', heightCm: '160', weightKg: '55', activityLevel: 'moderately_active', weightGoal: 'lose_fat_slow' });
  assert.equal(result.status, 'success'); assert.equal(result.age, 30); assert.equal(result.bmr, 1239);
  close(result.tdee, 1920.45); close(result.calorieAdjustment, -192.045); close(result.recommendedCalories, 1728.405);
  assert.equal(result.heightCm, 160); assert.equal(result.weightKg, 55);
});

test('all five activity factors change TDEE without rounding or adding step calories', () => {
  for (const [activityLevel, multiplier, tdee] of [
    ['sedentary', 1.2, 2008.5], ['lightly_active', 1.375, 2301.40625],
    ['moderately_active', 1.55, 2594.3125], ['very_active', 1.725, 2887.21875], ['extremely_active', 1.9, 3180.125],
  ]) {
    const result = calculate({ activityLevel }); assert.equal(result.status, 'success');
    assert.equal(result.activityMultiplier, multiplier); close(result.tdee, tdee); close(result.recommendedCalories, tdee);
  }
  assert.equal(calorie.getActivityMultiplier(null), null); assert.equal(calorie.getActivityMultiplier('__proto__'), null);
});

test('all five weight strategies respect absolute caps and the 10%/20% deficit caps', () => {
  for (const [weightGoal, adjustment, recommendation] of [
    ['lose_fat_slow', -200.85, 1807.65], ['lose_fat', -401.7, 1606.8], ['maintain', 0, 2008.5],
    ['gain_weight_slow', 150, 2158.5], ['gain_weight', 300, 2308.5],
  ]) {
    const result = calculate({ weightGoal }); assert.equal(result.status, 'success');
    close(result.calorieAdjustment, adjustment); close(result.recommendedCalories, recommendation);
  }
  const slow = calculate({ activityLevel: 'extremely_active', weightGoal: 'lose_fat_slow' });
  assert.equal(slow.calorieAdjustment, -250); close(slow.recommendedCalories, 2930.125);
  const fast = calculate({ activityLevel: 'extremely_active', weightGoal: 'lose_fat' });
  assert.equal(fast.calorieAdjustment, -500); close(fast.recommendedCalories, 2680.125);
});

test('updated weights and fractional measurements recalculate instead of using cached or rounded data', () => {
  const heavier = calculate({ weightKg: '80' }); assert.equal(heavier.bmr, 1773.75); assert.equal(heavier.tdee, 2128.5);
  const fractional = calculate({ heightCm: '175.25', weightKg: '70.125', activityLevel: 'lightly_active' });
  assert.equal(fractional.bmr, 1676.5625); close(fractional.tdee, 2305.2734375);
  const frozen = Object.freeze({ ...male }); calorie.calculateCalorieRecommendation(frozen, today);
  assert.equal(frozen.weightKg, 70); assert.equal(calculate().tdee, 2008.5);
});

test('local calendar age changes on birthdays, including leap birthdays and year boundaries', () => {
  assert.equal(calculate({}, '2026-11-02').age, 24); assert.equal(calculate().age, 25);
  assert.equal(calculate({}, '2026-11-04').age, 25);
  assert.equal(calculate({ dateOfBirth: '2000-02-29' }, '2025-02-28').age, 24);
  assert.equal(calculate({ dateOfBirth: '2000-02-29' }, '2025-03-01').age, 25);
  assert.equal(calculate({ dateOfBirth: '2000-01-01' }, '2025-12-31').age, 25);
  assert.equal(calculate({ dateOfBirth: '2000-01-01' }, '2026-01-01').age, 26);
});

test('missing fields never fall back to 2,000 kcal and preserve computable partial data', () => {
  for (const field of Object.keys(male)) for (const value of [null, undefined, '', '  ']) {
    const result = calculate({ [field]: value }); unavailable(result, 'missing_data', 'required_fields_missing');
    assert.ok(result.missingFields.includes(field));
  }
  const noWeight = calculate({ weightKg: null }); assert.equal('weightKg' in noWeight.data, false); assert.equal('bmr' in noWeight.data, false);
  const noActivity = calculate({ activityLevel: null }); assert.equal(noActivity.data.bmr, 1673.75); assert.equal('tdee' in noActivity.data, false);
  const noGoal = calculate({ weightGoal: null }); assert.equal(noGoal.data.tdee, 2008.5);
  unavailable(calorie.calculateCalorieRecommendation({}, today), 'missing_data', 'required_fields_missing');
});

test('other and prefer_not_to_say require a formula coefficient without guessing a BMR', () => {
  for (const gender of ['other', 'prefer_not_to_say']) {
    const result = calculate({ gender }); unavailable(result, 'missing_data', 'formula_coefficient_required');
    assert.ok(result.missingFields.includes('gender')); assert.equal('bmr' in result.data, false); assert.equal('tdee' in result.data, false);
    assert.equal(result.data.weightKg, 70);
  }
});

test('invalid dates, numeric data, enum values and out-of-range inputs are explicitly rejected', () => {
  const cases = {
    dateOfBirth: ['2026-11-04', '1900-02-29', '2020-02-30', '0000-01-01', '1800-01-01', 1990, {}],
    heightCm: [NaN, Infinity, -Infinity, 0, -1, 29.9, 300.1, 'NaN', '0xAF', true, [], {}],
    weightKg: [NaN, Infinity, 0, -1, 500.1, 'Infinity', '0x46', false, [70], {}],
    gender: ['invalid', 0, [], {}], activityLevel: ['invalid', '__proto__', 0, {}], weightGoal: ['invalid', 'constructor', 0, {}],
  };
  for (const [field, values] of Object.entries(cases)) for (const value of values) {
    const result = calculate({ [field]: value }); unavailable(result, 'out_of_scope', 'invalid_data');
    assert.ok(result.invalidFields.includes(field), `${field}: ${String(value)}`);
  }
  for (const date of ['bad', '2026-02-30']) unavailable(calculate({}, date), 'out_of_scope', 'invalid_data');
  for (const input of [null, undefined, [], 42]) unavailable(calorie.calculateCalorieRecommendation(input, today), 'out_of_scope', 'invalid_data');
});

test('under 18 never receives a maintenance, loss or gain recommendation; age 18 is eligible', () => {
  for (const weightGoal of ['lose_fat_slow', 'lose_fat', 'maintain', 'gain_weight_slow', 'gain_weight']) {
    const result = calculate({ dateOfBirth: '2008-11-04', weightGoal }); unavailable(result, 'out_of_scope', 'under_18');
    assert.equal('bmr' in result.data, false); assert.equal('calorieAdjustment' in result.data, false);
  }
  assert.equal(calculate({ dateOfBirth: '2008-11-03' }).status, 'success');
});

test('BMI below 18.5 blocks deficits before computing an adjustment, without substituting a goal', () => {
  for (const weightGoal of ['lose_fat_slow', 'lose_fat']) {
    const result = calculate({ weightKg: 50, weightGoal }); unavailable(result, 'needs_review', 'underweight_deficit');
    assert.equal('calorieAdjustment' in result.data, false); assert.equal('candidateCalories' in result.data, false);
  }
  assert.equal(calculate({ weightKg: 50, weightGoal: 'maintain' }).status, 'success');
  assert.equal(calculate({ weightKg: 56.65625, weightGoal: 'lose_fat_slow' }).status, 'success');
});

test('low energy deficits require review for each coefficient, with no automatic safe-goal clamp', () => {
  const man = calculate({ dateOfBirth: '1966-11-03', heightCm: 160, weightKg: 55, weightGoal: 'lose_fat_slow' });
  unavailable(man, 'needs_review', 'low_energy_estimate'); close(man.data.candidateCalories, 1355.4);
  const woman = calculate({ dateOfBirth: '1966-11-03', gender: 'female', heightCm: 150, weightKg: 62.35, weightGoal: 'lose_fat_slow' });
  unavailable(woman, 'needs_review', 'low_energy_estimate'); close(woman.data.candidateCalories, 1188);
  assert.equal(calculate({ heightCm: 160, weightKg: 37 }).recommendedCalories, 1500);
  assert.equal(calculate({ gender: 'female', heightCm: 160, weightKg: 28.6 }).recommendedCalories, 1200);
});

test('nonpositive estimates and excessive surpluses cannot produce accepted recommendations', () => {
  unavailable(calculate({ dateOfBirth: '1906-11-03', gender: 'female', heightCm: 30, weightKg: 1 }), 'needs_review', 'nonpositive_energy_estimate');
  const gain = calculate({ dateOfBirth: '1966-11-03', gender: 'female', heightCm: 100, weightKg: 30, weightGoal: 'gain_weight_slow' });
  unavailable(gain, 'needs_review', 'excessive_surplus'); close(gain.data.tdee, 556.8); assert.equal(gain.data.calorieAdjustment, 150);
  const bigGain = calculate({ dateOfBirth: '1966-11-03', heightCm: 100, weightKg: 30, weightGoal: 'gain_weight' });
  unavailable(bigGain, 'needs_review', 'excessive_surplus'); assert.equal(bigGain.data.calorieAdjustment, 300);
});

test('helpers fail explicitly for invalid input and all results carry estimate limitations', () => {
  for (const bmr of [0, -1, NaN, Infinity]) assert.equal(calorie.calculateTDEE(bmr, 'sedentary'), null);
  assert.equal(calorie.calculateTDEE(Number.MAX_VALUE, 'extremely_active'), null);
  assert.equal(calorie.calculateBMR(null), null);
  assert.equal(calorie.calculateBMR({ age: 17, gender: 'male', heightCm: 175, weightKg: 70 }), null);
  assert.equal(calorie.calculateBMR({ age: 25, gender: 'other', heightCm: 175, weightKg: 70 }), null);
  for (const tdee of [0, -1, NaN, Infinity]) assert.equal(calorie.getCalorieAdjustment(tdee, 'gain_weight'), null);
  assert.equal(calorie.getCalorieAdjustment(2000, 'bad'), null);
  for (const result of [calculate(), calculate({ gender: 'other' }), calculate({ weightKg: 0 }), calculate({ weightKg: 50, weightGoal: 'lose_fat' })]) {
    assert.equal(result.limitations.screeningThresholdsAreNotUniversalSafetyLimits, true);
    assert.equal(result.limitations.genderIsOnlyAProxyForFormulaCoefficient, true);
    assert.deepEqual([...result.limitations.notDesignedFor], ['pregnancy', 'breastfeeding', 'medical_nutrition_needs']);
    noInvalidNumbers(result);
  }
  assert.equal(Object.isFrozen(config.CALORIE_GOAL_STRATEGIES.lose_fat), true);
});
