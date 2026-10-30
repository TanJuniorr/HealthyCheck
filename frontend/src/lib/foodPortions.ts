import type { FoodRow } from '../types/database';
export const FOOD_GROUPS = ['meat','grains','vegetables','fruits','dairy_legumes','seasonings','prepared','beverages'] as const;
export type FoodGroup = typeof FOOD_GROUPS[number];
export type PortionUnit = 'g' | 'piece';
export function normalizeFoodSearch(value: string) {
 return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/gi,'d').toLowerCase().trim();
}
export function foodName(food: FoodRow, language: string) {
 return (language.startsWith('vi') ? food.catalog_metadata?.name_vi : food.catalog_metadata?.name_en ?? legacyNames[food.name]) || food.name;
}
// Exact labels from the original catalogue; these do not assert a USDA source or portion weight.
const legacyNames: Record<string,string> = {
 'Bánh mì':'Bread','Cá hồi chín':'Cooked salmon','Cam':'Orange','Chuối':'Banana',
 'Cơm trắng':'Cooked white rice','Đậu hũ':'Tofu','Hạnh nhân':'Almonds',
 'Khoai lang luộc':'Boiled sweet potato','Rau cải luộc':'Boiled mustard greens',
 'Sữa chua không đường':'Plain yogurt','Sữa tươi không đường':'Unsweetened milk',
 'Táo':'Apple','Trứng gà luộc':'Boiled chicken egg','Ức gà chín':'Cooked chicken breast','Yến mạch khô':'Dry oats',
};
const legacyGroups: Record<string,FoodGroup> = { Protein:'meat',Grains:'grains',Vegetables:'vegetables',Fruit:'fruits',Dairy:'dairy_legumes',Nuts:'dairy_legumes' };
export function foodGroup(food: FoodRow): FoodGroup | null {
 if (!food.catalog_metadata?.group && ['Đậu hũ','Trứng gà luộc'].includes(food.name)) return 'dairy_legumes';
 const value = food.catalog_metadata?.group ?? food.category;
 return FOOD_GROUPS.includes(value as FoodGroup) ? value as FoodGroup : legacyGroups[value ?? ''] ?? null;
}
function nameWords(value: string): string[] {
 return value.normalize('NFC').toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}
function foodNames(food: FoodRow): string[][] {
 return [...new Set([food.name,food.catalog_metadata?.name_vi,food.catalog_metadata?.name_en,
  legacyNames[food.name],...(food.catalog_metadata?.aliases ?? [])].filter((name): name is string => typeof name === 'string' && Boolean(name.trim())))].map(nameWords);
}
// Each query word must occur in order. Only the final word may be a prefix;
// a short single word (notably "cá") must match a complete word.
function nameRank(name: string[], query: string[], folded: boolean): number | null {
 const matches = (word: string, index: number, prefix = false) => {
  const wanted = query[index];
  // A typed accent remains significant, including in a partially accented query.
  const fold = folded && normalizeFoodSearch(wanted) === wanted;
  const actual = fold ? normalizeFoodSearch(word) : word;
  const expected = fold ? normalizeFoodSearch(wanted) : wanted;
  return actual === expected || (prefix && actual.startsWith(expected));
 };
 if (name.length === query.length && query.every((_,index) => matches(name[index],index))) return 0;
 for (let start=0;start<=name.length-query.length;start++) {
  if(query.every((_,index)=>matches(name[start+index],index))) return start === 0 ? 1 : 2;
 }
 const ordered = (prefix: boolean) => {
  let index=0;
  for(const word of name) {
   if(matches(word,index,prefix && index === query.length-1))index++;
   if(index===query.length)return true;
  }
  return false;
 };
 if(ordered(false))return 3;
 const last=query[query.length-1];
 if(last.length >= (query.length===1 ? 3 : 2) && ordered(true))return 4;
 return null;
}
/** One ranked name search for the screen and service. Categories remain independent. */
export function filterFoods(foods: FoodRow[], search: string, category: string | null) {
 const group = category ? legacyGroups[category] ?? category : null;
 const candidates = foods.filter(food => food.catalog_metadata?.selectable !== false &&
  (!group || (FOOD_GROUPS.includes(group as FoodGroup) ? foodGroup(food) === group : food.category === group)));
 if(!search.trim())return candidates;
 const query=nameWords(search);
 if(!query.length)return [];
 const ranked=candidates.map((food,index)=>{
  const names=foodNames(food);
  const rank=(folded:boolean)=>names.reduce<number|null>((best,name)=>{
   const value=nameRank(name,query,folded);
   return value===null ? best : best===null ? value : Math.min(best,value);
  },null);
  return {food,index,exact:rank(false),folded:rank(true)};
 });
 const accented = normalizeFoodSearch(search.normalize('NFC').toLowerCase()) !== search.normalize('NFC').toLowerCase().trim();
 const strictOnly = accented && ranked.some(item=>item.exact!==null);
 return ranked.map(item=>({...item,score:item.exact ?? (!strictOnly && item.folded!==null ? 10+item.folded : null)}))
  .filter((item): item is typeof item & {score:number}=>item.score!==null)
  .sort((a,b)=>a.score-b.score || a.index-b.index).map(item=>item.food);
}
export function pieceWeight(food: FoodRow): number | null {
 const data = food.catalog_metadata;
 const grams = data?.unit_weight_g;
 return data?.source_id && data.portion_source_id && typeof grams === 'number' && Number.isFinite(grams) && grams > 0 ? grams : null;
}
// Accept either decimal separator, never thousands separators, signs or exponent notation.
export function parsePortion(value: string): number | null {
 if (!/^(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(value.trim())) return null;
 const result = Number(value.trim().replace(',','.'));
 return Number.isFinite(result) && result > 0 ? result : null;
}
export function portionGrams(food: FoodRow, value: string, unit: PortionUnit): number | null {
 const amount = parsePortion(value), weight = unit === 'g' ? 1 : pieceWeight(food);
 if (amount === null || weight === null) return null;
 const grams = amount * weight;
 return Number.isFinite(grams) && grams > 0 ? grams : null;
}
// Canonical grams are retained in state; this string is only an input representation.
export function portionText(food: FoodRow, grams: number, unit: PortionUnit): string {
 return String(grams / (unit === 'g' ? 1 : pieceWeight(food) ?? 1));
}
