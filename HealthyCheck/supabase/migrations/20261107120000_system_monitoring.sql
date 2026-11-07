-- Minimal operational monitoring. Client reports contain only fixed error codes,
-- platform/version metadata, and the authenticated owner's UUID; no health data.
CREATE TABLE public.app_monitor_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'app' CHECK (source = 'app'),
  severity text NOT NULL CHECK (severity IN ('error', 'fatal')),
  event_code text NOT NULL CHECK (event_code IN (
    'unhandled_js_error',
    'unhandled_type_error',
    'unhandled_reference_error',
    'unhandled_syntax_error',
    'unhandled_unknown_error'
  )),
  platform text NOT NULL CHECK (platform IN ('android', 'ios', 'web', 'other')),
  app_version text NOT NULL DEFAULT 'unknown' CHECK (length(app_version) <= 32),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX app_monitor_events_created_at_idx
  ON public.app_monitor_events (created_at DESC);

ALTER TABLE public.app_monitor_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_monitor_events FROM PUBLIC, anon, authenticated;
GRANT INSERT, SELECT ON public.app_monitor_events TO authenticated;

CREATE POLICY app_monitor_events_insert_owner
  ON public.app_monitor_events FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY app_monitor_events_select_admin
  ON public.app_monitor_events FOR SELECT TO authenticated
  USING ((SELECT private.is_article_admin()));

-- Keep a short operational history. The trigger runs with table-owner rights
-- because regular users only have insert/select privileges.
CREATE OR REPLACE FUNCTION private.prune_app_monitor_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.app_monitor_events
   WHERE created_at < pg_catalog.now() - interval '30 days';
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.prune_app_monitor_events() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER app_monitor_events_prune
  AFTER INSERT ON public.app_monitor_events
  FOR EACH ROW EXECUTE FUNCTION private.prune_app_monitor_events();
