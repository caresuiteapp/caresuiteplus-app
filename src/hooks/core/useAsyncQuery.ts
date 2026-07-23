import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ServiceResult } from '@/types';
import { withServiceQueryTimeout } from '@/lib/services/queryTimeout';
import type { LiveRefreshQueryConfig } from './liveRefreshTypes';
import { DEFAULT_LIVE_POLL_MS, useLiveRefresh } from './useLiveRefresh';

type UseAsyncQueryOptions = {
  enabled?: boolean;
  onSuccess?: () => void;
  live?: LiveRefreshQueryConfig;
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
  const [tableMissing, setTableMissing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const dataRef = useRef<T | null>(null);
  const requestInFlightRef = useRef(false);
  const refreshQueuedRef = useRef(false);
  dataRef.current = data;

  const load = useCallback(
    async (silent = false) => {
      if (!options?.enabled && options?.enabled !== undefined) return;
      if (requestInFlightRef.current) {
        refreshQueuedRef.current = true;
        return;
      }
      requestInFlightRef.current = true;

      const isInitialLoad = dataRef.current === null;
      if (!silent && isInitialLoad) {
        setLoading(true);
        setError(null);
      }

      try {
        do {
          refreshQueuedRef.current = false;
          const result = await withServiceQueryTimeout(fetcher());
          if (result.ok) {
            setDataState(result.data);
            const previewResult = result as {
              previewData?: boolean;
              usedDemoFallback?: boolean;
              tableMissing?: boolean;
            };
            setPreviewData(Boolean(previewResult.previewData || previewResult.usedDemoFallback));
            setTableMissing(Boolean(previewResult.tableMissing));
            setError(null);
            options?.onSuccess?.();
          } else if (isInitialLoad) {
            setDataState(null);
            setPreviewData(false);
            setTableMissing(false);
            setError(result.error);
          }
        } while (refreshQueuedRef.current);
      } catch (cause) {
        if (isInitialLoad) {
          setDataState(null);
          setPreviewData(false);
          setTableMissing(false);
          setError(
            cause instanceof Error ? cause.message : 'Daten konnten nicht geladen werden.',
          );
        }
      } finally {
        requestInFlightRef.current = false;
        if (!silent && isInitialLoad) {
          setLoading(false);
        }
      }
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

  const silentRefresh = useCallback(async () => {
    await load(true);
  }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load(true);
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const liveEnabled =
    options?.live?.enabled !== false &&
    Boolean(options?.live?.tenantId && options?.live?.subscribe);

  const subscribeFactory = useMemo(() => {
    if (!liveEnabled || !options?.live?.tenantId || !options.live.subscribe) return undefined;
    const tenantId = options.live.tenantId;
    const subscribe = options.live.subscribe;
    return (handler: () => void) => subscribe(tenantId, handler);
  }, [liveEnabled, options?.live?.subscribe, options?.live?.tenantId]);

  const { isLiveConnected } = useLiveRefresh({
    enabled: liveEnabled,
    onRefresh: () => {
      void silentRefresh();
    },
    subscribe: subscribeFactory,
    pollMs: options?.live?.pollMs ?? DEFAULT_LIVE_POLL_MS,
    refreshOnFocus: options?.live?.refreshOnFocus,
  });

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
    tableMissing,
    refreshing,
    refresh,
    silentRefresh,
    reload: load,
    isLiveConnected,
    isEmpty: !loading && !error && data === null,
  };
}
