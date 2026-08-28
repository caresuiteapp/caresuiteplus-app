import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import type { User } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, getServiceClient, jsonResponse } from '../_shared/http.ts';

type RequestBody = {
  action?: 'register' | 'unregister';
  expoPushToken?: string;
  platform?: 'android' | 'ios';
  appVersion?: string | null;
  permissionStatus?: 'granted' | 'denied' | 'undetermined';
};

type PortalIdentity = {
  tenantId: string;
  accountId: string;
  portalType: 'employee' | 'client' | 'relative';
  employeeId: string | null;
  clientId: string | null;
};

function bearerToken(req: Request): string | null {
  const header = req.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1]?.trim() || null;
}

function isExpoPushToken(value: string): boolean {
  return /^(Exponent|Expo)PushToken\[[A-Za-z0-9_-]+\]$/.test(value);
}

async function authenticatedUser(req: Request): Promise<User | null> {
  const token = bearerToken(req);
  if (!token) return null;
  const { data, error } = await getServiceClient().auth.getUser(token);
  return error ? null : data.user;
}

async function resolvePortalIdentity(user: User): Promise<PortalIdentity | null> {
  const portalType = user.app_metadata?.portal_type;
  const accountId = user.app_metadata?.portal_account_id;
  if (!['employee', 'client', 'relative'].includes(String(portalType)) || typeof accountId !== 'string') {
    return null;
  }

  const supabase = getServiceClient();
  if (portalType === 'employee') {
    const { data } = await supabase
      .from('employee_portal_accounts')
      .select('id, tenant_id, employee_id')
      .eq('id', accountId)
      .eq('auth_user_id', user.id)
      .in('status', ['active', 'pending_first_login', 'password_reset_required'])
      .maybeSingle();
    return data
      ? {
          tenantId: String(data.tenant_id),
          accountId: String(data.id),
          portalType: 'employee',
          employeeId: String(data.employee_id),
          clientId: null,
        }
      : null;
  }

  if (portalType === 'client') {
    const { data: access } = await supabase
      .from('client_portal_access')
      .select('id, tenant_id, client_id')
      .eq('id', accountId)
      .eq('auth_user_id', user.id)
      .eq('portal_enabled', true)
      .eq('status', 'aktiv')
      .maybeSingle();
    if (access) {
      return {
        tenantId: String(access.tenant_id),
        accountId: String(access.id),
        portalType: 'client',
        employeeId: null,
        clientId: String(access.client_id),
      };
    }

    const { data: code } = await supabase
      .from('client_portal_codes')
      .select('id, tenant_id, client_id, expires_at')
      .eq('id', accountId)
      .eq('auth_user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();
    if (!code || (code.expires_at && new Date(code.expires_at).getTime() <= Date.now())) return null;
    return {
      tenantId: String(code.tenant_id),
      accountId: String(code.id),
      portalType: 'client',
      employeeId: null,
      clientId: String(code.client_id),
    };
  }

  const { data: relative } = await supabase
    .from('relative_portal_codes')
    .select('id, tenant_id, client_id, expires_at')
    .eq('id', accountId)
    .eq('auth_user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();
  if (!relative || (relative.expires_at && new Date(relative.expires_at).getTime() <= Date.now())) {
    return null;
  }
  return {
    tenantId: String(relative.tenant_id),
    accountId: String(relative.id),
    portalType: 'relative',
    employeeId: null,
    clientId: String(relative.client_id),
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'Methode nicht erlaubt.' }, 405);

  try {
    const user = await authenticatedUser(req);
    if (!user) return jsonResponse({ ok: false, error: 'Anmeldung erforderlich.' }, 401);

    const identity = await resolvePortalIdentity(user);
    if (!identity) return jsonResponse({ ok: false, error: 'Portalzugang ist nicht aktiv.' }, 403);

    const body = (await req.json()) as RequestBody;
    const token = body.expoPushToken?.trim() ?? '';
    if (!isExpoPushToken(token)) {
      return jsonResponse({ ok: false, error: 'Ungültiges Expo-Gerätetoken.' }, 400);
    }

    const supabase = getServiceClient();
    if (body.action === 'unregister') {
      const { error } = await supabase
        .from('portal_push_devices')
        .update({ enabled: false, invalidated_at: new Date().toISOString(), last_error: 'signed_out' })
        .eq('expo_push_token', token)
        .eq('auth_user_id', user.id);
      if (error) throw error;
      return jsonResponse({ ok: true, unregistered: true });
    }

    if (!['android', 'ios'].includes(String(body.platform))) {
      return jsonResponse({ ok: false, error: 'Plattform fehlt.' }, 400);
    }

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('portal_push_devices')
      .upsert(
        {
          tenant_id: identity.tenantId,
          auth_user_id: user.id,
          portal_account_id: identity.accountId,
          portal_type: identity.portalType,
          employee_id: identity.employeeId,
          client_id: identity.clientId,
          expo_push_token: token,
          platform: body.platform,
          app_version: body.appVersion?.trim().slice(0, 40) || null,
          permission_status: body.permissionStatus ?? 'granted',
          enabled: true,
          last_registered_at: now,
          last_seen_at: now,
          invalidated_at: null,
          last_error: null,
        },
        { onConflict: 'expo_push_token' },
      )
      .select('id')
      .single();

    if (error) throw error;
    return jsonResponse({ ok: true, deviceId: data.id, registeredAt: now });
  } catch (error) {
    console.error('[portal-push-register] failed', error);
    return jsonResponse({ ok: false, error: 'Push-Gerät konnte nicht registriert werden.' }, 500);
  }
});
