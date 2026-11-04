-- Apply after the existing sharing, notification and recipient-read migrations.
BEGIN;

DROP TRIGGER IF EXISTS sharing_invite_received_notification ON public.sharing_invites;
DROP TRIGGER IF EXISTS auth_user_pending_share_notifications ON auth.users;
DROP FUNCTION IF EXISTS public.create_sharing_received_notification();
DROP FUNCTION IF EXISTS public.notify_pending_shares_for_new_user();
DROP FUNCTION IF EXISTS public.sharing_recipient_exists(text);

DROP POLICY IF EXISTS "Recipients can view invites addressed to them" ON public.sharing_invites;
DROP POLICY IF EXISTS "Users can insert own sharing invites" ON public.sharing_invites;
DROP POLICY IF EXISTS "Users can update own sharing invites" ON public.sharing_invites;
DROP POLICY IF EXISTS "Users can delete own sharing invites" ON public.sharing_invites;
DROP POLICY IF EXISTS "Recipients can view sharer display profile" ON public.profiles;
DROP POLICY IF EXISTS "Recipients can view shared steps" ON public.step_records;
DROP POLICY IF EXISTS "Recipients can view shared sleep" ON public.sleep_records;
DROP POLICY IF EXISTS "Recipients can view shared meals" ON public.meal_records;

REVOKE ALL ON public.sharing_invites, public.app_notifications FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.sharing_invites, public.app_notifications TO authenticated;
GRANT UPDATE (read_at) ON public.app_notifications TO authenticated;

ALTER TABLE public.sharing_invites
  DROP CONSTRAINT sharing_invites_status_check,
  DROP CONSTRAINT sharing_invites_privacy_level_check,
  ALTER COLUMN status SET DEFAULT 'pending',
  ADD COLUMN recipient_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN accepted_at timestamptz,
  ADD COLUMN version integer NOT NULL DEFAULT 0,
  ADD COLUMN metrics_updated_at timestamptz;

-- The old delivery record is evidence of which account received the invitation.
-- A recycled email alone cannot rebind an existing share to a different account.
WITH matches AS (
  SELECT i.id, u.id AS recipient,
    row_number() OVER (PARTITION BY i.owner_id, u.id ORDER BY i.created_at DESC, i.id DESC) AS priority
  FROM public.sharing_invites i
  JOIN auth.users u ON lower(btrim(u.email)) = lower(btrim(i.recipient_email))
  JOIN public.app_notifications n ON n.reference_id = i.id AND n.recipient_user_id = u.id
    AND n.kind = 'sharing_received'
  WHERE i.status IN ('active', 'paused') AND u.id <> i.owner_id
    AND u.email_confirmed_at IS NOT NULL AND u.deleted_at IS NULL
    AND (i.share_steps OR i.share_sleep OR i.share_nutrition)
    AND NOT EXISTS (
      SELECT 1 FROM public.app_notifications other
      WHERE other.reference_id = i.id AND other.kind = 'sharing_received'
        AND other.recipient_user_id <> u.id
    )
)
UPDATE public.sharing_invites i SET recipient_user_id = m.recipient
FROM matches m WHERE m.id = i.id AND m.priority = 1;

-- Legacy rows have no acceptance record. Preserve them and their scope, but
-- require consent before any existing account can read health data again.
UPDATE public.sharing_invites SET
  status = CASE WHEN recipient_user_id IS NOT NULL THEN 'pending' ELSE 'revoked' END,
  recipient_email = nullif(lower(btrim(recipient_email)), ''),
  privacy_level = 'specific', share_cycle = false, notify_on_view = false, weekly_digest = false;
-- Some installations removed share_heart before this migration.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sharing_invites' AND column_name = 'share_heart') THEN
    EXECUTE 'UPDATE public.sharing_invites SET share_heart = false';
    EXECUTE 'ALTER TABLE public.sharing_invites ADD CONSTRAINT sharing_no_heart CHECK (NOT share_heart)';
  END IF;
END $$;

ALTER TABLE public.sharing_invites
  ADD CONSTRAINT sharing_invites_status_check CHECK (status IN ('pending','active','paused','rejected','revoked')),
  ADD CONSTRAINT sharing_invites_privacy_level_check CHECK (privacy_level = 'specific'),
  ADD CONSTRAINT sharing_invites_supported_options CHECK (NOT share_cycle AND NOT notify_on_view AND NOT weekly_digest),
  ADD CONSTRAINT sharing_invites_distinct_users CHECK (recipient_user_id <> owner_id),
  ADD CONSTRAINT sharing_invites_recipient_required CHECK (
    status = 'revoked' OR (recipient_user_id IS NOT NULL AND recipient_email IS NOT NULL
      AND (share_steps OR share_sleep OR share_nutrition))
  ),
  ADD CONSTRAINT sharing_invites_consent_required CHECK (
    status = 'revoked' OR (accepted_at IS NOT NULL) = (status IN ('active','paused'))
  );

CREATE UNIQUE INDEX sharing_invites_open_pair_idx ON public.sharing_invites(owner_id, recipient_user_id)
  WHERE status IN ('pending','active','paused');
CREATE INDEX sharing_invites_recipient_idx ON public.sharing_invites(recipient_user_id, created_at DESC);
DROP INDEX IF EXISTS public.idx_sharing_invites_recipient_email;

CREATE POLICY "Recipients can view their account invitations" ON public.sharing_invites
  FOR SELECT TO authenticated USING (recipient_user_id = (SELECT auth.uid()));

ALTER TABLE public.app_notifications
  ADD COLUMN event_version integer NOT NULL DEFAULT 0,
  DROP CONSTRAINT app_notifications_reference_unique,
  ADD CONSTRAINT app_notifications_event_unique UNIQUE (recipient_user_id, kind, reference_id, event_version);

-- Sharing messages link to current invitation state instead of copying emails,
-- scopes or health information into the inbox.
UPDATE public.app_notifications n SET payload = '{}',
  read_at = CASE WHEN i.status = 'pending' AND i.recipient_user_id = n.recipient_user_id THEN NULL ELSE n.read_at END
FROM public.sharing_invites i WHERE n.reference_id = i.id AND n.kind = 'sharing_received';

CREATE SCHEMA IF NOT EXISTS sharing_private;
REVOKE ALL ON SCHEMA sharing_private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA sharing_private TO authenticated;

CREATE FUNCTION sharing_private.emit_notice(p_to uuid, p_kind text, p_id uuid, p_version integer)
RETURNS void LANGUAGE sql SET search_path = '' AS $$
  INSERT INTO public.app_notifications(recipient_user_id, kind, reference_id, event_version)
  VALUES (p_to, p_kind, p_id, p_version)
  ON CONFLICT (recipient_user_id, kind, reference_id, event_version) DO NOTHING;
$$;
REVOKE ALL ON FUNCTION sharing_private.emit_notice(uuid,text,uuid,integer) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION sharing_private.create_invite(
  p_actor uuid, p_email text, p_steps boolean, p_sleep boolean, p_nutrition boolean
) RETURNS public.sharing_invites
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  actor uuid := auth.uid();
  normalized_email text := lower(btrim(p_email));
  target uuid;
  result public.sharing_invites;
BEGIN
  IF actor IS NULL OR actor IS DISTINCT FROM p_actor THEN
    RAISE EXCEPTION 'sharing.errorAccountChanged' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = actor AND u.deleted_at IS NULL AND u.email_confirmed_at IS NOT NULL) THEN
    RAISE EXCEPTION 'sharing.errorInviteUnavailable' USING ERRCODE = '42501';
  END IF;
  IF normalized_email IS NULL OR char_length(normalized_email) > 254 OR normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' THEN
    RAISE EXCEPTION 'sharing.errorInvalidEmail' USING ERRCODE = '22023';
  END IF;
  IF p_steps IS NULL OR p_sleep IS NULL OR p_nutrition IS NULL OR NOT (p_steps OR p_sleep OR p_nutrition) THEN
    RAISE EXCEPTION 'sharing.errorNoCategorySelected' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM auth.users u WHERE u.id = actor AND lower(btrim(u.email)) = normalized_email) THEN
    RAISE EXCEPTION 'sharing.errorSelfShare' USING ERRCODE = '22023';
  END IF;
  -- Resolve only while sending; never expose a standalone account lookup.
  SELECT (array_agg(u.id))[1] INTO target
  FROM auth.users u WHERE lower(btrim(u.email)) = normalized_email AND u.email_confirmed_at IS NOT NULL
    AND u.deleted_at IS NULL AND (u.banned_until IS NULL OR u.banned_until <= now())
  HAVING count(*) = 1;
  IF target IS NULL OR target = actor THEN
    RAISE EXCEPTION 'sharing.errorRecipientUnavailable' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.sharing_invites(owner_id, recipient_user_id, recipient_label, recipient_email,
    share_steps, share_sleep, share_nutrition)
  VALUES (actor, target, normalized_email, normalized_email, p_steps, p_sleep, p_nutrition)
  ON CONFLICT (owner_id, recipient_user_id) WHERE status IN ('pending','active','paused') DO NOTHING
  RETURNING * INTO result;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'sharing.errorDuplicateInvite' USING ERRCODE = '23505';
  END IF;
  PERFORM sharing_private.emit_notice(target, 'sharing_received', result.id, result.version);
  RETURN result;
END $$;

CREATE FUNCTION sharing_private.change_invite(
  p_actor uuid, p_id uuid, p_version integer, p_action text,
  p_steps boolean, p_sleep boolean, p_nutrition boolean, p_confirm_expansion boolean
) RETURNS public.sharing_invites
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  actor uuid := auth.uid();
  item public.sharing_invites;
  notice text;
  notify_user uuid;
  next_status text;
BEGIN
  IF actor IS NULL OR actor IS DISTINCT FROM p_actor THEN
    RAISE EXCEPTION 'sharing.errorAccountChanged' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO item FROM public.sharing_invites i
  WHERE i.id = p_id AND (
    (p_action IN ('accept','reject') AND i.recipient_user_id = actor)
    OR (p_action IN ('edit','pause','resume','revoke') AND i.owner_id = actor)
  ) FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'sharing.errorInviteUnavailable' USING ERRCODE = '42501';
  END IF;
  IF p_version IS DISTINCT FROM item.version THEN
    RAISE EXCEPTION 'sharing.errorConflict' USING ERRCODE = '40001';
  END IF;
  notify_user := CASE WHEN actor = item.owner_id THEN item.recipient_user_id ELSE item.owner_id END;
  CASE
    WHEN p_action = 'accept' AND item.status = 'pending' THEN next_status := 'active'; notice := 'sharing_accepted';
    WHEN p_action = 'reject' AND item.status = 'pending' THEN next_status := 'rejected'; notice := 'sharing_rejected';
    WHEN p_action = 'pause' AND item.status = 'active' THEN next_status := 'paused'; notice := 'sharing_paused';
    WHEN p_action = 'resume' AND item.status = 'paused' THEN next_status := 'active'; notice := 'sharing_resumed';
    WHEN p_action = 'revoke' AND item.status IN ('pending','active','paused') THEN next_status := 'revoked'; notice := 'sharing_revoked';
    WHEN p_action = 'edit' AND item.status IN ('pending','active') THEN
      IF p_steps IS NULL OR p_sleep IS NULL OR p_nutrition IS NULL OR NOT (p_steps OR p_sleep OR p_nutrition) THEN
        RAISE EXCEPTION 'sharing.errorNoCategorySelected' USING ERRCODE = '22023';
      END IF;
      IF ((p_steps AND NOT item.share_steps) OR (p_sleep AND NOT item.share_sleep)
        OR (p_nutrition AND NOT item.share_nutrition)) AND p_confirm_expansion IS DISTINCT FROM true THEN
        RAISE EXCEPTION 'sharing.errorExpansionNotConfirmed' USING ERRCODE = '22023';
      END IF;
      IF (item.share_steps, item.share_sleep, item.share_nutrition) = (p_steps, p_sleep, p_nutrition) THEN
        RETURN item;
      END IF;
      next_status := item.status; notice := 'sharing_permissions_updated';
    ELSE RAISE EXCEPTION 'sharing.errorInvalidTransition' USING ERRCODE = '22023';
  END CASE;
  UPDATE public.sharing_invites i SET
    status = next_status,
    accepted_at = CASE WHEN p_action = 'accept' THEN clock_timestamp() ELSE i.accepted_at END,
    share_steps = CASE WHEN p_action = 'edit' THEN p_steps ELSE i.share_steps END,
    share_sleep = CASE WHEN p_action = 'edit' THEN p_sleep ELSE i.share_sleep END,
    share_nutrition = CASE WHEN p_action = 'edit' THEN p_nutrition ELSE i.share_nutrition END,
    updated_at = clock_timestamp(), version = i.version + 1, metrics_updated_at = NULL
  WHERE i.id = item.id RETURNING * INTO item;
  PERFORM sharing_private.emit_notice(notify_user, notice, item.id, item.version);
  RETURN item;
END $$;

CREATE FUNCTION sharing_private.incoming_invites(p_actor uuid)
RETURNS TABLE (invite_id uuid, owner_id uuid, owner_name text, avatar_url text, status text,
  share_steps boolean, share_sleep boolean, share_nutrition boolean, version integer, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT i.id, i.owner_id, p.full_name, CASE WHEN p.avatar_url LIKE 'https://%' THEN p.avatar_url END,
    i.status, i.share_steps, i.share_sleep, i.share_nutrition, i.version, i.created_at
  FROM public.sharing_invites i LEFT JOIN public.profiles p ON p.id = i.owner_id
  WHERE i.recipient_user_id = (SELECT auth.uid()) AND i.recipient_user_id = p_actor
  ORDER BY i.created_at DESC, i.id DESC;
$$;

-- The raw records stay owner-only. One database snapshot checks consent and
-- projects exactly the permitted metrics, without sleep notes or meal details.
CREATE FUNCTION sharing_private.shared_metrics(
  p_actor uuid, p_id uuid, p_version integer, p_time_zone text
) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH local_day AS (
    SELECT (statement_timestamp() AT TIME ZONE name)::date AS day, name AS zone
    FROM pg_timezone_names WHERE name = p_time_zone
  )
  SELECT jsonb_build_object(
    'updatedAt', statement_timestamp(),
    'stepsToday', CASE WHEN i.share_steps THEN (
      SELECT sum(s.steps) FROM public.step_records s WHERE s.user_id = i.owner_id AND s.record_date = d.day
    ) END,
    'sleep', CASE WHEN i.share_sleep THEN (
      SELECT jsonb_build_object('start', s.sleep_start, 'end', s.sleep_end)
      FROM public.sleep_records s WHERE s.user_id = i.owner_id ORDER BY s.sleep_end DESC, s.id DESC LIMIT 1
    ) END,
    'nutrition', CASE WHEN i.share_nutrition THEN (
      SELECT jsonb_build_object('calories', sum(m.quantity_g * f.calories_per_100g / 100),
        'protein', sum(m.quantity_g * f.protein_per_100g / 100),
        'carbs', sum(m.quantity_g * f.carbs_per_100g / 100),
        'fat', sum(m.quantity_g * f.fat_per_100g / 100))
      FROM public.meal_records m JOIN public.foods f ON f.id = m.food_id
      WHERE m.user_id = i.owner_id AND m.consumed_at >= (d.day::timestamp AT TIME ZONE d.zone)
        AND m.consumed_at < ((d.day + 1)::timestamp AT TIME ZONE d.zone)
      HAVING count(*) > 0
    ) END)
  FROM public.sharing_invites i CROSS JOIN local_day d
  WHERE i.id = p_id AND i.recipient_user_id = (SELECT auth.uid()) AND i.recipient_user_id = p_actor
    AND i.status = 'active' AND i.accepted_at IS NOT NULL AND i.version = p_version;
$$;

-- Public endpoints run as the caller. Privileged code is kept in the non-API
-- schema and checks the signed-in account, invitation state and version itself.
CREATE FUNCTION public.create_private_sharing_invite(
  p_actor uuid, p_email text, p_steps boolean, p_sleep boolean, p_nutrition boolean
) RETURNS SETOF public.sharing_invites LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT * FROM sharing_private.create_invite(p_actor,p_email,p_steps,p_sleep,p_nutrition);
$$;
CREATE FUNCTION public.change_private_sharing_invite(
  p_actor uuid, p_id uuid, p_version integer, p_action text,
  p_steps boolean DEFAULT NULL, p_sleep boolean DEFAULT NULL, p_nutrition boolean DEFAULT NULL,
  p_confirm_expansion boolean DEFAULT false
) RETURNS SETOF public.sharing_invites LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT * FROM sharing_private.change_invite(p_actor,p_id,p_version,p_action,p_steps,p_sleep,p_nutrition,p_confirm_expansion);
$$;
CREATE FUNCTION public.list_private_sharing_invitations(p_actor uuid)
RETURNS TABLE (invite_id uuid, owner_id uuid, owner_name text, avatar_url text, status text,
  share_steps boolean, share_sleep boolean, share_nutrition boolean, version integer, created_at timestamptz)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT * FROM sharing_private.incoming_invites(p_actor);
$$;
CREATE FUNCTION public.get_private_shared_metrics(
  p_actor uuid, p_id uuid, p_version integer, p_time_zone text
) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT sharing_private.shared_metrics(p_actor,p_id,p_version,p_time_zone);
$$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA sharing_private FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION sharing_private.create_invite(uuid,text,boolean,boolean,boolean),
  sharing_private.change_invite(uuid,uuid,integer,text,boolean,boolean,boolean,boolean),
  sharing_private.incoming_invites(uuid), sharing_private.shared_metrics(uuid,uuid,integer,text) TO authenticated;
REVOKE ALL ON FUNCTION public.create_private_sharing_invite(uuid,text,boolean,boolean,boolean),
  public.change_private_sharing_invite(uuid,uuid,integer,text,boolean,boolean,boolean,boolean),
  public.list_private_sharing_invitations(uuid), public.get_private_shared_metrics(uuid,uuid,integer,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_private_sharing_invite(uuid,text,boolean,boolean,boolean),
  public.change_private_sharing_invite(uuid,uuid,integer,text,boolean,boolean,boolean,boolean),
  public.list_private_sharing_invitations(uuid), public.get_private_shared_metrics(uuid,uuid,integer,text)
  TO authenticated;

CREATE FUNCTION sharing_private.signal_metrics_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  old_owner uuid;
  new_owner uuid;
BEGIN
  IF TG_OP <> 'INSERT' THEN old_owner := OLD.user_id; END IF;
  IF TG_OP <> 'DELETE' THEN new_owner := NEW.user_id; END IF;
  UPDATE public.sharing_invites SET metrics_updated_at = clock_timestamp()
  WHERE owner_id IN (old_owner,new_owner) AND status = 'active' AND accepted_at IS NOT NULL
    AND CASE TG_TABLE_NAME
      WHEN 'step_records' THEN share_steps WHEN 'sleep_records' THEN share_sleep
      WHEN 'meal_records' THEN share_nutrition ELSE false END;
  RETURN NULL;
END $$;

CREATE FUNCTION sharing_private.revoke_deleted_recipient()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.sharing_invites SET status = 'revoked', updated_at = clock_timestamp(), version = version + 1, metrics_updated_at = NULL
  WHERE (recipient_user_id = OLD.id OR owner_id = OLD.id) AND status <> 'revoked';
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  UPDATE public.sharing_invites SET recipient_user_id = NULL WHERE recipient_user_id = OLD.id;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION sharing_private.signal_metrics_change(), sharing_private.revoke_deleted_recipient() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER signal_shared_steps AFTER INSERT OR UPDATE OR DELETE ON public.step_records
  FOR EACH ROW EXECUTE FUNCTION sharing_private.signal_metrics_change();
CREATE TRIGGER signal_shared_sleep AFTER INSERT OR UPDATE OR DELETE ON public.sleep_records
  FOR EACH ROW EXECUTE FUNCTION sharing_private.signal_metrics_change();
CREATE TRIGGER signal_shared_meals AFTER INSERT OR UPDATE OR DELETE ON public.meal_records
  FOR EACH ROW EXECUTE FUNCTION sharing_private.signal_metrics_change();
CREATE TRIGGER revoke_deleted_sharing_recipient BEFORE DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION sharing_private.revoke_deleted_recipient();
CREATE TRIGGER revoke_soft_deleted_sharing_account BEFORE UPDATE OF deleted_at ON auth.users
  FOR EACH ROW WHEN (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL)
  EXECUTE FUNCTION sharing_private.revoke_deleted_recipient();

-- Realtime sends invitation changes, never health rows. No other app consumer
-- subscribes to the three raw health tables.
DO $$
DECLARE table_name text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN RETURN; END IF;
  FOREACH table_name IN ARRAY ARRAY['step_records','sleep_records','meal_records'] LOOP
    IF EXISTS (SELECT 1 FROM pg_publication_tables p WHERE p.pubname = 'supabase_realtime'
      AND p.schemaname = 'public' AND p.tablename = table_name) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', table_name);
    END IF;
  END LOOP;
  FOREACH table_name IN ARRAY ARRAY['sharing_invites','app_notifications'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables p WHERE p.pubname = 'supabase_realtime'
      AND p.schemaname = 'public' AND p.tablename = table_name) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', table_name);
    END IF;
  END LOOP;
END $$;

COMMIT;
