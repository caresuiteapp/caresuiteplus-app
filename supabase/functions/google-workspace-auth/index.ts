import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, getServiceClient, jsonResponse } from '../_shared/http.ts';
import {
  GOOGLE_WORKSPACE_SCOPES,
  assertWorkspaceAdmin,
  buildCapabilities,
  decryptWorkspaceSecret,
  encryptWorkspaceSecret,
  pkceChallenge,
  publicConnection,
  randomBase64Url,
  resolveWorkspaceActor,
  sha256,
  type GoogleWorkspaceConnection,
} from '../_shared/googleWorkspace.ts';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`${name} fehlt.`);
  return value;
}

function safeReturnUrl(raw: string): string {
  const fallback = Deno.env.get('CARESUITE_PUBLIC_URL') ?? 'https://caresuiteplus.app';
  try {
    const url = new URL(raw || fallback);
    const allowed = (Deno.env.get('GOOGLE_WORKSPACE_RETURN_ORIGINS') ?? fallback)
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    if (!allowed.includes(url.origin)) return `${fallback.replace(/\/$/, '')}/business/connect/google-workspace`;
    return url.toString();
  } catch {
    return `${fallback.replace(/\/$/, '')}/business/connect/google-workspace`;
  }
}

async function handleCallback(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const oauthError = url.searchParams.get('error');
  if (!state) return jsonResponse({ ok: false, error: 'OAuth-State fehlt.' }, 400);

  const service = getServiceClient();
  const stateHash = await sha256(state);
  const { data: oauthState } = await service
    .from('google_workspace_oauth_states')
    .select('*')
    .eq('state_hash', stateHash)
    .is('consumed_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  if (!oauthState) return jsonResponse({ ok: false, error: 'OAuth-State ungültig oder abgelaufen.' }, 400);

  await service
    .from('google_workspace_oauth_states')
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', oauthState.id);

  const returnUrl = new URL(safeReturnUrl(oauthState.return_url));
  if (oauthError || !code) {
    returnUrl.searchParams.set('google', 'error');
    returnUrl.searchParams.set('reason', oauthError ?? 'authorization_cancelled');
    return Response.redirect(returnUrl.toString(), 302);
  }

  try {
    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: requiredEnv('GOOGLE_WORKSPACE_CLIENT_ID'),
        client_secret: requiredEnv('GOOGLE_WORKSPACE_CLIENT_SECRET'),
        redirect_uri: requiredEnv('GOOGLE_WORKSPACE_REDIRECT_URI'),
        grant_type: 'authorization_code',
        code_verifier: await decryptWorkspaceSecret(oauthState.pkce_verifier_cipher),
      }),
    });
    const tokens = await tokenResponse.json();
    if (!tokenResponse.ok || !tokens.access_token) {
      throw new Error(tokens.error_description ?? tokens.error ?? 'Token-Austausch fehlgeschlagen.');
    }

    const userInfoResponse = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const userInfo = await userInfoResponse.json();
    if (!userInfoResponse.ok || !userInfo.sub) throw new Error('Google-Profil konnte nicht gelesen werden.');

    const grantedScopes = String(tokens.scope ?? oauthState.requested_scopes.join(' '))
      .split(' ')
      .filter(Boolean);
    const existing = await service
      .from('google_workspace_connections')
      .select('refresh_token_cipher')
      .eq('tenant_id', oauthState.tenant_id)
      .maybeSingle();
    const refreshCipher = tokens.refresh_token
      ? await encryptWorkspaceSecret(tokens.refresh_token)
      : existing.data?.refresh_token_cipher;
    if (!refreshCipher) throw new Error('Google hat keinen Refresh-Token geliefert. Verbindung bitte erneut freigeben.');

    const { data: connection, error } = await service
      .from('google_workspace_connections')
      .upsert({
        tenant_id: oauthState.tenant_id,
        connected_user_id: oauthState.initiated_by,
        google_subject: userInfo.sub,
        primary_email: userInfo.email ?? null,
        hosted_domain: userInfo.hd ?? null,
        display_name: userInfo.name ?? null,
        connection_status: 'connected',
        granted_scopes: grantedScopes,
        access_token_cipher: await encryptWorkspaceSecret(tokens.access_token),
        refresh_token_cipher: refreshCipher,
        token_expires_at: new Date(Date.now() + Number(tokens.expires_in ?? 3600) * 1000).toISOString(),
        capabilities: buildCapabilities(grantedScopes),
        connected_at: new Date().toISOString(),
        revoked_at: null,
        last_error_code: null,
        last_error_message: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'tenant_id' })
      .select('id')
      .single();
    if (error) throw error;

    await service.from('google_workspace_audit_events').insert({
      tenant_id: oauthState.tenant_id,
      connection_id: connection.id,
      actor_user_id: oauthState.initiated_by,
      service_key: 'oauth',
      action_key: 'connect',
      result_status: 'success',
      http_status: 200,
    });
    returnUrl.searchParams.set('google', 'connected');
  } catch (error) {
    await service.from('google_workspace_audit_events').insert({
      tenant_id: oauthState.tenant_id,
      actor_user_id: oauthState.initiated_by,
      service_key: 'oauth',
      action_key: 'connect',
      result_status: 'failed',
      http_status: 500,
      error_message: error instanceof Error ? error.message : 'OAuth fehlgeschlagen',
    });
    returnUrl.searchParams.set('google', 'error');
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
    const actor = await resolveWorkspaceActor(authHeader, service);
    const body = await req.json();
    const action = String(body.action ?? 'status');

    const { data: current } = await service
      .from('google_workspace_connections')
      .select('*')
      .eq('tenant_id', actor.tenantId)
      .maybeSingle();

    if (action === 'status') {
      return jsonResponse({ ok: true, connection: publicConnection(current as GoogleWorkspaceConnection | null) });
    }

    assertWorkspaceAdmin(actor.role);

    if (action === 'start') {
      const state = randomBase64Url(32);
      const verifier = randomBase64Url(64);
      const scopes = GOOGLE_WORKSPACE_SCOPES.slice();
      const returnUrl = safeReturnUrl(String(body.returnUrl ?? ''));
      const { error } = await service.from('google_workspace_oauth_states').insert({
        tenant_id: actor.tenantId,
        initiated_by: actor.profileId,
        state_hash: await sha256(state),
        pkce_verifier_cipher: await encryptWorkspaceSecret(verifier),
        requested_scopes: scopes,
        return_url: returnUrl,
        expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
      });
      if (error) throw error;

      const authUrl = new URL(GOOGLE_AUTH_URL);
      authUrl.search = new URLSearchParams({
        client_id: requiredEnv('GOOGLE_WORKSPACE_CLIENT_ID'),
        redirect_uri: requiredEnv('GOOGLE_WORKSPACE_REDIRECT_URI'),
        response_type: 'code',
        scope: scopes.join(' '),
        access_type: 'offline',
        prompt: 'select_account consent',
        include_granted_scopes: 'true',
        state,
        code_challenge: await pkceChallenge(verifier),
        code_challenge_method: 'S256',
      }).toString();
      return jsonResponse({ ok: true, authorizationUrl: authUrl.toString() });
    }

    if (action === 'disconnect') {
      if (current?.refresh_token_cipher) {
        const token = await decryptWorkspaceSecret(current.refresh_token_cipher);
        await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }).catch(() => undefined);
      }
      if (current?.id) {
        await service.from('google_workspace_connections').update({
          connection_status: 'revoked',
          access_token_cipher: null,
          refresh_token_cipher: null,
          token_expires_at: null,
          capabilities: {},
          revoked_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('id', current.id);
      }
      return jsonResponse({ ok: true, connection: publicConnection(null) });
    }
    return jsonResponse({ ok: false, error: 'Unbekannte Aktion.' }, 400);
  } catch (error) {
    return jsonResponse({ ok: false, error: error instanceof Error ? error.message : 'Interner Fehler.' }, 500);
  }
});
