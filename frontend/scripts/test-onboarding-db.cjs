/* global __dirname */
// Run without an app dependency: npm exec --yes --package=@electric-sql/pglite -- node scripts/test-onboarding-db.cjs
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
 const folder=path.resolve(__dirname,'../../supabase/migrations');
 const migration=fs.readFileSync(path.join(folder,fs.readdirSync(folder).find(name=>name.endsWith('_add_health_onboarding.sql'))),'utf8');
 await db.exec(migration);
 let rows=(await db.query('SELECT id,health_onboarding_completed_at FROM profiles')).rows;
 assert.ok(rows.find(row=>row.id===C).health_onboarding_completed_at);
 assert.equal(rows.find(row=>row.id===D).health_onboarding_completed_at,null);
 assert.equal((await db.query('SELECT count(*)::int AS n FROM weight_records')).rows[0].n,1);
 const asOwner=async id=>{await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[id??'']);await db.exec('SET ROLE authenticated');};
 const complete=()=>db.query("SELECT * FROM complete_health_onboarding('1995-05-02','prefer_not_to_say',170.5,65.5)");
 await db.exec('SET ROLE anon');await assert.rejects(complete(),e=>e.code==='42501');
 await asOwner(null);await assert.rejects(complete(),e=>e.code==='42501');
 await asOwner(A);
 for(const args of ["'2999-01-01','male',170,65","'1990-01-01','invalid',170,65","'1990-01-01','male',0,65","'1990-01-01','male',170,0","'1990-01-01','male',170,501","'1990-01-01','male','NaN',65"]){
  await assert.rejects(db.query('SELECT * FROM complete_health_onboarding('+args+')'),e=>e.code==='22023');
 }
 assert.equal((await db.query('SELECT count(*)::int AS n FROM profiles')).rows[0].n,0);
 const first=(await complete()).rows[0];assert.ok(first.health_onboarding_completed_at);assert.equal(Number(first.height_cm),170.5);assert.equal(first.gender,'prefer_not_to_say');
 await Promise.all([complete(),complete(),complete()]);
 assert.equal((await db.query('SELECT count(*)::int AS n FROM weight_records')).rows[0].n,1);
 assert.equal(Number((await db.query('SELECT weight_kg FROM weight_records')).rows[0].weight_kg),65.5);
 assert.equal((await db.query(`SELECT count(*)::int AS n FROM profiles WHERE id='${C}'`)).rows[0].n,0);
 assert.equal((await db.query(`UPDATE profiles SET height_cm=200 WHERE id='${C}' RETURNING id`)).rows.length,0);
 await assert.rejects(db.query('UPDATE profiles SET health_onboarding_completed_at=NULL'),e=>e.code==='23514');
 await db.exec('UPDATE profiles SET height_cm=NULL,gender=NULL');
 assert.ok((await complete()).rows[0].health_onboarding_completed_at);
 assert.equal((await db.query('SELECT count(*)::int AS n FROM weight_records')).rows[0].n,1);
 await db.exec(`RESET ROLE; CREATE FUNCTION public.fail_test_weight() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test failure' USING ERRCODE='23514'; END $$;
 CREATE TRIGGER test_weight_failure BEFORE INSERT ON weight_records FOR EACH ROW EXECUTE FUNCTION fail_test_weight();`);
 await asOwner(B);await assert.rejects(complete(),e=>e.code==='23514');
 const unchanged=(await db.query('SELECT * FROM profiles')).rows[0];assert.equal(unchanged.health_onboarding_completed_at,null);assert.equal(unchanged.date_of_birth,null);assert.equal(unchanged.height_cm,null);
 assert.equal((await db.query('SELECT count(*)::int AS n FROM weight_records')).rows[0].n,0);
 await assert.rejects(db.exec('UPDATE profiles SET health_onboarding_completed_at=now()'),e=>e.code==='23514');
 await db.exec('RESET ROLE; DROP TRIGGER test_weight_failure ON weight_records;');await asOwner(B);await complete();assert.equal((await db.query('SELECT count(*)::int AS n FROM weight_records')).rows[0].n,1);
 await asOwner(D);await assert.rejects(db.exec('UPDATE profiles SET health_onboarding_completed_at=now()'),e=>e.code==='23514');
 // A pre-existing identical latest weight is reused when a partial profile finishes.
 await db.query('INSERT INTO weight_records(user_id,weight_kg) VALUES($1,65.5)',[D]);await complete();assert.equal((await db.query('SELECT count(*)::int AS n FROM weight_records')).rows[0].n,1);
 }finally{await db.close();}
});
