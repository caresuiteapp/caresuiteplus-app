import type { RoleKey, ServiceResult } from '@/types';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAsyncQuery } from '@/hooks/core';

export function useQmTenantQuery<T>(
  fetcher: (tenantId: string, roleKey: RoleKey | null) => Promise<ServiceResult<T>>,
  deps: unknown[] = [],
) {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();

  return useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetcher(tenantId, profile?.roleKey ?? null);
    },
    [tenantId, profile?.roleKey, ...deps],
    { enabled: !!tenantId },
  );
}
