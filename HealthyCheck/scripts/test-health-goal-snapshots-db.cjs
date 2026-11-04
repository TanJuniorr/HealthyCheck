/* global __dirname */
// Run from frontend: npm run test:db
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const modulePath=require.resolve('@electric-sql/pglite',{paths:process.env.PATH.split(path.delimiter).map(bin=>path.resolve(bin,'..'))});
const {PGlite}=require(modulePath);
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222',C='33333333-3333-4333-8333-333333333333';
const values=row=>Object.fromEntries(['daily_steps','daily_calories','daily_water_ml','target_sleep_minutes'].map(key=>[key,row[key]]));
test('goal snapshots in PostgreSQL: owner RLS, immutable history, conflicts, no-ops, initial explicit values and rollback',async()=>{
 const db=new PGlite();try{
  await db.exec(`CREATE ROLE authenticated;CREATE ROLE anon;CREATE SCHEMA auth;
   CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
   CREATE TABLE auth.users(id uuid PRIMARY KEY);INSERT INTO auth.users VALUES('${A}'),('${B}'),('${C}');
   CREATE TABLE public.health_goals(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    daily_steps integer NOT NULL DEFAULT 8000 CHECK(daily_steps>=0),daily_calories integer NOT NULL DEFAULT 2000 CHECK(daily_calories>=0),
    daily_water_ml integer NOT NULL DEFAULT 2000 CHECK(daily_water_ml>=0),target_sleep_minutes integer NOT NULL DEFAULT 480 CHECK(target_sleep_minutes>=0),
    effective_from date NOT NULL DEFAULT current_date,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(user_id,effective_from));
   ALTER TABLE health_goals ENABLE ROW LEVEL SECURITY;
   CREATE POLICY goals_select ON health_goals FOR SELECT TO authenticated USING(auth.uid()=user_id);
   CREATE POLICY goals_insert ON health_goals FOR INSERT TO authenticated WITH CHECK(auth.uid()=user_id);
   CREATE POLICY goals_update ON health_goals FOR UPDATE TO authenticated USING(auth.uid()=user_id) WITH CHECK(auth.uid()=user_id);
   CREATE POLICY goals_delete ON health_goals FOR DELETE TO authenticated USING(auth.uid()=user_id);
   GRANT USAGE ON SCHEMA public,auth TO authenticated,anon;GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated,anon;
   GRANT SELECT,INSERT,UPDATE,DELETE ON health_goals TO authenticated;
   INSERT INTO health_goals(user_id,effective_from) VALUES('${A}',current_date-1),('${A}',current_date+5);
  `);
  const before=(await db.query('SELECT * FROM health_goals ORDER BY effective_from')).rows,old=before[0];
  const today=(await db.query('SELECT current_date AS d')).rows[0].d.toISOString().slice(0,10);
  const folder=path.resolve(__dirname,'../supabase/migrations'),name=fs.readdirSync(folder).find(name=>name.endsWith('_add_safe_health_goal_snapshots.sql'));
  await db.exec(fs.readFileSync(path.join(folder,name),'utf8'));
  assert.deepEqual((await db.query('SELECT * FROM health_goals ORDER BY effective_from')).rows,before);
  const acl=(await db.query("SELECT has_function_privilege('anon',oid,'EXECUTE') AS anon,has_function_privilege('authenticated',oid,'EXECUTE') AS authenticated,prosecdef FROM pg_proc WHERE proname='save_health_goal_snapshot'")).rows[0];
  assert.equal(acl.anon,false);assert.equal(acl.authenticated,true);assert.equal(acl.prosecdef,false);
  const asOwner=async owner=>{await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[owner??'']);await db.exec('SET ROLE authenticated');};
  const save=(expected,changes,expectedOwner=A,date=today)=>db.query('SELECT * FROM save_health_goal_snapshot($1,$2,$3::jsonb,$4::jsonb,$5::date,$6)',[expectedOwner,expected?.id??null,expected?JSON.stringify(values(expected)):null,JSON.stringify(changes),date,'UTC']);
  await asOwner(A);
  for(const changes of [{},{user_id:B},{daily_calories:0},{daily_steps:-1},{daily_water_ml:1.5},{daily_steps:'7000'},{daily_steps:2147483648},null,[]])await assert.rejects(save(old,changes),e=>e.code==='22023');
  await assert.rejects(save(old,{daily_calories:1850},A,'2000-01-01'),e=>e.code==='22023');
  const first=(await save(old,{daily_calories:1850})).rows[0];
  assert.deepEqual(values(first),{daily_steps:8000,daily_calories:1850,daily_water_ml:2000,target_sleep_minutes:480});
  assert.notEqual(first.id,old.id);assert.equal(first.effective_from.toISOString().slice(0,10),today);
  const second=(await save(first,{daily_steps:7000})).rows[0];
  assert.deepEqual(values(second),{daily_steps:7000,daily_calories:1850,daily_water_ml:2000,target_sleep_minutes:480});
  assert.ok(second.created_at.getTime()>=first.created_at.getTime());
  const count=async()=>Number((await db.query('SELECT count(*) AS n FROM health_goals')).rows[0].n);
  const currentCount=await count();
  const retry=(await save(old,{daily_calories:1850})).rows[0];assert.equal(retry.id,second.id);assert.equal(await count(),currentCount);
  await assert.rejects(save(first,{daily_water_ml:1800}),e=>e.code==='40001');assert.equal(await count(),currentCount);
  const multi=(await save(second,{daily_steps:7500,daily_calories:1900})).rows[0];assert.deepEqual(values(multi),{daily_steps:7500,daily_calories:1900,daily_water_ml:2000,target_sleep_minutes:480});
  const parallel=await Promise.allSettled([save(multi,{daily_calories:1950}),save(multi,{daily_steps:7600})]);
  assert.equal(parallel.filter(r=>r.status==='fulfilled').length,1);assert.equal(parallel.find(r=>r.status==='rejected').reason.code,'40001');
  // A stale same-ID snapshot is also detected after an existing direct writer.
  let current=parallel.find(r=>r.status==='fulfilled').value.rows[0];
  const late=(await db.query('INSERT INTO health_goals(user_id,daily_steps,daily_calories,daily_water_ml,target_sleep_minutes,effective_from,created_at) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',[A,current.daily_steps,current.daily_calories,current.daily_water_ml,current.target_sleep_minutes,today,'2000-01-01T00:00:00Z'])).rows[0];
  assert.equal((await db.query('SELECT id FROM health_goals WHERE effective_from=current_date ORDER BY created_at DESC,id DESC LIMIT 1')).rows[0].id,late.id);current=late;
  await db.query('UPDATE health_goals SET daily_water_ml=2100 WHERE id=$1',[current.id]);
  await assert.rejects(save(current,{daily_calories:1800}),e=>e.code==='40001');
  assert.deepEqual((await db.query('SELECT * FROM health_goals WHERE id=$1',[old.id])).rows[0],old);
  const historical=(await db.query('SELECT * FROM health_goals WHERE effective_from<current_date ORDER BY effective_from DESC,created_at DESC,id DESC LIMIT 1')).rows[0];assert.equal(historical.daily_calories,2000);
  assert.equal((await db.query(`SELECT count(*) AS n FROM health_goals WHERE user_id='${B}'`)).rows[0].n,0);
  await assert.rejects(db.query(`INSERT INTO health_goals(user_id) VALUES('${B}')`),e=>e.code==='42501');
  await asOwner(B);await assert.rejects(save(null,{daily_calories:2200},B),e=>e.code==='22023');assert.equal(await count(),0);
  const explicit={daily_steps:5500,daily_calories:2200,daily_water_ml:1800,target_sleep_minutes:420};
  const initial=(await save(null,explicit,B)).rows[0];assert.deepEqual(values(initial),explicit);assert.equal(await count(),1);
  await save(null,explicit,B);assert.equal(await count(),1);
  // Expected owner binds the write even if the access token changes before dispatch.
  await assert.rejects(save(null,explicit,A),e=>e.code==='42501');assert.equal(await count(),1);
  await asOwner(null);await assert.rejects(save(null,explicit,A),e=>e.code==='42501');
  await db.exec(`RESET ROLE;CREATE FUNCTION fail_goal_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test failure' USING ERRCODE='23514';END $$;
   CREATE TRIGGER fail_goal_test AFTER INSERT ON health_goals FOR EACH ROW EXECUTE FUNCTION fail_goal_test();`);
  await asOwner(C);await assert.rejects(save(null,explicit,C),e=>e.code==='23514');assert.equal(await count(),0);
  await db.exec('RESET ROLE');assert.deepEqual((await db.query('SELECT * FROM health_goals WHERE id=$1',[before[1].id])).rows[0],before[1]);
 }finally{await db.close();}
});
