import { useCallback, useMemo, useState } from 'react';
import type { TIAuditAction } from '@/types/modules/ti';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { exportTIAuditLog, fetchTIAuditLog } from '@/lib/ti';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';

export function useTIAuditLog(pageSize = 20) {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const [actionFilter, setActionFilter] = useState<TIAuditAction | 'all'>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [exportResult, setExportResult] = useState<string | null>(null);

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchTIAuditLog(
        tenantId,
        { action: actionFilter, search, page, pageSize },
        profile?.roleKey,
      );
    },
    [tenantId, profile?.roleKey, actionFilter, search, page, pageSize],
    { enabled: !!tenantId },
  );

  const exportLog = useCallback(async () => {
    if (!tenantId) return;
    const result = await exportTIAuditLog(
      tenantId,
      profile?.roleKey,
      profile?.displayName ?? 'System',
    );
    if (result.ok) {
      setExportResult(`${result.data.rowCount} Ereignisse exportiert`);
      await query.refresh();
    } else {
      setExportResult(result.error);
    }
  }, [tenantId, profile?.roleKey, profile?.displayName, query]);

  return useMemo(
    () => ({
      items: query.data?.items ?? [],
      totalCount: query.data?.totalCount ?? 0,
      filteredCount: query.data?.filteredCount ?? 0,
      loading: query.loading,
      error: query.error,
      refresh: query.refresh,
      actionFilter,
      setActionFilter: (v: TIAuditAction | 'all') => {
        setActionFilter(v);
        setPage(1);
      },
      search,
      setSearch: (v: string) => {
        setSearch(v);
        setPage(1);
      },
      page,
      setPage,
      hasMore: query.data?.hasMore ?? false,
      exportLog,
      exportResult,
    }),
    [query, actionFilter, search, page, exportLog, exportResult],
  );
}
