const {test}=require('node:test'),assert=require('node:assert/strict');
const load=require('./load-ts.cjs')(),editing=load('src/lib/healthGoalEditing'),personal=load('src/lib/profileHealthEditing');
test('only successful estimates are applicable and water requires its own acknowledgment',()=>{
 const recommendations={calories:{status:'success',recommendedCalories:1850.4},steps:{status:'success',recommendedSteps:7000},water:{status:'success',recommendedWaterMl:2250,limitations:{canApplyDirectlyToWaterOnlyGoal:false}}};
 assert.deepEqual({...editing.applicableGoalChanges(['calories'],recommendations)},{daily_calories:1850});
 assert.deepEqual({...editing.applicableGoalChanges(['calories','steps'],recommendations)},{daily_calories:1850,daily_steps:7000});
 assert.deepEqual({...editing.applicableGoalChanges(['water'],recommendations,true)},{daily_water_ml:2250});
 assert.throws(()=>editing.applicableGoalChanges(['water'],recommendations),e=>e.message==='goals.waterConfirmationRequired');
 assert.throws(()=>editing.applicableGoalChanges(['water','steps'],recommendations,true),e=>e.message==='goals.waterConfirmationRequired');
 for(const selected of [['unknown'],[],['calories','calories']])assert.throws(()=>editing.applicableGoalChanges(selected,recommendations),e=>e.message==='goals.notApplicable');
 for(const status of ['missing_data','needs_review','out_of_scope','query_error']){
  const unsafe={status,candidateCalories:1800,recommendedCalories:1800};assert.equal(editing.recommendationValue('calories',unsafe),null);
  assert.throws(()=>editing.applicableGoalChanges(['calories'],{...recommendations,calories:unsafe}));
 }
 assert.throws(()=>editing.applicableGoalChanges(['water'],{
  ...recommendations,water:{...recommendations.water,fluidRestrictionAssessment:'reported_required'},
 },true),e=>e.message==='goals.notApplicable');
});
test('manual changes validate whole positive values and never invent a complete snapshot',()=>{
 assert.equal(editing.goalValues(null),null);
 assert.deepEqual({...editing.validateGoalChanges({daily_calories:2200})},{daily_calories:2200});
 for(const changes of [{},{daily_steps:0},{daily_water_ml:1.5},{daily_calories:'2000'},{target_sleep_minutes:Infinity},{daily_steps:2147483648},{user_id:'spoof'}])assert.throws(()=>editing.validateGoalChanges(changes));
});
const initial={fullName:'Lan',dateOfBirth:'1996-01-01',gender:'female',heightCm:'160',weightKg:'55',activityLevel:'sedentary',weightGoal:'maintain'};
test('preference edits patch only the changed preference and do not rewrite birth date, gender, body values or goals',()=>{
 const activity=personal.personalHealthEdits(initial,{...initial,activityLevel:'very_active'});
 assert.deepEqual({...activity.patch},{activity_level:'very_active'});assert.equal(activity.weightKg,null);
 const goal=personal.personalHealthEdits(initial,{...initial,weightGoal:'gain_weight_slow'});assert.deepEqual({...goal.patch},{weight_goal:'gain_weight_slow'});
 assert.deepEqual({...personal.personalHealthEdits(initial,{...initial}).patch},{});
});
test('old NULL preferences can be completed independently without completing onboarding again',()=>{
 const legacy={...initial,dateOfBirth:'',gender:'',heightCm:'',weightKg:'',activityLevel:'',weightGoal:''};
 const result=personal.personalHealthEdits(legacy,{...legacy,activityLevel:'lightly_active'});
 assert.deepEqual({...result.patch},{activity_level:'lightly_active'});assert.equal(result.weightKg,null);
});
test('latest weight changes preserve other profile fields, normalize decimals, and do not duplicate equivalent readings',()=>{
 const changed=personal.personalHealthEdits(initial,{...initial,weightKg:'56,25'});assert.equal(changed.weightKg,56.25);assert.deepEqual({...changed.patch},{});
 assert.equal(personal.personalHealthEdits(initial,{...initial,weightKg:'55.0'}).weightKg,null);
 for(const weightKg of ['0','NaN','501','0.001'])assert.throws(()=>personal.personalHealthEdits(initial,{...initial,weightKg}));
 assert.throws(()=>personal.personalHealthEdits(initial,{...initial,heightCm:'0'}));
});
