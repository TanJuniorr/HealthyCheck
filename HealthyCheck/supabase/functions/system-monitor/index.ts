import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

type ComponentStatus = 'ok' | 'missing' | 'unavailable';

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function publishableKey() {
  const legacy = Deno.env.get('SUPABASE_ANON_KEY');
  const raw = Deno.env.get('SUPABASE_PUBLISHABLE_KEYS');
  if (raw) {
    try {
      const keys = JSON.parse(raw) as Record<string, unknown>;
      const value = keys.default ?? Object.values(keys).find(item => typeof item === 'string');
      if (typeof value === 'string' && value.length > 0) return value;
    } catch { /* fall back to the legacy injected anon key */ }
  }
  return legacy ?? '';
}

async function checkFunction(
  supabaseUrl: string,
  serviceRoleKey: string,
  functionName: 'ai-chat' | 'food-scan',
): Promise<{ status: ComponentStatus; http_status: number | null; latency_ms: number | null }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  const startedAt = performance.now();
  try {
    const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/functions/v1/${functionName}`, {
      method: 'GET',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      signal: controller.signal,
    });
    await response.arrayBuffer();
    const latencyMs = Math.max(0, Math.round(performance.now() - startedAt));
    if (response.ok) {
      return { status: 'ok', http_status: response.status, latency_ms: latencyMs };
    }
    return {
      status: response.status === 404 ? 'missing' : 'unavailable',
      http_status: response.status,
      latency_ms: latencyMs,
    };
  } catch {
    return { status: 'unavailable', http_status: null, latency_ms: null };
  } finally {
    clearTimeout(timeout);
  }
}

type RequestStats = {
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  success_rate_percent: number | null;
  average_duration_ms: number | null;
  p95_duration_ms: number | null;
  demo_requests: number;
};

function emptyRequestStats(): RequestStats {
  return {
    total_requests: 0,
    successful_requests: 0,
    failed_requests: 0,
    success_rate_percent: null,
    average_duration_ms: null,
    p95_duration_ms: null,
    demo_requests: 0,
  };
}

function numericValue(value: unknown): number | null {
  const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(number) ? number : null;
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = publishableKey();
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse({ error: 'monitor_not_configured' }, 503);
  }

  const bearer = request.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!bearer) return jsonResponse({ error: 'unauthorized' }, 401);

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return jsonResponse({ error: 'invalid_request' }, 400);
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: 'invalid_request' }, 400);
  }
  if (body.action !== 'snapshot') return jsonResponse({ error: 'invalid_action' }, 400);
  if (body.include_demo !== undefined && typeof body.include_demo !== 'boolean') {
    return jsonResponse({ error: 'invalid_request' }, 400);
  }
  const includeDemo = body.include_demo !== false;

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${bearer}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: { user }, error: authError } = await authClient.auth.getUser(bearer);
  if (authError || !user) return jsonResponse({ error: 'unauthorized' }, 401);

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: role, error: roleError } = await serviceClient
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();
  if (roleError) return jsonResponse({ error: 'role_check_failed' }, 503);
  if (role?.role !== 'admin') return jsonResponse({ error: 'admin_required' }, 403);

  const metricsWindowStart = new Date(Date.now() - 86_400_000).toISOString();
  let errorsQuery = serviceClient.from('app_monitor_events').select('id', { count: 'exact', head: true })
    .gte('created_at', metricsWindowStart);
  if (!includeDemo) errorsQuery = errorsQuery.eq('is_demo', false);
  const [databaseResult, aiChat, foodScan, requestMetricsResult, errorCountResult, demoErrorCountResult] = await Promise.all([
    (async () => {
      const dbStarted = performance.now();
      const { error } = await serviceClient.from('user_roles').select('user_id').limit(1);
      return {
        status: (error ? 'unavailable' : 'ok') as ComponentStatus,
        latency_ms: Math.max(0, Math.round(performance.now() - dbStarted)),
      };
    })(),
    checkFunction(supabaseUrl, serviceRoleKey, 'ai-chat'),
    checkFunction(supabaseUrl, serviceRoleKey, 'food-scan'),
    serviceClient.rpc('app_monitor_request_stats_with_demo', {
      p_since: metricsWindowStart, p_include_demo: includeDemo,
    }),
    errorsQuery,
    serviceClient.from('app_monitor_events').select('id', { count: 'exact', head: true })
      .gte('created_at', metricsWindowStart).eq('is_demo', true),
  ]);

  const requestMetrics = { ai_chat: emptyRequestStats(), food_scan: emptyRequestStats() };
  for (const row of requestMetricsResult.data ?? []) {
    if (row.function_name !== 'ai-chat' && row.function_name !== 'food-scan') continue;
    const stats = {
      total_requests: numericValue(row.total_requests) ?? 0,
      successful_requests: numericValue(row.successful_requests) ?? 0,
      failed_requests: numericValue(row.failed_requests) ?? 0,
      success_rate_percent: numericValue(row.success_rate_percent),
      average_duration_ms: numericValue(row.average_duration_ms),
      p95_duration_ms: numericValue(row.p95_duration_ms),
      demo_requests: numericValue(row.demo_requests) ?? 0,
    };
    requestMetrics[row.function_name === 'ai-chat' ? 'ai_chat' : 'food_scan'] = stats;
  }

  return jsonResponse({
    checked_at: new Date().toISOString(),
    metrics_window_start: metricsWindowStart,
    database: databaseResult,
    edge_functions: { ai_chat: aiChat, food_scan: foodScan },
    request_metrics_available: !requestMetricsResult.error,
    request_metrics: requestMetrics,
    errors_last_24h: errorCountResult.error ? null : errorCountResult.count ?? 0,
    demo_errors_last_24h: demoErrorCountResult.error ? null : includeDemo ? demoErrorCountResult.count ?? 0 : 0,
  });
});
