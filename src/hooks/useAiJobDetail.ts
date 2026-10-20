import { useCallback } from 'react';
import { fetchAiJobDetail } from '@/lib/platform';
import { useAuth } from '@/lib/auth/context';
import { useAsyncQuery } from './core';

export function useAiJobDetail(jobId: string | undefined) {
  const { profile } = useAuth();
  const roleKey = profile?.roleKey ?? null;

  const query = useAsyncQuery(
    () => fetchAiJobDetail(jobId ?? '', roleKey),
    [jobId, roleKey],
    { enabled: !!jobId },
  );

  const refresh = useCallback(() => query.refresh(), [query]);

  return {
    data: query.data,
    loading: query.loading,
    error: query.error,
    refresh,
    notFound: !query.loading && !query.error && !query.data && !!jobId,
  };
}
