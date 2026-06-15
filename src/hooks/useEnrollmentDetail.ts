import { useCallback } from 'react';
import { fetchEnrollmentDetail } from '@/lib/akademie/moduleExtensionService';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAsyncQuery } from './core';

export function useEnrollmentDetail(enrollmentId: string | undefined) {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const roleKey = profile?.roleKey ?? null;

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      if (!enrollmentId) return Promise.resolve({ ok: false as const, error: 'Keine Teilnahme-ID angegeben.' });
      return fetchEnrollmentDetail(enrollmentId, tenantId, roleKey);
    },
    [tenantId, enrollmentId, roleKey],
    { enabled: Boolean(enrollmentId) && !!tenantId },
  );

  const refresh = useCallback(async () => {
    await query.refresh();
  }, [query]);

  return {
    data: query.data,
    loading: query.loading,
    error: query.error,
    refresh,
    notFound: !query.loading && !query.error && !query.data,
  };
}
