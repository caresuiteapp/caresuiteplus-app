import { fetchQmChapters, fetchQmHandbook } from '@/lib/qm';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAsyncQuery } from '@/hooks/core';

export function useQmHandbook() {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();

  const handbook = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchQmHandbook(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  const chapters = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchQmChapters(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  return {
    handbook: handbook.data,
    chapters: chapters.data ?? [],
    loading: handbook.loading || chapters.loading,
    error: handbook.error ?? chapters.error,
    refresh: async () => {
      await Promise.all([handbook.refresh(), chapters.refresh()]);
    },
  };
}
