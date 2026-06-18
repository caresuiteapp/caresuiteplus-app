import type { RoleKey, ServiceResult } from '@/types';
import type {
  BroadcastAttachment,
  BroadcastCategoryKey,
  BroadcastDetail,
  BroadcastRecipientFilter,
  BroadcastRecipientStat,
  CreateBroadcastInput,
  NotificationBroadcast,
} from '@/types/office/broadcast';
import { BROADCAST_CATEGORIES } from '@/types/office/broadcast';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isMissingTableServiceError, toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import {
  BROADCAST_ALLOWED_ROLE_KEYS,
  BROADCAST_CREATE_PERMISSION,
} from '@/lib/office/broadcastpermissions';
import { logBroadcastAuditEvent } from '@/lib/office/broadcastauditservice';
import { createOfficeMessageThread } from '@/lib/office/messageservice';

export const BROADCAST_SCHEMA_ERROR =
  'Broadcast-System: Supabase-Tabellen fehlen. Migration 0094_office_broadcast_notifications anwenden.';

type ActiveEmployee = {
  id: string;
  profileId: string | null;
  firstName: string;
  lastName: string;
  userId: string | null;
};

function enforceBroadcastCreate<T>(roleKey?: RoleKey | null): ServiceResult<T> | null {
  if (!roleKey) return { ok: false, error: 'Sie sind nicht angemeldet.' };
  if (BROADCAST_ALLOWED_ROLE_KEYS.has(roleKey)) return null;
  return enforcePermission<T>(roleKey, BROADCAST_CREATE_PERMISSION);
}

function broadcastError(error: string): ServiceResult<never> {
  if (isMissingTableServiceError(error)) {
    return { ok: false, error: BROADCAST_SCHEMA_ERROR };
  }
  return { ok: false, error };
}

function categoryLabel(key: string): string {
  return BROADCAST_CATEGORIES.find((c) => c.key === key)?.label ?? key;
}

function bodyPreview(body: string, max = 120): string {
  const trimmed = body.trim().replace(/\s+/g, ' ');
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

function mapBroadcastRow(
  row: Record<string, unknown>,
  stats?: { recipientCount: number; readCount: number; acknowledgedCount: number },
): NotificationBroadcast {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    createdByUserId: String(row.created_by_user_id),
    title: String(row.title),
    body: String(row.body),
    category: String(row.category) as BroadcastCategoryKey,
    categoryLabel: categoryLabel(String(row.category)),
    priority: (row.priority as NotificationBroadcast['priority']) ?? 'normal',
    audience: (row.audience as NotificationBroadcast['audience']) ?? 'employees',
    allowReplies: Boolean(row.allow_replies),
    requireAcknowledgement: Boolean(row.require_acknowledgement),
    showInEmployeePortal: Boolean(row.show_in_employee_portal),
    status: (row.status as NotificationBroadcast['status']) ?? 'sent',
    sentAt: row.sent_at ? String(row.sent_at) : null,
    archivedAt: row.archived_at ? String(row.archived_at) : null,
    expiresAt: row.expires_at ? String(row.expires_at) : null,
    createdAt: String(row.created_at),
    senderDisplayName: null,
    recipientCount: stats?.recipientCount ?? 0,
    readCount: stats?.readCount ?? 0,
    acknowledgedCount: stats?.acknowledgedCount ?? 0,
  };
}

async function resolveActiveEmployees(
  tenantId: string,
  filter?: BroadcastRecipientFilter,
): Promise<ServiceResult<ActiveEmployee[]>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Supabase nicht verfügbar.' };

  let query = supabase
    .from('employees')
    .select('id, profile_id, first_name, last_name')
    .eq('tenant_id', tenantId)
    .eq('status', 'active');

  if (filter?.audience === 'selected_employees' && filter.employeeIds?.length) {
    query = query.in('id', filter.employeeIds);
  }

  const { data: employees, error } = await query;
  if (error) return broadcastError(toGermanSupabaseError(error));

  const rows = employees ?? [];
  if (rows.length === 0) {
    return { ok: false, error: 'Es wurden keine aktiven Mitarbeitenden in diesem Mandanten gefunden.' };
  }

  const employeeIds = rows.map((r) => String(r.id));
  const { data: portalAccounts } = await supabase
    .from('employee_portal_accounts')
    .select('employee_id, auth_user_id')
    .eq('tenant_id', tenantId)
    .in('employee_id', employeeIds);

  const portalUserByEmployee = new Map<string, string>();
  for (const account of portalAccounts ?? []) {
    if (account.auth_user_id) {
      portalUserByEmployee.set(String(account.employee_id), String(account.auth_user_id));
    }
  }

  const active: ActiveEmployee[] = rows.map((row) => {
    const id = String(row.id);
    const profileId = row.profile_id ? String(row.profile_id) : null;
    return {
      id,
      profileId,
      firstName: String(row.first_name ?? ''),
      lastName: String(row.last_name ?? ''),
      userId: profileId ?? portalUserByEmployee.get(id) ?? null,
    };
  });

  return { ok: true, data: active };
}

async function fetchRecipientStats(
  tenantId: string,
  broadcastIds: string[],
): Promise<Map<string, { recipientCount: number; readCount: number; acknowledgedCount: number }>> {
  const stats = new Map<string, { recipientCount: number; readCount: number; acknowledgedCount: number }>();
  if (broadcastIds.length === 0) return stats;

  const supabase = getSupabaseClient();
  if (!supabase) return stats;

  const { data } = await fromUnknownTable(supabase, 'notification_broadcast_recipients')
    .select('broadcast_id, is_read, is_acknowledged')
    .eq('tenant_id', tenantId)
    .in('broadcast_id', broadcastIds);

  for (const row of data ?? []) {
    const bid = String(row.broadcast_id);
    const current = stats.get(bid) ?? { recipientCount: 0, readCount: 0, acknowledgedCount: 0 };
    current.recipientCount += 1;
    if (row.is_read) current.readCount += 1;
    if (row.is_acknowledged) current.acknowledgedCount += 1;
    stats.set(bid, current);
  }

  return stats;
}

export async function sendBroadcast(
  tenantId: string,
  input: CreateBroadcastInput,
  actorRoleKey?: RoleKey | null,
  actorUserId?: string | null,
): Promise<ServiceResult<{ broadcastId: string; recipientCount: number }>> {
  const denied = enforceBroadcastCreate<{ broadcastId: string; recipientCount: number }>(actorRoleKey);
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const title = input.title.trim();
  const body = input.body.trim();
  if (!title) return { ok: false, error: 'Betreff darf nicht leer sein.' };
  if (!body) return { ok: false, error: 'Nachricht darf nicht leer sein.' };
  if (!actorUserId) return { ok: false, error: 'Benutzer nicht angemeldet.' };

  const employeesResult = await resolveActiveEmployees(tenantId, input.recipientFilter);
  if (!employeesResult.ok) return employeesResult;

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Supabase nicht verfügbar.' };

  const now = new Date().toISOString();
  const filter = input.recipientFilter ?? { audience: 'employees' as const };

  const { data: broadcast, error: broadcastError_ } = await fromUnknownTable(
    supabase,
    'notification_broadcasts',
  )
    .insert({
      tenant_id: tenantId,
      created_by_user_id: actorUserId,
      title,
      body,
      category: input.category,
      priority: input.priority,
      audience: filter.audience,
      allow_replies: input.allowReplies,
      require_acknowledgement: input.requireAcknowledgement,
      show_in_employee_portal: input.showInEmployeePortal,
      status: 'sent',
      sent_at: now,
      expires_at: input.expiresAt ?? null,
      metadata: { recipientFilter: filter },
    })
    .select('*')
    .single();

  if (broadcastError_) return broadcastError(toGermanSupabaseError(broadcastError_));
  const broadcastId = String(broadcast.id);

  const recipients = employeesResult.data.map((employee) => ({
    tenant_id: tenantId,
    broadcast_id: broadcastId,
    employee_id: employee.id,
    user_id: employee.userId,
    delivered_at: now,
    is_read: false,
    is_acknowledged: false,
  }));

  const { error: recipientsError } = await fromUnknownTable(
    supabase,
    'notification_broadcast_recipients',
  ).insert(recipients);

  if (recipientsError) {
    await logBroadcastAuditEvent({
      tenantId,
      actorUserId,
      action: 'broadcast_send_failed',
      broadcastId,
      metadata: { error: recipientsError.message },
    });
    return broadcastError(toGermanSupabaseError(recipientsError));
  }

  const notifications = employeesResult.data
    .filter((employee) => employee.userId)
    .map((employee) => ({
      tenant_id: tenantId,
      recipient_user_id: employee.userId,
      recipient_employee_id: employee.id,
      notification_type: 'broadcast',
      title,
      body_preview: bodyPreview(body),
      priority: input.priority,
      related_broadcast_id: broadcastId,
      is_read: false,
      delivered_at: now,
      metadata: {
        category: input.category,
        requireAcknowledgement: input.requireAcknowledgement,
        allowReplies: input.allowReplies,
      },
    }));

  if (notifications.length > 0) {
    const { error: notificationsError } = await fromUnknownTable(supabase, 'notifications').insert(
      notifications,
    );
    if (notificationsError) {
      await logBroadcastAuditEvent({
        tenantId,
        actorUserId,
        action: 'broadcast_send_failed',
        broadcastId,
        metadata: { error: notificationsError.message },
      });
      return broadcastError(toGermanSupabaseError(notificationsError));
    }
  }

  await logBroadcastAuditEvent({
    tenantId,
    actorUserId,
    action: 'broadcast_sent',
    broadcastId,
    metadata: { recipientCount: employeesResult.data.length, title },
  });

  await logBroadcastAuditEvent({
    tenantId,
    actorUserId,
    action: 'broadcast_recipients_created',
    broadcastId,
    metadata: { count: employeesResult.data.length },
  });

  return {
    ok: true,
    data: { broadcastId, recipientCount: employeesResult.data.length },
  };
}

export async function listBroadcasts(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<NotificationBroadcast[]>> {
  const denied = enforceBroadcastCreate<NotificationBroadcast[]>(actorRoleKey);
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Supabase nicht verfügbar.' };

  const { data, error } = await fromUnknownTable(supabase, 'notification_broadcasts')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('sent_at', { ascending: false, nullsFirst: false });

  if (error) return broadcastError(toGermanSupabaseError(error));

  const ids = (data ?? []).map((row) => String(row.id));
  const stats = await fetchRecipientStats(tenantId, ids);

  return {
    ok: true,
    data: (data ?? []).map((row) =>
      mapBroadcastRow(row as Record<string, unknown>, stats.get(String(row.id))),
    ),
  };
}

export async function fetchBroadcastDetail(
  tenantId: string,
  broadcastId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<BroadcastDetail>> {
  const denied = enforceBroadcastCreate<BroadcastDetail>(actorRoleKey);
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Supabase nicht verfügbar.' };

  const { data: broadcast, error } = await fromUnknownTable(supabase, 'notification_broadcasts')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', broadcastId)
    .maybeSingle();

  if (error) return broadcastError(toGermanSupabaseError(error));
  if (!broadcast) return { ok: false, error: 'Broadcast nicht gefunden.' };

  const { data: recipientRows, error: recipientError } = await fromUnknownTable(
    supabase,
    'notification_broadcast_recipients',
  )
    .select('id, employee_id, is_read, is_acknowledged, read_at, acknowledged_at, reply_thread_id')
    .eq('tenant_id', tenantId)
    .eq('broadcast_id', broadcastId);

  if (recipientError) return broadcastError(toGermanSupabaseError(recipientError));

  const employeeIds = (recipientRows ?? []).map((r) => String(r.employee_id));
  const employeeNames = new Map<string, string>();

  if (employeeIds.length > 0) {
    const { data: employees } = await supabase
      .from('employees')
      .select('id, first_name, last_name')
      .eq('tenant_id', tenantId)
      .in('id', employeeIds);

    for (const emp of employees ?? []) {
      employeeNames.set(String(emp.id), `${emp.first_name ?? ''} ${emp.last_name ?? ''}`.trim());
    }
  }

  const recipients: BroadcastRecipientStat[] = (recipientRows ?? []).map((row) => ({
    id: String(row.id),
    employeeId: String(row.employee_id),
    employeeName: employeeNames.get(String(row.employee_id)) ?? 'Mitarbeiter:in',
    isRead: Boolean(row.is_read),
    isAcknowledged: Boolean(row.is_acknowledged),
    readAt: row.read_at ? String(row.read_at) : null,
    acknowledgedAt: row.acknowledged_at ? String(row.acknowledged_at) : null,
    replyThreadId: row.reply_thread_id ? String(row.reply_thread_id) : null,
  }));

  const stats = {
    recipientCount: recipients.length,
    readCount: recipients.filter((r) => r.isRead).length,
    acknowledgedCount: recipients.filter((r) => r.isAcknowledged).length,
  };

  const { data: attachmentRows } = await fromUnknownTable(supabase, 'notification_attachments')
    .select('id, file_name, file_path, mime_type, file_size')
    .eq('tenant_id', tenantId)
    .eq('broadcast_id', broadcastId);

  const attachments: BroadcastAttachment[] = (attachmentRows ?? []).map((row) => ({
    id: String(row.id),
    fileName: String(row.file_name ?? 'Anhang'),
    filePath: String(row.file_path ?? ''),
    mimeType: row.mime_type ? String(row.mime_type) : null,
    fileSize: row.file_size != null ? Number(row.file_size) : null,
  }));

  return {
    ok: true,
    data: {
      ...mapBroadcastRow(broadcast as Record<string, unknown>, stats),
      recipients,
      attachments,
    },
  };
}

export async function archiveBroadcast(
  tenantId: string,
  broadcastId: string,
  actorRoleKey?: RoleKey | null,
  actorUserId?: string | null,
): Promise<ServiceResult<void>> {
  const denied = enforceBroadcastCreate<void>(actorRoleKey);
  if (denied) return denied;

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Supabase nicht verfügbar.' };

  const now = new Date().toISOString();
  const { error } = await fromUnknownTable(supabase, 'notification_broadcasts')
    .update({ status: 'archived', archived_at: now })
    .eq('tenant_id', tenantId)
    .eq('id', broadcastId);

  if (error) return broadcastError(toGermanSupabaseError(error));

  await logBroadcastAuditEvent({
    tenantId,
    actorUserId,
    action: 'broadcast_archived',
    broadcastId,
  });

  return { ok: true, data: undefined };
}

export async function startBroadcastReplyThread(
  tenantId: string,
  broadcastId: string,
  employeeId: string,
  initialMessage: string,
  actorRoleKey?: RoleKey | null,
  profileId?: string | null,
): Promise<ServiceResult<{ threadId: string }>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Supabase nicht verfügbar.' };

  const { data: broadcast, error: broadcastError_ } = await fromUnknownTable(
    supabase,
    'notification_broadcasts',
  )
    .select('title, allow_replies')
    .eq('tenant_id', tenantId)
    .eq('id', broadcastId)
    .maybeSingle();

  if (broadcastError_) return broadcastError(toGermanSupabaseError(broadcastError_));
  if (!broadcast) return { ok: false, error: 'Broadcast nicht gefunden.' };
  if (!broadcast.allow_replies) {
    return { ok: false, error: 'Rückfragen zu diesem Broadcast sind nicht erlaubt.' };
  }

  const { data: recipient } = await fromUnknownTable(supabase, 'notification_broadcast_recipients')
    .select('id, reply_thread_id')
    .eq('tenant_id', tenantId)
    .eq('broadcast_id', broadcastId)
    .eq('employee_id', employeeId)
    .maybeSingle();

  if (recipient?.reply_thread_id) {
    return { ok: true, data: { threadId: String(recipient.reply_thread_id) } };
  }

  const threadResult = await createOfficeMessageThread(
    tenantId,
    {
      threadType: 'employee_office',
      subject: `Rückfrage: ${String(broadcast.title)}`,
      employeeId,
      initialMessage: initialMessage.trim() || 'Rückfrage zum Broadcast',
      priority: 'normal',
    },
    actorRoleKey,
    profileId,
  );

  if (!threadResult.ok || !threadResult.data) return threadResult as ServiceResult<{ threadId: string }>;

  const threadId = threadResult.data.id;

  await supabase
    .from('message_threads')
    .update({ source_broadcast_id: broadcastId })
    .eq('tenant_id', tenantId)
    .eq('id', threadId);

  if (recipient?.id) {
    await fromUnknownTable(supabase, 'notification_broadcast_recipients')
      .update({ reply_thread_id: threadId })
      .eq('id', String(recipient.id));
  }

  await logBroadcastAuditEvent({
    tenantId,
    actorUserId: profileId,
    action: 'broadcast_reply_started',
    broadcastId,
    metadata: { threadId, employeeId },
  });

  return { ok: true, data: { threadId } };
}
