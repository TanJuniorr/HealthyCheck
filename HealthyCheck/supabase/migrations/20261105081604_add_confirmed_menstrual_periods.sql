-- Confirmed history only. Existing settings/logs are not backfilled or rewritten.
BEGIN;
-- NULL means flow was not recorded; existing explicit 'none' entries remain unchanged.
ALTER TABLE public.menstrual_cycle_logs ALTER COLUMN flow_status DROP NOT NULL, ALTER COLUMN flow_status DROP DEFAULT;
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE TABLE public.menstrual_cycle_periods (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 start_date date NOT NULL, end_date date, notes text CHECK (char_length(notes) <= 2000),
 recorded_timezone text NOT NULL DEFAULT 'UTC',
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT menstrual_period_dates CHECK (end_date IS NULL OR end_date >= start_date),
 CONSTRAINT menstrual_period_not_future CHECK (start_date <= (CURRENT_TIMESTAMP AT TIME ZONE recorded_timezone)::date AND (end_date IS NULL OR end_date <= (CURRENT_TIMESTAMP AT TIME ZONE recorded_timezone)::date)),
 CONSTRAINT menstrual_period_unique_start UNIQUE (user_id, start_date),
 CONSTRAINT menstrual_period_no_overlap EXCLUDE USING gist (user_id WITH =, daterange(start_date, end_date, '[]') WITH &&)
);
CREATE UNIQUE INDEX menstrual_period_one_open ON public.menstrual_cycle_periods(user_id) WHERE end_date IS NULL;
CREATE INDEX menstrual_period_history ON public.menstrual_cycle_periods(user_id, start_date DESC, id DESC);
ALTER TABLE public.menstrual_cycle_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own confirmed periods" ON public.menstrual_cycle_periods FOR ALL TO authenticated
 USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
REVOKE ALL ON public.menstrual_cycle_periods FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.menstrual_cycle_periods TO authenticated;
CREATE FUNCTION public.touch_menstrual_period() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
 IF NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.id IS DISTINCT FROM OLD.id THEN
  RAISE EXCEPTION 'cycle.periodConflict' USING ERRCODE = '23514';
 END IF;
 NEW.created_at := OLD.created_at;
 NEW.updated_at := clock_timestamp();
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.touch_menstrual_period() FROM PUBLIC, anon;
CREATE TRIGGER menstrual_period_updated BEFORE UPDATE ON public.menstrual_cycle_periods FOR EACH ROW EXECUTE FUNCTION public.touch_menstrual_period();
COMMENT ON COLUMN public.menstrual_cycle_settings.last_period_start IS 'Manual fallback anchor only; ignored whenever confirmed periods exist. Never promoted to a confirmed period.';
NOTIFY pgrst, 'reload schema';
COMMIT;
