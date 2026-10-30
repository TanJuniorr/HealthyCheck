import { supabase } from '../lib/supabase';
import type { FoodRow } from '../types/database';
import { validId, normalizeRow, normalizePagination } from '../lib/dataValidation';
import { FOOD_GROUPS } from '../lib/foodPortions';
import { DataAccessError } from '../lib/dataErrors';
import { columns, queryResult, type HistoryOptions } from './queryCore';
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
export async function getFoodCategories() {
 return [...FOOD_GROUPS];
}
// Compatibility surface is intentionally bounded. Call getAllFoods for subsequent pages.
export async function readFoodCatalogue(options:FoodOptions={}):Promise<FoodRow[]> {
 return (await getAllFoods({...options,pageSize:options.pageSize??30})).data;
}
