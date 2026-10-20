export type ActionDefinition = {
  service: string;
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
const asNumber = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? Math.max(1, Math.floor(value)) : fallback;
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

export const ACTIONS: Record<string, ActionDefinition> = {
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
  gmail_metadata: {
    service: 'gmail', method: 'GET', write: false,
    build: (p) => ({ url: api('https://gmail.googleapis.com', `/gmail/v1/users/me/messages/${encodeURIComponent(asString(p.id))}`, { format: 'metadata', fields: 'id,threadId,labelIds,snippet,internalDate,payload/headers' }) }),
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
      pageToken: asString(p.pageToken), orderBy: 'modifiedTime desc',
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
      const bytes = Uint8Array.from(atob(asString(p.base64)), char => char.charCodeAt(0));
      if (bytes.length > 5 * 1024 * 1024) throw new Error('Dateien dürfen höchstens 5 MB groß sein.');
      const encoder = new TextEncoder();
      const prefix = encoder.encode(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${asString(p.mimeType, 'application/octet-stream')}\r\n\r\n`);
      const suffix = encoder.encode(`\r\n--${boundary}--\r\n`);
      const multipart = new Uint8Array(prefix.length + bytes.length + suffix.length);
      multipart.set(prefix); multipart.set(bytes, prefix.length); multipart.set(suffix, prefix.length + bytes.length);
      return {
        url: 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,parents,webViewLink,size',
        headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
        rawBody: true,
        body: multipart,
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
    build: (p) => ({ url: api('https://tasks.googleapis.com', '/tasks/v1/users/@me/lists', { maxResults: '100', pageToken: asString(p.pageToken) }) }),
  },
  tasks_list: {
    service: 'tasks', method: 'GET', write: false,
    build: (p) => ({ url: api('https://tasks.googleapis.com', `/tasks/v1/lists/${encodeURIComponent(asString(p.taskListId, '@default'))}/tasks`, { pageToken: asString(p.pageToken), showHidden: String(p.showCompleted ?? false), showCompleted: String(p.showCompleted ?? false), maxResults: String(Math.min(asNumber(p.limit, 50), 100)) }) }),
  },
  tasks_create: {
    service: 'tasks', method: 'POST', write: true,
    build: (p) => ({ url: `https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(asString(p.taskListId, '@default'))}/tasks`, body: p.task }),
  },
  tasks_update: {
    service: 'tasks', method: 'PATCH', write: true,
    build: (p) => ({ url: `https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(asString(p.taskListId, '@default'))}/tasks/${encodeURIComponent(asString(p.id))}`, body: p.task }),
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

// Validate before contacting Google. Never turn a missing ID into a collection URL.
export function validateWorkspaceAction(action: string, p: Record<string, unknown>): void {
  const required: Record<string, string[]> = {
    gmail_read: ['id'], gmail_metadata: ['id'], gmail_modify: ['id'], gmail_send: ['raw'], gmail_draft: ['raw'],
    calendar_update: ['id'], calendar_delete: ['id'], drive_create_folder: ['name'],
    drive_create_file: ['name', 'mimeType'], drive_upload: ['name', 'mimeType', 'base64'],
    docs_create: ['title'], docs_batch_update: ['id'], sheets_values_update: ['id', 'range'],
    slides_create: ['title'], slides_batch_update: ['id'], tasks_update: ['id'], chat_send: ['space'],
  };
  for (const key of required[action] ?? []) {
    if (typeof p[key] !== 'string' || !(p[key] as string).trim()) throw new Error(`Angabe fehlt: ${key}.`);
  }
  if (action === 'chat_send' && !/^spaces\/[A-Za-z0-9_-]+$/.test(String(p.space))) throw new Error('Ungültiger Chat-Space.');
  if (action === 'drive_upload' && !/^[a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+$/.test(String(p.mimeType))) throw new Error('Ungültiger Dateityp.');
  if (['gmail_send', 'gmail_draft'].includes(action) && !/^[A-Za-z0-9_-]+={0,2}$/.test(String(p.raw))) throw new Error('Ungültiges Nachrichtenformat.');
  if (action === 'calendar_create') {
    const event = p.event as { summary?: string; start?: {dateTime?: string}; end?: {dateTime?: string} };
    if (!event?.summary?.trim() || !event.start?.dateTime || !event.end?.dateTime || !(Date.parse(event.end.dateTime) > Date.parse(event.start.dateTime))) throw new Error('Termin benötigt Titel sowie einen gültigen Beginn und ein späteres Ende.');
  }
  if (action === 'tasks_update' && !['completed', 'needsAction'].includes(String((p.task as {status?: string})?.status))) throw new Error('Ungültiger Aufgabenstatus.');
}
