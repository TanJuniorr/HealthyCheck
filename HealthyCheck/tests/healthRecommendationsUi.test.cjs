/* global __dirname */
const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {uiFixture,elements}=require('./ui-fixture.cjs');
const boundary=file=>path.resolve(__dirname,'../'+file),A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const old={id:B,user_id:A,daily_steps:8000,daily_calories:2000,daily_water_ml:2000,target_sleep_minutes:480};
const estimates={calories:{status:'success',recommendedCalories:1850.4,bmr:1500,tdee:2000},steps:{status:'success',recommendedSteps:7000,recommendationMethod:'activity_starting_point',confidence:'low',explanationKey:'recommendations.steps.unverifiedHistory'},water:{status:'success',recommendedWaterMl:2250,explanationKey:'recommendations.water.drinkingFluidsEstimate',limitations:{canApplyDirectlyToWaterOnlyGoal:false}}};
function setup(extra={}){
 let saved=old,recs=estimates,owner=A,loading=false,retries=0,applied=0,manual=[],profiles=0;
 const applications=[];
 const f=uiFixture({__realRecommendations:true,...extra,
  'expo-router':{router:{push(){profiles++;}}},
  [boundary('src/contexts/AuthContext.tsx')]:{useAuth:()=>({user:{id:owner}})},
  [boundary('src/hooks/healthHooks.ts')]:{useHealthRecommendations:()=>recQuery(),useHealthGoals:()=>goalQuery()},
  [boundary('src/components/common/AppTextInput.tsx')]:{AppTextInput:'AppTextInput'},
  [boundary('src/components/common/DataFeedback.tsx')]:{DataFeedback:'DataFeedback'},
  [boundary('src/services/healthGoalSnapshotService.ts')]:{applyHealthGoalRecommendation:async(...args)=>{applied++;applications.push(args);if(extra.__applyWait)await extra.__applyWait;if(extra.__applyError)throw extra.__applyError;return old;},saveManualHealthGoals:async(context,changes)=>{manual.push({context,changes});return old;}},
 });
 const recQuery=()=>({data:recs,isLoading:loading,error:null,refresh:async()=>{retries++;}}),goalQuery=()=>({data:saved,isLoading:false,error:null,refresh:async()=>{}});
 const Panel=f.load('src/components/health/HealthRecommendationsSection').RecommendationPanel;
 const render=()=>f.renderDeep(()=>Panel({query:recQuery(),goalsQuery:goalQuery(),actual:{calories:1200,steps:3500,water:1000}}));
 return {f,render,setSaved:v=>{saved=v;},setRecs:v=>{recs=v;},setOwner:v=>{owner=v;},setLoading:v=>{loading=v;},stats:()=>({retries,applied,applications,manual,profiles}),recQuery,goalQuery};
}
const text=tree=>elements(tree).filter(e=>e.type==='Text').map(e=>e.props.children).flat().filter(v=>typeof v==='string').join(' ');
const button=(tree,title)=>elements(tree).find(e=>e.props.title===title);
const byId=(tree,id)=>elements(tree).find(e=>e.props.testID===id);
test('compact cards distinguish estimate, saved goal and actual and put explanations in separate dialogs',async()=>{
 const s=setup(),i18n=s.f.load('src/i18n/index').default;await i18n.changeLanguage('en');const tree=s.render();
 for(const kind of ['calories','steps','water'])assert.ok(elements(tree).some(e=>e.props.testID==='recommendation-'+kind));
 assert.ok(text(tree).includes('1,850'));assert.ok(text(tree).includes('2,000'));assert.ok(text(tree).includes('1,200'));
 const bars=elements(tree).filter(e=>e.props.accessibilityRole==='progressbar');assert.equal(bars[0].props.accessibilityValue.now,60);assert.equal(bars[1].props.accessibilityValue.now,43.75);assert.equal(bars[2].props.accessibilityValue.now,50);
 assert.ok(button(tree,'Apply 2,250 ml/day'));
 assert.ok(!text(tree).includes(i18n.t('goals.waterScope')));
 button(byId(tree,'recommendation-water'),i18n.t('goals.details')).props.onPress();
 const detail=s.render();
 assert.ok(text(detail).includes(i18n.t('goals.waterScope')));
 assert.ok(text(detail).includes(i18n.t('recommendations.water.drinkingFluidsEstimate')));
 assert.equal(elements(detail).filter(e=>e.type==='Modal').length,1);
 button(detail,i18n.t('common.done')).props.onPress();
 assert.equal(elements(s.render()).filter(e=>e.type==='Modal').length,0);
 assert.equal(s.stats().applied,0);assert.equal(s.stats().manual.length,0);s.f.unmount();
});
test('water applies only after its separate, unchecked-by-default confirmation',async()=>{
 const s=setup(),i18n=s.f.load('src/i18n/index').default;await i18n.changeLanguage('vi');
 const open=()=>button(s.render(),'Áp dụng 2.250 ml/ngày').props.onPress();
 const confirm=()=>button(s.render(),i18n.t('goals.confirmApply'));
 const acknowledgment=()=>byId(s.render(),'water-goal-acknowledgment');
 open();
 const popup=byId(s.render(),'goal-confirmation');
 assert.ok(text(popup).includes('Áp dụng mục tiêu nước uống?'));
 assert.ok(text(popup).includes(i18n.t('goals.waterConfirmGuidance')));
 assert.ok(text(byId(popup,'goal-change-daily_water_ml')).includes('2.000 ml/ngày'));
 assert.ok(text(byId(popup,'goal-change-daily_water_ml')).includes('2.250 ml/ngày'));
 assert.equal(elements(popup).filter(e=>e.props.testID?.startsWith('goal-unchanged-')).length,3);
 assert.equal(acknowledgment().props.accessibilityState.checked,false);
 assert.equal(confirm().props.disabled,true);
 await confirm().props.onPress();
 assert.equal(s.stats().applied,0);
 acknowledgment().props.onPress();
 assert.equal(confirm().props.disabled,false);
 button(s.render(),i18n.t('common.cancel')).props.onPress();
 assert.equal(s.stats().applied,0);
 open();
 assert.equal(acknowledgment().props.accessibilityState.checked,false);
 acknowledgment().props.onPress();
 await confirm().props.onPress();
 const [[context,selected,rec,accepted]]=s.stats().applications;
 assert.equal(context.expectedGoal.daily_water_ml,2000);
 assert.deepEqual([...selected],['water']);
 assert.equal(rec.water.recommendedWaterMl,2250);
 assert.equal(accepted,true);
 assert.ok(text(s.render()).includes(i18n.t('goals.saved')));
 s.f.unmount();
});

test('the water card offers manual editing when the goal matches or an estimate cannot be applied',async()=>{
 const s=setup(),i18n=s.f.load('src/i18n/index').default;await i18n.changeLanguage('en');
 const waterCard=()=>byId(s.render(),'recommendation-water');
 s.setSaved({...old,daily_water_ml:2250});
 assert.equal(button(waterCard(),i18n.t('goals.alreadyCurrent')).props.disabled,true);
 s.setSaved(old);
 for(const water of [
  {...estimates.water,status:'missing_data'},
  {...estimates.water,status:'out_of_scope'},
  {...estimates.water,status:'needs_review',reason:'fluid_restriction',explanationKey:'recommendations.water.fluidRestriction'},
  {...estimates.water,status:'needs_review',reason:'unusual_weight'},
  {...estimates.water,recommendedWaterMl:0},
  {...estimates.water,recommendedWaterMl:2250.5},
 ]){
  s.setRecs({...estimates,water});
  const card=waterCard();
  assert.equal(elements(card).some(e=>e.type==='PrimaryButton'),false);
  assert.equal(button(card,i18n.t('goals.editWater')).props.disabled,false);
  if(water.reason==='fluid_restriction')assert.ok(text(card).includes(i18n.t('goals.waterRestrictionShort')));
 }
 assert.equal(s.stats().applied,0);
 s.f.unmount();
});
test('a stale water confirmation refreshes the estimate and requires a new acknowledgment',async()=>{
 const settings={};
 const s=setup(settings),i18n=s.f.load('src/i18n/index').default;
 await i18n.changeLanguage('en');
 const {DataAccessError}=s.f.load('src/lib/dataErrors');
 settings.__applyError=new DataAccessError('CONSTRAINT','goals.recommendationChanged');
 button(s.render(),'Apply 2,250 ml/day').props.onPress();
 byId(s.render(),'water-goal-acknowledgment').props.onPress();
 await button(s.render(),i18n.t('goals.confirmApply')).props.onPress();
 const failed=s.render();
 assert.ok(text(failed).includes(i18n.t('goals.recommendationChanged')));
 assert.equal(button(failed,i18n.t('goals.confirmApply')).props.disabled,true);
 assert.equal(s.stats().retries,1);
 s.setRecs({...estimates,water:{...estimates.water,recommendedWaterMl:2450}});
 button(failed,i18n.t('common.cancel')).props.onPress();
 button(s.render(),'Apply 2,450 ml/day').props.onPress();
 assert.equal(byId(s.render(),'water-goal-acknowledgment').props.accessibilityState.checked,false);
 assert.equal(s.stats().applied,1);
 s.f.unmount();
});
test('independent missing/review/out-of-scope/query-error states do not expose candidates or enable automatic application',async()=>{
 const s=setup(),i18n=s.f.load('src/i18n/index').default;await i18n.changeLanguage('en');
 for(const status of ['missing_data','needs_review','out_of_scope','query_error']){
  s.setRecs({...estimates,calories:{status,reason:status==='needs_review'?'low_energy_estimate':status==='out_of_scope'?'under_18':'required_fields_missing',candidateCalories:9999,recommendedCalories:9999,error:{message:'Network unavailable'}}});
  let tree=s.render();assert.ok(!text(tree).includes('9,999'));assert.ok(text(tree).includes('7,000'));assert.ok(text(tree).includes('2,250'));
  assert.equal(elements(tree).filter(e=>e.props.title?.startsWith('Apply ')&&e.props.title.includes('kcal')).length,0);
  if(status==='missing_data'){button(tree,i18n.t('goals.completeProfile')).props.onPress();assert.equal(s.stats().profiles,1);}
  if(status==='query_error'){await button(tree,i18n.t('common.retry')).props.onPress();assert.equal(s.stats().retries,1);}
 }
 s.setRecs({...estimates,steps:{status:'missing_data',reason:'required_fields_missing',explanationKey:'recommendations.steps.missingData'},water:{status:'needs_review',reason:'unusual_weight',explanationKey:'recommendations.water.reviewWeight',candidateWaterMl:9999}});
 assert.equal(elements(s.render()).filter(e=>e.props.title?.startsWith('Apply ')&&e.props.title.includes('kcal')).length,1);s.f.unmount();
});
test('confirmation shows exact selected fields and preserved fields; opening, cancelling and refreshing never apply',async()=>{
 const s=setup(),i18n=s.f.load('src/i18n/index').default;await i18n.changeLanguage('en');let tree=s.render();
 button(tree,i18n.t('goals.applyEligible')).props.onPress();tree=s.render();assert.equal(s.stats().applied,0);
 const popup=elements(tree).find(e=>e.props.testID==='goal-confirmation');
 assert.ok(text(popup).includes('2,000 kcal/day'));assert.ok(text(popup).includes('1,850 kcal/day'));
 assert.ok(text(popup).includes('8,000 steps/day'));assert.ok(text(popup).includes('7,000 steps/day'));
 assert.ok(text(popup).includes(i18n.t('goals.keptSame')));
 assert.ok(text(popup).includes('2,000 ml/day'));assert.ok(text(popup).includes('8 hr'));assert.ok(!text(popup).includes('480'));
 assert.equal(elements(popup).filter(e=>e.props.testID?.startsWith('goal-unchanged-')).length,2);
 assert.ok(!/Snapshot|baseline/.test(text(popup)));
 button(tree,i18n.t('common.cancel')).props.onPress();tree=s.render();assert.equal(s.stats().applied,0);
 button(tree,i18n.t('goals.applyEligible')).props.onPress();tree=s.render();await button(tree,i18n.t('goals.confirmApply')).props.onPress();tree=s.render();assert.equal(s.stats().applied,1);assert.ok(text(tree).includes(i18n.t('goals.saved')));s.f.unmount();
});
test('manual edit is an explicit patch; reopening sees current saved values and empty goals have no defaults',async()=>{
 const s=setup(),i18n=s.f.load('src/i18n/index').default;await i18n.changeLanguage('en');let tree=s.render();
 button(tree,i18n.t('goals.editManually')).props.onPress();tree=s.render();
 let inputs=elements(tree).filter(e=>e.type==='AppTextInput');inputs.find(e=>e.props.label===i18n.t('fields.daily_calories')).props.onChangeText('2200');tree=s.render();
 await button(tree,i18n.t('settings.saveGoals')).props.onPress();tree=s.render();
 assert.deepEqual({...s.stats().manual[0].changes},{daily_calories:2200});assert.equal(s.stats().manual[0].context.expectedGoal.id,B);
 s.setSaved({...old,id:A,daily_calories:2200});tree=s.render();button(tree,i18n.t('goals.editManually')).props.onPress();tree=s.render();inputs=elements(tree).filter(e=>e.type==='AppTextInput');assert.equal(inputs.find(e=>e.props.label===i18n.t('fields.daily_calories')).props.value,'2200');
 button(tree,i18n.t('common.cancel')).props.onPress();s.setSaved(null);tree=s.render();button(tree,i18n.t('goals.editManually')).props.onPress();tree=s.render();assert.ok(elements(tree).filter(e=>e.type==='AppTextInput').every(e=>e.props.value===''));s.f.unmount();
});
test('a failed confirmation retains the preview, never reports success, and guards repeated taps while saving',async()=>{
 let release;const settings={__applyError:Error('Network unavailable'),__applyWait:new Promise(resolve=>{release=resolve;})};
 const s=setup(settings),i18n=s.f.load('src/i18n/index').default;await i18n.changeLanguage('en');let tree=s.render();
 button(tree,i18n.t('goals.applyEligible')).props.onPress();tree=s.render();const submit=button(tree,i18n.t('goals.confirmApply')).props.onPress;
 const request=submit();tree=s.render();assert.equal(button(tree,i18n.t('goals.confirmApply')).props.loading,true);await submit();assert.equal(s.stats().applied,1);
 release();await request;tree=s.render();assert.ok(button(tree,i18n.t('goals.confirmApply')));assert.ok(!text(tree).includes(i18n.t('goals.saved')));assert.ok(elements(tree).some(e=>e.props.accessibilityRole==='alert'));
 settings.__applyError=null;settings.__applyWait=null;await button(tree,i18n.t('goals.confirmApply')).props.onPress();tree=s.render();assert.ok(text(tree).includes(i18n.t('goals.saved')));s.f.unmount();
});
test('calorie details explain the energy estimates and language changes preserve the open manual draft',async()=>{
 const s=setup(),i18n=s.f.load('src/i18n/index').default;await i18n.changeLanguage('en');let tree=s.render();
 const card=elements(tree).find(e=>e.props.testID==='recommendation-calories');button(card,i18n.t('goals.details')).props.onPress();tree=s.render();assert.ok(text(tree).includes(i18n.t('goals.energyEstimates',{bmr:'1,500',tdee:'2,000'})));
 assert.ok(text(tree).includes(i18n.t('goals.calorieDetails')));
 button(tree,i18n.t('common.done')).props.onPress();tree=s.render();button(tree,i18n.t('goals.editManually')).props.onPress();tree=s.render();elements(tree).filter(e=>e.type==='AppTextInput')[0].props.onChangeText('6000');
 await i18n.changeLanguage('vi');tree=s.render();assert.equal(elements(tree).filter(e=>e.type==='AppTextInput')[0].props.value,'6000');assert.ok(text(tree).includes('Mục tiêu sức khỏe dành cho bạn'));s.f.unmount();
});
test('step details use the calculated amount and explain starting goals versus actual step history',async()=>{
 const s=setup(),i18n=s.f.load('src/i18n/index').default;
 await i18n.changeLanguage('vi');
 const {calculateStepRecommendation}=s.f.load('src/lib/stepRecommendation');
 const {shiftDay}=s.f.load('src/lib/dateUtils');
 const date='2026-11-04';
 const profile={dateOfBirth:'1996-01-01',activityLevel:'lightly_active',weightGoal:'lose_fat_slow'};
 const days=[4300,4500,4800,5000].map((steps,i)=>({date:shiftDay(date,-1-i),steps,source:'device',coverage:'complete'}));
 for(const [history,source,key,amount] of [
  [days.slice(0,2),'goals.startMethod','insufficientHistory','5.000 bước/ngày'],
  [days,'goals.historyMethod','gradualProgression','5.100 bước/ngày'],
 ]){
  s.setRecs({...estimates,steps:calculateStepRecommendation({...profile,history},date)});
  const card=byId(s.render(),'recommendation-steps');
  assert.ok(text(card).includes(i18n.t(source)));
  const explanation=i18n.t('recommendations.steps.'+key);
  assert.ok(!text(card).includes(explanation));
  button(card,i18n.t('goals.details')).props.onPress();
  const modal=elements(s.render()).find(e=>e.type==='Modal');
  assert.ok(text(modal).includes('Vì sao đề xuất '+amount+'?'));
  assert.ok(text(modal).includes(explanation));
  assert.ok(text(modal).includes(i18n.t('goals.stepDetailsNotice')));
  button(modal,i18n.t('common.done')).props.onPress();
 }
 s.f.unmount();
});
test('responsive cards and scrollable confirmation use themed surfaces on small phones in both modes',async()=>{
 let dark=false;const themeLoad=require('./load-ts.cjs')({react:{...require('react'),useContext:()=>({isDark:dark}),useMemo:fn=>fn()},'@react-native-async-storage/async-storage':{},'react-native':{StyleSheet:{create:x=>x,flatten:x=>x}}});
 const theme=themeLoad('src/contexts/ThemeContext'),colors=themeLoad('src/constants/colors');
 const s=setup({__dimensions:{width:320,height:700},[boundary('src/contexts/ThemeContext.tsx')]:theme});let tree=s.render(),card=elements(tree).find(e=>e.props.testID==='recommendation-calories');assert.equal(card.props.style[1].width,'100%');assert.equal(card.props.style[0].backgroundColor,colors.LightColors.surface);
 const i18n=s.f.load('src/i18n/index').default;await i18n.changeLanguage('vi');
 tree=s.render();button(tree,'Áp dụng 2.250 ml/ngày').props.onPress();tree=s.render();
 let dialog=elements(tree).find(e=>e.props.testID==='goal-confirmation');
 assert.equal(dialog.props.style.width,'100%');assert.equal(dialog.props.style.maxHeight,'90%');assert.equal(dialog.props.style.backgroundColor,colors.LightColors.surface);
 const scroll=elements(dialog).find(e=>e.type==='ScrollView');assert.equal(scroll.props.style.flexShrink,1);
 assert.ok(byId(scroll,'water-goal-acknowledgment'));
 assert.equal(button(scroll,i18n.t('goals.confirmApply')),undefined);assert.ok(button(dialog,i18n.t('goals.confirmApply')));
 dark=true;tree=s.render();card=elements(tree).find(e=>e.props.testID==='recommendation-calories');assert.equal(card.props.style[0].backgroundColor,colors.DarkColors.surface);
 dialog=elements(tree).find(e=>e.props.testID==='goal-confirmation');assert.equal(dialog.props.style.backgroundColor,colors.DarkColors.surface);s.f.unmount();
 const wide=setup({__dimensions:{width:1280,height:900}});card=elements(wide.render()).find(e=>e.props.testID==='recommendation-calories');assert.equal(card.props.style[1].width,'31.8%');assert.equal(card.props.style[1].minWidth,240);wide.f.unmount();
});

test('low-goal notes are advisory, use saved values, and do not block or rewrite manual entries',async()=>{
 const s=setup(),i18n=s.f.load('src/i18n/index').default;await i18n.changeLanguage('vi');
 const low=Object.freeze({...old,daily_calories:910,daily_steps:650,target_sleep_minutes:455});s.setSaved(low);
 let tree=s.render();assert.ok(text(tree).includes(i18n.t('goals.lowTargetShort.calories')));assert.ok(text(tree).includes(i18n.t('goals.lowTargetShort.steps')));
 assert.ok(!text(tree).includes(i18n.t('goals.advisoryContext')));assert.equal(s.stats().manual.length,0);assert.equal(s.stats().applied,0);
 button(tree,i18n.t('goals.editManually')).props.onPress();tree=s.render();
 const input=elements(tree).find(e=>e.type==='AppTextInput'&&e.props.label===i18n.t('fields.daily_calories'));
 assert.ok(text(tree).includes(i18n.t('goals.advisoryContext')));
 input.props.onChangeText('930');tree=s.render();assert.ok(text(tree).includes('7 giờ 35 phút'));
 await button(tree,i18n.t('settings.saveGoals')).props.onPress();
 assert.deepEqual({...s.stats().manual[0].changes},{daily_calories:930});assert.equal(low.daily_calories,910);s.f.unmount();
});

test('confirmation keeps captured values and localizes full units, sleep and date in both languages',async()=>{
 const s=setup(),i18n=s.f.load('src/i18n/index').default;await i18n.changeLanguage('vi');
 s.setSaved({...old,daily_water_ml:2175,target_sleep_minutes:451});let tree=s.render();
 button(tree,i18n.t('goals.applyEligible')).props.onPress();s.setSaved({...old,daily_water_ml:3020});tree=s.render();
 let popup=elements(tree).find(e=>e.props.testID==='goal-confirmation');assert.ok(text(popup).includes('2.175 ml/ngày'));assert.ok(text(popup).includes('7 giờ 31 phút'));assert.ok(!text(popup).includes('3.020'));
 const date=s.f.load('src/lib/dateUtils').toLocalDateKey(),formatting=s.f.load('src/i18n/formatting');assert.ok(text(popup).includes(formatting.formatDate(date)));
 await i18n.changeLanguage('en');tree=s.render();popup=elements(tree).find(e=>e.props.testID==='goal-confirmation');
 assert.ok(text(popup).includes('2,175 ml/day'));assert.ok(text(popup).includes('7h 31m'));assert.ok(text(popup).includes(formatting.formatDate(date)));s.f.unmount();
});
test('account changes remount the connected section and discard open confirmation and edit state',async()=>{
 const s=setup(),Section=s.f.load('src/components/health/HealthRecommendationsSection').HealthRecommendationsSection,i18n=s.f.load('src/i18n/index').default;await i18n.changeLanguage('en');
 const render=()=>s.f.renderDeep(()=>Section({}));let tree=render();button(tree,i18n.t('goals.applyEligible')).props.onPress();tree=render();assert.ok(button(tree,i18n.t('goals.confirmApply')));
 s.setOwner(B);s.setSaved({...old,user_id:B,daily_calories:2200});tree=render();assert.equal(button(tree,i18n.t('goals.confirmApply')),undefined);assert.ok(text(tree).includes('2,200'));assert.equal(s.stats().applied,0);s.f.unmount();
});
test('Profile modal retains new preference selections, supports legacy NULL values and sends only edits',async()=>{
 let captured;const f=uiFixture({[boundary('src/components/common/AppTextInput.tsx')]:{AppTextInput:'AppTextInput'}}),Modal=f.load('src/components/profile/ProfileEditModals').PersonalProfileModal;
 const initial={fullName:'Lan',dateOfBirth:'1996-01-01',gender:'female',heightCm:'160',weightKg:'55',activityLevel:'',weightGoal:''};
 const render=()=>f.renderDeep(()=>Modal({visible:true,initial,onClose(){},onSave:async draft=>{captured=draft;}}));let tree=render();
 const radios=()=>elements(tree).filter(e=>e.props.accessibilityRole==='radio');assert.ok(radios().slice(-10).every(e=>!e.props.accessibilityState.checked));
 const preferenceRadios=radios().slice(-10);preferenceRadios[3].props.onPress();tree=render();radios().slice(-10)[8].props.onPress();tree=render();
 const i18n=f.load('src/i18n/index').default;await button(tree,i18n.t('common.save')).props.onPress();assert.equal(captured.activityLevel,'very_active');assert.equal(captured.weightGoal,'gain_weight_slow');
 const edits=f.load('src/lib/profileHealthEditing').personalHealthEdits(initial,captured);assert.deepEqual({...edits.patch},{activity_level:'very_active',weight_goal:'gain_weight_slow'});f.unmount();
});

test('Profile back closes a clean form and offers to keep editing or discard a changed draft', async () => {
 const f = uiFixture({ [boundary('src/components/common/AppTextInput.tsx')]: { AppTextInput: 'AppTextInput' } });
 const { PersonalProfileModal } = f.load('src/components/profile/ProfileEditModals');
 const { default: i18n } = f.load('src/i18n/index');
 await i18n.changeLanguage('vi');
 const initial = { fullName: 'Lan', dateOfBirth: '1996-01-01', gender: 'female', heightCm: '160', weightKg: '55', activityLevel: '', weightGoal: '' };
 let closed = 0;
 const render = () => f.renderDeep(() => PersonalProfileModal({
  visible: true, initial, onClose: () => { closed++; }, onSave: async () => assert.fail('Unexpected save'),
 }));
 const back = () => elements(render()).find(e => e.props.accessibilityLabel === i18n.t('profile.back')).props.onPress();
 back();
 assert.equal(closed, 1);
 elements(render()).filter(e => e.props.accessibilityRole === 'radio').at(-7).props.onPress();
 back();
 assert.equal(closed, 1);
 assert.ok(text(render()).includes(i18n.t('profile.saveChangesPrompt')));
 button(render(), i18n.t('profile.keepEditing')).props.onPress();
 assert.equal(button(render(), i18n.t('profile.saveAndBack')), undefined);
 assert.equal(elements(render()).filter(e => e.props.accessibilityRole === 'radio').at(-7).props.accessibilityState.checked, true);
 elements(render()).find(e => e.type === 'Modal').props.onRequestClose();
 button(render(), i18n.t('profile.discardChanges')).props.onPress();
 assert.equal(closed, 2);
 f.unmount();
});

test('Profile save and back retains the edited draft if saving fails', async () => {
 const f = uiFixture({ [boundary('src/components/common/AppTextInput.tsx')]: { AppTextInput: 'AppTextInput' } });
 const { PersonalProfileModal } = f.load('src/components/profile/ProfileEditModals');
 const { default: i18n } = f.load('src/i18n/index');
 const initial = { fullName: 'Lan', dateOfBirth: '1996-01-01', gender: 'female', heightCm: '160', weightKg: '55', activityLevel: 'sedentary', weightGoal: '' };
 let closed = 0, captured, offline = true;
 const render = () => f.renderDeep(() => PersonalProfileModal({
  visible: true, initial, onClose: () => { closed++; }, onSave: async draft => {
   if (offline) throw Error('Network unavailable');
   captured = draft;
  },
 }));
 elements(render()).find(e => e.type === 'AppTextInput').props.onChangeText('Lan Anh');
 elements(render()).find(e => e.props.accessibilityLabel === i18n.t('profile.back')).props.onPress();
 await button(render(), i18n.t('profile.saveAndBack')).props.onPress();
 assert.equal(closed, 0);
 const dialog = elements(render()).find(e => e.props.accessibilityViewIsModal);
 assert.ok(elements(dialog).some(e => e.props.accessibilityRole === 'alert'));
 offline = false;
 await button(render(), i18n.t('profile.saveAndBack')).props.onPress();
 assert.equal(captured.fullName, 'Lan Anh');
 assert.equal(closed, 1);
 f.unmount();
});
