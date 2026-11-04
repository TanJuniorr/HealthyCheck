const { test } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load-ts.cjs')();
const { default: i18n } = load('src/i18n/index');
const { formatGoalDuration, lowGoalNotes } = load('src/lib/healthGoalPresentation');

test('sleep goals use readable hours and minutes, with no redundant zero units', async () => {
 await i18n.changeLanguage('vi');
 assert.equal(formatGoalDuration(480), '8 giờ');
 assert.equal(formatGoalDuration(451), '7 giờ 31 phút');
 assert.equal(formatGoalDuration(45), '45 phút');
 assert.equal(formatGoalDuration(null), 'Chưa đặt mục tiêu');
 await i18n.changeLanguage('en');
 assert.equal(formatGoalDuration(480), '8 hr');
 assert.equal(formatGoalDuration(451), '7h 31m');
 assert.equal(formatGoalDuration(45), '45 min');
});

test('presentation notes leave low, zero and missing saved goals untouched', () => {
 const saved = Object.freeze({ daily_calories: 910, daily_steps: 650 });
 assert.deepEqual([...lowGoalNotes(saved)], ['calories', 'steps']);
 assert.equal(saved.daily_calories, 910);assert.equal(saved.daily_steps, 650);
 assert.deepEqual([...lowGoalNotes({ daily_calories: 0, daily_steps: 0 })], ['calories', 'steps']);
 assert.deepEqual([...lowGoalNotes({ daily_calories: null, daily_steps: undefined })], []);
 assert.deepEqual([...lowGoalNotes({ daily_calories: 2000, daily_steps: 8000 })], []);
 assert.deepEqual([...lowGoalNotes({ daily_calories: NaN, daily_steps: -1 })], []);
});
