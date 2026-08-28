import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import type { User } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, getServiceClient, jsonResponse } from '../_shared/http.ts';

type Receipt = {
  status: 'ok' | 'error';
  message?: string;
  details?: { error?: string };
};

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

async function officeTenant(userId: string): Promise<string | null> {
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
  return permission ? String(profile.tenant_id) : null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'Methode nicht erlaubt.' }, 405);

  try {
    const user = await authenticatedUser(req);
    if (!user) return jsonResponse({ ok: false, error: 'Anmeldung erforderlich.' }, 401);
    const tenantId = await officeTenant(user.id);
    if (!tenantId) return jsonResponse({ ok: false, error: 'Keine Push-Berechtigung.' }, 403);

    const supabase = getServiceClient();
    const olderThan = new Date(Date.now() - 15 * 60_000).toISOString();
    const { data: pending, error } = await supabase
      .from('office_push_deliveries')
      .select('id, device_id, expo_ticket_id')
      .eq('tenant_id', tenantId)
      .eq('ticket_status', 'ok')
      .is('receipt_checked_at', null)
      .not('expo_ticket_id', 'is', null)
      .lte('sent_at', olderThan)
      .limit(1000);
    if (error) throw error;
    if (!pending?.length) return jsonResponse({ ok: true, checked: 0, delivered: 0, failed: 0 });

    const ticketIds = pending.map((row) => String(row.expo_ticket_id));
    const accessToken = Deno.env.get('EXPO_ACCESS_TOKEN')?.trim();
    const response = await fetch('https://exp.host/--/api/v2/push/getReceipts', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ ids: ticketIds }),
    });
    if (!response.ok) throw new Error(`Expo receipt HTTP ${response.status}`);
    const payload = (await response.json()) as { data?: Record<string, Receipt> };
    const receipts = payload.data ?? {};
    let delivered = 0;
    let failed = 0;
    const checkedAt = new Date().toISOString();

    for (const row of pending) {
      const ticketId = String(row.expo_ticket_id);
      const receipt = receipts[ticketId];
      if (!receipt) continue;
      if (receipt.status === 'ok') delivered += 1;
      else failed += 1;
      await supabase
        .from('office_push_deliveries')
        .update({
          receipt_status: receipt.status,
          receipt_checked_at: checkedAt,
          error_code: receipt.details?.error ?? null,
          error_message: receipt.message ?? null,
        })
        .eq('id', row.id)
        .eq('tenant_id', tenantId);

      if (receipt.details?.error === 'DeviceNotRegistered') {
        await supabase
          .from('portal_push_devices')
          .update({ enabled: false, invalidated_at: checkedAt, last_error: 'DeviceNotRegistered' })
          .eq('id', row.device_id)
          .eq('tenant_id', tenantId);
      }
    }

    return jsonResponse({ ok: true, checked: delivered + failed, delivered, failed });
  } catch (error) {
    console.error('[office-push-receipts] failed', error);
    return jsonResponse({ ok: false, error: 'Push-Zustellstatus konnte nicht geprüft werden.' }, 500);
  }
});
