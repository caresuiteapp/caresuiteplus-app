import type { RoleKey, ServiceResult } from '@/types';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { integrationsDemo } from '@/data/demo/domains/integrationsDemo';
import { enforcePermission } from '@/lib/permissions';

/** WP483 — Integrations-Hub Dashboard-Service */
export async function fetchIntegrationHubDashboard(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<{ providers: number; outboxPending: number }>> {
  const denied = enforcePermission<{ providers: number; outboxPending: number }>(actorRoleKey, 'integrations.view' as never);
  if (denied) return denied;
  if (tenantId !== DEMO_TENANT_ID) return { ok: false, error: 'Mandant nicht gefunden.' };
  await new Promise((r) => setTimeout(r, 130));
  return {
    ok: true,
    data: {
      providers: integrationsDemo.records.length,
      outboxPending: integrationsDemo.records.filter((r) => r.status !== 'aktiv').length,
    },
  };
}
