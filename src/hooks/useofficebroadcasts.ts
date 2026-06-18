import { useCallback, useEffect, useState } from 'react';
import type { BroadcastDetail, NotificationBroadcast } from '@/types/office/broadcast';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { fetchBroadcastDetail, listBroadcasts } from '@/lib/office/broadcastservice';

export function useOfficeBroadcasts() {
  const tenantId = useServiceTenantId();
  const { profile } = useAuth();
  const [broadcasts, setBroadcasts] = useState<NotificationBroadcast[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    const result = await listBroadcasts(tenantId, profile?.roleKey);
    setLoading(false);
    if (result.ok) setBroadcasts(result.data);
    else setError(result.error);
  }, [tenantId, profile?.roleKey]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { broadcasts, loading, error, refresh, tenantId };
}

export function useOfficeBroadcastDetail(broadcastId: string | null) {
  const tenantId = useServiceTenantId();
  const { profile } = useAuth();
  const [detail, setDetail] = useState<BroadcastDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!tenantId || !broadcastId) {
      setDetail(null);
      return;
    }
    setLoading(true);
    setError(null);
    const result = await fetchBroadcastDetail(tenantId, broadcastId, profile?.roleKey);
    setLoading(false);
    if (result.ok) setDetail(result.data);
    else setError(result.error);
  }, [tenantId, broadcastId, profile?.roleKey]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { detail, loading, error, refresh };
}
