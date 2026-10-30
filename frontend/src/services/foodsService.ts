import { supabase } from '../lib/supabase';
import type { FoodRow } from '../types/database';
import { validId, normalizeRow, normalizePagination } from '../lib/dataValidation';
import { filterFoods } from '../lib/foodPortions';
import { columns, queryResult, readPages, type HistoryOptions } from './queryCore';
export { calculateFoodNutrition, getFoodServingGrams } from '../lib/healthCalculations';
export type FoodOptions = HistoryOptions & { search?: string; category?: string };
export async function getAllFoods(options: FoodOptions = {}) {
 const pagination=normalizePagination(options);
 const matches=filterFoods(await readFoodCatalogue(),options.search ?? '',options.category ?? null);
 return {data:matches.slice(pagination.from,pagination.from+pagination.pageSize),page:pagination.page,
  pageSize:pagination.pageSize,total:matches.length,hasMore:pagination.from+pagination.pageSize<matches.length};
}
export const searchFoods = (search: string, options: FoodOptions = {}) => getAllFoods({ ...options, search });
export const getFoodsByCategory = (category: string, options: FoodOptions = {}) => getAllFoods({ ...options, category });
export async function getFoodById(id: string) { validId(id); const row = await queryResult(supabase.from('foods').select(columns.foods).eq('id',id).maybeSingle()); return row ? normalizeRow('foods',row) : null; }
export async function getFoodCategories() {
 return [...new Set((await readFoodCatalogue()).map(row => row.category).filter((category): category is string => Boolean(category)))].sort();
}
// The shared public catalogue contains no account data. Historical lookups above stay unfiltered.
let cached: {foods: FoodRow[]; expires: number} | null = null;
let pending: Promise<FoodRow[]> | null = null;
async function loadCatalogue(): Promise<FoodRow[]> {
 return (await readPages((from,to) => supabase.from('foods').select(columns.foods, { count: 'exact' }).order('name').order('id').range(from,to), { pageSize: 200 }, true)).data.map(row => normalizeRow('foods',row));
}
export async function readFoodCatalogue(): Promise<FoodRow[]> {
 if(cached && cached.expires>Date.now())return filterFoods(cached.foods,'',null);
 if(!pending)pending=loadCatalogue();
 const request=pending;
 try {const foods=await request;cached={foods,expires:Date.now()+60000};return filterFoods(foods,'',null);}
 finally {if(pending===request)pending=null;}
}
