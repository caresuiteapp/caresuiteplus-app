import type { RoleKey, ServiceResult } from '@/types';
import type { PortalEmployeeProfile, PortalTimesheetEntry } from '@/types/portal/employee';
import {
  getDemoEmployeeProfile,
  getDemoTimesheetEntries,
} from '@/data/demo/portalEmployee';
import { enforcePermission } from '@/lib/permissions';
import { runService } from '@/lib/services/serviceRunner';
import { getPortalProfileLink } from './portalVisibility';

const SIMULATED_DELAY_MS = 350;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchEmployeePortalProfile(
  profileId: string,
  roleKey: RoleKey | null,
): Promise<ServiceResult<PortalEmployeeProfile>> {
  const denied = enforcePermission<PortalEmployeeProfile>(
    roleKey,
    'portal.employee.profile.view',
  );
  if (denied && roleKey === 'employee_portal') return denied;

  return runService(async () => {
    await delay(SIMULATED_DELAY_MS);

    const link = getPortalProfileLink(profileId);
    if (!link.employeeId) {
      return { ok: false, error: 'Kein Mitarbeiterprofil mit diesem Portal verknüpft.' };
    }

    const profile = getDemoEmployeeProfile(link.employeeId);
    if (!profile) {
      return { ok: false, error: 'Mitarbeiterprofil nicht gefunden.' };
    }

    return { ok: true, data: profile };
  });
}

export async function fetchEmployeeTimesheet(
  profileId: string,
  roleKey: RoleKey | null,
): Promise<ServiceResult<PortalTimesheetEntry[]>> {
  const denied = enforcePermission<PortalTimesheetEntry[]>(
    roleKey,
    'portal.employee.timesheet.view',
  );
  if (denied && roleKey === 'employee_portal') return denied;

  return runService(async () => {
    await delay(SIMULATED_DELAY_MS);

    const link = getPortalProfileLink(profileId);
    if (!link.employeeId) {
      return { ok: true, data: [] };
    }

    return { ok: true, data: getDemoTimesheetEntries(link.employeeId) };
  });
}
