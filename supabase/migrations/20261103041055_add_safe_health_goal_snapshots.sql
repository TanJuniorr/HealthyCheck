-- Verified live schema has UNIQUE(user_id,effective_from). Allow append-only
-- same-day snapshots without deleting or changing any existing goal values.
ALTER TABLE public.health_goals DROP CONSTRAINT health_goals_user_id_effective_from_key;
CREATE INDEX health_goals_owner_latest_idx ON public.health_goals(user_id,effective_from DESC,created_at DESC,id DESC);

-- Serialize both the snapshot API and existing direct writes for the same owner.
CREATE FUNCTION public.lock_health_goal_owner() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended((CASE WHEN TG_OP='DELETE' THEN OLD.user_id ELSE NEW.user_id END)::text,0));
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 -- A waiting legacy INSERT can have a transaction-start timestamp older than
 -- the snapshot that committed before it. Keep same-day ordering monotonic.
 IF TG_OP='INSERT' AND NEW.created_at IS NOT NULL THEN
  SELECT greatest(NEW.created_at,max(g.created_at)+interval '1 microsecond') INTO NEW.created_at
   FROM public.health_goals g WHERE g.user_id=NEW.user_id AND g.effective_from=NEW.effective_from;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.lock_health_goal_owner() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER health_goals_lock_owner BEFORE INSERT OR UPDATE OR DELETE ON public.health_goals
 FOR EACH ROW EXECUTE FUNCTION public.lock_health_goal_owner();

CREATE FUNCTION public.save_health_goal_snapshot(
 p_expected_owner uuid, p_expected_id uuid, p_expected_values jsonb, p_changes jsonb, p_local_date date, p_time_zone text
) RETURNS SETOF public.health_goals
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE
 owner_id uuid:=auth.uid();
 current_goal public.health_goals%ROWTYPE;
 saved public.health_goals%ROWTYPE;
 current_values jsonb;
 merged jsonb;
 field text;
 value jsonb;
BEGIN
 IF owner_id IS NULL OR owner_id IS DISTINCT FROM p_expected_owner THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 IF p_time_zone IS NULL OR NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=p_time_zone)
  OR p_local_date IS NULL OR p_local_date IS DISTINCT FROM (clock_timestamp() AT TIME ZONE p_time_zone)::date THEN
  RAISE EXCEPTION 'goals.dayChanged' USING ERRCODE='22023';
 END IF;
 IF p_changes IS NULL OR jsonb_typeof(p_changes)<>'object' OR p_changes='{}'::jsonb THEN
  RAISE EXCEPTION 'goals.invalid' USING ERRCODE='22023';
 END IF;
 FOR field,value IN SELECT * FROM jsonb_each(p_changes) LOOP
  IF field NOT IN ('daily_steps','daily_calories','daily_water_ml','target_sleep_minutes')
   OR jsonb_typeof(value)<>'number' THEN RAISE EXCEPTION 'goals.invalid' USING ERRCODE='22023'; END IF;
  IF (value::text)::numeric<=0 OR (value::text)::numeric>2147483647 OR trunc((value::text)::numeric)<>(value::text)::numeric THEN
   RAISE EXCEPTION 'goals.invalid' USING ERRCODE='22023';
  END IF;
 END LOOP;
 PERFORM pg_advisory_xact_lock(hashtextextended(owner_id::text,0));
 SELECT * INTO current_goal FROM public.health_goals WHERE user_id=owner_id AND effective_from<=p_local_date
  ORDER BY effective_from DESC,created_at DESC,id DESC LIMIT 1;
 IF FOUND THEN
  current_values:=jsonb_build_object('daily_steps',current_goal.daily_steps,'daily_calories',current_goal.daily_calories,
   'daily_water_ml',current_goal.daily_water_ml,'target_sleep_minutes',current_goal.target_sleep_minutes);
  -- Lost-response retries and already-matching targets are no-ops, even when
  -- the original expected snapshot is now old. Never mutate the other fields.
  IF NOT EXISTS(SELECT 1 FROM jsonb_each(p_changes) c WHERE current_values->c.key IS DISTINCT FROM c.value) THEN
   RETURN NEXT current_goal; RETURN;
  END IF;
  IF p_expected_id IS DISTINCT FROM current_goal.id OR p_expected_values IS DISTINCT FROM current_values THEN
   RAISE EXCEPTION 'goals.conflict' USING ERRCODE='40001';
  END IF;
  merged:=current_values||p_changes;
 ELSE
  IF p_expected_id IS NOT NULL OR p_expected_values IS NOT NULL THEN RAISE EXCEPTION 'goals.conflict' USING ERRCODE='40001'; END IF;
  IF NOT (p_changes ?& ARRAY['daily_steps','daily_calories','daily_water_ml','target_sleep_minutes']) THEN
   RAISE EXCEPTION 'goals.completeFirst' USING ERRCODE='22023';
  END IF;
  merged:=p_changes;
 END IF;
 INSERT INTO public.health_goals(user_id,daily_steps,daily_calories,daily_water_ml,target_sleep_minutes,effective_from,created_at)
 VALUES(owner_id,(merged->>'daily_steps')::integer,(merged->>'daily_calories')::integer,(merged->>'daily_water_ml')::integer,
  (merged->>'target_sleep_minutes')::integer,p_local_date,
  clock_timestamp()) RETURNING * INTO saved;
 RETURN NEXT saved;
END $$;
REVOKE ALL ON FUNCTION public.save_health_goal_snapshot(uuid,uuid,jsonb,jsonb,date,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_health_goal_snapshot(uuid,uuid,jsonb,jsonb,date,text) TO authenticated;
