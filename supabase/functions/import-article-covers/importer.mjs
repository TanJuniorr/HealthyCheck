// A narrow, expiring editorial import capability. It accepts only the reviewed
// manifest's exact bytes, never a caller-supplied URL, owner, ID or database patch.
export function createCoverImportHandler({client,manifest,job,now=()=>Date.now()}) {
 const allowed=new Map(manifest.covers.map(cover=>[cover.slug,cover]));
 const running=new Set();
 const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
 const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
 const same=(a,b)=>a.length===b.length&&Array.from(a).reduce((diff,char,i)=>diff|(char.charCodeAt(0)^b.charCodeAt(i)),0)===0;
 return async request=>{
  if(!job.tokenHash||!job.ownerId||!Number.isFinite(Date.parse(job.expiresAt))||now()>Date.parse(job.expiresAt))return json({error:'Import is disabled'},410);
  if(request.method!=='POST')return json({error:'POST required'},405);
  const token=request.headers.get('x-import-token')??'';
  if(token.length<40||token.length>160||!same(await digest(new TextEncoder().encode(token)),job.tokenHash))return json({error:'Unauthorized'},403);
  let slug,path,locked=false;
  try{
   const reader=request.body?.getReader();if(!reader)return json({error:'Missing body'},400);
   const chunks=[];let size=0;
   while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>8*1024*1024){await reader.cancel();return json({error:'Body too large'},413);}chunks.push(value);}
   const bodyBytes=new Uint8Array(size);let at=0;for(const chunk of chunks){bodyBytes.set(chunk,at);at+=chunk.byteLength;}
   const body=JSON.parse(new TextDecoder().decode(bodyBytes));slug=body.slug;
   const cover=allowed.get(slug);if(!cover||typeof body.image_base64!=='string'||Object.keys(body).some(key=>!['slug','image_base64'].includes(key)))return json({error:'Invalid import item'},400);
   const bytes=Uint8Array.from(atob(body.image_base64),char=>char.charCodeAt(0));
   if(bytes.length!==cover.bytes||bytes.length>5*1024*1024||bytes[0]!==255||bytes[1]!==216||bytes[2]!==255||await digest(bytes)!==cover.sha256)return json({error:'Unreviewed image bytes'},422);
   if(running.has(slug))return json({error:'Import in progress'},409);
   running.add(slug);locked=true;
   const {data:role,error:roleError}=await client.from('user_roles').select('user_id').eq('user_id',job.ownerId).eq('role','admin').maybeSingle();
   if(roleError||!role)return json({error:'Import owner is not an admin'},403);
   const {data:article,error:articleError}=await client.from('articles').select('id,slug,cover_image_path').eq('slug',slug).maybeSingle();
   if(articleError||!article)return json({error:'Article unavailable'},404);
   if(article.cover_image_path)return json({slug,status:'kept-existing-cover'});
   path=`${job.ownerId}/${article.id}/${crypto.randomUUID()}.jpg`;
   const storage=client.storage.from('article-images');
   const uploaded=await storage.upload(path,bytes,{contentType:'image/jpeg',cacheControl:'3600',upsert:false,metadata:{provider:manifest.provider,photographer:cover.photographer,photo_page:cover.photo_page,license:manifest.license,license_url:manifest.license_url,sha256:cover.sha256,description_vi:cover.description_vi}});
   if(uploaded.error)throw new Error('Storage upload failed');
   // A concurrent editor's cover always wins over this seed import.
   const saved=await client.from('articles').update({cover_image_path:path}).eq('id',article.id).is('cover_image_path',null).select('id').maybeSingle();
   if(saved.error||!saved.data){await storage.remove([path]);path=undefined;if(saved.error)throw new Error('Article update failed');return json({slug,status:'kept-concurrent-cover'});}
   const signed=await storage.createSignedUrl(path,300);
   if(signed.error||!signed.data?.signedUrl)return json({slug,status:'imported',path,warning:'Signed URL verification unavailable'});
   return json({slug,status:'imported',path,signed_url:signed.data.signedUrl});
  }catch{
   // Never include server credentials, raw SQL, request bytes or tokens in errors.
   return json({slug,error:'Cover import failed'},500);
  }finally{if(locked)running.delete(slug);}
 };
}
