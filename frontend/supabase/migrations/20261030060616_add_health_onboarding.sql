ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS health_onboarding_completed_at timestamptz;

-- RLS remains unchanged. The invoker uses only auth.uid(), never a client owner ID.
CREATE OR REPLACE FUNCTION public.complete_health_onboarding(
 p_date_of_birth date, p_gender text, p_height_cm numeric, p_weight_kg numeric
) RETURNS SETOF public.profiles
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
 owner_id uuid := auth.uid();
 profile public.profiles%ROWTYPE;
BEGIN
 IF owner_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 INSERT INTO public.profiles(id) VALUES(owner_id) ON CONFLICT(id) DO NOTHING;
 SELECT * INTO profile FROM public.profiles WHERE id=owner_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Profile unavailable' USING ERRCODE='42501'; END IF;
 -- The profile row lock serializes concurrent retries, including after a lost response.
 IF profile.health_onboarding_completed_at IS NOT NULL THEN RETURN NEXT profile; RETURN; END IF;
 IF p_date_of_birth IS NULL OR NOT isfinite(p_date_of_birth) OR p_date_of_birth>current_date OR p_date_of_birth<'0001-01-01'::date
  OR p_gender IS NULL OR p_gender NOT IN ('male','female','other','prefer_not_to_say')
  OR p_height_cm IS NULL OR p_height_cm NOT BETWEEN 30 AND 300
  OR p_weight_kg IS NULL OR p_weight_kg<=0 OR p_weight_kg>500 OR round(p_weight_kg,2)<=0 THEN
  RAISE EXCEPTION 'Invalid health onboarding fields' USING ERRCODE='22023';
 END IF;
 UPDATE public.profiles SET date_of_birth=p_date_of_birth,gender=p_gender,height_cm=p_height_cm WHERE id=owner_id;
 -- Match the numeric(5,2) precision of the existing weight history; reuse an identical latest reading.
 IF NOT EXISTS (SELECT 1 FROM public.weight_records WHERE id=(
  SELECT id FROM public.weight_records WHERE user_id=owner_id AND recorded_at<=now()
  ORDER BY recorded_at DESC,created_at DESC,id DESC LIMIT 1
 ) AND user_id=owner_id AND weight_kg=round(p_weight_kg,2)) THEN
  INSERT INTO public.weight_records(user_id,weight_kg) VALUES(owner_id,p_weight_kg);
 END IF;
 UPDATE public.profiles SET health_onboarding_completed_at=now() WHERE id=owner_id RETURNING * INTO profile;
 RETURN NEXT profile;
END $$;
REVOKE ALL ON FUNCTION public.complete_health_onboarding(date,text,numeric,numeric) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.complete_health_onboarding(date,text,numeric,numeric) TO authenticated;

-- Guard the marker even on direct owner-scoped REST writes. Later edits may clear
-- individual profile fields, but completion is permanent and cannot be reset by clients.
CREATE OR REPLACE FUNCTION public.validate_health_onboarding_marker()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
 IF TG_OP='UPDATE' AND OLD.health_onboarding_completed_at IS NOT NULL THEN
  IF NEW.health_onboarding_completed_at IS DISTINCT FROM OLD.health_onboarding_completed_at THEN
   RAISE EXCEPTION 'Onboarding completion is permanent' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
 END IF;
 IF NEW.health_onboarding_completed_at IS NOT NULL AND (
  NEW.date_of_birth IS NULL OR NOT isfinite(NEW.date_of_birth) OR NEW.date_of_birth>current_date OR NEW.date_of_birth<'0001-01-01'::date
  OR NEW.gender IS NULL OR NEW.gender NOT IN ('male','female','other','prefer_not_to_say')
  OR NEW.height_cm IS NULL OR NEW.height_cm NOT BETWEEN 30 AND 300
  OR NOT EXISTS (SELECT 1 FROM public.weight_records WHERE user_id=NEW.id AND weight_kg>0 AND weight_kg<=500 AND recorded_at<=now())
 ) THEN RAISE EXCEPTION 'Health onboarding is incomplete' USING ERRCODE='23514'; END IF;
 IF NEW.health_onboarding_completed_at IS NOT NULL THEN NEW.health_onboarding_completed_at:=now(); END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.validate_health_onboarding_marker() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER profiles_validate_health_onboarding_marker
 BEFORE INSERT OR UPDATE OF health_onboarding_completed_at ON public.profiles
 FOR EACH ROW EXECUTE FUNCTION public.validate_health_onboarding_marker();

-- Existing valid profiles are recognized without creating or modifying weight records.
UPDATE public.profiles p SET health_onboarding_completed_at=now()
WHERE p.health_onboarding_completed_at IS NULL AND p.date_of_birth IS NOT NULL
 AND isfinite(p.date_of_birth) AND p.date_of_birth BETWEEN '0001-01-01'::date AND current_date
 AND p.gender IN ('male','female','other','prefer_not_to_say') AND p.height_cm BETWEEN 30 AND 300
 AND EXISTS (SELECT 1 FROM public.weight_records w WHERE w.user_id=p.id AND w.weight_kg>0 AND w.weight_kg<=500 AND w.recorded_at<=now());
