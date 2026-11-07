/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');
const root = path.resolve(__dirname, '..');
const admin = '11111111-1111-4111-8111-111111111111';
const user = '22222222-2222-4222-8222-222222222222';
const seed = fs.readFileSync(path.join(root, 'supabase/seeds/monitor-demo.sql'), 'utf8');

test('monitor samples are repeatable, correctly aggregated, and isolated by RLS and the real-data filter', async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
      CREATE SCHEMA auth; CREATE SCHEMA private;
      CREATE TABLE auth.users(id uuid PRIMARY KEY);
      CREATE TABLE public.user_roles(user_id uuid PRIMARY KEY, role text);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
        $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      CREATE FUNCTION private.is_article_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS
        $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role='admin') $$;
      GRANT USAGE ON SCHEMA public,auth,private TO anon,authenticated,service_role;
      INSERT INTO auth.users VALUES('${admin}'),('${user}');
      INSERT INTO public.user_roles VALUES('${admin}','admin'),('${user}','user');`);
    for (const suffix of ['_system_monitoring.sql', '_monitor_request_metrics.sql', '_monitor_demo_data.sql']) {
      const folder = path.join(root, 'supabase/migrations');
      const file = fs.readdirSync(folder).find(name => name.endsWith(suffix));
      await db.exec(fs.readFileSync(path.join(folder, file), 'utf8'));
    }
    await db.exec(`INSERT INTO public.app_monitor_request_metrics(function_name,succeeded,status_code,duration_ms)
      VALUES('ai-chat',true,200,100);
      INSERT INTO public.app_monitor_events(user_id,severity,event_code,platform)
      VALUES('${user}','error','unhandled_js_error','web');`);
    await db.exec(seed);
    await db.exec(seed);
    assert.equal((await db.query('SELECT count(*)::int n FROM app_monitor_request_metrics')).rows[0].n, 361);
    assert.equal((await db.query('SELECT count(*)::int n FROM app_monitor_events')).rows[0].n, 31);
    assert.equal((await db.query('SELECT count(distinct event_code)::int n FROM app_monitor_events WHERE is_demo')).rows[0].n, 5);
    assert.equal((await db.query('SELECT count(distinct platform)::int n FROM app_monitor_events WHERE is_demo')).rows[0].n, 3);
    assert.equal((await db.query("SELECT count(*)::int n FROM app_monitor_events WHERE is_demo AND severity='fatal'")).rows[0].n, 7);

    await db.exec('SET ROLE service_role');
    const stats = (await db.query("SELECT * FROM app_monitor_request_stats_with_demo(now()-interval '24 hours',true) ORDER BY function_name")).rows;
    assert.deepEqual(stats.map(row => Number(row.total_requests)), [241, 120]);
    assert.deepEqual(stats.map(row => Number(row.demo_requests)), [240, 120]);
    assert.deepEqual(stats.map(row => Number(row.failed_requests)), [48, 24]);
    assert.equal(Number(stats[1].success_rate_percent), 80);
    assert.ok(Number(stats[0].p95_duration_ms) >= Number(stats[0].average_duration_ms));
    const real = (await db.query("SELECT * FROM app_monitor_request_stats(now()-interval '24 hours')")).rows;
    assert.equal(real.length, 2);
    assert.equal(real.reduce((sum, row) => sum + Number(row.total_requests), 0), 361);
    const filtered = (await db.query("SELECT * FROM app_monitor_request_stats_with_demo(now()-interval '24 hours',false)")).rows;
    assert.equal(Number(filtered[0].demo_requests), 0);
    assert.equal(Number(filtered[0].total_requests), 1);

    await db.exec('RESET ROLE');
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [user]);
    await db.exec('SET ROLE authenticated');
    assert.equal((await db.query('SELECT count(*)::int n FROM app_monitor_events')).rows[0].n, 0);
    await assert.rejects(db.exec("SELECT * FROM app_monitor_request_stats_with_demo(now(),true)"), error => error.code === '42501');
    await assert.rejects(db.exec('SELECT * FROM app_monitor_request_metrics'), error => error.code === '42501');
    await assert.rejects(db.query(`INSERT INTO app_monitor_events(user_id,severity,event_code,platform,is_demo)
      VALUES($1,'error','unhandled_js_error','web',true)`, [user]), error => error.code === '42501');
    await assert.rejects(db.query(`INSERT INTO app_monitor_events(user_id,severity,event_code,platform)
      VALUES($1,'error','unhandled_js_error','web')`, [admin]), error => error.code === '42501');
    await db.query(`INSERT INTO app_monitor_events(user_id,severity,event_code,platform)
      VALUES($1,'error','unhandled_js_error','web')`, [user]);
    await db.exec('RESET ROLE');
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [admin]);
    await db.exec('SET ROLE authenticated');
    assert.equal((await db.query('SELECT count(*)::int n FROM app_monitor_events')).rows[0].n, 32);
    assert.equal((await db.query('SELECT count(*)::int n FROM app_monitor_events WHERE NOT is_demo')).rows[0].n, 2);
  } finally {
    await db.close();
  }
});
