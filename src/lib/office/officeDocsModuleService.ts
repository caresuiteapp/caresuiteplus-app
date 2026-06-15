import type { RoleKey, ServiceResult } from '@/types';
import { officeDocsDemo } from '@/data/demo/domains/officeDocsDemo';
import { adaptSnapshotListRepo, fetchDomainModuleSnapshot } from '@/lib/services/fetchDomainModuleSnapshot';
import { appointmentSupabaseRepository } from '@/lib/services/repositories/appointmentRepository.supabase';

/** WP207 — Document Modul-Service */
export async function fetchDocumentModuleSnapshot(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<{ wp: number; domain: string; recordCount: number; labels: string[] }>> {
  return fetchDomainModuleSnapshot(tenantId, actorRoleKey, {
    permission: 'office.documents.view',
    wp: 207,
    domain: 'officeDocs',
    demoRecords: officeDocsDemo.records,
    supabaseRepo: adaptSnapshotListRepo(
      (id) => appointmentSupabaseRepository.list(id),
      (item) => item.title,
    ),
  });
}
