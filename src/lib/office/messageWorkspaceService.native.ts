// Generated native presentation from src/lib/office/messageWorkspaceService.web.ts. Update through scripts/port-native-workspaces.mjs.
import {nativeBlob as Blob} from '@/lib/platform/nativeWorkflowEnvironment.native';
import type { RoleKey, ServiceResult } from '@/types';
import type { CreateOfficeThreadInput, OfficeMessage, OfficeMessageAudience, OfficeMessageCategory, OfficeMessageThread, OfficeMessageThreadDetail } from '@/types/office/messaging';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getSupabaseClient } from "../supabase/client.ts";
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { canViewOfficeInternalMessages } from '@/lib/communication/officeComposeRouting';
import { fromDbThreadType, toDbThreadType, validateCreateThread, canSendMessageToThread } from './messagebusinessrules';
import { fromDbThreadStatus, isClosedAppStatus } from './messagestatuslabels';
import { fetchOfficeMessageThreadById, fetchOfficeMessageCategories } from './messagethreadservice';
import { mapMessageRow } from './messageservice';
import { buildMessageAttachmentPath, type MessageAttachment } from './messageattachmentservice';
import { validateMessageAttachment, normalizeAttachmentMimeType, type PendingMessageAttachment } from './messageattachmentvalidation';
import { loadMessagePreferences } from "./messageWorkspaceSettings.native.ts";
import { auditFromThread, logOfficeMessageAuditEvent } from './officemessageauditservice';
export type MessagingActor = {
    tenantId: string;
    profileId: string;
    roleKey: RoleKey | null | undefined;
    displayName?: string;
};
export type ConversationPage = {
    items: OfficeMessageThread[];
    hasMore: boolean;
    nextOffset: number;
};
export type MessagePage = {
    items: OfficeMessage[];
    hasMore: boolean;
    nextOffset: number;
};
export const CONVERSATION_PAGE_SIZE = 80;
export const MESSAGE_PAGE_SIZE = 80;
type Row = Record<string, unknown>;
const str = (value: unknown) => value == null ? null : String(value);
const problem = (error: unknown): {
    ok: false;
    error: string;
} => ({ ok: false, error: error instanceof Error ? error.message : toGermanSupabaseError(error as never) });
function scopeBlock<T>(actor: MessagingActor, write = false): ServiceResult<T> | null {
    return enforcePermission<T>(actor.roleKey, write ? 'communication.send_message' : 'office.messages.view')
        ?? guardServiceTenant(actor.tenantId)
        ?? (!actor.profileId ? { ok: false, error: 'Bitte erneut anmelden.' } : null);
}
export function mapWorkspaceThread(row: Row): OfficeMessageThread | null {
    const threadType = fromDbThreadType(String(row.thread_type));
    if (!threadType)
        return null;
    return {
        id: String(row.id), tenantId: String(row.tenant_id), threadType, subject: String(row.subject ?? ''),
        status: fromDbThreadStatus(String(row.status)), priority: (row.priority ?? 'normal') as OfficeMessageThread['priority'],
        clientId: str(row.client_id), employeeId: str(row.employee_id), categoryId: str(row.category_id),
        clientName: null, employeeName: null, participantName: null, categoryLabel: null,
        assignedToUserId: str(row.assigned_to_user_id), assignedToUserName: null, assignedAt: str(row.assigned_at),
        closedAt: str(row.closed_at), closedByUserId: str(row.closed_by_user_id),
        lastMessageAt: str(row.last_message_at), lastMessagePreview: str(row.last_message_preview),
        unreadCount: Number(row.office_unread_count ?? 0), archivedAt: str(row.archived_at),
        createdAt: String(row.created_at), updatedAt: String(row.updated_at),
    };
}
async function names(actor: MessagingActor, table: 'clients' | 'employees' | 'profiles', ids: (string | null | undefined)[]) {
    const unique = [...new Set(ids.filter((id): id is string => !!id))];
    const result = new Map<string, string>();
    const db = getSupabaseClient();
    if (!db || !unique.length)
        return result;
    for (let offset = 0; offset < unique.length; offset += 100) {
        const { data, error } = await fromUnknownTable(db, table)
            .select(table === 'profiles' ? 'id, display_name' : 'id, first_name, last_name')
            .eq('tenant_id', actor.tenantId).in('id', unique.slice(offset, offset + 100));
        if (error)
            throw new Error(toGermanSupabaseError(error));
        for (const row of (data ?? []) as unknown as Row[]) {
            const label = table === 'profiles' ? String(row.display_name ?? '') : `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim();
            if (label)
                result.set(String(row.id), label);
        }
    }
    return result;
}
async function hydrateConversations(actor: MessagingActor, threads: OfficeMessageThread[], categories?: OfficeMessageCategory[]) {
    const db = getSupabaseClient();
    if (!db || !threads.length)
        return threads;
    const groups = threads.filter(item => item.threadType === 'employee_group_office').map(item => item.id);
    const internals = threads.filter(item => item.threadType === 'internal').map(item => item.id);
    const [groupResult, internalResult, categoryResult] = await Promise.all([
        groups.length ? fromUnknownTable(db, 'message_thread_employee_participants').select('thread_id, employee_id').eq('tenant_id', actor.tenantId).in('thread_id', groups).eq('is_active', true) : Promise.resolve({ data: [], error: null }),
        internals.length ? fromUnknownTable(db, 'message_thread_participants').select('thread_id, profile_id').eq('tenant_id', actor.tenantId).in('thread_id', internals).eq('is_active', true) : Promise.resolve({ data: [], error: null }),
        categories ? Promise.resolve({ ok: true as const, data: categories }) : fetchOfficeMessageCategories(actor.tenantId, actor.roleKey),
    ]);
    if (groupResult.error || internalResult.error)
        throw new Error(toGermanSupabaseError(groupResult.error ?? internalResult.error));
    if (!categoryResult.ok)
        throw new Error(categoryResult.error);
    const groupRows = (groupResult.data ?? []) as Row[];
    const internalRows = (internalResult.data ?? []) as Row[];
    const [clients, employees, profiles] = await Promise.all([
        names(actor, 'clients', threads.map(t => t.clientId)),
        names(actor, 'employees', [...threads.map(t => t.employeeId), ...groupRows.map(r => String(r.employee_id))]),
        names(actor, 'profiles', [...threads.map(t => t.assignedToUserId), ...internalRows.map(r => String(r.profile_id))]),
    ]);
    return threads.map(thread => {
        const employeeIds = groupRows.filter(r => r.thread_id === thread.id).map(r => String(r.employee_id));
        const profileIds = internalRows.filter(r => r.thread_id === thread.id).map(r => String(r.profile_id));
        const participants = (thread.threadType === 'internal' ? profileIds.filter(id => id !== actor.profileId).map(id => profiles.get(id)) : employeeIds.map(id => employees.get(id))).filter(Boolean) as string[];
        return { ...thread, clientName: clients.get(thread.clientId ?? '') ?? null, employeeName: employees.get(thread.employeeId ?? '') ?? null,
            assignedToUserName: profiles.get(thread.assignedToUserId ?? '') ?? null,
            categoryLabel: categoryResult.data.find(c => c.id === thread.categoryId)?.label ?? null,
            participantProfileIds: profileIds, employeeParticipantIds: employeeIds, employeeParticipantNames: employeeIds.map(id => employees.get(id) ?? 'Mitarbeitende'),
            memberCount: thread.threadType === 'internal' ? profileIds.length : employeeIds.length, participantName: participants.join(', ') || null };
    });
}
export async function loadConversations(actor: MessagingActor, audience: OfficeMessageAudience, offset = 0): Promise<ServiceResult<ConversationPage>> {
    const blocked = scopeBlock<ConversationPage>(actor);
    if (blocked)
        return blocked;
    if (audience === 'internal' && !canViewOfficeInternalMessages(actor.roleKey))
        return { ok: false, error: 'Keine Berechtigung für interne Gespräche.' };
    const db = getSupabaseClient();
    if (!db)
        return { ok: false, error: 'Nachrichten sind gerade nicht erreichbar.' };
    try {
        const types = audience === 'employees' ? ['employee', 'employee_group'] : audience === 'clients' ? ['client'] : ['internal'];
        const { data, error } = await fromUnknownTable(db, 'message_threads').select('*').eq('tenant_id', actor.tenantId)
            .in('thread_type', types).neq('status', 'deleted').order('last_message_at', { ascending: false, nullsFirst: false }).order('id', { ascending: false }).range(offset, offset + CONVERSATION_PAGE_SIZE);
        if (error)
            return problem(error);
        const rows = data ?? [];
        const threads = rows.slice(0, CONVERSATION_PAGE_SIZE).map(row => mapWorkspaceThread(row as Row)).filter((thread): thread is OfficeMessageThread => !!thread);
        return { ok: true, data: { items: await hydrateConversations(actor, threads), hasMore: rows.length > CONVERSATION_PAGE_SIZE, nextOffset: offset + CONVERSATION_PAGE_SIZE } };
    }
    catch (error) {
        return problem(error);
    }
}
export async function loadConversationMessages(actor: MessagingActor, threadId: string, offset = 0): Promise<ServiceResult<MessagePage>> {
    const blocked = scopeBlock<MessagePage>(actor);
    if (blocked)
        return blocked;
    const db = getSupabaseClient();
    if (!db)
        return { ok: false, error: 'Nachrichten sind gerade nicht erreichbar.' };
    try {
        const allowed = await fetchOfficeMessageThreadById(actor.tenantId, threadId, actor.roleKey);
        if (!allowed.ok)
            return allowed;
        if (!allowed.data || allowed.data.status === 'deleted')
            return { ok: false, error: 'Gespräch nicht gefunden.' };
        const { data, error } = await db.from('messages').select('*').eq('tenant_id', actor.tenantId).eq('thread_id', threadId).in('status', ['sent', 'read'])
            .order('created_at', { ascending: false }).order('id', { ascending: false }).range(offset, offset + MESSAGE_PAGE_SIZE);
        if (error)
            return problem(error);
        const rows = data ?? [];
        const messages = rows.slice(0, MESSAGE_PAGE_SIZE).map(row => mapMessageRow(row as Row)).reverse();
        const [profiles, clients, employees] = await Promise.all([names(actor, 'profiles', messages.map(m => m.senderProfileId)), names(actor, 'clients', messages.map(m => m.senderClientId)), names(actor, 'employees', messages.map(m => m.senderEmployeeId))]);
        return { ok: true, data: { items: messages.map(message => ({ ...message, senderDisplayName: profiles.get(message.senderProfileId ?? '') || clients.get(message.senderClientId ?? '') || employees.get(message.senderEmployeeId ?? '') || message.senderDisplayName })), hasMore: rows.length > MESSAGE_PAGE_SIZE, nextOffset: offset + MESSAGE_PAGE_SIZE } };
    }
    catch (error) {
        return problem(error);
    }
}
export async function loadConversation(actor: MessagingActor, threadId: string): Promise<ServiceResult<{
    thread: OfficeMessageThreadDetail;
    hasMore: boolean;
}>> {
    const blocked = scopeBlock<{
        thread: OfficeMessageThreadDetail;
        hasMore: boolean;
    }>(actor);
    if (blocked)
        return blocked;
    try {
        const [threadResult, messageResult] = await Promise.all([fetchOfficeMessageThreadById(actor.tenantId, threadId, actor.roleKey), loadConversationMessages(actor, threadId)]);
        if (!threadResult.ok)
            return threadResult;
        if (!messageResult.ok)
            return messageResult;
        if (!threadResult.data || threadResult.data.status === 'deleted')
            return { ok: false, error: 'Gespräch nicht gefunden.' };
        const [thread] = await hydrateConversations(actor, [threadResult.data]);
        return { ok: true, data: { thread: { ...thread, messages: messageResult.data.items, isClosed: isClosedAppStatus(thread.status), canReply: canSendMessageToThread(thread.status) }, hasMore: messageResult.data.hasMore } };
    }
    catch (error) {
        return problem(error);
    }
}
/** IDs belong to one immutable form submission; retrying reconciles that same record. */
export type ConversationOperation = {
    id: string;
    input: CreateOfficeThreadInput;
};
export async function createConversation(actor: MessagingActor, operation: ConversationOperation): Promise<ServiceResult<{
    id: string;
}>> {
    const blocked = scopeBlock<{
        id: string;
    }>(actor, true) ?? enforcePermission<{
        id: string;
    }>(actor.roleKey, 'communication.create_thread');
    if (blocked)
        return blocked;
    const input = operation.input;
    if (input.threadType === 'internal' && !canViewOfficeInternalMessages(actor.roleKey))
        return { ok: false, error: 'Keine Berechtigung für interne Gespräche.' };
    const validation = validateCreateThread(input);
    if (!validation.ok)
        return validation;
    if (!input.subject.trim())
        return { ok: false, error: 'Bitte einen Betreff eingeben.' };
    if (input.threadType === 'internal' && !input.participantProfileIds?.length)
        return { ok: false, error: 'Bitte mindestens eine Person auswählen.' };
    const db = getSupabaseClient();
    if (!db)
        return { ok: false, error: 'Nachrichten sind gerade nicht erreichbar.' };
    const payload = { id: operation.id, tenant_id: actor.tenantId, thread_type: toDbThreadType(input.threadType), status: 'received', priority: input.priority ?? 'normal', subject: input.subject.trim(), category_id: input.categoryId ?? null, client_id: input.clientId ?? null, employee_id: input.employeeId ?? null, created_by_profile_id: actor.profileId, last_message_at: new Date().toISOString(), last_message_preview: 'Gespräch eröffnet' };
    try {
        const recipients: [
            string,
            string[]
        ][] = [
            ['clients', input.clientId ? [input.clientId] : []],
            ['employees', [...new Set([...(input.employeeId ? [input.employeeId] : []), ...(input.employeeParticipantIds ?? [])])]],
            ['profiles', [...new Set(input.participantProfileIds ?? [])]],
            ['message_categories', input.categoryId ? [input.categoryId] : []],
        ];
        for (const [table, ids] of recipients) {
            if (!ids.length)
                continue;
            const result = await fromUnknownTable(db, table).select('id').eq('tenant_id', actor.tenantId).in('id', ids);
            if (result.error)
                return problem(result.error);
            if (result.data?.length !== ids.length)
                return { ok: false, error: 'Ein Empfänger oder eine Kategorie ist nicht mehr verfügbar. Bitte die Auswahl prüfen.' };
        }
        let existing = await fromUnknownTable(db, 'message_threads').select('*').eq('tenant_id', actor.tenantId).eq('id', operation.id).maybeSingle();
        if (existing.error)
            return problem(existing.error);
        if (!existing.data) {
            const inserted = await fromUnknownTable(db, 'message_threads').insert(payload).select('*').single();
            if (inserted.error) {
                existing = await fromUnknownTable(db, 'message_threads').select('*').eq('tenant_id', actor.tenantId).eq('id', operation.id).maybeSingle();
                if (existing.error || !existing.data)
                    return problem(inserted.error);
            }
            else
                existing = { data: inserted.data, error: null } as typeof existing;
            void logOfficeMessageAuditEvent({ tenantId: actor.tenantId, threadId: operation.id, threadType: input.threadType, clientId: input.clientId, employeeId: input.employeeId, actorName: actor.displayName, action: 'office_message_thread_created', summary: 'Unterhaltung angelegt.', metadata: { threadId: operation.id } }).catch(() => { });
        }
        const row = existing.data;
        if (!row || row.created_by_profile_id !== actor.profileId || row.subject !== payload.subject || row.thread_type !== payload.thread_type || (row.client_id ?? null) !== payload.client_id || (row.employee_id ?? null) !== payload.employee_id || (row.category_id ?? null) !== payload.category_id || row.priority !== payload.priority)
            return { ok: false, error: 'Die gespeicherte Unterhaltung stimmt nicht mit diesem Entwurf überein.' };
        if (input.threadType === 'internal' || input.threadType === 'employee_group_office') {
            const internal = input.threadType === 'internal';
            const table = internal ? 'message_thread_participants' : 'message_thread_employee_participants';
            const column = internal ? 'profile_id' : 'employee_id';
            const ids = [...new Set(internal ? [...(input.participantProfileIds ?? []), actor.profileId] : input.employeeParticipantIds ?? [])];
            const { error } = await fromUnknownTable(db, table).upsert(ids.map(id => ({ tenant_id: actor.tenantId, thread_id: operation.id, [column]: id, is_active: true })), { onConflict: `thread_id,${column}`, ignoreDuplicates: true });
            if (error)
                return { ok: false, error: `Die Unterhaltung wurde angelegt, aber die Teilnehmer konnten noch nicht vollständig gespeichert werden. Mit „Einrichtung fortsetzen“ wird dieselbe Unterhaltung vervollständigt. ${toGermanSupabaseError(error)}` };
        }
        return { ok: true, data: { id: operation.id } };
    }
    catch {
        return { ok: false, error: 'Die Einrichtung ist noch nicht bestätigt. Bitte fortsetzen; dabei wird dieselbe Unterhaltung verwendet.' };
    }
}
export type MessageOperation = {
    id: string;
    body: string;
    internal: boolean;
    attachments: PendingMessageAttachment[];
};
/** Publication and each attachment use stable IDs. A retry never inserts a second message. */
export async function sendWorkspaceMessage(actor: MessagingActor, threadId: string, operation: MessageOperation): Promise<ServiceResult<{
    id: string;
}>> {
    const blocked = scopeBlock<{
        id: string;
    }>(actor, true) ?? (operation.internal ? enforcePermission<{
        id: string;
    }>(actor.roleKey, 'communication.send_internal_note') : null) ?? (operation.attachments.some(file => normalizeAttachmentMimeType(file.mimeType).startsWith('audio/')) ? enforcePermission<{
        id: string;
    }>(actor.roleKey, 'communication.send_voice_message') : null);
    if (blocked)
        return blocked;
    if (!operation.body.trim() && !operation.attachments.length)
        return { ok: false, error: 'Bitte eine Nachricht schreiben oder eine Datei hinzufügen.' };
    if (operation.body.length > 12000 || operation.attachments.length > 6 || operation.attachments.reduce((sum, file) => sum + file.fileSizeBytes, 0) > 100 * 1024 * 1024)
        return { ok: false, error: 'Bitte die Nachricht kürzen oder die Anzahl beziehungsweise Größe der Anhänge reduzieren.' };
    for (const attachment of operation.attachments) {
        const valid = validateMessageAttachment(attachment);
        if (!valid.ok)
            return valid;
    }
    const db = getSupabaseClient();
    if (!db)
        return { ok: false, error: 'Nachrichten sind gerade nicht erreichbar.' };
    const body = operation.body.trim() || (operation.attachments.length === 1 ? operation.attachments[0].fileName : `${operation.attachments.length} Anhänge`);
    try {
        const preferences = await loadMessagePreferences(actor);
        if (!preferences.ok)
            return preferences;
        if (operation.internal && !preferences.data.internalNotesEnabled)
            return { ok: false, error: 'Interne Notizen wurden in den Nachrichteneinstellungen deaktiviert.' };
        if (operation.attachments.some(file => !preferences.data.attachmentsEnabled && !(file.mimeType.startsWith('audio/') && preferences.data.voiceMessagesEnabled)))
            return { ok: false, error: 'Dateianhänge wurden in den Nachrichteneinstellungen deaktiviert.' };
        const thread = await fetchOfficeMessageThreadById(actor.tenantId, threadId, actor.roleKey);
        if (!thread.ok)
            return thread;
        if (!thread.data || !canSendMessageToThread(thread.data.status))
            return { ok: false, error: 'Dieses Gespräch ist abgeschlossen. Bitte zuerst wieder öffnen.' };
        let existing = await db.from('messages').select('*').eq('tenant_id', actor.tenantId).eq('id', operation.id).maybeSingle();
        if (existing.error)
            return problem(existing.error);
        if (!existing.data) {
            const inserted = await db.from('messages').insert({ id: operation.id, tenant_id: actor.tenantId, thread_id: threadId, body, sender_profile_id: actor.profileId, sent_at: new Date().toISOString(), is_internal_note: operation.internal, is_system_message: false, status: 'sent' }).select('*').single();
            if (inserted.error) {
                existing = await db.from('messages').select('*').eq('tenant_id', actor.tenantId).eq('id', operation.id).maybeSingle();
                if (existing.error || !existing.data)
                    return problem(inserted.error);
            }
            else
                existing = { ...existing, data: inserted.data, error: null };
            void logOfficeMessageAuditEvent({ tenantId: actor.tenantId, ...auditFromThread(thread.data), actorName: actor.displayName, action: operation.internal ? 'office_message_internal_note' : 'office_message_sent', summary: operation.internal ? 'Interne Notiz gespeichert.' : 'Nachricht gespeichert.', metadata: { messageId: operation.id } }).catch(() => { });
        }
        const message = existing.data;
        if (!message || message.thread_id !== threadId || message.sender_profile_id !== actor.profileId || message.body !== body || message.is_internal_note !== operation.internal)
            return { ok: false, error: 'Diese Versandbestätigung gehört nicht zu dieser Nachricht.' };
        for (const attachment of operation.attachments) {
            const filePath = buildMessageAttachmentPath(actor.tenantId, threadId, attachment.id, attachment.fileName);
            const stored = await db.from('message_attachments').select('id, message_id, file_path').eq('tenant_id', actor.tenantId).eq('id', attachment.id).maybeSingle();
            if (stored.error)
                return problem(stored.error);
            if (stored.data) {
                if (stored.data.message_id !== operation.id || stored.data.file_path !== filePath)
                    return { ok: false, error: 'Der Anhang gehört nicht zu dieser Nachricht.' };
                continue;
            }
            const mimeType = normalizeAttachmentMimeType(attachment.mimeType);
            const uploaded = await db.storage.from('message-attachments').upload(filePath, new Blob([new Uint8Array(attachment.fileData).buffer], { type: mimeType }), { contentType: mimeType, upsert: false });
            // A previous upload may have succeeded while its response was lost. Never overwrite it.
            if (uploaded.error && !/already exists|duplicate/i.test(uploaded.error.message) && String((uploaded.error as {
                statusCode?: string;
            }).statusCode) !== '409')
                return { ok: false, error: `Die Nachricht ist gespeichert. „${attachment.fileName}“ konnte noch nicht angehängt werden. Versand fortsetzen, um nur fehlende Anhänge zu ergänzen.` };
            const { error } = await db.from('message_attachments').insert({ id: attachment.id, tenant_id: actor.tenantId, message_id: operation.id, file_name: attachment.fileName, file_path: filePath, file_url: null, file_size_bytes: attachment.fileSizeBytes, mime_type: mimeType }).select('id').single();
            if (error)
                return { ok: false, error: 'Die Nachricht ist gespeichert. Die Bestätigung eines Anhangs fehlt noch. Bitte den Versand fortsetzen.' };
        }
        // Internal notes must not replace the portal's last-message preview or status.
        if (!operation.internal) {
            const sentAt = message.sent_at ?? message.created_at;
            const updated = await db.from('message_threads').update({ last_message_at: sentAt, last_message_preview: body.slice(0, 120), status: 'waiting_for_reply' }).eq('tenant_id', actor.tenantId).eq('id', threadId).or(`last_message_at.is.null,last_message_at.lte.${sentAt}`).select('id').maybeSingle();
            if (updated.error)
                return { ok: false, error: 'Die Nachricht ist gespeichert. Die Gesprächsübersicht konnte noch nicht aktualisiert werden. Bitte den Versand fortsetzen.' };
            if (!updated.data) {
                const latest = await fetchOfficeMessageThreadById(actor.tenantId, threadId, actor.roleKey);
                if (!latest.ok || !latest.data?.lastMessageAt || latest.data.lastMessageAt <= sentAt)
                    return { ok: false, error: 'Die Nachricht ist gespeichert. Die Gesprächsübersicht ist noch nicht bestätigt. Bitte den Versand fortsetzen.' };
            }
        }
        return { ok: true, data: { id: operation.id } };
    }
    catch {
        return { ok: false, error: 'Der Versand ist noch nicht vollständig bestätigt. Bitte den Versand fortsetzen; die Nachricht wird dabei nicht ein zweites Mal angelegt.' };
    }
}
export async function verifyMessageAttachment(actor: MessagingActor, threadId: string, attachment: MessageAttachment): Promise<ServiceResult<MessageAttachment>> {
    const blocked = scopeBlock<MessageAttachment>(actor);
    if (blocked)
        return blocked;
    if (attachment.tenantId !== actor.tenantId)
        return { ok: false, error: 'Dieser Anhang gehört nicht zu dieser Unterhaltung.' };
    if (!attachment.filePath)
        return { ok: false, error: 'Für diesen älteren Anhang ist kein abrufbarer Dateipfad hinterlegt.' };
    if (!attachment.filePath.startsWith(`tenant/${actor.tenantId}/threads/${threadId}/`))
        return { ok: false, error: 'Dieser Anhang gehört nicht zu dieser Unterhaltung.' };
    const db = getSupabaseClient();
    if (!db)
        return { ok: false, error: 'Anhang gerade nicht erreichbar.' };
    const thread = await fetchOfficeMessageThreadById(actor.tenantId, threadId, actor.roleKey);
    if (!thread.ok || !thread.data || thread.data.status === 'deleted')
        return { ok: false, error: 'Kein Zugriff auf diese Unterhaltung.' };
    const message = await db.from('messages').select('id').eq('tenant_id', actor.tenantId).eq('thread_id', threadId).eq('id', attachment.messageId).in('status', ['sent', 'read']).maybeSingle();
    if (message.error || !message.data)
        return { ok: false, error: 'Die zugehörige Nachricht ist nicht verfügbar.' };
    const stored = await db.from('message_attachments').select('id, file_path').eq('tenant_id', actor.tenantId).eq('message_id', attachment.messageId).eq('id', attachment.id).maybeSingle();
    if (stored.error || stored.data?.file_path !== attachment.filePath)
        return { ok: false, error: 'Der Anhang ist nicht mehr verfügbar.' };
    return { ok: true, data: attachment };
}
export async function loadConversationAttachments(actor: MessagingActor, threadId: string, messageIds: string[]): Promise<ServiceResult<MessageAttachment[]>> {
    const blocked = scopeBlock<MessageAttachment[]>(actor);
    if (blocked)
        return blocked;
    if (!messageIds.length)
        return { ok: true, data: [] };
    const db = getSupabaseClient();
    if (!db)
        return { ok: false, error: 'Anhänge sind gerade nicht erreichbar.' };
    try {
        const thread = await fetchOfficeMessageThreadById(actor.tenantId, threadId, actor.roleKey);
        if (!thread.ok)
            return thread;
        if (!thread.data || thread.data.status === 'deleted')
            return { ok: false, error: 'Gespräch nicht gefunden.' };
        const attachments: MessageAttachment[] = [];
        for (let offset = 0; offset < messageIds.length; offset += 100) {
            const messages = await db.from('messages').select('id').eq('tenant_id', actor.tenantId).eq('thread_id', threadId).in('id', messageIds.slice(offset, offset + 100)).in('status', ['sent', 'read']);
            if (messages.error)
                return problem(messages.error);
            const ids = (messages.data ?? []).map(item => item.id);
            if (!ids.length)
                continue;
            const result = await db.from('message_attachments').select('*').eq('tenant_id', actor.tenantId).in('message_id', ids).order('created_at', { ascending: true });
            if (result.error)
                return problem(result.error);
            attachments.push(...(result.data ?? []).map(row => ({ id: row.id, tenantId: row.tenant_id, messageId: row.message_id, fileName: row.file_name || 'Anhang', filePath: row.file_path || '', fileUrl: null, mimeType: row.mime_type, fileSizeBytes: row.file_size_bytes, createdAt: row.created_at })));
        }
        return { ok: true, data: attachments };
    }
    catch (error) {
        return problem(error);
    }
}
/** Only the displayed incoming messages are marked read; database triggers own the counters. */
export async function markConversationRead(actor: MessagingActor, threadId: string, messages: OfficeMessage[]): Promise<ServiceResult<true>> {
    const blocked = scopeBlock<true>(actor);
    if (blocked)
        return blocked;
    const ids = messages.filter(message => message.threadId === threadId && !message.readAt && !message.isSystemMessage && !message.isInternalNote && (message.senderClientId || message.senderEmployeeId)).map(message => message.id);
    if (!ids.length)
        return { ok: true, data: true };
    const db = getSupabaseClient();
    if (!db)
        return { ok: false, error: 'Lesebestätigung konnte nicht gespeichert werden.' };
    try {
        const result = await db.from('messages').update({ read_at: new Date().toISOString(), status: 'read' }).eq('tenant_id', actor.tenantId).eq('thread_id', threadId).in('id', ids).is('read_at', null).in('status', ['sent', 'read']).select('id');
        if (result.error)
            return problem(result.error);
        // Concurrent readers can legitimately update the same messages first.
        const remaining = await db.from('messages').select('id').eq('tenant_id', actor.tenantId).eq('thread_id', threadId).in('id', ids).is('read_at', null).in('status', ['sent', 'read']);
        if (remaining.error)
            return problem(remaining.error);
        return remaining.data?.length ? { ok: false, error: 'Einige Nachrichten konnten noch nicht als gelesen markiert werden.' } : { ok: true, data: true };
    }
    catch (error) {
        return problem(error);
    }
}
export type ConversationPatch = {
    status?: OfficeMessageThread['status'];
    priority?: OfficeMessageThread['priority'];
    categoryId?: string | null;
    assignedToUserId?: string | null;
};
export async function updateConversation(actor: MessagingActor, threadId: string, patch: ConversationPatch): Promise<ServiceResult<true>> {
    const blocked = scopeBlock<true>(actor, true) ?? (patch.status === 'deleted' ? enforcePermission<true>(actor.roleKey, 'office.messages.delete') : patch.status === 'archived' ? enforcePermission<true>(actor.roleKey, 'office.messages.archive') : null);
    if (blocked)
        return blocked;
    const db = getSupabaseClient();
    if (!db)
        return { ok: false, error: 'Gespräch konnte nicht aktualisiert werden.' };
    try {
        const thread = await fetchOfficeMessageThreadById(actor.tenantId, threadId, actor.roleKey);
        if (!thread.ok)
            return thread;
        if (!thread.data || thread.data.status === 'deleted')
            return { ok: false, error: 'Gespräch nicht gefunden.' };
        const now = new Date().toISOString();
        const values: Row = { updated_at: now };
        if (patch.assignedToUserId && patch.assignedToUserId !== actor.profileId)
            return { ok: false, error: 'Sie können das Gespräch nur sich selbst zuweisen.' };
        if (patch.categoryId) {
            const category = await db.from('message_categories').select('id').eq('tenant_id', actor.tenantId).eq('id', patch.categoryId).eq('is_active', true).maybeSingle();
            if (category.error)
                return problem(category.error);
            if (!category.data)
                return { ok: false, error: 'Diese Kategorie ist nicht mehr verfügbar.' };
        }
        if (patch.priority !== undefined)
            values.priority = patch.priority;
        if (patch.categoryId !== undefined)
            values.category_id = patch.categoryId;
        if (patch.assignedToUserId !== undefined) {
            values.assigned_to_user_id = patch.assignedToUserId;
            values.assigned_at = patch.assignedToUserId ? now : null;
        }
        if (patch.status !== undefined) {
            values.status = patch.status;
            values.closed_at = isClosedAppStatus(patch.status) ? now : null;
            values.closed_by_user_id = isClosedAppStatus(patch.status) ? actor.profileId : null;
            values.archived_at = patch.status === 'archived' ? now : null;
        }
        const result = await fromUnknownTable(db, 'message_threads').update(values).eq('tenant_id', actor.tenantId).eq('id', threadId).select('id').maybeSingle();
        if (result.error)
            return problem(result.error);
        if (result.data)
            void logOfficeMessageAuditEvent({ tenantId: actor.tenantId, ...auditFromThread(thread.data), actorName: actor.displayName, action: patch.status === 'deleted' ? 'office_message_deleted' : patch.status === 'archived' ? 'office_message_archived' : patch.assignedToUserId !== undefined ? 'office_message_assigned' : 'office_message_status_changed', summary: 'Gesprächsdetails aktualisiert.', metadata: { ...patch } }).catch(() => { });
        return result.data ? { ok: true, data: true } : { ok: false, error: 'Die Änderung wurde nicht bestätigt. Bitte Berechtigung und Verbindung prüfen.' };
    }
    catch (error) {
        return problem(error);
    }
}
export async function removeConversationMessage(actor: MessagingActor, threadId: string, messageId: string, status: 'archived' | 'deleted'): Promise<ServiceResult<true>> {
    const blocked = scopeBlock<true>(actor) ?? enforcePermission<true>(actor.roleKey, status === 'archived' ? 'office.messages.archive' : 'office.messages.delete');
    if (blocked)
        return blocked;
    const db = getSupabaseClient();
    if (!db)
        return { ok: false, error: 'Nachricht ist gerade nicht erreichbar.' };
    try {
        const thread = await fetchOfficeMessageThreadById(actor.tenantId, threadId, actor.roleKey);
        if (!thread.ok)
            return thread;
        if (!thread.data || thread.data.status === 'deleted')
            return { ok: false, error: 'Gespräch nicht gefunden.' };
        const message = await db.from('messages').select('*').eq('tenant_id', actor.tenantId).eq('thread_id', threadId).eq('id', messageId).maybeSingle();
        if (message.error)
            return problem(message.error);
        if (!message.data || message.data.is_system_message)
            return { ok: false, error: 'Diese Nachricht kann nicht entfernt werden.' };
        const changed = await db.from('messages').update({ status, read_at: message.data.read_at || new Date().toISOString(), updated_at: new Date().toISOString() }).eq('tenant_id', actor.tenantId).eq('thread_id', threadId).eq('id', messageId).select('id').maybeSingle();
        if (changed.error)
            return problem(changed.error);
        if (!changed.data)
            return { ok: false, error: 'Die Änderung wurde nicht bestätigt.' };
        if (!message.data.is_internal_note && thread.data.lastMessageAt && thread.data.lastMessageAt === message.data.sent_at) {
            const latest = await db.from('messages').select('body, sent_at').eq('tenant_id', actor.tenantId).eq('thread_id', threadId).eq('is_internal_note', false).in('status', ['sent', 'read']).order('created_at', { ascending: false }).range(0, 0).maybeSingle();
            if (latest.error)
                return { ok: false, error: 'Nachricht entfernt. Die Vorschau konnte noch nicht aktualisiert werden. Bitte die Aktion erneut bestätigen.' };
            const updated = await db.from('message_threads').update({ last_message_at: latest.data?.sent_at ?? null, last_message_preview: latest.data?.body.slice(0, 120) ?? null }).eq('tenant_id', actor.tenantId).eq('id', threadId).eq('last_message_at', thread.data.lastMessageAt);
            if (updated.error)
                return { ok: false, error: 'Nachricht entfernt. Die Vorschau konnte noch nicht aktualisiert werden. Bitte die Aktion erneut bestätigen.' };
        }
        void logOfficeMessageAuditEvent({ tenantId: actor.tenantId, ...auditFromThread(thread.data), actorName: actor.displayName, action: status === 'archived' ? 'office_message_archived' : 'office_message_deleted', summary: status === 'archived' ? 'Nachricht archiviert.' : 'Nachricht aus dem Verlauf entfernt.', metadata: { messageId } }).catch(() => { });
        return { ok: true, data: true };
    }
    catch (error) {
        return problem(error);
    }
}
