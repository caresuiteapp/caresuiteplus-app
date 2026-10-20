import { useCallback } from 'react';
import { getTemplate } from '@/lib/templates';
import { getServiceMode } from '@/lib/services/mode';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAsyncQuery } from '@/hooks/core';

export function useTemplateDetail(templateId: string | null | undefined) {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const serviceMode = getServiceMode();

  const query = useAsyncQuery(
    () => {
      if (!tenantId || !templateId) {
        return Promise.resolve({ ok: false as const, error: 'Kein Mandant oder Vorlage.' });
      }
      return getTemplate(tenantId, templateId, profile?.roleKey);
    },
    [tenantId, templateId, profile?.roleKey],
    { enabled: !!tenantId && !!templateId },
  );

  const refresh = useCallback(() => query.refresh(), [query]);

  return {
    template: query.data ?? null,
    loading: query.loading,
    error: query.error,
    refresh,
    serviceMode,
    tenantId,
  };
}
