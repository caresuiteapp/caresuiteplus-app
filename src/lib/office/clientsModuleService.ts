import type { RoleKey, ServiceResult } from '@/types';
import { clientsDemo } from '@/data/demo/domains/clientsDemo';
import { adaptSnapshotListRepo, fetchDomainModuleSnapshot } from '@/lib/services/fetchDomainModuleSnapshot';
import { supabaseClientRepository } from '@/lib/services/clients/clientRepository.supabase';

/** WP167 — Client Modul-Service */
export async function fetchClientModuleSnapshot(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<{ wp: number; domain: string; recordCount: number; labels: string[] }>> {
  return fetchDomainModuleSnapshot(tenantId, actorRoleKey, {
    permission: 'office.clients.view',
    wp: 167,
    domain: 'clients',
    demoRecords: clientsDemo.records,
    supabaseRepo: adaptSnapshotListRepo(
      (id) => supabaseClientRepository.list(id),
      (client) => `${client.firstName} ${client.lastName}`.trim(),
    ),
  });
}
