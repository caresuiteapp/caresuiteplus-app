import type { RoleKey, ServiceResult } from '@/types';
import type { AppNotification, BroadcastPriority, NotificationCenterTab } from '@/types/office/broadcast';
import { BROADCAST_CATEGORIES } from '@/types/office/broadcast';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isMissingTableServiceError, toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { logBroadcastAuditEvent } from '@/lib/office/broadcastauditservice';
import {
  OFFICE_NOTIFICATIONS_SCHEMA_ERROR,
  OFFICE_NOTIFICATIONS_TABLE,
} from '@/lib/office/notificationtable';

function notificationError(error: string): ServiceResult<never> {
  if (isMissingTableServiceError(error)) {
    return { ok: false, error: OFFICE_NOTIFICATIONS_SCHEMA_ERROR };
  }
  return { ok: false, error };
}

function categoryLabelFromMetadata(metadata: Record<string, unknown> | null): string | null {
  const category = metadata?.category;
  if (typeof category !== 'string') return null;
  return BROADCAST_CATEGORIES.find((c) => c.key === category)?.label ?? category;
}

function mapNotificationRow(row: Record<string, unknown>): AppNotification {
  const metadata = (row.metadata as Record<string, unknown> | null) ?? {};
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    notificationType: (row.notification_type as AppNotification['notificationType']) ?? 'system',
    title: String(row.title),
    bodyPreview: row.body_preview ? String(row.body_preview) : null,
    priority: (row.priority as BroadcastPriority) ?? 'normal',
    isRead: Boolean(row.is_read),
    readAt: row.read_at ? String(row.read_at) : null,
    createdAt: String(row.created_at),
    relatedBroadcastId: row.related_broadcast_id ? String(row.related_broadcast_id) : null,
    relatedThreadId: row.related_thread_id ? String(row.related_thread_id) : null,
    senderDisplayName: typeof metadata.senderName === 'string' ? metadata.senderName : 'Verwaltung',
    categoryLabel: categoryLabelFromMetadata(metadata),
    requireAcknowledgement: Boolean(metadata.requireAcknowledgement),
    allowReplies: Boolean(metadata.allowReplies),
    isAcknowledged: Boolean(metadata.isAcknowledged),
  };
}

function filterByTab(notifications: AppNotification[], tab: NotificationCenterTab): AppNotification[] {
  switch (tab) {
    case 'unread':
      return notifications.filter((n) => !n.isRead);
    case 'broadcasts':
      return notifications.filter((n) => n.notificationType === 'broadcast');
    case 'messages':
      return notifications.filter((n) => n.notificationType === 'message');
    case 'system':
      return notifications.filter((n) => n.notificationType === 'system');
    case 'all':
    default:
      return notifications;
  }
}

export async function fetchUserNotifications(
  tenantId: string,
  userId: string,
  employeeId?: string | null,
  tab: NotificationCenterTab = 'all',
): Promise<ServiceResult<AppNotification[]>> {
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Supabase nicht verfügbar.' };

  let query = fromUnknownTable(supabase, OFFICE_NOTIFICATIONS_TABLE)
    .select('*')
    .eq('tenant_id', tenantId)
    .order('is_read', { ascending: true })
    .order('created_at', { ascending: false });

  if (employeeId) {
    query = query.or(`recipient_user_id.eq.${userId},recipient_employee_id.eq.${employeeId}`);
  } else {
    query = query.eq('recipient_user_id', userId);
  }

  const { data, error } = await query;
  if (error) return notificationError(toGermanSupabaseError(error));

  const mapped = (data ?? []).map((row) => mapNotificationRow(row as Record<string, unknown>));
  return { ok: true, data: filterByTab(mapped, tab) };
}

export async function fetchUnreadNotificationCount(
  tenantId: string,
  userId: string,
  employeeId?: string | null,
): Promise<ServiceResult<number>> {
  const result = await fetchUserNotifications(tenantId, userId, employeeId, 'unread');
  if (!result.ok) return result;
  return { ok: true, data: result.data.length };
}

export async function markNotificationRead(
  tenantId: string,
  notificationId: string,
  userId: string,
  employeeId?: string | null,
): Promise<ServiceResult<void>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Supabase nicht verfügbar.' };

  const now = new Date().toISOString();

  const { data: notification, error: fetchError } = await fromUnknownTable(
    supabase,
    OFFICE_NOTIFICATIONS_TABLE,
  )
    .select('related_broadcast_id, recipient_employee_id')
    .eq('tenant_id', tenantId)
    .eq('id', notificationId)
    .maybeSingle();

  if (fetchError) return notificationError(toGermanSupabaseError(fetchError));
  if (!notification) return { ok: false, error: 'Benachrichtigung nicht gefunden.' };

  const { error } = await fromUnknownTable(supabase, OFFICE_NOTIFICATIONS_TABLE)
    .update({ is_read: true, read_at: now })
    .eq('tenant_id', tenantId)
    .eq('id', notificationId);

  if (error) return notificationError(toGermanSupabaseError(error));

  const broadcastId = notification.related_broadcast_id
    ? String(notification.related_broadcast_id)
    : null;
  const resolvedEmployeeId = employeeId ?? (notification.recipient_employee_id
    ? String(notification.recipient_employee_id)
    : null);

  if (broadcastId && resolvedEmployeeId) {
    await fromUnknownTable(supabase, 'notification_broadcast_recipients')
      .update({ is_read: true, read_at: now })
      .eq('tenant_id', tenantId)
      .eq('broadcast_id', broadcastId)
      .eq('employee_id', resolvedEmployeeId);

    await logBroadcastAuditEvent({
      tenantId,
      actorUserId: userId,
      action: 'broadcast_read',
      broadcastId,
      metadata: { employeeId: resolvedEmployeeId },
    });
  }

  return { ok: true, data: undefined };
}

export async function markAllNotificationsRead(
  tenantId: string,
  userId: string,
  employeeId?: string | null,
): Promise<ServiceResult<void>> {
  const listResult = await fetchUserNotifications(tenantId, userId, employeeId, 'unread');
  if (!listResult.ok) return listResult;

  for (const notification of listResult.data) {
    const result = await markNotificationRead(tenantId, notification.id, userId, employeeId);
    if (!result.ok) return result;
  }

  return { ok: true, data: undefined };
}

export async function acknowledgeBroadcastNotification(
  tenantId: string,
  notificationId: string,
  userId: string,
  employeeId: string,
): Promise<ServiceResult<void>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Supabase nicht verfügbar.' };

  const now = new Date().toISOString();

  const { data: notification, error: fetchError } = await fromUnknownTable(
    supabase,
    OFFICE_NOTIFICATIONS_TABLE,
  )
    .select('related_broadcast_id, metadata')
    .eq('tenant_id', tenantId)
    .eq('id', notificationId)
    .maybeSingle();

  if (fetchError) return notificationError(toGermanSupabaseError(fetchError));
  if (!notification) return { ok: false, error: 'Benachrichtigung nicht gefunden.' };

  const metadata = (notification.metadata as Record<string, unknown> | null) ?? {};
  if (!metadata.requireAcknowledgement) {
    return markNotificationRead(tenantId, notificationId, userId, employeeId);
  }

  const broadcastId = notification.related_broadcast_id
    ? String(notification.related_broadcast_id)
    : null;
  if (!broadcastId) return { ok: false, error: 'Kein Broadcast verknüpft.' };

  await fromUnknownTable(supabase, OFFICE_NOTIFICATIONS_TABLE)
    .update({
      is_read: true,
      read_at: now,
      metadata: { ...metadata, isAcknowledged: true },
    })
    .eq('tenant_id', tenantId)
    .eq('id', notificationId);

  await fromUnknownTable(supabase, 'notification_broadcast_recipients')
    .update({
      is_read: true,
      read_at: now,
      is_acknowledged: true,
      acknowledged_at: now,
    })
    .eq('tenant_id', tenantId)
    .eq('broadcast_id', broadcastId)
    .eq('employee_id', employeeId);

  await logBroadcastAuditEvent({
    tenantId,
    actorUserId: userId,
    action: 'broadcast_acknowledged',
    broadcastId,
    metadata: { employeeId },
  });

  return { ok: true, data: undefined };
}

export async function fetchBroadcastForNotification(
  tenantId: string,
  broadcastId: string,
): Promise<ServiceResult<{ title: string; body: string; categoryLabel: string; priority: BroadcastPriority; allowReplies: boolean; requireAcknowledgement: boolean }>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Supabase nicht verfügbar.' };

  const { data, error } = await fromUnknownTable(supabase, 'notification_broadcasts')
    .select('title, body, category, priority, allow_replies, require_acknowledgement')
    .eq('tenant_id', tenantId)
    .eq('id', broadcastId)
    .maybeSingle();

  if (error) return notificationError(toGermanSupabaseError(error));
  if (!data) return { ok: false, error: 'Broadcast nicht gefunden.' };

  return {
    ok: true,
    data: {
      title: String(data.title),
      body: String(data.body),
      categoryLabel: BROADCAST_CATEGORIES.find((c) => c.key === data.category)?.label ?? String(data.category),
      priority: (data.priority as BroadcastPriority) ?? 'normal',
      allowReplies: Boolean(data.allow_replies),
      requireAcknowledgement: Boolean(data.require_acknowledgement),
    },
  };
}
