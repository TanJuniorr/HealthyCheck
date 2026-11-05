const {test}=require('node:test'),assert=require('node:assert/strict');
const load=require('./load-ts.cjs')(),initial=load('src/lib/initialHealthGoals').initialHealthGoals;
const calories=load('src/lib/calorieRecommendation').calculateCalorieRecommendation;
const input={date_of_birth:'1996-11-05',gender:'male',height_cm:170,weight_kg:65,activity_level:'sedentary',weight_goal:'maintain'};
const today='2026-11-05';
test('initial goals reuse the recommendation policy for every activity and weight goal',()=>{
 for(const [activity_level,steps] of [['sedentary',4000],['lightly_active',5000],['moderately_active',7000],['very_active',8000],['extremely_active',9000]]){
  for(const weight_goal of ['lose_fat_slow','lose_fat','maintain','gain_weight_slow','gain_weight']){
   const result=initial({...input,activity_level,weight_goal},today);
   const expected=calories({dateOfBirth:input.date_of_birth,gender:input.gender,heightCm:170,weightKg:65,activityLevel:activity_level,weightGoal:weight_goal},today);
   assert.equal(result.daily_steps,steps);assert.equal(result.daily_calories,Math.round(expected.recommendedCalories));
  }
 }
 assert.equal(initial(input,today).daily_calories,1881);
 assert.equal(initial({...input,date_of_birth:'1966-11-05',activity_level:'extremely_active'},today).daily_steps,8000);
});
test('unsupported calorie estimates remain unset while eligible step goals still apply',()=>{
 for(const gender of ['other','prefer_not_to_say']){
  assert.deepEqual({...initial({...input,gender},today)},{daily_steps:4000,daily_calories:null});
 }
 assert.equal(initial({...input,weight_kg:45,weight_goal:'lose_fat'},today).daily_calories,null);
 assert.deepEqual({...initial({...input,date_of_birth:'2010-01-01'},today)},{daily_steps:null,daily_calories:null});
});
