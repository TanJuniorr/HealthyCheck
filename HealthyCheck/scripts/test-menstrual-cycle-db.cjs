/* global __dirname */
const {test} = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const {PGlite} = require('@electric-sql/pglite');
const {btree_gist} = require('@electric-sql/pglite/contrib/btree_gist');
const A='11111111-1111-4111-8111-111111111111', B='22222222-2222-4222-8222-222222222222';
test('confirmed periods migration preserves legacy logs and enforces owner isolation, real dates, overlap and open-period rules', async () => {
 const db = new PGlite({extensions:{btree_gist}});
 try {
  await db.exec(`CREATE ROLE authenticated; CREATE ROLE anon; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY); INSERT INTO auth.users VALUES('${A}'),('${B}');
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  GRANT USAGE ON SCHEMA public,auth TO authenticated,anon; GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated,anon;`);
  const migration = name => fs.readFileSync(path.resolve(__dirname,'../supabase/migrations',name),'utf8');
  await db.exec(migration('20261030_add_menstrual_cycle_tracking.sql'));
  await db.exec(`INSERT INTO menstrual_cycle_settings(user_id,last_period_start) VALUES('${A}','2026-01-01'); INSERT INTO menstrual_cycle_logs(user_id,log_date,flow_status,mood,symptoms) VALUES('${A}','2026-01-01','spotting','happy',ARRAY['cramps']);`);
  const legacy = (await db.query('SELECT * FROM menstrual_cycle_logs')).rows;
  const settings = (await db.query('SELECT * FROM menstrual_cycle_settings')).rows;
  await db.exec(migration('20261105081604_add_confirmed_menstrual_periods.sql'));
  assert.deepEqual((await db.query('SELECT * FROM menstrual_cycle_logs')).rows,legacy);
  assert.deepEqual((await db.query('SELECT * FROM menstrual_cycle_settings')).rows,settings);
  assert.equal((await db.query('SELECT count(*) AS n FROM menstrual_cycle_periods')).rows[0].n,0);
  const owner = async id => { await db.exec('RESET ROLE'); await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[id]); await db.exec('SET ROLE authenticated'); };
  const add = (start,end=null,id=null) => db.query('INSERT INTO menstrual_cycle_periods(id,user_id,start_date,end_date,recorded_timezone) VALUES(coalesce($1::uuid,gen_random_uuid()),$2,$3,$4,$5) RETURNING *',[id,A,start,end,'Asia/Ho_Chi_Minh']);
  await owner(A);
  const row = (await add('2026-01-01')).rows[0];
  await assert.rejects(add('2026-02-01'),error => ['23505','23P01'].includes(error.code));
  await assert.rejects(add('2026-01-01'),error => ['23505','23P01'].includes(error.code));
  await assert.rejects(add('2999-01-01'),error => error.code==='23514');
  await assert.rejects(add('2026-01-10','2026-01-09'),error => ['23514','22000'].includes(error.code));
  await db.query("UPDATE menstrual_cycle_periods SET end_date='2026-01-05' WHERE id=$1",[row.id]);
  await assert.rejects(add('2026-01-05','2026-01-07'),error => error.code==='23P01');
  const second=(await add('2026-01-29','2026-02-02')).rows[0];
  await assert.rejects(db.query('UPDATE menstrual_cycle_periods SET end_date=NULL WHERE id=$1',[row.id]),error => error.code==='23P01');
  await db.query("UPDATE menstrual_cycle_periods SET start_date='2026-01-28',end_date=NULL WHERE id=$1",[second.id]);
  await db.query("UPDATE menstrual_cycle_periods SET end_date='2026-02-01' WHERE id=$1",[second.id]);
  // Repeated create with the same request UUID does not duplicate or overwrite the record.
  await db.query("INSERT INTO menstrual_cycle_periods(id,user_id,start_date,end_date) VALUES($1,$2,'2026-01-29',NULL) ON CONFLICT(id) DO NOTHING",[second.id,A]);
  assert.equal((await db.query('SELECT count(*) AS n FROM menstrual_cycle_periods')).rows[0].n,2);
  await db.query('DELETE FROM menstrual_cycle_periods WHERE id=$1',[second.id]);
  assert.deepEqual((await db.query('SELECT * FROM menstrual_cycle_logs')).rows,legacy);
  // A log may have mood/symptoms with flow unrecorded, without starting a period.
  await db.query("INSERT INTO menstrual_cycle_logs(user_id,log_date,flow_status,mood) VALUES($1,'2026-02-10',NULL,'tired')",[A]);
  assert.equal((await db.query('SELECT count(*) AS n FROM menstrual_cycle_periods')).rows[0].n,1);
  await owner(B); assert.equal((await db.query('SELECT * FROM menstrual_cycle_periods')).rows.length,0);
  assert.equal((await db.query('DELETE FROM menstrual_cycle_periods WHERE id=$1 RETURNING id',[row.id])).rows.length,0);
  await assert.rejects(add('2026-03-01','2026-03-05'),error => error.code==='42501');
  await db.exec('RESET ROLE; SET ROLE anon'); await assert.rejects(db.query('SELECT * FROM menstrual_cycle_periods'),error => error.code==='42501');
 } finally { await db.close(); }
});
