import { useCallback, useMemo, useState } from 'react';
import type { AssistVisitProofRow, AssistVisitProofStatus } from '@/types/assistExecutionPersistence';
import { listVisitProofs } from '@/lib/assist/assistVisitProofPersistenceService';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAsyncQuery } from './core';

export type VisitProofStatusFilter = AssistVisitProofStatus | 'all';

export function useVisitProofReviewList() {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const [statusFilter, setStatusFilter] = useState<VisitProofStatusFilter>('all');
  const [search, setSearch] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return listVisitProofs(tenantId, { limit: 200 });
    },
    [tenantId],
    { enabled: !!tenantId },
  );

  const allItems = query.data ?? [];

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return allItems.filter((item) => {
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (!term) return true;
      const snapshot = item.payloadSnapshot ?? {};
      const haystack = [
        item.proofNumber,
        item.id,
        item.visitId,
        String(snapshot.clientName ?? ''),
        String(snapshot.employeeName ?? ''),
        String(snapshot.serviceName ?? ''),
        String(snapshot.title ?? ''),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [allItems, search, statusFilter]);

  const refresh = useCallback(async () => {
    await query.refresh();
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
  }, [query]);

  return {
    items: filtered as AssistVisitProofRow[],
    totalCount: allItems.length,
    filteredCount: filtered.length,
    loading: query.loading,
    error: query.error,
    refreshing: query.refreshing,
    showSuccess,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    refresh,
    profile,
    tenantId,
  };
}
