-- Nullable without defaults: existing profiles and completion timestamps stay intact.
ALTER TABLE public.profiles
 ADD COLUMN activity_level text,
 ADD COLUMN weight_goal text,
 ADD CONSTRAINT profiles_activity_level_check CHECK (
  activity_level IN ('sedentary','lightly_active','moderately_active','very_active','extremely_active')
 ),
 ADD CONSTRAINT profiles_weight_goal_check CHECK (
  weight_goal IN ('lose_fat_slow','lose_fat','maintain','gain_weight_slow','gain_weight')
 );

-- Remove the four-argument entry point rather than leaving an overload that can
-- complete new profiles without their lifestyle choices. No parameter defaults.
DROP FUNCTION public.complete_health_onboarding(date,text,numeric,numeric);
CREATE FUNCTION public.complete_health_onboarding(
 p_date_of_birth date, p_gender text, p_height_cm numeric, p_weight_kg numeric,
 p_activity_level text, p_weight_goal text
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
 -- Serialize retries and return the original result after a lost response.
 -- Legacy completed accounts may still have NULL lifestyle choices.
 IF profile.health_onboarding_completed_at IS NOT NULL THEN RETURN NEXT profile; RETURN; END IF;
 IF p_date_of_birth IS NULL OR NOT isfinite(p_date_of_birth) OR p_date_of_birth>current_date OR p_date_of_birth<'0001-01-01'::date
  OR p_gender IS NULL OR p_gender NOT IN ('male','female','other','prefer_not_to_say')
  OR p_height_cm IS NULL OR p_height_cm NOT BETWEEN 30 AND 300
  OR p_weight_kg IS NULL OR p_weight_kg<=0 OR p_weight_kg>500 OR round(p_weight_kg,2)<=0
  OR p_activity_level IS NULL OR p_activity_level NOT IN ('sedentary','lightly_active','moderately_active','very_active','extremely_active')
  OR p_weight_goal IS NULL OR p_weight_goal NOT IN ('lose_fat_slow','lose_fat','maintain','gain_weight_slow','gain_weight') THEN
  RAISE EXCEPTION 'Invalid health onboarding fields' USING ERRCODE='22023';
 END IF;
 UPDATE public.profiles SET date_of_birth=p_date_of_birth,gender=p_gender,height_cm=p_height_cm,
  activity_level=p_activity_level,weight_goal=p_weight_goal WHERE id=owner_id;
 -- Reuse an identical latest weight, preserving numeric(5,2) precision.
 IF NOT EXISTS (SELECT 1 FROM public.weight_records WHERE id=(
  SELECT id FROM public.weight_records WHERE user_id=owner_id AND recorded_at<=now()
  ORDER BY recorded_at DESC,created_at DESC,id DESC LIMIT 1
 ) AND user_id=owner_id AND weight_kg=round(p_weight_kg,2)) THEN
  INSERT INTO public.weight_records(user_id,weight_kg) VALUES(owner_id,p_weight_kg);
 END IF;
 UPDATE public.profiles SET health_onboarding_completed_at=now() WHERE id=owner_id RETURNING * INTO profile;
 RETURN NEXT profile;
END $$;
REVOKE ALL ON FUNCTION public.complete_health_onboarding(date,text,numeric,numeric,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.complete_health_onboarding(date,text,numeric,numeric,text,text) TO authenticated;

-- Also protect direct owner-scoped REST writes to the completion marker.
-- Keep the existing trigger, its ACL and permanent completion behavior.
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
  OR NEW.activity_level IS NULL OR NEW.activity_level NOT IN ('sedentary','lightly_active','moderately_active','very_active','extremely_active')
  OR NEW.weight_goal IS NULL OR NEW.weight_goal NOT IN ('lose_fat_slow','lose_fat','maintain','gain_weight_slow','gain_weight')
  OR NOT EXISTS (SELECT 1 FROM public.weight_records WHERE user_id=NEW.id AND weight_kg>0 AND weight_kg<=500 AND recorded_at<=now())
 ) THEN RAISE EXCEPTION 'Health onboarding is incomplete' USING ERRCODE='23514'; END IF;
 IF NEW.health_onboarding_completed_at IS NOT NULL THEN NEW.health_onboarding_completed_at:=now(); END IF;
 RETURN NEW;
END $$;
