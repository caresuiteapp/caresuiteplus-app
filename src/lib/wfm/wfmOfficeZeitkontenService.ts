import type { RoleKey, ServiceResult } from '@/types';
import type { WfmOfficeEmployeeTimeAccount, WfmOfficeTimeEntry } from '@/types/modules/wfmOfficeTimekeeping';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { isOpenReviewStatus } from './wfmTimeReviewService';
import { resolveWfmOfficeTimeDisplay } from './wfmOfficeTimeDisplayResolver';
import { getWfmOfficeTimeOverview } from './wfmOfficeTimekeepingService';

export async function getWfmOfficeEmployeeTimeAccounts(
  tenantId: string,
  actorRoleKey: RoleKey | null,
  options?: {
    preset?: import('@/types/modules/wfmOfficeTimekeeping').WfmOfficePeriodPreset;
    fromDate?: string | null;
    toDate?: string | null;
    employeeId?: string | null;
  },
): Promise<ServiceResult<WfmOfficeEmployeeTimeAccount[]>> {
  const denied = enforcePermission(actorRoleKey, 'time.tracking.team.view');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const overview = await getWfmOfficeTimeOverview(tenantId, actorRoleKey, {
    preset: options?.preset ?? 'this_month',
    fromDate: options?.fromDate,
    toDate: options?.toDate,
    filters: options?.employeeId ? { employeeIds: [options.employeeId] } : undefined,
  });
  if (!overview.ok) return overview;

  const byEmployee = new Map<string, WfmOfficeEmployeeTimeAccount>();

  for (const entry of overview.data.entries) {
    const display = resolveWfmOfficeTimeDisplay(entry);
    const bucket =
      byEmployee.get(entry.employeeId) ??
      ({
        employeeId: entry.employeeId,
        employeeName: entry.employeeName,
        plannedMinutes: 0,
        actualMinutes: 0,
        approvedMinutes: 0,
        exportedMinutes: 0,
        saldoMinutes: 0,
        openReviewCount: 0,
        entries: [],
      } satisfies WfmOfficeEmployeeTimeAccount);

    bucket.plannedMinutes += display.plannedDurationMinutes;
    if (display.hasTimeEntry) bucket.actualMinutes += display.timeEntryDurationMinutes;
    if (entry.reviewStatus === 'approved') bucket.approvedMinutes += display.timeEntryDurationMinutes;
    if (entry.exportStatus === 'exported') bucket.exportedMinutes += display.timeEntryDurationMinutes;
    if (isOpenReviewStatus(entry.reviewStatus)) bucket.openReviewCount += 1;
    bucket.entries.push(entry);
    byEmployee.set(entry.employeeId, bucket);
  }

  const accounts = [...byEmployee.values()].map((account) => ({
    ...account,
    saldoMinutes: account.actualMinutes - account.plannedMinutes,
    entries: account.entries.sort((a, b) => b.workDate.localeCompare(a.workDate)),
  }));

  accounts.sort((a, b) => a.employeeName.localeCompare(b.employeeName, 'de'));
  return { ok: true, data: accounts };
}

export function summarizeOfficeTimeAccountKpis(accounts: WfmOfficeEmployeeTimeAccount[]): {
  employees: number;
  plannedHours: number;
  actualHours: number;
  approvedHours: number;
  exportedHours: number;
  openReviews: number;
} {
  const sum = (pick: (a: WfmOfficeEmployeeTimeAccount) => number) =>
    accounts.reduce((acc, row) => acc + pick(row), 0);
  return {
    employees: accounts.length,
    plannedHours: Math.round((sum((a) => a.plannedMinutes) / 60) * 10) / 10,
    actualHours: Math.round((sum((a) => a.actualMinutes) / 60) * 10) / 10,
    approvedHours: Math.round((sum((a) => a.approvedMinutes) / 60) * 10) / 10,
    exportedHours: Math.round((sum((a) => a.exportedMinutes) / 60) * 10) / 10,
    openReviews: sum((a) => a.openReviewCount),
  };
}

export function listOpenReviewEntriesForEmployee(
  account: WfmOfficeEmployeeTimeAccount,
): WfmOfficeTimeEntry[] {
  return account.entries.filter((entry) => isOpenReviewStatus(entry.reviewStatus));
}
