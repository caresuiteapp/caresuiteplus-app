import type { RoleKey, ServiceResult } from '@/types';
import { enforcePermission } from '@/lib/permissions';
import { getServiceMode } from '@/lib/services/mode';
import { invoiceSupabaseRepository } from '@/lib/services/repositories/invoiceRepository.supabase';
import { assertTenantForMode } from '@/lib/tenant/tenantResolver';

export type InvoiceCreateInput = {
  title: string;
  clientName?: string;
  totalCents?: number;
  dueDate?: string;
};

/** WP226 — Rechnung anlegen (Demo + Supabase-ready) */
export async function createInvoice(
  tenantId: string,
  input: InvoiceCreateInput,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<{ id: string }>> {
  const denied = enforcePermission<{ id: string }>(actorRoleKey, 'office.invoices.view' as never);
  if (denied) return denied;
  if (!input.title.trim()) return { ok: false, error: 'Titel ist Pflicht.' };
  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return { ok: false, error: tenantErr.error };

  if (getServiceMode() === 'supabase') {
    return invoiceSupabaseRepository.create(tenantId, {
      title: input.title,
      status: 'draft',
    });
  }

  await new Promise((r) => setTimeout(r, 220));
  return { ok: true, data: { id: `inv-${Date.now()}` } };
}
