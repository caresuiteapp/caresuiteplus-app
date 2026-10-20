import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import type { User } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, getServiceClient, jsonResponse } from '../_shared/http.ts';

type RequestBody = { broadcastId?: string };
function bearerToken(req: Request): string | null {
  const match = /^Bearer\s+(.+)$/i.exec(req.headers.get('authorization') ?? '');
  return match?.[1]?.trim() || null;
}

async function authenticatedUser(req: Request): Promise<User | null> {
  const token = bearerToken(req);
  if (!token) return null;
  const { data, error } = await getServiceClient().auth.getUser(token);
  return error ? null : data.user;
}

async function resolveOfficeActor(userId: string): Promise<{ tenantId: string; allowed: boolean } | null> {
  const supabase = getServiceClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id, role_id')
    .or(`id.eq.${userId},auth_user_id.eq.${userId}`)
    .limit(1)
    .maybeSingle();
  if (!profile?.tenant_id || !profile.role_id) return null;

  const { data: permission } = await supabase
    .from('role_permissions')
    .select('permission_key')
    .eq('role_id', profile.role_id)
    .eq('permission_key', 'messages.broadcast.create')
    .maybeSingle();
  return { tenantId: String(profile.tenant_id), allowed: Boolean(permission) };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'Methode nicht erlaubt.' }, 405);

  try {
    const user = await authenticatedUser(req);
    if (!user) return jsonResponse({ ok: false, error: 'Anmeldung erforderlich.' }, 401);
    const actor = await resolveOfficeActor(user.id);
    if (!actor?.allowed) return jsonResponse({ ok: false, error: 'Keine Push-Berechtigung.' }, 403);

    const body = (await req.json()) as RequestBody;
    const broadcastId = body.broadcastId?.trim();
    if (!broadcastId) return jsonResponse({ ok: false, error: 'Broadcast-ID fehlt.' }, 400);

    const supabase = getServiceClient();
    const { data: broadcast } = await supabase
      .from('notification_broadcasts')
      .select('id, tenant_id, title, priority, audience, category')
      .eq('id', broadcastId)
      .eq('tenant_id', actor.tenantId)
      .eq('status', 'sent')
      .maybeSingle();
    if (!broadcast) return jsonResponse({ ok: false, error: 'Broadcast nicht gefunden.' }, 404);

    if (!['employees', 'clients'].includes(String(broadcast.audience))) {
      return jsonResponse({ ok: true, eligibleDevices: 0, accepted: 0, failed: 0 });
    }

    const { data, error } = await supabase.rpc('portal_push_enqueue_broadcast', { broadcast_id: broadcastId, scope_tenant: actor.tenantId });
    if (error) throw error;
    const summary = data?.[0];
    return jsonResponse({ ok: true, eligibleDevices: Number(summary?.eligible_devices ?? 0), queued: Number(summary?.queued ?? 0), accepted: Number(summary?.accepted ?? 0), failed: Number(summary?.failed ?? 0) });
  } catch (error) {
    console.error('[office-push-send] failed', error);
    return jsonResponse({ ok: false, error: 'Push-Versand ist vorübergehend fehlgeschlagen.' }, 500);
  }
});
