import { useEmployeeGpsTracking } from '@/features/liveTracking/useEmployeeGpsTracking';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  EmployeePortalDocumentationInput,
  EmployeePortalSignatureCaptureInput,
} from '@/types/modules/employeePortalExecution';
import type {
  EmployeePortalGpsPermissionStatus,
  EmployeePortalTrackingSnapshot,
} from '@/types/modules/employeePortalTracking';
import type { ExtendedAssignmentTaskStatus } from '@/types/modules/assignmentWorkflow';
import { fetchEmployeePortalAssignmentDetail } from '@/lib/portal/employeePortalExecutionService';
import { buildEmployeePortalLiveRoute } from '@/features/liveTracking/buildEmployeePortalLiveRoute';
import { saveEmployeeLocationConsent } from '@/features/liveTracking/saveEmployeeLocationConsent';
import { requestLocationPermissionOnce } from '@/features/employeePermissions';
import {
  buildEmployeePortalTrackingSnapshot,
  captureEmployeePortalForegroundPosition,
  getEmployeePortalGpsPermissionStatus,
  getEmployeePortalLocationConsent,
  grantEmployeePortalLocationConsent,
  markEmployeePortalConsentExplained,
  peekEmployeePortalTrackingEntry,
  rebuildEmployeePortalTrackingWarnings,
  requestEmployeePortalForegroundLocationPermission,
  setEmployeePortalGeofenceOverrideReason,
} from '@/lib/portal/employeePortalVisitTrackingService';
import { isEmployeePortalVisitLiveTrackingActive } from '@/lib/portal/employeePortalLiveOverviewService';
import type { LiveTrackingErrorCode } from '@/features/liveTracking/liveTrackingErrors';
import {
  assignmentStatusToWorkflowStep,
  endPause,
  endService,
  finalizeVisit,
  markArrived,
  reportNoShow,
  resolveAssistExecutionContext,
  saveClientSignature,
  saveVisitDocumentation,
  startEnRoute,
  startPause,
  startService,
  type AssistExecutionContext,
  type AssistWorkflowStep,
  type MarkArrivedResult,
} from '@/features/assistWorkflow';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { usePortalActor } from '@/hooks/usePortalActor';
import { subscribeToEmployeePortalChanges } from '@/lib/realtime';
import { useLiveVisitTimers } from '@/hooks/useLiveVisitTimers';
import { useTaskResultDrafts } from '@/hooks/useTaskResultDrafts';
import { LIVE_TRACKING_POLL_MS, useAsyncQuery, useMutation } from './core';
import {
  withWorkflowTimeout,
  WorkflowActionTimeoutError,
  WORKFLOW_ACTION_TIMEOUT_MS,
} from '@/features/assistWorkflow/internal/withWorkflowTimeout';

export function useEmployeePortalVisitExecution(assignmentId: string | undefined) {
  const { profile } = useAuth();
  const { tenantId: portalTenantId, employeeId: portalEmployeeId, roleKey: portalRoleKey } =
    usePortalActor();
  const tenantId = useServiceTenantId() ?? portalTenantId;
  const employeeId = portalEmployeeId ?? '';
  const roleKey = portalRoleKey ?? profile?.roleKey ?? null;

  const [gpsPermission, setGpsPermission] = useState<EmployeePortalGpsPermissionStatus>('undetermined');
  const [liveContext, setLiveContext] = useState<EmployeeLiveContext | null>(null);
  const [executionContext, setExecutionContext] = useState<AssistExecutionContext | null>(null);
  const [liveContextError, setLiveContextError] = useState<string | null>(null);
  const [liveErrorCode, setLiveErrorCode] = useState<LiveTrackingErrorCode | null>(null);
  const [consentRevision, setConsentRevision] = useState(0);
  const [workflowLoading, setWorkflowLoading] = useState(false);
  const [startServiceLoading, setStartServiceLoading] = useState(false);
  const [refetchWarning, setRefetchWarning] = useState<string | null>(null);

  useEffect(() => {
    if (!assignmentId) return;
    void getEmployeePortalGpsPermissionStatus().then(setGpsPermission);
  }, [assignmentId]);

  const query = useAsyncQuery(
    () => {
      if (!tenantId || !assignmentId || !employeeId) {
        return Promise.resolve({ ok: false as const, error: 'Einsatzdaten unvollständig.' });
      }
      return fetchEmployeePortalAssignmentDetail(tenantId, assignmentId, employeeId, roleKey);
    },
    [tenantId, assignmentId, employeeId, roleKey],
    {
      enabled: Boolean(tenantId && assignmentId && employeeId),
      live:
        tenantId && employeeId
          ? {
              tenantId,
              subscribe: (tid, handler) => subscribeToEmployeePortalChanges(tid, employeeId, handler),
              pollMs: LIVE_TRACKING_POLL_MS,
            }
          : undefined,
    },
  );

  const refreshExecutionContext = useCallback(async () => {
    if (!tenantId || !assignmentId || !employeeId) return null;
    try {
      const result = await withWorkflowTimeout(
        resolveAssistExecutionContext({
          tenantId,
          assignmentId,
          employeeId,
          profileId: profile?.id ?? employeeId,
          roleKey,
        }),
        WORKFLOW_ACTION_TIMEOUT_MS,
        'resolveAssistExecutionContext',
      );
      if (!result.ok) {
        setLiveContextError(result.error);
        setExecutionContext(null);
        setRefetchWarning(null);
        return null;
      }
      setExecutionContext(result.data);
      setLiveContext(result.data.liveContext);
      setLiveContextError(null);
      setLiveErrorCode(null);
      setRefetchWarning(null);

      if (result.data.liveContext?.consentStatus.granted) {
        grantEmployeePortalLocationConsent(tenantId, assignmentId);
      }

      return result.data;
    } catch (error) {
      const message =
        error instanceof WorkflowActionTimeoutError
          ? 'Einsatzdaten konnten nicht rechtzeitig geladen werden — bitte erneut versuchen.'
          : 'Einsatzdaten konnten nicht aktualisiert werden.';
      setRefetchWarning(message);
      setLiveContextError(message);
      return null;
    }
  }, [tenantId, assignmentId, employeeId, profile?.id, roleKey]);

  useEffect(() => {
    if (!query.data) return;
    void refreshExecutionContext();
  }, [query.data, refreshExecutionContext]);

  const effectiveStatus = executionContext?.derivedStatus ?? query.data?.status ?? null;

  const liveTrackingEnabled = useMemo(
    () =>
      Boolean(liveContext?.trackingSessionActive) &&
      effectiveStatus != null &&
      isEmployeePortalVisitLiveTrackingActive(effectiveStatus),
    [liveContext?.trackingSessionActive, effectiveStatus],
  );

  const gpsTracking = useEmployeeGpsTracking({
    tenantId,
    assistVisitId: liveContext?.assistVisitId ?? null,
    sessionId: liveContext?.trackingSessionId ?? null,
    enabled: liveTrackingEnabled,
    dbSessionActive: liveTrackingEnabled,
  });

  const timers = useLiveVisitTimers(
    executionContext?.timeEvents ?? [],
    effectiveStatus,
    executionContext?.visitTimes ?? null,
  );

  const tracking: EmployeePortalTrackingSnapshot | null = useMemo(() => {
    if (!tenantId || !assignmentId || !query.data) return null;
    const base = buildEmployeePortalTrackingSnapshot(
      tenantId,
      assignmentId,
      query.data.status,
      gpsPermission,
    );

    const resolvedConsent = liveContext?.consentStatus.granted
      ? {
          granted: true as const,
          grantedAt: liveContext.consentStatus.grantedAt,
          explainedAt: liveContext.consentStatus.explainedAt,
        }
      : base.consent;

    const dbActive =
      liveContext?.trackingSessionActive ||
      gpsTracking.state.trackingActive ||
      gpsTracking.state.dbSessionActive;

    return {
      ...base,
      consent: resolvedConsent,
      warnings: rebuildEmployeePortalTrackingWarnings(resolvedConsent, gpsPermission, base.warnings),
      trackingActive: dbActive || base.trackingActive,
      lastPosition: gpsTracking.state.lastSnapshot
        ? {
            latitude: gpsTracking.state.lastSnapshot.latitude,
            longitude: gpsTracking.state.lastSnapshot.longitude,
            accuracyMeters: gpsTracking.state.lastSnapshot.accuracyMeters,
            capturedAt: gpsTracking.state.lastSnapshot.capturedAt,
          }
        : base.lastPosition,
      timers: timers ?? base.timers,
    };
  }, [tenantId, assignmentId, query.data, gpsPermission, liveContext, gpsTracking.state, timers]);

  const workflowStep: AssistWorkflowStep | null = useMemo(() => {
    if (!query.data || !effectiveStatus) return null;
    return assignmentStatusToWorkflowStep(effectiveStatus);
  }, [query.data, effectiveStatus]);

  const syncAfterWorkflow = useCallback(
    async (ctx: AssistExecutionContext) => {
      setExecutionContext(ctx);
      setLiveContext(ctx.liveContext);
      query.setData(ctx.detail);
      return ctx;
    },
    [query],
  );

  const runWorkflow = useCallback(
    async <T,>(
      fn: (ctx: AssistExecutionContext) => Promise<{ ok: boolean; data?: T; error?: string; errorCode?: string }>,
      options?: { timeoutLabel?: string; loadingMode?: 'generic' | 'start_service' },
    ): Promise<{ ok: boolean; data?: T; error?: string; errorCode?: string }> => {
      let ctx = executionContext;
      if (!ctx) {
        ctx = await refreshExecutionContext();
        if (!ctx) return { ok: false, error: 'Einsatzkontext fehlt.', errorCode: 'START_SERVICE_CONTEXT_MISSING' };
      }

      const loadingMode = options?.loadingMode ?? 'generic';
      if (loadingMode === 'start_service') setStartServiceLoading(true);
      else setWorkflowLoading(true);

      try {
        const result = await withWorkflowTimeout(
          fn(ctx),
          WORKFLOW_ACTION_TIMEOUT_MS,
          options?.timeoutLabel ?? 'workflow',
        );

        if (result.ok) {
          const payload = result.data;
          if (payload && typeof payload === 'object') {
            if (
              'ctx' in payload &&
              payload.ctx &&
              typeof payload.ctx === 'object' &&
              'assignmentStatus' in payload.ctx
            ) {
              await syncAfterWorkflow(payload.ctx as AssistExecutionContext);
            } else if ('detail' in payload && 'allowedActions' in payload) {
              await syncAfterWorkflow(payload as AssistExecutionContext);
            } else {
              await refreshExecutionContext();
            }
          } else {
            await refreshExecutionContext();
          }
        }

        return result;
      } catch (error) {
        if (error instanceof WorkflowActionTimeoutError) {
          return {
            ok: false,
            error: 'Zeitüberschreitung — bitte erneut versuchen.',
            errorCode: 'START_SERVICE_TIMEOUT',
          };
        }
        throw error;
      } finally {
        if (loadingMode === 'start_service') setStartServiceLoading(false);
        else setWorkflowLoading(false);
      }
    },
    [executionContext, refreshExecutionContext, syncAfterWorkflow],
  );

  const taskDrafts = useTaskResultDrafts(
    query.data?.tasks ?? [],
    executionContext,
    syncAfterWorkflow,
  );

  const grantConsent = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    if (!tenantId || !assignmentId || !employeeId) {
      return { ok: false, error: 'Einsatzdaten unvollständig.' };
    }

    markEmployeePortalConsentExplained(tenantId, assignmentId);
    const local = grantEmployeePortalLocationConsent(tenantId, assignmentId);

    const persisted = await saveEmployeeLocationConsent({
      tenantId,
      employeeId,
      routeParamId: assignmentId,
      profileId: profile?.id ?? employeeId,
      consentExplainedAt: local.explainedAt,
      localConsent: local,
    });

    if (!persisted.ok) {
      return { ok: false, error: persisted.error ?? 'Einwilligung konnte nicht gespeichert werden.' };
    }

    grantEmployeePortalLocationConsent(tenantId, assignmentId);
    setConsentRevision((n) => n + 1);
    await refreshExecutionContext();
    return { ok: true };
  }, [tenantId, assignmentId, employeeId, profile?.id, refreshExecutionContext]);

  const startDriveTracking = useCallback(async (): Promise<{ ok: boolean; error?: string; errorCode?: LiveTrackingErrorCode }> => {
    if (!tenantId || !assignmentId) {
      return { ok: false, error: 'Keine Einsatz-ID.' };
    }

    const perm = await requestLocationPermissionOnce(tenantId, employeeId);
    setGpsPermission(perm);
    if (perm !== 'granted') {
      return { ok: false, error: 'Standortberechtigung erforderlich.', errorCode: 'LIVE_GPS_PERMISSION_DENIED' };
    }

    let snapshot = await gpsTracking.captureOnce();
    if (!snapshot) {
      const captured = await captureEmployeePortalForegroundPosition(tenantId, assignmentId);
      if (!captured.ok) {
        return { ok: false, error: captured.error, errorCode: 'LIVE_GPS_POSITION_UNAVAILABLE' };
      }
      snapshot = captured.data;
    }

    const consent = getEmployeePortalLocationConsent(tenantId, assignmentId);
    const now = consent.grantedAt ?? new Date().toISOString();

    const started = await startEnRoute({
      tenantId,
      employeeId,
      assignmentId,
      profileId: profile?.id ?? employeeId,
      roleKey,
      consentGrantedAt: now,
      consentExplainedAt: consent.explainedAt,
      gpsSnapshot: snapshot,
      localConsent: consent,
    });

    if (!started.ok) {
      setLiveErrorCode('LIVE_SESSION_CREATE_FAILED');
      return { ok: false, error: started.error };
    }

    setLiveContext(started.data.liveContext);
    setExecutionContext(started.data);
    setLiveErrorCode(null);
    query.setData(started.data.detail);
    await gpsTracking.startWatching();
    return { ok: true };
  }, [tenantId, assignmentId, employeeId, profile?.id, roleKey, gpsTracking, query]);

  const handleMarkArrived = useCallback(async (): Promise<MarkArrivedResult> => {
    return runWorkflow(async (ctx) => {
      let gpsSnapshot = null;
      let arrivalMode: 'gps' | 'without_gps' | 'manual' = 'without_gps';

      if (tenantId && assignmentId) {
        const pos = await captureEmployeePortalForegroundPosition(tenantId, assignmentId);
        if (pos.ok) {
          gpsSnapshot = pos.data;
          arrivalMode = 'gps';
        } else {
          const entry = peekEmployeePortalTrackingEntry(tenantId, assignmentId);
          if (entry.geofenceOverrideReason?.trim()) {
            arrivalMode = 'manual';
          }
        }
      }

      return markArrived({
        ctx,
        geofence: tracking?.geofence ?? null,
        gpsSnapshot,
        arrivalMode,
        manualReason: tracking?.geofence?.overrideReason ?? null,
      });
    }) as Promise<MarkArrivedResult>;
  }, [runWorkflow, tenantId, assignmentId, tracking?.geofence]);

  const handleStartService = useCallback(
    () =>
      runWorkflow((ctx) => startService(ctx), {
        timeoutLabel: 'startService',
        loadingMode: 'start_service',
      }),
    [runWorkflow],
  );

  const handleStartPause = useCallback(
    () => runWorkflow((ctx) => startPause(ctx)),
    [runWorkflow],
  );

  const handleEndPause = useCallback(
    () => runWorkflow((ctx) => endPause(ctx)),
    [runWorkflow],
  );

  const handleEndService = useCallback(async () => {
    const result = await runWorkflow((ctx) => endService(ctx));
    if (
      !result.ok &&
      result.errorCode === 'WORKFLOW_SERVICE_NOT_STARTED'
    ) {
      await refreshExecutionContext();
    }
    return result;
  }, [runWorkflow, refreshExecutionContext]);

  const handleSaveTask = useCallback(
    (taskId: string, status: ExtendedAssignmentTaskStatus, note?: string) => {
      taskDrafts.updateTask(taskId, status, note);
      return Promise.resolve({ ok: true as const });
    },
    [taskDrafts],
  );

  const handleSaveDocumentation = useCallback(
    (documentation: EmployeePortalDocumentationInput) =>
      runWorkflow((ctx) => saveVisitDocumentation({ ctx, documentation })),
    [runWorkflow],
  );

  const handleSaveSignature = useCallback(
    (signature: EmployeePortalSignatureCaptureInput) =>
      runWorkflow((ctx) => saveClientSignature({ ctx, signature })),
    [runWorkflow],
  );

  const handleFinalize = useCallback(
    () => runWorkflow((ctx) => finalizeVisit(ctx)),
    [runWorkflow],
  );

  const handleNoShow = useCallback(
    (note: string) => runWorkflow((ctx) => reportNoShow(ctx, note)),
    [runWorkflow],
  );

  const requestLocationPermission = useCallback(async () => {
    const status = await requestEmployeePortalForegroundLocationPermission();
    setGpsPermission(status);
    return status;
  }, []);

  const capturePosition = useCallback(async () => {
    if (!tenantId || !assignmentId) {
      return { ok: false as const, error: 'Keine Einsatz-ID.' };
    }
    const result = await captureEmployeePortalForegroundPosition(tenantId, assignmentId);
    if (result.ok && liveContext?.trackingSessionId) {
      await gpsTracking.captureOnce();
    }
    return result;
  }, [tenantId, assignmentId, liveContext?.trackingSessionId, gpsTracking]);

  const setGeofenceOverride = useCallback(
    (reason: string | null) => {
      if (!tenantId || !assignmentId) return;
      setEmployeePortalGeofenceOverrideReason(tenantId, assignmentId, reason);
    },
    [tenantId, assignmentId],
  );

  const openRoute = useCallback(async () => {
    if (!tenantId || !assignmentId || !employeeId) {
      return { ok: false as const, error: 'Keine Einsatz-ID.' };
    }
    return buildEmployeePortalLiveRoute({
      tenantId,
      employeeId,
      routeParamId: assignmentId,
      roleKey,
      portalAccountId: profile?.id ?? employeeId,
    });
  }, [tenantId, assignmentId, employeeId, roleKey, profile?.id]);

  const consent = useMemo(() => {
    if (!tenantId || !assignmentId) return null;
    if (liveContext?.consentStatus.granted) {
      return {
        granted: true,
        grantedAt: liveContext.consentStatus.grantedAt,
        explainedAt: liveContext.consentStatus.explainedAt,
      };
    }
    return getEmployeePortalLocationConsent(tenantId, assignmentId);
  }, [
    tenantId,
    assignmentId,
    consentRevision,
    liveContext?.consentStatus.granted,
    liveContext?.consentStatus.grantedAt,
    liveContext?.consentStatus.explainedAt,
  ]);

  const refresh = useCallback(async () => {
    await query.refresh();
    await refreshExecutionContext();
  }, [query, refreshExecutionContext]);

  const visitWithAddress = useMemo(() => {
    if (!query.data) return null;
    if (!liveContext?.clientAddress) return query.data;
    return {
      ...query.data,
      locationAddress: liveContext.clientAddress || query.data.locationAddress,
      tasks: taskDrafts.tasks,
    };
  }, [query.data, liveContext?.clientAddress, taskDrafts.tasks]);

  const allowedActions = executionContext?.allowedActions ?? [];

  return {
    data: visitWithAddress,
    executionContext,
    allowedActions,
    diagnostics: executionContext?.diagnostics ?? null,
    derivedStatus: executionContext?.derivedStatus ?? null,
    consistencyStatus: executionContext?.consistencyStatus ?? 'consistent',
    nextActionHint: executionContext?.diagnostics?.repairHint ?? null,
    workflowStep,
    liveContext,
    tracking,
    timers,
    consent,
    gpsPermission,
    gpsTracking,
    loading: query.loading,
    error: query.error ?? liveContextError,
    errorCode: liveErrorCode ?? gpsTracking.state.errorCode,
    liveContextError,
    queryError: query.error,
    actionLoading: workflowLoading,
    startServiceLoading,
    refetchWarning,
    taskSaving: taskDrafts.saving,
    taskSaveError: taskDrafts.saveError,
    refresh,
    grantConsent,
    startDriveTracking,
    markArrived: handleMarkArrived,
    startService: handleStartService,
    startPause: handleStartPause,
    endPause: handleEndPause,
    endService: handleEndService,
    saveTask: handleSaveTask,
    saveDocumentation: handleSaveDocumentation,
    saveSignature: handleSaveSignature,
    finalizeVisit: handleFinalize,
    reportNoShow: handleNoShow,
    requestLocationPermission,
    capturePosition,
    setGeofenceOverride,
    openRoute,
    notFound: !query.loading && !query.error && !query.data,
    hasAssignment: Boolean(query.data),
  };
}
