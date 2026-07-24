import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, getServiceClient, jsonResponse } from '../_shared/http.ts';
import {
  assertZoomAdmin,
  decryptZoomSecret,
  encryptZoomSecret,
  oauthScopes,
  pkceChallenge,
  publicZoomConnection,
  randomBase64Url,
  resolveZoomActor,
  sha256,
  zoomApi,
  zoomCapabilities,
  type ZoomConnectionRow,
} from '../_shared/zoom.ts';

const AUTHORIZE_URL = 'https://zoom.us/oauth/authorize';
const TOKEN_URL = 'https://zoom.us/oauth/token';

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`${name} fehlt.`);
  return value;
}

function safeReturnUrl(raw: string): string {
  const fallback = Deno.env.get('CARESUITE_PUBLIC_URL') ?? 'https://caresuiteplus.app';
  const fallbackPath = `${fallback.replace(/\/$/, '')}/business/connect/zoom`;
  try {
    const url = new URL(raw || fallbackPath);
    const allowed = (Deno.env.get('ZOOM_RETURN_ORIGINS') ?? fallback)
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    return allowed.includes(url.origin) ? url.toString() : fallbackPath;
  } catch {
    return fallbackPath;
  }
}

async function audit(
  payload: Record<string, unknown>,
): Promise<void> {
  await getServiceClient().from('zoom_audit_events').insert(payload);
}

async function handleCallback(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const state = url.searchParams.get('state');
  const code = url.searchParams.get('code');
  const oauthError = url.searchParams.get('error');
  if (!state) return jsonResponse({ ok: false, error: 'OAuth-State fehlt.' }, 400);

  const service = getServiceClient();
  const { data: oauthState } = await service
    .from('zoom_oauth_states')
    .select('*')
    .eq('state_hash', await sha256(state))
    .is('consumed_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  if (!oauthState) return jsonResponse({ ok: false, error: 'OAuth-State ungültig oder abgelaufen.' }, 400);

  await service.from('zoom_oauth_states')
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', oauthState.id);

  const returnUrl = new URL(safeReturnUrl(oauthState.return_url));
  if (oauthError || !code) {
    returnUrl.searchParams.set('zoom', 'error');
    returnUrl.searchParams.set('reason', oauthError ?? 'authorization_cancelled');
    return Response.redirect(returnUrl.toString(), 302);
  }

  try {
    const basic = btoa(`${requiredEnv('ZOOM_CLIENT_ID')}:${requiredEnv('ZOOM_CLIENT_SECRET')}`);
    const tokenResponse = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: requiredEnv('ZOOM_REDIRECT_URI'),
        code_verifier: await decryptZoomSecret(oauthState.pkce_verifier_cipher),
      }),
    });
    const tokens = await tokenResponse.json();
    if (!tokenResponse.ok || !tokens.access_token || !tokens.refresh_token) {
      throw new Error(tokens.reason ?? tokens.error ?? 'Zoom-Token-Austausch fehlgeschlagen.');
    }
    const grantedScopes = String(tokens.scope ?? oauthState.requested_scopes.join(' '))
      .split(/\s+/)
      .filter(Boolean);
    const temporaryConnection = {
      id: 'oauth',
      tenant_id: oauthState.tenant_id,
      zoom_account_id: null,
      zoom_user_id: null,
      primary_email: null,
      display_name: null,
      account_type: null,
      connection_status: 'connected',
      granted_scopes: grantedScopes,
      access_token_cipher: await encryptZoomSecret(tokens.access_token),
      refresh_token_cipher: await encryptZoomSecret(tokens.refresh_token),
      token_expires_at: new Date(Date.now() + Number(tokens.expires_in ?? 3600) * 1000).toISOString(),
      capabilities: zoomCapabilities(grantedScopes),
      settings: {},
    } satisfies ZoomConnectionRow;
    const profileResponse = await fetch('https://api.zoom.us/v2/users/me', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = await profileResponse.json();
    if (!profileResponse.ok || !profile.id) {
      throw new Error(profile.message ?? 'Zoom-Profil konnte nicht gelesen werden.');
    }

    const { data: connection, error } = await service.from('zoom_connections').upsert({
      tenant_id: oauthState.tenant_id,
      connected_user_id: oauthState.initiated_by,
      zoom_account_id: tokens.account_id ?? profile.account_id ?? null,
      zoom_user_id: profile.id,
      primary_email: profile.email ?? null,
      display_name: [profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.display_name || null,
      account_type: profile.type ?? null,
      connection_status: 'connected',
      granted_scopes: grantedScopes,
      access_token_cipher: temporaryConnection.access_token_cipher,
      refresh_token_cipher: temporaryConnection.refresh_token_cipher,
      token_expires_at: temporaryConnection.token_expires_at,
      capabilities: temporaryConnection.capabilities,
      connected_at: new Date().toISOString(),
      revoked_at: null,
      last_error_code: null,
      last_error_message: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'tenant_id' }).select('id').single();
    if (error) throw error;

    await audit({
      tenant_id: oauthState.tenant_id,
      connection_id: connection.id,
      actor_user_id: oauthState.initiated_by,
      action_key: 'oauth.connect',
      result_status: 'success',
      http_status: 200,
    });
    returnUrl.searchParams.set('zoom', 'connected');
  } catch (error) {
    await audit({
      tenant_id: oauthState.tenant_id,
      actor_user_id: oauthState.initiated_by,
      action_key: 'oauth.connect',
      result_status: 'failed',
      http_status: 500,
      error_message: error instanceof Error ? error.message : 'Zoom OAuth fehlgeschlagen.',
    });
    returnUrl.searchParams.set('zoom', 'error');
    returnUrl.searchParams.set('reason', 'oauth_failed');
  }
  return Response.redirect(returnUrl.toString(), 302);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method === 'GET') return handleCallback(req);
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'Methode nicht erlaubt.' }, 405);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonResponse({ ok: false, error: 'Nicht autorisiert.' }, 401);
    const service = getServiceClient();
    const actor = await resolveZoomActor(authHeader, service);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? 'status');
    const { data: current } = await service.from('zoom_connections')
      .select('*')
      .eq('tenant_id', actor.tenantId)
      .maybeSingle();
    const connection = current as ZoomConnectionRow | null;

    if (action === 'status') {
      return jsonResponse({ ok: true, connection: publicZoomConnection(connection) });
    }

    assertZoomAdmin(actor);
    if (action === 'start') {
      const state = randomBase64Url(32);
      const verifier = randomBase64Url(64);
      const scopes = oauthScopes();
      const { error } = await service.from('zoom_oauth_states').insert({
        tenant_id: actor.tenantId,
        initiated_by: actor.profileId,
        state_hash: await sha256(state),
        pkce_verifier_cipher: await encryptZoomSecret(verifier),
        requested_scopes: scopes,
        return_url: safeReturnUrl(String(body.returnUrl ?? '')),
        expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
      });
      if (error) throw error;
      const authorizationUrl = new URL(AUTHORIZE_URL);
      authorizationUrl.search = new URLSearchParams({
        response_type: 'code',
        client_id: requiredEnv('ZOOM_CLIENT_ID'),
        redirect_uri: requiredEnv('ZOOM_REDIRECT_URI'),
        state,
        code_challenge: await pkceChallenge(verifier),
        code_challenge_method: 'S256',
      }).toString();
      return jsonResponse({ ok: true, authorizationUrl: authorizationUrl.toString() });
    }

    if (action === 'health') {
      if (!connection) throw new Error('Zoom ist nicht verbunden.');
      const profile = await zoomApi<Record<string, unknown>>(service, connection, '/users/me');
      await service.from('zoom_connections').update({
        last_health_check_at: new Date().toISOString(),
        connection_status: 'connected',
        last_error_code: null,
        last_error_message: null,
      }).eq('id', connection.id);
      return jsonResponse({ ok: true, connection: publicZoomConnection(connection), profile });
    }

    if (action === 'disconnect') {
      if (connection?.access_token_cipher) {
        const token = await decryptZoomSecret(connection.access_token_cipher);
        await fetch(`https://zoom.us/oauth/revoke?token=${encodeURIComponent(token)}`, {
          method: 'POST',
          headers: {
            Authorization: `Basic ${btoa(`${requiredEnv('ZOOM_CLIENT_ID')}:${requiredEnv('ZOOM_CLIENT_SECRET')}`)}`,
          },
        }).catch(() => undefined);
      }
      if (connection?.id) {
        await service.from('zoom_connections').update({
          connection_status: 'revoked',
          access_token_cipher: null,
          refresh_token_cipher: null,
          token_expires_at: null,
          capabilities: {},
          revoked_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('id', connection.id);
      }
      await audit({
        tenant_id: actor.tenantId,
        connection_id: connection?.id ?? null,
        actor_user_id: actor.profileId,
        action_key: 'oauth.disconnect',
        result_status: 'success',
      });
      return jsonResponse({ ok: true, connection: publicZoomConnection(null) });
    }
    return jsonResponse({ ok: false, error: 'Unbekannte Aktion.' }, 400);
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: error instanceof Error ? error.message : 'Zoom-Authentifizierung fehlgeschlagen.',
    }, 500);
  }
});
