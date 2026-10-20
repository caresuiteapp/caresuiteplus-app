import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import {
  listOpenAssignments,
  suggestAssignments,
} from '@/features/communication/communication.assignments';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';

export function useMessageAssignments(threadId?: string) {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();

  const openQuery = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return listOpenAssignments(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  const suggestionsQuery = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      if (!threadId) return Promise.resolve({ ok: true as const, data: [] });
      return suggestAssignments(tenantId, threadId, profile?.roleKey);
    },
    [tenantId, threadId, profile?.roleKey],
    { enabled: !!tenantId && !!threadId },
  );

  return {
    openAssignments: openQuery.data ?? [],
    suggestions: suggestionsQuery.data ?? [],
    loading: openQuery.loading || suggestionsQuery.loading,
    error: openQuery.error ?? suggestionsQuery.error,
    refresh: async () => {
      await openQuery.refresh();
      await suggestionsQuery.refresh();
    },
  };
}
