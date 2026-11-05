-- Fix new-account creation after health_goals was converted to append-only snapshots.
-- Migration 20261103041055 removed UNIQUE(user_id, effective_from), so the
-- old ON CONFLICT (user_id, effective_from) clause raised SQLSTATE 42P10.
-- Do not restore that constraint: multiple same-day snapshots are intentional.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'full_name'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.health_goals (user_id)
  VALUES (NEW.id);

  RETURN NEW;
END;
$$;
