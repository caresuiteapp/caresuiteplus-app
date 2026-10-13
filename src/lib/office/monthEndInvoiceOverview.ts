import type { RoleKey, ServiceResult } from '@/types';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { fetchLiveMonthInvoiceTotals } from './invoiceFinanceRepository';
import { demoInvoices } from '@/data/demo/invoices';
import { fetchInvoiceRuns, type InvoiceRunItem } from './invoiceExtensionService';

export type MonthEndInvoiceOverview = { invoiceCount: number; draftCount: number; totalCents: number; runs: InvoiceRunItem[] };
export async function fetchMonthEndInvoiceOverview(tenantId: string, month: string, actorRoleKey?: RoleKey | null): Promise<ServiceResult<MonthEndInvoiceOverview>> {
  const denied = enforcePermission<MonthEndInvoiceOverview>(actorRoleKey, 'office.invoices.view'); if (denied) return denied;
  const blocked = guardServiceTenant(tenantId); if (blocked) return blocked;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return { ok: false, error: 'Bitte einen gültigen Monat im Format JJJJ-MM eingeben.' };
  const runs = await fetchInvoiceRuns(tenantId, actorRoleKey); if (!runs.ok) return runs;
  if (getServiceMode() === 'supabase') {
    const invoices = await fetchLiveMonthInvoiceTotals(tenantId, month); if (!invoices.ok) return invoices;
    return { ok: true, data: { ...invoices.data,
      runs: runs.data.filter(run => run.runAt.slice(0, 7) === month) } };
  }
  const selected = demoInvoices.filter(invoice => invoice.tenantId === tenantId && invoice.createdAt.slice(0, 7) === month);
  return { ok: true, data: { invoiceCount: selected.length, draftCount: selected.filter(invoice => invoice.status === 'entwurf').length,
    totalCents: selected.reduce((sum, invoice) => sum + invoice.amountCents, 0), runs: runs.data.filter(run => run.runAt.slice(0, 7) === month) } };
}
