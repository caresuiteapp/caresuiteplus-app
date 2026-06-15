import { useCallback } from 'react';
import type { WorkflowStatus } from '@/types';
import { fetchAssignmentDetail, updateAssignmentStatus } from '@/lib/assist';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAsyncQuery, useMutation } from './core';

export function useAssignmentDetail(assignmentId: string | undefined) {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const roleKey = profile?.roleKey ?? null;

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      if (!assignmentId) {
        return Promise.resolve({ ok: false as const, error: 'Keine Einsatz-ID angegeben.' });
      }
      return fetchAssignmentDetail(assignmentId, tenantId, roleKey);
    },
    [tenantId, assignmentId, roleKey],
    { enabled: Boolean(assignmentId) && !!tenantId },
  );

  const statusMutation = useMutation(
    (newStatus: WorkflowStatus) => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      if (!assignmentId) {
        return Promise.resolve({ ok: false as const, error: 'Keine Einsatz-ID angegeben.' });
      }
      return updateAssignmentStatus(assignmentId, tenantId, newStatus, roleKey);
    },
    {
      successMessage: 'Einsatzstatus erfolgreich aktualisiert.',
      onSuccess: (updated) => query.setData(updated),
    },
  );

  const changeStatus = useCallback(
    async (newStatus: WorkflowStatus) => {
      await statusMutation.mutate(newStatus);
    },
    [statusMutation],
  );

  return {
    data: query.data,
    loading: query.loading,
    error: query.error ?? statusMutation.error,
    actionLoading: statusMutation.loading,
    successMessage: statusMutation.successMessage,
    refresh: query.refresh,
    changeStatus,
    notFound: !query.loading && !query.error && !query.data,
  };
}
