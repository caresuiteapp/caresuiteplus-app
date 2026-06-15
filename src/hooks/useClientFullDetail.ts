import { useCallback } from 'react';
import type { ClientFullDetail } from '@/types/modules/client';
import { fetchClientFullDetail } from '@/lib/clients';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { usePermissions } from '@/hooks/usePermissions';
import { useAsyncQuery } from './core';

export function useClientFullDetail(clientId: string | undefined) {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { can } = usePermissions();
  const canViewSensitive = can('office.clients.view_sensitive');

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
    [tenantId, clientId, canViewSensitive, profile?.roleKey],
    { enabled: Boolean(tenantId && clientId) },
  );

  const refresh = useCallback(() => query.refresh(), [query]);

  return {
    data: query.data as ClientFullDetail | null,
    loading: query.loading,
    error: query.error,
    refresh,
    notFound: !query.loading && !query.error && !query.data,
    canViewSensitive,
  };
}
