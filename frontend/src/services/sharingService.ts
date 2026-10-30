import { supabase } from '../lib/supabase';
import type {
  PrivacyLevel,
  SharingInviteInsert,
  SharingInviteRow,
  SharingInviteUpdate,
} from '../types/database';
import { requireAuthenticatedUserId, queryResult } from './queryCore';
import { validId } from '../lib/dataValidation';
import { DataAccessError, invalid } from '../lib/dataErrors';

type SharingListener = (owner: string) => void;
const sharingListeners = new Set<SharingListener>();

export function subscribeSharingChanges(listener: SharingListener) {
  sharingListeners.add(listener);
  return () => {
    sharingListeners.delete(listener);
  };
}

export function notifySharingChanged(owner: string) {
  for (const listener of sharingListeners) {
    listener(owner);
  }
}

export function validateRecipient(raw: unknown): { recipient_label: string; recipient_email: string | null } {
  if (typeof raw !== 'string') invalid('sharing.errorRecipientRequired');
  const trimmed = raw.trim();
  if (!trimmed) invalid('sharing.errorRecipientRequired');
  if (trimmed.length > 120) invalid('sharing.errorRecipientTooLong');

  if (trimmed.includes('@')) {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(trimmed)) invalid('sharing.errorInvalidEmail');
    return {
      recipient_label: trimmed,
      recipient_email: trimmed.toLowerCase(),
    };
  }

  if (trimmed.length < 2) invalid('sharing.errorRecipientTooShort');
  return {
    recipient_label: trimmed,
    recipient_email: null,
  };
}

export function validateCategories(categories: {
  share_steps?: boolean;
  share_sleep?: boolean;
  share_nutrition?: boolean;
  share_heart?: boolean;
  share_cycle?: boolean;
}) {
  if (categories.share_heart || categories.share_cycle) {
    invalid('sharing.errorHeartCycleUnavailable');
  }
  const hasAtLeastOne = Boolean(
    categories.share_steps || categories.share_sleep || categories.share_nutrition
  );
  if (!hasAtLeastOne) {
    invalid('sharing.errorNoCategorySelected');
  }
}

export async function getMySharingInvites(): Promise<SharingInviteRow[]> {
  const owner = await requireAuthenticatedUserId();
  const result = await queryResult(
    supabase
      .from('sharing_invites')
      .select('*')
      .eq('owner_id', owner)
      .order('created_at', { ascending: false }),
    owner
  );
  return result ?? [];
}

export async function getSharingInviteById(id: string): Promise<SharingInviteRow | null> {
  validId(id);
  const owner = await requireAuthenticatedUserId();
  const result = await queryResult(
    supabase
      .from('sharing_invites')
      .select('*')
      .eq('id', id)
      .eq('owner_id', owner)
      .maybeSingle(),
    owner
  );
  return result;
}

export async function createSharingInvite(input: {
  recipient: string;
  privacy_level: PrivacyLevel;
  share_steps: boolean;
  share_sleep: boolean;
  share_nutrition: boolean;
  share_heart?: boolean;
  share_cycle?: boolean;
  notify_on_view?: boolean;
  weekly_digest?: boolean;
}): Promise<SharingInviteRow> {
  const { recipient_label, recipient_email } = validateRecipient(input.recipient);
  validateCategories(input);
  if (!['specific', 'family', 'community'].includes(input.privacy_level)) {
    invalid('sharing.errorInvalidPrivacy');
  }
  const owner = await requireAuthenticatedUserId();
  const payload: SharingInviteInsert & { owner_id: string } = {
    owner_id: owner,
    recipient_label,
    recipient_email,
    privacy_level: input.privacy_level,
    share_steps: Boolean(input.share_steps),
    share_sleep: Boolean(input.share_sleep),
    share_nutrition: Boolean(input.share_nutrition),
    share_cycle: false,
    notify_on_view: Boolean(input.notify_on_view),
    weekly_digest: Boolean(input.weekly_digest),
    status: 'active',
  };
  const result = await queryResult(
    supabase.from('sharing_invites').insert(payload).select().single(),
    owner
  );
  if (!result) throw new DataAccessError('DATABASE', 'Không thể tạo lời mời chia sẻ.');
  notifySharingChanged(owner);
  return result;
}

export async function updateSharingInvite(
  id: string,
  input: {
    recipient?: string;
    privacy_level?: PrivacyLevel;
    share_steps?: boolean;
    share_sleep?: boolean;
    share_nutrition?: boolean;
    share_heart?: boolean;
    share_cycle?: boolean;
    notify_on_view?: boolean;
    weekly_digest?: boolean;
  }
): Promise<SharingInviteRow> {
  validId(id);
  const current = await getSharingInviteById(id);
  if (!current) throw new DataAccessError('NOT_FOUND', 'Không tìm thấy bản ghi chia sẻ.');
  if (current.status === 'revoked') {
    throw new DataAccessError('CONSTRAINT', 'sharing.errorRevokedCannotEdit');
  }

  const mergedSteps = input.share_steps !== undefined ? input.share_steps : current.share_steps;
  const mergedSleep = input.share_sleep !== undefined ? input.share_sleep : current.share_sleep;
  const mergedNutrition = input.share_nutrition !== undefined ? input.share_nutrition : current.share_nutrition;
  const mergedCycle = input.share_cycle !== undefined ? input.share_cycle : current.share_cycle;

  validateCategories({
    share_steps: mergedSteps,
    share_sleep: mergedSleep,
    share_nutrition: mergedNutrition,
    share_heart: input.share_heart,
    share_cycle: mergedCycle,
  });

  const patch: SharingInviteUpdate & { updated_at: string } = {
    updated_at: new Date().toISOString(),
  };

  if (input.recipient !== undefined) {
    const { recipient_label, recipient_email } = validateRecipient(input.recipient);
    patch.recipient_label = recipient_label;
    patch.recipient_email = recipient_email;
  }

  if (input.privacy_level !== undefined) {
    if (!['specific', 'family', 'community'].includes(input.privacy_level)) {
      invalid('sharing.errorInvalidPrivacy');
    }
    patch.privacy_level = input.privacy_level;
  }

  if (input.share_steps !== undefined) patch.share_steps = Boolean(input.share_steps);
  if (input.share_sleep !== undefined) patch.share_sleep = Boolean(input.share_sleep);
  if (input.share_nutrition !== undefined) patch.share_nutrition = Boolean(input.share_nutrition);
  patch.share_cycle = false;
  if (input.notify_on_view !== undefined) patch.notify_on_view = Boolean(input.notify_on_view);
  if (input.weekly_digest !== undefined) patch.weekly_digest = Boolean(input.weekly_digest);

  const owner = await requireAuthenticatedUserId();
  const result = await queryResult(
    supabase
      .from('sharing_invites')
      .update(patch)
      .eq('id', id)
      .eq('owner_id', owner)
      .select()
      .single(),
    owner
  );
  if (!result) throw new DataAccessError('DATABASE', 'Không thể cập nhật chia sẻ.');
  notifySharingChanged(owner);
  return result;
}

export async function pauseSharingInvite(id: string): Promise<SharingInviteRow> {
  validId(id);
  const current = await getSharingInviteById(id);
  if (!current) throw new DataAccessError('NOT_FOUND', 'Không tìm thấy bản ghi chia sẻ.');
  if (current.status === 'revoked') {
    throw new DataAccessError('CONSTRAINT', 'sharing.errorRevokedCannotPause');
  }
  const owner = await requireAuthenticatedUserId();
  const result = await queryResult(
    supabase
      .from('sharing_invites')
      .update({ status: 'paused', updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('owner_id', owner)
      .select()
      .single(),
    owner
  );
  if (!result) throw new DataAccessError('DATABASE', 'Không thể tạm dừng chia sẻ.');
  notifySharingChanged(owner);
  return result;
}

export async function resumeSharingInvite(id: string): Promise<SharingInviteRow> {
  validId(id);
  const current = await getSharingInviteById(id);
  if (!current) throw new DataAccessError('NOT_FOUND', 'Không tìm thấy bản ghi chia sẻ.');
  if (current.status === 'revoked') {
    throw new DataAccessError('CONSTRAINT', 'sharing.errorRevokedCannotResume');
  }
  const owner = await requireAuthenticatedUserId();
  const result = await queryResult(
    supabase
      .from('sharing_invites')
      .update({ status: 'active', updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('owner_id', owner)
      .select()
      .single(),
    owner
  );
  if (!result) throw new DataAccessError('DATABASE', 'Không thể tiếp tục chia sẻ.');
  notifySharingChanged(owner);
  return result;
}

export async function revokeSharingInvite(id: string): Promise<SharingInviteRow> {
  validId(id);
  const owner = await requireAuthenticatedUserId();
  const result = await queryResult(
    supabase
      .from('sharing_invites')
      .update({ status: 'revoked', updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('owner_id', owner)
      .select()
      .single(),
    owner
  );
  if (!result) throw new DataAccessError('DATABASE', 'Không thể thu hồi chia sẻ.');
  notifySharingChanged(owner);
  return result;
}

export async function deleteSharingInvite(id: string): Promise<void> {
  validId(id);
  const owner = await requireAuthenticatedUserId();
  const result = await queryResult(
    supabase
      .from('sharing_invites')
      .delete()
      .eq('id', id)
      .eq('owner_id', owner)
      .eq('status', 'revoked')
      .select('id')
      .maybeSingle(),
    owner
  );
  if (!result) throw new DataAccessError('NOT_FOUND', 'Không tìm thấy bản ghi chia sẻ.');
  notifySharingChanged(owner);
}
