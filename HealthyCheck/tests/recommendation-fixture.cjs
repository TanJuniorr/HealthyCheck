/* global __dirname */
const path = require('node:path');
const { createClient } = require('@supabase/supabase-js');
const createLoader = require('./load-ts.cjs');
const dates = createLoader()('src/lib/dateUtils');
const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222';
const boundary = file => path.resolve(__dirname, '../src/' + file);
const table = request => request.url.pathname.split('/').at(-1);
const requestedOwner = request => (request.url.searchParams.get(table(request) === 'profiles' ? 'id' : 'user_id') ?? '').slice(3);
const profile = (id = A, patch = {}) => ({ id, date_of_birth: '1996-01-01', gender: 'male', height_cm: '175', activity_level: 'moderately_active', weight_goal: 'maintain', ...patch });
const weight = (id = A, kg = '65') => ({ id: B, user_id: id, weight_kg: kg, recorded_at: '2026-01-01T00:00:00Z', created_at: '2026-01-01T00:00:00Z' });
const history = (id = A, count = 14, steps = 5000) => Array.from({ length: count }, (_, i) => ({ id: String(i), user_id: id, record_date: dates.shiftDay(dates.toLocalDateKey(), -i - 1), steps, active_minutes: null, distance_km: null }));
const defaultResponse = request => ({ data: table(request) === 'profiles' ? [profile(requestedOwner(request))] : table(request) === 'weight_records' ? [weight(requestedOwner(request))] : history(requestedOwner(request)) });

function fixture(handler = defaultResponse, overrides = {}) {
  let owner = A; const calls = [];
  const client = createClient('https://unit-test.invalid', 'sb_publishable_test', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (input, init) => {
      const request = { url: new URL(String(input)), method: init.method, headers: new Headers(init.headers), body: init.body ? JSON.parse(init.body) : null };
      calls.push(request); const answer = await handler(request); let data = answer.data ?? [];
      if (request.headers.get('Accept')?.includes('vnd.pgrst.object') && Array.isArray(data)) data = data[0] ?? null;
      return new Response(JSON.stringify(data), { status: answer.status ?? 200, headers: { 'Content-Type': 'application/json', 'Content-Range': `0-0/${answer.total ?? (Array.isArray(data) ? data.length : 1)}` } });
    } },
  });
  client.auth.getUser = async () => ({ data: { user: owner ? { id: owner, user_metadata: {} } : null }, error: null });
  client.auth.getSession = async () => ({ data: { session: owner ? { user: { id: owner }, access_token: 'unit-test-only' } : null }, error: null });
  const load = createLoader({ [boundary('lib/supabase.ts')]: { supabase: client }, ...overrides });
  return { load, calls, setOwner(value) { owner = value; } };
}
module.exports = { fixture, table, requestedOwner, profile, weight, history, defaultResponse, boundary, dates, A, B };
