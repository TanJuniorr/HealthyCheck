/* global __dirname */
const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {uiFixture}=require('./ui-fixture.cjs');
const boundary=file=>path.resolve(__dirname,'../'+file),A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('focused Dashboard, Calories, Steps, Water, Nutrition and Profile queries invalidate on confirmed goal changes only for their owner',async()=>{
 for(const key of ['overview:today','weekly-overview:week:today','goals:today','steps:today:today','water-records:week:end','nutrition-screen:today','profile-health:today']){
  let focus=null,loads=0,goal=2000;const f=uiFixture({'expo-router':{useFocusEffect:callback=>{focus=callback;}},[boundary('src/contexts/AuthContext.tsx')]:{useAuth:()=>({user:{id:A}})},[boundary('src/services/queryCore.ts')]:{assertIdentity:async()=>{}}});
  const useQuery=f.load('src/hooks/useHealthQuery').useHealthQuery,events=f.load('src/lib/healthQueryEvents'),loader=async()=>{loads++;return goal;};
  const render=()=>f.render(()=>useQuery(loader,key));render();const blur=focus();await tick();assert.equal(render().data,2000);assert.equal(loads,1);
  events.notifyGoalsChanged(B);await tick();assert.equal(loads,1);
  goal=2200;events.notifyGoalsChanged(A);await tick();assert.equal(render().data,2200);assert.equal(loads,2);
  blur();events.notifyGoalsChanged(A);await tick();assert.equal(loads,2);f.unmount();
 }
});
test('profile and weight changes recalculate recommendations; saving goals does not create a refresh loop or recalculate them',async()=>{
 let focus,loads=0,weight=65;const f=uiFixture({'expo-router':{useFocusEffect:callback=>{focus=callback;}},[boundary('src/contexts/AuthContext.tsx')]:{useAuth:()=>({user:{id:A}})},[boundary('src/services/queryCore.ts')]:{assertIdentity:async()=>{}}});
 const hook=f.load('src/hooks/useHealthQuery').useHealthQuery,events=f.load('src/lib/healthQueryEvents');
 const render=()=>f.render(()=>hook(async()=>{loads++;return {weight};},'health-recommendations:today'));render();const blur=focus();await tick();render();
 events.notifyGoalsChanged(A);await tick();assert.equal(loads,1);
 weight=80;events.notifyWeightChanged(A);await tick();assert.equal(render().data.weight,80);assert.equal(loads,2);
 events.notifyProfileChanged(A);await tick();assert.equal(loads,3);blur();f.unmount();
});
test('date and account changes mask previous query data and reject responses from old generations',async()=>{
 let owner=A,key='goals:2026-11-03',focus;const pending=[];
 const f=uiFixture({'expo-router':{useFocusEffect:callback=>{focus=callback;}},[boundary('src/contexts/AuthContext.tsx')]:{useAuth:()=>({user:{id:owner}})},[boundary('src/services/queryCore.ts')]:{assertIdentity:async()=>{}}});
 const hook=f.load('src/hooks/useHealthQuery').useHealthQuery,render=()=>f.render(()=>hook(()=>new Promise(resolve=>pending.push({owner,key,resolve})),key));
 render();let blur=focus();await tick();pending[0].resolve('yesterday');await tick();assert.equal(render().data,'yesterday');
 key='goals:2026-11-04';blur();assert.equal(render().data,null);blur=focus();await tick();
 owner=B;blur();assert.equal(render().data,null);blur=focus();await tick();
 pending.find(item=>item.owner===A&&item.key===key).resolve('old account');await tick();assert.equal(render().data,null);
 pending.find(item=>item.owner===B).resolve('new account');await tick();assert.equal(render().data,'new account');blur();f.unmount();
});
