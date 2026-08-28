import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import type { ServiceResult } from '@/types';
import {
  NATIVE_SERVICE_QUERY_TIMEOUT_MS,
  withServiceQueryTimeout,
} from '@/lib/services/queryTimeout';
import type { LiveRefreshQueryConfig } from './liveRefreshTypes';
import { DEFAULT_LIVE_POLL_MS, useLiveRefresh } from './useLiveRefresh';

type UseAsyncQueryOptions = {
  enabled?: boolean;
  onSuccess?: () => void;
  live?: LiveRefreshQueryConfig;
  /** Native stale-while-revalidate bootstrap. Cached data is painted before the live request. */
  initialCache?: () => Promise<ServiceResult<unknown> | null>;
  retryCount?: number;
  refreshOnAppFocus?: boolean;
};

function isTransientQueryError(message: string): boolean {
  return /(network|netzwerk|fetch|timeout|zeit|verbindung|relay|temporar|vorübergehend)/i.test(message);
}

async function runQueryWithRetry<T>(
  fetcher: () => Promise<ServiceResult<T>>,
  retryCount: number,
): Promise<ServiceResult<T>> {
  let lastResult: ServiceResult<T> | null = null;
  let lastError: unknown;
  for (let attempt = 0; attempt <= retryCount; attempt += 1) {
    try {
      const result = Platform.OS === 'web'
        ? await withServiceQueryTimeout(fetcher())
        : await withServiceQueryTimeout(
            fetcher(),
            'Datenabfrage',
            NATIVE_SERVICE_QUERY_TIMEOUT_MS,
          );
      lastResult = result;
      if (result.ok || !isTransientQueryError(result.error) || attempt === retryCount) return result;
    } catch (error) {
      lastError = error;
      if (attempt === retryCount) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
  }
  if (lastResult) return lastResult;
  throw lastError instanceof Error ? lastError : new Error('Datenabfrage fehlgeschlagen.');
}

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
        refreshQueuedRef.current = false;
        const result = await runQueryWithRetry(fetcher, options?.retryCount ?? 1);
        if (result.ok) {
          dataRef.current = result.data;
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
        } else if (dataRef.current === null) {
          setDataState(null);
          setPreviewData(false);
          setTableMissing(false);
          setError(result.error);
        }
      } catch (cause) {
        if (dataRef.current === null) {
          setDataState(null);
          setPreviewData(false);
          setTableMissing(false);
          setError(
            cause instanceof Error ? cause.message : 'Daten konnten nicht geladen werden.',
          );
        }
      } finally {
        const runTrailingRefresh = refreshQueuedRef.current;
        refreshQueuedRef.current = false;
        requestInFlightRef.current = false;
        if (!silent && isInitialLoad) {
          setLoading(false);
        }
        if (runTrailingRefresh) {
          queueMicrotask(() => {
            void load(true);
          });
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
    let cancelled = false;
    void (async () => {
      let cacheShown = false;
      if (options?.initialCache && dataRef.current === null) {
        try {
          const cached = (await options.initialCache()) as ServiceResult<T> | null;
          if (!cancelled && cached?.ok) {
            dataRef.current = cached.data;
            setDataState(cached.data);
            setError(null);
            setLoading(false);
            cacheShown = true;
          }
        } catch {
          // Cache is an acceleration layer; the live request remains authoritative.
        }
      }
      if (!cancelled) await load(cacheShown);
    })();
    return () => {
      cancelled = true;
    };
    // initialCache intentionally follows the fetcher deps captured by `load`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, options?.enabled]);

  const silentRefresh = useCallback(async () => {
    await load(true);
  }, [load]);

  useEffect(() => {
    if (Platform.OS === 'web' || options?.refreshOnAppFocus === false || options?.enabled === false) {
      return;
    }
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && dataRef.current !== null) void load(true);
    });
    return () => subscription.remove();
  }, [load, options?.enabled, options?.refreshOnAppFocus]);

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
      const next = (value as (prev: T | null) => T | null)(dataRef.current);
      dataRef.current = next;
      setDataState(next);
      if (next !== null) setLoading(false);
      return;
    }
    dataRef.current = value;
    setDataState(value);
    if (value !== null) setLoading(false);
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
