/* global __dirname */
// Read-only smoke check. No sessions, personal records or database writes.
const path = require('node:path');
const { createClient } = require('@supabase/supabase-js');
const createLoader = require('../tests/load-ts.cjs');
async function main() {
 const url=process.env.EXPO_PUBLIC_SUPABASE_URL, key=process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if (!url || !key) { console.error('Missing public Supabase configuration.'); process.exitCode=1; return; }
 const client=createClient(url,key,{ auth:{ persistSession:false,autoRefreshToken:false,detectSessionInUrl:false } });
 const load=createLoader({ [path.resolve(__dirname,'../src/lib/supabase.ts')]:{ supabase:client } });
 try { const page=await load('src/services/foodsService').getAllFoods({ pageSize:1 }); console.log(JSON.stringify({ verified:'bounded food search RPC with service pagination',returnedRows:page.data.length,totalRows:page.total }));
  const foods = load('src/services/foodsService');
  const first=page.data[0];
  if (first) {
   const [item,search,categories,category]=await Promise.all([foods.getFoodById(first.id),foods.searchFoods(first.name,{pageSize:1}),foods.getFoodCategories(),first.category ? foods.getFoodsByCategory(first.category,{pageSize:1}) : Promise.resolve(null)]);
   const nutrition=foods.calculateFoodNutrition(first,100);
   console.log(JSON.stringify({foodById:!!item,searchReturnedRows:search.data.length,categoryCount:categories.length,categoryFilterAccepted:category === null || category.data.length > 0,per100gCalculationFinite:Object.values(nutrition).every(Number.isFinite)}));
  }
  if (process.argv.includes('--schema')) {
   const { columns } = load('src/services/queryCore');
   const checks=await Promise.all(Object.entries(columns).map(async ([table,fields]) => { const select=table==='meal_records' ? `${fields},food:foods(${columns.foods})` : fields; const { error }=await client.from(table).select(select).limit(0); return { table,columnsAndJoinAccepted:!error,...(error?{code:error.code}: {}) }; }));
   console.log(JSON.stringify({ schemaChecks:checks })); if (checks.some(check=>!check.columnsAndJoinAccepted)) process.exitCode=1;
  } }
 catch(error) { console.error(JSON.stringify({ verified:false,code:error.code,message:error.message })); process.exitCode=1; }
}
void main();
