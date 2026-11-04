import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FoodRow } from '../types/database';
import { normalizeFoodSearch } from '../lib/foodPortions';

type IngredientImage = { name: string; url: string };
type CachedIngredientImages = { savedAt: number; items: IngredientImage[] };
type ImageIndex = ReadonlyMap<string, string | null>;

const cacheKey = 'healthy-check:food-image-index:v2';
const cacheLifetime = 30 * 24 * 60 * 60 * 1000;
const retryDelay = 60 * 1000;
const ingredientListUrl = 'https://www.themealdb.com/api/json/v1/1/list.php?i=list';
const ingredientImagePrefix = 'https://www.themealdb.com/images/ingredients/';

// Approved names from TheMealDB's ingredient index, keyed by USDA SR Legacy ID.
// Map only equivalent foods. A raw fillet, dried noodle or fresh fruit is not a
// fallback for a cooked fillet, prepared noodle dish or juice.
const reviewedIngredients: Readonly<Record<string, string>> = {
  '171077': 'Chicken Breast',
  '172390': 'Chicken Wings',
  '175167': 'Salmon',
  '175119': 'Mackerel',
  '171955': 'Cod',
  '174223': 'Squid',
  '170379': 'Broccoli',
  '170393': 'Carrots',
  '170457': 'Tomatoes',
  '168409': 'Cucumber',
  '168448': 'Pumpkin',
  '168462': 'Spinach',
  '169975': 'Cabbage',
  '169228': 'Aubergine',
  '170108': 'Red Pepper',
  '169961': 'Green Beans',
  '170419': 'Peas',
  '168389': 'Asparagus',
  '169988': 'Celery',
  '169291': 'Courgettes',
  '173944': 'Banana',
  '171688': 'Apples',
  '169097': 'Orange',
  '169910': 'Mango',
  '171705': 'Avocado',
  '167762': 'Strawberries',
  '171287': 'Eggs',
  '171265': 'Whole Milk',
  '170845': 'Mozzarella',
  '172476': 'Tofu',
  '172818': 'White bread',
  '172688': 'Wholegrain Bread',
  '173468': 'Salt',
  '169655': 'Granulated Sugar',
  '174531': 'Fish Sauce',
  '174277': 'Soy Sauce',
  '171413': 'Olive Oil',
  '173410': 'Butter',
  '171401': 'Lard',
  '169640': 'Honey',
  '169230': 'Garlic',
  '170000': 'Onions',
  '169231': 'Ginger',
  '171016': 'Sesame Seed Oil',
  '171412': 'Coconut Oil',
  '172470': 'Peanut Butter',
  '172430': 'Peanuts',
  '170567': 'Almonds',
  '171009': 'Mayonnaise',
  '172886': 'Hoisin Sauce',
  '174529': 'Oyster Sauce',
  '172336': 'Canola Oil',
  '170499': 'Shallots',
  '172455': 'Falafel',
};

let imageIndex: { savedAt: number; images: ImageIndex } | null = null;
let pendingIndex: Promise<ImageIndex> | null = null;
let retryAfter = 0;
const emptyIndex: ImageIndex = new Map();

function imageName(value: string) {
  return value.normalize('NFC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

export function getSavedFoodImageUrl(food: FoodRow): string | null {
  const value = food.catalog_metadata?.image_url;
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

function ingredientItem(name: unknown, url: unknown): IngredientImage | null {
  if (typeof name !== 'string' || !imageName(name) || typeof url !== 'string') return null;
  const baseUrl = url.trim().replace(/\/(small|medium|large)$/, '');
  if (!baseUrl.startsWith(ingredientImagePrefix)) return null;
  const file = baseUrl.slice(ingredientImagePrefix.length);
  if (!/^[^/?#]+\.(png|jpe?g|webp)$/i.test(file)) return null;
  try {
    // Detect a catalogue row pointing at a different ingredient.
    if (imageName(decodeURIComponent(file).replace(/\.[^.]+$/, '')) !== imageName(name)) return null;
    return { name, url: baseUrl };
  } catch {
    return null;
  }
}

function indexIngredients(items: IngredientImage[]): ImageIndex {
  const index = new Map<string, string | null>();
  for (const { name, url } of items) {
    const key = imageName(name);
    const previous = index.get(key);
    index.set(key, previous === undefined || previous === url ? url : null);
  }
  return index;
}

async function readCachedImages(): Promise<CachedIngredientImages | null> {
  try {
    const parsed = JSON.parse(await AsyncStorage.getItem(cacheKey) ?? 'null');
    if (!Number.isFinite(parsed?.savedAt) || !Array.isArray(parsed.items)) return null;
    const items = parsed.items.flatMap((item: Partial<IngredientImage> | null) => {
      const match = ingredientItem(item?.name, item?.url);
      return match ? [match] : [];
    });
    return items.length ? { savedAt: parsed.savedAt, items } : null;
  } catch {
    return null;
  }
}

async function loadIngredientImages(): Promise<ImageIndex> {
  const cached = await readCachedImages();
  if (cached) imageIndex = { savedAt: cached.savedAt, images: indexIngredients(cached.items) };
  if (imageIndex && Date.now() - imageIndex.savedAt < cacheLifetime) return imageIndex.images;

  try {
    const response = await fetch(ingredientListUrl);
    if (!response.ok) throw new Error(`Food image catalogue returned ${response.status}`);
    const payload = await response.json() as { meals?: { strIngredient?: unknown; strThumb?: unknown }[] | null };
    const items = (payload.meals ?? []).flatMap(item => {
      const match = ingredientItem(item?.strIngredient, item?.strThumb);
      return match ? [match] : [];
    });
    if (!items.length) throw new Error('Food image catalogue is empty');
    const savedAt = Date.now();
    imageIndex = { savedAt, images: indexIngredients(items) };
    await AsyncStorage.setItem(cacheKey, JSON.stringify({ savedAt, items })).catch(() => {});
    return imageIndex.images;
  } catch {
    retryAfter = Date.now() + retryDelay;
    return imageIndex?.images ?? emptyIndex;
  }
}

function getIngredientImages(): Promise<ImageIndex> {
  if ((imageIndex && Date.now() - imageIndex.savedAt < cacheLifetime) || Date.now() < retryAfter) {
    return Promise.resolve(imageIndex?.images ?? emptyIndex);
  }
  pendingIndex ??= loadIngredientImages().finally(() => { pendingIndex = null; });
  return pendingIndex;
}

export function foodImageNames(food: FoodRow): string[] {
  const metadata = food.catalog_metadata;
  const source = metadata?.canonical_key ?? metadata?.source_id ?? '';
  const id = /^usda-sr:(\d+)$/.exec(source)?.[1];
  const reviewed = id ? reviewedIngredients[id] : undefined;
  const officialNames = [metadata?.name_en, metadata?.name_vi].filter(
    (name): name is string => typeof name === 'string' && Boolean(name.trim()),
  );
  const names = officialNames.length ? officialNames : [food.name];
  const preparation = metadata?.preparation_state;

  const exactNames = names.flatMap(name => {
    const normalized = normalizeFoodSearch(name);
    if (preparation === 'cooked' && !/\b(cooked|boiled|steamed|roasted|braised|simmered|grilled|baked|fried|chin|luoc|hap|nuong|chien|rang|xao)\b/.test(normalized)) return [];
    if (preparation === 'dried' && !/\b(dry|dried|dehydrated|kho|say)\b/.test(normalized)) return [];
    const exact = imageName(name);
    if (preparation === 'raw' || preparation === undefined) {
      const rawName = imageName(name.replace(/,\s*(raw|fresh)$/i, ''));
      return [exact, rawName];
    }
    return [exact];
  });

  // Search aliases may include a parent category or a different preparation.
  // They help find foods in the catalogue but do not establish photo identity.
  return [...new Set([reviewed ? imageName(reviewed) : '', ...exactNames].filter(Boolean))];
}

export async function resolveFoodImageUrl(food: FoodRow): Promise<string | null> {
  const savedUrl = getSavedFoodImageUrl(food);
  if (savedUrl) return savedUrl;
  const names = foodImageNames(food);
  if (!names.length) return null;

  const images = await getIngredientImages();
  for (const name of names) {
    const url = images.get(name);
    if (url) return `${url}/small`;
  }
  return null;
}
