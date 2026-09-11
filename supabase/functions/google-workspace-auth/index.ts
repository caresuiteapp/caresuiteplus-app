import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, getServiceClient, jsonResponse } from '../_shared/http.ts';
import {
  WorkspaceError,
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
  const { data: oauthState, error: stateError } = await service
    .from('google_workspace_oauth_states')
    .update({ consumed_at: new Date().toISOString() })
    .eq('state_hash', stateHash)
    .is('consumed_at', null)
    .gt('expires_at', new Date().toISOString())
    .select('*').maybeSingle();
  if (stateError || !oauthState) return jsonResponse({ ok: false, error: 'OAuth-State ungültig oder abgelaufen.' }, 400);


  const returnUrl = new URL(safeReturnUrl(oauthState.return_url));
  if (oauthError || !code) {
    returnUrl.searchParams.set('google', 'error');
    returnUrl.searchParams.set('reason', oauthError ?? 'authorization_cancelled');
    return Response.redirect(returnUrl.toString(), 302);
  }

  try {
    const { data: initiator, error: actorError } = await service.from('profiles').select('tenant_id, role:roles(key)').eq('id', oauthState.initiated_by).single();
    if (actorError || initiator?.tenant_id !== oauthState.tenant_id) throw new Error('Verbindung nicht mehr autorisiert.');
    assertWorkspaceAdmin((initiator.role as unknown as {key: string})?.key ?? '');
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
      throw new Error('Token-Austausch fehlgeschlagen.');
    }

    const userInfoResponse = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const userInfo = await userInfoResponse.json();
    if (!userInfoResponse.ok || !userInfo.sub) throw new Error('Google-Profil konnte nicht gelesen werden.');

    const grantedScopes = String(tokens.scope ?? '')
      .split(' ')
      .filter(Boolean);
    const existing = await service
      .from('google_workspace_connections')
      .select('refresh_token_cipher,google_subject')
      .eq('tenant_id', oauthState.tenant_id)
      .maybeSingle();
    if (existing.error) throw new Error('Vorherige Verbindung konnte nicht gelesen werden.');
    const refreshCipher = tokens.refresh_token
      ? await encryptWorkspaceSecret(tokens.refresh_token)
      : existing.data?.google_subject === userInfo.sub ? existing.data?.refresh_token_cipher : null;
    if (!refreshCipher) throw new Error('Google hat keinen Refresh-Token geliefert. Verbindung bitte erneut freigeben.');

    const { data: connectionId, error } = await service
      .rpc('complete_google_workspace_connection', { p_state_id: oauthState.id, p_connection: {
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
        last_health_check_at: new Date().toISOString(),
        last_sync_at: null,
        revoked_at: null,
        last_error_code: null,
        last_error_message: null,
        updated_at: new Date().toISOString(),
      } });
    if (error) throw error;

    await service.from('google_workspace_audit_events').insert({
      tenant_id: oauthState.tenant_id,
      connection_id: connectionId,
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
      error_code: 'oauth_callback_failed', error_message: 'Google-Freigabe konnte nicht abgeschlossen werden.',
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
    assertWorkspaceAdmin(actor.role);
    const body = await req.json();
    const action = String(body.action ?? 'status');

    let { data: current, error: statusError } = await service
      .from('google_workspace_connections')
      .select('*')
      .eq('tenant_id', actor.tenantId)
      .maybeSingle();

    if (statusError) throw new Error('Google-Verbindungsstatus konnte nicht gelesen werden.');
    if (action === 'activity') {
      const { data: events, error } = await service.from('google_workspace_audit_events').select('id,service_key,action_key,result_status,http_status,error_code,created_at').eq('tenant_id', actor.tenantId).order('created_at', { ascending: false }).limit(30);
      if (error) throw new Error('Aktivitäten konnten nicht geladen werden.');
      return jsonResponse({ ok: true, events });
    }
    if (action === 'status') {
      return jsonResponse({ ok: true, connection: publicConnection(current as GoogleWorkspaceConnection | null) });
    }

    assertWorkspaceAdmin(actor.role);

    if (action === 'start') {
      for (const name of ['GOOGLE_WORKSPACE_CLIENT_ID', 'GOOGLE_WORKSPACE_CLIENT_SECRET', 'GOOGLE_WORKSPACE_REDIRECT_URI', 'GOOGLE_WORKSPACE_TOKEN_ENCRYPTION_KEY']) requiredEnv(name);
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
      // Invalidate pending authorizations before clearing the tenant connection.
      const invalidation = await service.from('google_workspace_oauth_states').delete().eq('tenant_id', actor.tenantId);
      if (invalidation.error) throw new Error('Offene Google-Anmeldungen konnten nicht beendet werden.');
      const latest = await service.from('google_workspace_connections').select('*').eq('tenant_id', actor.tenantId).maybeSingle();
      if (latest.error) throw new Error('Google-Verbindung konnte nicht gelesen werden.');
      current = latest.data;
      if (current?.id) {
        const { data: removed, error } = await service.from('google_workspace_connections').update({
          connection_status: 'revoked', access_token_cipher: null, refresh_token_cipher: null,
          token_expires_at: null, granted_scopes: [], capabilities: {},
          revoked_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        }).eq('id', current.id).eq('connected_at', current.connected_at).select('id').maybeSingle();
        if (error || !removed) throw new Error('Die Verbindung wurde verändert. Bitte neu laden und erneut trennen.');
      }
      if (current?.refresh_token_cipher) {
        const token = await decryptWorkspaceSecret(current.refresh_token_cipher);
        await fetch('https://oauth2.googleapis.com/revoke', {
          method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ token }),
        }).catch(() => undefined);
      }
      await service.from('google_workspace_audit_events').insert({
        tenant_id: actor.tenantId, connection_id: current?.id ?? null, actor_user_id: actor.profileId,
        service_key: 'oauth', action_key: 'disconnect', result_status: 'success', http_status: 200,
      });
      return jsonResponse({ ok: true, connection: publicConnection(null) });
    }
    return jsonResponse({ ok: false, error: 'Unbekannte Aktion.' }, 400);
  } catch (error) {
    return jsonResponse({ ok: false, error: error instanceof Error ? error.message : 'Interner Fehler.' }, error instanceof WorkspaceError ? error.statusCode : 500);
  }
});
