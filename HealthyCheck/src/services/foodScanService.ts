import { supabase } from '../lib/supabase';
import { assertIdentity, requireAuthenticatedUserId } from './queryCore';

const MAX_IMAGE_BASE64_LENGTH = 5_500_000;

export type FoodScanEstimate = {
  name_vi: string;
  name_en: string;
  estimated_grams: number;
  estimated_kcal: number;
  calories_per_100g?: number;
  protein_per_100g?: number;
  carbs_per_100g?: number;
  fat_per_100g?: number;
  confidence: number;
};

export type FoodScanResult = {
  is_food: boolean;
  items: FoodScanEstimate[];
  note: string;
};

export type FoodScanErrorCode = 'unauthenticated' | 'quota_exceeded' | 'not_configured' | 'timeout' | 'network' | 'image_too_large' | 'invalid_image' | 'failed';

export class FoodScanError extends Error {
  constructor(readonly code: FoodScanErrorCode) {
    super(code);
    this.name = 'FoodScanError';
  }
}

async function getEdgeErrorCode(error: unknown): Promise<FoodScanErrorCode> {
  if (!error || typeof error !== 'object') return 'failed';
  const context = (error as { context?: unknown }).context;
  if (context instanceof Response) {
    if (context.status === 401) return 'unauthenticated';
    if (context.status === 429) return 'quota_exceeded';
    try {
      const body = await context.clone().json() as { error?: string };
      if (body.error === 'ai_not_configured' || body.error === 'ai_key_invalid') return 'not_configured';
      if (body.error === 'ai_timeout') return 'timeout';
      if (body.error === 'ai_network_error' || body.error === 'ai_provider_error') return 'network';
      if (body.error === 'image_too_large') return 'image_too_large';
      if (body.error === 'invalid_image') return 'invalid_image';
    } catch { /* Use status fallback below. */ }
    if (context.status === 504) return 'timeout';
    if (context.status >= 500) return 'network';
  }
  const name = (error as { name?: unknown }).name;
  return typeof name === 'string' && name.includes('Fetch') ? 'network' : 'failed';
}

export async function scanFoodPhoto(imageBase64: string): Promise<FoodScanResult> {
  if (!imageBase64 || imageBase64.length > MAX_IMAGE_BASE64_LENGTH) throw new FoodScanError('image_too_large');
  const owner = await requireAuthenticatedUserId();
  const { data, error } = await supabase.functions.invoke<FoodScanResult>('food-scan', {
    body: { image_base64: imageBase64, mime_type: 'image/jpeg' },
  });
  if (error) throw new FoodScanError(await getEdgeErrorCode(error));
  if (!data || typeof data.is_food !== 'boolean' || !Array.isArray(data.items)) throw new FoodScanError('failed');
  await assertIdentity(owner);
  return data;
}
