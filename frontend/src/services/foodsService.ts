import { supabase } from '../lib/supabase';
import { validId, normalizeRow } from '../lib/dataValidation';
import { columns, queryResult, readPages, type HistoryOptions } from './queryCore';
export { calculateFoodNutrition, getFoodServingGrams } from '../lib/healthCalculations';
export type FoodOptions = HistoryOptions & { search?: string; category?: string };
export async function getAllFoods(options: FoodOptions = {}) {
 const page = await readPages((from,to) => {
  let query = supabase.from('foods').select(columns.foods, { count: 'exact' });
  if (options.category) query = query.eq('category', options.category);
  const search = options.search?.trim();
  if (search) query = query.ilike('name', `%${search.replace(/[\\%_]/g, '\\$&')}%`);
  return query.order('name').order('id').range(from,to);
 }, options);
 return { ...page,data:page.data.map(row => normalizeRow('foods',row)) };
}
export const searchFoods = (search: string, options: FoodOptions = {}) => getAllFoods({ ...options, search });
export const getFoodsByCategory = (category: string, options: FoodOptions = {}) => getAllFoods({ ...options, category });
export async function getFoodById(id: string) { validId(id); const row = await queryResult(supabase.from('foods').select(columns.foods).eq('id',id).maybeSingle()); return row ? normalizeRow('foods',row) : null; }
export async function getFoodCategories() {
 const page = await readPages((from,to) => supabase.from('foods').select('id,category', { count: 'exact' }).order('id').range(from,to), { pageSize: 200 }, true);
 return [...new Set(page.data.map(row => row.category).filter((category): category is string => Boolean(category)))].sort();
}
export async function readFoodCatalogue() {
 return (await readPages((from,to) => supabase.from('foods').select(columns.foods, { count: 'exact' }).order('name').order('id').range(from,to), { pageSize: 200 }, true)).data.map(row => normalizeRow('foods',row));
}
