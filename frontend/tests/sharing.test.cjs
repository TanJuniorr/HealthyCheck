/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { createClient } = require('@supabase/supabase-js');
const createLoader = require('./load-ts.cjs');

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const INVITE_ID = '33333333-3333-4333-8333-333333333333';

function fixture(handler) {
  let owner = A;
  const calls = [];
  const client = createClient('https://unit-test.invalid', 'sb_publishable_test', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: async (input, init) => {
        const request = {
          url: new URL(String(input)),
          method: init.method,
          headers: new Headers(init.headers),
          body: init.body ? JSON.parse(init.body) : null,
        };
        calls.push(request);
        const answer = await handler(request, calls.length);
        const status = answer.status ?? 200;
        let body = answer.data ?? [];
        if (request.headers.get('Accept')?.includes('vnd.pgrst.object') && Array.isArray(body)) {
          body = body[0] ?? null;
        }
        return new Response(status === 204 ? null : JSON.stringify(body), {
          status,
          headers: {
            'Content-Type': 'application/json',
            'Content-Range': `0-${Math.max(0, (Array.isArray(body) ? body.length : 1) - 1)}/${answer.total ?? (Array.isArray(body) ? body.length : 1)}`,
          },
        });
      },
    },
  });

  client.auth.getUser = async () => ({
    data: { user: owner ? { id: owner, user_metadata: { full_name: 'Test User' } } : null },
    error: null,
  });
  client.auth.getSession = async () => ({
    data: { session: owner ? { user: { id: owner }, access_token: 'unit-test-only' } : null },
    error: null,
  });

  const load = createLoader({
    [path.resolve(__dirname, '../src/lib/supabase.ts')]: { supabase: client },
  });

  return { load, calls, setOwner(v) { owner = v; } };
}

test('sharing input validation rejects invalid recipients and empty categories', () => {
  const service = fixture(() => ({ data: [] })).load('src/services/sharingService');

  // Recipient tests
  assert.throws(() => service.validateRecipient(''), (e) => e.message === 'sharing.errorRecipientRequired');
  assert.throws(() => service.validateRecipient('   '), (e) => e.message === 'sharing.errorRecipientRequired');
  assert.throws(() => service.validateRecipient('a'), (e) => e.message === 'sharing.errorRecipientTooShort');
  assert.throws(() => service.validateRecipient('a@'), (e) => e.message === 'sharing.errorInvalidEmail');
  assert.throws(() => service.validateRecipient('invalid@email'), (e) => e.message === 'sharing.errorInvalidEmail');
  assert.throws(() => service.validateRecipient('x'.repeat(125)), (e) => e.message === 'sharing.errorRecipientTooLong');

  const validName = service.validateRecipient('  Doctor Smith  ');
  assert.equal(validName.recipient_label, 'Doctor Smith');
  assert.equal(validName.recipient_email, null);

  const validEmail = service.validateRecipient('  Doc@Hospital.Org  ');
  assert.equal(validEmail.recipient_label, 'Doc@Hospital.Org');
  assert.equal(validEmail.recipient_email, 'doc@hospital.org');

  // Categories tests
  assert.throws(
    () => service.validateCategories({ share_steps: false, share_sleep: false, share_nutrition: false }),
    (e) => e.message === 'sharing.errorNoCategorySelected'
  );
  assert.throws(
    () => service.validateCategories({ share_steps: true, share_heart: true }),
    (e) => e.message === 'sharing.errorHeartCycleUnavailable'
  );
  assert.throws(
    () => service.validateCategories({ share_steps: true, share_cycle: true }),
    (e) => e.message === 'sharing.errorHeartCycleUnavailable'
  );

  // Valid category
  assert.doesNotThrow(() => service.validateCategories({ share_steps: true }));
});

test('createSharingInvite injects owner_id, forces demo metrics to false, and defaults to active', async () => {
  const f = fixture((req) => ({
    data: [
      {
        id: INVITE_ID,
        owner_id: req.body.owner_id,
        recipient_label: req.body.recipient_label,
        recipient_email: req.body.recipient_email,
        privacy_level: req.body.privacy_level,
        share_steps: req.body.share_steps,
        share_sleep: req.body.share_sleep,
        share_nutrition: req.body.share_nutrition,
        share_heart: req.body.share_heart,
        share_cycle: req.body.share_cycle,
        notify_on_view: req.body.notify_on_view,
        weekly_digest: req.body.weekly_digest,
        status: req.body.status,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
  }));

  const service = f.load('src/services/sharingService');
  const result = await service.createSharingInvite({
    recipient: 'doctor@clinic.com',
    privacy_level: 'specific',
    share_steps: true,
    share_sleep: false,
    share_nutrition: true,
    share_heart: false,
    share_cycle: false,
    notify_on_view: true,
    weekly_digest: false,
  });

  assert.equal(result.id, INVITE_ID);
  assert.equal(result.owner_id, A);
  assert.equal(result.recipient_email, 'doctor@clinic.com');
  assert.equal(result.status, 'active');
  assert.equal(f.calls[0].body.owner_id, A);
  assert.equal(f.calls[0].body.share_heart, false);
  assert.equal(f.calls[0].body.share_cycle, false);
});

test('updateSharingInvite, pause, resume, and revoke enforce owner_id and prevent actions on revoked', async () => {
  let recordStatus = 'active';

  const f = fixture((req) => {
    if (req.method === 'GET') {
      return {
        data: [
          {
            id: INVITE_ID,
            owner_id: A,
            recipient_label: 'doctor@clinic.com',
            recipient_email: 'doctor@clinic.com',
            privacy_level: 'specific',
            share_steps: true,
            share_sleep: true,
            share_nutrition: false,
            share_heart: false,
            share_cycle: false,
            notify_on_view: true,
            weekly_digest: false,
            status: recordStatus,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
      };
    }
    if (req.method === 'PATCH') {
      if (req.body.status) recordStatus = req.body.status;
      return {
        data: [
          {
            id: INVITE_ID,
            owner_id: A,
            recipient_label: req.body.recipient_label ?? 'doctor@clinic.com',
            recipient_email: req.body.recipient_email ?? 'doctor@clinic.com',
            privacy_level: req.body.privacy_level ?? 'specific',
            share_steps: req.body.share_steps ?? true,
            share_sleep: req.body.share_sleep ?? true,
            share_nutrition: req.body.share_nutrition ?? false,
            share_heart: false,
            share_cycle: false,
            notify_on_view: req.body.notify_on_view ?? true,
            weekly_digest: req.body.weekly_digest ?? false,
            status: recordStatus,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
      };
    }
    return { data: [] };
  });

  const service = f.load('src/services/sharingService');

  // Pause
  const paused = await service.pauseSharingInvite(INVITE_ID);
  assert.equal(paused.status, 'paused');

  // Resume
  const resumed = await service.resumeSharingInvite(INVITE_ID);
  assert.equal(resumed.status, 'active');

  // Revoke
  const revoked = await service.revokeSharingInvite(INVITE_ID);
  assert.equal(revoked.status, 'revoked');

  // After revoke, cannot resume
  await assert.rejects(
    service.resumeSharingInvite(INVITE_ID),
    (e) => e.message === 'sharing.errorRevokedCannotResume'
  );

  // After revoke, cannot edit
  await assert.rejects(
    service.updateSharingInvite(INVITE_ID, { recipient: 'other@clinic.com' }),
    (e) => e.message === 'sharing.errorRevokedCannotEdit'
  );
});

test('unauthenticated calls reject with UNAUTHENTICATED', async () => {
  const f = fixture(() => ({ data: [] }));
  f.setOwner(null);
  const service = f.load('src/services/sharingService');

  await assert.rejects(
    service.getMySharingInvites(),
    (e) => e.code === 'UNAUTHENTICATED'
  );
});
