// Compatibility surface; all queries delegate to the feature services.
import type { Inputs, PersonalTable, FoodRow } from '../types/database';
import { readFoodCatalogue } from '../services/foodsService';
import { getMyProfile } from '../services/profileService';
import { getCurrentGoals } from '../services/healthGoalsService';
import { makeRepository } from '../services/queryCore';
import { addMealRecord } from '../services/mealsService';
export type Food = FoodRow;
export type { PersonalTable };
export const fetchFoods = readFoodCatalogue;
export const fetchMyProfile = getMyProfile;
export const fetchMyGoals = getCurrentGoals;
export { getFoodServingGrams } from './healthCalculations';
export { toLocalDateKey } from './dateUtils';
export async function fetchMyRecords<T extends PersonalTable>(table: T) { return (await makeRepository(table).history({ pageSize:200 },true)).data; }
export async function addMyRecord<T extends Exclude<PersonalTable,'health_goals'>>(table: T,payload: Inputs[T]) {
 if (table === 'meal_records') return addMealRecord(payload as Inputs['meal_records']);
 return makeRepository(table).add(payload);
}
