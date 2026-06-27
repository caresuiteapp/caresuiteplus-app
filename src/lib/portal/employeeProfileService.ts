import type { RoleKey, ServiceResult } from '@/types';
import type { PortalEmployeeProfile, PortalTimesheetEntry } from '@/types/portal/employee';
import {
  getDemoEmployeeProfile,
  getDemoTimesheetEntries,
} from '@/data/demo/portalEmployee';
import { enforcePermission } from '@/lib/permissions';
import { getServiceMode } from '@/lib/services/mode';
import { runService } from '@/lib/services/serviceRunner';
import {
  fetchLiveEmployeePortalProfile,
  fetchLiveEmployeeTimesheet,
} from './employeeProfileLiveService';
import { getPortalProfileLink } from './portalVisibility';

const SIMULATED_DELAY_MS = 350;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type FetchEmployeePortalProfileParams = {
  profileId: string;
  tenantId?: string | null;
  employeeId?: string | null;
  roleKey: RoleKey | null;
};

export async function fetchEmployeePortalProfile(
  profileId: string,
  roleKey: RoleKey | null,
  portalContext?: { tenantId?: string | null; employeeId?: string | null },
): Promise<ServiceResult<PortalEmployeeProfile>> {
  const denied = enforcePermission<PortalEmployeeProfile>(
    roleKey,
    'portal.employee.profile.view',
  );
  if (denied && roleKey === 'employee_portal') return denied;

  const tenantId = portalContext?.tenantId ?? null;
  const employeeId = portalContext?.employeeId ?? null;

  if (getServiceMode() === 'supabase' && tenantId?.trim() && employeeId?.trim()) {
    return fetchLiveEmployeePortalProfile(tenantId, employeeId);
  }

  return runService(async () => {
    await delay(SIMULATED_DELAY_MS);

    const link = getPortalProfileLink(profileId);
    const resolvedEmployeeId = employeeId ?? link.employeeId;
    if (!resolvedEmployeeId) {
      return { ok: false, error: 'Kein Mitarbeiterprofil mit diesem Portal verknüpft.' };
    }

    const profile = getDemoEmployeeProfile(resolvedEmployeeId);
    if (!profile) {
      return { ok: false, error: 'Mitarbeiterprofil nicht gefunden.' };
    }

    return { ok: true, data: profile };
  });
}

export async function fetchEmployeeTimesheet(
  profileId: string,
  roleKey: RoleKey | null,
  portalContext?: { tenantId?: string | null; employeeId?: string | null },
): Promise<ServiceResult<PortalTimesheetEntry[]>> {
  const denied = enforcePermission<PortalTimesheetEntry[]>(
    roleKey,
    'portal.employee.timesheet.view',
  );
  if (denied && roleKey === 'employee_portal') return denied;

  const tenantId = portalContext?.tenantId ?? null;
  const employeeId = portalContext?.employeeId ?? null;

  if (getServiceMode() === 'supabase' && tenantId?.trim() && employeeId?.trim()) {
    return fetchLiveEmployeeTimesheet(tenantId, employeeId);
  }

  return runService(async () => {
    await delay(SIMULATED_DELAY_MS);

    const link = getPortalProfileLink(profileId);
    const resolvedEmployeeId = employeeId ?? link.employeeId;
    if (!resolvedEmployeeId) {
      return { ok: true, data: [] };
    }

    return { ok: true, data: getDemoTimesheetEntries(resolvedEmployeeId) };
  });
}
