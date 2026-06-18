import { useCallback, useEffect, useState } from 'react';
import type { ServiceResult } from '@/types';

type UseAsyncQueryOptions = {
  enabled?: boolean;
  onSuccess?: () => void;
};

export function useAsyncQuery<T>(
  fetcher: () => Promise<ServiceResult<T>>,
  deps: unknown[],
  options?: UseAsyncQueryOptions,
) {
  const [data, setDataState] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (silent = false) => {
      if (!options?.enabled && options?.enabled !== undefined) return;

      if (!silent) setLoading(true);
      setError(null);

      const result = await fetcher();
      if (result.ok) {
        setDataState(result.data);
        const previewResult = result as { previewData?: boolean; usedDemoFallback?: boolean };
        setPreviewData(Boolean(previewResult.previewData || previewResult.usedDemoFallback));
        options?.onSuccess?.();
      } else {
        setDataState(null);
        setPreviewData(false);
        setError(result.error);
      }

      if (!silent) setLoading(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    deps,
  );

  useEffect(() => {
    if (options?.enabled === false) {
      setLoading(false);
      return;
    }
    load();
  }, [load, options?.enabled]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  }, [load]);

  const setData = useCallback((value: T | null | ((prev: T | null) => T | null)) => {
    if (typeof value === 'function') {
      setDataState(value as (prev: T | null) => T | null);
      return;
    }
    setDataState(value);
  }, []);

  return {
    data,
    setData,
    loading,
    error,
    previewData,
    refreshing,
    refresh,
    reload: load,
    isEmpty: !loading && !error && data === null,
  };
}
