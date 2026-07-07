/**
 * ASSIST.LIVE.1 — Single source of truth for Assist live employee monitoring.
 * Uses assist_visits (Supabase) + LT.GMAPS persistence tables — same visit list as sidebar KPIs.
 */
import type { RoleKey, ServiceResult, WorkflowStatus } from '@/types';
import type { DayMonitorAssignmentRow } from '@/types/modules/liveMonitor';
import type { EmployeePortalTrackingSnapshot } from '@/types/modules/employeePortalTracking';
import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import type { AssistTrackingSessionRow } from '@/types/assistExecutionPersistence';
import { isAssignmentToday } from '@/data/demo/assistAssignments';
import {
  fetchActiveTrackingSession,
  fetchLatestLocationPointForVisit,
  fetchLatestTrackingSessionWithConsent,
  fetchTimeEventsForVisit,
} from '@/lib/assist/assistTrackingPersistenceService';
import { fetchDayMonitor } from '@/lib/assist/liveMonitorService';
import { listAssignmentWorkflows } from '@/lib/assist/assignmentWorkflowService';
import { buildWorkspaceAccessContext, canViewAssignment } from '@/lib/permissions/workspaceAccess';
import { fetchVisitDispositionList } from '@/lib/assist/visitService';
import { pickAdvancedAssignmentStatus } from '@/lib/assist/visitWorkflow';
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

function shouldUseLiveVisitList(): boolean {
  return getServiceMode() === 'supabase' && Boolean(getSupabaseClient());
}

export type AssistLiveMonitoringRow = DayMonitorAssignmentRow & {
  visitId: string;
  employeeName: string | null;
  clientName: string | null;
  tracking: EmployeePortalTrackingSnapshot | null;
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
  consentPendingCount: number;
  gpsDeniedCount: number;
  mapMarkers: AssistLiveMapMarker[];
  readOnlyNotice: string;
};

const READ_ONLY_NOTICE =
  'Live-Tracking wird ausschließlich im Mitarbeiterportal gestartet. Assist/Office sieht den Status — startet kein GPS.';

function workflowToAssignmentStatus(status: WorkflowStatus): AssignmentStatus {
  switch (status) {
    case 'entwurf':
      return 'geplant';
    case 'aktiv':
      return 'unterwegs';
    case 'in_bearbeitung':
      return 'gestartet';
    case 'abgeschlossen':
      return 'abgeschlossen';
    case 'fehlerhaft':
      return 'storniert';
    default:
      return 'geplant';
  }
}

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

function isRunningWorkflowStatus(status: WorkflowStatus): boolean {
  return status === 'aktiv' || status === 'in_bearbeitung';
}

function diffSeconds(fromIso: string, toIso: string): number {
  return Math.max(0, Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 1000));
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
): Promise<EmployeePortalTrackingSnapshot> {
  if (getServiceMode() !== 'supabase') return inMemory;

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
    return inMemory;
  }

  const session = sessionRes.data;
  const visitConsent = visitConsentRes.data;
  const point = pointRes.data;
  const events = eventsRes.data;
  const employeeConsent = employeeConsentRes.data;

  const trackingActive = session?.isActive ?? inMemory.trackingActive;
  const lastPosition =
    point != null
      ? {
          latitude: point.latitude,
          longitude: point.longitude,
          accuracyMeters: point.accuracyMeters,
          capturedAt: point.recordedAt,
        }
      : inMemory.lastPosition;

  const driveStart =
    events.find((e) => e.eventType === 'drive_start')?.occurredAt ?? inMemory.timers.driveStartedAt;
  const serviceStart =
    events.find((e) => e.eventType === 'service_start')?.occurredAt ?? inMemory.timers.serviceStartedAt;
  const arriveAt = events.find((e) => e.eventType === 'arrive')?.occurredAt ?? null;
  const nowIso = new Date().toISOString();

  let driveSeconds = inMemory.timers.driveSeconds;
  if (driveStart) {
    const driveEnd = arriveAt ?? (status === 'unterwegs' ? nowIso : null);
    if (driveEnd) driveSeconds = diffSeconds(driveStart, driveEnd);
  }

  let serviceSeconds = inMemory.timers.serviceSeconds;
  if (serviceStart) {
    const serviceEndEvent = events.find((e) => e.eventType === 'service_end')?.occurredAt;
    const serviceEnd = serviceEndEvent ?? (status === 'gestartet' ? nowIso : null);
    if (serviceEnd) serviceSeconds = diffSeconds(serviceStart, serviceEnd);
  }

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
    (status === 'unterwegs' || status === 'angekommen' || status === 'gestartet') &&
    Boolean(lastPosition);

  const warnings = rebuildEmployeePortalTrackingWarnings(
    consent,
    gpsPermission,
    inMemory.warnings,
  );

  return {
    ...inMemory,
    consent,
    trackingActive,
    lastPosition,
    assistVisible,
    clientPortalVisible: false,
    warnings,
    timers: {
      ...inMemory.timers,
      driveSeconds,
      serviceSeconds,
      driveStartedAt: driveStart,
      serviceStartedAt: serviceStart,
    },
  };
}

function mapMonitorRowToMonitoringRow(
  row: DayMonitorAssignmentRow,
  employeeName: string | null,
  clientName: string | null,
  tracking: EmployeePortalTrackingSnapshot | null,
): AssistLiveMonitoringRow {
  return {
    ...row,
    visitId: row.assignmentId,
    employeeName,
    clientName,
    tracking,
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
      const tracking = await enrichTrackingFromPersistence(
        tenantId,
        row.assignmentId,
        row.assignmentId,
        row.employeeId,
        row.status,
        gpsPermission,
        inMemory,
      );
      return mapMonitorRowToMonitoringRow(row, null, null, tracking);
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
      fallbackStatus: row.status,
    })),
  );

  return rows.map((row) => {
    const snapshot = snapshots.get(row.assignmentId);
    if (!snapshot) return row;

    const status = pickAdvancedAssignmentStatus(
      row.status as AssignmentStatus,
      snapshot.assignmentStatus,
    );
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

function computeRunningCount(rows: AssistLiveMonitoringRow[], visitWorkflowStatuses?: WorkflowStatus[]): number {
  if (visitWorkflowStatuses?.length) {
    return visitWorkflowStatuses.filter(isRunningWorkflowStatus).length;
  }
  return rows.filter((row) => {
    const s = row.status;
    return (
      s === 'unterwegs' ||
      s === 'angekommen' ||
      s === 'gestartet' ||
      s === 'pausiert' ||
      s === 'beendet' ||
      s === 'dokumentation_offen' ||
      s === 'unterschrift_offen'
    );
  }).length;
}

export async function getAssistLiveMonitoring(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<AssistLiveMonitoringOverview>> {
  let rowsResult: ServiceResult<AssistLiveMonitoringRow[]>;
  let visitWorkflowStatuses: WorkflowStatus[] | undefined;

  if (shouldUseLiveVisitList()) {
    const visitsResult = await fetchVisitDispositionList(tenantId, actorRoleKey);
    if (!visitsResult.ok) return visitsResult;

    const todayVisits = visitsResult.data.filter((item) => isAssignmentToday(item.scheduledStart));
    visitWorkflowStatuses = todayVisits.map((item) => item.status);

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
          actualStartAt: null,
          actualEndAt: null,
          delayMinutes: null,
          overrunMinutes: null,
          docStatus: item.isIncomplete ? 'missing' : 'na',
          signatureStatus: 'na',
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
        const tracking = await enrichTrackingFromPersistence(
          tenantId,
          item.id,
          item.id,
          item.employeeId,
          assignmentStatus,
          gpsPermission,
          inMemory,
        );

        return mapMonitorRowToMonitoringRow(baseRow, item.employeeName, item.clientName, tracking);
      }),
    );

    rowsResult = { ok: true, data: rows };
  } else {
    rowsResult = await buildRowsFromDayMonitor(tenantId, actorRoleKey);
  }

  if (!rowsResult.ok) return rowsResult;

  const rows = await enrichLiveMonitorRowsFromExecutionSnapshots(tenantId, rowsResult.data);
  const todayCount = rows.length;
  const runningCount = computeRunningCount(rows, visitWorkflowStatuses);
  const activeTrackingCount = rows.filter((r) => r.tracking?.trackingActive).length;
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
      consentPendingCount,
      gpsDeniedCount,
      mapMarkers,
      readOnlyNotice: READ_ONLY_NOTICE,
    },
  };
}

export function formatTimerSeconds(seconds: number | null): string {
  if (seconds == null) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
