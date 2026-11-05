const { test } = require('node:test');
process.env.TZ = 'Asia/Ho_Chi_Minh';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const createLoader = require('./load-ts.cjs');
const { A, B, food, source, goal, fullSource } = require('./health-report-fixture.cjs');
const load = createLoader();
const { buildHealthReport, validateReportRange, reportChartBuckets } = load('src/lib/healthReportCalculations');
const { getDaysInRange, shiftDay } = load('src/lib/dateUtils');
const { healthReportHtml } = load('src/lib/healthReportHtml');
const start = '2026-10-27', end = '2026-11-02', now = new Date('2026-11-05T05:00:00Z');
const base = { id: 'row', user_id: A, distance_km: null, active_minutes: null };
const build = data => buildHealthReport(source(data), start, end, now);

test('report distinguishes absent days from stored zero and divides only by recorded days', () => {
  const empty = build({});
  assert.equal(empty.steps.total, null); assert.equal(empty.steps.average, null);
  assert.equal(empty.sleep.total, null); assert.equal(empty.water.total, null); assert.equal(empty.nutrition.total, null);
  assert.equal(empty.goals.eligibleDays, 0); assert.equal(empty.daysWithData, 0);
  const result = build({ steps: [{ ...base, record_date: start, steps: 0 }, { ...base, id: 'second', record_date: end, steps: 10000 }] });
  assert.equal(result.steps.total, 10000); assert.equal(result.steps.average, 5000);
  assert.equal(result.steps.daily[0].value, 0); assert.equal(result.steps.daily[1].value, null);
  assert.equal(result.steps.recordedDays, 2); assert.equal(result.dayCount, 7); assert.equal(result.daysWithData, 2);
});

test('report sums repeated water entries and multi-food portions without rounding source nutrients', () => {
  const report = build({ water: [250, 500, 300].map((amount, i) => ({ ...base, id: String(i), amount_ml: amount, recorded_at: `${start}T${String(i + 8).padStart(2, '0')}:00:00Z` })),
    meals: [150, 75].map((quantity, i) => ({ ...base, id: String(i), consumed_at: `${start}T12:00:00Z`, meal_type: 'lunch', quantity_g: quantity, food: food() })) });
  assert.equal(report.water.total, 1050); assert.equal(report.water.average, 1050);
  assert.equal(report.nutrition.total, 292.5); assert.equal(report.nutrition.recordedDays, 1);
  assert.ok(Math.abs(report.nutrition.macros.protein - 6.075) < 1e-10);
  assert.equal(report.nutrition.macros.carbs, 63); assert.equal(report.nutrition.average, 292.5);
});

test('missing, null or invalid food nutrition blocks export, while actual nutrient zeros remain valid', () => {
  const meal = { ...base, consumed_at: `${start}T12:00:00Z`, quantity_g: 100, meal_type: 'lunch', food: food() };
  for (const bad of [null, food({ calories_per_100g: null }), food({ protein_per_100g: '' }), food({ fat_per_100g: 'NaN' })]) {
    assert.throws(() => build({ meals: [{ ...meal, food: bad }] }), error => error.message === 'report.incompleteNutrition');
  }
  assert.equal(build({ meals: [{ ...meal, food: food({ calories_per_100g: 0 }) }] }).nutrition.total, 0);
});

test('sleep spanning midnight uses wake day, sums naps and deduplicates intervals consistently with Sleep', () => {
  const overnight = { ...base, sleep_start: `${start}T23:00:00+07:00`, sleep_end: '2026-10-28T06:00:00+07:00', quality_rating: 4 };
  const report = build({ sleep: [overnight, { ...overnight, id: 'duplicate' }, { ...base, id: 'nap', sleep_start: '2026-10-28T13:00:00+07:00', sleep_end: '2026-10-28T14:00:00+07:00', quality_rating: 2 }] });
  assert.equal(report.sleep.total, 480); assert.equal(report.sleep.average, 480); assert.equal(report.sleep.quality, 3);
  assert.equal(report.sleep.recordedDays, 1);
});

test('goal achievement uses effective-day snapshots, excludes missing/zero targets, and requires all configured tracking records', () => {
  const report = build({ goals: [goal({ daily_water_ml: null, target_sleep_minutes: null }), goal({ id: 'change', effective_from: '2026-10-29', daily_steps: 8000, daily_water_ml: null, target_sleep_minutes: null })],
    steps: [start, '2026-10-29'].map((date, i) => ({ ...base, id: String(i), record_date: date, steps: 7000 })) });
  assert.equal(report.steps.achievedDays, 1); assert.equal(report.steps.eligibleDays, 2);
  assert.equal(report.steps.daily[0].goal, 6000); assert.equal(report.steps.daily[2].goal, 8000);
  assert.equal(report.goals.achievedDays, 1); assert.equal(report.goals.eligibleDays, 2);
  assert.equal(build({ goals: [goal()], steps: [{ ...base, record_date: start, steps: 8000 }] }).goals.eligibleDays, 0);
  assert.equal(build({ goals: [goal({ daily_steps: 0 })], steps: [{ ...base, record_date: start, steps: 0 }] }).steps.eligibleDays, 0);
  assert.equal(build({ goals: [goal({ effective_from: end })], steps: [{ ...base, record_date: start, steps: 10000 }] }).steps.eligibleDays, 0);
});

test('weight uses real measurement order, handles two readings in one day, and never fabricates a trend or BMI', () => {
  const first = { ...base, weight_kg: '65', recorded_at: `${start}T08:00:00Z` };
  const last = { ...base, id: 'last', weight_kg: '64.5', recorded_at: `${start}T20:00:00Z` };
  const single = build({ weights: [first], latestWeight: first });
  assert.equal(single.weight.change, null); assert.equal(single.weight.points.length, 1);
  assert.ok(Math.abs(single.weight.bmi - 65 / 1.65 ** 2) < 1e-10);
  assert.equal(build({ weights: [last, first], latestWeight: last }).weight.change, -0.5);
  assert.equal(build({ latestWeight: first, profile: { id: A, height_cm: null } }).weight.bmi, null);
  assert.equal(build({}).weight.bmi, null);
  assert.equal(build({ latestWeight: { ...first, recorded_at: '2026-11-04T08:00:00Z' } }).weight.latest, null);
  assert.throws(() => build({ latestWeight: { ...first, weight_kg: 0 } }));
});

test('report rejects cross-account rows and profiles instead of mixing identities', () => {
  assert.throws(() => build({ steps: [{ ...base, user_id: B, record_date: start, steps: 10 }] }), error => error.code === 'AUTH_CHANGED');
  assert.throws(() => build({ profile: { id: B } }), error => error.code === 'AUTH_CHANGED');
});

test('date boundaries are inclusive over month/year, reject invalid/future dates, and cap at 90 days', () => {
  assert.equal(getDaysInRange('2025-12-29', '2026-01-04').length, 7);
  validateReportRange('2026-08-05', '2026-11-02', '2026-11-05');
  assert.throws(() => validateReportRange('2026-08-04', '2026-11-02', '2026-11-05'), /report.rangeLimit/);
  assert.throws(() => validateReportRange(end, start, '2026-11-05'), /report.invalidRange/);
  assert.throws(() => validateReportRange('2026-02-30', end, '2026-11-05'), /report.invalidRange/);
  assert.throws(() => validateReportRange(start, '2026-11-06', '2026-11-05'), /report.futureRange/);
});

test('near-midnight grouping and range filters follow local date in UTC+7 and UTC-8, including DST', () => {
  for (const [zone, expected] of [['Asia/Ho_Chi_Minh', '2026-11-05'], ['America/Los_Angeles', '2026-11-04']]) {
    const script = `const d=require('./tests/load-ts.cjs')()('src/lib/dateUtils'); console.log(d.timestampDateKey('2026-11-04T18:00:00Z')); const b=d.getLocalDayBounds('2026-11-04'); console.log(d.timestampDateKey(b.start)); console.log(d.timestampDateKey(new Date(Date.parse(b.end)-1).toISOString()));`;
    const result = spawnSync(process.execPath, ['-e', script], { cwd: process.cwd(), env: { ...process.env, TZ: zone }, encoding: 'utf8' });
    assert.equal(result.status, 0); assert.deepEqual(result.stdout.trim().split(/\r?\n/), [expected, '2026-11-04', '2026-11-04']);
  }
});

test('long-range chart buckets preserve missing values and zero, average recorded days and label partial weeks honestly', () => {
  const days = getDaysInRange('2026-10-01', '2026-10-30').map(date => ({ date, value: null, goal: 100 }));
  days[0].value = 0; days[1].value = 200;
  const buckets = reportChartBuckets(days);
  assert.equal(buckets.length, 5); assert.equal(buckets[0].value, 100); assert.equal(buckets[0].count, 2);
  assert.equal(buckets[1].value, null); assert.equal(buckets.at(-1).days, 2);
});

test('HTML is escaped, fully localized, self-contained, compact when sparse and paginated when complete', async () => {
  const { default: i18n, initialization } = load('src/i18n/index'); await initialization;
  const dates = getDaysInRange(shiftDay(end, -89), end);
  const full = buildHealthReport(fullSource(dates), dates[0], end, now);
  for (const language of ['vi', 'en']) {
    const html = healthReportHtml(full, i18n.getFixedT(language), language);
    assert.equal((html.match(/<article class="page">/g) ?? []).length, 2);
    assert.match(html, /size:A4 portrait/); assert.match(html, /<svg/); assert.match(html, /Nguyễn Thị Ánh/);
    assert.doesNotMatch(html, /undefined|NaN|\[object Object\]|<script|https?:\/\/(?!www\.w3\.org)/);
    assert.match(html, language === 'vi' ? /BÁO CÁO SỨC KHỎE CÁ NHÂN/ : /PERSONAL HEALTH REPORT/);
  }
  const empty = healthReportHtml(build({ profile: { id: A, full_name: '<img src=x onerror="alert(1)"> & Lan' } }), i18n.getFixedT('vi'), 'vi');
  assert.equal((empty.match(/<article class="page">/g) ?? []).length, 1);
  assert.match(empty, /&lt;img/); assert.doesNotMatch(empty, /<img|<svg/);
  const sparse = healthReportHtml(build({ water: [{ ...base, amount_ml: 250, recorded_at: `${start}T08:00:00Z` }] }), i18n.getFixedT('en'), 'en');
  assert.equal((sparse.match(/<article class="page">/g) ?? []).length, 1);
  assert.match(sparse, /Water intake analysis/); assert.doesNotMatch(sparse, /Step analysis/);
});
