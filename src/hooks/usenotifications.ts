import type { NotificationCenterTab } from '@/types/office/broadcast';
import { useAuth } from '@/lib/auth/context';
import { subscribeToNotificationChanges } from '@/lib/realtime';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { usePortalActor } from '@/hooks/usePortalActor';
import { useAsyncQuery } from '@/hooks/core';
import {
  fetchUnreadNotificationCount,
  fetchUserNotifications,
} from '@/lib/office/notificationservice';

export function useNotifications(tab: NotificationCenterTab = 'all') {
  const tenantId = useServiceTenantId();
  const { user, profile, portalSession } = useAuth();
  const actor = usePortalActor();
  const userId = user?.id ?? profile?.id ?? portalSession?.accountId ?? null;
  const employeeActor = actor.roleKey === 'employee_portal' || actor.roleKey === 'caregiver' || actor.roleKey === 'nurse';
  const employeeId = employeeActor ? actor.employeeId : null;
  const enabled = !!tenantId && !!userId && (!employeeActor || !!employeeId);
  const query = useAsyncQuery(async () => {
    const [list, count] = await Promise.all([
      fetchUserNotifications(tenantId!, userId!, employeeId, tab),
      fetchUnreadNotificationCount(tenantId!, userId!, employeeId).catch(() => null),
    ]);
    if (!list.ok) return list;
    return { ok: true as const, data: { notifications: list.data,
      unreadCount: count?.ok ? count.data : list.data.filter((item) => !item.isRead).length } };
  }, [tenantId, userId, employeeId, actor.roleKey, tab], {
    enabled,
    queryKey: JSON.stringify(['notifications', tenantId, userId, employeeId, actor.roleKey, tab]),
    live: tenantId && userId ? { tenantId,
      subscribe: (tid, handler) => subscribeToNotificationChanges(tid, handler) } : undefined,
  });
  const notifications = query.data?.notifications ?? [];

  const hasUrgent = notifications.some(
    (n) => !n.isRead && (n.priority === 'urgent' || n.priority === 'critical'),
  );

  return {
    notifications,
    unreadCount: query.data?.unreadCount ?? 0,
    loading: query.loading,
    error: query.error ?? query.refreshError,
    hasUrgent,
    refresh: query.refresh,
    isLiveConnected: query.isLiveConnected,
    tenantId,
    userId,
    employeeId,
  };
}
