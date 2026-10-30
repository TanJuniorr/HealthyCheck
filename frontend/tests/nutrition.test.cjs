/* global __dirname */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const load=require('./load-ts.cjs')();
const portions=load('src/lib/foodPortions'),calc=load('src/lib/healthCalculations');
const seed=require('../../supabase/seeds/nutrition_usda.json');
const foods=seed.foods.map((food,index)=>({...food,id:String(index)}));
const bySource=id=>foods.find(food=>food.catalog_metadata.source_id==='usda-sr:'+id);
const banana=bySource('173944'),chicken=bySource('171477'),oil=bySource('171413');
const {uiFixture,elements}=require('./ui-fixture.cjs');
const boundary=(name)=>path.resolve(__dirname,'../'+name);
test('accent-insensitive food search, explicit bilingual labels and all eight category filters',()=>{
 for(const query of ['Chuối','chuoi','CHUOI']) assert.ok(portions.filterFoods(foods,query,null).includes(banana));
 assert.ok(portions.filterFoods(foods,'banana','fruits').includes(banana));
 assert.equal(portions.filterFoods(foods,'banana','meat').length,0);
 assert.equal(portions.filterFoods(foods,'no-such-food',null).length,0);
 for(const group of portions.FOOD_GROUPS){const rows=portions.filterFoods(foods,'',group);assert.ok(rows.length>0);assert.ok(rows.every(food=>portions.foodGroup(food)===group));}
 assert.equal(portions.foodName(banana,'en'),banana.catalog_metadata.name_en);assert.equal(portions.foodName(banana,'vi'),banana.name);
 assert.equal(portions.foodName({name:'Trứng gà luộc',category:'Protein',catalog_metadata:{name_en:'Boiled chicken egg',group:'dairy_legumes'}},'en'),'Boiled chicken egg');
 assert.equal(portions.foodGroup({name:'Trứng gà luộc',category:'Protein',catalog_metadata:{group:'dairy_legumes'}}),'dairy_legumes');
});

test('Vietnamese fish search respects accents and whole-word boundaries, never serving/category text',()=>{
 const salmon=bySource('175168'),extras=[
  {name:'Bánh mì nguyên cám',category:'cá',serving_size:'1 cá'},
  {name:'Bắp cải sống',category:'meat',serving_size:'cá hồi'},
  {name:'Bơ quả tươi',category:'cá'},
  {name:'Cà chua',category:'vegetables'},
  {name:'Bí ngòi cả vỏ sống',category:'vegetables'},
 ];
 const catalogue=[...foods,...extras];
 for(const query of ['cá','CÁ','ca\u0301']){
  const result=portions.filterFoods(catalogue,query,null);
  assert.ok(result.includes(salmon));assert.ok(result.length>0);
  assert.ok(result.every(food=>/(?:^|\s)cá(?:\s|$)/iu.test(food.name)));
  assert.ok(extras.every(food=>!result.includes(food)));
 }
 assert.deepEqual(portions.filterFoods([{name:'Cà chua'},{name:'Cải xanh'},{name:'Cám gạo'}],'cá',null),[]);
 for(const query of ['ca hoi','cá hồi','CÁ HỒI','ca hồi','cá hoi'])assert.ok(portions.filterFoods(catalogue,query,null).includes(salmon));
 for(const query of ['ức gà','uc ga','ỨC GÀ'])assert.ok(portions.filterFoods(catalogue,query,null).includes(chicken));
 for(const query of ['thịt bò','thit bo'])assert.ok(portions.filterFoods(catalogue,query,null).includes(bySource('174030')));
 assert.ok(portions.filterFoods(catalogue,'trứng gà',null).includes(bySource('173424')));
 assert.equal(portions.filterFoods(catalogue,'cá','fruits').length,0);
 assert.ok(portions.filterFoods(catalogue,'ca hoi','meat').includes(salmon));
 assert.deepEqual(portions.filterFoods(catalogue,'   ','fruits'),portions.filterFoods(catalogue,'','fruits'));
});

test('food search ranks exact names, phrase starts, whole phrases and ordered words before prefixes',()=>{
 const names=['Cá ngon hồi nướng','Canh cá hồi nóng','Cá hồi nướng','Cá hồi','Cá hồi chiên','Cải hồi','Hồi cá'];
 const catalogue=names.map(name=>({name}));
 assert.deepEqual(portions.filterFoods(catalogue,'cá hồi',null).map(food=>food.name),['Cá hồi','Cá hồi nướng','Cá hồi chiên','Canh cá hồi nóng','Cá ngon hồi nướng']);
 assert.deepEqual(portions.filterFoods(catalogue,'ca hoi',null).map(food=>food.name),['Cá hồi','Cá hồi nướng','Cá hồi chiên','Canh cá hồi nóng','Cá ngon hồi nướng']);
 assert.ok(portions.filterFoods(catalogue,'cá hồ',null).some(food=>food.name==='Cá hồi'));
 assert.equal(portions.filterFoods(catalogue,'hồi cá',null)[0].name,'Hồi cá');
 assert.deepEqual(portions.filterFoods([{name:'Cá hồi'},{name:'Ca hoi'}],'cá hồi',null).map(food=>food.name),['Cá hồi']);
 const alias={name:'Tên chính',catalog_metadata:{aliases:['Cá hồi hấp']}};
 assert.deepEqual(portions.filterFoods([alias],'ca hoi',null),[alias]);
 assert.equal(portions.filterFoods(catalogue,'%',null).length,0);
});

test('one selectable boiled chicken egg supports edible grams and verified whole/fractional pieces',()=>{
 const egg=bySource('173424'),raw=bySource('171287'),duck=bySource('172189');
 const legacy={...egg,id:'legacy-egg',name:'Trứng gà luộc',protein_per_100g:12.6,carbs_per_100g:1.1,fat_per_100g:10.6,
  catalog_metadata:{base_unit:'g',selectable:false,selection_source_id:'usda-sr:173424'}};
 const catalogue=[legacy,...foods];
 assert.equal(egg.name,'Trứng gà luộc');assert.equal(egg.catalog_metadata.edible_portion,true);
 assert.equal(portions.filterFoods(catalogue,'trứng gà luộc',null).length,1);
 assert.equal(portions.filterFoods(catalogue,'',null).filter(food=>food.name==='Trứng gà luộc').length,1);
 assert.ok(portions.filterFoods(catalogue,'',null).includes(raw));assert.ok(portions.filterFoods(catalogue,'',null).includes(duck));
 for(const [value,grams] of [['0,5',25],['1',50],['2',100]]){
  assert.equal(portions.portionGrams(egg,value,'piece'),grams);
  assert.deepEqual(calc.calculateFoodNutrition(egg,grams),calc.calculateFoodNutrition(egg,portions.portionGrams(egg,value,'piece')));
  assert.equal(portions.portionText(egg,grams,'g'),String(grams));assert.equal(portions.portionGrams(egg,portions.portionText(egg,grams,'piece'),'piece'),grams);
 }
 assert.equal(calc.calculateFoodNutrition(legacy,100).protein,12.6);assert.equal(calc.calculateFoodNutrition(egg,100).protein,12.58);
 const oldRow={id:'old-meal',food:legacy,quantity_g:150.25,meal_type:'lunch',consumed_at:new Date(2020,9,27,12).toISOString()};
 const before=calc.aggregateNutrition([oldRow],'2020-10-27','2020-10-27');
 portions.filterFoods(catalogue,'trứng gà',null);
 assert.deepEqual(calc.aggregateNutrition([oldRow],'2020-10-27','2020-10-27'),before);assert.equal(oldRow.food.id,'legacy-egg');
 const folder=path.resolve(__dirname,'../../supabase/migrations'),sql=fs.readFileSync(path.join(folder,fs.readdirSync(folder).find(name=>name.endsWith('_expand_curated_vietnam_foods.sql'))),'utf8');
 assert.match(sql,/old_values IS DISTINCT FROM new_values/);assert.doesNotMatch(sql,/\b(?:UPDATE|DELETE FROM|INSERT INTO)\s+public\.meal_records/i);assert.doesNotMatch(sql,/DELETE FROM public\.foods/i);
 const manifest=require('../scripts/nutrition-foods.json');assert.equal(manifest.find(food=>food.fdc_id==='173424').name_vi,egg.name);
});
test('exact fractional grams, half a banana and unit changes preserve per-100g nutrition',()=>{
 const grams=portions.portionGrams(banana,'0,5','piece');assert.equal(grams,59);
 assert.equal(portions.portionGrams(banana,portions.portionText(banana,grams,'g'),'g'),59);
 assert.deepEqual(calc.calculateFoodNutrition(banana,grams),calc.calculateFoodNutrition(banana,59));
 const meat=calc.calculateFoodNutrition(chicken,150);assert.equal(meat.calories,247.5);assert.equal(meat.protein,46.53);
 assert.equal(portions.parsePortion('2,5'),2.5);assert.equal(portions.portionGrams(chicken,'0.123456789','g'),0.123456789);
 for(const value of ['','0','-1','abc','NaN','Infinity','1e2','1,2.3','1 000','--2'])assert.equal(portions.parsePortion(value),null);
 assert.equal(portions.pieceWeight(oil),null);assert.equal(portions.portionGrams(oil,'1','piece'),null);
 assert.equal(portions.pieceWeight({serving_size:'1 fruit (120 g)'}),null);
});

test('verified bread slices and quail eggs use source weights; cooked references retain distinct nutrients and methods',()=>{
 const bread=bySource('172688'),whiteBread=bySource('172818'),quail=bySource('172191');
 assert.equal(portions.pieceWeight(bread),32);assert.equal(portions.pieceWeight(whiteBread),25);assert.equal(portions.pieceWeight(quail),9);
 assert.equal(portions.portionUnitKey(bread),'meals.unitSlice');assert.equal(portions.portionUnitKey(quail),'meals.unitPiece');
 assert.equal(portions.portionGrams(bread,'1,5','piece'),48);assert.equal(portions.portionGrams(quail,'2','piece'),18);
 assert.deepEqual(calc.calculateFoodNutrition(bread,48),calc.calculateFoodNutrition(bread,portions.portionGrams(bread,'1.5','piece')));
 const raw=bySource('175167'),cooked=bySource('175168');
 assert.equal(raw.name,'Cá hồi (sống)');assert.equal(cooked.name,'Cá hồi (chín)');
 assert.equal(raw.catalog_metadata.preparation_state,'raw');assert.equal(cooked.catalog_metadata.preparation_state,'cooked');
 assert.equal(cooked.catalog_metadata.cooked_weight_basis,true);assert.equal(cooked.catalog_metadata.reference_method,'dry_heat');
 assert.notEqual(raw.catalog_metadata.source_id,cooked.catalog_metadata.source_id);
 assert.notEqual(raw.protein_per_100g,cooked.protein_per_100g);
 assert.equal(calc.calculateFoodNutrition(cooked,150).calories,cooked.calories_per_100g*1.5);
});
test('multiple foods and tiny amounts of oils/sauces sum exactly and legacy values remain valid',()=>{
 const fishSauce=bySource('174531'),sugar=bySource('169655');
 const rows=[{food:chicken,quantity_g:150},{food:oil,quantity_g:10},{food:fishSauce,quantity_g:5},{food:sugar,quantity_g:2.5}].map((r,i)=>({...r,id:String(i),meal_type:'lunch',consumed_at:new Date(2020,9,27,12).toISOString()}));
 const summary=calc.aggregateNutrition(rows,'2020-10-27','2020-10-27');
 assert.equal(calc.calculateFoodNutrition(oil,10).calories,88.4);
 const expected=rows.map(row=>calc.calculateFoodNutrition(row.food,row.quantity_g));
 for(const key of ['calories','protein','carbs','fat'])assert.equal(summary[key],expected.reduce((sum,row)=>sum+row[key],0));
 assert.equal(summary.calorieGoal,null);assert.equal(summary.progressPercent,null);
 const old={...chicken,catalog_metadata:null,calories:9999,serving_size:'1 bowl'};
 assert.equal(calc.calculateFoodNutrition(old,150).calories,247.5);
});
test('verified USDA seed has complete nonnegative nutrients, distinct source IDs and non-destructive SQL',()=>{
 assert.ok(foods.length>=100);assert.equal(new Set(foods.map(food=>food.catalog_metadata.source_id)).size,foods.length);
 assert.equal(new Set(foods.map(food=>food.name)).size,foods.length);
 assert.match(seed.archive_sha256,/^[a-f0-9]{64}$/);
 for(const food of foods){assert.ok(food.catalog_metadata.name_en&&food.catalog_metadata.name_vi);assert.equal(food.catalog_metadata.base_unit,'g');for(const key of ['calories','protein','carbs','fat'])assert.ok(Number.isFinite(food[key+'_per_100g'])&&food[key+'_per_100g']>=0);}
 assert.equal(portions.pieceWeight(banana),118);assert.equal(portions.pieceWeight(bySource('171688')),182);assert.equal(portions.pieceWeight(bySource('171287')),50);
 const folder=path.resolve(__dirname,'../../supabase/migrations');const sql=fs.readFileSync(path.join(folder,fs.readdirSync(folder).find(name=>name.endsWith('_expand_curated_vietnam_foods.sql'))),'utf8');
 assert.match(sql,/ON CONFLICT/);assert.match(sql,/Nutrient revision needs manual review/);assert.match(sql,/old_values IS DISTINCT FROM new_values/);assert.doesNotMatch(sql,/UPDATE public\.meal_records|DELETE FROM public\.foods/);assert.ok(foods.every(food=>food.catalog_metadata.source_license==='CC0-1.0'));assert.equal(new Set(foods.map(food=>food.catalog_metadata.selection_key)).size,foods.length);
});
test('portion form previews decimal input, preserves canonical grams while switching and omits unverified piece units',async()=>{
 let saved=null;
 const f=uiFixture({[boundary('src/components/common/AppTextInput.tsx')]:{AppTextInput:'AppTextInput'}});
 const i18n=f.load('src/i18n/index').default;await i18n.changeLanguage('vi');
 const Form=f.load('src/components/health/FoodPortionForm').FoodPortionForm,props={food:banana,grams:100,onSave:grams=>{saved=grams;},onClose(){}};
 const render=()=>f.render(()=>Form(props));let tree=render();
 elements(tree).find(e=>e.type==='TextButton'&&e.props.title===i18n.t('meals.unitPiece')).props.onPress();tree=render();
 elements(tree).find(e=>e.type==='AppTextInput').props.onChangeText('0,5');tree=render();
 elements(tree).find(e=>e.type==='TextButton'&&e.props.title===i18n.t('meals.unitGram')).props.onPress();tree=render();
 assert.equal(elements(tree).find(e=>e.type==='AppTextInput').props.value,'59');
 await i18n.changeLanguage('en');tree=render();assert.equal(elements(tree).find(e=>e.type==='AppTextInput').props.value,'59');
 await elements(tree).find(e=>e.type==='PrimaryButton').props.onPress();assert.equal(saved,59);
 const g=uiFixture({[boundary('src/components/common/AppTextInput.tsx')]:{AppTextInput:'AppTextInput'}}),Other=g.load('src/components/health/FoodPortionForm').FoodPortionForm;
 const other=g.render(()=>Other({...props,food:oil}));assert.equal(elements(other).filter(e=>e.type==='TextButton').length,2);
});
test('invalid quantities cannot submit, failed portion saves retain input and double taps issue one write',async()=>{
 let attempts=0,closed=0,release;
 const f=uiFixture({[boundary('src/components/common/AppTextInput.tsx')]:{AppTextInput:'AppTextInput'}});
 const Form=f.load('src/components/health/FoodPortionForm').FoodPortionForm,props={food:chicken,grams:150,onClose(){closed++;},onSave:async()=>{attempts++;if(attempts===1)throw Error('Network unavailable');await new Promise(resolve=>{release=resolve;});}};
 const render=()=>f.render(()=>Form(props));let tree=render();elements(tree).find(e=>e.type==='AppTextInput').props.onChangeText('0');tree=render();assert.equal(elements(tree).find(e=>e.type==='PrimaryButton').props.disabled,true);await elements(tree).find(e=>e.type==='PrimaryButton').props.onPress();assert.equal(attempts,0);
 elements(tree).find(e=>e.type==='AppTextInput').props.onChangeText('150,25');tree=render();await elements(tree).find(e=>e.type==='PrimaryButton').props.onPress();tree=render();assert.equal(closed,0);assert.equal(elements(tree).find(e=>e.type==='AppTextInput').props.value,'150,25');assert.ok(elements(tree).some(e=>e.props.accessibilityRole==='alert'));
 const submit=elements(tree).find(e=>e.type==='PrimaryButton').props.onPress,request=submit();await submit();assert.equal(attempts,2);assert.equal(closed,0);release();await request;assert.equal(closed,1);
});
test('focused Nutrition, Calories and Dashboard queries refresh only for their owner and unsubscribe on blur',async()=>{
 for(const key of ['nutrition-screen:2020-10-27','nutrition:2020-10-26:2020-11-01','overview:2020-10-27','weekly-overview:2020-10-26','meal-editor:2020-10-27']){
  const focus=[];let value=0,loads=0,owner='account';
  const f=uiFixture({'expo-router':{useFocusEffect:callback=>{if(focus.at(-1)!==callback)focus.push(callback);}},[boundary('src/contexts/AuthContext.tsx')]:{useAuth:()=>({user:owner?{id:owner}:null})},[boundary('src/services/queryCore.ts')]:{assertIdentity:async()=>{}}});
  const useQuery=f.load('src/hooks/useHealthQuery').useHealthQuery,events=f.load('src/lib/healthQueryEvents'),loader=async()=>{loads++;return value;};
  const render=()=>f.render(()=>useQuery(loader,key));render();const blur=focus.at(-1)();await new Promise(resolve=>setImmediate(resolve));
  events.notifyNutritionChanged('other');await new Promise(resolve=>setImmediate(resolve));assert.equal(loads,1);
  value=250;events.notifyNutritionChanged(owner);await new Promise(resolve=>setImmediate(resolve));assert.equal(render().data,250);assert.equal(loads,2);
  owner='another-account';assert.equal(render().data,null);owner=null;assert.equal(render().data,null);
  blur();events.notifyNutritionChanged('account');await new Promise(resolve=>setImmediate(resolve));assert.equal(loads,2);
 }
});
test('macro UI shows consumed grams without inferred goals or progress while real calorie goals remain',async()=>{
 const summary={calories:100,protein:10,carbs:12,fat:3,calorieGoal:2000,progressPercent:5,recordCount:0,byMealType:{breakfast:{calories:0},lunch:{calories:0},dinner:{calories:0},snack:{calories:0}}};
 const f=uiFixture({[boundary('src/services/healthGoalsService.ts')]:{getCurrentGoals:async()=>null},'expo-router':{useRouter:()=>({push(){}})},[boundary('src/hooks/useHealthQuery.ts')]:{useHealthQuery:()=>({data:{rows:[],summary},isLoading:false,error:null,refresh:async()=>{}})},[boundary('src/components/common/AppHeader.tsx')]:{AppHeader:'AppHeader',SectionHeader:'SectionHeader'},[boundary('src/components/common/ScreenContainer.tsx')]:{ScreenContainer:'ScreenContainer'},[boundary('src/components/charts/ProgressRing.tsx')]:{ProgressRing:'ProgressRing',ProgressBar:'ProgressBar'},[boundary('src/services/mealsService.ts')]:{getMealsByDate:async()=>[]}});
 const Screen=f.load('app/health/nutrition').default;
 for(const language of ['en','vi']){const i18n=f.load('src/i18n/index').default;await i18n.changeLanguage(language);const tree=f.render(()=>Screen());assert.equal(elements(tree).filter(e=>e.type==='ProgressBar').length,0);assert.equal(elements(tree).find(e=>e.type==='ProgressRing').props.progress,.05);assert.ok(!JSON.stringify(tree).includes(i18n.t('nutrition.noMacroTarget')));}
});

test('meal editor saves a multi-food cart atomically, keeps old rows separate and confirms deletion',async()=>{
 let updates=[],deletes=[],inserts=[],attempt=0;
 const a={...chicken,id:'chicken'},b={...oil,id:'oil'},stamp=new Date(2020,9,27,8).toISOString();
 const saved=[{id:'row1',food_id:a.id,food:a,quantity_g:100,meal_type:'lunch',consumed_at:stamp},{id:'row2',food_id:a.id,food:a,quantity_g:50,meal_type:'lunch',consumed_at:stamp}];
 const f=uiFixture({
  'expo-router':{useLocalSearchParams:()=>({})},
  [boundary('src/contexts/AuthContext.tsx')]:{useAuth:()=>({user:{id:'account'}})},
  [boundary('src/hooks/useFoodSearch.ts')]:{useFoodSearch:()=>({data:[a,b],isLoading:false,error:null,refresh:async()=>{},loadMore:async()=>{},hasMore:false,loadingMore:false})},
  [boundary('src/hooks/useHealthQuery.ts')]:{useHealthQuery:(_,key)=>({data:key==='food-catalogue'?[a,b]:saved,isLoading:false,error:null,refresh:async()=>{}})},
  [boundary('src/components/common/AppHeader.tsx')]:{AppHeader:'AppHeader'},
  [boundary('src/components/health/FoodPortionForm.tsx')]:{FoodPortionForm:'FoodPortionForm'},
  [boundary('src/services/mealsService.ts')]:{addMealItems:async items=>{inserts.push(items);},updateMealRecord:async(id,patch)=>{updates.push({id,patch});},deleteMealRecord:async id=>{attempt++;if(attempt===1)throw Error('Network unavailable');deletes.push(id);}}
 });
 const i18n=f.load('src/i18n/index').default;await i18n.changeLanguage('en');const Editor=f.load('app/meals/add').MealEditor;
 const render=()=>f.render(()=>Editor({date:'2020-10-27',mealType:'lunch'}));let tree=render();
 const list=()=>elements(tree).find(e=>e.props?.renderItem),header=()=>elements(list().props.ListHeaderComponent);
 assert.equal(header().filter(e=>e.type==='TextButton'&&e.props.title===i18n.t('common.edit')).length,2);
 header().find(e=>e.type==='TextButton'&&e.props.title===i18n.t('common.edit')).props.onPress();tree=render();
 let form=elements(tree).find(e=>e.type==='FoodPortionForm');await form.props.onSave(150.25);form.props.onClose();tree=render();
 assert.equal(updates.length,1);assert.equal(updates[0].id,'row1');assert.equal(updates[0].patch.quantity_g,150.25);assert.equal(deletes.length,0);
 for(const [food,grams] of [[a,150],[b,10]]){
  list().props.renderItem({item:food}).props.onPress();tree=render();form=elements(tree).find(e=>e.type==='FoodPortionForm');await form.props.onSave(grams);form.props.onClose();tree=render();
 }
 await elements(tree).find(e=>e.type==='PrimaryButton').props.onPress();tree=render();
 assert.equal(inserts.length,1);assert.equal(inserts[0].length,2);assert.equal(inserts[0][1].quantity_g,10);assert.ok(inserts[0].every(row=>row.meal_type==='lunch'&&load('src/lib/dateUtils').timestampDateKey(row.consumed_at)==='2020-10-27'));
 assert.equal(updates.length,1);assert.equal(deletes.length,0);
 header().find(e=>e.type==='TextButton'&&e.props.title===i18n.t('common.delete')).props.onPress();tree=render();assert.equal(attempt,0);
 const confirm=()=>elements(tree).find(e=>e.type==='PrimaryButton'&&e.props.title===i18n.t('common.delete'));
 await confirm().props.onPress();tree=render();assert.equal(deletes.length,0);assert.ok(confirm());await confirm().props.onPress();tree=render();assert.equal(deletes[0],'row1');assert.equal(confirm(),undefined);
});
