import { useCallback, useRef } from 'react';
import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import {
  fetchVisitDispositionDetail,
  updateVisitDispositionStatus,
} from '@/lib/assist/visitService';
import type { VisitDispositionDetail } from '@/lib/assist/visitTypes';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAsyncQuery, useMutation } from './core';

export function useVisitDispositionDetail(visitId: string | undefined) {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const roleKey = profile?.roleKey ?? null;
  const lastLoadError = useRef<string | null>(null);
  const lastLoadApplied = useRef(false);

  const query = useAsyncQuery(
    async () => {
      lastLoadApplied.current = false;
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      if (!visitId) {
        return Promise.resolve({ ok: false as const, error: 'Keine Einsatz-ID angegeben.' });
      }
      try {
        const result = await fetchVisitDispositionDetail(visitId, tenantId, roleKey);
        lastLoadError.current = result.ok ? null : result.error;
        return result;
      } catch (error) {
        lastLoadError.current = error instanceof Error ? error.message : 'Aktualisieren fehlgeschlagen.';
        throw error;
      }
    },
    [tenantId, visitId, roleKey],
    { enabled: Boolean(visitId) && !!tenantId, queryKey: `${tenantId}:${visitId}:${roleKey}`,
      onSuccess: () => { lastLoadApplied.current = true; } },
  );

  const refreshAfterSave = useCallback(async () => {
    await query.refresh();
    if (!lastLoadApplied.current || lastLoadError.current) throw new Error(lastLoadError.current ?? 'Aktualisierung nicht bestätigt.');
  }, [query.refresh]);

  const statusMutation = useMutation(
    (newStatus: AssignmentStatus) => {
      if (!tenantId || !visitId) {
        return Promise.resolve({ ok: false as const, error: 'Keine Einsatz-ID angegeben.' });
      }
      return updateVisitDispositionStatus(visitId, tenantId, newStatus, roleKey);
    },
    {
      successMessage: 'Einsatzstatus erfolgreich aktualisiert.',
      onSuccess: (updated: VisitDispositionDetail) => query.setData(updated),
    },
  );

  const changeStatus = useCallback(
    async (newStatus: AssignmentStatus) => {
      await statusMutation.mutate(newStatus);
    },
    [statusMutation],
  );

  return {
    data: query.data,
    loading: query.loading,
    // A failed mutation must not discard the already loaded visit page.
    error: query.error,
    refreshError: query.refreshError,
    actionError: statusMutation.error,
    actionLoading: statusMutation.loading,
    successMessage: statusMutation.successMessage,
    refresh: query.refresh,
    refreshAfterSave,
    changeStatus,
    notFound: !query.loading && !query.error && !query.data,
  };
}
