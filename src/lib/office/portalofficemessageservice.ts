import type { RoleKey, ServiceResult } from '@/types';
import type { PortalSessionRecord } from '@/lib/auth/portalSessionStore';
import type {
  CreateOfficeThreadInput,
  OfficeMessage,
  OfficeMessageCategory,
  OfficeMessageThread,
  OfficeMessageThreadDetail,
  OfficeThreadType,
} from '@/types/office/messaging';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isMissingTableServiceError, toGermanSupabaseError } from '@/lib/supabase/errors';
import {
  filterPortalVisibleMessages,
  isThreadClosed,
  toDbThreadType,
  validateCreateThread,
  validateSendMessage,
} from '@/lib/office/messagebusinessrules';
import {
  auditFromThread,
  logOfficeMessageAuditEvent,
} from '@/lib/office/officemessageauditservice';
import {
  buildNewMessageNotification,
  notifyOfficeMessageEvent,
} from '@/lib/office/officemessagenotifications';
import {
  fetchMessagesLive,
  mapMessageRow,
} from '@/lib/office/messageservice';
import type { PendingMessageAttachment } from '@/lib/office/messageattachmentvalidation';
import { uploadPortalMessageAttachment } from '@/lib/office/messageattachmentservice';
import { OFFICE_MESSAGING_SCHEMA_ERROR, sortThreads } from '@/lib/office/messagethreadservice';
import { fromDbThreadStatus, PORTAL_THREAD_STATUS_LABELS } from '@/lib/office/messagestatuslabels';
import { fromDbThreadType } from '@/lib/office/messagebusinessrules';

export type PortalOfficeAudience = 'client' | 'employee';

export type PortalOfficeInboxFilter = 'open' | 'closed';

export type PortalActor = {
  audience: PortalOfficeAudience;
  roleKey: RoleKey;
  clientId: string | null;
  employeeId: string | null;
  profileId: string | null;
  displayName: string;
};

const CLOSED_STATUSES = new Set(['resolved', 'closed', 'archived']);

function officeMessagingError(error: string): ServiceResult<never> {
  if (isMissingTableServiceError(error)) {
    return { ok: false, error: OFFICE_MESSAGING_SCHEMA_ERROR };
  }
  return { ok: false, error };
}

export function resolvePortalActor(
  roleKey: RoleKey | null | undefined,
  portalSession: PortalSessionRecord | null,
  profileId?: string | null,
  displayName?: string | null,
): ServiceResult<PortalActor> {
  if (!roleKey) return { ok: false, error: 'Kein Profil für Portal-Nachrichten.' };

  if (roleKey === 'client_portal' || roleKey === 'family_portal') {
    const clientId = portalSession?.clientId ?? null;
    if (!clientId) return { ok: false, error: 'Kein Klient:innen-Konto verknüpft.' };
    return {
      ok: true,
      data: {
        audience: 'client',
        roleKey,
        clientId,
        employeeId: null,
        profileId: profileId ?? portalSession?.accountId ?? null,
        displayName: displayName ?? 'Klient:in',
      },
    };
  }

  if (roleKey === 'employee_portal') {
    const employeeId = portalSession?.employeeId ?? null;
    if (!employeeId) return { ok: false, error: 'Kein Mitarbeiter:innen-Konto verknüpft.' };
    return {
      ok: true,
      data: {
        audience: 'employee',
        roleKey,
        clientId: null,
        employeeId,
        profileId: profileId ?? portalSession?.accountId ?? null,
        displayName: displayName ?? 'Mitarbeiter:in',
      },
    };
  }

  return { ok: false, error: 'Keine Berechtigung für Portal-Nachrichten.' };
}

function expectedThreadType(audience: PortalOfficeAudience): OfficeThreadType {
  return audience === 'client' ? 'client_office' : 'employee_office';
}

function threadBelongsToActor(thread: OfficeMessageThread, actor: PortalActor): boolean {
  if (thread.threadType !== expectedThreadType(actor.audience)) return false;
  if (actor.audience === 'client') return thread.clientId === actor.clientId;
  return thread.employeeId === actor.employeeId;
}

function filterByInbox(
  threads: OfficeMessageThread[],
  filter: PortalOfficeInboxFilter,
): OfficeMessageThread[] {
  if (filter === 'closed') {
    return threads.filter((thread) => CLOSED_STATUSES.has(thread.status));
  }
  return threads.filter((thread) => !CLOSED_STATUSES.has(thread.status));
}

function mapThreadRow(row: Record<string, unknown>): OfficeMessageThread | null {
  const threadType = fromDbThreadType(String(row.thread_type ?? ''));
  if (!threadType) return null;
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    threadType,
    status: fromDbThreadStatus(String(row.status ?? 'open')),
    priority: (row.priority as OfficeMessageThread['priority']) ?? 'normal',
    subject: String(row.subject ?? ''),
    categoryId: row.category_id ? String(row.category_id) : null,
    categoryLabel: null,
    clientId: row.client_id ? String(row.client_id) : null,
    clientName: null,
    employeeId: row.employee_id ? String(row.employee_id) : null,
    employeeName: null,
    participantName: null,
    assignedToUserId: row.assigned_to_user_id ? String(row.assigned_to_user_id) : null,
    assignedToUserName: null,
    assignedAt: row.assigned_at ? String(row.assigned_at) : null,
    closedAt: row.closed_at ? String(row.closed_at) : null,
    closedByUserId: row.closed_by_user_id ? String(row.closed_by_user_id) : null,
    participantProfileIds: [],
    lastMessageAt: row.last_message_at ? String(row.last_message_at) : null,
    lastMessagePreview: row.last_message_preview ? String(row.last_message_preview) : null,
    unreadCount: Number(row.portal_unread_count ?? 0),
    archivedAt: row.archived_at ? String(row.archived_at) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

async function fetchPortalThreadsLive(
  tenantId: string,
  actor: PortalActor,
): Promise<ServiceResult<OfficeMessageThread[]>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Supabase nicht verfügbar.' };

  const dbType = toDbThreadType(expectedThreadType(actor.audience));
  let query = supabase
    .from('message_threads')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('thread_type', dbType);

  if (actor.audience === 'client') {
    query = query.eq('client_id', actor.clientId!);
  } else {
    query = query.eq('employee_id', actor.employeeId!);
  }

  const { data, error } = await query.order('last_message_at', {
    ascending: false,
    nullsFirst: false,
  });

  if (error) return officeMessagingError(toGermanSupabaseError(error));

  const threads = (data ?? [])
    .map((row) => mapThreadRow(row as Record<string, unknown>))
    .filter((thread): thread is OfficeMessageThread => thread !== null)
    .filter((thread) => threadBelongsToActor(thread, actor));

  return { ok: true, data: threads };
}

export async function fetchPortalOfficeCategories(
  tenantId: string,
  actor: PortalActor,
): Promise<ServiceResult<OfficeMessageCategory[]>> {
  const permission =
    actor.audience === 'client' ? 'portal.client.messages.view' : 'portal.employee.messages.view';
  const denied = enforcePermission<OfficeMessageCategory[]>(actor.roleKey, permission);
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Supabase nicht verfügbar.' };

  const { data, error } = await supabase
    .from('message_categories')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) return officeMessagingError(toGermanSupabaseError(error));

  const audience = actor.audience;
  const categories = (data ?? [])
    .map((row) => ({
      id: String(row.id),
      tenantId: String(row.tenant_id),
      key: String(row.key),
      label: String(row.label),
      audience: row.audience as OfficeMessageCategory['audience'],
      sortOrder: Number(row.sort_order ?? 0),
      isActive: Boolean(row.is_active),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    }))
    .filter((category) => category.audience === audience || category.audience === 'all');

  return { ok: true, data: categories };
}

export async function fetchPortalOfficeThreads(
  tenantId: string,
  actor: PortalActor,
  filter: PortalOfficeInboxFilter = 'open',
): Promise<ServiceResult<OfficeMessageThread[]>> {
  const permission =
    actor.audience === 'client' ? 'portal.client.messages.view' : 'portal.employee.messages.view';
  const denied = enforcePermission<OfficeMessageThread[]>(actor.roleKey, permission);
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const categoriesResult = await fetchPortalOfficeCategories(tenantId, actor);
  if (!categoriesResult.ok) return categoriesResult;

  const threadsResult = await fetchPortalThreadsLive(tenantId, actor);
  if (!threadsResult.ok) return threadsResult;

  const byId = new Map(categoriesResult.data.map((category) => [category.id, category.label]));
  const enriched = sortThreads(
    filterByInbox(threadsResult.data, filter).map((thread) => ({
      ...thread,
      categoryLabel: thread.categoryId ? (byId.get(thread.categoryId) ?? null) : null,
    })),
  );

  return { ok: true, data: enriched };
}

export async function fetchPortalOfficeThreadDetail(
  tenantId: string,
  threadId: string,
  actor: PortalActor,
): Promise<ServiceResult<OfficeMessageThreadDetail>> {
  const permission =
    actor.audience === 'client' ? 'portal.client.messages.view' : 'portal.employee.messages.view';
  const denied = enforcePermission<OfficeMessageThreadDetail>(actor.roleKey, permission);
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const threadResult = await fetchPortalThreadsLive(tenantId, actor);
  if (!threadResult.ok) return threadResult;
  const thread = threadResult.data.find((item) => item.id === threadId);
  if (!thread) return { ok: false, error: 'Chat nicht gefunden.' };

  const messagesResult = await fetchMessagesLive(tenantId, threadId);
  if (!messagesResult.ok) return messagesResult;

  const portalMessages = filterPortalVisibleMessages(messagesResult.data).filter(
    (message) => !message.isSystemMessage,
  );

  return {
    ok: true,
    data: {
      ...thread,
      messages: portalMessages,
      canReply: !isThreadClosed(thread.status),
      isClosed: isThreadClosed(thread.status),
    },
  };
}

export async function createPortalOfficeThread(
  tenantId: string,
  actor: PortalActor,
  input: Pick<CreateOfficeThreadInput, 'categoryId' | 'subject' | 'initialMessage'>,
): Promise<ServiceResult<OfficeMessageThread>> {
  const permission =
    actor.audience === 'client' ? 'portal.client.messages.reply' : 'portal.employee.messages.reply';
  const denied = enforcePermission<OfficeMessageThread>(actor.roleKey, permission);
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const threadType = expectedThreadType(actor.audience);
  const validation = validateCreateThread({
    threadType,
    clientId: actor.clientId,
    employeeId: actor.employeeId,
  });
  if (!validation.ok) return validation;

  const subject = input.subject.trim();
  if (!subject) return { ok: false, error: 'Betreff darf nicht leer sein.' };

  const now = new Date().toISOString();
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Supabase nicht verfügbar.' };

  const { data, error } = await supabase
    .from('message_threads')
    .insert({
      tenant_id: tenantId,
      thread_type: toDbThreadType(threadType),
      status: 'new',
      priority: 'normal',
      subject,
      category_id: input.categoryId,
      client_id: actor.clientId,
      employee_id: actor.employeeId,
      created_by_client_id: actor.audience === 'client' ? actor.clientId : null,
      created_by_employee_id: actor.audience === 'employee' ? actor.employeeId : null,
      last_message_at: now,
      last_message_preview: input.initialMessage?.trim().slice(0, 120) ?? 'Neuer Chat',
    })
    .select('*')
    .single();

  if (error) return officeMessagingError(toGermanSupabaseError(error));

  const createdThreadId = String(data.id);

  if (input.initialMessage?.trim()) {
    const messageResult = await supabase.from('messages').insert({
      tenant_id: tenantId,
      thread_id: createdThreadId,
      body: input.initialMessage.trim(),
      sender_client_id: actor.audience === 'client' ? actor.clientId : null,
      sender_employee_id: actor.audience === 'employee' ? actor.employeeId : null,
      sent_at: now,
      status: 'sent',
    });
    if (messageResult.error) {
      return officeMessagingError(toGermanSupabaseError(messageResult.error));
    }
  }

  const refreshed = await fetchPortalThreadsLive(tenantId, actor);
  if (!refreshed.ok) return { ok: false, error: 'Chat konnte nicht erstellt werden.' };
  const created = refreshed.data.find((item) => item.id === createdThreadId);
  if (!created) return { ok: false, error: 'Chat konnte nicht erstellt werden.' };

  void logOfficeMessageAuditEvent({
    tenantId,
    action: 'office_message_thread_created',
    summary: `Portal-Chat „${subject}" erstellt.`,
    actorName: actor.displayName,
    ...auditFromThread(created),
  });

  const notif = buildNewMessageNotification();
  void notifyOfficeMessageEvent({
    tenantId,
    type: 'office_message_new',
    threadId: createdThreadId,
    ...notif,
  });

  return { ok: true, data: created };
}

export async function sendPortalOfficeMessage(
  tenantId: string,
  threadId: string,
  actor: PortalActor,
  body: string,
  attachments: PendingMessageAttachment[] = [],
): Promise<ServiceResult<OfficeMessage>> {
  const permission =
    actor.audience === 'client' ? 'portal.client.messages.reply' : 'portal.employee.messages.reply';
  const denied = enforcePermission<OfficeMessage>(actor.roleKey, permission);
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const trimmed = body.trim();
  if (!trimmed && attachments.length === 0) {
    return { ok: false, error: 'Nachricht oder Anhang erforderlich.' };
  }

  const threadResult = await fetchPortalOfficeThreadDetail(tenantId, threadId, actor);
  if (!threadResult.ok) return threadResult;

  const validation = validateSendMessage(threadResult.data);
  if (!validation.ok) return validation;

  const now = new Date().toISOString();
  const messageBody =
    trimmed ||
    (attachments.length === 1 ? `📎 ${attachments[0]!.fileName}` : `📎 ${attachments.length} Anhänge`);

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Supabase nicht verfügbar.' };

  const { data, error } = await supabase
    .from('messages')
    .insert({
      tenant_id: tenantId,
      thread_id: threadId,
      body: messageBody,
      is_internal_note: false,
      is_system_message: false,
      sender_client_id: actor.audience === 'client' ? actor.clientId : null,
      sender_employee_id: actor.audience === 'employee' ? actor.employeeId : null,
      sent_at: now,
      status: 'sent',
    })
    .select('*')
    .single();

  if (error) return officeMessagingError(toGermanSupabaseError(error));

  const message = mapMessageRow(data as Record<string, unknown>);

  for (const attachment of attachments) {
    const uploadResult = await uploadPortalMessageAttachment({
      tenantId,
      threadId,
      messageId: message.id,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      fileSizeBytes: attachment.fileSizeBytes,
      fileData: attachment.fileData,
      actorRoleKey: actor.roleKey,
      profileId: actor.profileId,
      actorName: actor.displayName,
      audience: actor.audience,
    });
    if (!uploadResult.ok) return uploadResult;
  }

  const { data: threadRow } = await supabase
    .from('message_threads')
    .select('office_unread_count')
    .eq('tenant_id', tenantId)
    .eq('id', threadId)
    .maybeSingle();

  await supabase
    .from('message_threads')
    .update({
      last_message_at: now,
      last_message_preview: messageBody.slice(0, 120),
      office_unread_count: Number(threadRow?.office_unread_count ?? 0) + 1,
      updated_at: now,
    })
    .eq('tenant_id', tenantId)
    .eq('id', threadId);

  void logOfficeMessageAuditEvent({
    tenantId,
    action: 'office_message_sent',
    summary: 'Portal-Nachricht gesendet.',
    actorName: actor.displayName,
    ...auditFromThread(threadResult.data),
  });

  const notif = buildNewMessageNotification();
  void notifyOfficeMessageEvent({
    tenantId,
    type: 'office_message_reply',
    threadId,
    ...notif,
  });

  return { ok: true, data: message };
}

export async function startNewPortalThreadFromClosed(
  tenantId: string,
  closedThreadId: string,
  actor: PortalActor,
): Promise<ServiceResult<OfficeMessageThreadDetail>> {
  const permission =
    actor.audience === 'client' ? 'portal.client.messages.reply' : 'portal.employee.messages.reply';
  const denied = enforcePermission<OfficeMessageThreadDetail>(actor.roleKey, permission);
  if (denied) return denied;

  const detailResult = await fetchPortalOfficeThreadDetail(tenantId, closedThreadId, actor);
  if (!detailResult.ok) return detailResult;
  if (!detailResult.data.isClosed) {
    return { ok: false, error: 'Nur abgeschlossene Chats können neu gestartet werden.' };
  }

  const source = detailResult.data;
  const now = new Date().toISOString();
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Supabase nicht verfügbar.' };

  const { data, error } = await supabase
    .from('message_threads')
    .insert({
      tenant_id: tenantId,
      thread_type: toDbThreadType(source.threadType),
      status: 'new',
      priority: source.priority,
      subject: source.subject,
      category_id: source.categoryId,
      client_id: source.clientId,
      employee_id: source.employeeId,
      created_by_client_id: actor.audience === 'client' ? actor.clientId : null,
      created_by_employee_id: actor.audience === 'employee' ? actor.employeeId : null,
      last_message_at: now,
      last_message_preview: 'Neuer Chat gestartet',
    })
    .select('*')
    .single();

  if (error) return officeMessagingError(toGermanSupabaseError(error));

  const newThreadId = String(data.id);
  await supabase.from('messages').insert({
    tenant_id: tenantId,
    thread_id: newThreadId,
    body: 'Neuer Chat gestartet — vorheriger Verlauf abgeschlossen.',
    is_system_message: true,
    sent_at: now,
    status: 'sent',
  });

  return fetchPortalOfficeThreadDetail(tenantId, newThreadId, actor);
}

export function getPortalStatusLabel(status: OfficeMessageThread['status']): string {
  return PORTAL_THREAD_STATUS_LABELS[status] ?? status;
}

/** Portal-Sichtbarkeit: nur eigene Threads des Akteurs. */
export function filterThreadsForPortalActor(
  threads: OfficeMessageThread[],
  actor: PortalActor,
): OfficeMessageThread[] {
  return threads.filter((thread) => threadBelongsToActor(thread, actor));
}
