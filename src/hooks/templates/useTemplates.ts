import { useCallback } from 'react';
import { listTemplates } from '@/lib/templates';
import type { TemplateListFilters } from '@/types/templates';
import { getServiceMode } from '@/lib/services/mode';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAsyncQuery } from '@/hooks/core';

export function useTemplates(filters: TemplateListFilters = {}) {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const serviceMode = getServiceMode();

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return listTemplates(tenantId, filters, profile?.roleKey);
    },
    [tenantId, profile?.roleKey, JSON.stringify(filters)],
    { enabled: !!tenantId },
  );

  const refresh = useCallback(() => query.refresh(), [query]);

  return {
    templates: query.data ?? [],
    loading: query.loading,
    error: query.error,
    refresh,
    isEmpty: !query.loading && !query.error && (query.data?.length ?? 0) === 0,
    serviceMode,
    tenantId,
  };
}
