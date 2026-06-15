import { useCallback, useState } from 'react';
import type { PortalAppointmentItem } from '@/lib/portal';
import { fetchPortalAppointments } from '@/lib/portal';
import { useAuth } from '@/lib/auth/context';
import { useAsyncQuery } from './core';

export function usePortalAppointments() {
  const { profile } = useAuth();
  const profileId = profile?.id ?? '';
  const roleKey = profile?.roleKey ?? null;
  const [showSuccess, setShowSuccess] = useState(false);

  const query = useAsyncQuery(
    () => fetchPortalAppointments(profileId, roleKey),
    [profileId, roleKey],
    { enabled: !!profileId && !!roleKey },
  );

  const items = query.data ?? [];

  const refresh = useCallback(async () => {
    await query.refresh();
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
  }, [query]);

  return {
    items,
    loading: query.loading,
    error: query.error,
    refreshing: query.refreshing,
    showSuccess,
    refresh,
    isEmpty: !query.loading && !query.error && items.length === 0,
  };
}

export type { PortalAppointmentItem };
