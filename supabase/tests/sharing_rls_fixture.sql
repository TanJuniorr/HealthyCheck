\set ON_ERROR_STOP on
-- Run only in a disposable PostgreSQL database named healthycheck_sharing_test.
DO $$ BEGIN
  IF current_database() <> 'healthycheck_sharing_test' THEN RAISE EXCEPTION 'Use a disposable healthycheck_sharing_test database'; END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
END $$;
CREATE SCHEMA auth;
CREATE TABLE auth.users (
  id uuid PRIMARY KEY, email text, email_confirmed_at timestamptz,
  deleted_at timestamptz, banned_until timestamptz
);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object('email', current_setting('request.jwt.claim.email', true));
$$;
GRANT USAGE ON SCHEMA auth TO authenticated, anon;
CREATE TABLE public.profiles (id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE, full_name text, avatar_url text, date_of_birth date, height_cm numeric);
CREATE TABLE public.step_records (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES auth.users ON DELETE CASCADE, record_date date, steps int,
  UNIQUE (user_id, record_date));
CREATE TABLE public.sleep_records (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES auth.users ON DELETE CASCADE,
  sleep_start timestamptz, sleep_end timestamptz, notes text);
CREATE TABLE public.foods (id uuid PRIMARY KEY, calories_per_100g numeric, protein_per_100g numeric, carbs_per_100g numeric, fat_per_100g numeric);
CREATE TABLE public.meal_records (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES auth.users ON DELETE CASCADE,
  food_id uuid REFERENCES public.foods, quantity_g numeric, consumed_at timestamptz);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY profiles_select_own ON public.profiles FOR SELECT TO authenticated USING (id = (SELECT auth.uid()));
GRANT SELECT ON public.profiles TO authenticated;
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['step_records','sleep_records','meal_records'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('CREATE POLICY own_rows ON public.%I TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()))',t);
    EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO authenticated',t);
  END LOOP;
END $$;
CREATE PUBLICATION supabase_realtime FOR TABLE public.step_records,public.sleep_records,public.meal_records;
\ir ../migrations/20261029_create_sharing_invites.sql
\ir ../migrations/20261030_add_health_notifications.sql
\ir ../migrations/20261031_sharing_recipient_read.sql
GRANT ALL ON public.sharing_invites, public.app_notifications TO authenticated, anon;
INSERT INTO auth.users (id,email,email_confirmed_at) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a@example.test',now()),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','b@example.test',now()),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','c@example.test',now()),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','d@example.test',NULL);
INSERT INTO public.profiles VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','User A',NULL,'1990-01-01',171);
INSERT INTO public.step_records (user_id,record_date,steps) VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',(now() AT TIME ZONE 'UTC')::date,8123);
INSERT INTO public.sleep_records (user_id,sleep_start,sleep_end,notes)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','2026-11-03 22:00Z','2026-11-04 06:00Z','private notes');
INSERT INTO public.foods VALUES ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',150,10,20,5);
INSERT INTO public.meal_records (user_id,food_id,quantity_g,consumed_at)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',200,now());
INSERT INTO public.sharing_invites (id,owner_id,recipient_label,recipient_email,privacy_level,share_steps,share_cycle,weekly_digest)
VALUES
  ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Legacy B','b@example.test','family',true,true,true),
  ('22222222-2222-4222-8222-222222222222','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Legacy name',NULL,'community',true,false,false);
\ir ../migrations/20261104141237_private_sharing_consent.sql
\ir sharing_rls_assertions.sql
