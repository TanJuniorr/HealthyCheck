/* global __dirname */
const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const load=require('./load-ts.cjs')(),health=load('src/lib/healthOnboarding'),gate=load('src/lib/authGate');
const {uiFixture,elements}=require('./ui-fixture.cjs');
const boundary=name=>path.resolve(__dirname,'../'+name),tick=()=>new Promise(resolve=>setImmediate(resolve));
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const profile={id:A,full_name:'Lan',date_of_birth:'1995-05-02',gender:'prefer_not_to_say',height_cm:170.5,health_onboarding_completed_at:'2020-10-27T00:00:00Z'};
test('required health fields validate real dates, all genders and decimal measurements without assumed age',()=>{
 const draft={dateOfBirth:'1995-05-02',gender:'prefer_not_to_say',heightCm:'170,5',weightKg:'65,5'};
 assert.equal(Object.keys(health.onboardingErrors(draft)).length,0);
 for(const gender of health.PROFILE_GENDERS)assert.equal(Object.keys(health.onboardingErrors({...draft,gender})).length,0);
 assert.equal(Object.keys(health.onboardingErrors({dateOfBirth:'',gender:'',heightCm:'',weightKg:''})).length,4);
 for(const dateOfBirth of ['2999-01-01','2020-02-30','not-a-date'])assert.equal(health.onboardingErrors({...draft,dateOfBirth}).dateOfBirth,'onboarding.invalidBirthDate');
 for(const heightCm of ['0','-1','29.9','301','NaN','2e2'])assert.ok(health.onboardingErrors({...draft,heightCm}).heightCm);
 for(const weightKg of ['0','-1','501','Infinity','0.001','bad'])assert.ok(health.onboardingErrors({...draft,weightKg}).weightKg);
 assert.equal(health.ageFromBirthDate('', '2026-10-30'),null);assert.equal(health.ageFromBirthDate('2026-10-30','2026-10-30'),0);
 assert.equal(health.ageFromBirthDate('2000-10-31','2026-10-30'),25);assert.equal(health.ageFromBirthDate('2000-10-30','2026-10-30'),26);
 assert.equal(health.onboardingComplete({...profile,height_cm:null,gender:null}),true);
 assert.equal(health.onboardingComplete({...profile,health_onboarding_completed_at:null}),false);
 assert.throws(()=>health.validateOnboarding({date_of_birth:'1995-05-02',gender:'male',height_cm:170,weight_kg:65,user_id:B}),e=>e.code==='INVALID_INPUT');
});
test('routing fails closed until the current owner profile is checked; recovery bypasses the profile gate only',()=>{
 const state={isLoading:false,isAuthenticated:true,isRecovery:false,user:{id:A},profile:null,profileChecked:false,profileError:null};
 assert.equal(gate.authGate(state),'checking');assert.equal(gate.gateDestination(gate.authGate(state)),'/auth/profile-check');
 assert.equal(gate.authGate({...state,profileChecked:true}),'onboarding');
 assert.equal(gate.authGate({...state,profileChecked:true,profile}),'ready');
 assert.equal(gate.authGate({...state,profileChecked:true,profile:{...profile,id:B}}),'checking');
 assert.equal(gate.authGate({...state,profileError:'network'}),'error');
 assert.equal(gate.authGate({...state,isRecovery:true,profileError:'network'}),'recovery');
 assert.equal(gate.authGate({...state,isAuthenticated:false}),'guest');
 assert.equal(gate.authGate({...state,isLoading:true}),'restoring');
});
test('actual navigator blocks every app/deep-link route for onboarding, loading and errors, and redirects completion to Dashboard',()=>{
 let auth={isLoading:false,isAuthenticated:true,isRecovery:false,user:{id:A},profile:null,profileChecked:true,profileError:null};
 const Stack=Object.assign(()=>null,{Protected:'Protected',Screen:'Screen'});
 const f=uiFixture({[boundary('src/contexts/ArticleRoleContext.tsx')]:{ArticleRoleProvider:'ArticleRoleProvider'},'expo-router':{Stack},'expo-status-bar':{StatusBar:'StatusBar'},
  [boundary('src/contexts/AuthContext.tsx')]:{useAuth:()=>auth},
  [boundary('src/contexts/NotificationInboxContext.tsx')]:{NotificationInboxProvider:'NotificationInboxProvider'},
  [boundary('src/contexts/SleepReminderContext.tsx')]:{SleepReminderProvider:'SleepReminderProvider'},
  [boundary('src/contexts/StepSensorContext.tsx')]:{StepSensorProvider:'StepSensorProvider'},
  [boundary('src/i18n/LanguageProvider.tsx')]:{LanguageProvider:'LanguageProvider'}});
 const Navigator=f.load('app/_layout').AuthNavigator;
 const allowed=()=>elements(f.render(()=>Navigator())).filter(e=>e.type==='Protected').filter(e=>e.props.guard).flatMap(e=>elements(e).filter(child=>child.type==='Screen').map(child=>child.props.name));
 assert.deepEqual(allowed(),['health-onboarding']);
 auth={...auth,profileChecked:false};assert.deepEqual(allowed(),['auth/profile-check']);
 auth={...auth,profileError:'offline'};assert.deepEqual(allowed(),['auth/profile-check']);
 auth={...auth,profileChecked:true,profileError:null,profile};assert.ok(allowed().includes('(tabs)'));assert.ok(allowed().includes('health'));assert.ok(!allowed().includes('health-onboarding'));
 const tree=f.render(()=>Navigator());assert.ok(elements(tree).some(e=>e.type==='Protected'&&elements(e).some(child=>child.props?.name==='health-onboarding')&&e.props.redirectTo==='/(tabs)'));
 assert.ok(elements(tree).some(e=>e.props?.name==='auth/callback'));assert.ok(elements(tree).some(e=>e.props?.name==='reset-password'));
});
test('onboarding form retains both steps, validates fields, localizes live and retries without duplicate submits',async()=>{
 let calls=0,release,saved;
 const f=uiFixture({[boundary('src/contexts/AuthContext.tsx')]:{useAuth:()=>({profile:null,signOut:async()=>{},finishHealthOnboarding:async input=>{calls++;saved=input;if(calls===1)throw Error('Network unavailable');await new Promise(resolve=>{release=resolve;});}})},
  [boundary('src/components/common/AppTextInput.tsx')]:{AppTextInput:'AppTextInput'},
  [boundary('src/components/profile/PersonalHealthFields.tsx')]:{BirthDateField:'BirthDateField',GenderField:'GenderField'},
  [boundary('src/components/common/LanguageSelector.tsx')]:{LanguageSelector:'LanguageSelector'}});
 const Form=f.load('app/health-onboarding').HealthOnboardingForm,i18n=f.load('src/i18n/index').default;await i18n.changeLanguage('vi');
 const render=()=>f.render(()=>Form());let tree=render();
 await elements(tree).find(e=>e.type==='PrimaryButton').props.onPress();tree=render();assert.equal(elements(tree).find(e=>e.type==='BirthDateField').props.error,'onboarding.required');assert.equal(calls,0);
 elements(tree).find(e=>e.type==='BirthDateField').props.onChange('1995-05-02');tree=render();elements(tree).find(e=>e.type==='GenderField').props.onChange('prefer_not_to_say');tree=render();
 elements(tree).find(e=>e.type==='PrimaryButton').props.onPress();tree=render();assert.equal(elements(tree).find(e=>e.type==='PrimaryButton').props.disabled,true);
 elements(tree).filter(e=>e.type==='AppTextInput')[0].props.onChangeText('170,5');tree=render();elements(tree).filter(e=>e.type==='AppTextInput')[1].props.onChangeText('65,5');tree=render();
 elements(tree).find(e=>e.type==='TextButton'&&e.props.title===i18n.t('common.back')).props.onPress();tree=render();assert.equal(elements(tree).find(e=>e.type==='BirthDateField').props.value,'1995-05-02');
 elements(tree).find(e=>e.type==='PrimaryButton').props.onPress();tree=render();assert.equal(elements(tree).filter(e=>e.type==='AppTextInput')[1].props.value,'65,5');
 await elements(tree).find(e=>e.type==='PrimaryButton').props.onPress();tree=render();assert.equal(calls,1);assert.ok(elements(tree).some(e=>e.props.accessibilityRole==='alert'));
 await i18n.changeLanguage('en');tree=render();assert.equal(elements(tree).filter(e=>e.type==='AppTextInput')[0].props.value,'170,5');
 const submit=elements(tree).find(e=>e.type==='PrimaryButton').props.onPress,request=submit();await submit();assert.equal(calls,2);release();await request;
 assert.equal(saved.height_cm,170.5);assert.equal(saved.weight_kg,65.5);assert.equal(saved.gender,'prefer_not_to_say');assert.equal(saved.date_of_birth,'1995-05-02');
});
test('birth date is unset until selection, uses a cross-platform picker and blocks future dates',()=>{
 const f=uiFixture(),Field=f.load('src/components/profile/PersonalHealthFields').BirthDateField;let chosen=null;
 const render=()=>f.render(()=>Field({value:'',onChange:value=>{chosen=value;}}));let tree=render();assert.equal(chosen,null);
 elements(tree).find(e=>e.type==='TouchableOpacity').props.onPress();tree=render();const picker=elements(tree).find(e=>e.type?.name==='CalendarDatePicker');
 assert.equal(picker.props.maxDate,load('src/lib/dateUtils').toLocalDateKey());assert.equal(chosen,null);picker.props.onSelect('1995-05-02');assert.equal(chosen,'1995-05-02');
});
test('field validation feedback renders the specific translated error in both languages',async()=>{
 const f=uiFixture(),Input=f.load('src/components/common/AppTextInput').AppTextInput,i18n=f.load('src/i18n/index').default;
 for(const language of ['vi','en']){
  await i18n.changeLanguage(language);
  const tree=f.render(()=>Input({value:'-1',onChangeText(){},error:'onboarding.invalidHeight'}));
  assert.ok(elements(tree).some(e=>e.props.children===i18n.t('onboarding.invalidHeight')));
 }
});
test('onboarding uses the live Light/Dark theme for its screen and form card',()=>{
 let dark=false;
 const themeLoad=require('./load-ts.cjs')({react:{...require('react'),useContext:()=>({isDark:dark}),useMemo:fn=>fn()},
  '@react-native-async-storage/async-storage':{},'react-native':{StyleSheet:{create:x=>x,flatten:x=>x}}});
 const theme=themeLoad('src/contexts/ThemeContext'),colors=themeLoad('src/constants/colors');
 const f=uiFixture({[boundary('src/contexts/ThemeContext.tsx')]:theme,[boundary('src/contexts/AuthContext.tsx')]:{useAuth:()=>({profile:null})},
  [boundary('src/components/common/LanguageSelector.tsx')]:{LanguageSelector:'LanguageSelector'}});
 const Form=f.load('app/health-onboarding').HealthOnboardingForm;
 let tree=f.render(()=>Form());assert.equal(tree.props.style.backgroundColor,colors.LightColors.background);
 dark=true;tree=f.render(()=>Form());assert.equal(tree.props.style.backgroundColor,colors.DarkColors.background);
 assert.ok(elements(tree).some(e=>e.type==='View'&&e.props.style?.borderRadius===20&&e.props.style.backgroundColor===colors.DarkColors.surface));
});
test('AuthProvider rejects stale profiles across account changes, keeps recovery, and adopts confirmed completion without a reload',async()=>{
 let listener,loadOwner,fail=false,session={user:{id:A,user_metadata:{}}};
 const auth={onAuthStateChange:fn=>{listener=fn;return {data:{subscription:{unsubscribe(){}}}};},getSession:async()=>({data:{session},error:null}),signOut:async()=>{session=null;listener('SIGNED_OUT',null);return {error:null};}};
 const pending=[];
 const f=uiFixture({[boundary('src/lib/supabase.ts')]:{supabase:{auth},authConfigurationError:null},
  [boundary('src/lib/profileRepository.ts')]:{loadProfile:async owner=>{loadOwner=owner;if(fail)throw Error('offline');return new Promise(resolve=>pending.push({owner,resolve}));}},
  [boundary('src/services/healthOnboardingService.ts')]:{completeHealthOnboarding:async()=>({...profile,id:session.user.id})}});
 const Provider=f.load('src/contexts/AuthContext').AuthProvider,render=()=>f.render(()=>Provider({children:null})).props.value;
 let state=render();assert.equal(state.isLoading,true);await tick();state=render();await tick();state=render();assert.equal(state.profileChecked,false);assert.equal(loadOwner,A);
 session={user:{id:B,user_metadata:{}}};listener('SIGNED_IN',session);state=render();await tick();state=render();assert.equal(state.profile,null);assert.equal(loadOwner,B);
 pending.find(p=>p.owner===A).resolve(profile);await tick();state=render();assert.equal(state.profile,null);assert.equal(state.profileChecked,false);
 pending.find(p=>p.owner===B).resolve(null);await tick();state=render();assert.equal(state.profileChecked,true);assert.equal(gate.authGate(state),'onboarding');
 const staleRefresh=state.refreshProfile();await tick();
 await state.finishHealthOnboarding({date_of_birth:'1995-05-02',gender:'male',height_cm:170,weight_kg:65});state=render();assert.equal(state.profile.id,B);assert.equal(gate.authGate(state),'ready');
 pending.filter(p=>p.owner===B).at(-1).resolve(null);await staleRefresh;state=render();assert.equal(gate.authGate(state),'ready');
 fail=true;await state.refreshProfile();state=render();assert.equal(gate.authGate(state),'error');
 fail=false;const retry=state.refreshProfile();state=render();assert.equal(gate.authGate(state),'checking');pending.filter(p=>p.owner===B).at(-1).resolve({...profile,id:B});await retry;state=render();assert.equal(gate.authGate(state),'ready');
 listener('PASSWORD_RECOVERY',session);state=render();assert.equal(gate.authGate(state),'recovery');
 await state.signOut();state=render();assert.equal(state.profile,null);assert.equal(state.profileChecked,false);assert.equal(gate.authGate(state),'guest');
 f.unmount();
});
