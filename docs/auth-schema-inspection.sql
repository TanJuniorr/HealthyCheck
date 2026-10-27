-- READ ONLY. Run in the correct Supabase project to inspect, not migrate.
-- SQL Editor has privileged access; these results do NOT prove user-level RLS works.
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name in (
  'profiles', 'health_goals', 'step_records', 'sleep_records',
  'meal_records', 'weight_records', 'water_records', 'foods'
)
order by table_name, ordinal_position;

select conrelid::regclass as source_table, conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid in (
  select oid from pg_class where relnamespace = 'public'::regnamespace
  and relname in ('profiles', 'health_goals', 'step_records', 'sleep_records',
    'meal_records', 'weight_records', 'water_records')
);

select relname, relrowsecurity, relforcerowsecurity
from pg_class where relnamespace = 'public'::regnamespace
and relname in ('profiles', 'health_goals', 'step_records', 'sleep_records',
  'meal_records', 'weight_records', 'water_records', 'foods');

select tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies where schemaname = 'public'
and tablename in ('profiles', 'health_goals', 'step_records', 'sleep_records',
  'meal_records', 'weight_records', 'water_records', 'foods');

select tgname, pg_get_triggerdef(oid) as definition, tgfoid::regprocedure as function_name
from pg_trigger where tgrelid = 'auth.users'::regclass and not tgisinternal;
