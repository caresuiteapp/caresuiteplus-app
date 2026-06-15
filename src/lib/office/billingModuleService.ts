import type { RoleKey, ServiceResult } from '@/types';
import { billingDemo } from '@/data/demo/domains/billingDemo';
import { adaptSnapshotListRepo, fetchDomainModuleSnapshot } from '@/lib/services/fetchDomainModuleSnapshot';
import { invoiceSupabaseRepository } from '@/lib/services/repositories/invoiceRepository.supabase';

/** WP227 — Billing Modul-Service */
export async function fetchInvoiceModuleSnapshot(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<{ wp: number; domain: string; recordCount: number; labels: string[] }>> {
  return fetchDomainModuleSnapshot(tenantId, actorRoleKey, {
    permission: 'office.invoices.view',
    wp: 227,
    domain: 'billing',
    demoRecords: billingDemo.records,
    supabaseRepo: adaptSnapshotListRepo(
      (id) => invoiceSupabaseRepository.list(id),
      (invoice) => invoice.invoice_number,
    ),
  });
}
