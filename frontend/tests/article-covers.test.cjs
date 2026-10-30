/* global __dirname */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url'),{createHash}=require('node:crypto');
const root=path.resolve(__dirname,'../..'),owner='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222';
const token='scoped-local-test-token-'.repeat(3),bytes=Buffer.from([255,216,255,224,1,2,3]),hash=b=>createHash('sha256').update(b).digest('hex');
async function fixture({admin=true,existing=null,race=false,expired=false}={}){
 const {createCoverImportHandler}=await import(pathToFileURL(path.join(root,'supabase/functions/import-article-covers/importer.mjs')).href);
 const calls=[],manifest={provider:'Pexels',license:'Pexels License',license_url:'https://www.pexels.com/license/',covers:[{slug:'verified-cover',sha256:hash(bytes),bytes:bytes.length,photo_page:'https://www.pexels.com/photo/verified-1/',photographer:'Photographer'}]};
 const client={from(table){const state={table,op:'select'};const q={select(){return q;},eq(){return q;},is(){return q;},update(value){state.op='update';state.value=value;return q;},async maybeSingle(){calls.push({...state});return {data:table==='user_roles'?(admin?{user_id:owner}:null):state.op==='update'?(race?null:{id}):{id,slug:'verified-cover',cover_image_path:existing},error:null};}};return q;},storage:{from(bucket){assert.equal(bucket,'article-images');return {async upload(path,data,options){calls.push({op:'upload',path,data,options});return {error:null};},async remove(paths){calls.push({op:'remove',paths});return {error:null};},async createSignedUrl(path,ttl){calls.push({op:'sign',path,ttl});return {data:{signedUrl:'https://storage.invalid/signed'},error:null};}};}}};
 const handler=createCoverImportHandler({client,manifest,job:{ownerId:owner,tokenHash:hash(token),expiresAt:expired?'2000-01-01T00:00:00Z':'2099-01-01T00:00:00Z'}});
 const run=async(body={slug:'verified-cover',image_base64:bytes.toString('base64')},credential=token)=>{const r=await handler(new Request('https://job.invalid',{method:'POST',headers:{'x-import-token':credential,'content-type':'application/json'},body:JSON.stringify(body)}));return {status:r.status,body:await r.json()};};
 return {calls,run};
}
test('cover importer rejects expired or unauthenticated jobs and unreviewed bytes before database/storage access',async()=>{
 const expired=await fixture({expired:true});assert.equal((await expired.run()).status,410);assert.equal(expired.calls.length,0);
 const f=await fixture();assert.equal((await f.run(undefined,'invalid')).status,403);assert.equal((await f.run({slug:'other',image_base64:bytes.toString('base64')})).status,400);assert.equal((await f.run({slug:'verified-cover',image_base64:Buffer.from('<svg/>').toString('base64')})).status,422);assert.equal(f.calls.length,0);
});
test('cover importer rechecks admin, preserves existing covers and cleans up a concurrent losing upload',async()=>{
 const denied=await fixture({admin:false});assert.equal((await denied.run()).status,403);assert.ok(denied.calls.every(c=>c.op!=='upload'));
 const existing=await fixture({existing:'current-admin-cover'});assert.equal((await existing.run()).body.status,'kept-existing-cover');assert.ok(existing.calls.every(c=>c.op!=='upload'));
 const raced=await fixture({race:true});assert.equal((await raced.run()).body.status,'kept-concurrent-cover');assert.equal(raced.calls.filter(c=>c.op==='remove').length,1);
});
test('cover import uses a unique owned Storage path, exact bytes and provenance without modifying article content',async()=>{
 const f=await fixture(),response=await f.run();assert.equal(response.status,200);assert.equal(response.body.status,'imported');
 const upload=f.calls.find(c=>c.op==='upload');assert.match(upload.path,new RegExp('^'+owner+'/'+id+'/[0-9a-f-]{36}\\.jpg$'));assert.deepEqual(Buffer.from(upload.data),bytes);assert.equal(upload.options.upsert,false);assert.equal(upload.options.metadata.license,'Pexels License');assert.equal(upload.options.metadata.sha256,hash(bytes));
 assert.deepEqual(f.calls.find(c=>c.op==='update').value,{cover_image_path:upload.path});assert.equal(f.calls.find(c=>c.op==='sign').ttl,300);
});
test('reviewed cover manifest covers every starter article with a distinct licensed, intact JPEG asset',()=>{
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'supabase/seeds/article-covers.json'),'utf8')),articles=JSON.parse(fs.readFileSync(path.join(root,'supabase/seeds/articles_vi.json'),'utf8'));
 assert.deepEqual(manifest.covers.map(c=>c.slug).sort(),articles.articles.map(a=>a.slug).sort());assert.equal(new Set(manifest.covers.map(c=>c.photo_id)).size,20);assert.equal(manifest.license_url,'https://www.pexels.com/license/');
 for(const cover of manifest.covers){const data=fs.readFileSync(path.join(root,'supabase/seeds/article-covers',cover.slug+'.jpg'));assert.equal(hash(data),cover.sha256);assert.equal(data.length,cover.bytes);assert.ok(data.length<5*1024*1024);assert.ok(cover.photographer&&cover.photo_page.startsWith('https://www.pexels.com/photo/'));assert.equal(cover.width,1200);assert.equal(cover.height,675);}
});
