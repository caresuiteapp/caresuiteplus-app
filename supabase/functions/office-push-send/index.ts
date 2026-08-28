import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import type { User } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, getServiceClient, jsonResponse } from '../_shared/http.ts';

type RequestBody = { broadcastId?: string };
type PushDevice = { id: string; auth_user_id: string; expo_push_token: string };
type ExpoTicket = {
  status: 'ok' | 'error';
  id?: string;
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

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postExpo(messages: Record<string, unknown>[]): Promise<ExpoTicket[]> {
  const accessToken = Deno.env.get('EXPO_ACCESS_TOKEN')?.trim();
  let lastError = 'Expo Push Service nicht erreichbar.';
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify(messages),
      });
      if (response.ok) {
        const payload = (await response.json()) as { data?: ExpoTicket[] };
        return payload.data ?? [];
      }
      lastError = `Expo Push HTTP ${response.status}`;
      if (response.status !== 429 && response.status < 500) break;
    } catch (error) {
      lastError = error instanceof Error ? error.message : lastError;
    }
    await sleep(attempt === 0 ? 500 : 1_500);
  }
  return messages.map(() => ({ status: 'error', message: lastError }));
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

    const { data: recipients, error: recipientError } = await supabase
      .from('office_notifications')
      .select('recipient_user_id')
      .eq('tenant_id', actor.tenantId)
      .eq('related_broadcast_id', broadcastId)
      .not('recipient_user_id', 'is', null);
    if (recipientError) throw recipientError;

    const recipientIds = [...new Set((recipients ?? []).map((row) => String(row.recipient_user_id)))];
    if (recipientIds.length === 0) {
      return jsonResponse({ ok: true, eligibleDevices: 0, accepted: 0, failed: 0 });
    }

    const { data: deviceRows, error: deviceError } = await supabase
      .from('portal_push_devices')
      .select('id, auth_user_id, expo_push_token')
      .eq('tenant_id', actor.tenantId)
      .eq('enabled', true)
      .eq('permission_status', 'granted')
      .in('auth_user_id', recipientIds);
    if (deviceError) throw deviceError;

    const devices = (deviceRows ?? []) as PushDevice[];
    const route = broadcast.audience === 'clients'
      ? '/portal/client/announcements'
      : '/portal/employee/announcements';
    const highPriority = ['urgent', 'critical'].includes(String(broadcast.priority));
    let accepted = 0;
    let failed = 0;

    for (const batch of chunks(devices, 100)) {
      const messages = batch.map((device) => ({
        to: device.expo_push_token,
        title: highPriority ? 'Dringende CareSuite-Mitteilung' : 'Neue CareSuite-Mitteilung',
        body: 'Öffnen Sie CareSuite, um die geschützte Nachricht anzuzeigen.',
        sound: 'default',
        priority: highPriority ? 'high' : 'default',
        channelId: highPriority ? 'caresuite-urgent' : 'caresuite-important',
        data: { route, broadcastId, category: broadcast.category },
      }));
      const tickets = await postExpo(messages);
      const now = new Date().toISOString();
      const deliveryRows = batch.map((device, index) => {
        const ticket = tickets[index] ?? { status: 'error' as const, message: 'Kein Expo-Ticket.' };
        if (ticket.status === 'ok') accepted += 1;
        else failed += 1;
        return {
          tenant_id: actor.tenantId,
          broadcast_id: broadcastId,
          device_id: device.id,
          auth_user_id: device.auth_user_id,
          requested_by_user_id: user.id,
          expo_ticket_id: ticket.id ?? null,
          ticket_status: ticket.status,
          error_code: ticket.details?.error ?? null,
          error_message: ticket.message ?? null,
          sent_at: now,
        };
      });
      const { error: deliveryError } = await supabase
        .from('office_push_deliveries')
        .upsert(deliveryRows, { onConflict: 'broadcast_id,device_id' });
      if (deliveryError) throw deliveryError;

      const invalidTokens = batch.filter((_, index) => tickets[index]?.details?.error === 'DeviceNotRegistered');
      if (invalidTokens.length > 0) {
        await supabase
          .from('portal_push_devices')
          .update({ enabled: false, invalidated_at: now, last_error: 'DeviceNotRegistered' })
          .in('id', invalidTokens.map((device) => device.id));
      }
    }

    await supabase.from('broadcast_audit_events').insert({
      tenant_id: actor.tenantId,
      actor_user_id: user.id,
      action: 'broadcast_push_sent',
      entity_id: broadcastId,
      metadata: { eligibleDevices: devices.length, accepted, failed },
    });

    return jsonResponse({ ok: true, eligibleDevices: devices.length, accepted, failed });
  } catch (error) {
    console.error('[office-push-send] failed', error);
    return jsonResponse({ ok: false, error: 'Push-Versand ist vorübergehend fehlgeschlagen.' }, 500);
  }
});
