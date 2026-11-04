import type { User } from '@supabase/supabase-js';

import { getMyProfile } from '../services/profileService';
import { DataAccessError } from './dataErrors';
import type { ProfileRow } from '../types/database';
export type Profile = ProfileRow;
export async function loadProfile(expectedUserId: string): Promise<Profile | null> {
  const row = await getMyProfile();
  if (row && row.id !== expectedUserId) throw new DataAccessError('AUTH_CHANGED','Tài khoản đã thay đổi.');
  return row;
}
export function profileText(profile: Profile | null, key: keyof ProfileRow): string | null {
  const value = profile?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
export function displayName(user: User | null, profile: Profile | null): string {
  const metadata: unknown = user?.user_metadata.full_name;
  return profileText(profile, 'full_name') ??
    (typeof metadata === 'string' && metadata.trim() ? metadata.trim() : 'Healthy Check Member');
}
export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
}
