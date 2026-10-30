/* global __dirname */
const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {createClient}=require('@supabase/supabase-js'),createLoader=require('./load-ts.cjs');
const {uiFixture,elements}=require('./ui-fixture.cjs');
const boundary=name=>path.resolve(__dirname,'../'+name),tick=()=>new Promise(resolve=>setImmediate(resolve));
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
function serviceFixture(handler){
 let owner=A;const calls=[];
 const supabase=createClient('https://test.invalid','sb_publishable_test',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:async(input,init)=>{
  const request={url:new URL(String(input)),method:init.method,body:init.body?JSON.parse(init.body):null};calls.push(request);const response=await handler(request);
  return new Response(JSON.stringify(response.data),{status:response.status??200,headers:{'Content-Type':'application/json'}});
 }}});
 supabase.auth.getUser=async()=>({data:{user:owner?{id:owner,user_metadata:{role:'admin',email:'unused@example.test'}}:null},error:null});
 supabase.auth.getSession=async()=>({data:{session:owner?{user:{id:owner}}:null},error:null});
 const load=createLoader({[boundary('src/lib/supabase.ts')]:{supabase}});return {service:load('src/services/articlesService'),calls,setOwner(id){owner=id;}};
}
test('article queries are bounded, server searched, language/category aware and fail on stale identities',async()=>{
 const f=serviceFixture(()=>({data:{data:[{id:B}],total:50}}));
 const result=await f.service.getArticleFeed({language:'en',search:'  giac ngu  ',category:B,page:2,pageSize:12});
 assert.equal(result.hasMore,true);assert.deepEqual(f.calls[0].body,{p_language:'en',p_query:'giac ngu',p_category:B,p_mode:'latest',p_offset:12,p_limit:12,p_status:null});
 await f.service.getArticleFeed({language:'vi',pageSize:1000});assert.equal(f.calls[1].body.p_limit,30);
 await assert.rejects(f.service.getArticleFeed({language:'vi',search:'a'.repeat(161)}),e=>e.code==='INVALID_INPUT');
 let release;const g=serviceFixture(()=>new Promise(resolve=>{release=resolve;})),pending=g.service.getArticleFeed({language:'vi'});await tick();g.setOwner(B);release({data:{data:[],total:0}});await assert.rejects(pending,e=>e.code==='AUTH_CHANGED');
 f.setOwner(null);await assert.rejects(f.service.getArticleFeed({language:'vi'}),e=>e.code==='UNAUTHENTICATED');
});
test('role lookup ignores metadata and bookmark/interest mutations always use the confirmed owner',async()=>{
 const f=serviceFixture(request=>({data:request.url.pathname.endsWith('/user_roles')?{role:'user'}:[{id:B}]}));
 assert.equal(await f.service.getArticleRole(),'user');assert.equal(f.calls[0].url.searchParams.get('user_id'),'eq.'+A);
 await f.service.setArticleBookmark(B,true);assert.equal(f.calls[1].body.user_id,A);assert.equal(f.calls[1].body.article_id,B);
 await f.service.setArticleBookmark(B,false);assert.equal(f.calls[2].url.searchParams.get('user_id'),'eq.'+A);assert.equal(f.calls[2].url.searchParams.get('article_id'),'eq.'+B);
 await f.service.setArticleInterest(B,true);assert.deepEqual(f.calls[3].body,{user_id:A,category_id:B});
 await f.service.recordArticleRead(B);assert.deepEqual(f.calls[4].body,{p_article_id:B});
});
test('article CRUD reports conflicts and rejects hidden privileged payload fields at the database boundary',async()=>{
 const f=serviceFixture(()=>({status:409,data:{code:'40001',message:'private detail'}}));
 await assert.rejects(f.service.saveArticle(B,'2026-10-30T00:00:00Z',{slug:'draft',category_id:A,status:'draft',cover_image_path:null,is_featured:false},[]),e=>e.message==='cms.conflict');
 assert.equal(f.calls[0].url.pathname,'/rest/v1/rpc/save_article');assert.equal(f.calls[0].body.p_article.author_id,undefined);
 const g=serviceFixture(()=>({data:null}));await assert.rejects(g.service.deleteArticle(B,'2026-10-30T00:00:00Z'),e=>e.message==='cms.conflict');
 assert.equal(g.calls[0].url.searchParams.get('updated_at'),'eq.2026-10-30T00:00:00Z');
});
test('safe Markdown supports headings/lists/formatting while blocking script URLs, HTML execution and remote images',()=>{
 const content=createLoader()('src/lib/articleContent');
 const parts=content.articleInlines('**Đậm** và *nghiêng* [Nguồn](https://www.who.int/) [x](javascript:alert) <script>alert(1)</script>');
 assert.equal(parts.filter(p=>p.type==='bold').length,1);assert.equal(parts.filter(p=>p.type==='italic').length,1);assert.equal(parts.filter(p=>p.type==='link').length,1);assert.equal(parts.find(p=>p.type==='link').url,'https://www.who.int/');
 for(const url of ['javascript:alert(1)','data:text/html,x','file:///secret','https://name:password@example.com/'])assert.equal(content.safeArticleUrl(url),null);
 const image=A+'/'+B+'/'+A+'.jpg',blocks=content.articleBlocks('## Heading\n\n### Subheading\n- List\n\n![Safe](article-image:'+image+')\n\n![Remote](https://example.com/x.svg)\n<script>alert(1)</script>');
 assert.deepEqual(Array.from(blocks,b=>b.type),['h2','h3','list','image','paragraph']);assert.equal(blocks.find(b=>b.type==='image').url,image);
 assert.match(blocks.at(-1).text,/<script>/);assert.equal(content.articleSlug('Giấc ngủ đều đặn'),'giac-ngu-deu-dan');
 assert.equal(content.categoryName({name_vi:'Giấc ngủ',name_en:'Sleep'},'en'),'Sleep');
 assert.equal(content.publicationReady([{...content.emptyArticleTranslation('vi'),title:'x'}]),false);
});
test('article uploads reject SVG/HTML signatures and use short-lived private image URLs',async()=>{
 const calls=[];const load=createLoader({'react-native':{Platform:{OS:'web'}},'expo-crypto':{randomUUID:()=>A},'expo-image-picker':{},[boundary('src/lib/supabase.ts')]:{supabase:{storage:{from(bucket){assert.equal(bucket,'article-images');return {createSignedUrl:async(path,ttl)=>{calls.push({path,ttl});return {data:{signedUrl:'https://test.invalid/signed'},error:null};}};}}}},[boundary('src/services/queryCore.ts')]:{requireAuthenticatedUserId:async()=>A,assertIdentity:async()=>{}}});
 const images=load('src/services/articleImages');assert.equal(images.articleImageType(new Uint8Array([255,216,255,224])),'image/jpeg');assert.equal(images.articleImageType(new Uint8Array([137,80,78,71,13,10,26,10])),'image/png');assert.equal(images.articleImageType(new TextEncoder().encode('RIFFxxxxWEBP')),'image/webp');
 for(const value of ['<svg onload="alert(1)">','<!DOCTYPE html>','MZ executable'])assert.equal(images.articleImageType(new TextEncoder().encode(value)),null);
 const image=A+'/'+B+'/'+A+'.jpg';assert.equal(await images.getArticleImageUrl(image),'https://test.invalid/signed');assert.equal(calls[0].ttl,60);await assert.rejects(images.getArticleImageUrl('https://example.com/a.svg'),e=>e.code==='INVALID_INPUT');assert.equal(calls.length,1);
});
test('web picker opens in the click gesture and an account change before upload cancels the write',async()=>{
 const order=[];const load=createLoader({'react-native':{Platform:{OS:'web'}},'expo-crypto':{randomUUID:()=>A},'expo-image-picker':{launchImageLibraryAsync:async()=>{order.push('picker');return {canceled:false,assets:[{}]};}},[boundary('src/lib/supabase.ts')]:{supabase:{}},[boundary('src/services/queryCore.ts')]:{requireAuthenticatedUserId:async()=>{order.push('auth');return B;},assertIdentity:async()=>{}}});
 const request=load('src/services/articleImages').uploadArticleImage(B,A);assert.deepEqual(order,['picker']);await assert.rejects(request,e=>e.code==='AUTH_CHANGED');assert.deepEqual(order,['picker','auth']);
});
test('article cards translate categories and disclose fallback without changing authored content or IDs',async()=>{
 const f=uiFixture({'expo-router':{router:{}},[boundary('src/components/articles/ArticleImage.tsx')]:{ArticleImage:'ArticleImage'},[boundary('src/components/articles/BookmarkButton.tsx')]:{BookmarkButton:'BookmarkButton'}}),i18n=f.load('src/i18n/index').default;
 const Card=f.load('src/components/articles/ArticleCard').ArticleCard,article={id:B,title:'Giấc ngủ đều đặn',summary:'Nội dung được biên tập.',language:'vi',category:{name_vi:'Giấc ngủ',name_en:'Sleep'},reading_time_minutes:2,is_bookmarked:false};
 await i18n.changeLanguage('en');const english=f.render(()=>Card({article}));assert.ok(elements(english).some(e=>e.props.children===article.title));assert.ok(elements(english).some(e=>typeof e.props.children==='string'&&e.props.children.includes('Showing Vietnamese')));
 await i18n.changeLanguage('vi');const vietnamese=f.render(()=>Card({article}));assert.ok(elements(vietnamese).some(e=>e.props.children===article.title));assert.equal(elements(vietnamese).find(e=>e.type==='BookmarkButton').props.id,B);
});
function feedFixture(handler){
 let owner=A,last,cleanup,next=0;const timers=new Map(),calls=[];
 const f=uiFixture({__timers:{setTimeout(fn,ms){timers.set(++next,{fn,ms});return next;},clearTimeout(id){timers.delete(id);}},'expo-router':{useFocusEffect(fn){if(last!==fn){cleanup?.();last=fn;cleanup=fn();}}},[boundary('src/contexts/AuthContext.tsx')]:{useAuth:()=>({user:owner?{id:owner}:null})},[boundary('src/services/articlesService.ts')]:{getArticleFeed:async options=>{calls.push(options);return handler(options);}}});
 const hook=f.load('src/hooks/useArticleFeed').useArticleFeed;return {calls,timers,setOwner(id){owner=id;},render(options={}){return f.render(()=>hook({language:'vi',...options}));},async flush(){const list=[...timers.values()];timers.clear();list.forEach(t=>t.fn());await tick();}};
}
test('article search debounces, rejects obsolete language/account responses and paginates without losing results',async()=>{
 const pending=[];const f=feedFixture(options=>new Promise(resolve=>pending.push({options,resolve})));
 f.render({search:'g'});f.render({search:'giac ngu',category:B});assert.equal(f.calls.length,0);assert.equal([...f.timers.values()][0].ms,300);await f.flush();
 f.render({search:'sleep',language:'en'});await f.flush();pending[1].resolve({data:[{id:'new'}],total:20,page:1,hasMore:true});await tick();pending[0].resolve({data:[{id:'stale'}],total:1,page:1,hasMore:false});await tick();
 let state=f.render({search:'sleep',language:'en'});assert.equal(state.data[0].id,'new');const more=state.loadMore();await state.loadMore();assert.equal(f.calls.length,3);pending[2].resolve({data:[{id:'new'},{id:'second'}],total:2,page:2,hasMore:false});await more;
 state=f.render({search:'sleep',language:'en'});assert.equal(state.data.length,2);f.setOwner(B);assert.equal(f.render({search:'sleep',language:'en'}).data.length,0);
});
test('bookmark failures keep prior state; retries and double taps issue one mutation and labels translate live',async()=>{
 let attempts=0,release;const f=uiFixture({[boundary('src/contexts/AuthContext.tsx')]:{useAuth:()=>({user:{id:A}})},[boundary('src/services/articlesService.ts')]:{setArticleBookmark:async()=>{attempts++;if(attempts===1)throw Error('Network unavailable');await new Promise(resolve=>{release=resolve;});}}});
 const Button=f.load('src/components/articles/BookmarkButton').BookmarkControl,i18n=f.load('src/i18n/index').default;await i18n.changeLanguage('vi');const props={owner:A,id:B,saved:false};const render=()=>f.render(()=>Button(props));
 let tree=render();await elements(tree).find(e=>e.type==='TextButton').props.onPress();tree=render();assert.ok(elements(tree).some(e=>e.props.accessibilityRole==='alert'));assert.equal(elements(tree).find(e=>e.type==='TextButton').props.title,i18n.t('articles.bookmark'));
 const run=elements(tree).find(e=>e.type==='TextButton').props.onPress,pending=run();await run();assert.equal(attempts,2);release();await pending;await i18n.changeLanguage('en');tree=render();assert.equal(elements(tree).find(e=>e.type==='TextButton').props.title,i18n.t('articles.removeBookmark'));
});
test('Admin layout blocks non-admins and failed permission requests with retry before rendering editor routes',async()=>{
 let role={data:'user',isLoading:false,error:null,refresh:async()=>{}};
 const f=uiFixture({'expo-router':{Slot:'Slot',Redirect:'Redirect',router:{}},[boundary('src/contexts/AuthContext.tsx')]:{useAuth:()=>({user:{id:A},isRecovery:false})},[boundary('src/services/articlesService.ts')]:{getArticleRole:async()=>{}},[boundary('src/contexts/ArticleRoleContext.tsx')]:{useArticleRole:()=>role},[boundary('src/components/common/LanguageSelector.tsx')]:{LanguageSelector:'LanguageSelector'},[boundary('src/components/common/AppTextInput.tsx')]:{AppTextInput:'AppTextInput'}});
 const Layout=f.load('app/admin/_layout').default;let tree=f.render(()=>Layout());assert.equal(elements(tree).filter(e=>e.type==='Slot').length,0);assert.ok(elements(tree).some(e=>e.props.accessibilityRole==='alert'));
 role={...role,data:null,error:'Network unavailable'};tree=f.render(()=>Layout());assert.equal(elements(tree).filter(e=>e.type==='Slot').length,0);assert.ok(elements(tree).some(e=>e.props.error===role.error&&e.props.refresh===role.refresh));
 role={...role,data:'admin',error:null};tree=f.render(()=>Layout());assert.equal(elements(tree).filter(e=>e.type==='Slot').length,1);
});
test('CMS retains failed edits and prevents incomplete publication while supporting two languages and preview',async()=>{
 let writes=0;const calls=[];const f=uiFixture({'expo-router':{router:{replace(){}},usePreventRemove:()=>()=>{}},[boundary('src/contexts/AuthContext.tsx')]:{useAuth:()=>({user:{id:A}})},[boundary('src/services/articlesService.ts')]:{saveArticle:async(...args)=>{writes++;calls.push(args);throw Error('Network unavailable');}},[boundary('src/services/articleImages.ts')]:{uploadArticleImage:async()=>null,deleteArticleImage:async()=>{}},[boundary('src/components/articles/ArticleImage.tsx')]:{ArticleImage:'ArticleImage'},[boundary('src/components/articles/ArticleMarkdown.tsx')]:{ArticleMarkdown:'ArticleMarkdown'}});
 const Form=f.load('src/components/articles/AdminArticleEditor').AdminArticleEditor,i18n=f.load('src/i18n/index').default;await i18n.changeLanguage('vi');
 const props={initial:null,initialTranslations:[],categories:[{id:B,name_vi:'Giấc ngủ',name_en:'Sleep',is_active:true}],reload:async()=>{}};
 const render=()=>f.render(()=>Form(props));let tree=render();elements(tree).find(e=>e.type==='TextInput'&&e.props.accessibilityLabel===i18n.t('cms.articleTitle')).props.onChangeText('Bản thảo đang viết');tree=render();
 await elements(tree).find(e=>e.type==='PrimaryButton'&&e.props.title===i18n.t('common.save')).props.onPress();tree=render();assert.equal(writes,1);assert.equal(calls[0][2].slug,'ban-thao-dang-viet');assert.ok(elements(tree).some(e=>e.props.accessibilityRole==='alert'));
 assert.equal(elements(tree).find(e=>e.type==='TextInput'&&e.props.accessibilityLabel===i18n.t('cms.articleTitle')).props.value,'Bản thảo đang viết');
 elements(tree).find(e=>e.type==='TextButton'&&e.props.title===i18n.t('cms.publish')).props.onPress();tree=render();await elements(tree).find(e=>e.type==='PrimaryButton'&&e.props.title===i18n.t('cms.confirm')).props.onPress();assert.equal(writes,1);
 await i18n.changeLanguage('en');tree=render();assert.equal(elements(tree).find(e=>e.type==='TextInput'&&e.props.accessibilityLabel===i18n.t('cms.articleTitle')).props.value,'Bản thảo đang viết');
 elements(tree).find(e=>e.type==='TextButton'&&e.props.title===i18n.t('cms.languages.en')).props.onPress();tree=render();assert.equal(elements(tree).find(e=>e.type==='TextInput'&&e.props.accessibilityLabel===i18n.t('cms.articleTitle')).props.value,'');
 elements(tree).find(e=>e.type==='TextButton'&&e.props.title===i18n.t('cms.preview')).props.onPress();tree=render();assert.ok(elements(tree).some(e=>e.type==='Modal'&&e.props.visible));
});
test('Explore uses paged data, preserves network retry and renders an empty state without demo articles',()=>{
 let failure='Network unavailable',retries=0;const f=uiFixture({[boundary('src/contexts/ArticleRoleContext.tsx')]:{useArticleRole:()=>({data:'user'})},'expo-router':{router:{}},[boundary('src/hooks/useArticleFeed.ts')]:{useArticleFeed:()=>({data:[],isLoading:false,error:failure,hasMore:false,refresh:async()=>{retries++;},loadMore:async()=>{}})},[boundary('src/hooks/useHealthQuery.ts')]:{useHealthQuery:()=>({data:[],isLoading:false,error:null,refresh:async()=>{}})},[boundary('src/services/articlesService.ts')]:{},[boundary('src/components/articles/ArticleCard.tsx')]:{ArticleCard:'ArticleCard'},[boundary('src/components/common/DataFeedback.tsx')]:{DataFeedback:'DataFeedback'}});
 const Screen=f.load('app/(tabs)/explore').default;let tree=f.render(()=>Screen()),list=elements(tree).find(e=>e.props.data);
 assert.equal(list.props.data.length,0);assert.equal(list.props.ListEmptyComponent,undefined);const feedback=elements(list.props.ListHeaderComponent).filter(e=>e.type==='DataFeedback'&&e.props.error);assert.ok(feedback.length>0);feedback[0].props.refresh();assert.equal(retries,1);
 failure=null;tree=f.render(()=>Screen());list=elements(tree).find(e=>e.props.data);assert.ok(list.props.ListEmptyComponent);
});
test('article detail remains readable when related articles fail and offers their independent retry',()=>{
 const article={id:B,status:'published',category_id:A,category:{name_vi:'Giấc ngủ',name_en:'Sleep'},translation:{language:'vi',title:'Nội dung vẫn đọc được',summary:'Tóm tắt',content:'## Hướng dẫn\n\nNội dung bài viết.',source_name:'CDC',source_url:'https://www.cdc.gov/',reference_links:[],reading_time_minutes:1},is_bookmarked:false};
 const f=uiFixture({'expo-router':{useLocalSearchParams:()=>({id:B})},[boundary('src/hooks/useHealthQuery.ts')]:{useHealthQuery:(_loader,key)=>({data:key.includes('article-detail')?article:null,isLoading:false,error:key.includes('article-related')?'Network unavailable':null,refresh:async()=>{}})},[boundary('src/services/articlesService.ts')]:{recordArticleRead:async()=>{}},[boundary('src/components/articles/ArticleImage.tsx')]:{ArticleImage:'ArticleImage'},[boundary('src/components/articles/ArticleMarkdown.tsx')]:{ArticleMarkdown:'ArticleMarkdown'},[boundary('src/components/articles/ArticleCard.tsx')]:{ArticleCard:'ArticleCard'},[boundary('src/components/articles/BookmarkButton.tsx')]:{BookmarkButton:'BookmarkButton'},[boundary('src/components/common/DataFeedback.tsx')]:{DataFeedback:'DataFeedback'}});
 const Detail=f.load('app/article/[id]').default,tree=f.render(()=>Detail());assert.ok(elements(tree).some(e=>e.props.children===article.translation.title));assert.ok(elements(tree).some(e=>e.type==='DataFeedback'&&e.props.error==='Network unavailable'));
});
