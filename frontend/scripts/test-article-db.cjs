/* global __dirname */
// npm exec --yes --package=@electric-sql/pglite -- node scripts/test-article-db.cjs
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {PGlite}=require(require.resolve('@electric-sql/pglite',{paths:process.env.PATH.split(path.delimiter).map(p=>path.resolve(p,'..'))}));
const folder=path.resolve(__dirname,'../../supabase/migrations');
const migration=()=>fs.readFileSync(path.join(folder,fs.readdirSync(folder).find(p=>p.endsWith('_article_library_and_admin.sql'))),'utf8');
const admin='11111111-1111-4111-8111-111111111111',user='22222222-2222-4222-8222-222222222222',other='33333333-3333-4333-8333-333333333333';
async function setup(withAdmin=true){
 const db=new PGlite();await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE SCHEMA auth;CREATE SCHEMA storage;
 ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated;
 CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb);
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 GRANT USAGE ON SCHEMA public,auth,storage TO authenticated,anon;GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated,anon;
 CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 CREATE TABLE storage.objects(id uuid DEFAULT gen_random_uuid(),bucket_id text,name text,PRIMARY KEY(bucket_id,name));
 ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO authenticated,anon;
 INSERT INTO auth.users VALUES('${user}','user@example.test',now(),'{}'),('${other}','other@example.test',now(),'{}');`);
 if(withAdmin)await db.query('INSERT INTO auth.users VALUES($1,$2,now(),$3)',[admin,'phapsutan@gmail.com',{}]);
 await db.exec(migration());await db.exec(fs.readFileSync(path.join(folder,fs.readdirSync(folder).find(p=>p.endsWith('_restrict_article_table_privileges.sql'))),'utf8'));
 await db.exec(fs.readFileSync(path.join(folder,fs.readdirSync(folder).find(p=>p.endsWith('_protect_referenced_article_images.sql'))),'utf8'));return db;
}
async function as(db,id,role='authenticated'){await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[id||'']);await db.exec('SET ROLE '+role);}
const tr={language:'vi',title:'Giấc ngủ đều đặn',summary:'Những bước nhỏ giúp duy trì giờ ngủ.',content:'## Bắt đầu từ lịch sinh hoạt\n\n'+('Duy trì giờ ngủ phù hợp và trao đổi với chuyên viên y tế khi khó ngủ kéo dài. ').repeat(3),reading_time_minutes:2,source_name:'CDC',source_url:'https://www.cdc.gov/sleep/about/index.html',reference_links:[]};
test('article RLS, atomic publishing, role isolation, search, personal libraries and image permissions',async()=>{
 const db=await setup();try{
  await as(db,admin);assert.equal((await db.query('SELECT private.is_article_admin() ok')).rows[0].ok,true);
  const cat=(await db.query("INSERT INTO article_categories(slug,name_vi,name_en) VALUES('sleep','Giấc ngủ','Sleep') RETURNING id")).rows[0].id;
  const save=async(id,expected,status='draft',translation=tr)=>(await db.query('SELECT save_article($1,$2,$3::jsonb,$4::jsonb) result',[id,expected,{slug:'sleep-routine',category_id:cat,status,is_featured:true},[translation]])).rows[0].result;
  let article=await save(null,null);const id=article.id;
  await as(db,user);
  await assert.rejects(db.exec('TRUNCATE public.articles CASCADE'),e=>e.code==='42501');
  assert.equal((await db.query("SELECT has_table_privilege(current_user,'public.article_categories','TRIGGER') allowed")).rows[0].allowed,false);
  for(const table of ['articles','article_translations'])assert.equal((await db.query('SELECT count(*)::int n FROM '+table)).rows[0].n,0);
  await assert.rejects(save(id,article.updated_at,'published'),e=>e.code==='42501');
  await assert.rejects(db.query("UPDATE user_roles SET role='admin' WHERE user_id=$1",[user]),e=>e.code==='42501');
  await assert.rejects(db.query('INSERT INTO user_roles(user_id,role) VALUES($1,\'admin\')',[user]),e=>e.code==='42501');
  await assert.rejects(db.query("INSERT INTO article_categories(slug,name_vi,name_en) VALUES('x','x','x')"),e=>e.code==='42501');
  await db.exec('RESET ROLE');await db.query("UPDATE auth.users SET raw_user_meta_data='{"+'"role":"admin"'+"}' WHERE id=$1",[user]);await as(db,user);assert.equal((await db.query('SELECT private.is_article_admin() ok')).rows[0].ok,false);
  await as(db,admin);
  await assert.rejects(save(id,article.updated_at,'published',{...tr,source_url:''}),e=>e.code==='23514');
  assert.equal((await db.query('SELECT status FROM articles WHERE id=$1',[id])).rows[0].status,'draft');
  article=await save(id,article.updated_at,'published');
  await assert.rejects(save(id,'2000-01-01T00:00:00Z'),e=>e.code==='40001');
  await assert.rejects(db.query('UPDATE articles SET author_id=$1 WHERE id=$2',[user,id]),e=>e.code==='22023');
  await assert.rejects(db.query('DELETE FROM article_categories WHERE id=$1',[cat]),e=>['23503','23001'].includes(e.code));
  const image=`${admin}/${id}/44444444-4444-4444-8444-444444444444.jpg`;
  await db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('article-images',$1)",[image]);
  await db.query('UPDATE articles SET cover_image_path=$1 WHERE id=$2',[image,id]);
  await as(db,user);
  const feed=(await db.query("SELECT article_feed('en','giac ngu',$1,'latest',0,1,null) result",[cat])).rows[0].result;
  assert.equal(feed.data.length,1);assert.equal(feed.total,1);assert.equal(feed.data[0].language,'vi');assert.equal(feed.data[0].category.id,cat);assert.equal(feed.data[0].content,undefined);
  assert.equal((await db.query("SELECT article_feed('vi','',null,'latest',1,1,null) result")).rows[0].result.data.length,0);
  await assert.rejects(db.query("SELECT article_feed('vi','',null,'admin',0,12,null)"),e=>e.code==='42501');
  await assert.rejects(db.query("SELECT article_feed('vi','',null,'latest',0,999,null)"),e=>e.code==='22023');
  assert.equal((await db.query('SELECT count(*)::int n FROM storage.objects')).rows[0].n,1);
  await assert.rejects(db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('article-images',$1)",[`${user}/${id}/44444444-4444-4444-8444-444444444444.jpg`]),e=>e.code==='42501');
  assert.equal((await db.query("DELETE FROM storage.objects RETURNING name")).rows.length,0);
  await db.query('INSERT INTO article_bookmarks(user_id,article_id) VALUES($1,$2)',[user,id]);
  await assert.rejects(db.query('INSERT INTO article_bookmarks(user_id,article_id) VALUES($1,$2)',[other,id]),e=>e.code==='42501');
  await db.query('SELECT record_article_read($1)',[id]);await db.query('SELECT record_article_read($1)',[id]);assert.equal((await db.query('SELECT read_count FROM article_read_history')).rows[0].read_count,1);
  await assert.rejects(db.query('UPDATE article_read_history SET read_count=100'),e=>e.code==='42501');
  await db.query('INSERT INTO article_category_preferences(user_id,category_id) VALUES($1,$2)',[user,cat]);
  assert.equal((await db.query("SELECT article_feed('vi','',null,'recommended',0,12,null) result")).rows[0].result.data[0].reason,'interest');
  await as(db,other);assert.equal((await db.query('SELECT count(*)::int n FROM article_bookmarks')).rows[0].n,0);assert.equal((await db.query('SELECT count(*)::int n FROM article_read_history')).rows[0].n,0);
  await as(db,admin);article=(await db.query('SELECT * FROM articles WHERE id=$1',[id])).rows[0];article=await save(id,article.updated_at,'archived');
  await as(db,user);assert.equal((await db.query("SELECT article_feed('vi','',null,'bookmarks',0,12,null) result")).rows[0].result.data.length,0);
  assert.equal((await db.query('SELECT count(*)::int n FROM storage.objects')).rows[0].n,0);assert.equal((await db.query('SELECT get_article($1) result',[id])).rows[0].result,null);
  await db.query('DELETE FROM article_bookmarks WHERE article_id=$1',[id]);assert.equal((await db.query('SELECT count(*)::int n FROM article_bookmarks')).rows[0].n,0);
  await as(db,admin);await db.query('DELETE FROM articles WHERE id=$1',[id]);assert.equal((await db.query('SELECT count(*)::int n FROM article_translations')).rows[0].n,0);
 }finally{await db.close();}
});
test('pending admin invitation requires confirmed email, ignores metadata and binds only once',async()=>{
 const db=await setup(false);try{
  await db.query('INSERT INTO auth.users VALUES($1,$2,null,$3)',[admin,'phapsutan@gmail.com',{role:'admin'}]);
  assert.equal((await db.query('SELECT role FROM user_roles WHERE user_id=$1',[admin])).rows[0].role,'user');
  await db.query('UPDATE auth.users SET email_confirmed_at=now() WHERE id=$1',[admin]);
  assert.equal((await db.query('SELECT role FROM user_roles WHERE user_id=$1',[admin])).rows[0].role,'admin');
  await db.query("UPDATE auth.users SET email='changed@example.test' WHERE id=$1",[admin]);
  await db.query("UPDATE auth.users SET email='phapsutan@gmail.com' WHERE id=$1",[user]);
  assert.equal((await db.query('SELECT role FROM user_roles WHERE user_id=$1',[user])).rows[0].role,'user');
  await as(db,null,'anon');await assert.rejects(db.query('SELECT record_article_read($1)',[admin]),e=>e.code==='42501');
  await assert.rejects(db.query('SELECT * FROM private.article_admin_invites'),e=>e.code==='42501');
 }finally{await db.close();}
});
test('verified editorial seed publishes twenty sourced articles and never overwrites CMS edits on reimport',async()=>{
 const db=await setup();try{
  const source=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../supabase/seeds/articles_vi.json'),'utf8'));
  const seedSql=fs.readFileSync(path.join(folder,fs.readdirSync(folder).find(p=>p.endsWith('_seed_verified_health_articles.sql'))),'utf8');
  await db.exec('BEGIN;'+seedSql+'COMMIT;');
  assert.equal((await db.query("SELECT count(*)::int n FROM articles WHERE status='published'")).rows[0].n,20);
  assert.equal((await db.query('SELECT count(*)::int n FROM article_categories')).rows[0].n,7);
  for(const article of source.articles){assert.ok(article.content.length>500);assert.ok(new URL(article.source_url).protocol==='https:');}
  await as(db,admin);await db.exec("UPDATE article_translations SET title='Tiêu đề Admin đã biên tập' WHERE article_id=(SELECT id FROM articles WHERE slug='bua-an-da-dang')");
  const before=(await db.query('SELECT id,slug FROM articles ORDER BY id')).rows;
  await db.exec('RESET ROLE');await db.exec('BEGIN;'+seedSql+'COMMIT;');
  assert.deepEqual((await db.query('SELECT id,slug FROM articles ORDER BY id')).rows,before);
  assert.equal((await db.query("SELECT title FROM article_translations WHERE article_id=(SELECT id FROM articles WHERE slug='bua-an-da-dang')")).rows[0].title,'Tiêu đề Admin đã biên tập');
  await as(db,user);const page=(await db.query("SELECT article_feed('en','',null,'latest',0,12,null) result")).rows[0].result;
  assert.equal(page.data.length,12);assert.equal(page.total,20);assert.ok(page.data.every(a=>a.language==='vi'));
 }finally{await db.close();}
});

test('referenced cover and inline files survive direct deletion/overwrite in every article status',async()=>{
 const db=await setup();try{
  await as(db,admin);
  const cat=(await db.query("INSERT INTO article_categories(slug,name_vi,name_en) VALUES('image-test','Ảnh','Images') RETURNING id")).rows[0].id;
  const save=async(slug)=>(await db.query('SELECT save_article(null,null,$1::jsonb,$2::jsonb) result',[{slug,category_id:cat,status:'draft',is_featured:false},[tr]])).rows[0].result;
  const first=await save('image-owner'),second=await save('other-reference');
  const image=`${admin}/${first.id}/44444444-4444-4444-8444-444444444444.jpg`;
  await db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('article-images',$1)",[image]);
  await db.query('UPDATE articles SET cover_image_path=$1 WHERE id=$2',[image,first.id]);
  assert.equal((await db.query('DELETE FROM storage.objects WHERE name=$1 RETURNING name',[image])).rows.length,0);
  assert.equal((await db.query('UPDATE storage.objects SET name=name WHERE name=$1 RETURNING name',[image])).rows.length,0);
  await db.query('UPDATE article_translations SET content=content||$1 WHERE article_id=$2',['\n\n![shared](article-image:'+image+')',second.id]);
  await db.query('UPDATE articles SET cover_image_path=null WHERE id=$1',[first.id]);
  for(const status of ['draft','published','archived']){
   await db.query("UPDATE articles SET status=$1,published_at=now() WHERE id=$2",[status,second.id]);
   assert.equal((await db.query('DELETE FROM storage.objects WHERE name=$1 RETURNING name',[image])).rows.length,0);
  }
  await db.query('UPDATE article_translations SET content=$1 WHERE article_id=$2',[tr.content,second.id]);
  assert.equal((await db.query('DELETE FROM storage.objects WHERE name=$1 RETURNING name',[image])).rows.length,1);
  await db.exec('RESET ROLE');await db.query("UPDATE user_roles SET role='user' WHERE user_id=$1",[admin]);await as(db,admin);
  await assert.rejects(save('revoked-admin'),e=>e.code==='42501');
 }finally{await db.close();}
});
