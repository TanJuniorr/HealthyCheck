/* global __dirname */
// npm exec --yes --package=@electric-sql/pglite -- node scripts/test-food-catalogue-db.cjs
const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {PGlite}=require(require.resolve('@electric-sql/pglite',{paths:process.env.PATH.split(path.delimiter).map(p=>path.resolve(p,'..'))}));
const folder=path.resolve(__dirname,'../../supabase/migrations'),seed=require('../../supabase/seeds/nutrition_usda.json').foods;
const sql=suffix=>fs.readFileSync(path.join(folder,fs.readdirSync(folder).find(name=>name.endsWith(suffix))),'utf8');
test('PostgreSQL catalogue import is repeatable, preserves history, ranks names and denies catalogue writes',async()=>{
 const db=new PGlite();try {
  await db.exec(`CREATE ROLE authenticated;CREATE ROLE anon;CREATE SCHEMA auth;
   CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   GRANT USAGE ON SCHEMA auth,public TO authenticated,anon;GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated,anon;
   CREATE TABLE foods(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text NOT NULL,category text,serving_size text,calories_per_100g numeric(8,2) NOT NULL,protein_per_100g numeric(8,2) NOT NULL,carbs_per_100g numeric(8,2) NOT NULL,fat_per_100g numeric(8,2) NOT NULL,catalog_metadata jsonb,calories numeric,protein_g numeric,carbs_g numeric,fat_g numeric,created_at timestamptz DEFAULT now());
   CREATE UNIQUE INDEX foods_catalog_source_id_unique ON foods((catalog_metadata->>'source_id')) WHERE catalog_metadata->>'source_id' IS NOT NULL;
   CREATE TABLE meal_records(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL,food_id uuid REFERENCES foods,quantity_g numeric NOT NULL,meal_type text,consumed_at timestamptz DEFAULT now());
   ALTER TABLE foods ENABLE ROW LEVEL SECURITY;CREATE POLICY food_read ON foods FOR SELECT TO authenticated,anon USING(true);
   ALTER TABLE meal_records ENABLE ROW LEVEL SECURITY;CREATE POLICY meal_owner ON meal_records FOR ALL TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
   GRANT SELECT,INSERT,UPDATE,DELETE ON foods,meal_records TO authenticated,anon;`);
  await db.query(`INSERT INTO foods(name,category,calories_per_100g,protein_per_100g,carbs_per_100g,fat_per_100g) VALUES('Chuối','Fruit',89,1.1,22.8,.3),('Trứng gà luộc','Protein',155,12.6,1.1,10.6)`);
  await db.exec(`INSERT INTO meal_records(user_id,food_id,quantity_g,meal_type) SELECT '11111111-1111-4111-8111-111111111111',id,123.456,'lunch' FROM foods;`);
  const history=async()=>JSON.stringify((await db.query(`SELECT m.id,m.food_id,m.quantity_g,m.consumed_at,m.quantity_g*f.calories_per_100g/100 AS kcal,m.quantity_g*f.protein_per_100g/100 AS protein,m.quantity_g*f.carbs_per_100g/100 AS carbs,m.quantity_g*f.fat_per_100g/100 AS fat FROM meal_records m JOIN foods f ON f.id=m.food_id ORDER BY m.id`)).rows);
  const before=await history();
  await db.exec(sql('_bounded_food_search.sql'));
  const importSql=sql('_expand_curated_vietnam_foods.sql');
  await db.exec('BEGIN;'+importSql+'COMMIT;');
  const first=(await db.query('SELECT id,name,catalog_metadata FROM foods ORDER BY id')).rows;
  await db.exec('BEGIN;'+importSql+'COMMIT;');
  assert.equal((await db.query('SELECT count(*)::int n FROM foods')).rows[0].n,seed.length+2);
  assert.equal(await history(),before);assert.deepEqual((await db.query('SELECT id,name,catalog_metadata FROM foods ORDER BY id')).rows,first);
  const search=async(q,category=null,offset=0,limit=30)=>(await db.query('SELECT search_foods($1,$2,$3,$4) result',[q,category,offset,limit])).rows[0].result;
  for(const query of ['ca hoi','cá hồi']){const found=await search(query);assert.ok(found.data.some(f=>f.name==='Cá hồi (sống)'));assert.ok(found.data.some(f=>f.name==='Cá hồi (chín)'));}
  const fish=await search('cá');assert.ok(fish.data.length>0);assert.ok(fish.data.every(f=>/(?:^|\s)cá(?:\s|$)/iu.test(f.name)));
  assert.equal((await search('cá','vegetables')).total,0);
  assert.ok((await search('dau an')).data.length>=5);assert.ok((await search('uc ga')).data.some(f=>f.name==='Ức gà (sống, không da)'));
  assert.equal((await search('trung ga luoc')).total,1);
  const match=require('../tests/load-ts.cjs')()('src/lib/foodPortions').filterFoods;
  for(const query of ['cá','ca hoi','cá hồi','ức ga','dau an','rau muong','bò','thit bo','trung ga','phở']){
   const actual=(await search(query,null,0,100)).data.map(food=>food.catalog_metadata.source_id).sort();
   const expected=match(seed,query,null).map(food=>food.catalog_metadata.source_id).sort();assert.deepEqual(actual,expected,query);
  }
  const page=await search('',null,30,30);assert.equal(page.data.length,30);assert.ok(page.total>300);
  await assert.rejects(search('',null,0,101),e=>e.code==='22023');
  // A large catalogue still returns only one bounded page and has a GIN index available.
  await db.exec(`INSERT INTO foods(name,calories_per_100g,protein_per_100g,carbs_per_100g,fat_per_100g) SELECT 'Nguyên liệu thử '||i,1,1,1,1 FROM generate_series(1,3000)i;`);
  assert.equal((await search('nguyen lieu thu',null,0,30)).data.length,30);
  assert.ok((await db.query(`SELECT indexname FROM pg_indexes WHERE indexname='foods_search_document_gin'`)).rows.length);
  await db.exec(`SET ROLE authenticated;SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);`);
  assert.ok((await search('rau muong')).total>=2);
  await assert.rejects(db.exec(`INSERT INTO foods(name,calories_per_100g,protein_per_100g,carbs_per_100g,fat_per_100g) VALUES('unauthorized',1,1,1,1)`),e=>e.code==='42501');
  assert.equal((await db.query(`UPDATE foods SET name='unauthorized' RETURNING id`)).rows.length,0);
  assert.equal((await db.query(`DELETE FROM foods RETURNING id`)).rows.length,0);
  await db.exec('RESET ROLE');
  // A changed nutrient value on an existing source aborts the entire re-import.
  const source=seed[0].catalog_metadata.source_id;await db.query("UPDATE foods SET calories_per_100g=calories_per_100g+1 WHERE catalog_metadata->>'source_id'=$1",[source]);
  await db.exec('BEGIN');await assert.rejects(db.exec(importSql),e=>e.message.includes('revision'));await db.exec('ROLLBACK');
 }finally{await db.close();}
});
test('nutrition migrations initialize a clean Supabase-style project with owner-protected journal access',async()=>{
 const db=new PGlite();try{
  await db.exec(`CREATE ROLE authenticated;CREATE ROLE anon;CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY);
   CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   GRANT USAGE ON SCHEMA auth,public TO authenticated,anon;GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated,anon;
   INSERT INTO auth.users VALUES('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');`);
  await db.exec(sql('_bounded_food_search.sql'));await db.exec('BEGIN;'+sql('_expand_curated_vietnam_foods.sql')+'COMMIT;');await db.exec(sql('_nutrition_schema_compatibility.sql'));
  assert.equal((await db.query('SELECT count(*)::int n FROM foods')).rows[0].n,seed.length);
  const food=(await db.query('SELECT id FROM foods LIMIT 1')).rows[0].id;
  await db.exec(`SET ROLE authenticated;SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);`);
  await db.query(`INSERT INTO meal_records(user_id,food_id,quantity_g,meal_type) VALUES('11111111-1111-4111-8111-111111111111',$1,2.512345678,'lunch')`,[food]);
  await assert.rejects(db.query(`INSERT INTO meal_records(user_id,food_id,quantity_g,meal_type) VALUES('22222222-2222-4222-8222-222222222222',$1,100,'lunch')`,[food]),e=>e.code==='42501');
  await db.exec(`SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);`);assert.equal((await db.query('SELECT count(*)::int n FROM meal_records')).rows[0].n,0);
 }finally{await db.close();}
});
