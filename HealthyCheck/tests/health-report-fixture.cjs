// Test/visual-QA data only. Application report services never import this module.
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const stamp = '2026-10-27T05:00:00Z';
function food(overrides = {}) { return { id: B, name: 'Cơm', calories_per_100g: '130', protein_per_100g: '2.7', carbs_per_100g: '28', fat_per_100g: '0.3', ...overrides }; }
function source(overrides = {}) {
  return { owner: A, profile: { id: A, full_name: 'Nguyễn Thị Ánh', date_of_birth: '1998-03-12', gender: 'female', height_cm: '165', activity_level: 'moderately_active', weight_goal: 'maintain' },
    steps: [], sleep: [], water: [], meals: [], weights: [], latestWeight: null, goals: [], ...overrides };
}
function goal(overrides = {}) { return { id: B, user_id: A, effective_from: '2026-01-01', created_at: stamp, daily_steps: 6000, target_sleep_minutes: 420, daily_water_ml: 2000, daily_calories: 2000, ...overrides }; }
function fullSource(dates) {
  const data = source({ goals: [goal(), goal({ id: 'changed', effective_from: dates[Math.floor(dates.length / 2)], daily_steps: 8000 })] });
  dates.forEach((day, i) => {
    if (i % 9 === 4) return;
    const base = { id: `row-${i}`, user_id: A, created_at: `${day}T05:00:00+07:00` };
    data.steps.push({ ...base, record_date: day, steps: i === 2 ? 0 : 4500 + i % 5 * 1200, distance_km: null, active_minutes: null });
    data.sleep.push({ ...base, sleep_start: `${day}T00:20:00+07:00`, sleep_end: `${day}T07:40:00+07:00`, quality_rating: 4 });
    for (let j = 0; j < 5; j++) data.water.push({ ...base, id: `water-${i}-${j}`, amount_ml: 400, recorded_at: `${day}T${String(8 + j * 2).padStart(2, '0')}:00:00+07:00` });
    data.meals.push({ ...base, food: food(), food_id: B, meal_type: 'lunch', quantity_g: 180, consumed_at: `${day}T12:00:00+07:00` });
    if (i % 3 === 0 || i === dates.length - 1) data.weights.push({ ...base, weight_kg: 65 - i * 0.02, recorded_at: `${day}T08:00:00+07:00` });
  });
  data.latestWeight = data.weights.at(-1) ?? null;
  return data;
}
module.exports = { A, B, stamp, food, source, goal, fullSource };
