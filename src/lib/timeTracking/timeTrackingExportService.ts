import type { RoleKey, ServiceResult } from '@/types';
import type { TimeWorkday } from '@/types/modules/timeTracking';
import { enforcePermission } from '@/lib/permissions';
import { listActivityEventsForTenant, listEntries, listWarningsForTenant, listWorkdays } from './timeTrackingStore';
import { listTimeAuditLogs } from './timeTrackingAuditService';

export type TimeTrackingExportRow = {
  workDate: string;
  userId: string;
  status: string;
  trafficLight: string;
  blockCount: number;
  totalMinutes: number;
};

export function buildWorkdayExportRows(tenantId: string): TimeTrackingExportRow[] {
  return listWorkdays(tenantId).map((w) => {
    const entries = listEntries(tenantId, w.userId).filter((e) => e.workdayId === w.id);
    const totalMinutes = entries.reduce((sum, e) => sum + (e.netMinutes ?? 0), 0);
    return {
      workDate: w.workDate,
      userId: w.userId,
      status: w.status,
      trafficLight: w.trafficLight ?? '—',
      blockCount: entries.length,
      totalMinutes,
    };
  });
}

export function serializeWorkdayExportCsv(tenantId: string): string {
  const rows = buildWorkdayExportRows(tenantId);
  const header = 'Datum;Benutzer;Status;Ampel;Blöcke;Minuten';
  const body = rows
    .map((r) => `${r.workDate};${r.userId};${r.status};${r.trafficLight};${r.blockCount};${r.totalMinutes}`)
    .join('\n');
  return `${header}\n${body}`;
}

export function exportTimeTrackingSummary(
  tenantId: string,
  actorRoleKey: RoleKey | null,
): ServiceResult<{ csv: string; workdayCount: number; auditCount: number }> {
  const denied = enforcePermission(actorRoleKey, 'time.tracking.admin.export');
  if (denied) return denied;

  return {
    ok: true,
    data: {
      csv: serializeWorkdayExportCsv(tenantId),
      workdayCount: listWorkdays(tenantId).length,
      auditCount: listTimeAuditLogs(tenantId).length,
    },
  };
}

export function fetchAuditDashboardSummary(
  tenantId: string,
  actorRoleKey: RoleKey | null,
): ServiceResult<{
  workdays: TimeWorkday[];
  openCorrections: number;
  warnings: number;
  activityEvents: number;
}> {
  const denied = enforcePermission(actorRoleKey, 'time.audit.view');
  if (denied) return denied;

  const workdays = listWorkdays(tenantId);
  return {
    ok: true,
    data: {
      workdays,
      openCorrections: 0,
      warnings: listWarningsForTenant(tenantId).length,
      activityEvents: listActivityEventsForTenant(tenantId).length,
    },
  };
}

export function buildEmployeeDashboardCards(
  workday: TimeWorkday | null,
  blockCount: number,
): Array<{ id: string; label: string; value: string }> {
  return [
    {
      id: 'status',
      label: 'Heutiger Status',
      value: workday?.status ?? 'Nicht gestartet',
    },
    {
      id: 'blocks',
      label: 'Zeitblöcke heute',
      value: String(blockCount),
    },
    {
      id: 'ampel',
      label: 'Ampel',
      value: workday?.trafficLight ?? '—',
    },
  ];
}
