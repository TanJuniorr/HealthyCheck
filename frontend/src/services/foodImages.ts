import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FoodRow } from '../types/database';

type IngredientImage = { name: string; url: string };
type CachedIngredientImages = { savedAt: number; items: IngredientImage[] };

const cacheKey = 'healthy-check:food-image-index:v1';
const cacheLifetime = 1000 * 60 * 60 * 24 * 30;
const ingredientListUrl = 'https://www.themealdb.com/api/json/v1/1/list.php?i=list';
const ingredientImagePrefix = 'https://www.themealdb.com/images/ingredients/';
const ignoredWords = new Set([
  'a', 'an', 'and', 'as', 'boiled', 'broiled', 'canned', 'commercially', 'cooked', 'dried',
  'drained', 'enriched', 'fresh', 'fried', 'frozen', 'grilled', 'lean', 'meat', 'only',
  'prepared', 'raw', 'roasted', 'separable', 'steamed', 'to', 'unsweetened', 'without', 'whole',
]);

let ingredientImages: IngredientImage[] | null = null;
let ingredientImagesPromise: Promise<IngredientImage[]> | null = null;

function validImageUrl(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('https://');
}

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLocaleLowerCase('en-US').replace(/[^a-z0-9]+/g, ' ').trim();
}

function tokens(value: string) {
  return normalize(value).split(/\s+/).filter(word => word.length > 1 && !ignoredWords.has(word)).map(word => word.length > 4 && word.endsWith('s') ? word.slice(0, -1) : word);
}

function parseCached(value: string | null): CachedIngredientImages | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<CachedIngredientImages>;
    if (!Number.isFinite(parsed.savedAt) || !Array.isArray(parsed.items)) return null;
    const items = parsed.items.filter((item): item is IngredientImage => Boolean(item)
      && typeof item.name === 'string' && item.name.length > 0 && validImageUrl(item.url)
      && item.url.startsWith(ingredientImagePrefix));
    return items.length ? { savedAt: parsed.savedAt as number, items } : null;
  } catch {
    return null;
  }
}

async function loadIngredientImages(): Promise<IngredientImage[]> {
  let cached: CachedIngredientImages | null = null;
  try {
    cached = parseCached(await AsyncStorage.getItem(cacheKey));
    if (cached && Date.now() - cached.savedAt < cacheLifetime) return cached.items;

    const response = await fetch(ingredientListUrl);
    if (!response.ok) throw new Error(`Food image catalogue returned ${response.status}`);
    const payload = await response.json() as { meals?: { strIngredient?: unknown; strThumb?: unknown }[] | null };
    const items = (payload.meals ?? []).flatMap(item => {
      const name = typeof item.strIngredient === 'string' ? item.strIngredient.trim() : '';
      const url = typeof item.strThumb === 'string' ? item.strThumb.trim() : '';
      return name && url.startsWith(ingredientImagePrefix) ? [{ name, url }] : [];
    });
    if (!items.length) throw new Error('Food image catalogue is empty');
    const value = { savedAt: Date.now(), items };
    ingredientImages = items;
    await AsyncStorage.setItem(cacheKey, JSON.stringify(value)).catch(() => {});
    return items;
  } catch {
    return cached?.items ?? [];
  }
}

function getIngredientImages() {
  if (ingredientImages) return Promise.resolve(ingredientImages);
  ingredientImagesPromise ??= loadIngredientImages().then(items => {
    ingredientImages = items;
    return items;
  });
  return ingredientImagesPromise;
}

function scoreMatch(foodNames: string[], imageName: string) {
  const imageTokens = tokens(imageName);
  if (!imageTokens.length) return 0;
  let best = 0;
  for (const foodName of foodNames) {
    const foodTokens = new Set(tokens(foodName));
    const matched = imageTokens.filter(token => foodTokens.has(token));
    if (!matched.length) continue;
    const completeMatch = matched.length === imageTokens.length;
    const score = (completeMatch ? 1000 : 0) + matched.length * 100 + imageTokens.length;
    best = Math.max(best, score);
  }
  return best;
}

export async function resolveFoodImageUrl(food: FoodRow): Promise<string | null> {
  const savedUrl = food.catalog_metadata?.image_url?.trim();
  if (savedUrl && validImageUrl(savedUrl)) return savedUrl;

  const foodNames = [
    food.catalog_metadata?.name_en,
    food.name,
    food.catalog_metadata?.name_vi,
    ...(food.catalog_metadata?.aliases ?? []),
  ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
  if (!foodNames.length) return null;

  const images = await getIngredientImages();
  let best: IngredientImage | null = null;
  let bestScore = 0;
  for (const image of images) {
    const score = scoreMatch(foodNames, image.name);
    if (score > bestScore) {
      best = image;
      bestScore = score;
    }
  }
  if (!best) return null;
  return `${best.url.replace(/\/(small|medium|large)$/, '')}/small`;
}
