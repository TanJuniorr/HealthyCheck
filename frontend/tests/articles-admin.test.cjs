/* global __dirname */
const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const createLoader=require('./load-ts.cjs'),{uiFixture,elements}=require('./ui-fixture.cjs');
const boundary=name=>path.resolve(__dirname,'../'+name),tick=()=>new Promise(resolve=>setImmediate(resolve));
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const row={id:B,slug:'native-draft',category_id:A,status:'draft',updated_at:'2026-10-30T00:00:00Z',cover_image_path:null,is_featured:false};
const category={id:A,name_vi:'Giấc ngủ',name_en:'Sleep',is_active:true};
function editorFixture(service={},routerOverrides={}){
 let prevented=false,blocked,disabled=0;
 const f=uiFixture({'expo-router':{router:{replace(){},canGoBack:()=>true,back(){},...routerOverrides},usePreventRemove(value,callback){prevented=value;blocked=callback;return()=>{disabled++;};}},
  [boundary('src/contexts/AuthContext.tsx')]:{useAuth:()=>({user:{id:A}})},
  [boundary('src/services/articlesService.ts')]:service,
  [boundary('src/services/articleImages.ts')]:{pickArticleImage:async()=>({uri:'file:///picked.jpg',bytes:new Uint8Array([255,216,255]),mime:'image/jpeg'}),uploadArticleImage:async()=>A+'/'+B+'/'+A+'.jpg',deleteArticleImage:async()=>{}},
  [boundary('src/components/articles/ArticleImage.tsx')]:{ArticleImage:'ArticleImage'},[boundary('src/components/articles/ArticleMarkdown.tsx')]:{ArticleMarkdown:'ArticleMarkdown'}});
 const Editor=f.load('src/components/articles/AdminArticleEditor').AdminArticleEditor;
 const props={initial:row,initialTranslations:[],categories:[category],reload:async()=>{}};
 const render=()=>f.render(()=>Editor(props));
 return {...f,props,render,get prevented(){return prevented;},get disabled(){return disabled;},block(repeat){blocked({repeat});}};
}
const byTitle=(tree,type,title)=>elements(tree).find(e=>e.type===type&&e.props.title===title);

test('native Explore shows only the admin add/manage controls and refreshes all article lists',()=>{
 let role='user',refreshes=0;const routes=[];
 const f=uiFixture({'expo-router':{router:{push:route=>routes.push(route)}},
  [boundary('src/contexts/ArticleRoleContext.tsx')]:{useArticleRole:()=>({data:role,refresh:async()=>{refreshes++;}})},
  [boundary('src/hooks/useArticleFeed.ts')]:{useArticleFeed:()=>({data:[],isLoading:false,error:null,hasMore:false,refresh:async()=>{refreshes++;},loadMore:async()=>{}})},
  [boundary('src/hooks/useHealthQuery.ts')]:{useHealthQuery:()=>({data:[],isLoading:false,error:null,refresh:async()=>{refreshes++;}})},
  [boundary('src/services/articlesService.ts')]:{},[boundary('src/components/articles/ArticleCard.tsx')]:{ArticleCard:'ArticleCard'}});
 const Screen=f.load('app/(tabs)/explore').default,t=f.load('src/i18n/index').default.t.bind(f.load('src/i18n/index').default);
 const header=()=>elements(f.render(()=>Screen())).find(e=>e.props.data).props.ListHeaderComponent;
 assert.equal(elements(header()).some(e=>e.props.accessibilityLabel===t('cms.newArticle')),false);
 role='admin';const tree=header();elements(tree).find(e=>e.props.accessibilityLabel===t('cms.newArticle')).props.onPress();byTitle(tree,'TextButton',t('cms.manageArticles')).props.onPress();assert.deepEqual(routes,['/admin/editor/new','/admin']);
 const list=elements(f.render(()=>Screen())).find(e=>e.props.data);list.props.onRefresh();assert.equal(refreshes,5);
 role=null;assert.equal(elements(header()).some(e=>e.props.accessibilityLabel===t('cms.newArticle')),false);
});

test('role state revalidates foreground/poll changes, masks errors and keys sessions by Auth UUID',async()=>{
 let owner=A,nextRole='admin',listener;const timers=new Map();let timerId=0;
 const f=uiFixture({__timers:{setTimeout(fn,ms){timers.set(++timerId,{fn,ms});return timerId;},clearTimeout(id){timers.delete(id);}},
  'react-native':{AppState:{currentState:'active',addEventListener(_event,fn){listener=fn;return {remove(){listener=null;}};}}},
  [boundary('src/contexts/AuthContext.tsx')]:{useAuth:()=>({user:owner?{id:owner}:null,isLoading:false})},
  [boundary('src/services/articlesService.ts')]:{getArticleRole:async()=>{if(nextRole==='error')throw Error('Network unavailable');return nextRole;}}});
 const Provider=f.load('src/contexts/ArticleRoleContext').ArticleRoleProvider;
 const wrapper=()=>f.render(()=>Provider({children:null}));assert.equal(wrapper().key,A);const Session=wrapper().type;
 const state=()=>f.render(()=>Session({children:null})).props.value;
 assert.equal(state().data,null);assert.equal(state().isLoading,true);await tick();assert.equal(state().data,'admin');
 nextRole='error';listener('active');await tick();assert.equal(state().data,null);assert.equal(state().lastVerifiedAdmin,true);assert.ok(state().error);
 nextRole='user';const [pollId,poll]=[...timers.entries()][0];assert.equal(poll.ms,30000);timers.delete(pollId);await poll.fn();assert.equal(state().data,'user');assert.equal(state().lastVerifiedAdmin,false);
 owner=null;assert.equal(wrapper().key,'guest');assert.equal(state().data,null);
 owner=B;assert.equal(wrapper().key,B);assert.equal(state().data,null);await tick();assert.equal(state().data,'user');f.unmount();assert.equal(timers.size,0);
});

test('native route guard waits for role, denies deep links, and hides an offline editor without unmounting edits',()=>{
 let auth={user:{id:A},isLoading:false},role={data:null,isLoading:true,error:null,lastVerifiedAdmin:false,refresh:async()=>{}};
 const f=uiFixture({'expo-router':{Slot:'Slot',Redirect:'Redirect'},[boundary('src/contexts/AuthContext.tsx')]:{useAuth:()=>auth},[boundary('src/contexts/ArticleRoleContext.tsx')]:{useArticleRole:()=>role}});
 const Layout=f.load('app/admin/_layout').default,render=()=>f.render(()=>Layout());
 assert.equal(elements(render()).some(e=>e.type==='Slot'),false);
 role={...role,data:'user',isLoading:false};assert.equal(elements(render()).some(e=>e.type==='Slot'),false);
 role={...role,data:'admin',lastVerifiedAdmin:true};assert.equal(elements(render()).some(e=>e.type==='Slot'),true);
 role={...role,data:null,error:'errors.network'};const offline=render();assert.ok(elements(offline).some(e=>e.props.style?.display==='none'));assert.equal(elements(offline).some(e=>e.type==='Slot'),true);
 auth={...auth,user:null};assert.equal(render().props.href,'/login');
});

test('native picker previews bytes, validates size/MIME and uploads an ArrayBuffer without overwriting',async()=>{
 for(const os of ['android','ios','web']){
  const calls=[];let oversized=false,malicious=false;
  const load=createLoader({'react-native':{Platform:{OS:os}},'expo-crypto':{randomUUID:()=>B},'expo-image-picker':{launchImageLibraryAsync:async options=>{calls.push({op:'pick',options});return {canceled:false,assets:[{uri:'file:///picked.jpg',fileSize:oversized?6*1024*1024:4,mimeType:malicious?'image/svg+xml':'image/jpeg',file:{arrayBuffer:async()=>new Uint8Array([255,216,255,224]).buffer}}]};}},
   __fetch:async uri=>{calls.push({op:'fetch',uri});return {arrayBuffer:async()=>new Uint8Array([255,216,255,224]).buffer};},
   [boundary('src/services/queryCore.ts')]:{requireAuthenticatedUserId:async()=>A,assertIdentity:async()=>{}},
   [boundary('src/lib/supabase.ts')]:{
    supabase:{storage:{from:()=>({upload:async(path,bytes,options)=>{calls.push({op:'upload',path,bytes,options});return {error:null};}})}}
   }
  });
  const images=load('src/services/articleImages'),picked=await images.pickArticleImage(A);assert.equal(picked.uri,'file:///picked.jpg');assert.equal(calls.some(c=>c.op==='upload'),false);
  const saved=await images.uploadArticleImage(B,A,picked);assert.equal(saved,A+'/'+B+'/'+B+'.jpg');const write=calls.find(c=>c.op==='upload');assert.ok(write.bytes instanceof ArrayBuffer);assert.equal(write.options.contentType,'image/jpeg');assert.equal(write.options.upsert,false);
  assert.equal(calls.some(c=>c.op==='fetch'),os!=='web');
  oversized=true;await assert.rejects(images.pickArticleImage(A),e=>e.message==='cms.invalidImage');oversized=false;malicious=true;await assert.rejects(images.pickArticleImage(A),e=>e.message==='cms.invalidImage');
 }
});

test('editor retains both languages/reading time, formats selected Markdown and confirms unsaved navigation',async()=>{
 const f=editorFixture(),i18n=f.load('src/i18n/index').default;await i18n.changeLanguage('vi');let tree=f.render();assert.equal(f.prevented,false);
 const input=label=>elements(tree).find(e=>e.type==='TextInput'&&e.props.accessibilityLabel===i18n.t(label));
 input('cms.articleTitle').props.onChangeText('Bản thảo');tree=f.render();input('cms.content').props.onChangeText('Một đoạn văn');tree=f.render();input('cms.content').props.onSelectionChange({nativeEvent:{selection:{start:4,end:8}}});tree=f.render();byTitle(tree,'TextButton',i18n.t('cms.format.bold')).props.onPress();tree=f.render();assert.equal(input('cms.content').props.value,'Một **đoạn** văn');
 input('cms.readingTime').props.onChangeText('7');tree=f.render();byTitle(tree,'TextButton',i18n.t('cms.languages.en')).props.onPress();tree=f.render();input('cms.articleTitle').props.onChangeText('English draft');tree=f.render();byTitle(tree,'TextButton',i18n.t('cms.languages.vi')).props.onPress();tree=f.render();assert.equal(input('cms.articleTitle').props.value,'Bản thảo');assert.equal(input('cms.readingTime').props.value,'7');assert.equal(f.prevented,true);
 let repeated=0;f.block(()=>{repeated++;});tree=f.render();byTitle(tree,'TextButton',i18n.t('cms.keepEditing')).props.onPress();assert.equal(repeated,0);f.block(()=>{repeated++;});tree=f.render();byTitle(tree,'PrimaryButton',i18n.t('cms.discardChanges')).props.onPress();f.render();assert.equal(repeated,1);assert.equal(f.prevented,false);assert.equal(f.disabled,1);
});

test('image selection is previewed before upload and save failures retain staged cover and entered content',async()=>{
 let writes=0,release;const f=editorFixture({saveArticle:async()=>{writes++;await new Promise(resolve=>{release=resolve;});throw Error('Network unavailable');}}),i18n=f.load('src/i18n/index').default;await i18n.changeLanguage('vi');
 let tree=f.render();await byTitle(tree,'TextButton',i18n.t('cms.uploadCover')).props.onPress();tree=f.render();assert.ok(elements(tree).some(e=>e.props.source?.uri==='file:///picked.jpg'));assert.equal(elements(tree).some(e=>e.type==='ArticleImage'),false);
 await byTitle(tree,'PrimaryButton',i18n.t('cms.uploadImage')).props.onPress();tree=f.render();assert.equal(elements(tree).find(e=>e.type==='ArticleImage').props.path,A+'/'+B+'/'+A+'.jpg');
 const save=byTitle(tree,'PrimaryButton',i18n.t('common.save')).props.onPress,pending=save();await save();assert.equal(writes,1);release();await pending;tree=f.render();assert.ok(elements(tree).some(e=>e.props.accessibilityRole==='alert'));assert.equal(elements(tree).find(e=>e.type==='ArticleImage').props.path,A+'/'+B+'/'+A+'.jpg');assert.equal(f.prevented,true);
});

test('server reloads never run on editor focus and responses from the previous owner are discarded',async()=>{
 let owner=A,calls=0,release;
 const f=uiFixture({[boundary('src/contexts/AuthContext.tsx')]:{useAuth:()=>({user:{id:owner}})},[boundary('src/services/articlesService.ts')]:{getArticle:async()=>{calls++;if(calls===1)return new Promise(resolve=>{release=resolve;});return row;},getArticleTranslations:async()=>[],getArticleCategories:async()=>[category]},[boundary('src/components/articles/AdminArticleEditor.tsx')]:{AdminArticleEditor:'Editor'}});
 const Screen=f.load('src/components/articles/ArticleEditorScreen').ArticleEditorScreen,render=()=>f.render(()=>Screen({id:B}));render();await tick();assert.equal(calls,1);owner=B;render();await tick();release({...row,slug:'stale-owner'});await tick();let tree=render();assert.equal(elements(tree).find(e=>e.type==='Editor').props.initial.slug,'native-draft');render();render();assert.equal(calls,2);f.unmount();
});
