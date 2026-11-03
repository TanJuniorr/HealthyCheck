import { supabase } from '../lib/supabase';
import type { ProfileRow, ProfileUpdate } from '../types/database';
import { validateProfile, normalizeRow } from '../lib/dataValidation';
import { DataAccessError, dataError } from '../lib/dataErrors';
import { assertIdentity, columns, queryResult, requireAuthenticatedUser } from './queryCore';
import { notifyProfileChanged } from '../lib/healthQueryEvents';
export async function getMyProfile(): Promise<ProfileRow | null> {
 const user = await requireAuthenticatedUser();
 let result;
 try {
  result = await supabase.from('profiles').select(columns.profiles).eq('id', user.id).maybeSingle();
 } catch (error) {
  if (__DEV__) console.warn('[profile] Profile request failed before receiving a response.', error);
  throw error;
 }
 if (result.error) {
  if (__DEV__) console.warn('[profile] Supabase profile query failed.', { code: result.error.code, message: result.error.message });
  await assertIdentity(user.id);
  throw dataError(result.error);
 }
 await assertIdentity(user.id);
 return result.data ? normalizeRow('profiles',result.data) : null;
}
export async function updateMyProfile(payload: ProfileUpdate, expectedOwnerId?:string): Promise<ProfileRow> {
 const input = validateProfile(payload); const user = await requireAuthenticatedUser();
 if(expectedOwnerId&&user.id!==expectedOwnerId)throw new DataAccessError('AUTH_CHANGED','errors.accountChangedReload');
 const row = await queryResult(supabase.from('profiles').update(input).eq('id', user.id).select(columns.profiles).maybeSingle(), user.id);
 if (!row) throw new DataAccessError('NOT_FOUND', 'Chưa có hồ sơ. Hãy tạo hồ sơ trước khi cập nhật.');
 const normalized=normalizeRow('profiles',row);notifyProfileChanged(user.id);return normalized;
}

export async function ensureMyProfile(expectedOwnerId?:string): Promise<ProfileRow> {
 const user = await requireAuthenticatedUser();
 if(expectedOwnerId&&user.id!==expectedOwnerId)throw new DataAccessError('AUTH_CHANGED','errors.accountChangedReload');
 const existing = await queryResult(supabase.from('profiles').select(columns.profiles).eq('id', user.id).maybeSingle(), user.id);
 if (existing) return normalizeRow('profiles',existing);
 const name: unknown = user.user_metadata.full_name;
 // PK id is verified. DO NOTHING preserves an existing trigger-created/concurrent row.
 await queryResult(supabase.from('profiles').upsert({ id: user.id, full_name: typeof name === 'string' ? name.trim().slice(0,120) || null : null }, { onConflict: 'id', ignoreDuplicates: true }), user.id);
 const row = await queryResult(supabase.from('profiles').select(columns.profiles).eq('id', user.id).maybeSingle(), user.id);
 if (!row) throw new DataAccessError('PERMISSION_DENIED', 'Không tạo được hồ sơ với quyền hiện tại.');
 return normalizeRow('profiles',row);
}
