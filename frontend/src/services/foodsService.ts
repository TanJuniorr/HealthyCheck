import { supabase } from '../lib/supabase';
import type { FoodRow } from '../types/database';
import { validId, normalizeRow, normalizePagination } from '../lib/dataValidation';
import { FOOD_GROUPS } from '../lib/foodPortions';
import { DataAccessError } from '../lib/dataErrors';
import { assertIdentity, columns, queryResult, requireAuthenticatedUserId, type HistoryOptions } from './queryCore';
export { calculateFoodNutrition, getFoodServingGrams } from '../lib/healthCalculations';
export type FoodOptions = HistoryOptions & { search?: string; category?: string };
export async function getAllFoods(options: FoodOptions = {}) {
 const pagination=normalizePagination(options);
 const size=Math.min(pagination.pageSize,100),offset=(pagination.page-1)*size;
 const query=(options.search??'').normalize('NFC').trim();
 if(query.length>160)throw new DataAccessError('INVALID_INPUT','meals.searchTooLong');
 const result=await queryResult(supabase.rpc('search_foods',{p_query:query,p_category:options.category||null,p_offset:offset,p_limit:size}));
 if(!result || !Array.isArray(result.data) || !Number.isSafeInteger(result.total) || result.total<0 || result.data.length>size)throw new DataAccessError('DATABASE','errors.database');
 return {data:result.data.map(row=>normalizeRow('foods',row)),page:pagination.page,pageSize:size,total:result.total,hasMore:offset+result.data.length<result.total};
}
export const searchFoods = (search: string, options: FoodOptions = {}) => getAllFoods({ ...options, search });
export const getFoodsByCategory = (category: string, options: FoodOptions = {}) => getAllFoods({ ...options, category });
export async function getFoodById(id: string) { validId(id); const row = await queryResult(supabase.from('foods').select(columns.foods).eq('id',id).maybeSingle()); return row ? normalizeRow('foods',row) : null; }
export async function createPersonalEstimatedFood(input: {
 name_vi: string; name_en: string; calories_per_100g: number; protein_per_100g: number; carbs_per_100g: number; fat_per_100g: number;
}): Promise<FoodRow> {
 const nameVi=input.name_vi.trim(),nameEn=input.name_en.trim();
 if(!nameVi||!nameEn||nameVi.length>100||nameEn.length>100)throw new DataAccessError('INVALID_INPUT','meals.foodNameRequired');
 const values=[input.calories_per_100g,input.protein_per_100g,input.carbs_per_100g,input.fat_per_100g];
 if(values.some(value=>!Number.isFinite(value)||value<0)||input.calories_per_100g>1000||values.slice(1).some(value=>value>100))throw new DataAccessError('INVALID_INPUT','meals.invalidFoodNutrition');
 const owner=await requireAuthenticatedUserId();
 const row=await queryResult(supabase.from('foods').insert({
  name:nameVi,calories_per_100g:input.calories_per_100g,protein_per_100g:input.protein_per_100g,
  carbs_per_100g:input.carbs_per_100g,fat_per_100g:input.fat_per_100g,category:'prepared',serving_size:'100 g',
  calories:null,protein_g:null,carbs_g:null,fat_g:null,created_by:owner,
  catalog_metadata:{name_vi:nameVi,name_en:nameEn,aliases:[],selectable:true,group:'prepared',source:'ai_food_scan',
   source_description:'AI-estimated nutrition values, editable by the owner.',data_type:'user_ai_estimate',base_unit:'g'},
 }).select(columns.foods).single(),owner);
 if(!row)throw new DataAccessError('DATABASE','errors.database');
 await assertIdentity(owner);
 return normalizeRow('foods',row);
}
export async function getFoodCategories() {
 return [...FOOD_GROUPS];
}
// Compatibility surface is intentionally bounded. Call getAllFoods for subsequent pages.
export async function readFoodCatalogue(options:FoodOptions={}):Promise<FoodRow[]> {
 return (await getAllFoods({...options,pageSize:options.pageSize??30})).data;
}
