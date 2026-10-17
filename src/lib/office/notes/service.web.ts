import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { fetchRuntimePermissions } from '@/lib/supabase/permissionRepository';
import { isUuid } from '@/lib/validation/uuid';
import { draftsEqual, noteToDraft, validateNoteDraft } from './model.web';
import type { NoteDraft, NoteSaveOperation, NotesActor, NotesResult, OfficeNote } from './types.web';

const TABLE = 'office_private_notes';
const COLUMNS = 'id,tenant_id,owner_user_id,title,category,format,status,tags,due_date,pinned,content,revision,created_at,updated_at,archived_at';
const PORTAL_ROLES = new Set(['employee_portal', 'client_portal', 'family_portal']);
type Client = NonNullable<ReturnType<typeof getSupabaseClient>>;
type Failure = Extract<NotesResult<never>, { ok: false }>;
const conflict = (): Failure => ({ ok: false, conflict: true, error: 'Die Notiz wurde zwischenzeitlich geändert oder ist nicht mehr verfügbar. Bitte neu laden und den Entwurf abgleichen.' });
function errorResult(error: unknown, uncertain = false): Failure {
  const record = error as { code?: string; message?: string } | null;
  if (record?.code === '40001') return conflict();
  if (['PGRST205', '42P01'].includes(record?.code ?? '')) return { ok: false, error: 'Der Notizenspeicher ist noch nicht verfügbar. Bitte erneut laden.' };
  if (['42501', 'PGRST301'].includes(record?.code ?? '')) return { ok: false, error: 'Für diese Notiz besteht keine Zugriffsberechtigung.' };
  if (record?.code?.startsWith('22') || record?.code === '23514') return { ok: false, error: 'Der Notizenspeicher hat ungültige Inhalte abgelehnt. Bitte die Angaben und Inhaltsgrenzen prüfen.' };
  return { ok: false, ...(uncertain ? { uncertain: true } : {}), error: uncertain
    ? 'Die Speicherung konnte nicht bestätigt werden. Bitte erneut versuchen; der Entwurf bleibt erhalten.'
    : 'Die Notiz konnte nicht geladen oder gespeichert werden. Bitte erneut versuchen.' };
}
const transportError = (error: unknown) => {
  const value = error as { code?: string; message?: string } | null;
  return !value?.code || value.code.startsWith('08') || /fetch|network|timeout|timed out|verbindung/i.test(value.message ?? '');
};
async function authorize(actor: NotesActor): Promise<NotesResult<Client>> {
  if (!isUuid(actor.tenantId) || !isUuid(actor.userId) || !actor.roleKey || PORTAL_ROLES.has(actor.roleKey)) return { ok: false, error: 'Bitte mit einem Verwaltungszugang und gültigem Unternehmen anmelden.' };
  const client = getSupabaseClient();
  if (!client) return { ok: false, error: 'Der Notizenspeicher ist ohne Datenbankverbindung nicht verfügbar.' };
  try {
    const permissions = actor.permissions ?? await fetchRuntimePermissions(actor.roleKey, actor.tenantId);
    if (!permissions.includes('office.access')) return { ok: false, error: 'Für persönliche Office-Notizen fehlt die Berechtigung.' };
    const { data, error } = await client.auth.getUser();
    const user = data?.user;
    if (error || !user || user.id !== actor.userId) return { ok: false, error: 'Die Anmeldung hat sich geändert. Bitte die Notizen erneut öffnen.' };
    const portal = user.app_metadata?.portal_type;
    if (portal && portal !== 'business') return { ok: false, error: 'Persönliche Office-Notizen sind nur im Verwaltungszugang verfügbar.' };
    return { ok: true, data: client };
  } catch (error) { return errorResult(error); }
}
function mapNote(value: unknown, actor: NotesActor, id?: string): OfficeNote {
  if (!value || typeof value !== 'object') throw new Error('Der Notizenspeicher hat keine gültige Bestätigung zurückgegeben.');
  const row = value as Record<string, unknown>;
  if (row.tenant_id !== actor.tenantId || row.owner_user_id !== actor.userId || !isUuid(row.id as string) || (id && row.id !== id)) throw new Error('Die zurückgegebene Notiz gehört nicht zum aktuellen Zugang.');
  const note = {
    id: row.id, tenantId: row.tenant_id, ownerUserId: row.owner_user_id,
    title: row.title, category: row.category, format: row.format, status: row.status, tags: row.tags,
    dueDate: row.due_date ?? '', pinned: row.pinned, content: row.content,
    revision: row.revision, createdAt: row.created_at, updatedAt: row.updated_at, archivedAt: row.archived_at ?? null,
  } as OfficeNote;
  if (!Number.isInteger(note.revision) || note.revision < 1 || typeof note.createdAt !== 'string' || !Number.isFinite(Date.parse(note.createdAt))
    || typeof note.updatedAt !== 'string' || !Number.isFinite(Date.parse(note.updatedAt))
    || (note.archivedAt !== null && (typeof note.archivedAt !== 'string' || !Number.isFinite(Date.parse(note.archivedAt)))) || validateNoteDraft(note)) throw new Error('Die gespeicherte Notiz enthält ungültige Daten.');
  return note;
}
function scoped(client: Client, actor: NotesActor) {
  return fromUnknownTable(client, TABLE).select(COLUMNS).eq('tenant_id', actor.tenantId).eq('owner_user_id', actor.userId);
}
async function readOne(client: Client, actor: NotesActor, id: string): Promise<NotesResult<OfficeNote | null>> {
  try {
    const { data, error } = await scoped(client, actor).eq('id', id).maybeSingle();
    if (error) return errorResult(error);
    return { ok: true, data: data ? mapNote(data, actor, id) : null };
  } catch (error) { return errorResult(error); }
}
export async function listNotes(actor: NotesActor): Promise<NotesResult<OfficeNote[]>> {
  const access = await authorize(actor); if (!access.ok) return access;
  try {
    const notes: OfficeNote[] = [];
    for (let page = 0; ; page++) {
      const { data, error } = await scoped(access.data, actor).order('updated_at', { ascending: false }).order('id').range(page * 100, page * 100 + 99);
      if (error) return errorResult(error);
      notes.push(...(data ?? []).map(value => mapNote(value, actor)));
      if (!data || data.length < 100) return { ok: true, data: notes };
    }
  } catch (error) { return errorResult(error); }
}
export async function loadNote(actor: NotesActor, id: string): Promise<NotesResult<OfficeNote | null>> {
  if (!isUuid(id)) return { ok: false, error: 'Die Notizkennung ist ungültig.' };
  const access = await authorize(actor); if (!access.ok) return access;
  return readOne(access.data, actor, id);
}

const writes = new Map<string, Promise<NotesResult<unknown>>>();
const duplicates = new Map<string, Promise<NotesResult<unknown>>>();
const actorSnapshot = (actor: NotesActor): NotesActor => ({ ...actor, permissions: actor.permissions ? [...actor.permissions] : undefined });
function serialize<T>(actor: NotesActor, id: string, signature: string, operation: () => Promise<NotesResult<T>>): Promise<NotesResult<T>> {
  const key = `${actor.tenantId}:${actor.userId}:${id}`;
  const duplicateKey = `${key}:${JSON.stringify([actor.roleKey, actor.permissions])}:${signature}`;
  const duplicate = duplicates.get(duplicateKey);
  if (duplicate) return duplicate as Promise<NotesResult<T>>;
  const previous = writes.get(key);
  const pending = (previous ? previous.then(operation, operation) : Promise.resolve().then(operation)).catch(error => errorResult(error, true));
  writes.set(key, pending); duplicates.set(duplicateKey, pending);
  void pending.then(() => { if (writes.get(key) === pending) writes.delete(key); if (duplicates.get(duplicateKey) === pending) duplicates.delete(duplicateKey); });
  return pending;
}
const payload = (draft: NoteDraft) => ({ title: draft.title, category: draft.category, format: draft.format, status: draft.status,
  tags: draft.tags, due_date: draft.dueDate || null, pinned: draft.pinned, content: draft.content });
function matchesSaved(note: OfficeNote, operation: NoteSaveOperation, created: boolean): boolean {
  return note.archivedAt === null && (created ? note.revision >= 1 : note.revision === operation.expectedRevision! + 1) && draftsEqual(noteToDraft(note), operation.draft);
}

export async function saveNote(actor: NotesActor, operation: NoteSaveOperation): Promise<NotesResult<OfficeNote>> {
  actor = actorSnapshot(actor);
  if (!isUuid(operation.id) || (operation.expectedRevision !== null && (!Number.isInteger(operation.expectedRevision) || operation.expectedRevision < 1))) return { ok: false, error: 'Die Notizkennung oder gespeicherte Version ist ungültig.' };
  const validation = validateNoteDraft(operation.draft); if (validation) return { ok: false, error: validation };
  // Snapshot mutable editor data before queuing it; the caller keeps its own draft.
  const stable = { ...operation, draft: JSON.parse(JSON.stringify(operation.draft)) as NoteDraft };
  return serialize(actor, stable.id, `save:${JSON.stringify(stable)}`, async () => {
    const access = await authorize(actor); if (!access.ok) return access;
    const client = access.data, created = stable.expectedRevision === null;
    let failure: unknown;
    try {
      const base = fromUnknownTable(client, TABLE);
      const query = created
        ? base.insert({ ...payload(stable.draft), id: stable.id, tenant_id: actor.tenantId, owner_user_id: actor.userId, revision: 1 })
        : base.update({ ...payload(stable.draft), revision: stable.expectedRevision! + 1 }).eq('id', stable.id)
          .eq('tenant_id', actor.tenantId).eq('owner_user_id', actor.userId).eq('revision', stable.expectedRevision!).is('archived_at', null);
      const { data, error } = await query.select(COLUMNS).maybeSingle();
      if (!error && data) {
        const note = mapNote(data, actor, stable.id);
        return matchesSaved(note, stable, created) ? { ok: true, data: note } : errorResult(new Error('Die gespeicherte Fassung stimmt nicht mit dem Entwurf überein.'), true);
      }
      if (!error && !created) return conflict();
      failure = error ?? new Error('Speicherbestätigung fehlt.');
      if ((failure as { code?: string }).code !== '23505' && !transportError(failure)) return errorResult(failure);
    } catch (error) { failure = error; }
    // A network failure may follow a committed write. Reconcile the same UUID;
    // never create another row or overwrite a conflicting persisted version.
    const current = await readOne(client, actor, stable.id);
    if (current.ok && current.data) return matchesSaved(current.data, stable, created) ? { ok: true, data: current.data } : conflict();
    if ((failure as { code?: string } | null)?.code === '23505') return conflict();
    return errorResult(failure, true);
  });
}

export async function setNoteArchived(actor: NotesActor, note: OfficeNote, archived: boolean): Promise<NotesResult<OfficeNote>> {
  actor = actorSnapshot(actor);
  if (note.tenantId !== actor.tenantId || note.ownerUserId !== actor.userId || !isUuid(note.id) || !Number.isInteger(note.revision) || note.revision < 1) return { ok: false, error: 'Diese Notiz gehört nicht zum aktuellen Zugang.' };
  return serialize(actor, note.id, `archive:${note.revision}:${archived}`, async () => {
    const access = await authorize(actor); if (!access.ok) return access;
    try {
      const { data, error } = await fromUnknownTable(access.data, TABLE).update({ archived_at: archived ? new Date().toISOString() : null, revision: note.revision + 1 })
        .eq('id', note.id).eq('tenant_id', actor.tenantId).eq('owner_user_id', actor.userId).eq('revision', note.revision).select(COLUMNS).maybeSingle();
      if (error) return errorResult(error, transportError(error));
      if (!data) return conflict();
      const saved = mapNote(data, actor, note.id);
      return saved.revision === note.revision + 1 && Boolean(saved.archivedAt) === archived && draftsEqual(noteToDraft(saved), noteToDraft(note))
        ? { ok: true, data: saved } : errorResult(new Error('Die Änderung konnte nicht bestätigt werden.'), true);
    } catch (error) { return errorResult(error, true); }
  });
}
export async function deleteNote(actor: NotesActor, id: string, expectedRevision: number): Promise<NotesResult<{ id: string }>> {
  actor = actorSnapshot(actor);
  if (!isUuid(id) || !Number.isInteger(expectedRevision) || expectedRevision < 1) return { ok: false, error: 'Die Notizkennung oder gespeicherte Version ist ungültig.' };
  return serialize(actor, id, `delete:${expectedRevision}`, async () => {
    const access = await authorize(actor); if (!access.ok) return access;
    try {
      const { data, error } = await fromUnknownTable(access.data, TABLE).delete().eq('id', id).eq('tenant_id', actor.tenantId)
        .eq('owner_user_id', actor.userId).eq('revision', expectedRevision).not('archived_at', 'is', null).select('id,tenant_id,owner_user_id,revision,archived_at').maybeSingle();
      if (error) return errorResult(error, transportError(error));
      if (!data) return conflict();
      if (data.id !== id || data.tenant_id !== actor.tenantId || data.owner_user_id !== actor.userId || data.revision !== expectedRevision || !data.archived_at) return errorResult(new Error('Die Löschung konnte nicht bestätigt werden.'), true);
      return { ok: true, data: { id } };
    } catch (error) { return errorResult(error, true); }
  });
}
