import { invokeGoogleWorkspaceAction as invoke } from './googleWorkspaceService';
import { driveQuery, googleLink, type WorkspacePage, type WorkspaceService } from './workspaceModel';
export type WorkspaceFilter = { query?: string; pageToken?: string; from?: string; to?: string; taskListId?: string; completed?: boolean };
export async function loadWorkspacePage(service: WorkspaceService, filter: WorkspaceFilter = {}): Promise<WorkspacePage> {
  let items: WorkspacePage['items'] = []; let data: any;
  const paging = { pageToken: filter.pageToken, limit: 20 };
  if (service === 'gmail') {
    data = await invoke<any>('gmail_list', { ...paging, query: filter.query?.trim() || 'in:inbox' });
    const messages = data.messages ?? [];
    // Limit metadata fan-out to five simultaneous requests.
    for (let i = 0; i < messages.length; i += 5) {
      const batch = await Promise.all(messages.slice(i, i + 5).map((m: any) => invoke<any>('gmail_metadata', { id: m.id })));
      items.push(...batch.map(m => { const header = (name: string) => m.payload?.headers?.find((h: any) => h.name.toLowerCase() === name)?.value ?? ''; return { id: m.id, title: header('subject') || '(Ohne Betreff)', subtitle: header('from'), when: m.internalDate ? new Date(Number(m.internalDate)).toISOString() : undefined, unread: m.labelIds?.includes('UNREAD'), raw: m }; }));
    }
  } else if (service === 'calendar' || service === 'meet') {
    const now = new Date(); now.setHours(0, 0, 0, 0); const later = new Date(now); later.setDate(later.getDate() + 30);
    data = await invoke<any>('calendar_list', { ...paging, timeMin: filter.from ? new Date(`${filter.from}T00:00:00`).toISOString() : now.toISOString(), timeMax: filter.to ? new Date(`${filter.to}T23:59:59.999`).toISOString() : later.toISOString() });
    items = (data.items ?? []).filter((e: any) => e.status !== 'cancelled' && (service !== 'meet' || e.hangoutLink || e.conferenceData)).map((e: any) => ({ id: e.id, title: e.summary || '(Ohne Titel)', subtitle: e.location || (e.start?.date ? 'Ganztägig' : 'Google-Kalender'), when: e.start?.dateTime || e.start?.date, url: googleLink(service === 'meet' ? e.hangoutLink || e.conferenceData?.entryPoints?.find((p: any) => p.entryPointType === 'video')?.uri : e.htmlLink) ?? undefined, raw: e }));
  } else if (['drive', 'docs', 'sheets', 'slides'].includes(service)) {
    data = await invoke<any>('drive_list', { ...paging, query: driveQuery(service, filter.query) });
    items = (data.files ?? []).map((f: any) => ({ id: f.id, title: f.name, subtitle: f.mimeType === 'application/vnd.google-apps.folder' ? 'Ordner' : f.owners?.[0]?.displayName || 'Google Drive', when: f.modifiedTime, url: googleLink(f.webViewLink) ?? `https://drive.google.com/open?id=${encodeURIComponent(f.id)}`, raw: f }));
  } else if (service === 'tasks') {
    data = await invoke<any>('tasks_list', { ...paging, taskListId: filter.taskListId || '@default', showCompleted: filter.completed === true });
    items = (data.items ?? []).map((t: any) => ({ id: t.id, title: t.title || '(Ohne Titel)', subtitle: t.notes || (t.status === 'completed' ? 'Erledigt' : 'Offen'), when: t.due?.slice(0, 10), completed: t.status === 'completed', raw: t }));
  } else if (service === 'contacts') {
    data = await invoke<any>('contacts_list', paging);
    items = (data.connections ?? []).map((c: any) => ({ id: c.resourceName, title: c.names?.[0]?.displayName || c.emailAddresses?.[0]?.value || '(Ohne Namen)', subtitle: [c.emailAddresses?.[0]?.value, c.phoneNumbers?.[0]?.value, c.organizations?.[0]?.name].filter(Boolean).join(' · '), raw: c }));
  } else {
    data = await invoke<any>('chat_spaces', paging);
    items = (data.spaces ?? []).map((s: any) => ({ id: s.name, title: s.displayName || 'Direktnachricht', subtitle: s.spaceType === 'SPACE' ? 'Space' : 'Unterhaltung', url: googleLink(s.spaceUri) ?? undefined, raw: s }));
  }
  return { items, nextPageToken: data.nextPageToken, fetchedAt: new Date().toISOString() };
}
