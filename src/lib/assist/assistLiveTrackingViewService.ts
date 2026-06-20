import type { RoleKey, ServiceResult } from '@/types';
import type { DayMonitorAssignmentRow } from '@/types/modules/liveMonitor';
import type { EmployeePortalTrackingSnapshot } from '@/types/modules/employeePortalTracking';
import { resolveAssistVisitIdForPersistence } from '@/lib/assist/assistExecutionVisitResolver';
import {
  fetchActiveTrackingSession,
  fetchLatestLocationPointForVisit,
  fetchTimeEventsForVisit,
} from '@/lib/assist/assistTrackingPersistenceService';
import { fetchDayMonitor } from './liveMonitorService';
import { listAssignmentWorkflows } from './assignmentWorkflowService';
import { buildWorkspaceAccessContext, canViewAssignment } from '@/lib/permissions/workspaceAccess';
import { DAY_MONITOR_STATUS_COLORS } from '@/types/modules/liveMonitor';
import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import {
  buildEmployeePortalTrackingSnapshot,
  getEmployeePortalGpsPermissionStatus,
} from '@/lib/portal/employeePortalVisitTrackingService';
import { getServiceMode } from '@/lib/services/mode';

export type AssistLiveStatusRow = DayMonitorAssignmentRow & {
  tracking: EmployeePortalTrackingSnapshot | null;
};

export type AssistLiveStatusOverview = {
  rows: AssistLiveStatusRow[];
  activeTrackingCount: number;
  consentPendingCount: number;
  gpsDeniedCount: number;
  /** Office/Assist darf Tracking nicht starten — nur Anzeige */
  readOnlyNotice: string;
};

const READ_ONLY_NOTICE =
  'Live-Tracking wird ausschließlich im Mitarbeiterportal gestartet. Assist/Office sieht den Status — startet kein GPS.';

function isToday(isoDate: string): boolean {
  const d = new Date(isoDate);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
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

function buildFallbackDayMonitorRows(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): ServiceResult<DayMonitorAssignmentRow[]> {
  const ctx = buildWorkspaceAccessContext({
    tenantId,
    roleKey: actorRoleKey ?? null,
    userId: 'assist-live-view',
  });

  const rows: DayMonitorAssignmentRow[] = listAssignmentWorkflows(tenantId)
    .filter((a) => isToday(a.plannedStartAt))
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

  return { ok: true, data: rows };
}

function diffSeconds(fromIso: string, toIso: string): number {
  return Math.max(0, Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 1000));
}

async function enrichTrackingFromPersistence(
  tenantId: string,
  assignmentId: string,
  status: AssignmentStatus,
  gpsPermission: EmployeePortalTrackingSnapshot['gpsPermission'],
  inMemory: EmployeePortalTrackingSnapshot,
): Promise<EmployeePortalTrackingSnapshot> {
  if (getServiceMode() !== 'supabase') return inMemory;

  const visitId = await resolveAssistVisitIdForPersistence(tenantId, assignmentId);
  if (!visitId) return inMemory;

  const [sessionRes, pointRes, eventsRes] = await Promise.all([
    fetchActiveTrackingSession(tenantId, visitId),
    fetchLatestLocationPointForVisit(tenantId, visitId),
    fetchTimeEventsForVisit(tenantId, visitId),
  ]);

  if (!sessionRes.ok || !pointRes.ok || !eventsRes.ok) {
    return inMemory;
  }

  const session = sessionRes.data;
  const point = pointRes.data;
  const events = eventsRes.data;

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

  const driveStart = events.find((e) => e.eventType === 'drive_start')?.occurredAt ?? inMemory.timers.driveStartedAt;
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

  const consent = session
    ? {
        granted: true,
        grantedAt: session.consentGrantedAt,
        explainedAt: session.consentExplainedAt,
      }
    : inMemory.consent;

  const assistVisible =
    trackingActive && (status === 'unterwegs' || status === 'angekommen') && Boolean(lastPosition);

  return {
    ...inMemory,
    consent,
    trackingActive,
    lastPosition,
    assistVisible,
    clientPortalVisible: false,
    timers: {
      ...inMemory.timers,
      driveSeconds,
      serviceSeconds,
      driveStartedAt: driveStart,
      serviceStartedAt: serviceStart,
    },
  };
}

export async function fetchAssistLiveStatusOverview(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<AssistLiveStatusOverview>> {
  const monitor = fetchDayMonitor(tenantId, actorRoleKey);
  const fallback = buildFallbackDayMonitorRows(tenantId, actorRoleKey);
  const baseRows = monitor.ok ? monitor.data : fallback.ok ? fallback.data : [];

  if (!monitor.ok && !fallback.ok && baseRows.length === 0) {
    return monitor.ok ? monitor : fallback;
  }

  const gpsPermission = await getEmployeePortalGpsPermissionStatus();

  const rows: AssistLiveStatusRow[] = await Promise.all(
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
        row.status,
        gpsPermission,
        inMemory,
      );
      return { ...row, tracking };
    }),
  );

  const activeTrackingCount = rows.filter((r) => r.tracking?.trackingActive).length;
  const consentPendingCount = rows.filter((r) => r.tracking && !r.tracking.consent.granted).length;
  const gpsDeniedCount = rows.filter((r) => r.tracking?.gpsPermission === 'denied').length;

  return {
    ok: true,
    data: {
      rows,
      activeTrackingCount,
      consentPendingCount,
      gpsDeniedCount,
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
