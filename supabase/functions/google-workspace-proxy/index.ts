import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, getServiceClient, jsonResponse } from '../_shared/http.ts';
import {
  WorkspaceError,
  getValidAccessToken,
  resolveWorkspaceActor,
  sha256,
  type GoogleWorkspaceConnection,
} from '../_shared/googleWorkspace.ts';

import { ACTIONS, validateWorkspaceAction } from '../_shared/googleWorkspaceActions.ts';
import { assertWorkspaceAdmin, buildCapabilities } from '../_shared/googleWorkspace.ts';
const asString = (value: unknown) => typeof value === 'string' ? value : '';

type WorkspaceRequest = {
  action?: string;
  payload?: Record<string, unknown>;
  confirmed?: boolean;
};


async function audit(
  service: ReturnType<typeof getServiceClient>,
  input: Record<string, unknown>,
): Promise<void> {
  await service.from('google_workspace_audit_events').insert(input);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'Methode nicht erlaubt.' }, 405);

  const service = getServiceClient();
  let actor: Awaited<ReturnType<typeof resolveWorkspaceActor>> | null = null;
  let connection: GoogleWorkspaceConnection | null = null;
  let action = 'unknown';
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonResponse({ ok: false, error: 'Nicht autorisiert.' }, 401);
    actor = await resolveWorkspaceActor(authHeader, service);
    assertWorkspaceAdmin(actor.role);
    const body = (await req.json()) as WorkspaceRequest;
    action = asString(body.action);
    const definition = Object.hasOwn(ACTIONS, action) ? ACTIONS[action] : undefined;
    if (!definition) return jsonResponse({ ok: false, error: 'Google-Workspace-Aktion nicht erlaubt.' }, 403);

    const { data, error: connectionError } = await service
      .from('google_workspace_connections')
      .select('*')
      .eq('tenant_id', actor.tenantId)
      .eq('connection_status', 'connected')
      .maybeSingle();
    if (connectionError) throw new Error('Verbindungsstatus konnte nicht gelesen werden.');
    connection = data as GoogleWorkspaceConnection | null;
    if (!connection) return jsonResponse({ ok: false, error: 'Google Workspace ist nicht verbunden.' }, 409);
    if (!buildCapabilities(connection.granted_scopes ?? [])[definition.service]) {
      return jsonResponse({ ok: false, error: `Berechtigung für ${definition.service} fehlt.` }, 403);
    }
    if (definition.write && body.confirmed !== true) {
      await audit(service, {
        tenant_id: actor.tenantId, connection_id: connection.id, actor_user_id: actor.profileId,
        service_key: definition.service, action_key: action, result_status: 'blocked',
        error_code: 'human_confirmation_required',
      });
      return jsonResponse({ ok: false, error: 'Diese Aktion muss vor Ausführung ausdrücklich bestätigt werden.' }, 409);
    }

    const payload = body.payload ?? {};
    validateWorkspaceAction(action, payload);
    const request = definition.build(payload);
    const response = await fetch(request.url, {
      method: definition.method,
      headers: {
        Authorization: `Bearer ${await getValidAccessToken(service, connection)}`,
        'Content-Type': 'application/json',
        ...(request.headers ?? {}),
      },
      body: request.body === undefined
        ? undefined
        : request.rawBody
          ? request.body as BodyInit
          : JSON.stringify(request.body),
    });
    const responseText = await response.text();
    let result: unknown = null;
    try { result = responseText ? JSON.parse(responseText) : null; } catch { result = responseText; }

    await audit(service, {
      tenant_id: actor.tenantId, connection_id: connection.id, actor_user_id: actor.profileId,
      service_key: definition.service, action_key: action,
      result_status: response.ok ? 'success' : 'failed', http_status: response.status,
      request_fingerprint: await sha256(JSON.stringify({ action, keys: Object.keys(payload).sort() })),
      error_code: response.ok ? null : `google_http_${response.status}`,
      error_message: response.ok ? null : 'Google-Anfrage abgelehnt.',
    });
    if (!response.ok) {
      const message = response.status === 401 ? 'Google-Anmeldung abgelaufen. Bitte Konto erneut verbinden.' : response.status === 403 ? 'Google verweigert den Zugriff. Prüfen Sie die Freigaben und ob die API im Google-Projekt aktiviert ist.' : response.status === 429 ? 'Zu viele Google-Anfragen. Bitte später erneut versuchen.' : response.status === 404 ? 'Der Eintrag wurde nicht gefunden oder ist nicht mehr verfügbar.' : 'Google konnte die Aktion nicht ausführen. Bitte Eingaben prüfen.';
      return jsonResponse({ ok: false, error: message }, response.status);
    }
    await service.from('google_workspace_connections').update({
      last_sync_at: new Date().toISOString(), last_error_code: null, last_error_message: null,
      updated_at: new Date().toISOString(),
    }).eq('id', connection.id).eq('connected_at', connection.connected_at).eq('connection_status', 'connected');
    return jsonResponse({ ok: true, data: result });
  } catch (error) {
    if (actor) {
      await audit(service, {
        tenant_id: actor.tenantId, connection_id: connection?.id ?? null, actor_user_id: actor.profileId,
        service_key: 'unknown', action_key: action, result_status: 'failed',
        http_status: 500, error_code: 'workspace_request_failed', error_message: 'Workspace-Anfrage fehlgeschlagen.',
      });
    }
    return jsonResponse({ ok: false, error: error instanceof Error ? error.message : 'Interner Fehler.' }, error instanceof WorkspaceError ? error.statusCode : 500);
  }
});
