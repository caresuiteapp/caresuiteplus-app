import { useCallback } from 'react';
import {
  checkInAssignment,
  checkOutAssignment,
  fetchAssignmentExecution,
  startAssignmentWork,
} from '@/lib/assist';
import { subscribeToAssistOperationsChanges } from '@/lib/realtime';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { OPERATIONAL_LIVE_POLL_MS, useAsyncQuery, useMutation } from './core';

export function useAssignmentExecution(assignmentId: string | undefined) {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const roleKey = profile?.roleKey ?? null;

  const query = useAsyncQuery(
    () => {
      if (!assignmentId) {
        return Promise.resolve({ ok: false as const, error: 'Keine Einsatz-ID angegeben.' });
      }
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchAssignmentExecution(assignmentId, tenantId, roleKey);
    },
    [assignmentId, tenantId, roleKey],
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

  const checkInMutation = useMutation(
    (locationNote?: string) => {
      if (!assignmentId) {
        return Promise.resolve({ ok: false as const, error: 'Keine Einsatz-ID angegeben.' });
      }
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return checkInAssignment(assignmentId, tenantId, roleKey, locationNote);
    },
    {
      successMessage: 'Check-in erfolgreich — Sie sind vor Ort.',
      onSuccess: (data) => query.setData(data),
    },
  );

  const startMutation = useMutation(
    (_?: void) => {
      if (!assignmentId) {
        return Promise.resolve({ ok: false as const, error: 'Keine Einsatz-ID angegeben.' });
      }
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return startAssignmentWork(assignmentId, tenantId, roleKey);
    },
    {
      successMessage: 'Einsatz gestartet — Zeiterfassung läuft.',
      onSuccess: (data) => query.setData(data),
    },
  );

  const checkOutMutation = useMutation(
    (activityNote?: string) => {
      if (!assignmentId) {
        return Promise.resolve({ ok: false as const, error: 'Keine Einsatz-ID angegeben.' });
      }
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return checkOutAssignment(assignmentId, tenantId, roleKey, activityNote);
    },
    {
      successMessage: 'Check-out erfolgreich — Einsatz abgeschlossen.',
      onSuccess: (data) => query.setData(data),
    },
  );

  return {
    data: query.data,
    loading: query.loading,
    error:
      query.error ?? checkInMutation.error ?? startMutation.error ?? checkOutMutation.error,
    actionLoading:
      checkInMutation.loading || startMutation.loading || checkOutMutation.loading,
    successMessage:
      checkInMutation.successMessage ??
      startMutation.successMessage ??
      checkOutMutation.successMessage,
    refresh: query.refresh,
    isLiveConnected: query.isLiveConnected,
    checkIn: useCallback(
      (locationNote?: string) => checkInMutation.mutate(locationNote),
      [checkInMutation],
    ),
    startWork: useCallback(() => startMutation.mutate(undefined), [startMutation]),
    checkOut: useCallback(
      (activityNote?: string) => checkOutMutation.mutate(activityNote),
      [checkOutMutation],
    ),
  };
}
