import { decode } from 'base64-arraybuffer';
import { supabase } from '../lib/supabase';
import { DataAccessError, dataError } from '../lib/dataErrors';
import { assertIdentity, requireAuthenticatedUser } from './queryCore';

const BUCKET = 'avatars';
const MAX_BASE64_LENGTH = 5_600_000;

function assertOwnedAvatarPath(path: string, userId: string) {
  if (!path.startsWith(`${userId}/`) || !/^[A-Za-z0-9_-]+\.jpg$/i.test(path.slice(userId.length + 1))) {
    throw new DataAccessError('PERMISSION_DENIED','Đường dẫn ảnh đại diện không thuộc tài khoản này.');
  }
}

export async function uploadAvatar(base64: string): Promise<string> {
  if (!base64 || base64.length > MAX_BASE64_LENGTH) {
    throw new DataAccessError('INVALID_INPUT','Ảnh quá lớn hoặc không hợp lệ. Hãy chọn ảnh nhỏ hơn 4 MB.');
  }
  const user = await requireAuthenticatedUser();
  const fileName = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}.jpg`;
  const path = `${user.id}/${fileName}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path,decode(base64),{
    contentType:'image/jpeg',
    cacheControl:'3600',
    upsert:false,
  });
  if (error) throw dataError(error);
  await assertIdentity(user.id);
  return path;
}

export async function createAvatarSignedUrl(path: string): Promise<string> {
  const user = await requireAuthenticatedUser();
  assertOwnedAvatarPath(path,user.id);
  const { data,error } = await supabase.storage.from(BUCKET).createSignedUrl(path,60 * 60);
  if (error) throw dataError(error);
  await assertIdentity(user.id);
  if (!data?.signedUrl) throw new DataAccessError('DATABASE','Không lấy được URL ảnh đại diện.');
  return data.signedUrl;
}

export async function deleteAvatar(path: string): Promise<void> {
  const user = await requireAuthenticatedUser();
  assertOwnedAvatarPath(path,user.id);
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw dataError(error);
  await assertIdentity(user.id);
}
