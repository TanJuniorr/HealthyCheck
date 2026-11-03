/* global __dirname */
const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {uiFixture,elements}=require('./ui-fixture.cjs');
const boundary=file=>path.resolve(__dirname,'../'+file),A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const old={id:B,user_id:A,daily_steps:8000,daily_calories:2000,daily_water_ml:2000,target_sleep_minutes:480};
const estimates={calories:{status:'success',recommendedCalories:1850.4,bmr:1500,tdee:2000},steps:{status:'success',recommendedSteps:7000,recommendationMethod:'activity_starting_point',confidence:'low',explanationKey:'recommendations.steps.unverifiedHistory'},water:{status:'success',recommendedWaterMl:2250,explanationKey:'recommendations.water.drinkingFluidsEstimate',limitations:{canApplyDirectlyToWaterOnlyGoal:false}}};
function setup(extra={}){
 let saved=old,recs=estimates,owner=A,loading=false,retries=0,applied=0,manual=[],profiles=0;
 const f=uiFixture({__realRecommendations:true,...extra,
  'expo-router':{router:{push(){profiles++;}}},
  [boundary('src/contexts/AuthContext.tsx')]:{useAuth:()=>({user:{id:owner}})},
  [boundary('src/hooks/healthHooks.ts')]:{useHealthRecommendations:()=>recQuery(),useHealthGoals:()=>goalQuery()},
  [boundary('src/components/common/AppTextInput.tsx')]:{AppTextInput:'AppTextInput'},
  [boundary('src/components/common/DataFeedback.tsx')]:{DataFeedback:'DataFeedback'},
  [boundary('src/services/healthGoalSnapshotService.ts')]:{applyHealthGoalRecommendation:async()=>{applied++;if(extra.__applyWait)await extra.__applyWait;if(extra.__applyError)throw extra.__applyError;return old;},saveManualHealthGoals:async(context,changes)=>{manual.push({context,changes});return old;}},
 });
 const recQuery=()=>({data:recs,isLoading:loading,error:null,refresh:async()=>{retries++;}}),goalQuery=()=>({data:saved,isLoading:false,error:null,refresh:async()=>{}});
 const Panel=f.load('src/components/health/HealthRecommendationsSection').RecommendationPanel;
 const render=()=>f.renderDeep(()=>Panel({query:recQuery(),goalsQuery:goalQuery(),actual:{calories:1200,steps:3500,water:1000}}));
 return {f,render,setSaved:v=>{saved=v;},setRecs:v=>{recs=v;},setOwner:v=>{owner=v;},setLoading:v=>{loading=v;},stats:()=>({retries,applied,manual,profiles}),recQuery,goalQuery};
}
const text=tree=>elements(tree).filter(e=>e.type==='Text').map(e=>e.props.children).flat().filter(v=>typeof v==='string').join(' ');
const button=(tree,title)=>elements(tree).find(e=>e.props.title===title);
test('cards distinguish estimate, saved goal and actual; progress always uses the saved goal and water has no apply action',async()=>{
 const s=setup(),i18n=s.f.load('src/i18n/index').default;await i18n.changeLanguage('en');const tree=s.render();
 for(const kind of ['calories','steps','water'])assert.ok(elements(tree).some(e=>e.props.testID==='recommendation-'+kind));
 assert.ok(text(tree).includes('1,850'));assert.ok(text(tree).includes('2,000'));assert.ok(text(tree).includes('1,200'));
 const bars=elements(tree).filter(e=>e.props.accessibilityRole==='progressbar');assert.equal(bars[0].props.accessibilityValue.now,60);assert.equal(bars[1].props.accessibilityValue.now,43.75);assert.equal(bars[2].props.accessibilityValue.now,50);
 assert.equal(elements(tree).filter(e=>e.props.title?.startsWith('Apply ')&&e.props.title.includes('ml')).length,0);
 assert.ok(text(tree).includes('Drinking fluids and logged water are different scopes'));
 assert.equal(s.stats().applied,0);assert.equal(s.stats().manual.length,0);s.f.unmount();
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
 assert.ok(text(tree).includes('1,850'));assert.ok(text(tree).includes('7,000'));assert.ok(text(tree).includes('Kept unchanged:'));
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
test('low-confidence step details and energy estimates remain explicit; language changes preserve the open manual draft',async()=>{
 const s=setup(),i18n=s.f.load('src/i18n/index').default;await i18n.changeLanguage('en');let tree=s.render();assert.ok(text(tree).includes('Low confidence'));
 const card=elements(tree).find(e=>e.props.testID==='recommendation-calories');button(card,i18n.t('goals.details')).props.onPress();tree=s.render();assert.ok(text(tree).includes('BMR estimate: 1,500'));assert.ok(text(tree).includes('not sensor-measured'));
 button(tree,i18n.t('common.done')).props.onPress();tree=s.render();button(tree,i18n.t('goals.editManually')).props.onPress();tree=s.render();elements(tree).filter(e=>e.type==='AppTextInput')[0].props.onChangeText('6000');
 await i18n.changeLanguage('vi');tree=s.render();assert.equal(elements(tree).filter(e=>e.type==='AppTextInput')[0].props.value,'6000');assert.ok(text(tree).includes('Mục tiêu sức khỏe dành cho bạn'));s.f.unmount();
});
test('responsive cards fit small phones and use themed surfaces in both modes',()=>{
 let dark=false;const themeLoad=require('./load-ts.cjs')({react:{...require('react'),useContext:()=>({isDark:dark}),useMemo:fn=>fn()},'@react-native-async-storage/async-storage':{},'react-native':{StyleSheet:{create:x=>x,flatten:x=>x}}});
 const theme=themeLoad('src/contexts/ThemeContext'),colors=themeLoad('src/constants/colors');
 const s=setup({__dimensions:{width:320,height:700},[boundary('src/contexts/ThemeContext.tsx')]:theme});let tree=s.render(),card=elements(tree).find(e=>e.props.testID==='recommendation-calories');assert.equal(card.props.style[1].width,'100%');assert.equal(card.props.style[0].backgroundColor,colors.LightColors.surface);
 dark=true;tree=s.render();card=elements(tree).find(e=>e.props.testID==='recommendation-calories');assert.equal(card.props.style[0].backgroundColor,colors.DarkColors.surface);s.f.unmount();
 const wide=setup({__dimensions:{width:1280,height:900}});card=elements(wide.render()).find(e=>e.props.testID==='recommendation-calories');assert.equal(card.props.style[1].width,'31.8%');assert.equal(card.props.style[1].minWidth,240);wide.f.unmount();
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
