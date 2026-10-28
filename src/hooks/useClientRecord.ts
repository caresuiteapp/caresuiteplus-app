import { useCallback } from 'react';
import { fetchClientRecord } from '@/lib/clients/clientRecordService';
import { subscribeToClientRecordChanges } from '@/lib/realtime';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { usePermissions } from '@/hooks/usePermissions';
import { useAsyncQuery } from './core';

export function useClientRecord(clientId: string | undefined) {
  const tenantId = useServiceTenantId();
  const { profile, user, portalSession } = useAuth();
  const { can } = usePermissions();
  const canViewRecord = can('office.clients.view');
  const canViewSensitive = can('office.clients.view_sensitive');
  const actorId = user?.id ?? profile?.id ?? null;
  const scope = JSON.stringify([tenantId, clientId, actorId, profile?.id, profile?.roleKey, portalSession?.accountId, canViewRecord, canViewSensitive]);
  const enabled = Boolean(tenantId && clientId && actorId && canViewRecord);

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      if (!clientId) return Promise.resolve({ ok: false as const, error: 'Keine ID.' });
      return fetchClientRecord(tenantId, clientId, { canViewSensitive });
    },
    [scope],
    {
      enabled,
      queryKey: scope,
      live:
        enabled && tenantId && clientId
          ? {
              tenantId,
              subscribe: (tid, handler) => subscribeToClientRecordChanges(tid, clientId, handler),
            }
          : undefined,
    },
  );

  const refresh = useCallback(() => query.refresh(), [query]);

  return {
    record: query.data,
    detail: query.data?.detail ?? null,
    careContexts: query.data?.careContexts ?? [],
    tabs: query.data?.tabs ?? [],
    loading: enabled && query.loading,
    error: !canViewRecord ? 'Für diese Akte fehlen die erforderlichen Leserechte.' : query.error,
    refresh,
    isLiveConnected: query.isLiveConnected,
  };
}
