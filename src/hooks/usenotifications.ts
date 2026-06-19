import { useCallback, useEffect, useState } from 'react';
import type { AppNotification, NotificationCenterTab } from '@/types/office/broadcast';
import { useAuth } from '@/lib/auth/context';
import { subscribeToNotificationChanges } from '@/lib/realtime';
import { useServiceTenantId } from '@/hooks/useTenantId';
import {
  fetchUnreadNotificationCount,
  fetchUserNotifications,
} from '@/lib/office/notificationservice';

export function useNotifications(tab: NotificationCenterTab = 'all') {
  const tenantId = useServiceTenantId();
  const { user, profile } = useAuth();
  const userId = user?.id ?? profile?.id ?? null;
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLiveConnected, setIsLiveConnected] = useState(false);

  const refresh = useCallback(async () => {
    if (!tenantId || !userId) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    setLoading(true);
    setError(null);

    const [listResult, countResult] = await Promise.all([
      fetchUserNotifications(tenantId, userId, null, tab),
      fetchUnreadNotificationCount(tenantId, userId),
    ]);

    setLoading(false);

    if (listResult.ok) setNotifications(listResult.data);
    else setError(listResult.error);

    if (countResult.ok) setUnreadCount(countResult.data);
  }, [tenantId, userId, tab]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!tenantId || !userId) {
      setIsLiveConnected(false);
      return;
    }

    const unsubscribe = subscribeToNotificationChanges(tenantId, () => {
      void refresh();
    });
    setIsLiveConnected(true);
    return () => {
      unsubscribe();
      setIsLiveConnected(false);
    };
  }, [tenantId, userId, refresh]);

  const hasUrgent = notifications.some(
    (n) => !n.isRead && (n.priority === 'urgent' || n.priority === 'critical'),
  );

  return {
    notifications,
    unreadCount,
    loading,
    error,
    hasUrgent,
    refresh,
    isLiveConnected,
    tenantId,
    userId,
  };
}
