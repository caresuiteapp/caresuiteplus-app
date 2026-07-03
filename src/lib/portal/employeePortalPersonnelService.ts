import type { RoleKey, ServiceResult } from '@/types';
import type { PortalEmployeePersonnelView } from '@/types/portal/employeePersonnel';
import { enforcePermission } from '@/lib/permissions';
import { getServiceMode } from '@/lib/services/mode';
import { runService } from '@/lib/services/serviceRunner';
import {
  fetchDemoEmployeePortalPersonnelView,
  fetchLiveEmployeePortalPersonnelView,
} from './employeePortalPersonnelLiveService';

const SIMULATED_DELAY_MS = 350;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchEmployeePortalPersonnelView(
  _profileId: string,
  roleKey: RoleKey | null,
  portalContext?: { tenantId?: string | null; employeeId?: string | null },
): Promise<ServiceResult<PortalEmployeePersonnelView>> {
  const denied = enforcePermission<PortalEmployeePersonnelView>(
    roleKey,
    'portal.employee.profile.view',
  );
  if (denied && roleKey === 'employee_portal') return denied;

  const tenantId = portalContext?.tenantId ?? null;
  const employeeId = portalContext?.employeeId ?? null;

  if (!employeeId?.trim()) {
    return { ok: false, error: 'Kein Mitarbeiterprofil mit diesem Portal verknüpft.' };
  }

  if (getServiceMode() === 'supabase' && tenantId?.trim()) {
    return fetchLiveEmployeePortalPersonnelView(tenantId, employeeId);
  }

  return runService(async () => {
    await delay(SIMULATED_DELAY_MS);
    if (!tenantId?.trim()) {
      return { ok: false, error: 'Profildaten konnten nicht geladen werden.' };
    }
    return fetchDemoEmployeePortalPersonnelView(tenantId, employeeId);
  });
}
