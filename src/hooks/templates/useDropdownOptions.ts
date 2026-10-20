import { useCallback } from 'react';
import { getDropdownOptions } from '@/lib/templates';
import type { CatalogType } from '@/types/templates';
import { getServiceMode } from '@/lib/services/mode';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAsyncQuery } from '@/hooks/core';

export function useDropdownOptions(catalogType: CatalogType) {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const serviceMode = getServiceMode();

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return getDropdownOptions(tenantId, catalogType, profile?.roleKey);
    },
    [tenantId, catalogType, profile?.roleKey],
    { enabled: !!tenantId },
  );

  const refresh = useCallback(() => query.refresh(), [query]);

  return {
    options: query.data ?? [],
    loading: query.loading,
    error: query.error,
    refresh,
    isEmpty: !query.loading && !query.error && (query.data?.length ?? 0) === 0,
    serviceMode,
    tenantId,
  };
}
