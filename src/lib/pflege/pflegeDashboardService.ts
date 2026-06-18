import type { RoleKey, ServiceResult } from '@/types';
import { enforcePermission } from '@/lib/permissions';
import { pflegeDemo } from '@/data/demo/domains/pflegeDemo';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { pflegeSupabaseRepository } from '@/lib/services/repositories/pflegeRepository.supabase';
import { resolveMissingTableList } from '@/lib/supabase/missingtablefallback';

export type CarePlanDashboardSnapshot = {
  wp: number;
  domain: string;
  activeCount: number;
  draftCount: number;
  highlights: string[];
};

/** WP363 â€” CarePlan Dashboard-Service */
export async function fetchCarePlanDashboard(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CarePlanDashboardSnapshot>> {
  const denied = enforcePermission<CarePlanDashboardSnapshot>(actorRoleKey, 'pflege.plans.view' as never);
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    const result = await pflegeSupabaseRepository.list(tenantId);
    if (result.ok && result.tableMissing) {
      const resolved = resolveMissingTableList(result, tenantId, () => pflegeDemo.records.map((record, index) => ({
        id: `demo-${index}`,
        tenant_id: tenantId,
        title: record.label,
        status: record.status ?? 'aktiv',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })));
      if (!resolved.ok) return resolved;
      const records = resolved.data;
      return {
        ok: true,
        data: {
          wp: 363,
          domain: 'pflege',
          activeCount: records.filter((r) => r.status === 'aktiv').length,
          draftCount: records.filter((r) => r.status === 'entwurf').length,
          highlights: records.slice(0, 3).map((r) => r.title),
        },
        usedDemoFallback: resolved.usedDemoFallback,
      };
    }
    if (!result.ok) {
      const resolved = resolveMissingTableList(result, tenantId, () => pflegeDemo.records.map((record, index) => ({
        id: `demo-${index}`,
        tenant_id: tenantId,
        title: record.label,
        status: record.status ?? 'aktiv',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })));
      if (!resolved.ok) return resolved;
      const records = resolved.data;
      return {
        ok: true,
        data: {
          wp: 363,
          domain: 'pflege',
          activeCount: records.filter((r) => r.status === 'aktiv').length,
          draftCount: records.filter((r) => r.status === 'entwurf').length,
          highlights: records.slice(0, 3).map((r) => r.title),
        },
        usedDemoFallback: resolved.usedDemoFallback,
      };
    }
    const records = result.data;
    return {
      ok: true,
      data: {
        wp: 363,
        domain: 'pflege',
        activeCount: records.filter((r) => r.status === 'aktiv').length,
        draftCount: records.filter((r) => r.status === 'entwurf').length,
        highlights: records.slice(0, 3).map((r) => r.title),
      },
    };
  }

  await new Promise((r) => setTimeout(r, 140));
  const records = pflegeDemo.records;
  return {
    ok: true,
    data: {
      wp: 363,
      domain: 'pflege',
      activeCount: records.filter((r) => r.status === 'aktiv').length,
      draftCount: records.filter((r) => r.status === 'entwurf').length,
      highlights: records.slice(0, 3).map((r) => r.label),
    },
  };
}
