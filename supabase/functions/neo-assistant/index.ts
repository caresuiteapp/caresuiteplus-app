import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createNeoGatewayHandler } from './handler.ts';
const handler = createNeoGatewayHandler({
  serviceUrl: Deno.env.get('NEO_SERVICE_URL') ?? '', serviceToken: Deno.env.get('NEO_SERVICE_TOKEN') ?? '',
  authorize: async (request, scope) => {
    const client = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: request.headers.get('Authorization') ?? '' } }, auth: { persistSession: false, autoRefreshToken: false } });
    const user = await client.auth.getUser(); if (user.error || user.data.user?.id !== scope.actorId) return false;
    const access = await client.rpc('neo_voice_authorize', { p_tenant_id: scope.tenantId, p_subject_id: scope.subjectId, p_assessment_id: scope.assessmentId ?? null });
    return !access.error && access.data === true;
  },
});
Deno.serve(handler);
