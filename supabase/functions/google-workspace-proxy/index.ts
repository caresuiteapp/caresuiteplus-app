import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, getServiceClient, jsonResponse } from '../_shared/http.ts';
import {
  getValidAccessToken,
  resolveWorkspaceActor,
  sha256,
  type GoogleWorkspaceConnection,
} from '../_shared/googleWorkspace.ts';

type WorkspaceRequest = {
  action?: string;
  payload?: Record<string, unknown>;
  confirmed?: boolean;
};

type ActionDefinition = {
  service: keyof GoogleWorkspaceConnection['capabilities'];
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  write: boolean;
  build: (payload: Record<string, unknown>) => {
    url: string;
    body?: unknown;
    headers?: Record<string, string>;
    rawBody?: boolean;
  };
};

const api = (base: string, path: string, query?: Record<string, string | undefined>) => {
  const url = new URL(path, base);
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== '') url.searchParams.set(key, value);
  });
  return url.toString();
};

const asString = (value: unknown, fallback = '') => typeof value === 'string' ? value : fallback;
const asNumber = (value: unknown, fallback: number) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const eventWithOptionalMeet = (payload: Record<string, unknown>) => {
  const event = typeof payload.event === 'object' && payload.event ? payload.event as Record<string, unknown> : {};
  if (!payload.createMeet) return event;
  return {
    ...event,
    conferenceData: {
      createRequest: {
        requestId: asString(payload.requestId, crypto.randomUUID()),
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    },
  };
};

const ACTIONS: Record<string, ActionDefinition> = {
  gmail_list: {
    service: 'gmail', method: 'GET', write: false,
    build: (p) => ({ url: api('https://gmail.googleapis.com', '/gmail/v1/users/me/messages', {
      q: asString(p.query), maxResults: String(Math.min(asNumber(p.limit, 25), 100)),
      pageToken: asString(p.pageToken),
    }) }),
  },
  gmail_read: {
    service: 'gmail', method: 'GET', write: false,
    build: (p) => ({ url: api('https://gmail.googleapis.com', `/gmail/v1/users/me/messages/${encodeURIComponent(asString(p.id))}`, { format: 'full' }) }),
  },
  gmail_labels: {
    service: 'gmail', method: 'GET', write: false,
    build: () => ({ url: 'https://gmail.googleapis.com/gmail/v1/users/me/labels' }),
  },
  gmail_send: {
    service: 'gmail', method: 'POST', write: true,
    build: (p) => ({ url: 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send', body: { raw: p.raw } }),
  },
  gmail_draft: {
    service: 'gmail', method: 'POST', write: true,
    build: (p) => ({ url: 'https://gmail.googleapis.com/gmail/v1/users/me/drafts', body: { message: { raw: p.raw } } }),
  },
  gmail_modify: {
    service: 'gmail', method: 'POST', write: true,
    build: (p) => ({
      url: `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(asString(p.id))}/modify`,
      body: { addLabelIds: p.addLabelIds ?? [], removeLabelIds: p.removeLabelIds ?? [] },
    }),
  },
  calendar_list: {
    service: 'calendar', method: 'GET', write: false,
    build: (p) => ({ url: api('https://www.googleapis.com', `/calendar/v3/calendars/${encodeURIComponent(asString(p.calendarId, 'primary'))}/events`, {
      timeMin: asString(p.timeMin), timeMax: asString(p.timeMax), singleEvents: 'true',
      orderBy: 'startTime', maxResults: String(Math.min(asNumber(p.limit, 50), 250)),
      pageToken: asString(p.pageToken),
    }) }),
  },
  calendar_create: {
    service: 'calendar', method: 'POST', write: true,
    build: (p) => ({
      url: api('https://www.googleapis.com', `/calendar/v3/calendars/${encodeURIComponent(asString(p.calendarId, 'primary'))}/events`, {
        conferenceDataVersion: p.createMeet ? '1' : undefined,
        sendUpdates: asString(p.sendUpdates, 'all'),
      }),
      body: eventWithOptionalMeet(p),
    }),
  },
  calendar_update: {
    service: 'calendar', method: 'PATCH', write: true,
    build: (p) => ({
      url: api('https://www.googleapis.com', `/calendar/v3/calendars/${encodeURIComponent(asString(p.calendarId, 'primary'))}/events/${encodeURIComponent(asString(p.id))}`, {
        conferenceDataVersion: p.createMeet ? '1' : undefined,
        sendUpdates: asString(p.sendUpdates, 'all'),
      }),
      body: eventWithOptionalMeet(p),
    }),
  },
  calendar_delete: {
    service: 'calendar', method: 'DELETE', write: true,
    build: (p) => ({ url: api('https://www.googleapis.com', `/calendar/v3/calendars/${encodeURIComponent(asString(p.calendarId, 'primary'))}/events/${encodeURIComponent(asString(p.id))}`, { sendUpdates: asString(p.sendUpdates, 'all') }) }),
  },
  drive_list: {
    service: 'drive', method: 'GET', write: false,
    build: (p) => ({ url: api('https://www.googleapis.com', '/drive/v3/files', {
      q: asString(p.query, 'trashed = false'), pageSize: String(Math.min(asNumber(p.limit, 50), 100)),
      pageToken: asString(p.pageToken),
      fields: 'nextPageToken,files(id,name,mimeType,parents,webViewLink,modifiedTime,size,owners(displayName,emailAddress))',
    }) }),
  },
  drive_create_folder: {
    service: 'drive', method: 'POST', write: true,
    build: (p) => ({
      url: 'https://www.googleapis.com/drive/v3/files?fields=id,name,mimeType,parents,webViewLink',
      body: { name: p.name, mimeType: 'application/vnd.google-apps.folder', parents: p.parentId ? [p.parentId] : undefined },
    }),
  },
  drive_create_file: {
    service: 'drive', method: 'POST', write: true,
    build: (p) => ({
      url: 'https://www.googleapis.com/drive/v3/files?fields=id,name,mimeType,parents,webViewLink',
      body: { name: p.name, mimeType: p.mimeType, parents: p.parentId ? [p.parentId] : undefined },
    }),
  },
  drive_upload: {
    service: 'drive', method: 'POST', write: true,
    build: (p) => {
      const boundary = `caresuite_${crypto.randomUUID().replaceAll('-', '')}`;
      const metadata = JSON.stringify({
        name: p.name,
        mimeType: p.mimeType,
        parents: p.parentId ? [p.parentId] : undefined,
      });
      const bytes = atob(asString(p.base64));
      return {
        url: 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,parents,webViewLink,size',
        headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
        rawBody: true,
        body: `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${asString(p.mimeType, 'application/octet-stream')}\r\nContent-Transfer-Encoding: base64\r\n\r\n${btoa(bytes)}\r\n--${boundary}--`,
      };
    },
  },
  docs_create: {
    service: 'docs', method: 'POST', write: true,
    build: (p) => ({ url: 'https://docs.googleapis.com/v1/documents', body: { title: p.title } }),
  },
  docs_batch_update: {
    service: 'docs', method: 'POST', write: true,
    build: (p) => ({ url: `https://docs.googleapis.com/v1/documents/${encodeURIComponent(asString(p.id))}:batchUpdate`, body: { requests: p.requests ?? [] } }),
  },
  sheets_create: {
    service: 'sheets', method: 'POST', write: true,
    build: (p) => ({ url: 'https://sheets.googleapis.com/v4/spreadsheets', body: p.spreadsheet ?? { properties: { title: p.title } } }),
  },
  sheets_values_update: {
    service: 'sheets', method: 'PUT', write: true,
    build: (p) => ({
      url: api('https://sheets.googleapis.com', `/v4/spreadsheets/${encodeURIComponent(asString(p.id))}/values/${encodeURIComponent(asString(p.range))}`, { valueInputOption: asString(p.valueInputOption, 'USER_ENTERED') }),
      body: { range: p.range, majorDimension: p.majorDimension ?? 'ROWS', values: p.values ?? [] },
    }),
  },
  slides_create: {
    service: 'slides', method: 'POST', write: true,
    build: (p) => ({ url: 'https://slides.googleapis.com/v1/presentations', body: { title: p.title } }),
  },
  slides_batch_update: {
    service: 'slides', method: 'POST', write: true,
    build: (p) => ({ url: `https://slides.googleapis.com/v1/presentations/${encodeURIComponent(asString(p.id))}:batchUpdate`, body: { requests: p.requests ?? [] } }),
  },
  tasks_lists: {
    service: 'tasks', method: 'GET', write: false,
    build: () => ({ url: 'https://tasks.googleapis.com/tasks/v1/users/@me/lists' }),
  },
  tasks_list: {
    service: 'tasks', method: 'GET', write: false,
    build: (p) => ({ url: api('https://tasks.googleapis.com', `/tasks/v1/lists/${encodeURIComponent(asString(p.taskListId, '@default'))}/tasks`, { showCompleted: String(p.showCompleted ?? true), maxResults: String(Math.min(asNumber(p.limit, 50), 100)) }) }),
  },
  tasks_create: {
    service: 'tasks', method: 'POST', write: true,
    build: (p) => ({ url: `https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(asString(p.taskListId, '@default'))}/tasks`, body: p.task }),
  },
  contacts_list: {
    service: 'contacts', method: 'GET', write: false,
    build: (p) => ({ url: api('https://people.googleapis.com', '/v1/people/me/connections', {
      personFields: 'names,emailAddresses,phoneNumbers,organizations,addresses',
      pageSize: String(Math.min(asNumber(p.limit, 100), 1000)), pageToken: asString(p.pageToken),
    }) }),
  },
  contacts_create: {
    service: 'contacts', method: 'POST', write: true,
    build: (p) => ({ url: 'https://people.googleapis.com/v1/people:createContact', body: p.person }),
  },
  chat_spaces: {
    service: 'chat', method: 'GET', write: false,
    build: (p) => ({ url: api('https://chat.googleapis.com', '/v1/spaces', { pageSize: String(Math.min(asNumber(p.limit, 50), 100)), pageToken: asString(p.pageToken) }) }),
  },
  chat_send: {
    service: 'chat', method: 'POST', write: true,
    build: (p) => ({ url: `https://chat.googleapis.com/v1/${asString(p.space).replace(/^\/+/, '')}/messages`, body: p.message }),
  },
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
    const body = (await req.json()) as WorkspaceRequest;
    action = asString(body.action);
    const definition = ACTIONS[action];
    if (!definition) return jsonResponse({ ok: false, error: 'Google-Workspace-Aktion nicht erlaubt.' }, 403);

    const { data } = await service
      .from('google_workspace_connections')
      .select('*')
      .eq('tenant_id', actor.tenantId)
      .eq('connection_status', 'connected')
      .maybeSingle();
    connection = data as GoogleWorkspaceConnection | null;
    if (!connection) return jsonResponse({ ok: false, error: 'Google Workspace ist nicht verbunden.' }, 409);
    if (!connection.capabilities?.[definition.service]) {
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
          ? String(request.body)
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
      error_message: response.ok ? null : JSON.stringify(result).slice(0, 1000),
    });
    if (!response.ok) {
      return jsonResponse({ ok: false, error: 'Google Workspace hat die Aktion abgelehnt.', details: result }, response.status);
    }
    await service.from('google_workspace_connections').update({
      last_sync_at: new Date().toISOString(), last_error_code: null, last_error_message: null,
      updated_at: new Date().toISOString(),
    }).eq('id', connection.id);
    return jsonResponse({ ok: true, data: result });
  } catch (error) {
    if (actor) {
      await audit(service, {
        tenant_id: actor.tenantId, connection_id: connection?.id ?? null, actor_user_id: actor.profileId,
        service_key: 'unknown', action_key: action, result_status: 'failed',
        http_status: 500, error_message: error instanceof Error ? error.message : 'Interner Fehler',
      });
    }
    return jsonResponse({ ok: false, error: error instanceof Error ? error.message : 'Interner Fehler.' }, 500);
  }
});
