import type { RoleKey, ServiceResult } from '@/types';
import type { EmployeePortalOverview } from '@/types/modules/employeePortalExecution';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { employeePortalDemo } from '@/data/demo/domains/employeePortalDemo';
import { enforcePermission } from '@/lib/permissions';
import { getPortalProfileLink } from './portalVisibility';
import { fetchEmployeePortalOverview } from './employeePortalExecutionService';

/** WP323 — Mitarbeiterportal Dashboard-Service */
export async function fetchEmployeePortalDashboard(
  tenantId: string,
  profileId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<{ openItems: number; announcements: string[]; overview?: EmployeePortalOverview }>> {
  const denied = enforcePermission<{ openItems: number; announcements: string[] }>(actorRoleKey, 'portal.employee.profile.view' as never);
  if (denied) return denied;
  if (tenantId !== DEMO_TENANT_ID) return { ok: false, error: 'Mandant nicht gefunden.' };

  const link = getPortalProfileLink(profileId);
  if (!link.employeeId) {
    return { ok: false, error: 'Kein Mitarbeiterprofil mit diesem Portal verknüpft.' };
  }

  const overview = fetchEmployeePortalOverview(tenantId, link.employeeId, actorRoleKey ?? null);
  if (!overview.ok) return overview;

  await new Promise((r) => setTimeout(r, 120));
  return {
    ok: true,
    data: {
      openItems: employeePortalDemo.records.length,
      announcements: employeePortalDemo.records.map((r) => r.label),
      overview: overview.data,
    },
  };
}
