import { useCallback } from 'react';
import { fetchIntegrationDetail, toggleIntegration } from '@/lib/integrations';
import { useAuth } from '@/lib/auth/context';
import { useAsyncQuery, useMutation } from './core';

export function useIntegrationDetail(id: string | undefined) {
  const { profile } = useAuth();
  const roleKey = profile?.roleKey ?? null;

  const query = useAsyncQuery(
    () => fetchIntegrationDetail(id ?? '', roleKey),
    [id, roleKey],
    { enabled: !!id },
  );

  const toggleMutation = useMutation(
    (_: null) => toggleIntegration(id ?? '', roleKey),
    { successMessage: 'Integrationsstatus aktualisiert.' },
  );

  const refresh = useCallback(() => query.refresh(), [query]);

  const toggle = useCallback(async () => {
    const result = await toggleMutation.mutate(null);
    if (result) await query.refresh();
    return result;
  }, [toggleMutation, query]);

  return {
    data: query.data,
    loading: query.loading,
    error: query.error,
    refresh,
    toggle,
    toggleLoading: toggleMutation.loading,
    successMessage: toggleMutation.successMessage,
    notFound: !query.loading && !query.error && !query.data && !!id,
  };
}
