import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { verifyAiTenantAccess } from '../_shared/aiAuth.ts';
import { corsHeaders, jsonResponse } from '../_shared/http.ts';
import { analyzePlanDocument, readBoundedBody } from './planAnalysis.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'Methode nicht erlaubt.' }, 405);
  try {
    const body = await readBoundedBody(req);
    const tenantId = String(body.tenant_id ?? '');
    const employeeId = String(body.employee_id ?? '');
    if (!/^[0-9a-f-]{36}$/i.test(tenantId) || !/^[0-9a-f-]{36}$/i.test(employeeId)) return jsonResponse({ ok: false, error: 'Mandant und Mitarbeitende sind erforderlich.' }, 400);
    const auth = await verifyAiTenantAccess(req, tenantId);
    if (!auth) return jsonResponse({ ok: false, error: 'Kein Zugriff.' }, 403);
    const [tenant, assist, absences] = await Promise.all([
      auth.userClient.rpc('current_tenant_id'),
      auth.userClient.rpc('has_permission', { p_permission_key: 'assist.assignments.manage' }),
      auth.userClient.rpc('has_permission', { p_permission_key: 'office.employees.absences.manage' }),
    ]);
    if (tenant.error || tenant.data !== tenantId || (!assist.data && !absences.data)) return jsonResponse({ ok: false, error: 'Keine Berechtigung zur Personalplanung.' }, 403);
    const { data: employee, error } = await auth.userClient.from('employees').select('id').eq('id', employeeId).eq('tenant_id', tenantId).is('deleted_at', null).maybeSingle();
    if (error || !employee) return jsonResponse({ ok: false, error: 'Mitarbeitende nicht gefunden.' }, 403);
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) return jsonResponse({ ok: false, error: 'Die automatische Analyse ist noch nicht eingerichtet. OPENAI_API_KEY muss serverseitig hinterlegt werden. Die manuelle Eingabe ist weiterhin möglich.' }, 503);
    const result = await analyzePlanDocument(body, apiKey, Deno.env.get('OPENAI_PLAN_MODEL') || 'gpt-4.1-mini');
    return jsonResponse({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Analyse fehlgeschlagen.';
    return jsonResponse({ ok: false, error: message }, 400);
  }
});
