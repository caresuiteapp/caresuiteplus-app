import type { RoleKey, ServiceResult } from '@/types';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { clientPortalDemo } from '@/data/demo/domains/clientPortalDemo';
import { enforcePermission } from '@/lib/permissions';

/** WP343 — Klient:innenportal Dashboard-Service */
export async function fetchClientPortalDashboard(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<{ messages: number; requests: string[] }>> {
  const denied = enforcePermission<{ messages: number; requests: string[] }>(actorRoleKey, 'portal.client.profile.view' as never);
  if (denied) return denied;
  if (tenantId !== DEMO_TENANT_ID) return { ok: false, error: 'Mandant nicht gefunden.' };
  await new Promise((r) => setTimeout(r, 120));
  return {
    ok: true,
    data: {
      messages: clientPortalDemo.records.length,
      requests: clientPortalDemo.records.map((r) => r.label),
    },
  };
}
