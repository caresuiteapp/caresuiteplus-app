import { useCallback } from 'react';
import { fetchSubscriptionOverview } from '@/lib/business';
import { useAuth } from '@/lib/auth/context';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { isDemoMode } from '@/lib/supabase/config';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAsyncQuery } from './core';

export function useSubscription() {
  const { profile } = useAuth();
  const roleKey = profile?.roleKey ?? null;
  const serviceTenantId = useServiceTenantId();
  const tenantId = serviceTenantId ?? (isDemoMode() ? DEMO_TENANT_ID : null);

  const query = useAsyncQuery(
    () => fetchSubscriptionOverview(roleKey, tenantId),
    [roleKey, tenantId],
  );
  const refresh = useCallback(() => query.refresh(), [query]);

  return {
    data: query.data,
    loading: query.loading,
    error: query.error,
    refresh,
    tenantId,
  };
}
