-- Store operational request timings only; never store user IDs or request bodies.
CREATE TABLE public.app_monitor_request_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name text NOT NULL CHECK (function_name IN ('ai-chat', 'food-scan')),
  succeeded boolean NOT NULL,
  status_code integer NOT NULL CHECK (status_code BETWEEN 100 AND 599),
  duration_ms integer NOT NULL CHECK (duration_ms >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX app_monitor_request_metrics_created_idx
  ON public.app_monitor_request_metrics (created_at DESC, function_name);

ALTER TABLE public.app_monitor_request_metrics ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_monitor_request_metrics FROM PUBLIC, anon, authenticated;
GRANT INSERT, SELECT, DELETE ON public.app_monitor_request_metrics TO service_role;

CREATE OR REPLACE FUNCTION public.app_monitor_request_stats(p_since timestamptz)
RETURNS TABLE (
  function_name text,
  total_requests bigint,
  successful_requests bigint,
  failed_requests bigint,
  success_rate_percent numeric,
  average_duration_ms numeric,
  p95_duration_ms numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    metrics.function_name,
    pg_catalog.count(*)::bigint AS total_requests,
    pg_catalog.count(*) FILTER (WHERE metrics.succeeded)::bigint AS successful_requests,
    pg_catalog.count(*) FILTER (WHERE NOT metrics.succeeded)::bigint AS failed_requests,
    pg_catalog.round(
      pg_catalog.count(*) FILTER (WHERE metrics.succeeded)::numeric * 100 / pg_catalog.count(*),
      1
    ) AS success_rate_percent,
    pg_catalog.round(pg_catalog.avg(metrics.duration_ms)::numeric, 1) AS average_duration_ms,
    pg_catalog.round(
      (pg_catalog.percentile_cont(0.95) WITHIN GROUP (ORDER BY metrics.duration_ms))::numeric,
      1
    ) AS p95_duration_ms
  FROM public.app_monitor_request_metrics AS metrics
  WHERE metrics.created_at >= p_since
  GROUP BY metrics.function_name;
$$;

REVOKE ALL ON FUNCTION public.app_monitor_request_stats(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_monitor_request_stats(timestamptz) TO service_role;

CREATE OR REPLACE FUNCTION private.prune_app_monitor_request_metrics()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.app_monitor_request_metrics
   WHERE created_at < pg_catalog.now() - interval '30 days';
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.prune_app_monitor_request_metrics() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER app_monitor_request_metrics_prune
  AFTER INSERT ON public.app_monitor_request_metrics
  FOR EACH ROW EXECUTE FUNCTION private.prune_app_monitor_request_metrics();
