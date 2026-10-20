import type { ServiceResult } from '@/types';
import { getServiceMode } from '@/lib/services/mode';
import {
  appendDemoNotification,
  getDemoNotifications,
} from './communication.demoStore';
import type { CommunicationNotification, CommunicationNotificationType } from './communication.types';

export async function createCommunicationNotification(input: {
  tenantId: string;
  type: CommunicationNotificationType;
  threadId?: string | null;
  messageId?: string | null;
  title: string;
  body: string;
  actionRoute?: string | null;
}): Promise<ServiceResult<CommunicationNotification>> {
  const now = new Date().toISOString();
  const notification: CommunicationNotification = {
    id: `notif-comm-${Date.now()}`,
    tenantId: input.tenantId,
    type: input.type,
    threadId: input.threadId ?? null,
    messageId: input.messageId ?? null,
    title: input.title,
    body: input.body,
    readAt: null,
    actionRoute: input.actionRoute ?? null,
    createdAt: now,
    updatedAt: now,
  };
  appendDemoNotification(notification);
  return { ok: true, data: notification };
}

export async function markCommunicationNotificationRead(
  notificationId: string,
): Promise<ServiceResult<CommunicationNotification>> {
  const notification = getDemoNotifications().find((n) => n.id === notificationId);
  if (!notification) return { ok: false, error: 'Benachrichtigung nicht gefunden.' };
  notification.readAt = new Date().toISOString();
  notification.updatedAt = notification.readAt;
  return { ok: true, data: notification };
}

export async function listUnreadCommunicationNotifications(
  tenantId: string,
): Promise<ServiceResult<CommunicationNotification[]>> {
  if (getServiceMode() === 'supabase') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { notificationsSupabaseRepository } = require('./repositories') as typeof import('./repositories');
    const result = await notificationsSupabaseRepository.listUnread(tenantId);
    if (!result.ok) return result;
    const now = new Date().toISOString();
    return {
      ok: true,
      data: result.data.map((n) => ({
        id: n.id,
        tenantId: n.tenantId,
        type: n.type as CommunicationNotificationType,
        threadId: n.threadId,
        messageId: null,
        title: n.title,
        body: n.body,
        readAt: n.readAt,
        actionRoute: null,
        createdAt: now,
        updatedAt: now,
      })),
    };
  }

  return {
    ok: true,
    data: getDemoNotifications().filter((n) => n.tenantId === tenantId && !n.readAt),
  };
}

export function listCommunicationNotifications(tenantId: string): CommunicationNotification[] {
  return getDemoNotifications()
    .filter((n) => n.tenantId === tenantId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
