-- Run explicitly as a database owner after monitor_demo_data migration.
-- Repeatable: refreshes only this fixture's marked rows; never overwrites real logs.
-- No AI calls, account creation, chat contents, images or health data.
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    RAISE EXCEPTION 'Create an admin account before seeding monitor samples';
  END IF;
END;
$$;

INSERT INTO public.app_monitor_request_metrics
  (id, function_name, succeeded, status_code, duration_ms, created_at, is_demo)
SELECT
  md5('healthycheck-monitor-demo-request-' || n)::uuid,
  CASE WHEN n <= 240 THEN 'ai-chat' ELSE 'food-scan' END,
  n % 10 NOT IN (0, 3),
  CASE WHEN n % 10 = 0 THEN 500 WHEN n % 10 = 3 THEN 429 ELSE 200 END,
  CASE WHEN n % 10 = 3 THEN 80 + n % 120
       WHEN n % 10 = 0 THEN 4200 + n % 1700
       WHEN n <= 240 THEN 650 + (n * 137) % 2800
       ELSE 1200 + (n * 193) % 4500 END,
  now() - (1 + (n * 37) % 1380) * interval '1 minute',
  true
FROM generate_series(1, 360) AS fixture(n)
ON CONFLICT (id) DO UPDATE SET
  created_at = EXCLUDED.created_at
WHERE app_monitor_request_metrics.is_demo;

INSERT INTO public.app_monitor_events
  (id, user_id, source, severity, event_code, platform, app_version, created_at, is_demo)
SELECT
  md5('healthycheck-monitor-demo-event-' || n)::uuid,
  (SELECT user_id FROM public.user_roles WHERE role = 'admin' ORDER BY user_id LIMIT 1),
  'app',
  CASE WHEN n % 4 = 0 THEN 'fatal' ELSE 'error' END,
  (ARRAY['unhandled_js_error', 'unhandled_type_error', 'unhandled_reference_error',
         'unhandled_syntax_error', 'unhandled_unknown_error'])[1 + (n - 1) % 5],
  (ARRAY['android', 'ios', 'web'])[1 + (n - 1) % 3],
  '1.0.0',
  now() - (1 + (n * 43) % 1380) * interval '1 minute',
  true
FROM generate_series(1, 30) AS fixture(n)
ON CONFLICT (id) DO UPDATE SET
  created_at = EXCLUDED.created_at
WHERE app_monitor_events.is_demo;

COMMIT;
