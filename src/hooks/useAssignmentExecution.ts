import { useCallback } from 'react';
import {
  completeAssignment,
  fetchAssignmentExecution,
  markArrived,
  markFinished,
  markOnTheWay,
  markPaused,
  markStarted,
  submitDocumentation,
  updateAssignmentTask,
} from '@/lib/assist';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { useAsyncQuery, useMutation } from './core';
import type { AssignmentTaskStatus } from '@/types/modules/assignmentStatus';

export function useAssignmentExecution(assignmentId: string | undefined) {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const roleKey = profile?.roleKey ?? null;

  const mutationContext = {
    actorProfileId: profile?.id,
    actorDisplayName: profile?.displayName ?? profile?.email ?? undefined,
  };

  const query = useAsyncQuery(
    () => {
      if (!assignmentId) {
        return Promise.resolve({ ok: false as const, error: 'Keine Einsatz-ID angegeben.' });
      }
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchAssignmentExecution(assignmentId, tenantId, roleKey);
    },
    [assignmentId, tenantId, roleKey],
    { enabled: Boolean(assignmentId) && !!tenantId },
  );

  const onSuccess = (data: NonNullable<typeof query.data>) => query.setData(data);

  const onTheWayMutation = useMutation(
    () => {
      if (!assignmentId || !tenantId) {
        return Promise.resolve({ ok: false as const, error: 'Keine Einsatz-ID angegeben.' });
      }
      return markOnTheWay(assignmentId, tenantId, roleKey, mutationContext);
    },
    { successMessage: 'Unterwegs gemeldet.', onSuccess },
  );

  const arrivedMutation = useMutation(
    () => {
      if (!assignmentId || !tenantId) {
        return Promise.resolve({ ok: false as const, error: 'Keine Einsatz-ID angegeben.' });
      }
      return markArrived(assignmentId, tenantId, roleKey, mutationContext);
    },
    { successMessage: 'Ankunft gemeldet.', onSuccess },
  );

  const startedMutation = useMutation(
    () => {
      if (!assignmentId || !tenantId) {
        return Promise.resolve({ ok: false as const, error: 'Keine Einsatz-ID angegeben.' });
      }
      return markStarted(assignmentId, tenantId, roleKey, mutationContext);
    },
    { successMessage: 'Einsatz gestartet.', onSuccess },
  );

  const pausedMutation = useMutation(
    () => {
      if (!assignmentId || !tenantId) {
        return Promise.resolve({ ok: false as const, error: 'Keine Einsatz-ID angegeben.' });
      }
      return markPaused(assignmentId, tenantId, roleKey, mutationContext);
    },
    { successMessage: 'Einsatz pausiert.', onSuccess },
  );

  const finishedMutation = useMutation(
    () => {
      if (!assignmentId || !tenantId) {
        return Promise.resolve({ ok: false as const, error: 'Keine Einsatz-ID angegeben.' });
      }
      return markFinished(assignmentId, tenantId, roleKey, mutationContext);
    },
    { successMessage: 'Einsatz beendet.', onSuccess },
  );

  const documentationMutation = useMutation(
    (notes: string) => {
      if (!assignmentId || !tenantId) {
        return Promise.resolve({ ok: false as const, error: 'Keine Einsatz-ID angegeben.' });
      }
      return submitDocumentation(assignmentId, tenantId, notes, roleKey, mutationContext);
    },
    { successMessage: 'Dokumentation gespeichert.', onSuccess },
  );

  const completeMutation = useMutation(
    () => {
      if (!assignmentId || !tenantId) {
        return Promise.resolve({ ok: false as const, error: 'Keine Einsatz-ID angegeben.' });
      }
      return completeAssignment(assignmentId, tenantId, roleKey, mutationContext);
    },
    { successMessage: 'Einsatz abgeschlossen.', onSuccess },
  );

  const taskMutation = useMutation(
    (params: { taskId: string; status: AssignmentTaskStatus; notDoneReason?: string }) => {
      if (!assignmentId || !tenantId) {
        return Promise.resolve({ ok: false as const, error: 'Keine Einsatz-ID angegeben.' });
      }
      return updateAssignmentTask(
        assignmentId,
        params.taskId,
        tenantId,
        params.status,
        params.notDoneReason,
        roleKey,
        mutationContext,
      );
    },
    {
      successMessage: 'Aufgabe aktualisiert.',
      onSuccess: () => query.refresh(),
    },
  );

  const actionLoading =
    onTheWayMutation.loading ||
    arrivedMutation.loading ||
    startedMutation.loading ||
    pausedMutation.loading ||
    finishedMutation.loading ||
    documentationMutation.loading ||
    completeMutation.loading ||
    taskMutation.loading;

  const successMessage =
    onTheWayMutation.successMessage ??
    arrivedMutation.successMessage ??
    startedMutation.successMessage ??
    pausedMutation.successMessage ??
    finishedMutation.successMessage ??
    documentationMutation.successMessage ??
    completeMutation.successMessage ??
    taskMutation.successMessage;

  const error =
    query.error ??
    onTheWayMutation.error ??
    arrivedMutation.error ??
    startedMutation.error ??
    pausedMutation.error ??
    finishedMutation.error ??
    documentationMutation.error ??
    completeMutation.error ??
    taskMutation.error;

  return {
    data: query.data,
    loading: query.loading,
    error,
    actionLoading,
    successMessage,
    refresh: query.refresh,
    markOnTheWay: useCallback(() => onTheWayMutation.mutate(undefined), [onTheWayMutation]),
    markArrived: useCallback(() => arrivedMutation.mutate(undefined), [arrivedMutation]),
    markStarted: useCallback(() => startedMutation.mutate(undefined), [startedMutation]),
    markPaused: useCallback(() => pausedMutation.mutate(undefined), [pausedMutation]),
    markFinished: useCallback(() => finishedMutation.mutate(undefined), [finishedMutation]),
    submitDocumentation: useCallback(
      (notes: string) => documentationMutation.mutate(notes),
      [documentationMutation],
    ),
    completeAssignment: useCallback(() => completeMutation.mutate(undefined), [completeMutation]),
    updateTask: useCallback(
      (taskId: string, status: AssignmentTaskStatus, notDoneReason?: string) =>
        taskMutation.mutate({ taskId, status, notDoneReason }),
      [taskMutation],
    ),
    checkIn: useCallback(() => onTheWayMutation.mutate(undefined), [onTheWayMutation]),
    startWork: useCallback(() => startedMutation.mutate(undefined), [startedMutation]),
    checkOut: useCallback(
      (notes?: string) => {
        if (notes?.trim()) {
          documentationMutation.mutate(notes);
        } else {
          completeMutation.mutate(undefined);
        }
      },
      [documentationMutation, completeMutation],
    ),
  };
}
