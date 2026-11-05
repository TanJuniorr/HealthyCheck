const { test } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load-ts.cjs')();
const calc = load('src/lib/menstrualCycleCalculations');
const settings = { last_period_start: null, cycle_length: 28, period_length: 5, reminder_enabled: true, reminder_days_before: 2 };
const period = (start, end = load('src/lib/dateUtils').shiftDay(start, 4), id = start) => ({ id, start_date: start, end_date: end });

test('no history, manual anchor, one and two confirmed starts have explicit low-confidence fallback', () => {
 assert.equal(calc.getCyclePrediction('2026-11-05', null, []), null);
 assert.equal(calc.getCyclePrediction('2026-11-05', settings, []), null);
 const manual = calc.getCyclePrediction('2026-11-05', { ...settings, last_period_start: '2026-10-26' });
 assert.equal(manual.source, 'manual'); assert.equal(manual.latestConfirmedStart, null); assert.equal(manual.isPeriodDay, false);
 const one = calc.getCyclePrediction('2026-11-05', { ...settings, last_period_start: '2020-01-01' }, [period('2026-10-26')]);
 assert.equal(one.anchorDate, '2026-10-26'); assert.equal(one.expectedNextPeriodStart, '2026-11-23'); assert.equal(one.confidence, 'low');
 const two = calc.getCyclePrediction('2026-11-05', settings, [period('2026-09-27'), period('2026-10-26')]);
 assert.equal(two.estimatedCycleLength, 29); assert.equal(two.source, 'history'); assert.equal(two.confidence, 'low');
 assert.equal(calc.getCyclePrediction('2026-11-05', null, [period('2026-10-26', null)]).activePeriod.start_date, '2026-10-26');
});
test('sorted distinct confirmed history uses median of latest six intervals, never mutates or discards unusual observations', () => {
 const rows = [period('2026-10-26'), period('2026-08-01'), period('2026-09-27'), period('2026-08-29')];
 const original = JSON.stringify(rows), p = calc.getCyclePrediction('2026-11-05', settings, [...rows, rows[0], { ...rows[1], id: 'duplicate-date' }]);
 assert.deepEqual([...p.intervals], [28, 29, 29]); assert.equal(p.estimatedCycleLength, 29); assert.equal(p.expectedNextPeriodStart, '2026-11-24'); assert.equal(p.confidence, 'moderate'); assert.equal(p.averagePeriodLength, 5); assert.equal(JSON.stringify(rows), original);
 const starts = ['2025-01-01']; for (const length of [10, 12, 28, 29, 28, 28, 70, 29]) starts.push(load('src/lib/dateUtils').shiftDay(starts.at(-1), length));
 const stats = calc.getCycleStatistics(starts.map(start => period(start)));
 assert.deepEqual([...stats.intervals], [28, 29, 28, 28, 70, 29]); assert.equal(stats.estimatedCycleLength, 29); assert.equal(stats.irregular, true);
});
test('irregular spread threshold and preliminary ranges are explicit, and uncertain reminders are not scheduled', () => {
 const make = lengths => { let start = '2026-01-01'; return [period(start), ...lengths.map(length => { start = load('src/lib/dateUtils').shiftDay(start, length); return period(start); })]; };
 assert.equal(calc.getCycleStatistics(make([28, 37])).irregular, false);
 assert.equal(calc.getCycleStatistics(make([28, 38])).irregular, true);
 const irregular = make([20, 40, 29]), latest = irregular.at(-1).start_date;
 const p = calc.getCyclePrediction(latest, settings, irregular);
 assert.notEqual(p.expectedWindowStart, p.expectedWindowEnd); assert.equal(p.confidence, 'low'); assert.equal(calc.getNextPeriodReminderDates(settings, irregular, latest), null);
});
test('late cycles never roll forward, open periods never auto-end, and edits/deletions recompute from actual starts', () => {
 const rows = [period('2026-08-01'), period('2026-08-29'), period('2026-09-27'), period('2026-10-26')];
 const late = calc.getCyclePrediction('2026-12-10', settings, rows);
 assert.equal(late.expectedNextPeriodStart, '2026-11-24'); assert.equal(late.overdueDays, 16); assert.equal(late.cycleDay, 46); assert.equal(late.isPeriodDay, false);
 assert.equal(calc.getNextPeriodReminderDates(settings, rows, '2026-12-10'), null);
 const active = calc.getCyclePrediction('2026-12-10', settings, [period('2026-10-26', null)]);
 assert.ok(active.activePeriod); assert.equal(active.averagePeriodLength, null); assert.equal(calc.getNextPeriodReminderDates(settings, [period('2026-10-26', null)], '2026-10-27'), null);
 assert.equal(calc.getCyclePrediction('2026-11-05', settings, rows.slice(0, -1)).anchorDate, '2026-09-27');
 assert.notEqual(calc.getCyclePrediction('2026-11-05', settings, [...rows.slice(0,-1), period('2026-10-24')]).expectedNextPeriodStart, calc.getCyclePrediction('2026-11-05', settings, rows).expectedNextPeriodStart);
});
test('month, year, leap day and local dates use civil days, and calendar never turns a prediction into an actual period', () => {
 assert.equal(calc.daysBetween('2024-02-28','2024-03-01'), 2); assert.equal(calc.daysBetween('2025-12-31','2026-01-01'), 1);
 assert.equal(calc.daysBetween('2026-03-07','2026-03-09'), 2);
 const rows = [period('2024-02-01')], p = calc.getCyclePrediction('2024-02-10', settings, rows);
 assert.equal(p.expectedNextPeriodStart, '2024-02-29');
 assert.equal(calc.getCycleDayState('2024-02-29', '2024-02-10', rows, p).predicted, true);
 assert.equal(calc.getCycleDayState('2024-02-29', '2024-03-10', rows, p).predicted, false);
 assert.equal(calc.getCycleDayState('2024-02-29', '2024-03-10', rows, p).actual, false);
 assert.equal(calc.getCycleDayState('2024-02-03', '2024-03-10', rows, p).actual, true);
 assert.equal(calc.getCycleDayState('2024-02-11', '2024-02-10', [period('2024-02-01', null)], p).actual, false);
});
test('Vietnam local midnight and leap-day arithmetic are independent of UTC/DST boundaries',()=>{
 const {execFileSync}=require('node:child_process');
 const script="const assert=require('node:assert/strict');const load=require('./tests/load-ts.cjs')();const dates=load('src/lib/dateUtils');const calc=load('src/lib/menstrualCycleCalculations');assert.equal(dates.toLocalDateKey(new Date('2026-11-04T18:00:00Z')),'2026-11-05');assert.equal(calc.daysBetween('2024-02-28','2024-03-01'),2);console.log('ok');";
 assert.match(execFileSync(process.execPath,['-e',script],{cwd:process.cwd(),env:{...process.env,TZ:'Asia/Ho_Chi_Minh'},encoding:'utf8'}),/ok/);
});
