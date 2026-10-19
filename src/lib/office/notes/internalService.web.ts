import { getSupabaseClient } from '@/lib/supabase/client';
import { fetchRuntimePermissions } from '@/lib/supabase/permissionRepository';
import { isUuid } from '@/lib/validation/uuid';
import { INTERNAL_NOTE_KINDS, INTERNAL_NOTE_PRIORITIES, INTERNAL_NOTE_STATUSES, isInternalNoteDate, validateInternalNoteDraft } from './internalModel.web';
import type { InternalDelivery, InternalDeliveryOperation, InternalNote, InternalNoteActor, InternalNoteBox, InternalNoteDraft, InternalNoteResult, InternalNoteSendReceipt, InternalPendingNoteSend, InternalRecipient } from './internalTypes.web';

type Row = Record<string, unknown>;
type Client = NonNullable<ReturnType<typeof getSupabaseClient>>;
type Failure = Extract<InternalNoteResult<never>, { ok: false }>;
const portalRoles = new Set(['employee_portal', 'client_portal', 'family_portal']);
const row = (value: unknown): Row => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
const timestamp = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));
const snapshot = (actor: InternalNoteActor): InternalNoteActor => ({ ...actor, permissions: actor.permissions ? [...actor.permissions] : undefined });
const conflict = (): Failure => ({ ok: false, conflict: true, error: 'Der Eintrag wurde inzwischen geändert oder ist nicht mehr verfügbar. Bitte neu laden und die Änderung abgleichen.' });
function failure(error: unknown, write = false): Failure {
  const code = row(error).code;
  if (code === '40001' || code === 'P0002') return conflict();
  if (['42501', 'PGRST301', 'PGRST302'].includes(String(code))) return { ok: false, error: 'Für diesen internen Eintrag besteht keine aktuelle Zugriffsberechtigung.' };
  if (['PGRST202', 'PGRST205', '42883', '42P01'].includes(String(code))) return { ok: false, error: 'Interne Einträge sind noch nicht verfügbar. Bitte nach der Aktualisierung erneut laden.' };
  if (typeof code === 'string' && (code.startsWith('22') || ['23514', '23505'].includes(code))) return { ok: false, error: 'Die Angaben oder die Empfängerauswahl wurden abgelehnt. Bitte den Entwurf prüfen.' };
  return { ok: false, ...(write ? { uncertain: true } : {}), error: write
    ? 'Die Speicherung konnte nicht bestätigt werden. Bitte denselben Vorgang erneut prüfen; der Entwurf bleibt erhalten.'
    : 'Die internen Einträge konnten nicht vollständig geladen werden. Bitte erneut versuchen.' };
}

async function authorize(actor: InternalNoteActor, purpose: 'sent' | 'send' | 'inbox' | 'update'): Promise<InternalNoteResult<Client>> {
  if (!isUuid(actor.tenantId) || !isUuid(actor.userId) || !actor.roleKey) return { ok: false, error: 'Bitte mit einem gültigen Zugang und Unternehmen anmelden.' };
  const receiving = purpose === 'inbox' || purpose === 'update';
  if (receiving && (!isUuid(actor.employeeId) || ['client_portal', 'family_portal'].includes(actor.roleKey))) return { ok: false, error: 'Für interne Einträge fehlt eine eindeutige Mitarbeiterzuordnung.' };
  if (!receiving && portalRoles.has(actor.roleKey)) return { ok: false, error: 'Interne Einträge können nur aus der Verwaltung weitergeleitet werden.' };
  if ((purpose === 'send' || purpose === 'update') && actor.readOnly) return { ok: false, error: 'Dieser Zugang kann interne Einträge derzeit nur lesen.' };
  const client = getSupabaseClient();
  if (!client) return { ok: false, error: 'Interne Einträge benötigen eine Datenbankverbindung.' };
  try {
    if (!receiving) {
      const permissions = actor.permissions ?? await fetchRuntimePermissions(actor.roleKey, actor.tenantId);
      if (!permissions.includes('office.access') || purpose === 'send' && !permissions.includes('communication.send_message')) return { ok: false, error: 'Für diese Aktion fehlt die Office- oder Nachrichtenberechtigung.' };
    }
    const { data, error } = await client.auth.getUser();
    if (error || !data?.user || data.user.id !== actor.userId) return { ok: false, error: 'Die Anmeldung hat sich geändert. Bitte den Bereich erneut öffnen.' };
    const portal = data.user.app_metadata?.portal_type;
    if (receiving ? portal && !['business', 'employee'].includes(portal) : portal && portal !== 'business') return { ok: false, error: 'Dieser Zugang ist für die gewählte Aktion nicht freigegeben.' };
    // The RPC verifies the current active profile/account, tenant, permissions
    // and employee binding again. Caller-supplied role/employee IDs cannot grant access.
    return { ok: true, data: client };
  } catch (error) { return failure(error); }
}
async function rpc(client: Client, name: string, args: Row): Promise<Row> {
  const result = await (client as unknown as { rpc: (name: string, args: Row) => PromiseLike<{ data: unknown; error: unknown }> }).rpc(name, args);
  if (result.error) throw result.error;
  const data = row(result.data);
  if (!Object.keys(data).length) throw new Error('Unvollständige Serverantwort.');
  return data;
}
function mapDelivery(value: unknown, actor?: InternalNoteActor): InternalDelivery {
  const item = row(value);
  if (!isUuid(item.id as string) || !isUuid(item.employee_id as string) || !isUuid(item.recipient_user_id as string)
    || typeof item.display_name !== 'string' || !item.display_name.trim()
    || !INTERNAL_NOTE_STATUSES.some(status => status.value === item.status)
    || typeof item.response !== 'string' || item.response.length > 2000
    || !Number.isSafeInteger(item.revision) || Number(item.revision) < 1 || !timestamp(item.updated_at)
    || item.read_at !== null && !timestamp(item.read_at)
    || actor && (item.employee_id !== actor.employeeId || item.recipient_user_id !== actor.userId)) throw new Error('Ungültige oder fremde Zustellungsantwort.');
  return { id: item.id as string, employeeId: item.employee_id as string, recipientUserId: item.recipient_user_id as string,
    displayName: item.display_name, status: item.status as InternalDelivery['status'], response: item.response,
    revision: Number(item.revision), updatedAt: item.updated_at, readAt: item.read_at as string | null };
}
function mapNote(value: unknown, actor: InternalNoteActor, box: InternalNoteBox): InternalNote {
  const item = row(value);
  if (!isUuid(item.id as string) || item.tenant_id !== actor.tenantId || !isUuid(item.sender_user_id as string)
    || box === 'sent' && item.sender_user_id !== actor.userId || typeof item.sender_name !== 'string' || !item.sender_name.trim()
    || !INTERNAL_NOTE_KINDS.some(kind => kind.value === item.type) || !INTERNAL_NOTE_PRIORITIES.some(priority => priority.value === item.priority)
    || typeof item.title !== 'string' || !item.title.trim() || item.title.length > 240
    || typeof item.body !== 'string' || !item.body.trim() || item.body.length > 20000 || !isInternalNoteDate(item.due_date ?? '')
    || !timestamp(item.created_at) || !Array.isArray(item.deliveries) || item.deliveries.length < 1 || item.deliveries.length > 25
    || box === 'inbox' && item.deliveries.length !== 1) throw new Error('Ungültiger oder fremder interner Eintrag.');
  const recipients = item.deliveries.map(delivery => mapDelivery(delivery, box === 'inbox' ? actor : undefined));
  if (new Set(recipients.map(delivery => delivery.id)).size !== recipients.length || new Set(recipients.map(delivery => delivery.employeeId)).size !== recipients.length) throw new Error('Doppelte Empfängerbestätigung.');
  return { id: item.id as string, tenantId: actor.tenantId, senderUserId: item.sender_user_id as string, senderName: item.sender_name,
    kind: item.type as InternalNote['kind'], priority: item.priority as InternalNote['priority'], title: item.title, body: item.body,
    dueDate: (item.due_date ?? '') as string, createdAt: item.created_at, recipients };
}
async function pages<T>(load: (offset: number) => Promise<Row>, map: (item: unknown) => T, id: (item: T) => string): Promise<T[]> {
  const result: T[] = [], seen = new Set<string>(); let total: number | undefined;
  for (let offset = 0; offset < 10000; offset += 100) {
    const page = await load(offset);
    if (!Array.isArray(page.items) || page.items.length > 100 || !Number.isSafeInteger(page.total) || Number(page.total) < 0
      || total !== undefined && total !== page.total) throw new Error('Die Liste hat sich beim Laden geändert.');
    total = Number(page.total);
    for (const item of page.items) {
      const mapped = map(item), key = id(mapped);
      if (seen.has(key)) throw new Error('Die Liste hat sich beim Laden geändert.');
      seen.add(key); result.push(mapped);
    }
    if (result.length === total) return result;
    if (result.length > total || page.items.length < 100) throw new Error('Die Liste wurde nicht vollständig geladen.');
  }
  throw new Error('Die Liste ist für eine vollständige Anzeige zu umfangreich.');
}

export async function listInternalRecipients(actor: InternalNoteActor): Promise<InternalNoteResult<InternalRecipient[]>> {
  actor = snapshot(actor); const access = await authorize(actor, 'send'); if (!access.ok) return access;
  try {
    const recipients = await pages(offset => rpc(access.data, 'office_internal_note_recipients', { p_tenant_id: actor.tenantId, p_query: '', p_limit: 100, p_offset: offset }), value => {
      const item = row(value);
      if (!isUuid(item.employee_id as string) || typeof item.display_name !== 'string' || !item.display_name.trim()) throw new Error('Ungültige Mitarbeiterzuordnung.');
      return { employeeId: item.employee_id as string, displayName: item.display_name };
    }, item => item.employeeId);
    return { ok: true, data: recipients };
  } catch (error) {
    if (row(error).code === '42501') return { ok: false, error: 'Die Mitarbeitendenauswahl ist für diesen Zugang nicht freigegeben.' };
    return failure(error);
  }
}
export async function listInternalNotes(actor: InternalNoteActor, box: InternalNoteBox): Promise<InternalNoteResult<InternalNote[]>> {
  actor = snapshot(actor);
  if (!['sent', 'inbox'].includes(box)) return { ok: false, error: 'Die gewünschte Ansicht ist ungültig.' };
  const access = await authorize(actor, box); if (!access.ok) return access;
  try {
    return { ok: true, data: await pages(offset => rpc(access.data, 'office_internal_note_read', { p_tenant_id: actor.tenantId, p_box: box, p_dispatch_id: null, p_limit: 100, p_offset: offset }), value => mapNote(value, actor, box), note => note.id) };
  } catch (error) { return failure(error); }
}

type SendAttempt = { requestId: string; signature: string; draft: InternalNoteDraft; uncertain: boolean; pending?: Promise<InternalNoteResult<InternalNoteSendReceipt>> };
const sendAttempts = new Map<string, SendAttempt>();
/** Restore only the current account's reviewed, unconfirmed send after remount. */
export async function recoverPendingInternalNoteSend(actor: InternalNoteActor): Promise<InternalNoteResult<InternalPendingNoteSend | null>> {
  actor = snapshot(actor);
  const access = await authorize(actor, 'send'); if (!access.ok) return access;
  const key = `${actor.tenantId}:${actor.userId}`;
  const current = sendAttempts.get(key);
  if (current?.pending) {
    await current.pending;
    // Waiting for another component's request must not expose an old account's
    // text if the session changed while that request was outstanding.
    const recheck = await authorize(actor, 'send'); if (!recheck.ok) return recheck;
  }
  const unresolved = sendAttempts.get(key);
  return { ok: true, data: unresolved?.uncertain ? { requestId: unresolved.requestId,
    draft: { ...unresolved.draft, recipientEmployeeIds: [...unresolved.draft.recipientEmployeeIds] } } : null };
}
/** Retrying an unconfirmed send must keep both its UUID and reviewed content. */
export async function sendInternalNote(actor: InternalNoteActor, requestId: string, draft: InternalNoteDraft): Promise<InternalNoteResult<InternalNoteSendReceipt>> {
  actor = snapshot(actor);
  if (!isUuid(requestId)) return { ok: false, error: 'Die Versandkennung ist ungültig. Bitte den Versanddialog erneut öffnen.' };
  const invalid = validateInternalNoteDraft(draft); if (invalid) return { ok: false, error: invalid };
  // Explicit allowlist: even an OfficeNote-shaped caller can never send its
  // owner, note ID, hidden fields, handwriting or other private metadata.
  const payload = { title: draft.title.trim(), body: draft.body.trim(), type: draft.kind, priority: draft.priority,
    due_date: draft.dueDate || null, recipient_employee_ids: draft.recipientEmployeeIds.map(id => id.toLowerCase()).sort() };
  const signature = JSON.stringify(payload), key = `${actor.tenantId}:${actor.userId}`;
  const access = await authorize(actor, 'send'); if (!access.ok) return access;
  const previous = sendAttempts.get(key);
  if (previous && (previous.requestId !== requestId || previous.signature !== signature)) return { ok: false, conflict: true,
    ...(previous.uncertain ? { uncertain: true } : {}), error: previous.uncertain
      ? 'Der vorherige Versand ist noch unbestätigt. Bitte denselben Versand mit unverändertem Text, denselben Empfängern und derselben Kennung erneut versuchen.'
      : 'Ein Versand läuft bereits. Bitte zuerst seine Bestätigung abwarten.' };
  if (previous?.pending) return previous.pending;
  const attempt: SendAttempt = previous ?? { requestId, signature, uncertain: false,
    draft: { title: payload.title, body: payload.body, kind: payload.type, priority: payload.priority,
      dueDate: payload.due_date ?? '', recipientEmployeeIds: [...payload.recipient_employee_ids] } };
  const pending = Promise.resolve().then(async (): Promise<InternalNoteResult<InternalNoteSendReceipt>> => {
    try {
      const saved = await rpc(access.data, 'office_internal_note_send', { p_tenant_id: actor.tenantId, p_sender_user_id: actor.userId, p_request_id: requestId, p_payload: payload });
      if (!isUuid(saved.dispatch_id as string) || !timestamp(saved.created_at)
        || saved.tenant_id !== actor.tenantId || saved.sender_user_id !== actor.userId) throw new Error('Unvollständige oder fremde Versandbestätigung.');
      return { ok: true, data: { dispatchId: saved.dispatch_id as string, createdAt: saved.created_at } };
    } catch (error) {
      const result = failure(error, true);
      return attempt.uncertain ? { ...result, uncertain: true } : result;
    }
  });
  attempt.pending = pending; sendAttempts.set(key, attempt);
  const result = await pending;
  if (sendAttempts.get(key) === attempt) {
    if (!result.ok && result.uncertain) { attempt.uncertain = true; attempt.pending = undefined; }
    else sendAttempts.delete(key);
  }
  return result;
}

const deliveryWrites = new Map<string, { signature: string; pending: Promise<InternalNoteResult<InternalDelivery>> }>();
export async function updateInternalDelivery(actor: InternalNoteActor, operation: InternalDeliveryOperation): Promise<InternalNoteResult<InternalDelivery>> {
  actor = snapshot(actor); operation = { ...operation };
  if (!isUuid(operation.deliveryId) || !isUuid(operation.employeeId) || operation.employeeId !== actor.employeeId
    || !Number.isSafeInteger(operation.expectedRevision) || operation.expectedRevision < 1
    || !['read', 'status'].includes(operation.action)
    || operation.action === 'read' && (operation.status !== undefined || operation.response !== undefined)
    || operation.action === 'status' && !INTERNAL_NOTE_STATUSES.some(item => item.value === operation.status)
    || operation.response !== undefined && (typeof operation.response !== 'string' || operation.response.length > 2000)) return { ok: false, error: 'Die Zustellung, der Bearbeitungsstand oder die Rückmeldung ist ungültig.' };
  const access = await authorize(actor, 'update'); if (!access.ok) return access;
  const args = { p_tenant_id: actor.tenantId, p_delivery_id: operation.deliveryId, p_expected_revision: operation.expectedRevision,
    p_action: operation.action, p_status: operation.status ?? null, p_response: operation.response === undefined ? null : operation.response.trim() };
  const key = `${actor.tenantId}:${actor.userId}:${operation.deliveryId}`, signature = JSON.stringify(args), previous = deliveryWrites.get(key);
  if (previous) return previous.signature === signature ? previous.pending : conflict();
  const pending = Promise.resolve().then(async (): Promise<InternalNoteResult<InternalDelivery>> => {
    try {
      const delivery = mapDelivery(await rpc(access.data, 'office_internal_note_delivery_update', args), actor);
      if (delivery.id !== operation.deliveryId || ![operation.expectedRevision, operation.expectedRevision + 1].includes(delivery.revision) || !delivery.readAt
        || operation.action === 'status' && (delivery.status !== operation.status || operation.response !== undefined && delivery.response !== operation.response.trim())) throw new Error('Die Änderung wurde nicht passend bestätigt.');
      return { ok: true, data: delivery };
    } catch (error) { return failure(error, true); }
  });
  deliveryWrites.set(key, { signature, pending });
  const result = await pending;
  if (deliveryWrites.get(key)?.pending === pending) deliveryWrites.delete(key);
  return result;
}
