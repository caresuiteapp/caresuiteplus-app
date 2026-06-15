import type { RoleKey, ServiceResult } from '@/types';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { enforcePermission } from '@/lib/permissions';
import { appendDemoEntity } from './demoEntityStore';

export type DemoCreateInput = Record<string, string>;

export async function createDemoEntity(
  permission: Parameters<typeof enforcePermission>[1],
  actorRoleKey: RoleKey | null | undefined,
  prefix: string,
  options?: { domain?: string; label?: string },
): Promise<ServiceResult<{ id: string }>> {
  const denied = enforcePermission<{ id: string }>(actorRoleKey, permission);
  if (denied) return denied;

  await new Promise((r) => setTimeout(r, 300));
  const id = `${prefix}-${Date.now().toString(36)}`;
  if (options?.domain) {
    appendDemoEntity(options.domain, {
      id,
      tenantId: DEMO_TENANT_ID,
      label: options.label ?? `${prefix} Eintrag`,
      status: 'entwurf',
    });
  }
  return { ok: true, data: { id } };
}

export function assertDemoTenant(tenantId: string): ServiceResult<never> | null {
  if (tenantId !== DEMO_TENANT_ID) {
    return { ok: false, error: 'Kein Zugriff auf diesen Mandanten.' };
  }
  return null;
}
