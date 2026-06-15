import { useCallback, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import {
  getCommunicationKpis,
  listThreads,
  type ListThreadsOptions,
} from '@/features/communication/communication.service';
import { THREAD_LIST_FILTERS } from '@/features/communication/communication.constants';
import type { ThreadListFilter } from '@/features/communication/communication.types';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';

export function useCommunicationCenter() {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const [filter, setFilter] = useState<ThreadListFilter>('all');
  const [search, setSearch] = useState('');

  const options: ListThreadsOptions = useMemo(
    () => ({ filter, search, includeArchived: filter === 'archived' }),
    [filter, search],
  );

  const threadsQuery = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return listThreads(tenantId, options, profile?.roleKey, profile?.id);
    },
    [tenantId, profile?.roleKey, profile?.id, filter, search],
    { enabled: !!tenantId },
  );

  const kpisQuery = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return getCommunicationKpis(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  const refresh = useCallback(async () => {
    await Promise.all([threadsQuery.refresh(), kpisQuery.refresh()]);
  }, [threadsQuery, kpisQuery]);

  return {
    threads: threadsQuery.data ?? [],
    kpis: kpisQuery.data,
    loading: threadsQuery.loading || kpisQuery.loading,
    error: threadsQuery.error ?? kpisQuery.error,
    refreshing: threadsQuery.refreshing || kpisQuery.refreshing,
    filter,
    setFilter,
    filters: THREAD_LIST_FILTERS,
    search,
    setSearch,
    refresh,
    demoMode: !process.env.EXPO_PUBLIC_SUPABASE_URL,
  };
}

export function useThreads(options?: ListThreadsOptions) {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return listThreads(tenantId, options, profile?.roleKey, profile?.id);
    },
    [tenantId, profile?.roleKey, profile?.id, options?.filter, options?.search],
    { enabled: !!tenantId },
  );

  return {
    items: query.data ?? [],
    loading: query.loading,
    error: query.error,
    refreshing: query.refreshing,
    refresh: query.refresh,
  };
}
