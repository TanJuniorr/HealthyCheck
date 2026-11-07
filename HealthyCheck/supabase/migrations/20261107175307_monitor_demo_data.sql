-- Sample rows are explicitly marked and can only be created by trusted tooling.
ALTER TABLE public.app_monitor_events ADD COLUMN is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.app_monitor_request_metrics ADD COLUMN is_demo boolean NOT NULL DEFAULT false;

ALTER POLICY app_monitor_events_insert_owner ON public.app_monitor_events
  WITH CHECK (user_id = (SELECT auth.uid()) AND NOT is_demo);

CREATE FUNCTION public.app_monitor_request_stats_with_demo(p_since timestamptz, p_include_demo boolean)
RETURNS TABLE (
  function_name text,
  total_requests bigint,
  successful_requests bigint,
  failed_requests bigint,
  success_rate_percent numeric,
  average_duration_ms numeric,
  p95_duration_ms numeric,
  demo_requests bigint
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$
  SELECT metrics.function_name,
    pg_catalog.count(*)::bigint,
    pg_catalog.count(*) FILTER (WHERE metrics.succeeded)::bigint,
    pg_catalog.count(*) FILTER (WHERE NOT metrics.succeeded)::bigint,
    pg_catalog.round(pg_catalog.count(*) FILTER (WHERE metrics.succeeded)::numeric * 100 / pg_catalog.count(*), 1),
    pg_catalog.round(pg_catalog.avg(metrics.duration_ms)::numeric, 1),
    pg_catalog.round((pg_catalog.percentile_cont(0.95) WITHIN GROUP (ORDER BY metrics.duration_ms))::numeric, 1),
    pg_catalog.count(*) FILTER (WHERE metrics.is_demo)::bigint
  FROM public.app_monitor_request_metrics AS metrics
  WHERE metrics.created_at >= p_since AND (p_include_demo OR NOT metrics.is_demo)
  GROUP BY metrics.function_name;
$$;

REVOKE ALL ON FUNCTION public.app_monitor_request_stats_with_demo(timestamptz, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_monitor_request_stats_with_demo(timestamptz, boolean) TO service_role;

-- Both API versions include the full monitoring dataset by default.
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
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$
  SELECT stats.function_name, stats.total_requests, stats.successful_requests,
    stats.failed_requests, stats.success_rate_percent, stats.average_duration_ms, stats.p95_duration_ms
  FROM public.app_monitor_request_stats_with_demo(p_since, true) AS stats;
$$;
