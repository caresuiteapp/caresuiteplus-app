import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function getServiceClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export function readClientMeta(req: Request): { ipAddress: string | null; userAgent: string | null } {
  return {
    ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    userAgent: req.headers.get('user-agent'),
  };
}

/** Best-effort write — optional tables/columns must not fail the main flow. */
export async function tryInsert(
  supabase: SupabaseClient,
  table: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase.from(table).insert(payload);
  if (error) {
    console.warn(`[edge] optional insert skipped (${table}): ${error.message}`);
  }
}
