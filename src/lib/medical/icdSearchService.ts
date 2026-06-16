import type { RoleKey, ServiceResult } from '@/types';
import type { IcdSearchResult } from '@/types/medical';
import { searchDemoIcdCodes } from '@/data/demo/icdCodes';
import { enforcePermission } from '@/lib/permissions';
import { canUseMedicalCatalogInCurrentMode } from '@/lib/medicalCatalog';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';

/** ICD-Kodierhilfe — Suche, keine Diagnoseentscheidung. */
export async function searchIcdCodes(
  tenantId: string,
  query: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<IcdSearchResult>> {
  const denied = enforcePermission<IcdSearchResult>(actorRoleKey, 'pflege.plans.view');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (!canUseMedicalCatalogInCurrentMode('icd10_gm')) {
    return {
      ok: false,
      error:
        'ICD-10-GM Katalog im Produktivmodus noch nicht freigegeben — Lizenz und Migration erforderlich.',
    };
  }

  if (getServiceMode() === 'supabase') {
    return {
      ok: false,
      error: 'ICD-Katalog-Suche im Live-Modus noch nicht angebunden — Migration 0047 erforderlich.',
    };
  }

  await new Promise((resolve) => setTimeout(resolve, 120));

  return {
    ok: true,
    data: {
      query,
      results: searchDemoIcdCodes(query),
      sourceKey: 'icd10_gm',
      isDemoCatalog: true,
    },
  };
}
