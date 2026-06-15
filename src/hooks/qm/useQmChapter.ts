import { fetchQmChapter } from '@/lib/qm';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAsyncQuery } from '@/hooks/core';

export function useQmChapter(chapterId: string) {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();

  return useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchQmChapter(tenantId, chapterId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey, chapterId],
    { enabled: !!tenantId && !!chapterId },
  );
}
