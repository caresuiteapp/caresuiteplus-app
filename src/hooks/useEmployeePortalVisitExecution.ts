import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import type { EmployeePortalAssignmentDetail } from '@/types/modules/employeePortalExecution';
import type {
  EmployeePortalGpsPermissionStatus,
  EmployeePortalLiveTimers,
  EmployeePortalTrackingSnapshot,
} from '@/types/modules/employeePortalTracking';
import {
  buildEmployeePortalRoute,
  fetchEmployeePortalAssignmentDetail,
  transitionEmployeePortalAssignment,
  updateEmployeePortalTask,
} from '@/lib/portal/employeePortalExecutionService';
import {
  persistEmployeePortalLocationConsent,
} from '@/lib/portal/employeePortalVisitTrackingPersistence';
import {
  buildEmployeePortalTrackingSnapshot,
  captureEmployeePortalForegroundPosition,
  computeEmployeePortalLiveTimers,
  getEmployeePortalGpsPermissionStatus,
  getEmployeePortalLocationConsent,
  grantEmployeePortalLocationConsent,
  markEmployeePortalConsentExplained,
  requestEmployeePortalForegroundLocationPermission,
  setEmployeePortalGeofenceOverrideReason,
} from '@/lib/portal/employeePortalVisitTrackingService';
import { fetchTimeEventsForVisit } from '@/lib/assist/assistTrackingPersistenceService';
import { resolveEmployeeLiveContext, type EmployeeLiveContext } from '@/features/liveTracking/resolveEmployeeLiveContext';
import { startEmployeeLiveTracking } from '@/features/liveTracking/startEmployeeLiveTracking';
import { useEmployeeGpsTracking } from '@/features/liveTracking/useEmployeeGpsTracking';
import type { LiveTrackingErrorCode } from '@/features/liveTracking/liveTrackingErrors';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { usePortalActor } from '@/hooks/usePortalActor';
import { subscribeToEmployeePortalChanges } from '@/lib/realtime';
import { LIVE_TRACKING_POLL_MS, useAsyncQuery, useMutation } from './core';

function timersFromTimeEvents(
  events: Array<{ eventType: string; occurredAt: string }>,
  currentStatus: AssignmentStatus,
  now: Date,
): EmployeePortalLiveTimers {
  const nowIso = now.toISOString();
  const byType = (type: string) =>
    events.filter((e) => e.eventType === type).map((e) => e.occurredAt);

  const driveStart = byType('drive_start').at(-1) ?? null;
  const driveEnd = byType('drive_end').at(-1) ?? byType('arrive').at(-1) ?? null;
  const serviceStart = byType('service_start').at(-1) ?? null;
  const serviceEnd = byType('service_end').at(-1) ?? null;

  const diff = (from: string, to: string) =>
    Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 1000));

  let driveSeconds: number | null = null;
  if (driveStart) {
    const end = driveEnd ?? (currentStatus === 'unterwegs' ? nowIso : null);
    if (end) driveSeconds = diff(driveStart, end);
  }

  let pauseSeconds: number | null = null;
  const pauseStarts = byType('pause_start');
  const pauseEnds = byType('pause_end');
  if (pauseStarts.length) {
    pauseSeconds = pauseStarts.reduce((sum, start, idx) => {
      const end = pauseEnds[idx] ?? (currentStatus === 'pausiert' ? nowIso : start);
      return sum + diff(start, end);
    }, 0);
  }

  let serviceSeconds: number | null = null;
  if (serviceStart) {
    const end = serviceEnd ?? (currentStatus === 'gestartet' ? nowIso : null);
    if (end) {
      serviceSeconds = Math.max(0, diff(serviceStart, end) - (pauseSeconds ?? 0));
    }
  }

  let activeTimer: EmployeePortalLiveTimers['activeTimer'] = null;
  if (currentStatus === 'unterwegs') activeTimer = 'drive';
  else if (currentStatus === 'pausiert') activeTimer = 'pause';
  else if (currentStatus === 'gestartet') activeTimer = 'service';

  return {
    driveSeconds,
    serviceSeconds,
    pauseSeconds: pauseSeconds && pauseSeconds > 0 ? pauseSeconds : null,
    activeTimer,
    driveStartedAt: driveStart,
    serviceStartedAt: serviceStart,
    pauseStartedAt:
      currentStatus === 'pausiert' ? (pauseStarts.at(-1) ?? null) : null,
  };
}

export function useEmployeePortalVisitExecution(assignmentId: string | undefined) {
  const { profile } = useAuth();
  const { tenantId: portalTenantId, employeeId: portalEmployeeId, roleKey: portalRoleKey } =
    usePortalActor();
  const tenantId = useServiceTenantId() ?? portalTenantId;
  const employeeId = portalEmployeeId ?? '';
  const roleKey = profile?.roleKey ?? portalRoleKey ?? null;

  const [gpsPermission, setGpsPermission] = useState<EmployeePortalGpsPermissionStatus>('undetermined');
  const [tick, setTick] = useState(0);
  const [liveContext, setLiveContext] = useState<EmployeeLiveContext | null>(null);
  const [liveContextError, setLiveContextError] = useState<string | null>(null);
  const [liveErrorCode, setLiveErrorCode] = useState<LiveTrackingErrorCode | null>(null);
  const [dbTimers, setDbTimers] = useState<EmployeePortalLiveTimers | null>(null);

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

  const refreshLiveContext = useCallback(async () => {
    if (!tenantId || !assignmentId || !employeeId) return null;
    const consent = getEmployeePortalLocationConsent(tenantId, assignmentId);
    const result = await resolveEmployeeLiveContext({
      tenantId,
      employeeId,
      routeParamId: assignmentId,
      portalAccountId: profile?.id ?? employeeId,
      localConsent: consent,
    });
    if (!result.ok) {
      setLiveContextError(result.error);
      setLiveContext(null);
      const code = (result as { errorCode?: LiveTrackingErrorCode }).errorCode;
      if (code) setLiveErrorCode(code);
      return null;
    }
    setLiveContext(result.data);
    setLiveContextError(null);
    setLiveErrorCode(null);

    const events = await fetchTimeEventsForVisit(tenantId, result.data.assistVisitId, 100);
    if (events.ok && events.data.length) {
      setDbTimers(
        timersFromTimeEvents(
          events.data.map((e) => ({ eventType: e.eventType, occurredAt: e.occurredAt })),
          result.data.assignmentStatus,
        ),
      );
    }
    return result.data;
  }, [tenantId, assignmentId, employeeId, profile?.id]);

  useEffect(() => {
    if (!query.data) return;
    void refreshLiveContext();
  }, [query.data, refreshLiveContext]);

  const gpsTracking = useEmployeeGpsTracking({
    tenantId,
    assistVisitId: liveContext?.assistVisitId ?? null,
    sessionId: liveContext?.trackingSessionId ?? null,
    enabled: Boolean(liveContext?.trackingSessionActive),
    dbSessionActive: Boolean(liveContext?.trackingSessionActive),
  });

  const hasData = query.data != null;
  useEffect(() => {
    if (!hasData) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [hasData]);

  const tracking: EmployeePortalTrackingSnapshot | null = useMemo(() => {
    if (!tenantId || !assignmentId || !query.data) return null;
    void tick;
    const base = buildEmployeePortalTrackingSnapshot(
      tenantId,
      assignmentId,
      query.data.status,
      gpsPermission,
    );

    const dbActive =
      liveContext?.trackingSessionActive ||
      gpsTracking.state.trackingActive ||
      gpsTracking.state.dbSessionActive;

    return {
      ...base,
      trackingActive: dbActive || base.trackingActive,
      lastPosition: gpsTracking.state.lastSnapshot
        ? {
            latitude: gpsTracking.state.lastSnapshot.latitude,
            longitude: gpsTracking.state.lastSnapshot.longitude,
            accuracyMeters: gpsTracking.state.lastSnapshot.accuracyMeters,
            capturedAt: gpsTracking.state.lastSnapshot.capturedAt,
          }
        : base.lastPosition,
    };
  }, [
    tenantId,
    assignmentId,
    query.data,
    gpsPermission,
    tick,
    liveContext,
    gpsTracking.state,
  ]);

  const timers = useMemo(() => {
    if (!tenantId || !assignmentId || !query.data) return null;
    void tick;
    if (dbTimers && (dbTimers.driveSeconds != null || dbTimers.serviceSeconds != null)) {
      return dbTimers;
    }
    return computeEmployeePortalLiveTimers(tenantId, assignmentId, query.data.status);
  }, [tenantId, assignmentId, query.data, tick, dbTimers]);

  const statusMutation = useMutation(
    (toStatus: AssignmentStatus) => {
      if (!tenantId || !assignmentId) {
        return Promise.resolve({ ok: false as const, error: 'Keine Einsatz-ID.' });
      }
      return transitionEmployeePortalAssignment(tenantId, assignmentId, employeeId, roleKey, toStatus);
    },
    {
      onSuccess: (detail: EmployeePortalAssignmentDetail) => {
        query.setData(detail);
        void refreshLiveContext();
      },
    },
  );

  const changeStatus = useCallback(
    async (toStatus: AssignmentStatus) => {
      await statusMutation.mutate(toStatus);
    },
    [statusMutation],
  );

  const grantConsent = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    if (!tenantId || !assignmentId) {
      return { ok: false, error: 'Einsatzdaten unvollständig.' };
    }

    const ctx = await resolveEmployeeLiveContext({
      tenantId,
      employeeId,
      routeParamId: assignmentId,
      portalAccountId: profile?.id ?? employeeId,
    });
    if (!ctx.ok) {
      return { ok: false, error: ctx.error };
    }

    markEmployeePortalConsentExplained(tenantId, assignmentId);
    grantEmployeePortalLocationConsent(tenantId, assignmentId);
    const persisted = await persistEmployeePortalLocationConsent({
      tenantId,
      assignmentId,
      employeeId,
      profileId: profile?.id ?? employeeId,
    });

    if (!persisted.ok) {
      return { ok: false, error: persisted.error ?? 'Einwilligung konnte nicht gespeichert werden.' };
    }

    await refreshLiveContext();
    await query.refresh();
    return { ok: true };
  }, [tenantId, assignmentId, employeeId, profile?.id, query, refreshLiveContext]);

  const startDriveTracking = useCallback(async (): Promise<{ ok: boolean; error?: string; errorCode?: LiveTrackingErrorCode }> => {
    if (!tenantId || !assignmentId) {
      return { ok: false, error: 'Keine Einsatz-ID.' };
    }

    const perm = await requestEmployeePortalForegroundLocationPermission();
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

    const started = await startEmployeeLiveTracking({
      tenantId,
      employeeId,
      routeParamId: assignmentId,
      profileId: profile?.id ?? employeeId,
      consentGrantedAt: now,
      consentExplainedAt: consent.explainedAt,
      gpsSnapshot: snapshot,
      transitionToEnRoute: true,
      localConsent: consent,
    });

    if (!started.ok) {
      setLiveErrorCode('LIVE_SESSION_CREATE_FAILED');
      return { ok: false, error: started.error };
    }

    setLiveContext(started.data.context);
    setLiveErrorCode(null);
    await query.refresh();
    await gpsTracking.startWatching();
    return { ok: true };
  }, [tenantId, assignmentId, employeeId, profile?.id, gpsTracking, query]);

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
    if (!tenantId || !assignmentId) {
      return { ok: false as const, error: 'Keine Einsatz-ID.' };
    }
    return buildEmployeePortalRoute(tenantId, assignmentId, employeeId, roleKey);
  }, [tenantId, assignmentId, employeeId, roleKey]);

  const updateTask = useCallback(
    async (taskId: string, status: EmployeePortalAssignmentDetail['tasks'][number]['status'], note?: string) => {
      if (!tenantId || !assignmentId) {
        return { ok: false as const, error: 'Keine Einsatz-ID.' };
      }
      const result = await updateEmployeePortalTask(
        tenantId,
        assignmentId,
        employeeId,
        roleKey,
        taskId,
        status,
        note,
      );
      if (result.ok) query.setData(result.data);
      return result;
    },
    [tenantId, assignmentId, employeeId, roleKey, query],
  );

  const consent = useMemo(
    () =>
      tenantId && assignmentId
        ? getEmployeePortalLocationConsent(tenantId, assignmentId)
        : null,
    [tenantId, assignmentId, tick, liveContext?.consentStatus.granted],
  );

  const refresh = useCallback(async () => {
    await query.refresh();
    await refreshLiveContext();
  }, [query, refreshLiveContext]);

  const visitWithAddress = useMemo(() => {
    if (!query.data) return null;
    if (!liveContext?.clientAddress) return query.data;
    return {
      ...query.data,
      locationAddress: liveContext.clientAddress || query.data.locationAddress,
    };
  }, [query.data, liveContext?.clientAddress]);

  return {
    data: visitWithAddress,
    liveContext,
    tracking,
    timers,
    consent,
    gpsPermission,
    gpsTracking,
    loading: query.loading,
    error: query.error ?? liveContextError ?? statusMutation.error,
    errorCode: liveErrorCode ?? gpsTracking.state.errorCode,
    liveContextError,
    queryError: query.error,
    actionLoading: statusMutation.loading,
    refresh,
    changeStatus,
    grantConsent,
    startDriveTracking,
    requestLocationPermission,
    capturePosition,
    setGeofenceOverride,
    openRoute,
    updateTask,
    notFound: !query.loading && !query.error && !query.data,
    hasAssignment: Boolean(query.data),
  };
}
