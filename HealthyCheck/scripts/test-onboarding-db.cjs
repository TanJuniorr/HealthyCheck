/* global __dirname */
// Run from frontend: npm run test:db
const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const modulePath=require.resolve('@electric-sql/pglite',{paths:process.env.PATH.split(path.delimiter).map(bin=>path.resolve(bin,'..'))});
const {PGlite}=require(modulePath);
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222',C='33333333-3333-4333-8333-333333333333',D='44444444-4444-4444-8444-444444444444';
test('real PostgreSQL onboarding: RLS, atomic rollback, retries, existing profiles and permanent completion',async()=>{
 const db=new PGlite();
 try {
 await db.exec(`CREATE ROLE authenticated; CREATE ROLE anon; CREATE SCHEMA auth;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 CREATE TABLE auth.users(id uuid PRIMARY KEY);
 INSERT INTO auth.users VALUES('${A}'),('${B}'),('${C}'),('${D}');
 CREATE TABLE public.profiles(id uuid PRIMARY KEY REFERENCES auth.users,full_name text,date_of_birth date,gender text,height_cm numeric(5,2),avatar_url text,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
 CREATE TABLE public.weight_records(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users,weight_kg numeric(5,2) NOT NULL CHECK(weight_kg>0),recorded_at timestamptz NOT NULL DEFAULT now(),created_at timestamptz NOT NULL DEFAULT now());
 CREATE TABLE public.health_goals(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users,
 daily_steps integer NOT NULL DEFAULT 8000 CHECK(daily_steps>=0),daily_calories integer NOT NULL DEFAULT 2000 CHECK(daily_calories>=0),daily_water_ml integer NOT NULL DEFAULT 2000 CHECK(daily_water_ml>=0),target_sleep_minutes integer NOT NULL DEFAULT 480 CHECK(target_sleep_minutes>=0),effective_from date NOT NULL DEFAULT current_date,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(user_id,effective_from));
 ALTER TABLE health_goals ENABLE ROW LEVEL SECURITY;
 CREATE POLICY goals_owner ON health_goals FOR ALL TO authenticated USING(auth.uid()=user_id) WITH CHECK(auth.uid()=user_id);
 GRANT SELECT,INSERT,UPDATE,DELETE ON health_goals TO authenticated;
 ALTER TABLE profiles ENABLE ROW LEVEL SECURITY; ALTER TABLE weight_records ENABLE ROW LEVEL SECURITY;
 CREATE POLICY profiles_read ON profiles FOR SELECT TO authenticated USING(auth.uid()=id);
 CREATE POLICY profiles_insert ON profiles FOR INSERT TO authenticated WITH CHECK(auth.uid()=id);
 CREATE POLICY profiles_update ON profiles FOR UPDATE TO authenticated USING(auth.uid()=id) WITH CHECK(auth.uid()=id);
 CREATE POLICY weight_owner ON weight_records FOR ALL TO authenticated USING(auth.uid()=user_id) WITH CHECK(auth.uid()=user_id);
 GRANT USAGE ON SCHEMA public,auth TO authenticated,anon;
 GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated,anon;
 GRANT SELECT,INSERT,UPDATE,DELETE ON profiles,weight_records TO authenticated,anon;
 INSERT INTO profiles(id,date_of_birth,gender,height_cm) VALUES('${C}','1990-01-01','prefer_not_to_say',170),('${B}',NULL,NULL,NULL),('${D}','1990-01-01','male',170);
 INSERT INTO weight_records(user_id,weight_kg) VALUES('${C}',65);
 `);
 const folder=path.resolve(__dirname,'../supabase/migrations');
 const migration=suffix=>fs.readFileSync(path.join(folder,fs.readdirSync(folder).find(name=>name.endsWith(suffix))),'utf8');
 await db.exec(migration('_add_health_onboarding.sql'));
 let rows=(await db.query('SELECT id,health_onboarding_completed_at FROM profiles')).rows;
 assert.ok(rows.find(row=>row.id===C).health_onboarding_completed_at);
 assert.equal(rows.find(row=>row.id===D).health_onboarding_completed_at,null);
 assert.equal((await db.query('SELECT count(*)::int AS n FROM weight_records')).rows[0].n,1);
 const before=(await db.query('SELECT * FROM profiles ORDER BY id')).rows;
 await db.exec(migration('_add_onboarding_health_preferences.sql'));
 const after=(await db.query('SELECT * FROM profiles ORDER BY id')).rows;
 for(let i=0;i<before.length;i++){
  const {activity_level,weight_goal,...original}=after[i];
  assert.equal(activity_level,null);assert.equal(weight_goal,null);assert.deepEqual(original,before[i]);
 }
 const signature='public.complete_health_onboarding(date,text,numeric,numeric,text,text)';
 assert.equal((await db.query("SELECT to_regprocedure('public.complete_health_onboarding(date,text,numeric,numeric)') AS old")).rows[0].old,null);
 const metadata=(await db.query(`SELECT prosecdef,pronargdefaults,has_function_privilege('anon',oid,'EXECUTE') AS anon,has_function_privilege('authenticated',oid,'EXECUTE') AS authenticated FROM pg_proc WHERE oid='${signature}'::regprocedure`)).rows[0];
 assert.equal(metadata.prosecdef,false);assert.equal(metadata.pronargdefaults,0);assert.equal(metadata.anon,false);assert.equal(metadata.authenticated,true);
 assert.ok((await db.query("SELECT relrowsecurity FROM pg_class WHERE oid IN ('profiles'::regclass,'weight_records'::regclass)")).rows.every(row=>row.relrowsecurity));
 await db.exec(migration('_add_safe_health_goal_snapshots.sql'));
 await db.exec(migration('_apply_initial_recommended_goals.sql'));
 // Signup creates only a profile, so no fixed goals can leak onto the dashboard.
 await db.exec(`ALTER TABLE auth.users ADD COLUMN raw_user_meta_data jsonb DEFAULT '{}'::jsonb;
  CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  BEGIN; INSERT INTO auth.users(id) VALUES('55555555-5555-4555-8555-555555555555');`);
 assert.equal((await db.query("SELECT count(*)::int AS n FROM profiles WHERE id='55555555-5555-4555-8555-555555555555'")).rows[0].n,1);
 assert.equal((await db.query("SELECT count(*)::int AS n FROM health_goals WHERE user_id='55555555-5555-4555-8555-555555555555'")).rows[0].n,0);
 await db.exec('ROLLBACK');
 const acl=(await db.query("SELECT prosecdef,has_function_privilege('anon',oid,'EXECUTE') AS anon,has_function_privilege('authenticated',oid,'EXECUTE') AS authenticated FROM pg_proc WHERE proname='complete_health_onboarding'")).rows;
 assert.equal(acl.length,1);assert.deepEqual(acl[0],{prosecdef:false,anon:false,authenticated:true});
 const asOwner=async id=>{await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[id??'']);await db.exec('SET ROLE authenticated');};
 const complete=(activity='moderately_active',goal='maintain',goals={daily_steps:7000,daily_calories:null})=>db.query("SELECT * FROM complete_health_onboarding('1995-05-02','prefer_not_to_say',170.5,65.5,$1,$2,$3::jsonb,'Asia/Ho_Chi_Minh')",[activity,goal,JSON.stringify(goals)]);
 await db.exec('SET ROLE anon');await assert.rejects(complete(),e=>e.code==='42501');
 await asOwner(null);await assert.rejects(complete(),e=>e.code==='42501');
 await asOwner(A);
 await assert.rejects(db.query("SELECT * FROM complete_health_onboarding('1995-05-02','male',170,65,'sedentary','maintain','{}','UTC',$1)",[B]),e=>e.code==='42501');
 for(const goals of [[],null,{daily_steps:0},{daily_calories:1.5},{daily_calories:'2000'},{daily_steps:2147483648},{daily_water_ml:2200},{user_id:B}])await assert.rejects(complete('sedentary','maintain',goals),e=>e.code==='22023');
 for(const args of ["'2999-01-01','male',170,65","'1990-01-01','invalid',170,65","'1990-01-01','male',0,65","'1990-01-01','male',170,0","'1990-01-01','male',170,501","'1990-01-01','male','NaN',65"]){
  await assert.rejects(db.query('SELECT * FROM complete_health_onboarding('+args+",'sedentary','maintain')"),e=>e.code==='22023');
 }
 for(const value of [null,'','invalid','SEDENTARY','lose_fat'])await assert.rejects(complete(value,'maintain'),e=>e.code==='22023');
 for(const value of [null,'','invalid','MAINTAIN','sedentary'])await assert.rejects(complete('sedentary',value),e=>e.code==='22023');
 await assert.rejects(db.query("SELECT * FROM complete_health_onboarding('1995-05-02','male',170,65)"),e=>e.code==='42883');
 assert.equal((await db.query('SELECT count(*)::int AS n FROM profiles')).rows[0].n,0);
 for(const activity of ['sedentary','lightly_active','moderately_active','very_active','extremely_active'])for(const goal of ['lose_fat_slow','lose_fat','maintain','gain_weight_slow','gain_weight']){
  await db.exec('BEGIN');const row=(await complete(activity,goal)).rows[0];assert.equal(row.activity_level,activity);assert.equal(row.weight_goal,goal);await db.exec('ROLLBACK');
 }
 const first=(await complete()).rows[0];assert.ok(first.health_onboarding_completed_at);assert.equal(Number(first.height_cm),170.5);assert.equal(first.gender,'prefer_not_to_say');
 const savedGoals=(await db.query('SELECT * FROM health_goals')).rows;
 assert.equal(savedGoals.length,1);assert.equal(savedGoals[0].daily_steps,7000);assert.equal(savedGoals[0].daily_calories,null);
 const localDay=(await db.query("SELECT (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS d")).rows[0].d;
 assert.equal(savedGoals[0].effective_from.toISOString(),localDay.toISOString());
 // A subsequent valid estimate can update one target while another is unset.
 const expected={daily_steps:7000,daily_calories:null,daily_water_ml:2000,target_sleep_minutes:480};
 const amended=(await db.query('SELECT * FROM save_health_goal_snapshot($1,$2,$3::jsonb,$4::jsonb,$5::date,$6)',[A,savedGoals[0].id,JSON.stringify(expected),JSON.stringify({daily_steps:5000}),localDay,'Asia/Ho_Chi_Minh'])).rows[0];
 assert.equal(amended.daily_steps,5000);assert.equal(amended.daily_calories,null);
 assert.equal(first.date_of_birth.toISOString().slice(0,10),'1995-05-02');assert.equal(first.activity_level,'moderately_active');assert.equal(first.weight_goal,'maintain');
 await Promise.all([complete(),complete(),complete()]);
 const retry=(await complete('extremely_active','gain_weight')).rows[0];assert.deepEqual(retry,first);
 assert.equal((await db.query('SELECT count(*)::int AS n FROM health_goals')).rows[0].n,2);
 assert.equal((await db.query('SELECT daily_steps FROM health_goals ORDER BY created_at DESC,id DESC LIMIT 1')).rows[0].daily_steps,5000);
 assert.equal((await db.query('SELECT count(*)::int AS n FROM weight_records')).rows[0].n,1);
 assert.equal(Number((await db.query('SELECT weight_kg FROM weight_records')).rows[0].weight_kg),65.5);
 assert.equal((await db.query(`SELECT count(*)::int AS n FROM profiles WHERE id='${C}'`)).rows[0].n,0);
 assert.equal((await db.query(`UPDATE profiles SET height_cm=200 WHERE id='${C}' RETURNING id`)).rows.length,0);
 await assert.rejects(db.query('UPDATE profiles SET health_onboarding_completed_at=NULL'),e=>e.code==='23514');
 await assert.rejects(db.exec("UPDATE profiles SET activity_level='invalid'"),e=>e.code==='23514');
 await assert.rejects(db.exec("UPDATE profiles SET weight_goal='invalid'"),e=>e.code==='23514');
 await db.exec("UPDATE profiles SET height_cm=NULL,gender=NULL,activity_level=NULL,weight_goal='gain_weight_slow'");
 assert.ok((await complete()).rows[0].health_onboarding_completed_at);
 const edited=(await db.query('SELECT * FROM profiles')).rows[0];assert.equal(edited.health_onboarding_completed_at.getTime(),first.health_onboarding_completed_at.getTime());assert.equal(edited.activity_level,null);assert.equal(edited.weight_goal,'gain_weight_slow');
 // Re-authentication reads the stored choices, without resubmitting onboarding.
 await asOwner(null);await asOwner(A);assert.deepEqual((await db.query('SELECT * FROM profiles')).rows[0],edited);
 assert.equal((await db.query('SELECT count(*)::int AS n FROM weight_records')).rows[0].n,1);
 await db.exec(`RESET ROLE; CREATE FUNCTION public.fail_test_weight() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test failure' USING ERRCODE='23514'; END $$;
 CREATE TRIGGER test_weight_failure BEFORE INSERT ON weight_records FOR EACH ROW EXECUTE FUNCTION fail_test_weight();`);
 await asOwner(B);await assert.rejects(complete(),e=>e.code==='23514');
 const unchanged=(await db.query('SELECT * FROM profiles')).rows[0];assert.equal(unchanged.health_onboarding_completed_at,null);assert.equal(unchanged.date_of_birth,null);assert.equal(unchanged.height_cm,null);
 assert.equal(unchanged.activity_level,null);assert.equal(unchanged.weight_goal,null);
 assert.equal((await db.query('SELECT count(*)::int AS n FROM weight_records')).rows[0].n,0);
 await assert.rejects(db.exec('UPDATE profiles SET health_onboarding_completed_at=now()'),e=>e.code==='23514');
 await db.exec(`RESET ROLE; DROP TRIGGER test_weight_failure ON weight_records;
 CREATE TRIGGER test_goal_failure AFTER INSERT ON health_goals FOR EACH ROW EXECUTE FUNCTION fail_test_weight();`);
 await asOwner(B);await assert.rejects(complete(),e=>e.code==='23514');
 assert.equal((await db.query('SELECT health_onboarding_completed_at FROM profiles')).rows[0].health_onboarding_completed_at,null);
 assert.equal((await db.query('SELECT count(*)::int AS n FROM weight_records')).rows[0].n,0);
 assert.equal((await db.query('SELECT count(*)::int AS n FROM health_goals')).rows[0].n,0);
 await db.exec('RESET ROLE; DROP TRIGGER test_goal_failure ON health_goals;');await asOwner(B);await complete('sedentary','maintain',{daily_steps:4000,daily_calories:1881});assert.equal((await db.query('SELECT count(*)::int AS n FROM weight_records')).rows[0].n,1);
 assert.equal((await db.query('SELECT daily_calories FROM health_goals')).rows[0].daily_calories,1881);
 await asOwner(D);await assert.rejects(db.exec('UPDATE profiles SET health_onboarding_completed_at=now()'),e=>e.code==='23514');
 // A pre-existing identical latest weight is reused when a partial profile finishes.
 await db.query('INSERT INTO weight_records(user_id,weight_kg) VALUES($1,65.5)',[D]);
 await assert.rejects(db.exec('UPDATE profiles SET health_onboarding_completed_at=now()'),e=>e.code==='23514');
 await db.exec("UPDATE profiles SET activity_level='sedentary'");
 await assert.rejects(db.exec('UPDATE profiles SET health_onboarding_completed_at=now()'),e=>e.code==='23514');
 await db.exec("UPDATE profiles SET activity_level=NULL,weight_goal='maintain'");
 await assert.rejects(db.exec('UPDATE profiles SET health_onboarding_completed_at=now()'),e=>e.code==='23514');
 await complete();assert.equal((await db.query('SELECT count(*)::int AS n FROM weight_records')).rows[0].n,1);
 await asOwner(C);const legacy=(await complete()).rows[0];assert.equal(legacy.activity_level,null);assert.equal(legacy.weight_goal,null);
 assert.equal(legacy.health_onboarding_completed_at.getTime(),before.find(row=>row.id===C).health_onboarding_completed_at.getTime());
 }finally{await db.close();}
});
