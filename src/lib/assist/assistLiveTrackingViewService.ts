import type { RoleKey, ServiceResult } from '@/types';
import type { DayMonitorAssignmentRow } from '@/types/modules/liveMonitor';
import type { EmployeePortalTrackingSnapshot } from '@/types/modules/employeePortalTracking';
import { fetchDayMonitor } from './liveMonitorService';
import { listAssignmentWorkflows } from './assignmentWorkflowService';
import { buildWorkspaceAccessContext, canViewAssignment } from '@/lib/permissions/workspaceAccess';
import { DAY_MONITOR_STATUS_COLORS } from '@/types/modules/liveMonitor';
import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import {
  buildEmployeePortalTrackingSnapshot,
  getEmployeePortalGpsPermissionStatus,
} from '@/lib/portal/employeePortalVisitTrackingService';

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

  const rows: AssistLiveStatusRow[] = baseRows.map((row) => ({
    ...row,
    tracking: buildEmployeePortalTrackingSnapshot(
      tenantId,
      row.assignmentId,
      row.status,
      gpsPermission,
    ),
  }));

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
