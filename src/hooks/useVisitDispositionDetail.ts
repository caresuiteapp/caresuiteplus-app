import { useCallback } from 'react';
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

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      if (!visitId) {
        return Promise.resolve({ ok: false as const, error: 'Keine Einsatz-ID angegeben.' });
      }
      return fetchVisitDispositionDetail(visitId, tenantId, roleKey);
    },
    [tenantId, visitId, roleKey],
    { enabled: Boolean(visitId) && !!tenantId },
  );

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
    actionError: statusMutation.error,
    actionLoading: statusMutation.loading,
    successMessage: statusMutation.successMessage,
    refresh: query.refresh,
    changeStatus,
    notFound: !query.loading && !query.error && !query.data,
  };
}
