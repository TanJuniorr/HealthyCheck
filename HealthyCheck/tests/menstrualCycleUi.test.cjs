const {test}=require('node:test'),assert=require('node:assert/strict');
const {uiFixture,elements}=require('./ui-fixture.cjs');
const {boundary,A,B}=require('./recommendation-fixture.cjs');
const id='33333333-3333-4333-8333-333333333333';
test('daily form has explicit save, deselectable mood/symptoms, no implicit period and preserves a failed draft across language changes',async()=>{
 let calls=0,fail=true,release;
 const query={data:null,isLoading:false,error:null,refresh:async()=>{}};
 const f=uiFixture({[boundary('hooks/useHealthQuery.ts')]:{useHealthQuery:()=>query},[boundary('services/menstrualCycleService.ts')]:{saveMyMenstrualCycleLog:async input=>{calls++;await new Promise(resolve=>{release=resolve;});if(fail)throw Error('cycle.saveFailed');return{...input,id};}}});
 const i18n=f.load('src/i18n/index').default;await i18n.changeLanguage('en');const Form=f.load('src/components/cycle/CycleDailyLog').CycleDailyLog;
 const render=()=>f.render(()=>Form({owner:A,date:'2026-01-01',today:'2026-11-05',hasPeriod:false,onStart(){throw Error('Not confirmed');}}));let tree=render();
 const text=e=>Array.isArray(e.props?.children)?e.props.children.join(''):e.props?.children;
 const press=label=>{const button=elements(tree).find(e=>e.type==='TouchableOpacity'&&elements(e).some(child=>text(child)===label));assert.ok(button,label);button.props.onPress();tree=render();};
 press('Light');assert.equal(calls,0);
 press('😊 Happy');press('😊 Happy');assert.ok(!elements(tree).some(e=>e.props?.accessibilityState?.selected&&elements(e).some(c=>text(c)==='😊 Happy')));
 press('Cramps');assert.ok(elements(tree).some(e=>e.props?.accessibilityState?.checked));
 const save=elements(tree).find(e=>e.type==='PrimaryButton').props.onPress,request=save();await save();assert.equal(calls,1);release();await request;tree=render();
 assert.ok(elements(tree).some(e=>e.props?.accessibilityRole==='alert'));
 await i18n.changeLanguage('vi');tree=render();assert.ok(elements(tree).some(e=>e.props?.accessibilityState?.selected&&elements(e).some(c=>c.props?.children===i18n.t('cycle.flow.light'))));
 fail=false;const retry=elements(tree).find(e=>e.type==='PrimaryButton').props.onPress();release();await retry;tree=render();assert.equal(elements(tree).find(e=>e.type==='PrimaryButton').props.disabled,true);
 query.isLoading=true;tree=render();assert.equal(elements(tree).find(e=>e.type==='PrimaryButton').props.disabled,true);
});
test('period confirmation keeps UUID and edited notes on failure, blocks double saves, and only deletes after confirmation',async()=>{
 let calls=0,deleted=0,closed=0,release;
 const f=uiFixture({'expo-crypto':{randomUUID:()=>id},[boundary('services/menstrualCycleService.ts')]:{saveMyMenstrualCyclePeriod:async input=>{calls++;assert.equal(input.id,id);await new Promise(resolve=>{release=resolve;});throw Error('cycle.saveFailed');},deleteMyMenstrualCyclePeriod:async()=>{deleted++;}}});
 await f.load('src/i18n/index').default.changeLanguage('en');const Editor=f.load('src/components/cycle/CyclePeriodEditor').CyclePeriodEditor;
 const render=()=>f.render(()=>Editor({owner:A,today:'2026-11-05',action:{mode:'start'},onClose(){closed++;},onSaved(){closed++;}}));let tree=render();
 elements(tree).find(e=>e.type?.name==='AppTextInput').props.onChangeText('Keep these notes');tree=render();
 const save=elements(tree).find(e=>e.type==='PrimaryButton').props.onPress,request=save();await save();assert.equal(calls,1);release();await request;tree=render();
 assert.equal(closed,0);assert.equal(elements(tree).find(e=>e.type?.name==='AppTextInput').props.value,'Keep these notes');assert.ok(elements(tree).some(e=>e.props?.accessibilityRole==='alert'));assert.equal(deleted,0);
 const deletion=uiFixture({'expo-crypto':{randomUUID:()=>id},[boundary('services/menstrualCycleService.ts')]:{deleteMyMenstrualCyclePeriod:async()=>{deleted++;}}});
 const Delete=deletion.load('src/components/cycle/CyclePeriodEditor').CyclePeriodEditor;
 const dialog=deletion.render(()=>Delete({owner:A,today:'2026-11-05',action:{mode:'delete',period:{id,user_id:A,start_date:'2026-01-01',end_date:null}},onClose(){},onSaved(){}}));
 assert.equal(deleted,0);await elements(dialog).find(e=>e.type==='PrimaryButton').props.onPress();assert.equal(deleted,1);
});
test('Dashboard and Cycle share predictions after create/edit/delete and month calendar updates immediately',async()=>{
 let periods=[{id:'p1',user_id:A,start_date:'2026-10-01',end_date:'2026-10-05'},{id:'p0',user_id:A,start_date:'2026-09-03',end_date:'2026-09-07'}];
 const settings={user_id:A,last_period_start:'2020-01-01',cycle_length:28,period_length:5,reminder_enabled:false,reminder_days_before:2};
 const setup=()=>uiFixture({'expo-crypto':{randomUUID:()=>id},'expo-router':{useRouter:()=>({push(){},back(){}}),Redirect:'Redirect'},
 [boundary('contexts/AuthContext.tsx')]:{useAuth:()=>({user:{id:A,user_metadata:{}},profile:{gender:'female',full_name:'Test'},profileChecked:true})},
 [boundary('contexts/NotificationInboxContext.tsx')]:{useNotificationInbox:()=>({unreadCount:0,notificationsEnabled:false})},
 [boundary('hooks/useLocalToday.ts')]:{useLocalToday:()=> '2026-11-05'},
 [boundary('hooks/useHealthQuery.ts')]:{useHealthQuery:(_load,key)=>({data:key.startsWith('overview-cycle')||key.startsWith('menstrual-cycle-overview')?{settings,periods}:key.startsWith('menstrual-cycle-calendar')?{periods,logs:[]}:key.startsWith('menstrual-cycle-history')?{data:periods,hasMore:false}:null,isLoading:false,error:null,refresh:async()=>{}})},
 [boundary('hooks/healthHooks.ts')]:{useWeeklyOverview:()=>({data:null,isLoading:false,error:null,refresh:async()=>{}})},
 [boundary('hooks/useArticleFeed.ts')]:{useArticleFeed:()=>({data:[],isLoading:false,error:null,refresh:async()=>{}})},
 [boundary('services/menstrualCycleService.ts')]:{},[boundary('services/menstrualCycleNotifications.ts')]:{reconcileMenstrualCycleReminder:async()=> 'off'},
 [boundary('services/healthNotifications.ts')]:{notifyLowHealthScore:async()=>{}},[boundary('services/avatarService.ts')]:{},
 [boundary('lib/profileRepository.ts')]:{displayName:()=> 'Test',initials:()=> 'T',profileText:()=>null},
 [boundary('components/health/HealthComponents.tsx')]:{HealthMetricCard:'HealthMetricCard',StatPill:'StatPill'},
 [boundary('components/common/MockAvatar.tsx')]:{MockAvatar:'MockAvatar'},[boundary('components/common/AppHeader.tsx')]:{AppHeader:'AppHeader',SectionHeader:'SectionHeader'},
 [boundary('components/common/ScreenContainer.tsx')]:{ScreenContainer:'ScreenContainer'},[boundary('components/charts/ProgressRing.tsx')]:{ProgressRing:'ProgressRing'},[boundary('components/articles/ArticleCard.tsx')]:{ArticleCard:'ArticleCard'},
 });
 const dash=setup(),cycle=setup();await dash.load('src/i18n/index').default.changeLanguage('en');await cycle.load('src/i18n/index').default.changeLanguage('en');
 const Dashboard=dash.load('app/(tabs)/index').default,Cycle=cycle.load('app/health/cycle').CycleTrackingContent;
 const verify=()=>{const overview=dash.render(()=>Dashboard()),screen=cycle.render(()=>Cycle({owner:A}));const card=elements(overview).find(e=>e.type==='HealthMetricCard'&&e.props.category==='Cycle');assert.ok(card);assert.ok(elements(screen).some(e=>e.type==='Text'&&e.props.children===card.props.value));return screen;};
 verify();
 periods=[{id:'new',user_id:A,start_date:'2026-11-01',end_date:null},...periods];let tree=verify();assert.equal(elements(tree).find(e=>e.type?.name==='CycleMonthCalendar').props.periods[0].id,'new');
 periods=[{...periods[0],end_date:'2026-11-04'},...periods.slice(1)];verify();
 periods=[{...periods[0],start_date:'2026-10-30'},...periods.slice(1)];verify();
 periods=periods.slice(1);verify();dash.unmount();cycle.unmount();
});

test('focused cycle queries invalidate for the matching owner, ignore other owners and suppress late responses after account switches',async()=>{
 let owner=A,value=1,loads=0,hold=false,release;const focus=[];
 const events=require('./load-ts.cjs')()('src/lib/menstrualCycleEvents');
 const f=uiFixture({'expo-router':{useFocusEffect:callback=>{if(focus.at(-1)!==callback)focus.push(callback);}},[boundary('contexts/AuthContext.tsx')]:{useAuth:()=>({user:{id:owner}})},[boundary('services/queryCore.ts')]:{assertIdentity:async()=>{}},[boundary('lib/menstrualCycleEvents.ts')]:events});
 const hook=f.load('src/hooks/useHealthQuery').useHealthQuery,loader=async()=>{loads++;if(hold)return new Promise(resolve=>{release=resolve;});return value;};
 f.render(()=>hook(loader,'overview-cycle:female'));let blur=focus.at(-1)();await new Promise(resolve=>setImmediate(resolve));
 value=2;events.notifyCycleChanged(B,'periods');await new Promise(resolve=>setImmediate(resolve));assert.equal(loads,1);
 events.notifyCycleChanged(A,'periods');await new Promise(resolve=>setImmediate(resolve));assert.equal(f.render(()=>hook(loader,'overview-cycle:female')).data,2);
 hold=true;events.notifyCycleChanged(A,'periods');await new Promise(resolve=>setImmediate(resolve));
 blur();owner=B;assert.equal(f.render(()=>hook(loader,'overview-cycle:female')).data,null);
 hold=false;value=3;blur=focus.at(-1)();await new Promise(resolve=>setImmediate(resolve));release(99);await new Promise(resolve=>setImmediate(resolve));assert.equal(f.render(()=>hook(loader,'overview-cycle:female')).data,3);
 blur();f.unmount();
});
