/**
 * ASSIST.LIVE.1 — Single source of truth for Assist live employee monitoring.
 * Uses assist_visits (Supabase) + LT.GMAPS persistence tables — same visit list as sidebar KPIs.
 */
import type { RoleKey, ServiceResult } from '@/types';
import type { DayMonitorAssignmentRow } from '@/types/modules/liveMonitor';
import type { EmployeePortalTrackingSnapshot } from '@/types/modules/employeePortalTracking';
import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import type { AssistTrackingSessionRow } from '@/types/assistExecutionPersistence';
import { isAssignmentToday } from '@/data/demo/assistAssignments';
import {
  fetchActiveTrackingSession,
  fetchLocationPointsForVisit,
  fetchLatestLocationPointForVisit,
  fetchLatestTrackingSessionWithConsent,
  fetchTimeEventsForVisit,
} from '@/lib/assist/assistTrackingPersistenceService';
import { fetchDayMonitor } from '@/lib/assist/liveMonitorService';
import { listAssignmentWorkflows } from '@/lib/assist/assignmentWorkflowService';
import { buildWorkspaceAccessContext, canViewAssignment } from '@/lib/permissions/workspaceAccess';
import { fetchVisitDispositionList } from '@/lib/assist/visitService';
import { resolveAssignmentStatusFromExecutionContext } from '@/lib/assist/visitWorkflow';
import { calculateVisitTimes } from '@/features/assistWorkflow/calculateVisitTimes';
import { DAY_MONITOR_STATUS_COLORS } from '@/types/modules/liveMonitor';
import {
  buildEmployeePortalTrackingSnapshot,
  getEmployeePortalGpsPermissionStatus,
  rebuildEmployeePortalTrackingWarnings,
} from '@/lib/portal/employeePortalVisitTrackingService';
import type { EmployeePortalLocationConsent } from '@/types/modules/employeePortalTracking';
import { fetchEmployeeLocationConsentRecord } from '@/features/liveTracking/employeeLocationConsentPersistence';
import { getServiceMode } from '@/lib/services/mode';
import { fetchAssignmentExecutionSnapshotBatch } from '@/lib/assist/resolveAssignmentExecutionSnapshot';
import { getSupabaseClient } from '@/lib/supabase/client';
import { resolveLiveVisitId } from '@/features/liveTracking/resolveLiveAssignment';
import type { AssistLiveRoutePoint } from '@/lib/assist/assistMapProvider';
import { parseGoogleRouteReference } from '@/features/liveTracking/googleRouteReference';
import { reconcileAssistLiveRouteGaps } from '@/features/liveTracking/reconcileAssistLiveRouteGaps';
import { lastItem, leftPad } from '@/lib/runtime/runtimeSafeCollections';

function shouldUseLiveVisitList(): boolean {
  return getServiceMode() === 'supabase' && Boolean(getSupabaseClient());
}

export type AssistLiveMonitoringRow = DayMonitorAssignmentRow & {
  visitId: string;
  employeeName: string | null;
  clientName: string | null;
  tracking: EmployeePortalTrackingSnapshot | null;
  route: AssistLiveRouteSummary | null;
};

export type AssistLiveRouteSummary = {
  points: AssistLiveRoutePoint[];
  /** Separate, continuous GPS traces. Signal gaps are never bridged visually. */
  segments: AssistLiveRoutePoint[][];
  pointCount: number;
  acceptedPointCount: number;
  acceptedMovementCount: number;
  stationaryPointCount: number;
  gapCount: number;
  maxGapSeconds: number;
  totalDistanceKm: number;
  measuredDistanceKm: number;
  googleGapDistanceKm: number;
  resolvedGapCount: number;
  unresolvedGapCount: number;
  distanceStatus: 'measured' | 'google_reconciled' | 'incomplete';
  walkingDistanceKm: number;
  cyclingDistanceKm: number;
  drivingDistanceKm: number;
  durationSeconds: number;
  movementDurationSeconds: number;
  currentSpeedKmh: number | null;
  averageSpeedKmh: number | null;
  startedAt: string | null;
  updatedAt: string | null;
  discardedPointCount: number;
};

export type AssistLiveMapMarker = {
  id: string;
  latitude: number;
  longitude: number;
  label: string;
  subtitle?: string;
  capturedAt: string;
  accuracyMeters: number | null;
};

export type AssistLiveMonitoringOverview = {
  rows: AssistLiveMonitoringRow[];
  todayCount: number;
  runningCount: number;
  activeTrackingCount: number;
  freshGpsCount: number;
  consentPendingCount: number;
  gpsDeniedCount: number;
  mapMarkers: AssistLiveMapMarker[];
  readOnlyNotice: string;
  generatedAt: string;
};

const READ_ONLY_NOTICE =
  'Live-Verfolgung läuft im Mitarbeiterportal während der gesamten aktiven Anfahrt und des Einsatzes. Assist/Office empfängt die Position fortlaufend — startet selbst kein GPS.';

function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const radiusMeters = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return 2 * radiusMeters * Math.asin(Math.sqrt(a));
}

/**
 * Builds auditable route metrics from device points. Accuracy outliers,
 * implausible speeds and long signal gaps are excluded from kilometre totals.
 * Movement categories are GPS estimates, not employee declarations.
 */
export function buildAssistLiveRouteSummary(
  rawPoints: AssistLiveRoutePoint[],
): AssistLiveRouteSummary {
  const candidatePoints = rawPoints
    .filter((point) =>
      Number.isFinite(point.latitude) &&
      Number.isFinite(point.longitude) &&
      Math.abs(point.latitude) <= 90 &&
      Math.abs(point.longitude) <= 180 &&
      (point.accuracyMeters == null || point.accuracyMeters <= 120) &&
      Number.isFinite(new Date(point.capturedAt).getTime()),
    )
    .sort(
      (left, right) =>
        new Date(left.capturedAt).getTime() - new Date(right.capturedAt).getTime(),
    );

  let totalMeters = 0;
  let walkingMeters = 0;
  let cyclingMeters = 0;
  let drivingMeters = 0;
  let discardedPointCount = rawPoints.length - candidatePoints.length;
  let acceptedMovementCount = 0;
  let stationaryPointCount = 0;
  let gapCount = 0;
  let maxGapSeconds = 0;
  let movementDurationSeconds = 0;
  let lastAcceptedSpeedKmh: number | null = null;
  const acceptedPoints: AssistLiveRoutePoint[] = [];
  const segments: AssistLiveRoutePoint[][] = [];
  let currentSegment: AssistLiveRoutePoint[] = [];
  let previousAccepted: AssistLiveRoutePoint | null = null;

  const finishSegment = () => {
    if (currentSegment.length >= 2) segments.push(currentSegment);
    currentSegment = [];
  };

  for (const current of candidatePoints) {
    if (!previousAccepted) {
      acceptedPoints.push(current);
      currentSegment = [current];
      previousAccepted = current;
      continue;
    }

    const previous = previousAccepted;
    const elapsedSeconds =
      (new Date(current.capturedAt).getTime() - new Date(previous.capturedAt).getTime()) / 1000;
    const distanceMeters = haversineMeters(
      previous.latitude,
      previous.longitude,
      current.latitude,
      current.longitude,
    );

    if (elapsedSeconds <= 0) {
      discardedPointCount += 1;
      continue;
    }

    if (elapsedSeconds > 300) {
      gapCount += 1;
      maxGapSeconds = Math.max(maxGapSeconds, Math.round(elapsedSeconds));
      finishSegment();
      acceptedPoints.push(current);
      currentSegment = [current];
      previousAccepted = current;
      continue;
    }

    if (distanceMeters < 4) {
      stationaryPointCount += 1;
      acceptedPoints.push(current);
      currentSegment.push(current);
      previousAccepted = current;
      continue;
    }

    const speedKmh = (distanceMeters / elapsedSeconds) * 3.6;
    if (!Number.isFinite(speedKmh) || speedKmh > 180) {
      discardedPointCount += 1;
      continue;
    }

    acceptedPoints.push(current);
    currentSegment.push(current);
    previousAccepted = current;
    acceptedMovementCount += 1;
    movementDurationSeconds += elapsedSeconds;
    totalMeters += distanceMeters;
    lastAcceptedSpeedKmh = speedKmh;
    if (speedKmh <= 8) walkingMeters += distanceMeters;
    else if (speedKmh <= 25) cyclingMeters += distanceMeters;
    else drivingMeters += distanceMeters;
  }

  finishSegment();

  const startedAt = candidatePoints[0]?.capturedAt ?? null;
  const updatedAt = lastItem(candidatePoints)?.capturedAt ?? null;
  const durationSeconds = startedAt && updatedAt
    ? Math.max(0, Math.round((new Date(updatedAt).getTime() - new Date(startedAt).getTime()) / 1000))
    : 0;
  const averageSpeedKmh = movementDurationSeconds > 0
    ? (totalMeters / movementDurationSeconds) * 3.6
    : null;

  return {
    points: acceptedPoints,
    segments,
    pointCount: candidatePoints.length,
    acceptedPointCount: acceptedPoints.length,
    acceptedMovementCount,
    stationaryPointCount,
    gapCount,
    maxGapSeconds,
    totalDistanceKm: totalMeters / 1000,
    measuredDistanceKm: totalMeters / 1000,
    googleGapDistanceKm: 0,
    resolvedGapCount: 0,
    unresolvedGapCount: gapCount,
    distanceStatus: gapCount > 0 ? 'incomplete' : 'measured',
    walkingDistanceKm: walkingMeters / 1000,
    cyclingDistanceKm: cyclingMeters / 1000,
    drivingDistanceKm: drivingMeters / 1000,
    durationSeconds,
    movementDurationSeconds: Math.round(movementDurationSeconds),
    currentSpeedKmh: lastAcceptedSpeedKmh,
    averageSpeedKmh,
    startedAt,
    updatedAt,
    discardedPointCount,
  };
}

type PersistedTrackingEnrichment = {
  tracking: EmployeePortalTrackingSnapshot;
  route: AssistLiveRouteSummary | null;
};

function fallbackDisplayStatus(status: AssignmentStatus): DayMonitorAssignmentRow['displayStatus'] {
  const map: Partial<Record<AssignmentStatus, DayMonitorAssignmentRow['displayStatus']>> = {
    geplant: 'geplant',
    bestaetigt: 'geplant',
    unterwegs: 'unterwegs',
    angekommen: 'angekommen',
    gestartet: 'gestartet',
    pausiert: 'pausiert',
    beendet: 'beendet',
    dokumentation_offen: 'doku_fehlt',
    unterschrift_offen: 'signatur_fehlt',
    abgeschlossen: 'abgeschlossen',
    storniert: 'abgesagt',
    nicht_erschienen: 'nicht_angetroffen',
  };
  return map[status] ?? 'geplant';
}

function latestEventAt(
  events: { eventType: string; occurredAt: string }[],
  types: string[],
  after?: string | null,
): string | null {
  const afterMs = after ? new Date(after).getTime() : Number.NEGATIVE_INFINITY;
  const matchingEvents = events
      .filter(
        (event) =>
          types.includes(event.eventType) &&
          new Date(event.occurredAt).getTime() >= afterMs,
      )
      .map((event) => event.occurredAt)
      .sort((left, right) => new Date(left).getTime() - new Date(right).getTime());
  return lastItem(matchingEvents) ?? null;
}

function resolveTrackingStatusFromEvents(
  status: AssignmentStatus,
  events: { eventType: string; occurredAt: string }[],
): AssignmentStatus {
  const driveStart = latestEventAt(events, ['drive_start']);
  const driveEnd = driveStart ? latestEventAt(events, ['drive_end', 'arrive'], driveStart) : null;
  const serviceStart = latestEventAt(events, ['service_start']);
  const serviceEnd = serviceStart ? latestEventAt(events, ['service_end'], serviceStart) : null;

  if (serviceStart && !serviceEnd) return status === 'pausiert' ? 'pausiert' : 'gestartet';
  if (driveStart && !driveEnd) return 'unterwegs';
  return status;
}

function resolvePersistedConsent(
  session: AssistTrackingSessionRow | null,
  visitConsent: AssistTrackingSessionRow | null,
  employeeConsent: EmployeePortalLocationConsent | null,
  trackingActive: boolean,
  hasLocation: boolean,
  inMemory: EmployeePortalLocationConsent,
): EmployeePortalLocationConsent {
  if (session?.consentGrantedAt) {
    return {
      granted: true,
      grantedAt: session.consentGrantedAt,
      explainedAt: session.consentExplainedAt,
    };
  }
  if (visitConsent?.consentGrantedAt) {
    return {
      granted: true,
      grantedAt: visitConsent.consentGrantedAt,
      explainedAt: visitConsent.consentExplainedAt,
    };
  }
  if (employeeConsent?.granted) {
    return employeeConsent;
  }
  if (trackingActive && hasLocation) {
    return { granted: true, grantedAt: null, explainedAt: null };
  }
  return inMemory;
}

function isConsentPendingForMonitoring(row: AssistLiveMonitoringRow): boolean {
  const tracking = row.tracking;
  if (!tracking) return false;
  if (tracking.consent.granted) return false;
  if (tracking.trackingActive && tracking.lastPosition) return false;
  return true;
}

async function enrichTrackingFromPersistence(
  tenantId: string,
  visitId: string,
  assignmentId: string,
  employeeId: string | null,
  status: AssignmentStatus,
  gpsPermission: EmployeePortalTrackingSnapshot['gpsPermission'],
  inMemory: EmployeePortalTrackingSnapshot,
): Promise<PersistedTrackingEnrichment> {
  if (getServiceMode() !== 'supabase') return { tracking: inMemory, route: null };

  const resolvedVisitId = await resolveLiveVisitId(tenantId, visitId);
  const persistenceVisitId = resolvedVisitId ?? visitId;

  const [sessionRes, visitConsentRes, pointRes, eventsRes, employeeConsentRes] = await Promise.all([
    fetchActiveTrackingSession(tenantId, persistenceVisitId),
    fetchLatestTrackingSessionWithConsent(tenantId, persistenceVisitId),
    fetchLatestLocationPointForVisit(tenantId, persistenceVisitId),
    fetchTimeEventsForVisit(tenantId, persistenceVisitId),
    employeeId
      ? fetchEmployeeLocationConsentRecord(tenantId, employeeId)
      : Promise.resolve({ ok: true as const, data: null }),
  ]);

  if (!sessionRes.ok || !visitConsentRes.ok || !pointRes.ok || !eventsRes.ok || !employeeConsentRes.ok) {
    return { tracking: inMemory, route: null };
  }

  const session = sessionRes.data;
  const visitConsent = visitConsentRes.data;
  const point = pointRes.data;
  const events = eventsRes.data;
  const employeeConsent = employeeConsentRes.data;
  const routeRes = await fetchLocationPointsForVisit(
    tenantId,
    persistenceVisitId,
    session?.id ?? visitConsent?.id ?? null,
  );
  const routePoint = routeRes.ok ? (lastItem(routeRes.data) ?? null) : null;
  const persistedPoint = routePoint ?? point;

  const trackingActive = session?.isActive ?? inMemory.trackingActive;
  const lastPosition =
    persistedPoint != null
      ? {
          latitude: persistedPoint.latitude,
          longitude: persistedPoint.longitude,
          accuracyMeters: persistedPoint.accuracyMeters,
          capturedAt: persistedPoint.recordedAt,
        }
      : inMemory.lastPosition;

  const trackingStatus = resolveTrackingStatusFromEvents(status, events);
  const persistedTimers =
    events.length > 0
      ? calculateVisitTimes(
          events.map((event) => ({
            eventType: event.eventType,
            occurredAt: event.occurredAt,
          })),
          trackingStatus,
        )
      : null;

  const consent = resolvePersistedConsent(
    session,
    visitConsent,
    employeeConsent,
    trackingActive,
    Boolean(lastPosition),
    inMemory.consent,
  );

  const assistVisible =
    trackingActive &&
    (trackingStatus === 'unterwegs' ||
      trackingStatus === 'angekommen' ||
      trackingStatus === 'gestartet' ||
      trackingStatus === 'pausiert') &&
    Boolean(lastPosition);

  const warnings = rebuildEmployeePortalTrackingWarnings(
    consent,
    persistedPoint ? 'granted' : trackingActive ? 'undetermined' : gpsPermission,
    inMemory.warnings,
  );

  let route: AssistLiveRouteSummary | null = null;
  if (routeRes.ok && routeRes.data.length > 0) {
    const measured = buildAssistLiveRouteSummary(routeRes.data.map((routePoint) => ({
      latitude: routePoint.latitude,
      longitude: routePoint.longitude,
      capturedAt: routePoint.recordedAt,
      accuracyMeters: routePoint.accuracyMeters,
    })));
    const gapRecovery = measured.gapCount > 0
      ? await reconcileAssistLiveRouteGaps(tenantId, measured.segments)
      : null;
    const googleGapDistanceKm = gapRecovery?.googleGapDistanceKm ?? 0;
    const resolvedGapCount = gapRecovery?.resolvedGapCount ?? 0;
    const unresolvedGapCount = Math.max(
      measured.gapCount - resolvedGapCount,
      gapRecovery?.unresolvedGapCount ?? measured.gapCount,
    );
    route = {
      ...measured,
      measuredDistanceKm: measured.totalDistanceKm,
      googleGapDistanceKm,
      resolvedGapCount,
      unresolvedGapCount,
      totalDistanceKm: measured.totalDistanceKm + googleGapDistanceKm,
      distanceStatus:
        unresolvedGapCount > 0
          ? 'incomplete'
          : googleGapDistanceKm > 0
            ? 'google_reconciled'
            : 'measured',
    };
  }

  return {
    tracking: {
      ...inMemory,
      consent,
      gpsPermission: persistedPoint ? 'granted' : trackingActive ? 'undetermined' : gpsPermission,
      trackingActive,
      deviceHeartbeatAt: session?.updatedAt ?? null,
      lastPosition,
      googleRouteReference: parseGoogleRouteReference((session ?? visitConsent)?.metadata),
      assistVisible,
      clientPortalVisible: false,
      warnings,
      timers: {
        ...inMemory.timers,
        driveSeconds: persistedTimers?.driveSeconds ?? inMemory.timers.driveSeconds,
        serviceSeconds: persistedTimers?.serviceSeconds ?? inMemory.timers.serviceSeconds,
        pauseSeconds: persistedTimers?.pauseSeconds ?? inMemory.timers.pauseSeconds,
        activeTimer: persistedTimers?.activeTimer ?? inMemory.timers.activeTimer,
        driveStartedAt: persistedTimers?.driveStartedAt ?? inMemory.timers.driveStartedAt,
        serviceStartedAt: persistedTimers?.serviceStartedAt ?? inMemory.timers.serviceStartedAt,
        pauseStartedAt: persistedTimers?.pauseStartedAt ?? inMemory.timers.pauseStartedAt,
      },
    },
    route,
  };
}

function mapMonitorRowToMonitoringRow(
  row: DayMonitorAssignmentRow,
  employeeName: string | null,
  clientName: string | null,
  tracking: EmployeePortalTrackingSnapshot | null,
  route: AssistLiveRouteSummary | null,
): AssistLiveMonitoringRow {
  return {
    ...row,
    visitId: row.assignmentId,
    employeeName,
    clientName,
    tracking,
    route,
  };
}

async function buildRowsFromDayMonitor(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<AssistLiveMonitoringRow[]>> {
  const monitor = fetchDayMonitor(tenantId, actorRoleKey);

  let baseRows: DayMonitorAssignmentRow[];
  if (monitor.ok) {
    baseRows = monitor.data;
  } else {
    const ctx = buildWorkspaceAccessContext({
      tenantId,
      roleKey: actorRoleKey ?? null,
      userId: 'assist-live-view',
    });

    baseRows = listAssignmentWorkflows(tenantId)
      .filter((a) => isAssignmentToday(a.plannedStartAt))
      .filter((a) =>
        canViewAssignment(ctx, {
          tenantId: a.tenantId,
          employeeId: a.employeeId ?? '',
          clientId: a.clientId,
        }).allowed,
      )
      .map((record) => {
        const displayStatus = fallbackDisplayStatus(record.status);
        return {
          assignmentId: record.id,
          tenantId: record.tenantId,
          title: record.title,
          employeeId: record.employeeId,
          clientId: record.clientId,
          status: record.status,
          canonicalStatus: record.canonicalStatus,
          displayStatus,
          statusColor: DAY_MONITOR_STATUS_COLORS[displayStatus],
          plannedStartAt: record.plannedStartAt,
          plannedEndAt: record.plannedEndAt,
          actualStartAt: record.actualStartAt,
          actualEndAt: record.actualEndAt,
          delayMinutes: null,
          overrunMinutes: null,
          docStatus: 'na',
          signatureStatus: 'na',
          problemStatus: 'none',
          cancelRequest: false,
          rescheduleRequest: false,
        };
      });

    if (baseRows.length === 0 && !monitor.ok) {
      return monitor;
    }
  }

  const gpsPermission = await getEmployeePortalGpsPermissionStatus();
  const rows = await Promise.all(
    baseRows.map(async (row) => {
      const inMemory = buildEmployeePortalTrackingSnapshot(
        tenantId,
        row.assignmentId,
        row.status,
        gpsPermission,
      );
      const enrichment = await enrichTrackingFromPersistence(
        tenantId,
        row.assignmentId,
        row.assignmentId,
        row.employeeId,
        row.status,
        gpsPermission,
        inMemory,
      );
      return mapMonitorRowToMonitoringRow(row, null, null, enrichment.tracking, enrichment.route);
    }),
  );

  return { ok: true, data: rows };
}

function buildMapMarkers(rows: AssistLiveMonitoringRow[]): AssistLiveMapMarker[] {
  return rows
    .filter((row) => row.tracking?.lastPosition)
    .map((row) => ({
      id: row.assignmentId,
      latitude: row.tracking!.lastPosition!.latitude,
      longitude: row.tracking!.lastPosition!.longitude,
      label: row.title,
      subtitle: row.tracking?.trackingActive ? 'Live-Tracking aktiv' : undefined,
      capturedAt: row.tracking!.lastPosition!.capturedAt,
      accuracyMeters: row.tracking!.lastPosition!.accuracyMeters,
    }));
}

async function enrichLiveMonitorRowsFromExecutionSnapshots(
  tenantId: string,
  rows: AssistLiveMonitoringRow[],
): Promise<AssistLiveMonitoringRow[]> {
  if (getServiceMode() !== 'supabase' || rows.length === 0) return rows;

  const snapshots = await fetchAssignmentExecutionSnapshotBatch(
    tenantId,
    rows.map((row) => ({
      assignmentId: row.assignmentId,
      visitId: row.visitId ?? row.assignmentId,
      fallbackStatus: row.status as AssignmentStatus,
    })),
  );

  return rows.map((row) => {
    const snapshot = snapshots.get(row.assignmentId);
    if (!snapshot) return row;

    const status = resolveAssignmentStatusFromExecutionContext({
      assignmentStatus: row.status as AssignmentStatus,
      executionStatus: snapshot.executionStatus,
      documentationStatus: snapshot.documentationStatus,
      proofStatus: snapshot.proofStatus ?? undefined,
      hasDocumentation: snapshot.hasDocumentation,
      hasSignature: snapshot.hasSignature,
      serviceEnded: snapshot.serviceEnded,
      executionStateStatus: snapshot.executionStateStatus,
    });
    let docStatus = row.docStatus;
    let signatureStatus = row.signatureStatus;

    if (snapshot.hasDocumentation) {
      docStatus = 'ok';
    } else if (status === 'beendet' || status === 'dokumentation_offen') {
      docStatus = 'missing';
    }

    if (snapshot.hasSignature) {
      signatureStatus = 'ok';
    } else if (status === 'unterschrift_offen') {
      signatureStatus = 'missing';
    }

    const displayStatus = fallbackDisplayStatus(status);
    return {
      ...row,
      status,
      displayStatus,
      statusColor: DAY_MONITOR_STATUS_COLORS[displayStatus],
      docStatus,
      signatureStatus,
    };
  });
}

function computeRunningCount(rows: AssistLiveMonitoringRow[]): number {
  return rows.filter((row) => {
    const s = row.status;
    return (
      s === 'unterwegs' ||
      s === 'angekommen' ||
      s === 'gestartet' ||
      s === 'pausiert'
    );
  }).length;
}

export async function getAssistLiveMonitoring(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<AssistLiveMonitoringOverview>> {
  let rowsResult: ServiceResult<AssistLiveMonitoringRow[]>;

  if (shouldUseLiveVisitList()) {
    const visitsResult = await fetchVisitDispositionList(tenantId, actorRoleKey);
    if (!visitsResult.ok) return visitsResult;

    const todayVisits = visitsResult.data.filter((item) => isAssignmentToday(item.scheduledStart));

    const gpsPermission = await getEmployeePortalGpsPermissionStatus();
    const rows = await Promise.all(
      todayVisits.map(async (item) => {
        const assignmentStatus = item.assignmentStatus;
        const displayStatus = fallbackDisplayStatus(assignmentStatus);

        const baseRow: DayMonitorAssignmentRow = {
          assignmentId: item.id,
          tenantId: item.tenantId,
          title: item.title,
          employeeId: item.employeeId,
          clientId: '',
          status: assignmentStatus,
          canonicalStatus: 'on_the_way',
          displayStatus,
          statusColor: DAY_MONITOR_STATUS_COLORS[displayStatus],
          plannedStartAt: item.scheduledStart,
          plannedEndAt: item.scheduledEnd,
          actualStartAt: item.actualStartAt ?? null,
          actualEndAt: item.actualEndAt ?? null,
          delayMinutes: null,
          overrunMinutes: null,
          docStatus:
            assignmentStatus === 'dokumentation_offen' || assignmentStatus === 'beendet'
              ? 'missing'
              : assignmentStatus === 'abgeschlossen' || assignmentStatus === 'unterschrift_offen'
                ? 'ok'
                : 'na',
          signatureStatus:
            assignmentStatus === 'unterschrift_offen'
              ? 'missing'
              : assignmentStatus === 'abgeschlossen'
                ? 'ok'
                : 'na',
          problemStatus: item.isAtRisk ? 'reported' : 'none',
          cancelRequest: false,
          rescheduleRequest: false,
        };

        const inMemory = buildEmployeePortalTrackingSnapshot(
          tenantId,
          item.id,
          assignmentStatus,
          gpsPermission,
        );
        const enrichment = await enrichTrackingFromPersistence(
          tenantId,
          item.id,
          item.id,
          item.employeeId,
          assignmentStatus,
          gpsPermission,
          inMemory,
        );

        return mapMonitorRowToMonitoringRow(
          baseRow,
          item.employeeName,
          item.clientName,
          enrichment.tracking,
          enrichment.route,
        );
      }),
    );

    rowsResult = { ok: true, data: rows };
  } else {
    rowsResult = await buildRowsFromDayMonitor(tenantId, actorRoleKey);
  }

  if (!rowsResult.ok) return rowsResult;

  const rows = await enrichLiveMonitorRowsFromExecutionSnapshots(tenantId, rowsResult.data);
  const todayCount = rows.length;
  const runningCount = computeRunningCount(rows);
  const activeTrackingCount = rows.filter((r) => r.tracking?.trackingActive).length;
  const freshGpsCount = rows.filter((row) => {
    const capturedAt = row.tracking?.lastPosition?.capturedAt;
    return capturedAt && Date.now() - new Date(capturedAt).getTime() < 150_000;
  }).length;
  const consentPendingCount = rows.filter(isConsentPendingForMonitoring).length;
  const gpsDeniedCount = rows.filter((r) => r.tracking?.gpsPermission === 'denied').length;
  const mapMarkers = buildMapMarkers(rows);

  return {
    ok: true,
    data: {
      rows,
      todayCount,
      runningCount,
      activeTrackingCount,
      freshGpsCount,
      consentPendingCount,
      gpsDeniedCount,
      mapMarkers,
      readOnlyNotice: READ_ONLY_NOTICE,
      generatedAt: new Date().toISOString(),
    },
  };
}

export function formatTimerSeconds(seconds: number | null): string {
  if (seconds == null) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${leftPad(s, 2)}`;
}
