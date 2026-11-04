import { supabase } from '../lib/supabase';
import { DataAccessError } from '../lib/dataErrors';
import type { IncomingSharingInvite, SharingInviteRow } from '../types/database';
import { assertIdentity, queryResult } from './queryCore';

export async function getMySharedOwners(recipient: string) {
  await assertIdentity(recipient);
  const [invites, metadata] = await Promise.all([
    queryResult(supabase.rpc('list_private_sharing_invitations', { p_actor: recipient }), recipient),
    queryResult<Pick<SharingInviteRow, 'id' | 'version' | 'updated_at'>[]>(
      supabase.from('sharing_invites').select('id,version,updated_at').eq('recipient_user_id', recipient),
      recipient,
    ),
  ]);
  await assertIdentity(recipient);
  const byId = new Map((metadata ?? []).map(row => [row.id, row]));
  return (invites ?? []).flatMap(invite => {
    const row = byId.get(invite.invite_id);
    // Concurrent updates can make the two read snapshots differ.
    return row && row.version === invite.version ? [{ ...invite, updated_at: row.updated_at }] : [];
  });
}

export async function getSharedMetrics(recipient: string, invite: IncomingSharingInvite) {
  if (invite.status !== 'active') throw new DataAccessError('PERMISSION_DENIED', 'sharedWithMe.notActive');
  await assertIdentity(recipient);
  const metrics = await queryResult(supabase.rpc('get_private_shared_metrics', {
    p_actor: recipient, p_id: invite.invite_id, p_version: invite.version,
    p_time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  }), recipient);
  if (!metrics || typeof metrics.updatedAt !== 'string') throw new DataAccessError('PERMISSION_DENIED', 'sharedWithMe.notActive');
  if (invite.share_steps && metrics.stepsToday !== null &&
    (!Number.isSafeInteger(metrics.stepsToday) || metrics.stepsToday < 0)) {
    throw new DataAccessError('DATABASE', 'sharedWithMe.invalidSteps');
  }
  return metrics;
}
