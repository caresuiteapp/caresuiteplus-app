import { useCallback, useState } from 'react';
import type { PortalAppointmentItem } from '@/lib/portal';
import { fetchPortalAppointments } from '@/lib/portal';
import { usePortalActor } from '@/hooks/usePortalActor';
import { useAsyncQuery } from './core';

export function usePortalAppointments() {
  const { tenantId, clientId, employeeId, actorId, roleKey, isReady } = usePortalActor();
  const profileId = actorId ?? '';
  const [showSuccess, setShowSuccess] = useState(false);

  const query = useAsyncQuery(
    () =>
      fetchPortalAppointments(profileId, roleKey, {
        tenantId,
        clientId,
        employeeId,
      }),
    [profileId, roleKey, tenantId, clientId, employeeId],
    { enabled: isReady },
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
