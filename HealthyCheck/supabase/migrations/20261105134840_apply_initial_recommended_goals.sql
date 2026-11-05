-- No generic step/calorie target: unsupported estimates remain visibly unset.
-- Existing accounts and their goal history are left intact.
ALTER TABLE public.health_goals
 ALTER COLUMN daily_steps DROP DEFAULT,
 ALTER COLUMN daily_steps DROP NOT NULL,
 ALTER COLUMN daily_calories DROP DEFAULT,
 ALTER COLUMN daily_calories DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 INSERT INTO public.profiles(id,full_name)
 VALUES(NEW.id,NEW.raw_user_meta_data->>'full_name') ON CONFLICT(id) DO NOTHING;
 -- Goals are initialized atomically with the completed health profile.
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC,anon,authenticated;

-- A single signature with defaults also supports older six-argument clients.
DROP FUNCTION public.complete_health_onboarding(date,text,numeric,numeric,text,text);
CREATE FUNCTION public.complete_health_onboarding(
 p_date_of_birth date, p_gender text, p_height_cm numeric, p_weight_kg numeric,
 p_activity_level text, p_weight_goal text,
 p_initial_goals jsonb DEFAULT '{}'::jsonb, p_time_zone text DEFAULT 'UTC',
 p_expected_owner uuid DEFAULT auth.uid()
) RETURNS SETOF public.profiles
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE
 owner_id uuid:=auth.uid();
 profile public.profiles%ROWTYPE;
 previous_goal public.health_goals%ROWTYPE;
 local_date date;
 field text;
 value jsonb;
BEGIN
 IF owner_id IS NULL OR owner_id IS DISTINCT FROM p_expected_owner THEN
  RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
 END IF;
 INSERT INTO public.profiles(id) VALUES(owner_id) ON CONFLICT(id) DO NOTHING;
 SELECT * INTO profile FROM public.profiles WHERE id=owner_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Profile unavailable' USING ERRCODE='42501'; END IF;
 -- Lost-response retries never reset subsequently edited goals or profiles.
 IF profile.health_onboarding_completed_at IS NOT NULL THEN RETURN NEXT profile; RETURN; END IF;
 IF p_date_of_birth IS NULL OR NOT isfinite(p_date_of_birth) OR p_date_of_birth>current_date OR p_date_of_birth<'0001-01-01'::date
  OR p_gender IS NULL OR p_gender NOT IN ('male','female','other','prefer_not_to_say')
  OR p_height_cm IS NULL OR p_height_cm NOT BETWEEN 30 AND 300
  OR p_weight_kg IS NULL OR p_weight_kg<=0 OR p_weight_kg>500 OR round(p_weight_kg,2)<=0
  OR p_activity_level IS NULL OR p_activity_level NOT IN ('sedentary','lightly_active','moderately_active','very_active','extremely_active')
  OR p_weight_goal IS NULL OR p_weight_goal NOT IN ('lose_fat_slow','lose_fat','maintain','gain_weight_slow','gain_weight') THEN
  RAISE EXCEPTION 'Invalid health onboarding fields' USING ERRCODE='22023';
 END IF;
 IF p_time_zone IS NULL OR NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=p_time_zone)
  OR p_initial_goals IS NULL OR jsonb_typeof(p_initial_goals)<>'object' THEN
  RAISE EXCEPTION 'Invalid initial health goals' USING ERRCODE='22023';
 END IF;
 FOR field,value IN SELECT * FROM jsonb_each(p_initial_goals) LOOP
  IF field NOT IN ('daily_steps','daily_calories') THEN
   RAISE EXCEPTION 'Invalid initial health goals' USING ERRCODE='22023';
  END IF;
  IF value='null'::jsonb THEN CONTINUE; END IF;
  IF jsonb_typeof(value)<>'number' THEN RAISE EXCEPTION 'Invalid initial health goals' USING ERRCODE='22023'; END IF;
  IF (value::text)::numeric<=0 OR (value::text)::numeric>2147483647 OR trunc((value::text)::numeric)<>(value::text)::numeric THEN
   RAISE EXCEPTION 'Invalid initial health goals' USING ERRCODE='22023';
  END IF;
 END LOOP;
 local_date:=(clock_timestamp() AT TIME ZONE p_time_zone)::date;
 UPDATE public.profiles SET date_of_birth=p_date_of_birth,gender=p_gender,height_cm=p_height_cm,
  activity_level=p_activity_level,weight_goal=p_weight_goal WHERE id=owner_id;
 IF NOT EXISTS(SELECT 1 FROM public.weight_records WHERE id=(
  SELECT id FROM public.weight_records WHERE user_id=owner_id AND recorded_at<=now()
  ORDER BY recorded_at DESC,created_at DESC,id DESC LIMIT 1
 ) AND user_id=owner_id AND weight_kg=round(p_weight_kg,2)) THEN
  INSERT INTO public.weight_records(user_id,weight_kg) VALUES(owner_id,p_weight_kg);
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(owner_id::text,0));
 SELECT * INTO previous_goal FROM public.health_goals WHERE user_id=owner_id AND effective_from<=local_date
  ORDER BY effective_from DESC,created_at DESC,id DESC LIMIT 1;
 INSERT INTO public.health_goals(user_id,daily_steps,daily_calories,daily_water_ml,target_sleep_minutes,effective_from,created_at)
 VALUES(owner_id,(p_initial_goals->>'daily_steps')::integer,(p_initial_goals->>'daily_calories')::integer,
  coalesce(previous_goal.daily_water_ml,2000),coalesce(previous_goal.target_sleep_minutes,480),local_date,clock_timestamp());
 UPDATE public.profiles SET health_onboarding_completed_at=now() WHERE id=owner_id RETURNING * INTO profile;
 RETURN NEXT profile;
END $$;
REVOKE ALL ON FUNCTION public.complete_health_onboarding(date,text,numeric,numeric,text,text,jsonb,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.complete_health_onboarding(date,text,numeric,numeric,text,text,jsonb,text,uuid) TO authenticated;
