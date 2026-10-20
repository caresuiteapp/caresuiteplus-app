import type { RoleKey, ServiceResult } from '@/types';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { employeePortalDemo } from '@/data/demo/domains/employeePortalDemo';
import { enforcePermission } from '@/lib/permissions';

/** WP323 — Mitarbeiterportal Dashboard-Service */
export async function fetchEmployeePortalDashboard(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<{ openItems: number; announcements: string[] }>> {
  const denied = enforcePermission<{ openItems: number; announcements: string[] }>(actorRoleKey, 'portal.employee.profile.view' as never);
  if (denied) return denied;
  if (tenantId !== DEMO_TENANT_ID) return { ok: false, error: 'Mandant nicht gefunden.' };
  await new Promise((r) => setTimeout(r, 120));
  return {
    ok: true,
    data: {
      openItems: employeePortalDemo.records.length,
      announcements: employeePortalDemo.records.map((r) => r.label),
    },
  };
}
