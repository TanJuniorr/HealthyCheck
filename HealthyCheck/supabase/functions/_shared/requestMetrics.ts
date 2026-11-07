import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

export type MonitoredFunction = 'ai-chat' | 'food-scan';

async function writeRequestMetric(
  functionName: MonitoredFunction,
  statusCode: number,
  durationMs: number,
) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return;

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { error } = await client.from('app_monitor_request_metrics').insert({
    function_name: functionName,
    succeeded: statusCode >= 200 && statusCode < 300,
    status_code: statusCode,
    duration_ms: durationMs,
  });
  if (error) {
    // Never let monitoring failures change the user-facing function response.
    console.error('[monitor] Could not persist request metric.', { functionName, code: error.code });
  }
}

export function withRequestMetrics(
  functionName: MonitoredFunction,
  handler: (request: Request) => Promise<Response>,
) {
  return async (request: Request): Promise<Response> => {
    const startedAt = performance.now();
    let response: Response;
    try {
      response = await handler(request);
    } catch (error) {
      console.error(`[${functionName}] Unhandled request failure.`, {
        errorName: error instanceof Error ? error.name : 'unknown',
      });
      response = new Response(JSON.stringify({ error: 'internal_error' }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      });
    }

    // Only count actual API requests. OPTIONS and GET health probes are excluded.
    if (request.method === 'POST') {
      const durationMs = Math.max(0, Math.round(performance.now() - startedAt));
      const write = writeRequestMetric(functionName, response.status, durationMs).catch(error => {
        console.error('[monitor] Request metric write failed.', {
          functionName,
          errorName: error instanceof Error ? error.name : 'unknown',
        });
      });
      const edgeRuntime = (globalThis as typeof globalThis & {
        EdgeRuntime?: { waitUntil?: (promise: Promise<unknown>) => void };
      }).EdgeRuntime;
      if (edgeRuntime?.waitUntil) edgeRuntime.waitUntil(write);
      else await write;
    }

    return response;
  };
}
