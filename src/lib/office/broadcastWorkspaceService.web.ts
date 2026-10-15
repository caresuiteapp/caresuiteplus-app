import type { ServiceResult } from '@/types';
import type { CreateBroadcastInput, NotificationBroadcast } from '@/types/office/broadcast';
import { BROADCAST_CATEGORIES } from '@/types/office/broadcast';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { mapLegacyRoleKeyToRoleKey } from '@/lib/permissions/workspaceRoles';
import { BROADCAST_ALLOWED_ROLE_KEYS } from './broadcastpermissions';
import { OFFICE_NOTIFICATIONS_TABLE } from './notificationtable';
import type { MessagingActor } from './messageWorkspaceService.web';

type Row = Record<string, unknown>;
export type BroadcastTarget = { id: string; name: string; userId: string | null; employeeId?: string; clientId?: string; profileId?: string };
export type BroadcastSegment = 'employees' | 'clients' | 'internal';
export type WorkspaceBroadcast = NotificationBroadcast & { receiptAvailable: boolean; plannedCount: number | null };
export type BroadcastReceipt = { id: string; name: string; readAt: string | null; acknowledgedAt: string | null; replyThreadId: string | null };
export type BroadcastOperation = { id: string; sentAt: string; input: CreateBroadcastInput; audience: BroadcastSegment; targets: (BroadcastTarget & { notificationId: string })[] };
export type WorkspaceBroadcastDetail = { broadcast: WorkspaceBroadcast; recipients: BroadcastReceipt[]; pendingOperation: BroadcastOperation | null };
const fail = (error: unknown): { ok: false; error: string } => ({ ok: false, error: error instanceof Error ? error.message : toGermanSupabaseError(error as never) });
function guard<T>(actor: MessagingActor): ServiceResult<T> | null {
  return guardServiceTenant(actor.tenantId) ?? (!actor.profileId ? { ok: false, error: 'Bitte erneut anmelden.' } : null) ?? (actor.roleKey && BROADCAST_ALLOWED_ROLE_KEYS.has(actor.roleKey) ? null : enforcePermission<T>(actor.roleKey, 'messages.broadcast.create'));
}
async function readAll(query: (offset: number) => PromiseLike<{ data: unknown; error: unknown }>) {
  const rows: Row[] = [];
  for (let offset = 0; ; offset += 500) { const result = await query(offset); if (result.error) throw new Error(toGermanSupabaseError(result.error as never)); const page = (result.data ?? []) as Row[]; rows.push(...page); if (page.length < 500) return rows; }
}
export async function loadBroadcastTargets(actor: MessagingActor, audience: BroadcastSegment): Promise<ServiceResult<BroadcastTarget[]>> {
  const blocked = guard<BroadcastTarget[]>(actor); if (blocked) return blocked;
  const db = getSupabaseClient(); if (!db) return { ok: false, error: 'Empfänger sind gerade nicht erreichbar.' };
  try {
    if (audience === 'employees') {
      const [employees, accounts, profiles] = await Promise.all([
        readAll(offset => db.from('employees').select('id, first_name, last_name, profile_id').eq('tenant_id', actor.tenantId).eq('status', 'active').order('id').range(offset, offset + 499)),
        readAll(offset => db.from('employee_portal_accounts').select('employee_id, auth_user_id').eq('tenant_id', actor.tenantId).eq('status', 'active').is('blocked_at', null).order('employee_id').range(offset, offset + 499)),
        readAll(offset => fromUnknownTable(db, 'profiles').select('id, auth_user_id').eq('tenant_id', actor.tenantId).eq('is_active', true).order('id').range(offset, offset + 499)),
      ]);
      const users = new Map(profiles.filter(row => row.auth_user_id).map(row => [String(row.id), String(row.auth_user_id)]));
      const portal = new Map(accounts.filter(row => row.auth_user_id).map(row => [String(row.employee_id), String(row.auth_user_id)]));
      return { ok: true, data: employees.map(row => ({ id: String(row.id), name: `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim() || 'Mitarbeitende', employeeId: String(row.id), userId: portal.get(String(row.id)) || users.get(String(row.profile_id)) || null })) };
    }
    if (audience === 'clients') {
      const [accounts, clients] = await Promise.all([
        readAll(offset => fromUnknownTable(db, 'client_portal_access').select('client_id, auth_user_id').eq('tenant_id', actor.tenantId).eq('portal_enabled', true).eq('status', 'active').order('client_id').range(offset, offset + 499)),
        readAll(offset => db.from('clients').select('id, first_name, last_name').eq('tenant_id', actor.tenantId).order('id').range(offset, offset + 499)),
      ]);
      const names = new Map(clients.map(row => [String(row.id), `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim()]));
      const targets = accounts.filter(row => row.auth_user_id && row.client_id && names.has(String(row.client_id))).map(row => ({ id: `${row.client_id}:${row.auth_user_id}`, name: names.get(String(row.client_id)) || 'Klient:in', userId: String(row.auth_user_id), clientId: String(row.client_id) }));
      return { ok: true, data: [...new Map(targets.map(target => [target.id, target])).values()] };
    }
    const profiles = await readAll(offset => fromUnknownTable(db, 'profiles').select('id, auth_user_id, display_name, roles(key)').eq('tenant_id', actor.tenantId).eq('is_active', true).eq('status', 'active').order('id').range(offset, offset + 499));
    return { ok: true, data: profiles.filter(row => { const role = mapLegacyRoleKeyToRoleKey((row.roles as { key?: string } | null)?.key ?? null); return row.auth_user_id && role && BROADCAST_ALLOWED_ROLE_KEYS.has(role); }).map(row => ({ id: String(row.id), name: String(row.display_name || 'Verwaltung'), profileId: String(row.id), userId: String(row.auth_user_id) })) };
  } catch (error) { return fail(error); }
}
function mapBroadcast(row: Row): WorkspaceBroadcast {
  const meta = (row.metadata ?? {}) as Row; const audience = String(meta.audienceSegment || row.audience || 'employees') as NotificationBroadcast['audience'];
  return { id: String(row.id), tenantId: String(row.tenant_id), createdByUserId: String(row.created_by_user_id), title: String(row.title), body: String(row.body), category: row.category as NotificationBroadcast['category'], categoryLabel: BROADCAST_CATEGORIES.find(item => item.key === row.category)?.label || 'Mitteilung', priority: row.priority as NotificationBroadcast['priority'], audience, allowReplies: !!row.allow_replies, requireAcknowledgement: !!row.require_acknowledgement, showInEmployeePortal: !!row.show_in_employee_portal, status: row.status as NotificationBroadcast['status'], sentAt: row.sent_at ? String(row.sent_at) : null, archivedAt: row.archived_at ? String(row.archived_at) : null, expiresAt: row.expires_at ? String(row.expires_at) : null, createdAt: String(row.created_at), senderDisplayName: null, recipientCount: 0, readCount: 0, acknowledgedCount: 0, receiptAvailable: audience !== 'clients' && audience !== 'internal', plannedCount: typeof meta.recipientCount === 'number' ? meta.recipientCount : null };
}
export async function loadBroadcastList(actor: MessagingActor, offset = 0): Promise<ServiceResult<{ items: WorkspaceBroadcast[]; hasMore: boolean }>> {
  const blocked = guard<{ items: WorkspaceBroadcast[]; hasMore: boolean }>(actor); if (blocked) return blocked;
  const db = getSupabaseClient(); if (!db) return { ok: false, error: 'Rundnachrichten sind gerade nicht erreichbar.' };
  try {
    const result = await fromUnknownTable(db, 'notification_broadcasts').select('*').eq('tenant_id', actor.tenantId).order('created_at', { ascending: false }).order('id', { ascending: false }).range(offset, offset + 80);
    if (result.error) return fail(result.error);
    return { ok: true, data: { items: (result.data ?? []).slice(0, 80).map(row => mapBroadcast(row as Row)), hasMore: (result.data?.length ?? 0) > 80 } };
  } catch (error) { return fail(error); }
}
export async function loadBroadcastDetail(actor: MessagingActor, id: string): Promise<ServiceResult<WorkspaceBroadcastDetail>> {
  const blocked = guard<WorkspaceBroadcastDetail>(actor); if (blocked) return blocked;
  const db = getSupabaseClient(); if (!db) return { ok: false, error: 'Rundnachricht ist gerade nicht erreichbar.' };
  try {
    const result = await fromUnknownTable(db, 'notification_broadcasts').select('*').eq('tenant_id', actor.tenantId).eq('id', id).maybeSingle();
    if (result.error) return fail(result.error); if (!result.data) return { ok: false, error: 'Rundnachricht nicht gefunden.' };
    const broadcast = mapBroadcast(result.data as Row); const recipients: BroadcastReceipt[] = [];
    if (broadcast.receiptAvailable) {
      const rows = await readAll(offset => fromUnknownTable(db, 'notification_broadcast_recipients').select('id, employee_id, read_at, acknowledged_at, reply_thread_id').eq('tenant_id', actor.tenantId).eq('broadcast_id', id).order('id').range(offset, offset + 499));
      const names = new Map<string, string>();
      for (let offset = 0; offset < rows.length; offset += 100) {
        const people = await db.from('employees').select('id, first_name, last_name').eq('tenant_id', actor.tenantId).in('id', rows.slice(offset, offset + 100).map(row => String(row.employee_id)));
        if (people.error) return fail(people.error);
        for (const person of people.data ?? []) names.set(person.id, `${person.first_name ?? ''} ${person.last_name ?? ''}`.trim());
      }
      recipients.push(...rows.map(row => ({ id: String(row.id), name: names.get(String(row.employee_id)) || 'Mitarbeitende', readAt: row.read_at ? String(row.read_at) : null, acknowledgedAt: row.acknowledged_at ? String(row.acknowledged_at) : null, replyThreadId: row.reply_thread_id ? String(row.reply_thread_id) : null })));
      broadcast.recipientCount = recipients.length; broadcast.readCount = recipients.filter(row => row.readAt).length; broadcast.acknowledgedCount = recipients.filter(row => row.acknowledgedAt).length;
    }
    const metadata = ((result.data as Row).metadata ?? {}) as Row;
    const delivery = metadata.delivery as { version?: number; startedAt?: string; targets?: BroadcastOperation['targets'] } | undefined;
    const validTargets = Array.isArray(delivery?.targets) && delivery.targets.length > 0 && delivery.targets.every(target => typeof target.id === 'string' && typeof target.notificationId === 'string' && (target.userId === null || typeof target.userId === 'string')) && new Set(delivery.targets.map(target => target.notificationId)).size === delivery.targets.length;
    const pendingOperation: BroadcastOperation | null = broadcast.status === 'draft' && delivery?.version === 1 && delivery.startedAt && Number.isFinite(Date.parse(delivery.startedAt)) && validTargets && ['employees', 'clients', 'internal'].includes(broadcast.audience) ? {
      id: broadcast.id, sentAt: delivery.startedAt, audience: broadcast.audience as BroadcastSegment, targets: delivery.targets!,
      input: { title: broadcast.title, body: broadcast.body, category: broadcast.category, priority: broadcast.priority, allowReplies: broadcast.allowReplies, requireAcknowledgement: broadcast.requireAcknowledgement, showInEmployeePortal: true, expiresAt: broadcast.expiresAt, recipientFilter: metadata.recipientFilter as CreateBroadcastInput['recipientFilter'] },
    } : null;
    return { ok: true, data: { broadcast, recipients, pendingOperation } };
  } catch (error) { return fail(error); }
}

export async function sendWorkspaceBroadcast(actor: MessagingActor, actorUserId: string, operation: BroadcastOperation): Promise<ServiceResult<{ id: string }>> {
  const blocked = guard<{ id: string }>(actor); if (blocked) return blocked;
  const { input, targets, audience } = operation;
  if (!actorUserId || !input.title.trim() || !input.body.trim() || !targets.length) return { ok: false, error: 'Bitte Betreff, Nachricht und Empfänger prüfen.' };
  if (input.title.length > 180 || input.body.length > 12000) return { ok: false, error: 'Bitte Betreff oder Nachricht kürzen.' };
  if (input.expiresAt && (!Number.isFinite(Date.parse(input.expiresAt)) || Date.parse(input.expiresAt) <= Date.now())) return { ok: false, error: 'Die Gültigkeit dieser Rundnachricht ist abgelaufen. Sie kann nicht weiter versendet werden.' };
  const db = getSupabaseClient(); if (!db) return { ok: false, error: 'Versand ist gerade nicht erreichbar.' };
  try {
    const existing = await fromUnknownTable(db, 'notification_broadcasts').select('*').eq('tenant_id', actor.tenantId).eq('id', operation.id).maybeSingle();
    if (existing.error) return fail(existing.error);
    if (existing.data && (existing.data.title !== input.title.trim() || existing.data.body !== input.body.trim() || existing.data.created_by_user_id !== actorUserId)) return { ok: false, error: 'Der gespeicherte Versand gehört nicht zu diesem Entwurf.' };
    if (existing.data?.status === 'sent') return { ok: true, data: { id: operation.id } };
    if (existing.data?.status === 'archived') return { ok: false, error: 'Dieser Versand wurde archiviert.' };
    if (existing.data) {
      const delivery = ((existing.data.metadata ?? {}) as Row).delivery as { targets?: BroadcastOperation['targets'] } | undefined;
      const signature = (items: BroadcastOperation['targets']) => items.map(target => [target.id, target.userId, target.employeeId ?? null, target.clientId ?? null, target.profileId ?? null, target.notificationId].join(':')).sort().join('|');
      if (!Array.isArray(delivery?.targets) || signature(delivery.targets) !== signature(targets) || existing.data.category !== input.category || existing.data.priority !== input.priority || existing.data.allow_replies !== input.allowReplies || existing.data.require_acknowledgement !== input.requireAcknowledgement) return { ok: false, error: 'Der Versand wurde mit einer anderen Auswahl begonnen. Bitte über die gespeicherte Rundnachricht fortsetzen.' };
    }
    const current = await loadBroadcastTargets(actor, audience); if (!current.ok) return current;
    if (!targets.every(target => current.data.some(person => person.id === target.id && person.userId === target.userId))) return { ok: false, error: 'Ein Empfängerzugang hat sich geändert. Der Versand wurde angehalten. Bitte die Rundnachricht in der Übersicht prüfen.' };
    if (!existing.data) {
      const created = await fromUnknownTable(db, 'notification_broadcasts').insert({ id: operation.id, tenant_id: actor.tenantId, created_by_user_id: actorUserId, title: input.title.trim(), body: input.body.trim(), category: input.category, priority: input.priority, audience, allow_replies: input.allowReplies, require_acknowledgement: input.requireAcknowledgement, show_in_employee_portal: audience === 'employees', show_in_client_portal: audience === 'clients', status: 'draft', expires_at: input.expiresAt ?? null, metadata: { recipientFilter: input.recipientFilter, audienceSegment: audience, recipientCount: targets.length, delivery: { version: 1, startedAt: operation.sentAt, targets: targets.map(({ name: _name, ...target }) => target) } } });
      if (created.error) return fail(created.error);
    }
    // Stable per-recipient IDs make each resumed batch safe after a lost response.
    for (let offset = 0; offset < targets.length; offset += 100) {
      const batch = targets.slice(offset, offset + 100);
      const employees = batch.filter(target => target.employeeId);
      if (employees.length) {
        const result = await fromUnknownTable(db, 'notification_broadcast_recipients').upsert(employees.map(target => ({ tenant_id: actor.tenantId, broadcast_id: operation.id, employee_id: target.employeeId, user_id: target.userId, delivered_at: operation.sentAt, is_read: false, is_acknowledged: false })), { onConflict: 'broadcast_id,employee_id', ignoreDuplicates: true });
        if (result.error) return { ok: false, error: 'Die Rundnachricht wurde angelegt. Die Empfängerliste ist noch unvollständig. Bitte denselben Versand fortsetzen.' };
      }
      const notifications = batch.map(target => ({ id: target.notificationId, tenant_id: actor.tenantId, recipient_user_id: target.userId, recipient_employee_id: target.employeeId ?? null, notification_type: 'broadcast', title: input.title.trim(), body_preview: input.body.trim().slice(0, 180), priority: input.priority, related_broadcast_id: operation.id, is_read: false, delivered_at: operation.sentAt, metadata: { category: input.category, requireAcknowledgement: input.requireAcknowledgement, allowReplies: input.allowReplies, audienceSegment: audience, clientId: target.clientId ?? null, profileId: target.profileId ?? null } }));
      // RLS grants Office INSERT, but SELECT only for the recipient. Do not request
      // RETURNING or use an UPSERT requiring SELECT access to somebody else's row.
      const alreadyStored = (error: { code?: string; message?: string } | null) => error?.code === '23505' && !!error.message?.includes('office_notifications_pkey');
      const result = await fromUnknownTable(db, OFFICE_NOTIFICATIONS_TABLE).insert(notifications);
      if (result.error) {
        if (!alreadyStored(result.error)) return { ok: false, error: 'Ein Teil des Versands ist noch nicht bestätigt. Bereits angelegte Benachrichtigungen bleiben erhalten. Bitte denselben Versand fortsetzen.' };
        // A duplicate aborts the whole SQL batch. Reconcile each original UUID;
        // acknowledged/read rows are never updated or overwritten on a retry.
        for (const notification of notifications) {
          const item = await fromUnknownTable(db, OFFICE_NOTIFICATIONS_TABLE).insert(notification);
          if (item.error && !alreadyStored(item.error)) return { ok: false, error: 'Ein Teil des Versands ist noch nicht bestätigt. Bitte denselben Vorgang fortsetzen.' };
        }
      }
    }
    const completed = await fromUnknownTable(db, 'notification_broadcasts').update({ status: 'sent', sent_at: operation.sentAt }).eq('tenant_id', actor.tenantId).eq('id', operation.id).select('id').maybeSingle();
    if (completed.error || !completed.data) return { ok: false, error: 'Die Benachrichtigungen wurden angelegt. Die Abschlussbestätigung fehlt noch. Bitte den Versand fortsetzen.' };
    return { ok: true, data: { id: operation.id } };
  } catch { return { ok: false, error: 'Der Versand ist noch nicht vollständig bestätigt. Bitte denselben Vorgang fortsetzen.' }; }
}
export async function archiveWorkspaceBroadcast(actor: MessagingActor, id: string): Promise<ServiceResult<true>> {
  const blocked = guard<true>(actor); if (blocked) return blocked;
  const db = getSupabaseClient(); if (!db) return { ok: false, error: 'Rundnachricht ist gerade nicht erreichbar.' };
  try { const result = await fromUnknownTable(db, 'notification_broadcasts').update({ status: 'archived', archived_at: new Date().toISOString() }).eq('tenant_id', actor.tenantId).eq('id', id).select('id').maybeSingle(); return result.error ? fail(result.error) : result.data ? { ok: true, data: true } : { ok: false, error: 'Archivierung nicht bestätigt.' }; } catch (error) { return fail(error); }
}
