import { useCallback } from 'react';
import { fetchIntegrationList } from '@/lib/integrations';
import { useAuth } from '@/lib/auth/context';
import { useAsyncQuery } from './core';

export function useIntegrationList() {
  const { profile } = useAuth();
  const roleKey = profile?.roleKey ?? null;
  const query = useAsyncQuery(() => fetchIntegrationList(roleKey), [roleKey]);
  const refresh = useCallback(() => query.refresh(), [query]);
  return {
    items: query.data ?? [],
    loading: query.loading,
    error: query.error,
    refresh,
  };
}
