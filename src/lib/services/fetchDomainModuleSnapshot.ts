import type { RoleKey, ServiceResult } from '@/types';
import { enforcePermission } from '@/lib/permissions';
import { getServiceMode } from '@/lib/services/mode';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import type { TenantTableRow } from '@/lib/services/repositories/createTenantTableRepository';

export type ModuleSnapshot = {
  wp: number;
  domain: string;
  recordCount: number;
  labels: string[];
};

type ListRepo = {
  list(tenantId: string): Promise<ServiceResult<TenantTableRow[]>>;
};

/** Adapter für Repositories ohne TenantTableRow-Shape (z. B. clients, employees). */
export function adaptSnapshotListRepo<T>(
  listFn: (tenantId: string) => Promise<ServiceResult<T[]>>,
  toLabel: (item: T) => string,
): ListRepo {
  return {
    async list(tenantId: string) {
      const result = await listFn(tenantId);
      if (!result.ok) return result;
      const now = new Date().toISOString();
      return {
        ok: true,
        data: result.data.map((item, index) => ({
          id: `snap-${index}`,
          tenant_id: tenantId,
          title: toLabel(item),
          status: 'aktiv',
          created_at: now,
          updated_at: now,
        })),
      };
    },
  };
}

export async function fetchDomainModuleSnapshot(
  tenantId: string,
  actorRoleKey: RoleKey | null | undefined,
  options: {
    permission: string;
    wp: number;
    domain: string;
    demoRecords: { label: string }[];
    supabaseRepo?: ListRepo;
  },
): Promise<ServiceResult<ModuleSnapshot>> {
  const denied = enforcePermission<ModuleSnapshot>(actorRoleKey, options.permission as never);
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase' && options.supabaseRepo) {
    const result = await options.supabaseRepo.list(tenantId);
    if (!result.ok) return result;
    return {
      ok: true,
      data: {
        wp: options.wp,
        domain: options.domain,
        recordCount: result.data.length,
        labels: result.data.map((row) => row.title),
      },
    };
  }

  await new Promise((r) => setTimeout(r, 120));
  return {
    ok: true,
    data: {
      wp: options.wp,
      domain: options.domain,
      recordCount: options.demoRecords.length,
      labels: options.demoRecords.map((r) => r.label),
    },
  };
}
