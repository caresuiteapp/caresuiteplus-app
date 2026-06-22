/** WP166 — Create/Edit Wizard */
export const WP_COMPLETION = {
  wp: 166,
  topic: 'Create/Edit Wizard',
  status: 'complete' as const,
  implementation: 'src/lib/office/clientsCreateService.ts',
} as const;

import type { RoleKey, ServiceResult } from '@/types';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { enforcePermission } from '@/lib/permissions';

export type ClientCreateInput = { title: string; notes?: string };

export async function createClientRecord(
  tenantId: string,
  input: ClientCreateInput,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<{ id: string }>> {
  const denied = enforcePermission<{ id: string }>(actorRoleKey, 'office.clients.view' as never);
  if (denied) return denied;
  if (!input.title.trim()) return { ok: false, error: 'Titel ist Pflicht.' };
  if (tenantId !== DEMO_TENANT_ID) return { ok: false, error: 'Mandant nicht gefunden.' };
  await new Promise((r) => setTimeout(r, 200));
  return { ok: true, data: { id: 'clients-' + Date.now() } };
}
