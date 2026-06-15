import { useCallback } from 'react';
import { fetchCertificateDetail } from '@/lib/akademie/moduleExtensionService';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAsyncQuery } from './core';

export function useCertificateDetail(certificateId: string | undefined) {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const roleKey = profile?.roleKey ?? null;

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      if (!certificateId) return Promise.resolve({ ok: false as const, error: 'Keine Zertifikat-ID angegeben.' });
      return fetchCertificateDetail(certificateId, tenantId, roleKey);
    },
    [tenantId, certificateId, roleKey],
    { enabled: Boolean(certificateId) && !!tenantId },
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
