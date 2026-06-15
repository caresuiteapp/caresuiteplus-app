import { useCallback, useMemo } from 'react';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { listThreads } from '@/features/communication/communication.service';
import type { CommunicationAudience } from '@/features/communication/communication.types';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';

function resolveAudience(roleKey: string | null | undefined): CommunicationAudience {
  switch (roleKey) {
    case 'employee_portal':
    case 'caregiver':
    case 'nurse':
      return 'employee_portal';
    case 'family_portal':
      return 'relative_portal';
    case 'client_portal':
      return 'client_portal';
    default:
      return 'business';
  }
}

export function usePortalMessages() {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const audience = resolveAudience(profile?.roleKey);

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return listThreads(tenantId, { filter: 'all' }, profile?.roleKey, profile?.id);
    },
    [tenantId, profile?.roleKey, profile?.id],
    { enabled: !!tenantId && audience !== 'business' },
  );

  const items = query.data ?? [];
  const unreadCount = useMemo(
    () =>
      items.reduce((sum, t) => {
        if (audience === 'employee_portal') return sum + (t.unreadCountBusiness > 0 ? 1 : 0);
        return sum + (t.unreadCountBusiness > 0 ? 1 : 0);
      }, 0),
    [items, audience],
  );

  const refresh = useCallback(async () => {
    await query.refresh();
  }, [query]);

  return {
    items,
    unreadCount,
    audience,
    loading: query.loading,
    error: query.error,
    refreshing: query.refreshing,
    refresh,
    isEmpty: !query.loading && !query.error && items.length === 0,
    demoMode: !process.env.EXPO_PUBLIC_SUPABASE_URL,
  };
}
