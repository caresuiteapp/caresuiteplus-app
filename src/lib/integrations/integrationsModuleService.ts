import type { RoleKey, ServiceResult } from '@/types';
import { integrationsDemo } from '@/data/demo/domains/integrationsDemo';
import { adaptSnapshotListRepo, fetchDomainModuleSnapshot } from '@/lib/services/fetchDomainModuleSnapshot';
import { integrationSupabaseRepository } from '@/lib/services/repositories/integrationRepository.supabase';

/** WP487 — Integrations Modul-Service */
export async function fetchIntegrationModuleSnapshot(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<{ wp: number; domain: string; recordCount: number; labels: string[] }>> {
  return fetchDomainModuleSnapshot(tenantId, actorRoleKey, {
    permission: 'integrations.manage',
    wp: 487,
    domain: 'integrations',
    demoRecords: integrationsDemo.records,
    supabaseRepo: adaptSnapshotListRepo(
      (id) => integrationSupabaseRepository.list(id),
      (row) => row.title,
    ),
  });
}
