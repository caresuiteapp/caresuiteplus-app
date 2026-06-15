import { useCallback } from 'react';
import { fetchOcrJobList } from '@/lib/platform';
import { useAuth } from '@/lib/auth/context';
import { useAsyncQuery } from './core';

export function useOcrJobList() {
  const { profile } = useAuth();
  const roleKey = profile?.roleKey ?? null;
  const query = useAsyncQuery(() => fetchOcrJobList(roleKey), [roleKey]);
  const refresh = useCallback(() => query.refresh(), [query]);
  return {
    items: query.data ?? [],
    loading: query.loading,
    error: query.error,
    refresh,
  };
}
