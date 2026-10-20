import { useCallback } from 'react';
import { fetchOcrJobDetail, retryOcrJob } from '@/lib/platform';
import { useAuth } from '@/lib/auth/context';
import { useAsyncQuery, useMutation } from './core';

export function useOcrJobDetail(jobId: string | undefined) {
  const { profile } = useAuth();
  const roleKey = profile?.roleKey ?? null;

  const query = useAsyncQuery(
    () => fetchOcrJobDetail(jobId ?? '', roleKey),
    [jobId, roleKey],
    { enabled: !!jobId },
  );

  const retryMutation = useMutation(
    (_: null) => retryOcrJob(jobId ?? '', roleKey),
    { successMessage: 'OCR-Job erneut gestartet.' },
  );

  const refresh = useCallback(() => query.refresh(), [query]);

  const retry = useCallback(async () => {
    const result = await retryMutation.mutate(null);
    if (result) await query.refresh();
    return result;
  }, [retryMutation, query]);

  return {
    data: query.data,
    loading: query.loading,
    error: query.error,
    refresh,
    retry,
    retryLoading: retryMutation.loading,
    successMessage: retryMutation.successMessage,
    notFound: !query.loading && !query.error && !query.data && !!jobId,
  };
}
