import { useEmployeeGpsTracking } from '@/features/liveTracking/useEmployeeGpsTracking';
import type { EmployeeLiveContext } from '@/features/liveTracking/resolveEmployeeLiveContext';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  EmployeePortalDocumentationInput,
  EmployeePortalSignatureCaptureInput,
} from '@/types/modules/employeePortalExecution';
import type {
  EmployeePortalGpsPermissionStatus,
  EmployeePortalTrackingSnapshot,
} from '@/types/modules/employeePortalTracking';
import type { ExtendedAssignmentTaskStatus } from '@/types/modules/assignmentWorkflow';
import { loadExecutionDetailWithCache } from '@/lib/offline/assignmentCacheService';
import type { AssignmentCacheMeta } from '@/lib/offline/types';
import { useConnectivity } from '@/hooks/useConnectivity';
import { buildEmployeePortalLiveRoute } from '@/features/liveTracking/buildEmployeePortalLiveRoute';
import { saveEmployeeLocationConsent } from '@/features/liveTracking/saveEmployeeLocationConsent';
import { getEmployeeLocationConsent } from '@/features/liveTracking/getEmployeeLocationConsent';
import { fetchEmployeeLocationConsentRecord } from '@/features/liveTracking/employeeLocationConsentPersistence';
import {
  persistInternalLocationConsent,
  requestLocationPermissionOnce,
} from '@/features/employeePermissions';
import {
  buildEmployeePortalTrackingSnapshot,
  captureEmployeePortalForegroundPosition,
  getEmployeePortalGpsPermissionStatus,
  getEmployeePortalLocationConsent,
  grantEmployeePortalLocationConsent,
  applyEmployeePortalLocationConsent,
  markEmployeePortalConsentExplained,
  peekEmployeePortalTrackingEntry,
  rebuildEmployeePortalTrackingWarnings,
  requestEmployeePortalForegroundLocationPermission,
  setEmployeePortalGeofenceOverrideReason,
  computeEmployeePortalLiveTimers,
} from '@/lib/portal/employeePortalVisitTrackingService';
import type { LiveTrackingErrorCode } from '@/features/liveTracking/liveTrackingErrors';
import {
  assignmentStatusToWorkflowStep,
  endPause,
  endService,
  finalizeVisit,
  finalizeVisitWithDeferredClientSignature,
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
  WORKFLOW_CONTEXT_REFRESH_TIMEOUT_MS,
  WORKFLOW_END_SERVICE_TIMEOUT_MS,
  WORKFLOW_MARK_ARRIVED_TIMEOUT_MS,
  WORKFLOW_START_SERVICE_TIMEOUT_MS,
} from '@/features/assistWorkflow/internal/withWorkflowTimeout';
import { isStaleWorkflowTransitionError } from '@/features/assistWorkflow/internal/isStaleWorkflowTransitionError';

function unwrapWorkflowContextPayload(payload: unknown): AssistExecutionContext | null {
  if (!payload || typeof payload !== 'object') return null;

  if (
    'ctx' in payload &&
    payload.ctx &&
    typeof payload.ctx === 'object' &&
    'assignmentStatus' in payload.ctx
  ) {
    return payload.ctx as AssistExecutionContext;
  }

  if ('detail' in payload && 'allowedActions' in payload) {
    return payload as AssistExecutionContext;
  }

  if (
    'ok' in payload &&
    (payload as { ok: boolean }).ok &&
    'data' in payload &&
    (payload as { data?: unknown }).data &&
    typeof (payload as { data: unknown }).data === 'object'
  ) {
    return unwrapWorkflowContextPayload((payload as { data: unknown }).data);
  }

  return null;
}

function resolveRecordedAssignmentStatus(
  detail: import('@/types/modules/employeePortalExecution').EmployeePortalAssignmentDetail,
): AssignmentStatus {
  const normalizedStatus = detail.status;
  if (
    detail.actualEndAt ||
    normalizedStatus === 'beendet' ||
    normalizedStatus === 'dokumentation_offen' ||
    normalizedStatus === 'unterschrift_offen'
  ) {
    return detail.actualEndAt ? 'beendet' : normalizedStatus;
  }
  if (
    detail.actualStartAt ||
    normalizedStatus === 'gestartet' ||
    normalizedStatus === 'pausiert'
  ) {
    return normalizedStatus;
  }
  if (detail.arrivedAt || normalizedStatus === 'angekommen') {
    return 'angekommen';
  }
  if (detail.onTheWayAt || normalizedStatus === 'unterwegs') {
    return 'unterwegs';
  }
  return normalizedStatus;
}

const ASSIGNMENT_STATUS_PROGRESS: Partial<Record<AssignmentStatus, number>> = {
  geplant: 10,
  bestaetigt: 20,
  unterwegs: 30,
  angekommen: 40,
  gestartet: 50,
  pausiert: 55,
  beendet: 60,
  dokumentation_offen: 65,
  unterschrift_offen: 70,
  abgeschlossen: 80,
};

function pickEffectiveAssignmentStatus(
  ...candidates: Array<AssignmentStatus | null | undefined>
): AssignmentStatus | null {
  const ranked = candidates.filter(Boolean) as AssignmentStatus[];
  if (!ranked.length) return null;
  return ranked.reduce((best, current) =>
    (ASSIGNMENT_STATUS_PROGRESS[current] ?? 0) > (ASSIGNMENT_STATUS_PROGRESS[best] ?? 0)
      ? current
      : best,
  );
}

function mergeVisitTimesFromPortalDetail(
  visitTimes: VisitTimesSummary | null,
  detail: import('@/types/modules/employeePortalExecution').EmployeePortalAssignmentDetail,
): VisitTimesSummary | null {
  const hasDetailTimes =
    Boolean(detail.onTheWayAt) ||
    Boolean(detail.arrivedAt) ||
    Boolean(detail.actualStartAt) ||
    Boolean(detail.actualEndAt);
  if (!visitTimes && !hasDetailTimes) return visitTimes;

  const base: VisitTimesSummary =
    visitTimes ??
    ({
      driveSeconds: null,
      serviceSeconds: null,
      pauseSeconds: null,
      totalSeconds: null,
      driveStartedAt: null,
      serviceStartedAt: null,
      pauseStartedAt: null,
      arrivedAt: null,
      serviceEndedAt: null,
      activeTimer: null,
    } satisfies VisitTimesSummary);

  return {
    ...base,
    driveStartedAt: base.driveStartedAt ?? detail.onTheWayAt ?? null,
    arrivedAt: base.arrivedAt ?? detail.arrivedAt ?? null,
    serviceStartedAt: base.serviceStartedAt ?? detail.actualStartAt ?? null,
    serviceEndedAt: base.serviceEndedAt ?? detail.actualEndAt ?? null,
  };
}
import { deriveWorkflowStatus } from '@/features/assistWorkflow/deriveWorkflowStatus';
import { resolveAllowedActions } from '@/features/assistWorkflow/resolveAllowedActions';
import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import type { VisitTimesSummary } from '@/features/assistWorkflow/calculateVisitTimes';

export function useEmployeePortalVisitExecution(assignmentId: string | undefined) {
  const { profile } = useAuth();
  const { tenantId: portalTenantId, employeeId: portalEmployeeId, roleKey: portalRoleKey, actorId } =
    usePortalActor();
  const tenantId = useServiceTenantId() ?? portalTenantId;
  const employeeId = portalEmployeeId ?? profile?.employeeId ?? '';
  const roleKey = portalRoleKey ?? profile?.roleKey ?? null;
  const authProfileId = profile?.id ?? actorId ?? null;
  const { isOffline } = useConnectivity();
  const [cacheMeta, setCacheMeta] = useState<AssignmentCacheMeta>({
    fromCache: false,
    cachedAt: null,
    partialDetail: false,
    cacheSource: 'live',
  });
  const readOnlyExecution = isOffline || cacheMeta.fromCache;

  const [gpsPermission, setGpsPermission] = useState<EmployeePortalGpsPermissionStatus>('undetermined');
  const [liveContext, setLiveContext] = useState<EmployeeLiveContext | null>(null);
  const [executionContext, setExecutionContext] = useState<AssistExecutionContext | null>(null);
  const [liveContextError, setLiveContextError] = useState<string | null>(null);
  const [liveErrorCode, setLiveErrorCode] = useState<LiveTrackingErrorCode | null>(null);
  const [consentRevision, setConsentRevision] = useState(0);
  const [employeeLevelConsent, setEmployeeLevelConsent] = useState<{
    granted: boolean;
    grantedAt: string | null;
    explainedAt: string | null;
  } | null>(null);
  const [workflowLoading, setWorkflowLoading] = useState(false);
  const [startServiceLoading, setStartServiceLoading] = useState(false);
  const [refetchWarning, setRefetchWarning] = useState<string | null>(null);
  const executionContextRef = useRef<AssistExecutionContext | null>(null);
  const skipContextRefreshRef = useRef(false);
  executionContextRef.current = executionContext;

  useEffect(() => {
    if (!tenantId || !assignmentId || !employeeId) return;
    let cancelled = false;
    void (async () => {
      const employeeRecord = await fetchEmployeeLocationConsentRecord(tenantId, employeeId);
      if (cancelled) return;
      if (employeeRecord.ok && employeeRecord.data?.granted) {
        setEmployeeLevelConsent(employeeRecord.data);
        applyEmployeePortalLocationConsent(tenantId, assignmentId, employeeRecord.data);
        setConsentRevision((n) => n + 1);
        return;
      }
      const visitConsent = await getEmployeeLocationConsent({
        tenantId,
        employeeId,
        routeParamId: assignmentId,
        portalAccountId: authProfileId,
        localConsent: getEmployeePortalLocationConsent(tenantId, assignmentId),
      });
      if (cancelled || !visitConsent.ok || !visitConsent.data.granted) return;
      setEmployeeLevelConsent(visitConsent.data);
      applyEmployeePortalLocationConsent(tenantId, assignmentId, visitConsent.data);
      setConsentRevision((n) => n + 1);
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantId, assignmentId, employeeId, authProfileId]);

  useEffect(() => {
    if (!assignmentId) return;
    void getEmployeePortalGpsPermissionStatus().then(setGpsPermission);
  }, [assignmentId]);

  const query = useAsyncQuery(
    async () => {
      if (!tenantId || !assignmentId || !employeeId) {
        return { ok: false as const, error: 'Einsatzdaten unvollständig.' };
      }
      const result = await loadExecutionDetailWithCache(
        tenantId,
        assignmentId,
        employeeId,
        roleKey,
        { preferCache: isOffline },
      );
      setCacheMeta({
        fromCache: result.fromCache,
        cachedAt: result.cachedAt,
        partialDetail: result.partialDetail,
        cacheSource: result.cacheSource,
      });
      return result;
    },
    [tenantId, assignmentId, employeeId, roleKey, isOffline],
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
          profileId: authProfileId,
          roleKey,
        }),
        WORKFLOW_CONTEXT_REFRESH_TIMEOUT_MS,
        'resolveAssistExecutionContext',
      );
      if (!result.ok) {
        setLiveContextError(result.error);
        setRefetchWarning(result.error);
        return executionContextRef.current;
      }

      const currentEndedAt =
        executionContextRef.current?.visitTimes?.serviceEndedAt ??
        executionContextRef.current?.detail.actualEndAt ??
        null;
      const incomingEndedAt =
        result.data.visitTimes?.serviceEndedAt ?? result.data.detail.actualEndAt ?? null;
      const currentRank = pickEffectiveAssignmentStatus(
        currentEndedAt ? 'beendet' : null,
        executionContextRef.current?.derivedStatus,
        executionContextRef.current?.assignmentStatus,
      );
      const incomingRank = pickEffectiveAssignmentStatus(
        incomingEndedAt ? 'beendet' : null,
        result.data.derivedStatus,
        result.data.assignmentStatus,
      );
      if (
        currentRank &&
        incomingRank &&
        (ASSIGNMENT_STATUS_PROGRESS[currentRank] ?? 0) >
          (ASSIGNMENT_STATUS_PROGRESS[incomingRank] ?? 0)
      ) {
        return executionContextRef.current;
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
  }, [tenantId, assignmentId, employeeId, authProfileId, roleKey]);

  useEffect(() => {
    if (!query.data) return;
    if (skipContextRefreshRef.current) {
      skipContextRefreshRef.current = false;
      return;
    }
    void refreshExecutionContext();
  }, [query.data, refreshExecutionContext]);

  const workflowDerived = useMemo(() => {
    if (executionContext) {
      return {
        derivedStatus: executionContext.derivedStatus,
        recordedStatus: executionContext.assignmentStatus,
        consistencyStatus: executionContext.consistencyStatus,
        inconsistencies: executionContext.inconsistencies,
        repairOptions: executionContext.repairOptions,
        canStartService:
          executionContext.derivedStatus === 'angekommen' &&
          Boolean(
            executionContext.visitTimes?.arrivedAt ||
              executionContext.assignmentStatus === 'angekommen',
          ),
        nextActionHint: executionContext.diagnostics.repairHint,
      };
    }
    if (!query.data) return null;
    const visitTimes = mergeVisitTimesFromPortalDetail(null, query.data);
    const recordedStatus = resolveRecordedAssignmentStatus(query.data);
    return deriveWorkflowStatus(recordedStatus, visitTimes);
  }, [executionContext, query.data]);

  const serviceEndedAt =
    executionContext?.visitTimes?.serviceEndedAt ??
    executionContext?.detail.actualEndAt ??
    query.data?.actualEndAt ??
    null;

  const effectiveStatus = pickEffectiveAssignmentStatus(
    serviceEndedAt ? 'beendet' : null,
    executionContext?.derivedStatus,
    executionContext?.assignmentStatus,
    workflowDerived?.derivedStatus,
    workflowDerived?.recordedStatus,
    query.data?.status,
  );

  const liveTrackingEnabled = useMemo(
    () =>
      ['unterwegs', 'angekommen', 'gestartet', 'pausiert'].includes(effectiveStatus ?? '') &&
      Boolean(liveContext?.trackingSessionActive) &&
      Boolean(effectiveStatus),
    [liveContext?.trackingSessionActive, effectiveStatus],
  );

  const gpsTracking = useEmployeeGpsTracking({
    tenantId,
    assistVisitId: liveContext?.assistVisitId ?? null,
    sessionId: liveContext?.trackingSessionId ?? null,
    enabled: liveTrackingEnabled,
    dbSessionActive: liveTrackingEnabled,
  });

  const resolveLocalVisitTimers = useCallback(
    (now: Date) => {
      if (!tenantId || !assignmentId || !effectiveStatus) return null;
      return computeEmployeePortalLiveTimers(tenantId, assignmentId, effectiveStatus, now);
    },
    [tenantId, assignmentId, effectiveStatus],
  );

  const timers = useLiveVisitTimers(
    executionContext?.timeEvents ?? [],
    effectiveStatus,
    executionContext?.visitTimes ?? null,
    Boolean(effectiveStatus),
    resolveLocalVisitTimers,
  );

  const tracking: EmployeePortalTrackingSnapshot | null = useMemo(() => {
    if (!tenantId || !assignmentId || !query.data || !effectiveStatus) return null;
    const base = buildEmployeePortalTrackingSnapshot(
      tenantId,
      assignmentId,
      effectiveStatus,
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
      ['unterwegs', 'angekommen', 'gestartet', 'pausiert'].includes(effectiveStatus) &&
      (liveContext?.trackingSessionActive ||
        gpsTracking.state.trackingActive ||
        gpsTracking.state.dbSessionActive);

    return {
      ...base,
      consent: resolvedConsent,
      warnings: rebuildEmployeePortalTrackingWarnings(resolvedConsent, gpsPermission, base.warnings),
      trackingActive: dbActive ||
        (['unterwegs', 'angekommen', 'gestartet', 'pausiert'].includes(effectiveStatus) && base.trackingActive),
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
  }, [tenantId, assignmentId, query.data, effectiveStatus, gpsPermission, liveContext, gpsTracking.state, timers]);

  const workflowStep: AssistWorkflowStep | null = useMemo(() => {
    if (!query.data || !effectiveStatus) return null;
    return assignmentStatusToWorkflowStep(effectiveStatus);
  }, [query.data, effectiveStatus]);

  const syncAfterWorkflow = useCallback(
    async (ctx: AssistExecutionContext) => {
      const terminalStatuses: AssignmentStatus[] = ['abgeschlossen', 'storniert', 'nicht_erschienen'];
      const isTerminalStatus =
        terminalStatuses.includes(ctx.assignmentStatus) ||
        terminalStatuses.includes(ctx.derivedStatus);
      const terminalStatus: AssignmentStatus | null = isTerminalStatus
        ? terminalStatuses.includes(ctx.assignmentStatus)
          ? ctx.assignmentStatus
          : ctx.derivedStatus
        : null;

      const hasServiceEnded = Boolean(ctx.visitTimes?.serviceEndedAt || ctx.detail.actualEndAt);
      const postServicePhase =
        !isTerminalStatus &&
        (ctx.assignmentStatus === 'dokumentation_offen' ||
          ctx.assignmentStatus === 'unterschrift_offen' ||
          ctx.derivedStatus === 'dokumentation_offen' ||
          ctx.derivedStatus === 'unterschrift_offen');
      const ended =
        isTerminalStatus ||
        hasServiceEnded ||
        ctx.derivedStatus === 'beendet' ||
        ctx.assignmentStatus === 'beendet' ||
        postServicePhase;
      const syncedAssignmentStatus: AssignmentStatus = terminalStatus
        ? terminalStatus
        : postServicePhase
          ? ctx.assignmentStatus === 'unterschrift_offen' || ctx.derivedStatus === 'unterschrift_offen'
            ? 'unterschrift_offen'
            : 'dokumentation_offen'
          : ended
            ? 'beendet'
            : ctx.assignmentStatus;
      const syncedDerivedStatus: AssignmentStatus = terminalStatus
        ? terminalStatus
        : postServicePhase
          ? ctx.derivedStatus === 'unterschrift_offen' || ctx.assignmentStatus === 'unterschrift_offen'
            ? 'unterschrift_offen'
            : 'dokumentation_offen'
          : ended
            ? 'beendet'
            : ctx.derivedStatus;

      let visitTimes = ctx.visitTimes;
      if (ended) {
        const serviceEndedAt =
          visitTimes?.serviceEndedAt ?? ctx.detail.actualEndAt ?? new Date().toISOString();
        visitTimes = visitTimes
          ? { ...visitTimes, serviceEndedAt, activeTimer: null }
          : {
              driveSeconds: null,
              serviceSeconds: null,
              pauseSeconds: null,
              totalSeconds: null,
              driveStartedAt: ctx.detail.onTheWayAt ?? null,
              serviceStartedAt: ctx.detail.actualStartAt ?? null,
              pauseStartedAt: null,
              arrivedAt: ctx.detail.arrivedAt ?? null,
              serviceEndedAt,
              activeTimer: null,
            };
      }

      const liveContext =
        ended && ctx.liveContext
          ? { ...ctx.liveContext, trackingSessionActive: false }
          : ctx.liveContext;

      const synced: AssistExecutionContext = {
        ...(liveContext ? { ...ctx, liveContext } : ctx),
        assignmentStatus: syncedAssignmentStatus,
        derivedStatus: syncedDerivedStatus,
        visitTimes: visitTimes ?? ctx.visitTimes,
        detail: ended
          ? {
              ...ctx.detail,
              status: syncedAssignmentStatus,
              actualEndAt: visitTimes?.serviceEndedAt ?? ctx.detail.actualEndAt,
            }
          : ctx.detail,
      };

      skipContextRefreshRef.current = true;
      setExecutionContext(synced);
      setLiveContext(liveContext);
      query.setData({
        ...synced.detail,
        status: synced.assignmentStatus,
        onTheWayAt: synced.detail.onTheWayAt ?? synced.visitTimes?.driveStartedAt ?? null,
        arrivedAt: synced.detail.arrivedAt ?? synced.visitTimes?.arrivedAt ?? null,
        actualStartAt: synced.detail.actualStartAt ?? synced.visitTimes?.serviceStartedAt ?? null,
        actualEndAt: synced.detail.actualEndAt ?? synced.visitTimes?.serviceEndedAt ?? null,
      });
      return synced;
    },
    [query],
  );

  const runWorkflow = useCallback(
    async <T,>(
      fn: (ctx: AssistExecutionContext) => Promise<{ ok: boolean; data?: T; error?: string; errorCode?: string }>,
      options?: {
        timeoutLabel?: string;
        loadingMode?: 'generic' | 'start_service';
        timeoutMs?: number;
        preferExistingContext?: boolean;
      },
    ): Promise<{ ok: boolean; data?: T; error?: string; errorCode?: string }> => {
      let ctx =
        options?.preferExistingContext && executionContextRef.current
          ? executionContextRef.current
          : null;
      if (!ctx) {
        ctx = await refreshExecutionContext();
      }
      if (!ctx) {
        ctx = executionContext;
      }
      if (!ctx) {
        return { ok: false, error: 'Einsatzkontext fehlt.', errorCode: 'START_SERVICE_CONTEXT_MISSING' };
      }

      const loadingMode = options?.loadingMode ?? 'generic';
      if (loadingMode === 'start_service') setStartServiceLoading(true);
      else setWorkflowLoading(true);

      try {
        const result = await withWorkflowTimeout(
          fn(ctx),
          options?.timeoutMs ??
            (loadingMode === 'start_service'
              ? WORKFLOW_START_SERVICE_TIMEOUT_MS
              : WORKFLOW_ACTION_TIMEOUT_MS),
          options?.timeoutLabel ?? 'workflow',
        );

        if (result.ok) {
          const syncedContext = unwrapWorkflowContextPayload(result.data);
          if (syncedContext) {
            await syncAfterWorkflow(syncedContext);
          } else {
            await refreshExecutionContext();
          }
        } else if (isStaleWorkflowTransitionError(result.error)) {
          const refreshed = await refreshExecutionContext();
          if (refreshed) {
            await syncAfterWorkflow(refreshed);
            return { ok: true, data: refreshed as T };
          }
        }

        return result;
      } catch (error) {
        if (error instanceof WorkflowActionTimeoutError) {
          const recovered = await refreshExecutionContext();
          if (recovered) {
            await syncAfterWorkflow(recovered);
            return { ok: true, data: recovered as T };
          }
          return {
            ok: false,
            error: 'Zeitüberschreitung — bitte erneut versuchen.',
            errorCode: 'START_SERVICE_TIMEOUT',
          };
        }
        return {
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : 'Aktion fehlgeschlagen — bitte erneut versuchen.',
          errorCode: 'WORKFLOW_UNEXPECTED_ERROR',
        };
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
    setEmployeeLevelConsent(local);
    setConsentRevision((n) => n + 1);

    const employeePersisted = await persistInternalLocationConsent(
      tenantId,
      employeeId,
      local.grantedAt ?? new Date().toISOString(),
      local.explainedAt,
    );

    const persisted = await saveEmployeeLocationConsent({
      tenantId,
      employeeId,
      routeParamId: assignmentId,
      profileId: authProfileId,
      consentExplainedAt: local.explainedAt,
      localConsent: local,
    });

    if (!persisted.ok && !employeePersisted.ok) {
      return { ok: false, error: persisted.error ?? employeePersisted.error ?? 'Einwilligung konnte nicht gespeichert werden.' };
    }

    grantEmployeePortalLocationConsent(tenantId, assignmentId);
    setConsentRevision((n) => n + 1);

    setLiveContext((prev) =>
      prev
        ? {
            ...prev,
            consentStatus: {
              granted: true,
              grantedAt: local.grantedAt,
              explainedAt: local.explainedAt,
            },
          }
        : prev,
    );

    await refreshExecutionContext();
    return { ok: true };
  }, [tenantId, assignmentId, employeeId, authProfileId, refreshExecutionContext]);

  const startDriveTracking = useCallback(async (): Promise<{ ok: boolean; error?: string; errorCode?: LiveTrackingErrorCode }> => {
    if (!tenantId || !assignmentId) {
      return { ok: false, error: 'Keine Einsatz-ID.' };
    }

    const consent = getEmployeePortalLocationConsent(tenantId, assignmentId);
    if (!consent.granted) {
      return { ok: false, error: 'Bitte zuerst Standort-Einwilligung bestätigen.', errorCode: 'LIVE_CONSENT_SAVE_FAILED' };
    }

    const perm = await requestLocationPermissionOnce(tenantId, employeeId);
    setGpsPermission(perm);

    let snapshot = null;
    if (perm === 'granted') {
      snapshot = await gpsTracking.captureOnce();
      if (!snapshot) {
        const captured = await captureEmployeePortalForegroundPosition(tenantId, assignmentId);
        if (captured.ok) snapshot = captured.data;
      }
    }

    const now = consent.grantedAt ?? new Date().toISOString();
    const started = await startEnRoute({
      tenantId,
      employeeId,
      assignmentId,
      profileId: authProfileId,
      roleKey,
      consentGrantedAt: now,
      consentExplainedAt: consent.explainedAt,
      gpsSnapshot: snapshot,
      withoutGps: !snapshot,
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
    if (snapshot) {
      await gpsTracking.startWatching();
    }
    return { ok: true };
  }, [tenantId, assignmentId, employeeId, authProfileId, roleKey, gpsTracking, query]);

  const handleMarkArrived = useCallback(async (): Promise<MarkArrivedResult> => {
    const result = (await runWorkflow(async (ctx) => {
      let gpsSnapshot = null;
      let arrivalMode: 'gps' | 'without_gps' | 'manual' = 'without_gps';

      if (tenantId && assignmentId) {
        const pos = await Promise.race([
          captureEmployeePortalForegroundPosition(tenantId, assignmentId),
          new Promise<{ ok: false; error: string }>((resolve) => {
            setTimeout(() => resolve({ ok: false, error: 'GPS timeout' }), 4000);
          }),
        ]);
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
    }, {
      timeoutLabel: 'markArrived',
      timeoutMs: WORKFLOW_MARK_ARRIVED_TIMEOUT_MS,
    })) as MarkArrivedResult;

    return result;
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
    const result = await runWorkflow((ctx) => endService(ctx), {
      timeoutLabel: 'endService',
      timeoutMs: WORKFLOW_END_SERVICE_TIMEOUT_MS,
    });
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
    async (documentation: EmployeePortalDocumentationInput) => {
      const ctx = executionContextRef.current ?? executionContext;
      if (!ctx) {
        return { ok: false, error: 'Einsatzkontext fehlt.' };
      }

      setWorkflowLoading(true);
      try {
        const result = await withWorkflowTimeout(
          saveVisitDocumentation({ ctx, documentation }),
          WORKFLOW_END_SERVICE_TIMEOUT_MS,
          'saveDocumentation',
        );
        if (result.ok) {
          const synced = unwrapWorkflowContextPayload(result.data);
          if (synced) {
            await syncAfterWorkflow(synced);
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
        setWorkflowLoading(false);
      }
    },
    [executionContext, syncAfterWorkflow],
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

  const handleFinalizeDeferred = useCallback(
    () => runWorkflow((ctx) => finalizeVisitWithDeferredClientSignature(ctx)),
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
      portalAccountId: authProfileId,
    });
  }, [tenantId, assignmentId, employeeId, roleKey, authProfileId]);

  const consent = useMemo(() => {
    if (!tenantId || !assignmentId) return null;

    const assignmentConsent = getEmployeePortalLocationConsent(tenantId, assignmentId);
    const granted =
      liveContext?.consentStatus.granted ||
      assignmentConsent.granted ||
      employeeLevelConsent?.granted;

    if (!granted) {
      return assignmentConsent;
    }

    return {
      granted: true as const,
      grantedAt:
        liveContext?.consentStatus.grantedAt ??
        assignmentConsent.grantedAt ??
        employeeLevelConsent?.grantedAt ??
        null,
      explainedAt:
        liveContext?.consentStatus.explainedAt ??
        assignmentConsent.explainedAt ??
        employeeLevelConsent?.explainedAt ??
        null,
    };
  }, [
    tenantId,
    assignmentId,
    consentRevision,
    employeeLevelConsent,
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

  const allowedActions = useMemo(() => {
    if (readOnlyExecution) return [];
    if (executionContext && effectiveStatus) {
      let visitTimes = executionContext.visitTimes;
      const hasServiceEnded = Boolean(
        visitTimes?.serviceEndedAt ??
          executionContext.detail.actualEndAt ??
          query.data?.actualEndAt,
      );
      if (effectiveStatus === 'gestartet' && !visitTimes?.serviceStartedAt && !hasServiceEnded) {
        visitTimes = {
          driveSeconds: visitTimes?.driveSeconds ?? null,
          serviceSeconds: visitTimes?.serviceSeconds ?? null,
          pauseSeconds: visitTimes?.pauseSeconds ?? null,
          totalSeconds: visitTimes?.totalSeconds ?? null,
          driveStartedAt: visitTimes?.driveStartedAt ?? executionContext.detail.onTheWayAt ?? null,
          serviceStartedAt:
            executionContext.detail.actualStartAt ?? new Date().toISOString(),
          pauseStartedAt: visitTimes?.pauseStartedAt ?? null,
          arrivedAt: visitTimes?.arrivedAt ?? executionContext.detail.arrivedAt ?? null,
          serviceEndedAt: visitTimes?.serviceEndedAt ?? null,
          activeTimer: 'service',
        };
      }
      return resolveAllowedActions({
        assignmentStatus: executionContext.assignmentStatus,
        visitTimes,
        detail: {
          ...executionContext.detail,
          status: effectiveStatus,
          actualStartAt: visitTimes?.serviceStartedAt ?? executionContext.detail.actualStartAt,
        },
        derivedStatus: effectiveStatus,
        canStartService:
          effectiveStatus === 'angekommen' &&
          Boolean(
            visitTimes?.arrivedAt || executionContext.assignmentStatus === 'angekommen',
          ),
      });
    }
    if (!query.data || !workflowDerived) return [];
    const visitTimes = mergeVisitTimesFromPortalDetail(null, query.data);
    const recordedStatus = resolveRecordedAssignmentStatus(query.data);
    return resolveAllowedActions({
      assignmentStatus: recordedStatus,
      visitTimes,
      detail: { ...query.data, status: recordedStatus },
      derivedStatus: workflowDerived.derivedStatus,
      canStartService: workflowDerived.canStartService,
    });
  }, [executionContext, effectiveStatus, query.data, workflowDerived, readOnlyExecution]);

  return {
    data: visitWithAddress,
    executionContext,
    allowedActions,
    diagnostics: executionContext?.diagnostics ?? null,
    derivedStatus: workflowDerived?.derivedStatus ?? null,
    effectiveStatus,
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
    finalizeVisitDeferred: handleFinalizeDeferred,
    reportNoShow: handleNoShow,
    requestLocationPermission,
    capturePosition,
    setGeofenceOverride,
    openRoute,
    notFound: !query.loading && !query.error && !query.data,
    hasAssignment: Boolean(query.data),
    isServiceEnded: Boolean(
      serviceEndedAt ||
        (effectiveStatus &&
          (effectiveStatus === 'beendet' ||
            effectiveStatus === 'dokumentation_offen' ||
            effectiveStatus === 'unterschrift_offen')),
    ),
    readOnlyExecution,
    fromCache: cacheMeta.fromCache,
    cachedAt: cacheMeta.cachedAt,
    partialDetail: cacheMeta.partialDetail ?? false,
    cacheSource: cacheMeta.cacheSource ?? 'live',
  };
}
