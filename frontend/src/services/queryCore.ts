import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { DataAccessError, dataError } from '../lib/dataErrors';
import { normalizePagination, normalizeRow, validId, validateInput } from '../lib/dataValidation';
import { getLocalDayBounds, validateDateRange, toLocalDateKey } from '../lib/dateUtils';
import type { Inputs, PersonalTable, Rows } from '../types/database';
export type HistoryOptions = { page?: number; pageSize?: number; startDate?: string; endDate?: string; ascending?: boolean };
export type Page<T> = { data: T[]; page: number; pageSize: number; total: number | null; hasMore: boolean };
export const columns = {
 profiles: 'health_onboarding_completed_at,id,full_name,date_of_birth,height_cm,gender,avatar_url,created_at,updated_at',
 health_goals: 'id,user_id,daily_steps,daily_calories,daily_water_ml,target_sleep_minutes,effective_from,created_at',
 step_records: 'id,user_id,record_date,steps,distance_km,active_minutes,created_at,updated_at',
 sleep_records: 'id,user_id,sleep_start,sleep_end,quality_rating,notes,created_at',
 foods: 'catalog_metadata,id,name,calories_per_100g,protein_per_100g,carbs_per_100g,fat_per_100g,category,serving_size,calories,protein_g,carbs_g,fat_g,created_at',
 meal_records: 'id,user_id,food_id,meal_type,quantity_g,consumed_at,created_at',
 weight_records: 'id,user_id,weight_kg,recorded_at,created_at', water_records: 'id,user_id,amount_ml,recorded_at,created_at',
} as const;
export const timeColumn = { health_goals: 'effective_from', step_records: 'record_date', sleep_records: 'sleep_end', meal_records: 'consumed_at', weight_records: 'recorded_at', water_records: 'recorded_at' } as const;
let identityRequest: Promise<User> | null = null;
export async function requireAuthenticatedUser(): Promise<User> {
 if (!identityRequest) {
  identityRequest = (async () => { const { data, error } = await supabase.auth.getUser(); if (error) throw dataError(error); if (!data.user) throw new DataAccessError('UNAUTHENTICATED', 'Vui lòng đăng nhập để truy cập dữ liệu.'); return data.user; })();
  const current = identityRequest;
  void current.finally(() => { if (identityRequest === current) identityRequest = null; }).catch(() => {});
 }
 const user = await identityRequest; await assertIdentity(user.id); return user;
}
export async function requireAuthenticatedUserId(): Promise<string> { return (await requireAuthenticatedUser()).id; }
export async function assertIdentity(userId: string) {
 const { data, error } = await supabase.auth.getSession();
 if (error) throw dataError(error);
 if (!data.session) throw new DataAccessError('UNAUTHENTICATED','Phiên đăng nhập đã kết thúc. Vui lòng đăng nhập lại.');
 if (data.session.user.id !== userId) throw new DataAccessError('AUTH_CHANGED', 'Tài khoản đã thay đổi. Vui lòng tải lại dữ liệu.');
}
export type QueryResponse<T> = { data: T | null; error: unknown; count?: number | null };
export async function queryResult<T>(query: PromiseLike<QueryResponse<T>>, owner?: string): Promise<T | null> {
 let result: QueryResponse<T>;
 try { result = await query; } catch (error) { throw dataError(error); }
 if (result.error) throw dataError(result.error);
 if (owner) await assertIdentity(owner);
 return result.data;
}
export async function readPages<T>(factory: (from: number, to: number) => PromiseLike<QueryResponse<T[]>>, options: HistoryOptions = {}, all = false): Promise<Page<T>> {
 const pagination = normalizePagination(options); const data: T[] = []; let from = all ? 0 : pagination.from; let total: number | null = null;
 do {
  let result: QueryResponse<T[]>;
  try { result = await factory(from, from + pagination.pageSize - 1); } catch (error) { throw dataError(error); }
  if (result.error) throw dataError(result.error);
  const rows = result.data ?? []; data.push(...rows); total = result.count ?? null;
  if (!all || rows.length === 0 || (result.count != null && from + rows.length >= result.count)) break;
  from += rows.length;
 } while (true);
 return { data, page: all ? 1 : pagination.page, pageSize: pagination.pageSize, total: all ? data.length : total, hasMore: !all && (total === null ? data.length > 0 : pagination.from + data.length < total) };
}
function personalTable(table: PersonalTable) {
 if (!['health_goals','step_records','sleep_records','meal_records','weight_records','water_records'].includes(table)) throw new DataAccessError('INVALID_INPUT','Bảng dữ liệu không được hỗ trợ.');
 return supabase.from(table);
}
// Explicit dispatch preserves Supabase 2.118's excess-property checks for each table.
// The payload has already passed that table's field allowlist and value validation.
function updateOwned(table: PersonalTable,input: Inputs[PersonalTable],recordId: string,ownerId: string) {
 switch (table) {
  case 'health_goals': return supabase.from('health_goals').update(input as Partial<Inputs['health_goals']>).eq('id',recordId).eq('user_id',ownerId).select(columns.health_goals).maybeSingle();
  case 'step_records': return supabase.from('step_records').update(input as Partial<Inputs['step_records']>).eq('id',recordId).eq('user_id',ownerId).select(columns.step_records).maybeSingle();
  case 'sleep_records': return supabase.from('sleep_records').update(input as Partial<Inputs['sleep_records']>).eq('id',recordId).eq('user_id',ownerId).select(columns.sleep_records).maybeSingle();
  case 'meal_records': return supabase.from('meal_records').update(input as Partial<Inputs['meal_records']>).eq('id',recordId).eq('user_id',ownerId).select(columns.meal_records).maybeSingle();
  case 'weight_records': return supabase.from('weight_records').update(input as Partial<Inputs['weight_records']>).eq('id',recordId).eq('user_id',ownerId).select(columns.weight_records).maybeSingle();
  case 'water_records': return supabase.from('water_records').update(input as Partial<Inputs['water_records']>).eq('id',recordId).eq('user_id',ownerId).select(columns.water_records).maybeSingle();
  default: throw new DataAccessError('INVALID_INPUT','Bảng dữ liệu không được hỗ trợ.');
 }
}
export function makeRepository<T extends PersonalTable>(table: T) {
 const owner = () => requireAuthenticatedUserId();
 const base = (userId: string) => personalTable(table).select(columns[table], { count: 'exact' }).eq('user_id', userId);
 const history = async (options: HistoryOptions = {}, all = false): Promise<Page<Rows[T]>> => {
  normalizePagination(options);
  if (options.startDate !== undefined) toLocalDateKey(options.startDate);
  if (options.endDate !== undefined) toLocalDateKey(options.endDate);
  if (options.startDate && options.endDate) validateDateRange(options.startDate, options.endDate);
  const id = await owner();
  const page = await readPages((from, to) => {
   let query = base(id);
   const dateColumn = timeColumn[table]; const isCalendar = table === 'step_records' || table === 'health_goals';
   if (options.startDate) query = query.gte(dateColumn, isCalendar ? options.startDate : getLocalDayBounds(options.startDate).start);
   if (options.endDate) query = isCalendar ? query.lte(dateColumn, options.endDate) : query.lt(dateColumn, getLocalDayBounds(options.endDate).end);
   return query.order(dateColumn, { ascending: options.ascending ?? false, nullsFirst: false }).order('created_at', { ascending: options.ascending ?? false, nullsFirst: false }).order('id', { ascending: options.ascending ?? false }).range(from, to);
  }, options, all);
  await assertIdentity(id);
  // Dynamic table dispatcher boundary; public inputs and columns are schema-typed.
  return { ...page,data:(page.data as unknown as Rows[T][]).map(row => normalizeRow(table,row)) };
 };
 const byId = async (recordId: string): Promise<Rows[T] | null> => {
  validId(recordId); const id = await owner();
  const row = await queryResult(base(id).eq('id', recordId).maybeSingle(), id) as unknown as Rows[T] | null;
  return row ? normalizeRow(table,row) : null;
 };
 const add = async (payload: Inputs[T]): Promise<Rows[T]> => {
  const input = validateInput(table, payload); const id = await owner();
  const data = await queryResult(personalTable(table).insert({ ...input, user_id: id }).select(columns[table]).single(), id);
  if (!data) throw new DataAccessError('DATABASE', 'Máy chủ không trả về bản ghi đã lưu.');
  return normalizeRow(table,data as unknown as Rows[T]);
 };
 const update = async (recordId: string, payload: Partial<Inputs[T]>): Promise<Rows[T]> => {
  validId(recordId); const input = validateInput(table, payload, true); const id = await owner();
  const data = await queryResult<unknown>(updateOwned(table,input,recordId,id), id);
  if (!data) throw new DataAccessError('NOT_FOUND', 'Bản ghi không tồn tại hoặc không thuộc tài khoản này.');
  return normalizeRow(table,data as unknown as Rows[T]);
 };
 const remove = async (recordId: string): Promise<void> => {
  validId(recordId); const id = await owner();
  const data = await queryResult(personalTable(table).delete().eq('id', recordId).eq('user_id', id).select('id').maybeSingle(), id);
  if (!data) throw new DataAccessError('NOT_FOUND', 'Bản ghi không tồn tại hoặc không thuộc tài khoản này.');
 };
 const range = async (startDate: string, endDate: string): Promise<Rows[T][]> => { validateDateRange(startDate, endDate); return (await history({ startDate, endDate, pageSize: 200, ascending: true }, true)).data; };
 return { history, byId, add, update, remove, range };
}
