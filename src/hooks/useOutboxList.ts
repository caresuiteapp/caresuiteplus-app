import { useCallback } from 'react';
import { fetchOutboxList, retryOutboxEntry } from '@/lib/integrations';
import { useAuth } from '@/lib/auth/context';
import { useAsyncQuery, useMutation } from './core';

export function useOutboxList() {
  const { profile } = useAuth();
  const roleKey = profile?.roleKey ?? null;
  const query = useAsyncQuery(() => fetchOutboxList(roleKey), [roleKey]);

  const retryMutation = useMutation(
    (id: string) => retryOutboxEntry(id, roleKey),
    { successMessage: 'Erneuter Versand eingereiht.' },
  );

  const refresh = useCallback(() => query.refresh(), [query]);

  const retry = useCallback(
    async (id: string) => {
      const result = await retryMutation.mutate(id);
      if (result) await query.refresh();
      return result;
    },
    [retryMutation, query],
  );

  return {
    items: query.data ?? [],
    loading: query.loading,
    error: query.error,
    refresh,
    retry,
    retryLoading: retryMutation.loading,
    successMessage: retryMutation.successMessage,
  };
}
