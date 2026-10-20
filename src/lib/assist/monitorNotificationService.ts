import type {
  LiveOperationEventType,
  MonitorNotification,
  NotificationChannel,
  NotificationPriority,
} from '@/types/modules/liveMonitor';
import {
  LIVE_MONITOR_STORE,
  filterByTenant,
  nextDeliveryId,
  nextNotificationId,
} from './liveMonitorStore';

const PREPARED_CHANNELS: NotificationChannel[] = ['push', 'email', 'sms', 'whatsapp'];

export function createMonitorNotification(input: {
  tenantId: string;
  assignmentId?: string | null;
  recipientType: 'admin' | 'employee' | 'client';
  recipientId?: string | null;
  eventType: LiveOperationEventType | string;
  title: string;
  body: string;
  priority?: NotificationPriority;
  channels?: NotificationChannel[];
}): MonitorNotification[] {
  const channels = input.channels ?? ['in_app'];
  const created: MonitorNotification[] = [];
  const now = new Date().toISOString();

  for (const channel of channels) {
    const notification: MonitorNotification = {
      id: nextNotificationId(),
      tenantId: input.tenantId,
      assignmentId: input.assignmentId ?? null,
      recipientType: input.recipientType,
      recipientId: input.recipientId ?? null,
      channel,
      priority: input.priority ?? 'normal',
      eventType: input.eventType,
      title: input.title,
      body: input.body,
      readAt: null,
      createdAt: now,
    };
    LIVE_MONITOR_STORE.notifications.push(notification);
    created.push(notification);

    if (PREPARED_CHANNELS.includes(channel)) {
      LIVE_MONITOR_STORE.notificationDeliveries.push({
        id: nextDeliveryId(),
        notificationId: notification.id,
        channel,
        status: 'pending',
        attemptedAt: null,
        errorMessage: null,
      });
    }
  }

  return created;
}

export function listMonitorNotifications(
  tenantId: string,
  filter?: {
    recipientType?: 'admin' | 'employee' | 'client';
    recipientId?: string | null;
    assignmentId?: string;
  },
): MonitorNotification[] {
  if (!tenantId?.trim()) return [];
  return filterByTenant(LIVE_MONITOR_STORE.notifications, tenantId).filter((n) => {
    if (filter?.recipientType && n.recipientType !== filter.recipientType) return false;
    if (filter?.recipientId !== undefined && n.recipientId !== filter.recipientId) return false;
    if (filter?.assignmentId && n.assignmentId !== filter.assignmentId) return false;
    return true;
  });
}

export function notifyAdmins(
  tenantId: string,
  assignmentId: string,
  eventType: LiveOperationEventType | string,
  title: string,
  body: string,
  priority: NotificationPriority = 'normal',
): MonitorNotification[] {
  return createMonitorNotification({
    tenantId,
    assignmentId,
    recipientType: 'admin',
    eventType,
    title,
    body,
    priority,
  });
}

export function notifyEmployee(
  tenantId: string,
  assignmentId: string,
  employeeId: string,
  eventType: LiveOperationEventType | string,
  title: string,
  body: string,
): MonitorNotification[] {
  return createMonitorNotification({
    tenantId,
    assignmentId,
    recipientType: 'employee',
    recipientId: employeeId,
    eventType,
    title,
    body,
  });
}

export function notifyClient(
  tenantId: string,
  assignmentId: string,
  clientId: string,
  eventType: LiveOperationEventType | string,
  title: string,
  body: string,
): MonitorNotification[] {
  return createMonitorNotification({
    tenantId,
    assignmentId,
    recipientType: 'client',
    recipientId: clientId,
    eventType,
    title,
    body,
  });
}

export function getPreparedDeliveryChannels(): NotificationChannel[] {
  return [...PREPARED_CHANNELS];
}
