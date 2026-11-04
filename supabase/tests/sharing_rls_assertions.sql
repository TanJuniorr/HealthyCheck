\set ON_ERROR_STOP on
\set a 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
\set b 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
\set c 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
\set legacy '11111111-1111-4111-8111-111111111111'
BEGIN;
CREATE FUNCTION pg_temp.check_result(ok boolean, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAILED: %', label; END IF;
END $$;
CREATE FUNCTION pg_temp.expect_error(command text, expected_code text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE command;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = expected_code THEN RETURN; END IF;
    RAISE;
  END;
  RAISE EXCEPTION 'Expected SQLSTATE %: %', expected_code, command;
END $$;
CREATE FUNCTION pg_temp.metrics(actor uuid, invite uuid, version integer) RETURNS jsonb LANGUAGE sql AS $$
  SELECT public.get_private_shared_metrics(actor, invite, version, 'UTC');
$$;

SELECT pg_temp.check_result((SELECT count(*) = 2 AND bool_and(privacy_level = 'specific')
  FROM public.sharing_invites), 'all legacy rows retained');
SELECT pg_temp.check_result((SELECT status = 'revoked' FROM public.sharing_invites WHERE id = '22222222-2222-4222-8222-222222222222'), 'legacy without a recipient archived');
SELECT pg_temp.check_result((SELECT status = 'pending' AND recipient_user_id = :'b' AND NOT share_cycle AND NOT weekly_digest
  FROM public.sharing_invites WHERE id = :'legacy'), 'legacy recipient pinned, must consent');
SELECT pg_temp.check_result(NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime'
  AND tablename IN ('step_records','sleep_records','meal_records')), 'raw health tables not streamed');

SET LOCAL ROLE anon;
SELECT pg_temp.expect_error(format('SELECT public.list_private_sharing_invitations(%L)', :'b'), '42501');
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :'a', true);
SELECT pg_temp.expect_error(format('SELECT public.create_private_sharing_invite(%L,%L,true,false,false)', :'a','a@example.test'),'22023');
SELECT pg_temp.expect_error(format('SELECT public.create_private_sharing_invite(%L,%L,true,false,false)', :'a','only a name'),'22023');
SELECT pg_temp.expect_error(format('SELECT public.create_private_sharing_invite(%L,%L,true,false,false)', :'a','missing@example.test'),'22023');
SELECT pg_temp.expect_error(format('SELECT public.create_private_sharing_invite(%L,%L,true,false,false)', :'a','d@example.test'),'22023');
SELECT pg_temp.expect_error(format('SELECT public.create_private_sharing_invite(%L,%L,true,false,false)', :'b','c@example.test'),'42501');
SELECT pg_temp.expect_error(format('SELECT public.create_private_sharing_invite(%L,%L,true,false,false)', :'a','b@example.test'),'23505');
SELECT pg_temp.expect_error(format('SELECT public.change_private_sharing_invite(%L,%L,0,%L)', :'a', :'legacy', 'accept'),'42501');
SELECT pg_temp.expect_error('UPDATE public.sharing_invites SET status = ''active''','42501');
SELECT pg_temp.expect_error('INSERT INTO public.sharing_invites DEFAULT VALUES','42501');
SELECT pg_temp.expect_error('DELETE FROM public.sharing_invites','42501');
SELECT pg_temp.expect_error('UPDATE public.app_notifications SET payload = ''{}''','42501');
SELECT pg_temp.expect_error(format('SELECT public.change_private_sharing_invite(%L,%L,0,%L)', :'a', :'legacy', 'resume'),'22023');
SELECT public.change_private_sharing_invite(:'a', :'legacy', 0, 'revoke');
SELECT id AS invite FROM public.create_private_sharing_invite(:'a', ' B@EXAMPLE.TEST ', true, false, true) \gset
SELECT pg_temp.check_result((SELECT status = 'pending' AND recipient_user_id = :'b' AND recipient_email='b@example.test' FROM public.sharing_invites WHERE id=:'invite'), 'recipient resolved and normalized');

SELECT set_config('request.jwt.claim.sub', :'c', true);
SELECT set_config('request.jwt.claim.email', 'b@example.test', true);
SELECT pg_temp.check_result(NOT EXISTS (SELECT 1 FROM public.sharing_invites WHERE id = :'invite'), 'email alone cannot read');
SELECT pg_temp.check_result(pg_temp.metrics(:'b', :'invite', 0) IS NULL, 'wrong account cannot spoof recipient');
SELECT pg_temp.check_result(NOT EXISTS (SELECT 1 FROM public.app_notifications), 'unrelated account cannot read inbox');
SELECT pg_temp.expect_error(format('SELECT public.change_private_sharing_invite(%L,%L,0,%L)', :'c', :'invite', 'accept'),'42501');

SELECT set_config('request.jwt.claim.sub', :'b', true);
SELECT pg_temp.check_result(pg_temp.metrics(:'b', :'invite', 0) IS NULL, 'pending has no metrics');
SELECT pg_temp.check_result((SELECT owner_name = 'User A' FROM public.list_private_sharing_invitations(:'b') WHERE invite_id=:'invite'), 'safe display projection');
SELECT pg_temp.check_result(NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = :'a'), 'private profile not exposed');
SELECT pg_temp.check_result(NOT EXISTS (SELECT 1 FROM public.step_records WHERE user_id = :'a'), 'raw records inaccessible');
SELECT pg_temp.check_result((SELECT count(*) = 1 AND bool_and(payload = '{}') FROM public.app_notifications WHERE reference_id=:'invite'), 'recipient gets a single safe invitation notification');
UPDATE public.app_notifications SET read_at=now() WHERE reference_id=:'invite';
SELECT pg_temp.check_result((SELECT read_at IS NOT NULL FROM public.app_notifications WHERE reference_id=:'invite'), 'recipient can mark read');
SELECT pg_temp.expect_error(format('SELECT public.change_private_sharing_invite(%L,%L,0,%L,true,true,true,true)', :'b', :'invite', 'edit'),'42501');
SELECT public.change_private_sharing_invite(:'b', :'invite', 0, 'accept');
SELECT pg_temp.expect_error(format('SELECT public.change_private_sharing_invite(%L,%L,0,%L)', :'b', :'invite', 'accept'),'40001');
SELECT pg_temp.check_result((pg_temp.metrics(:'b', :'invite', 1)->>'stepsToday')::int = 8123, 'steps visible after acceptance');
SELECT pg_temp.check_result((pg_temp.metrics(:'b', :'invite', 1)->'nutrition'->>'calories')::numeric = 300, 'nutrition aggregates');
SELECT pg_temp.check_result(pg_temp.metrics(:'b', :'invite', 1)->'sleep' = 'null', 'disabled sleep absent');
SELECT pg_temp.check_result(NOT EXISTS (SELECT 1 FROM public.sleep_records WHERE user_id=:'a'), 'direct sleep API cannot bypass grants');
WITH changed AS (UPDATE public.step_records SET steps = 0 WHERE user_id=:'a' RETURNING *) SELECT pg_temp.check_result(NOT EXISTS (SELECT 1 FROM changed), 'recipient cannot update owner data');
WITH removed AS (DELETE FROM public.meal_records WHERE user_id=:'a' RETURNING *) SELECT pg_temp.check_result(NOT EXISTS (SELECT 1 FROM removed), 'recipient cannot delete owner data');
SELECT pg_temp.expect_error(format('INSERT INTO public.step_records (user_id,steps) VALUES (%L,1)', :'a'),'42501');

SELECT set_config('request.jwt.claim.sub', :'a', true);
SELECT pg_temp.check_result((SELECT count(*) = 1 FROM public.app_notifications WHERE reference_id=:'invite' AND kind='sharing_accepted'), 'accepted notice once to owner');
UPDATE public.step_records SET record_date = (now() AT TIME ZONE 'UTC')::date - 1 WHERE user_id=:'a';
SELECT set_config('request.jwt.claim.sub', :'b', true);
SELECT pg_temp.check_result(pg_temp.metrics(:'b', :'invite', 1)->'stepsToday' = 'null', 'no daily record returns null');
SELECT set_config('request.jwt.claim.sub', :'a', true);
UPDATE public.step_records SET record_date = (now() AT TIME ZONE 'UTC')::date, steps = 0 WHERE user_id=:'a';
SELECT pg_temp.expect_error(format('INSERT INTO public.step_records (user_id,record_date,steps) VALUES (%L,(now() AT TIME ZONE ''UTC'')::date,1)', :'a'),'23505');
SELECT set_config('request.jwt.claim.sub', :'b', true);
SELECT pg_temp.check_result(pg_temp.metrics(:'b', :'invite', 1)->'stepsToday' = '0', 'explicit zero preserved');
SELECT set_config('request.jwt.claim.sub', :'a', true);
UPDATE public.step_records SET steps = 8124 WHERE user_id=:'a';
SELECT pg_temp.check_result((SELECT metrics_updated_at IS NOT NULL AND version=1 FROM public.sharing_invites WHERE id=:'invite'), 'data update signals without altering consent version');
SELECT public.change_private_sharing_invite(:'a', :'invite', 1, 'pause');
SELECT set_config('request.jwt.claim.sub', :'b', true);
SELECT pg_temp.check_result(pg_temp.metrics(:'b', :'invite', 2) IS NULL, 'pause removes access');
SELECT set_config('request.jwt.claim.sub', :'a', true);
SELECT public.change_private_sharing_invite(:'a', :'invite', 2, 'resume');
SELECT pg_temp.expect_error(format('SELECT public.change_private_sharing_invite(%L,%L,3,%L,true,true,false,false)', :'a', :'invite', 'edit'),'22023');
SELECT public.change_private_sharing_invite(:'a', :'invite', 3, 'edit', true, true, false, true);
SELECT set_config('request.jwt.claim.sub', :'b', true);
SELECT pg_temp.check_result(pg_temp.metrics(:'b', :'invite', 3) IS NULL, 'stale permission version invalid');
SELECT pg_temp.check_result(pg_temp.metrics(:'b', :'invite', 4)->'nutrition' = 'null', 'removed nutrition unavailable');
SELECT pg_temp.check_result(NOT EXISTS (SELECT 1 FROM public.meal_records WHERE user_id=:'a'), 'meal API cannot recover revoked scope');
SELECT pg_temp.check_result(pg_temp.metrics(:'b', :'invite', 4)->'sleep'->>'start' IS NOT NULL AND NOT (pg_temp.metrics(:'b', :'invite', 4)->'sleep' ? 'notes'), 'added sleep excludes private notes');
SELECT set_config('request.jwt.claim.sub', :'a', true);
SELECT public.change_private_sharing_invite(:'a', :'invite', 4, 'revoke');
SELECT pg_temp.expect_error(format('SELECT public.change_private_sharing_invite(%L,%L,5,%L)', :'a', :'invite', 'resume'),'22023');
SELECT set_config('request.jwt.claim.sub', :'b', true);
SELECT pg_temp.check_result(pg_temp.metrics(:'b', :'invite', 5) IS NULL, 'revoked no metrics');
SELECT pg_temp.check_result((SELECT count(*)=5 AND bool_and(payload='{}') FROM public.app_notifications WHERE reference_id=:'invite'), 'correct nonduplicated recipient lifecycle notifications');

SELECT set_config('request.jwt.claim.sub', :'a', true);
SELECT id AS next_invite FROM public.create_private_sharing_invite(:'a', 'b@example.test', true, false, false) \gset
SELECT set_config('request.jwt.claim.sub', :'b', true);
SELECT public.change_private_sharing_invite(:'b', :'next_invite', 0, 'reject');
SELECT pg_temp.check_result(pg_temp.metrics(:'b', :'next_invite', 1) IS NULL, 'rejected has no data');
SELECT set_config('request.jwt.claim.sub', :'a', true);
SELECT pg_temp.expect_error(format('SELECT public.change_private_sharing_invite(%L,%L,1,%L)', :'a', :'next_invite', 'resume'),'22023');
SELECT pg_temp.check_result((SELECT count(*)=1 FROM public.app_notifications WHERE reference_id=:'next_invite' AND kind='sharing_rejected'), 'rejection routed to sender');
SELECT id AS deleted_invite FROM public.create_private_sharing_invite(:'a', 'b@example.test', true, false, false) \gset
SELECT id AS hard_deleted_invite FROM public.create_private_sharing_invite(:'a', 'c@example.test', true, false, false) \gset
RESET ROLE;
UPDATE auth.users SET deleted_at=now() WHERE id=:'b';
SELECT pg_temp.check_result((SELECT recipient_user_id IS NULL AND status='revoked' FROM public.sharing_invites WHERE id=:'deleted_invite'), 'recipient deletion removes binding');
DELETE FROM auth.users WHERE id=:'c';
SELECT pg_temp.check_result((SELECT recipient_user_id IS NULL AND status='revoked' FROM public.sharing_invites WHERE id=:'hard_deleted_invite'), 'hard deletion preserves revoked history');
DELETE FROM auth.users WHERE id=:'a';
SELECT pg_temp.check_result(NOT EXISTS (SELECT 1 FROM public.sharing_invites WHERE owner_id=:'a'), 'owner deletion removes grants');
ROLLBACK;
\echo 'Sharing RLS integration checks passed'
