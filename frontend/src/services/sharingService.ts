import { supabase } from '../lib/supabase';
import { DataAccessError, dataError, invalid } from '../lib/dataErrors';
import { validId } from '../lib/dataValidation';
import type { SharingAction, SharingInviteRow, SharingPermissions, SharingStatus } from '../types/database';
import { assertIdentity, queryResult, requireAuthenticatedUserId } from './queryCore';

const columns = 'id,owner_id,recipient_user_id,recipient_label,recipient_email,status,version,accepted_at,created_at,updated_at,share_steps,share_sleep,share_nutrition';
export const sharingGroups = ['steps', 'sleep', 'nutrition'] as const;
export const emptySharingPermissions: SharingPermissions = { share_steps: false, share_sleep: false, share_nutrition: false };

const sharingErrors = new Set([
  'sharing.errorAccountChanged', 'sharing.errorInvalidEmail', 'sharing.errorNoCategorySelected',
  'sharing.errorSelfShare', 'sharing.errorRecipientUnavailable', 'sharing.errorDuplicateInvite',
  'sharing.errorInviteUnavailable', 'sharing.errorConflict', 'sharing.errorInvalidTransition',
  'sharing.errorExpansionNotConfirmed',
]);

export function validateRecipient(raw: unknown): string {
  if (typeof raw !== 'string' || !raw.trim()) invalid('sharing.errorRecipientRequired');
  const email = raw.trim().toLowerCase();
  if (email.length > 254) invalid('sharing.errorRecipientTooLong');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) invalid('sharing.errorInvalidEmail');
  return email;
}

export function validateCategories(input: SharingPermissions) {
  const values = sharingGroups.map(group => input[`share_${group}`]);
  if (values.some(value => typeof value !== 'boolean') || !values.includes(true)) {
    invalid('sharing.errorNoCategorySelected');
  }
}

export function expandsSharing(before: SharingPermissions, after: SharingPermissions) {
  return sharingGroups.some(group => !before[`share_${group}`] && after[`share_${group}`]);
}

const statuses: Record<SharingStatus, string> = {
  pending: 'sharing.statusPending', active: 'sharing.statusActive', paused: 'sharing.statusPaused',
  rejected: 'sharing.statusRejected', revoked: 'sharing.statusRevoked',
};
export function sharingStatusLabel(status: SharingStatus) {
  return statuses[status] ?? 'sharing.errorInviteUnavailable';
}

export async function getMySharingInvites(owner: string): Promise<SharingInviteRow[]> {
  await assertIdentity(owner);
  return await queryResult<SharingInviteRow[]>(
    supabase.from('sharing_invites').select(columns).eq('owner_id', owner)
      .order('created_at', { ascending: false }).order('id', { ascending: false }),
    owner,
  ) ?? [];
}

export async function getSharingInviteById(owner: string, id: string) {
  validId(id);
  await assertIdentity(owner);
  return queryResult<SharingInviteRow>(supabase.from('sharing_invites').select(columns)
    .eq('owner_id', owner).eq('id', id).maybeSingle(), owner);
}

async function confirmedMutation(
  request: PromiseLike<{ data: SharingInviteRow | null; error: { message: string } | null }>,
  owner: string,
) {
  const { data, error } = await request;
  await assertIdentity(owner);
  if (error) {
    if (sharingErrors.has(error.message)) throw new DataAccessError('CONSTRAINT', error.message);
    throw dataError(error);
  }
  if (!data || (data.owner_id !== owner && data.recipient_user_id !== owner)) {
    throw new DataAccessError('DATABASE', 'errors.saveUnconfirmed');
  }
  return data;
}

export async function createSharingInvite(owner: string, email: string, input: SharingPermissions) {
  const recipient = validateRecipient(email);
  validateCategories(input);
  if (await requireAuthenticatedUserId() !== owner) {
    throw new DataAccessError('AUTH_CHANGED', 'sharing.errorAccountChanged');
  }
  const invite = await confirmedMutation(supabase.rpc('create_private_sharing_invite', {
    p_actor: owner, p_email: recipient,
    p_steps: input.share_steps, p_sleep: input.share_sleep, p_nutrition: input.share_nutrition,
  }).single(), owner);
  if (invite.owner_id !== owner || !invite.recipient_user_id || invite.recipient_email !== recipient || invite.status !== 'pending') {
    throw new DataAccessError('DATABASE', 'errors.saveUnconfirmed');
  }
  return invite;
}

export async function changeSharingInvite(
  owner: string, id: string, version: number, action: SharingAction,
  permissions?: SharingPermissions, confirmExpansion = false,
) {
  validId(id);
  if (permissions) validateCategories(permissions);
  if (await requireAuthenticatedUserId() !== owner) {
    throw new DataAccessError('AUTH_CHANGED', 'sharing.errorAccountChanged');
  }
  const invite = await confirmedMutation(supabase.rpc('change_private_sharing_invite', {
    p_actor: owner, p_id: id, p_version: version, p_action: action,
    ...(permissions ? {
      p_steps: permissions.share_steps, p_sleep: permissions.share_sleep,
      p_nutrition: permissions.share_nutrition, p_confirm_expansion: confirmExpansion,
    } : {}),
  }).single(), owner);
  if (invite.id !== id || invite.version < version || (action !== 'edit' && invite.version !== version + 1)) {
    throw new DataAccessError('DATABASE', 'errors.saveUnconfirmed');
  }
  return invite;
}

// Subscribe to invitation metadata only. Health values are fetched via the
// permission-checked RPC; no raw records travel through Realtime.
let subscriptionSequence = 0;
export function subscribeSharingChanges(owner: string, side: 'sender' | 'recipient', invalidate: () => void) {
  const filter = side === 'sender' ? 'owner_id' : 'recipient_user_id';
  let active = true;
  const versions = new Map<string, number>();
  const channel = supabase.channel(`private-sharing:${side}:${owner}:${++subscriptionSequence}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'sharing_invites', filter: `${filter}=eq.${owner}` }, event => {
      if (!active) return;
      if (side === 'sender' && event.eventType === 'UPDATE') {
        const { id, version } = event.new;
        if (typeof id === 'string' && typeof version === 'number') {
          if (versions.get(id) === version) return;
          versions.set(id, version);
        }
      }
      invalidate();
    })
    .subscribe(status => {
      if (active && ['SUBSCRIBED', 'CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) invalidate();
    });
  return () => { active = false; void supabase.removeChannel(channel); };
}
