const { test } = require('node:test'), assert = require('node:assert/strict');
const load = require('./load-ts.cjs')();
const { calculateStepRecommendation: calculate, summarizeStepHistory } = load('src/lib/stepRecommendation');
const { shiftDay } = load('src/lib/dateUtils');
const today = '2026-11-03';
const adult = { dateOfBirth: '1996-11-03', activityLevel: 'lightly_active', weightGoal: 'maintain' };
const history = (values, coverage = 'complete') => values.map((steps, i) => ({ date: shiftDay(today, -i - 1), steps, coverage, source: 'device' }));
const recommend = (patch = {}) => calculate({ ...adult, ...patch }, today);
const noTarget = (result, status, reason) => { assert.equal(result.status, status); assert.equal(result.reason, reason); assert.equal('recommendedSteps' in result, false); };

test('all five activity starting targets have low confidence and no invented baseline', () => {
  for (const [activityLevel, expected] of [['sedentary', 4000], ['lightly_active', 5000], ['moderately_active', 7000], ['very_active', 8000], ['extremely_active', 9000]]) {
    const result = recommend({ activityLevel }); assert.equal(result.status, 'success'); assert.equal(result.recommendedSteps, expected);
    assert.equal(result.baselineSteps, null); assert.equal(result.validHistoryDays, 0); assert.equal(result.confidence, 'low'); assert.equal(result.recommendationMethod, 'activity_starting_point');
  }
});
test('all five weight goals direct gradual progression without promising weight loss or increasing gain targets', () => {
  for (const [weightGoal, expected] of [['lose_fat_slow', 5500], ['lose_fat', 5700], ['maintain', 5000], ['gain_weight_slow', 5000], ['gain_weight', 5000]]) {
    const result = recommend({ weightGoal, history: history([4000, 5000, 5000, 6000]) });
    assert.equal(result.status, 'success'); assert.equal(result.baselineSteps, 5000); assert.equal(result.recommendedSteps, expected);
    assert.equal(result.confidence, 'moderate'); assert.equal(result.validHistoryDays, 4);
  }
});
test('adult age boundary and age 60 use local birthdays and gradual age reference ranges', () => {
  noTarget(recommend({ dateOfBirth: '2008-11-04' }), 'out_of_scope', 'under_18');
  assert.equal(recommend({ dateOfBirth: '2008-11-03' }).status, 'success');
  const older = recommend({ dateOfBirth: '1966-11-03', activityLevel: 'extremely_active' });
  assert.equal(older.ageGroup, 'adult_60_plus'); assert.equal(older.recommendedSteps, 8000); assert.deepEqual({ ...older.referenceRange }, { min: 6000, max: 8000 });
  assert.equal(recommend({ dateOfBirth: '1966-11-04', activityLevel: 'extremely_active' }).recommendedSteps, 9000);
  const progression = recommend({ dateOfBirth: '1966-11-03', weightGoal: 'lose_fat', history: history([5000, 5000, 5000, 5000]) });
  assert.equal(progression.recommendedSteps, 5500);
});
test('a missing day is excluded, while a verified complete zero-step day participates in the mean', () => {
  const rows = history([0, 1000, 2000, 3000]); rows[3].date = shiftDay(today, -10);
  const result = recommend({ history: rows }); assert.equal(result.validHistoryDays, 4); assert.equal(result.baselineSteps, 1500); assert.equal(result.recommendedSteps, 1500);
  const missingDay = recommend({ history: rows.slice(1) }); assert.equal(missingDay.baselineSteps, null); assert.equal(missingDay.validHistoryDays, 3); assert.equal(missingDay.historyQuality, 'insufficient');
});
test('only the most recent 14 completed local dates count; current, future and older days do not', () => {
  const rows = history([5000, 5000, 5000]);
  rows.push({ ...rows[0], date: shiftDay(today, -14) }, { ...rows[0], date: today, steps: 40000 }, { ...rows[0], date: shiftDay(today, 1), steps: 40000 }, { ...rows[0], date: shiftDay(today, -15), steps: 40000 });
  const result = recommend({ history: rows }); assert.equal(result.validHistoryDays, 4); assert.equal(result.observedHistoryDays, 4); assert.equal(result.baselineSteps, 5000);
  const sixteen = recommend({ history: history(Array(16).fill(5000)) }); assert.equal(sixteen.validHistoryDays, 14);
});
test('partial, unavailable, unverified legacy and simulated records cannot certify a personal baseline', () => {
  for (const coverage of ['partial', 'unavailable', 'unknown']) {
    const result = recommend({ history: history([1000, 2000, 3000, 4000], coverage) });
    assert.equal(result.validHistoryDays, 0); assert.equal(result.baselineSteps, null); assert.equal(result.recommendedSteps, 5000); assert.equal(result.confidence, 'low');
    assert.equal(result.historyQuality, 'unverified');
  }
  for (const source of ['legacy_step_record', 'simulated', 'mock']) {
    const result = recommend({ history: history([4000, 4000, 4000, 4000]).map(row => ({ ...row, source })) });
    assert.equal(result.validHistoryDays, 0); assert.equal(result.baselineSteps, null);
  }
});
test('duplicate daily snapshots, malformed records and impossible counts do not inflate the baseline', () => {
  const duplicates = history([4000, 4000, 4000, 4000]); duplicates.push({ ...duplicates[0] });
  assert.equal(recommend({ history: duplicates }).validHistoryDays, 3);
  for (const steps of [-1, NaN, Infinity, 50001, 1.5, '4000']) {
    const rows = history([4000, 4000, 4000, steps]); assert.equal(recommend({ history: rows }).validHistoryDays, 3);
  }
  const summary = summarizeStepHistory([null, {}, { date: '2026-02-30', steps: 4000 }, ...history([4000, 4000, 4000, 4000])], today);
  assert.equal(summary.validHistoryDays, 4); assert.equal(summary.baselineSteps, 4000);
});
test('low baselines and rounding never exceed gradual increase caps; high activity is not forced to grow forever', () => {
  assert.equal(recommend({ weightGoal: 'lose_fat', history: history([2000, 2000, 2000, 2000]) }).recommendedSteps, 2200);
  assert.equal(recommend({ weightGoal: 'lose_fat', history: history([3333, 3333, 3333, 3333]) }).recommendedSteps, 3600);
  const roundedLow = recommend({ weightGoal: 'lose_fat', history: history([500, 500, 500, 500]) });
  assert.equal(roundedLow.recommendedSteps, 500); assert.equal(roundedLow.explanationKey, 'recommendations.steps.maintainBaseline');
  assert.equal(recommend({ weightGoal: 'lose_fat', history: history([8000, 8000, 8000, 8000]) }).recommendedSteps, 9000);
  const high = recommend({ weightGoal: 'lose_fat', history: history([12000, 12000, 12000, 12000]) }); assert.equal(high.recommendedSteps, 12000);
  assert.equal(recommend({ dateOfBirth: '1960-01-01', weightGoal: 'lose_fat', history: history([9000, 9000, 9000, 9000]) }).recommendedSteps, 9000);
  for (const baseline of [0, 100, 21000, 40000]) noTarget(recommend({ history: history(Array(4).fill(baseline)) }), 'needs_review', 'unusual_baseline');
});
test('invalid and missing profile fields never produce an approved target', () => {
  for (const field of ['dateOfBirth', 'activityLevel', 'weightGoal']) {
    for (const value of [null, undefined, '']) noTarget(recommend({ [field]: value }), 'missing_data', 'required_fields_missing');
    for (const value of ['invalid', true, {}]) noTarget(recommend({ [field]: value }), 'out_of_scope', 'invalid_data');
  }
  noTarget(recommend({ dateOfBirth: '2026-11-04' }), 'out_of_scope', 'invalid_data');
  noTarget(recommend({ history: {} }), 'out_of_scope', 'invalid_data');
  noTarget(calculate(adult, '2026-02-30'), 'out_of_scope', 'invalid_data');
  for (const input of [null, [], 0]) noTarget(calculate(input, today), 'out_of_scope', 'invalid_data');
});
test('inputs remain unchanged and results contain no calorie/weight/gender dependency', () => {
  const rows = Object.freeze(history([5000, 5000, 5000, 5000]).map(Object.freeze));
  const input = Object.freeze({ ...adult, history: rows }); const result = calculate(input, today);
  assert.equal(result.recommendedSteps, 5000); assert.equal('calories' in result, false); assert.equal('tdee' in result, false);
  assert.equal(result.limitations.doesNotAdjustTdeeOrEstimateBurnedCalories, true);
});
test('every step explanation is available in English and Vietnamese', () => {
  for (const language of ['en', 'vi']) {
    const strings = load(`src/i18n/resources/${language}.json`).recommendations.steps;
    for (const key of ['startingPoint', 'unverifiedHistory', 'insufficientHistory', 'gradualProgression', 'maintainBaseline', 'reviewBaseline', 'missingData', 'invalidData', 'under18']) assert.ok(strings[key]?.trim());
  }
});
