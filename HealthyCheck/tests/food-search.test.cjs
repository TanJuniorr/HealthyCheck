/* global __dirname */
const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {uiFixture}=require('./ui-fixture.cjs');
const boundary=name=>path.resolve(__dirname,'../'+name),tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(handler) {
 let owner='account',last,cleanup,nextId=0;const timers=new Map(),calls=[];
 const f=uiFixture({
  __timers:{setTimeout(fn,ms){const id=++nextId;timers.set(id,{fn,ms});return id;},clearTimeout(id){timers.delete(id);}},
  'expo-router':{useFocusEffect:fn=>{if(last!==fn){cleanup?.();last=fn;cleanup=fn();}}},
  [boundary('src/contexts/AuthContext.tsx')]:{useAuth:()=>({user:owner?{id:owner}:null})},
  [boundary('src/services/foodsService.ts')]:{getAllFoods:async options=>{calls.push(options);return handler(options);}}
 });
 const useSearch=f.load('src/hooks/useFoodSearch').useFoodSearch;
 return {calls,timers,setOwner(value){owner=value;},render(query='',group=null){return f.render(()=>useSearch(query,group));},async flush(){const pending=[...timers.values()];timers.clear();pending.forEach(t=>t.fn());await tick();},blur(){cleanup?.();}};
}
test('rapid search typing is debounced and sends only a bounded final query with its category',async()=>{
 const f=fixture(async()=>({data:[{id:'salmon'}],page:1,total:1,hasMore:false}));
 f.render('c');f.render('ca');f.render('ca hoi','meat');assert.equal(f.calls.length,0);assert.equal(f.timers.size,1);assert.equal([...f.timers.values()][0].ms,300);
 await f.flush();assert.equal(f.calls.length,1);assert.deepEqual({...f.calls[0]},{search:'ca hoi',category:'meat',page:1,pageSize:30});
 const result=f.render('ca hoi','meat');assert.equal(result.data[0].id,'salmon');assert.equal(result.isLoading,false);
});
test('late previous-search responses cannot replace current results and account changes clear them immediately',async()=>{
 const pending=[];const f=fixture(options=>new Promise(resolve=>pending.push({options,resolve})));
 f.render('ca hoi');await f.flush();f.render('uc ga');await f.flush();
 pending[1].resolve({data:[{id:'chicken'}],page:1,total:1,hasMore:false});await tick();assert.equal(f.render('uc ga').data[0].id,'chicken');
 pending[0].resolve({data:[{id:'old-salmon'}],page:1,total:1,hasMore:false});await tick();assert.equal(f.render('uc ga').data[0].id,'chicken');
 f.setOwner('other');assert.equal(f.render('uc ga').data,null);f.setOwner(null);assert.equal(f.render('uc ga').data,null);f.blur();assert.equal(f.timers.size,0);
});
test('pagination loads one next page at a time, retains results after an error and supports retry',async()=>{
 let resolveMore,attempt=0;
 const f=fixture(async options=>{
  if(options.page===1)return {data:[{id:'first'}],page:1,total:60,hasMore:true};
  attempt++;if(attempt===1)throw Error('Network unavailable');
  return new Promise(resolve=>{resolveMore=resolve;});
 });
 f.render();await f.flush();let state=f.render();await state.loadMore();state=f.render();assert.equal(state.data.length,1);assert.ok(state.error);
 const first=state.loadMore();await state.loadMore();assert.equal(f.calls.length,3);
 resolveMore({data:[{id:'first'},{id:'second'}],page:2,total:60,hasMore:false});await first;state=f.render();assert.equal(state.data.length,2);assert.equal(state.error,null);assert.equal(state.hasMore,false);
});
test('clearing or changing category replaces the page and blur cancels a pending debounce',async()=>{
 const f=fixture(async options=>({data:[{id:options.category??'all'}],page:1,total:1,hasMore:false}));
 f.render('rau','vegetables');await f.flush();assert.equal(f.render('rau','vegetables').data[0].id,'vegetables');
 assert.equal(f.render('',null).data,null);await f.flush();assert.equal(f.render('',null).data[0].id,'all');
 f.render('not submitted');f.blur();await f.flush();assert.equal(f.calls.length,2);
});
