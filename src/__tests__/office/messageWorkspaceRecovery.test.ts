import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createConversation, loadConversationMessages, loadConversations, markConversationRead, removeConversationMessage, sendWorkspaceMessage, updateConversation, verifyMessageAttachment } from '@/lib/office/messageWorkspaceService.web';
import { loadBroadcastDetail, sendWorkspaceBroadcast, type BroadcastOperation } from '@/lib/office/broadcastWorkspaceService.web';
import type { OfficeMessage } from '@/types/office/messaging';

type Row = Record<string, any>;
const h = vi.hoisted(() => ({ db: null as any, tables: {} as Record<string, Row[]>, writes: [] as { table: string; action: string; payload: Row | Row[] }[], failedTable: '', lostTable: '', upload: vi.fn(), preferences: { attachmentsEnabled: true, voiceMessagesEnabled: true, internalNotesEnabled: true, emojisEnabled: true, showReadReceipts: true } }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => h.db }));
vi.mock('@/lib/permissions', () => ({ enforcePermission: (role: string) => role === 'business_admin' ? null : { ok: false, error: 'Keine Berechtigung.' } }));
vi.mock('@/lib/services/liveServiceGuard', () => ({ guardServiceTenant: (tenant: string) => tenant ? null : { ok: false, error: 'Organisation fehlt.' } }));
vi.mock('@/lib/office/messageWorkspaceSettings.web', () => ({ loadMessagePreferences: () => Promise.resolve({ ok: true, data: h.preferences }) }));
vi.mock('@/lib/office/messagethreadservice', () => ({
  fetchOfficeMessageCategories: async () => ({ ok: true, data: [] }),
  fetchOfficeMessageThreadById: async (tenant: string, id: string) => { const row = h.tables.message_threads.find(item => item.id === id && item.tenant_id === tenant); return { ok: true, data: row ? { id, tenantId: tenant, threadType: row.thread_type === 'internal' ? 'internal' : 'employee_office', status: row.status, subject: row.subject, lastMessageAt: row.last_message_at } : null }; },
}));
vi.mock('@/lib/office/messageservice', () => ({ mapMessageRow: (row: Row) => ({ id: row.id, tenantId: row.tenant_id, threadId: row.thread_id, body: row.body, senderProfileId: row.sender_profile_id, senderEmployeeId: row.sender_employee_id, senderClientId: row.sender_client_id, senderDisplayName: 'Verwaltung', isInternalNote: !!row.is_internal_note, isSystemMessage: !!row.is_system_message, sentAt: row.sent_at, readAt: row.read_at, createdAt: row.created_at, updatedAt: row.updated_at, status: row.status }) }));
vi.mock('@/lib/office/messageattachmentservice', () => ({ buildMessageAttachmentPath: (tenant: string, thread: string, id: string, name: string) => `tenant/${tenant}/threads/${thread}/${id}/${name}` }));

class Query {
  filters: ((row: Row) => boolean)[] = []; action = 'select'; payload: Row | Row[] = {}; returning = false; one = false; start = 0; end = Infinity; sort: [string, boolean][] = []; conflict = 'id'; ignore = false;
  constructor(public table: string) {}
  select(_columns = '*') { this.returning = true; return this; }
  eq(key: string, value: unknown) { this.filters.push(row => row[key] === value); return this; }
  neq(key: string, value: unknown) { this.filters.push(row => row[key] !== value); return this; }
  is(key: string, value: unknown) { this.filters.push(row => (row[key] ?? null) === value); return this; }
  in(key: string, values: unknown[]) { this.filters.push(row => values.includes(row[key])); return this; }
  or(value: string) { const stamp = value.split('last_message_at.lte.')[1]; this.filters.push(row => row.last_message_at == null || row.last_message_at <= stamp); return this; }
  order(key: string, options: { ascending?: boolean } = {}) { this.sort.push([key, options.ascending !== false]); return this; }
  range(start: number, end: number) { this.start = start; this.end = end; return this; }
  insert(payload: Row | Row[]) { this.action = 'insert'; this.payload = payload; this.returning = false; return this; }
  upsert(payload: Row | Row[], options: { onConflict?: string; ignoreDuplicates?: boolean } = {}) { this.action = 'upsert'; this.payload = payload; this.conflict = options.onConflict ?? 'id'; this.ignore = !!options.ignoreDuplicates; this.returning = false; return this; }
  update(payload: Row) { this.action = 'update'; this.payload = payload; this.returning = false; return this; }
  maybeSingle() { this.one = true; return this; }
  single() { this.one = true; return this; }
  then(resolve: (result: unknown) => unknown, reject?: (error: unknown) => unknown) { return Promise.resolve().then(() => this.execute()).then(resolve, reject); }
  execute() {
    const rows = h.tables[this.table] ?? (h.tables[this.table] = []);
    let selected = rows.filter(row => this.filters.every(filter => filter(row)));
    if (this.action !== 'select') {
      h.writes.push({ table: this.table, action: this.action, payload: structuredClone(this.payload) });
      // Production's recipient-only SELECT policy forbids reading another
      // person's notification, including INSERT RETURNING / conflict UPSERTs.
      if (this.table === 'office_notifications' && (this.action === 'upsert' || this.returning)) return { data: null, error: { code: '42501', message: 'recipient-only SELECT policy' } };
      if (h.failedTable === this.table) { h.failedTable = ''; return { data: null, error: { message: 'connection lost' } }; }
      if (this.action === 'update') selected.forEach(row => Object.assign(row, this.payload));
      else {
        selected = [];
        for (const payload of Array.isArray(this.payload) ? this.payload : [this.payload]) {
          const duplicate = rows.find(row => this.conflict.split(',').every(key => row[key] === payload[key]));
          if (duplicate) { if (!this.ignore) return { data: null, error: { code: '23505', message: `duplicate key value violates unique constraint "${this.table}_pkey"` } }; continue; }
          const row = { id: `auto-${rows.length}`, created_at: '2026-10-15T10:00:00.000Z', read_at: null, ...payload }; rows.push(row); selected.push(row);
        }
      }
      if (h.lostTable === this.table) { h.lostTable = ''; return { data: null, error: { message: 'response lost after commit' } }; }
      if (!this.returning) return { data: null, error: null };
    }
    selected = [...selected].sort((a, b) => { for (const [key, ascending] of this.sort) { const delta = String(a[key] ?? '').localeCompare(String(b[key] ?? '')); if (delta) return ascending ? delta : -delta; } return 0; }).slice(this.start, this.end + 1);
    return { data: this.one ? selected[0] ?? null : selected, error: null };
  }
}
const actor = { tenantId: 'tenant-a', profileId: 'profile-a', roleKey: 'business_admin' as const };
const thread = { id: 'thread-a', tenant_id: actor.tenantId, thread_type: 'employee', employee_id: 'employee-a', status: 'received', subject: 'Übergabe', priority: 'normal', created_at: '2026-10-14T10:00:00.000Z', last_message_at: '2026-10-14T10:00:00.000Z' };
const message = (id: string, extra: Row = {}): Row => ({ id, tenant_id: actor.tenantId, thread_id: thread.id, body: id, sender_employee_id: 'employee-a', read_at: null, is_internal_note: false, is_system_message: false, status: 'sent', sent_at: '2026-10-15T10:00:00.000Z', created_at: '2026-10-15T10:00:00.000Z', ...extra });
beforeEach(() => {
  h.tables = { message_threads: [{ ...thread }], messages: [], message_attachments: [], employees: [{ id: 'employee-a', tenant_id: actor.tenantId, first_name: 'Mara', last_name: 'Sommer', status: 'active', profile_id: null }, { id: 'employee-b', tenant_id: actor.tenantId, first_name: 'Ben', last_name: 'Winter', status: 'active', profile_id: null }], profiles: [{ id: actor.profileId, tenant_id: actor.tenantId, display_name: 'Office' }], message_categories: [], employee_portal_accounts: [] };
  h.writes = []; h.failedTable = ''; h.lostTable = ''; h.preferences.attachmentsEnabled = true; h.preferences.voiceMessagesEnabled = true; h.preferences.internalNotesEnabled = true;
  h.upload.mockReset().mockResolvedValue({ data: { path: 'file' }, error: null }); h.db = { from: (table: string) => new Query(table), storage: { from: () => ({ upload: h.upload }) } };
});
describe('web messaging scoped persistence and recovery', () => {
  it('reconciles a committed insert with a lost response and never creates a second message', async () => {
    h.lostTable = 'messages'; const operation = { id: 'message-a', body: 'Hallo', internal: false, attachments: [] };
    expect((await sendWorkspaceMessage(actor, thread.id, operation)).ok).toBe(true);
    expect((await sendWorkspaceMessage(actor, thread.id, operation)).ok).toBe(true);
    expect(h.tables.messages).toHaveLength(1); expect(h.writes.filter(write => write.table === 'messages')).toHaveLength(1);
  });
  it('resumes attachment delivery without deleting or duplicating the saved message', async () => {
    h.upload.mockResolvedValueOnce({ error: { message: 'offline' } });
    const operation = { id: 'message-a', body: 'Anhang', internal: false, attachments: [{ id: 'file-a', fileName: 'plan.pdf', mimeType: 'application/pdf', fileSizeBytes: 3, fileData: new Uint8Array([1, 2, 3]) }] };
    expect((await sendWorkspaceMessage(actor, thread.id, operation)).ok).toBe(false); expect(h.tables.messages).toHaveLength(1);
    expect((await sendWorkspaceMessage(actor, thread.id, operation)).ok).toBe(true); expect(h.tables.message_attachments).toHaveLength(1); expect(h.tables.messages).toHaveLength(1);
    expect((await sendWorkspaceMessage(actor, thread.id, operation)).ok).toBe(true); expect(h.upload).toHaveBeenCalledTimes(2);
  });
  it('does not put internal notes into the portal preview and respects disabled notes', async () => {
    expect((await sendWorkspaceMessage(actor, thread.id, { id: 'note', body: 'Intern', internal: true, attachments: [] })).ok).toBe(true);
    expect(h.writes.filter(write => write.table === 'message_threads')).toHaveLength(0);
    h.preferences.internalNotesEnabled = false;
    expect((await sendWorkspaceMessage(actor, thread.id, { id: 'note-2', body: 'Intern', internal: true, attachments: [] })).ok).toBe(false);
    expect(h.tables.messages).toHaveLength(1);
  });
  it('does not replace a newer incoming preview while confirming an older send', async () => {
    h.tables.messages.push(message('sent', { sender_profile_id: actor.profileId, sender_employee_id: null, body: 'Antwort' }));
    h.tables.message_threads[0].last_message_at = '2026-10-15T11:00:00.000Z'; h.tables.message_threads[0].last_message_preview = 'Neuere Rückmeldung';
    expect((await sendWorkspaceMessage(actor, thread.id, { id: 'sent', body: 'Antwort', internal: false, attachments: [] })).ok).toBe(true);
    expect(h.tables.message_threads[0].last_message_preview).toBe('Neuere Rückmeldung');
  });
  it('reuses a partially created group and rejects recipients from another organisation', async () => {
    const operation = { id: 'group-a', input: { threadType: 'employee_group_office' as const, subject: 'Team', employeeParticipantIds: ['employee-a', 'employee-b'] } };
    h.failedTable = 'message_thread_employee_participants';
    expect((await createConversation(actor, operation)).ok).toBe(false);
    expect((await createConversation(actor, operation)).ok).toBe(true);
    expect(h.tables.message_threads.filter(row => row.id === operation.id)).toHaveLength(1); expect(h.tables.message_thread_employee_participants).toHaveLength(2);
    h.tables.employees.push({ id: 'foreign', tenant_id: 'tenant-b' });
    expect((await createConversation(actor, { id: 'foreign-group', input: { ...operation.input, employeeParticipantIds: ['employee-a', 'foreign'] } })).ok).toBe(false);
    expect(h.tables.message_threads.some(row => row.id === 'foreign-group')).toBe(false);
  });
  it('marks only displayed incoming messages read without resetting thread counters', async () => {
    h.tables.messages.push(message('displayed'), message('new-arrival'), message('foreign', { tenant_id: 'tenant-b' }));
    const displayed = { id: 'displayed', threadId: thread.id, senderEmployeeId: 'employee-a', readAt: null } as OfficeMessage;
    expect((await markConversationRead(actor, thread.id, [displayed])).ok).toBe(true);
    expect(h.tables.messages[0].read_at).toBeTruthy(); expect(h.tables.messages[1].read_at).toBeNull(); expect(h.tables.messages[2].read_at).toBeNull();
    expect(h.writes.some(write => write.table === 'message_threads')).toBe(false);
  });
  it('loads the newest page, exposes older history and scopes both queries to the organisation', async () => {
    h.tables.messages = Array.from({ length: 85 }, (_, index) => message(`m-${String(index).padStart(3, '0')}`, { created_at: new Date(Date.UTC(2026, 9, 15, 0, index)).toISOString() }));
    h.tables.messages.push(message('foreign', { tenant_id: 'tenant-b' }));
    const first = await loadConversationMessages(actor, thread.id); const second = await loadConversationMessages(actor, thread.id, 80);
    expect(first.ok && first.data.items.length).toBe(80); expect(first.ok && first.data.hasMore).toBe(true); expect(first.ok && first.data.items[0].id).toBe('m-005');
    expect(second.ok && second.data.items.length).toBe(5); expect(second.ok && second.data.hasMore).toBe(false);
    h.tables.message_threads.push({ ...thread, id: 'foreign-thread', tenant_id: 'tenant-b' });
    const list = await loadConversations(actor, 'employees'); expect(list.ok && list.data.items.map(item => item.id)).toEqual([thread.id]); expect(list.ok && list.data.items[0].employeeName).toBe('Mara Sommer');
  });
  it('blocks foreign attachments and writes without permission; reopening clears closure metadata', async () => {
    expect((await verifyMessageAttachment(actor, thread.id, { tenantId: 'tenant-b', filePath: 'tenant/tenant-b/file' } as never)).ok).toBe(false);
    expect((await sendWorkspaceMessage({ ...actor, roleKey: null }, thread.id, { id: 'blocked', body: 'Hallo', internal: false, attachments: [] })).ok).toBe(false); expect(h.writes).toHaveLength(0);
    h.tables.message_threads[0].closed_at = 'yesterday'; h.tables.message_threads[0].closed_by_user_id = actor.profileId;
    expect((await updateConversation(actor, thread.id, { status: 'in_progress' })).ok).toBe(true); expect(h.tables.message_threads[0].closed_at).toBeNull(); expect(h.tables.message_threads[0].closed_by_user_id).toBeNull();
  });
  it('removes a message without leaking a newer internal note through the public preview', async () => {
    h.tables.message_threads[0].last_message_at = '2026-10-15T10:00:00.000Z';
    h.tables.messages.push(message('previous', { body: 'Öffentliche Nachricht', sent_at: '2026-10-15T09:00:00.000Z', created_at: '2026-10-15T09:00:00.000Z' }), message('remove'), message('private', { body: 'Vertrauliche Notiz', is_internal_note: true, created_at: '2026-10-15T11:00:00.000Z' }));
    expect((await removeConversationMessage(actor, thread.id, 'remove', 'archived')).ok).toBe(true);
    expect(h.tables.messages.find(row => row.id === 'remove')?.status).toBe('archived');
    expect(h.tables.message_threads[0].last_message_preview).toBe('Öffentliche Nachricht');
    expect((await removeConversationMessage(actor, 'foreign-thread', 'private', 'deleted')).ok).toBe(false);
  });
});
describe('broadcast retries', () => {
  const operation = (): BroadcastOperation => ({ id: 'broadcast-a', sentAt: '2026-10-15T10:00:00.000Z', audience: 'employees', input: { title: 'Teaminfo', body: 'Neue Termine', category: 'general', priority: 'normal', allowReplies: true, requireAcknowledgement: true, showInEmployeePortal: true }, targets: [{ id: 'employee-a', name: 'Mara Sommer', employeeId: 'employee-a', userId: null, notificationId: 'notification-a' }, { id: 'employee-b', name: 'Ben Winter', employeeId: 'employee-b', userId: null, notificationId: 'notification-b' }] });
  it('resumes lost notification responses with stable IDs and preserves existing read flags', async () => {
    const op = operation(); h.lostTable = 'office_notifications';
    expect((await sendWorkspaceBroadcast(actor, actor.profileId, op)).ok).toBe(false);
    h.tables.notification_broadcast_recipients[0].is_read = true;
    expect((await sendWorkspaceBroadcast(actor, actor.profileId, op)).ok).toBe(true);
    expect(h.tables.office_notifications).toHaveLength(2); expect(h.tables.notification_broadcasts).toHaveLength(1); expect(h.tables.notification_broadcast_recipients).toHaveLength(2); expect(h.tables.notification_broadcast_recipients[0].is_read).toBe(true);
  });
  it('rejects altered recipients and reports unavailable client receipts without invented zero statistics', async () => {
    const op = operation(); op.targets[0].userId = 'another-user';
    expect((await sendWorkspaceBroadcast(actor, actor.profileId, op)).ok).toBe(false); expect(h.writes).toHaveLength(0);
    h.tables.notification_broadcasts = [{ id: 'client-broadcast', tenant_id: actor.tenantId, audience: 'clients', title: 'Info', body: 'Text', metadata: { recipientCount: 12 } }];
    const detail = await loadBroadcastDetail(actor, 'client-broadcast'); expect(detail.ok && detail.data.broadcast.receiptAvailable).toBe(false); expect(detail.ok && detail.data.broadcast.plannedCount).toBe(12);
  });
  it('recovers the original delivery IDs after a reload and rejects changes to a partially sent recipient set', async () => {
    const op = operation(); h.lostTable = 'office_notifications'; await sendWorkspaceBroadcast(actor, actor.profileId, op);
    const detail = await loadBroadcastDetail(actor, op.id); expect(detail.ok && detail.data.pendingOperation?.targets.map(target => target.notificationId)).toEqual(['notification-a', 'notification-b']);
    expect((await sendWorkspaceBroadcast(actor, actor.profileId, { ...op, targets: op.targets.slice(0, 1) })).ok).toBe(false);
    expect(detail.ok && detail.data.pendingOperation && (await sendWorkspaceBroadcast(actor, actor.profileId, detail.data.pendingOperation)).ok).toBe(true);
    expect(h.tables.office_notifications).toHaveLength(2);
  });
});
