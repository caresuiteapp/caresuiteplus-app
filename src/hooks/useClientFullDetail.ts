import { useCallback } from 'react';
import type { ClientFullDetail } from '@/types/modules/client';
import { fetchClientFullDetail } from '@/lib/clients';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { usePermissions } from '@/hooks/usePermissions';
import { useAsyncQuery } from './core';

export function useClientFullDetail(clientId: string | undefined) {
  const { profile, user, portalSession } = useAuth();
  const tenantId = useServiceTenantId();
  const { can } = usePermissions();
  const canViewRecord = can('office.clients.view');
  const canViewSensitive = can('office.clients.view_sensitive');
  const actorId = user?.id ?? profile?.id ?? null;
  const scope = JSON.stringify([tenantId, clientId, actorId, profile?.id, profile?.roleKey, portalSession?.accountId, canViewRecord, canViewSensitive]);
  const enabled = Boolean(tenantId && clientId && actorId && canViewRecord);

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      if (!clientId) {
        return Promise.resolve({ ok: false as const, error: 'Keine Klient:innen-ID angegeben.' });
      }
      return fetchClientFullDetail(tenantId, clientId, {
        canViewSensitive,
      });
    },
    [scope],
    { enabled, queryKey: scope },
  );

  const refresh = useCallback(() => query.refresh(), [query]);

  return {
    data: query.data as ClientFullDetail | null,
    loading: enabled && query.loading,
    error: !canViewRecord ? 'Für diese Akte fehlen die erforderlichen Leserechte.' : query.error,
    refresh,
    notFound: !query.loading && !query.error && !query.data,
    canViewSensitive,
  };
}
