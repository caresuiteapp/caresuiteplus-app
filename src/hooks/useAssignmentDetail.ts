import { useCallback } from 'react';
import type { AssignmentPlan } from '@/types/modules/assist';
import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import {
  fetchVisitDispositionDetail,
  updateVisitDispositionStatus,
} from '@/lib/assist/visitService';
import { subscribeToAssistOperationsChanges } from '@/lib/realtime';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { OPERATIONAL_LIVE_POLL_MS, useAsyncQuery, useMutation } from './core';

export function useAssignmentDetail(assignmentId: string | undefined) {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const roleKey = profile?.roleKey ?? null;

  const query = useAsyncQuery<AssignmentPlan>(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      if (!assignmentId) {
        return Promise.resolve({ ok: false as const, error: 'Keine Einsatz-ID angegeben.' });
      }
      return fetchVisitDispositionDetail(assignmentId, tenantId, roleKey).then((result) => {
        if (!result.ok) return result;
        const detail = result.data;
        return {
          ok: true as const,
          data: {
            id: detail.id,
            tenantId: detail.tenantId,
            clientId: detail.clientId,
            employeeId: detail.employeeId ?? '',
            appointmentId: null,
            title: detail.title,
            scheduledStart: detail.scheduledStart,
            scheduledEnd: detail.scheduledEnd,
            status: detail.status,
            location: detail.location,
            notes: detail.notes,
            clientName: detail.clientName,
            employeeName: detail.employeeName,
            nextActionHint: detail.errorMessage ?? undefined,
            allowedStatusActions: [],
            allowedStatusTransitions: detail.allowedStatusTransitions,
            createdAt: detail.createdAt,
            updatedAt: detail.updatedAt,
            visibility: 'team' as const,
            sensitivity: 'care' as const,
          },
        };
      });
    },
    [tenantId, assignmentId, roleKey],
    {
      enabled: Boolean(assignmentId) && !!tenantId,
      live: tenantId
        ? {
            tenantId,
            subscribe: subscribeToAssistOperationsChanges,
            pollMs: OPERATIONAL_LIVE_POLL_MS,
          }
        : undefined,
    },
  );

  const statusMutation = useMutation<AssignmentStatus, AssignmentPlan>(
    (newStatus: AssignmentStatus) => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      if (!assignmentId) {
        return Promise.resolve({ ok: false as const, error: 'Keine Einsatz-ID angegeben.' });
      }
      return updateVisitDispositionStatus(assignmentId, tenantId, newStatus, roleKey).then(
        (result) => {
          if (!result.ok) return result;
          const detail = result.data;
          return {
            ok: true as const,
            data: {
              id: detail.id,
              tenantId: detail.tenantId,
              clientId: detail.clientId,
              employeeId: detail.employeeId ?? '',
              appointmentId: null,
              title: detail.title,
              scheduledStart: detail.scheduledStart,
              scheduledEnd: detail.scheduledEnd,
              status: detail.status,
              location: detail.location,
              notes: detail.notes,
              clientName: detail.clientName,
              employeeName: detail.employeeName,
              nextActionHint: detail.errorMessage ?? undefined,
              allowedStatusActions: [],
              allowedStatusTransitions: detail.allowedStatusTransitions,
              createdAt: detail.createdAt,
              updatedAt: detail.updatedAt,
              visibility: 'team' as const,
              sensitivity: 'care' as const,
            },
          };
        },
      );
    },
    {
      successMessage: 'Einsatzstatus erfolgreich aktualisiert.',
      onSuccess: (updated) => query.setData(updated),
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
    error: query.error ?? statusMutation.error,
    actionLoading: statusMutation.loading,
    successMessage: statusMutation.successMessage,
    refresh: query.refresh,
    changeStatus,
    isLiveConnected: query.isLiveConnected,
    notFound: !query.loading && !query.error && !query.data,
  };
}
