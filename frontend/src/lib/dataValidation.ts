import { DataAccessError, invalid } from './dataErrors';
import { timestamp, toLocalDateKey } from './dateUtils';
import type { Inputs, PersonalTable, ProfileUpdate, Rows } from '../types/database';
export function safeNumber(value: unknown): number {
  if ((typeof value !== 'number' && typeof value !== 'string') || (typeof value === 'string' && !value.trim())) return invalid('Giá trị số không hợp lệ.');
  const number = Number(value); if (!Number.isFinite(number)) return invalid('Giá trị số không hữu hạn.'); return number;
}
export function nonnegative(value: unknown, integer = false): number { const n = safeNumber(value); if (n < 0 || (integer && !Number.isSafeInteger(n))) invalid('Giá trị phải không âm' + (integer ? ' và là số nguyên.' : '.')); return n; }
export function positive(value: unknown, integer = false): number { const n = nonnegative(value, integer); if (n === 0) invalid('Giá trị phải lớn hơn 0.'); return n; }
export function validId(value: unknown): string { if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) return invalid('Mã bản ghi không hợp lệ.'); return value; }
export function normalizePagination(options: { page?: number; pageSize?: number } = {}) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) invalid('Tham số phân trang không hợp lệ.');
  const page = options.page ?? 1; const pageSize = options.pageSize ?? 20;
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(pageSize) || pageSize < 1) invalid('Tham số phân trang không hợp lệ.');
  const size = Math.min(pageSize, 200); const from = (page - 1) * size;
  if (!Number.isSafeInteger(from + size)) invalid('Trang vượt giới hạn.');
  return { page, pageSize: size, from, to: from + size - 1 };
}
const fields = {
  health_goals: ['daily_steps', 'daily_calories', 'daily_water_ml', 'target_sleep_minutes', 'effective_from'],
  step_records: ['record_date', 'steps', 'distance_km', 'active_minutes'],
  sleep_records: ['sleep_start', 'sleep_end', 'quality_rating', 'notes'],
  meal_records: ['food_id', 'meal_type', 'quantity_g', 'consumed_at'],
  weight_records: ['weight_kg', 'recorded_at'], water_records: ['amount_ml', 'recorded_at'],
} satisfies Record<PersonalTable, string[]>;
export function validateInput<T extends PersonalTable>(table: T, input: Inputs[T] | Partial<Inputs[T]>, patch = false): Inputs[T] {
  if (!input || typeof input !== 'object' || Array.isArray(input) || !Object.hasOwn(fields,table)) invalid('Dữ liệu đầu vào không hợp lệ.');
  const source = input as Record<string, unknown>; const result: Record<string, unknown> = {};
  for (const key of Object.keys(source)) { if (!fields[table].includes(key)) invalid('Trường dữ liệu không được phép: ' + key); if (source[key] !== undefined) result[key] = source[key]; }
  const required: Partial<Record<PersonalTable, string[]>> = { step_records: ['record_date', 'steps'], sleep_records: ['sleep_start', 'sleep_end'], meal_records: ['food_id', 'meal_type', 'quantity_g'], weight_records: ['weight_kg'], water_records: ['amount_ml'] };
  if (!patch) for (const key of required[table] ?? []) if (result[key] == null) invalid('Thiếu trường ' + key);
  if (patch && !Object.keys(result).length) invalid('Không có thông tin để cập nhật.');
  for (const [key, value] of Object.entries(result)) {
    if (key === 'record_date' || key === 'effective_from') result[key] = toLocalDateKey(String(value));
    else if (['sleep_start', 'sleep_end', 'consumed_at', 'recorded_at'].includes(key)) result[key] = timestamp(value);
    else if (key === 'food_id') result[key] = validId(value);
    else if (key === 'meal_type') { if (!['breakfast','lunch','dinner','snack'].includes(String(value))) invalid('Loại bữa ăn không hợp lệ.'); }
    else if (key === 'notes') { if (value !== null && (typeof value !== 'string' || value.length > 2000)) invalid('Ghi chú tối đa 2000 ký tự.'); }
    else if (key === 'quality_rating') { if (value !== null && (positive(value, true) > 5)) invalid('Điểm giấc ngủ từ 1 đến 5.'); }
    else if (['quantity_g','weight_kg','amount_ml'].includes(key)) result[key] = positive(value, key === 'amount_ml');
    else if (value === null && ['distance_km','active_minutes'].includes(key)) result[key] = null;
    else result[key] = nonnegative(value, key !== 'distance_km');
  }
  if (result.sleep_start && result.sleep_end && Date.parse(String(result.sleep_end)) <= Date.parse(String(result.sleep_start))) invalid('Thời điểm thức dậy phải sau lúc ngủ.');
  return result as Inputs[T];
}
export function validateProfile(input: ProfileUpdate): ProfileUpdate {
  if (!input || typeof input !== 'object' || Array.isArray(input)) invalid('Hồ sơ đầu vào không hợp lệ.');
  const result: ProfileUpdate = {};
  for (const key of Object.keys(input)) if (!['full_name','date_of_birth','height_cm','avatar_url'].includes(key)) invalid('Trường hồ sơ không được phép.');
  if (input.full_name !== undefined) { if (input.full_name !== null && (typeof input.full_name !== 'string' || !input.full_name.trim() || input.full_name.trim().length > 120)) invalid('Họ tên phải có 1–120 ký tự.'); result.full_name = input.full_name?.trim() ?? null; }
  if (input.date_of_birth !== undefined) { const date = input.date_of_birth === null ? null : toLocalDateKey(input.date_of_birth); if (date && date > toLocalDateKey()) invalid('Ngày sinh không thể ở tương lai.'); result.date_of_birth = date; }
  if (input.height_cm !== undefined) { const height = input.height_cm === null ? null : positive(input.height_cm); if (height !== null && (height < 30 || height > 300)) invalid('Chiều cao hợp lệ từ 30 đến 300 cm.'); result.height_cm = height; }
  if (input.avatar_url !== undefined) { if (input.avatar_url !== null) { try { if (new URL(input.avatar_url).protocol !== 'https:') invalid('Avatar cần URL HTTPS.'); } catch { invalid('URL avatar không hợp lệ.'); } } result.avatar_url = input.avatar_url; }
  if (!Object.keys(result).length) invalid('Không có thông tin để cập nhật.');
  return result;
}

const numericFields = {
 profiles:['height_cm'],health_goals:['daily_steps','daily_calories','daily_water_ml','target_sleep_minutes'],step_records:['steps','distance_km','active_minutes'],sleep_records:['quality_rating'],foods:['calories_per_100g','protein_per_100g','carbs_per_100g','fat_per_100g','calories','protein_g','carbs_g','fat_g'],meal_records:['quantity_g'],weight_records:['weight_kg'],water_records:['amount_ml'],
} satisfies Record<keyof Rows,string[]>;
export function normalizeRow<T extends keyof Rows>(table: T,row: Rows[T]): Rows[T] {
 const result = { ...row } as Record<string,unknown>;
 try { for (const key of numericFields[table]) if (result[key] != null) result[key] = nonnegative(result[key],['steps','active_minutes','quality_rating','amount_ml','daily_steps','daily_calories','daily_water_ml','target_sleep_minutes'].includes(key)); }
 catch { throw new DataAccessError('DATABASE','Bản ghi có giá trị số không hợp lệ.'); }
 return result as Rows[T];
}
