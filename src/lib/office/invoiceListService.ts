import type { RoleKey, ServiceResult } from '@/types';
import type { InvoiceListItem } from '@/types/modules/billing';
import { demoBudgets } from '@/data/demo/budgets';
import { demoClients } from '@/data/demo/clients';
import { demoInvoices } from '@/data/demo/invoices';
import { enforcePermission } from '@/lib/permissions';
import { getServiceMode } from '@/lib/services/mode';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { invoiceSupabaseRepository } from '@/lib/services/repositories/invoiceRepository.supabase';
import { runService } from '@/lib/services/serviceRunner';

const SIMULATED_DELAY_MS = 400;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveClientName(clientId: string): string {
  const client = demoClients.find((c) => c.id === clientId);
  return client ? `${client.firstName} ${client.lastName}` : 'Unbekannt';
}

export async function fetchInvoiceList(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
  options?: { simulateError?: boolean; simulateEmpty?: boolean },
): Promise<ServiceResult<InvoiceListItem[]>> {
  const denied = enforcePermission<InvoiceListItem[]>(actorRoleKey, 'office.invoices.view');
  if (denied) return denied;

  return runService(async () => {
    await delay(SIMULATED_DELAY_MS);

    if (options?.simulateError) {
      return {
        ok: false,
        error: 'Rechnungen konnten nicht geladen werden. Bitte erneut versuchen.',
      };
    }

    const tenantBlock = guardServiceTenant(tenantId);
    if (tenantBlock) return tenantBlock;

    if (getServiceMode() === 'supabase') {
      const result = await invoiceSupabaseRepository.list(tenantId);
      if (!result.ok) return result;
      const data: InvoiceListItem[] = result.data.map((inv) => ({
        id: inv.id,
        tenantId: inv.tenant_id,
        clientId: inv.client_id ?? inv.id,
        clientName: inv.invoice_number,
        invoiceNumber: inv.invoice_number,
        amountCents: Math.round((inv.total_amount ?? 0) * 100),
        currency: 'EUR',
        dueDate: inv.due_date ?? inv.updated_at.slice(0, 10),
        status: inv.status as unknown as InvoiceListItem['status'],
        updatedAt: inv.updated_at,
      }));
      return { ok: true, data };
    }

    if (options?.simulateEmpty) {
      return { ok: true, data: [] };
    }

    const data: InvoiceListItem[] = demoInvoices.map((inv) => ({
      id: inv.id,
      tenantId: inv.tenantId,
      clientId: inv.clientId,
      clientName: resolveClientName(inv.clientId),
      invoiceNumber: inv.invoiceNumber,
      amountCents: inv.amountCents,
      currency: inv.currency,
      dueDate: inv.dueDate,
      status: inv.status,
      updatedAt: inv.updatedAt,
    }));

    return { ok: true, data };
  });
}

export async function fetchBudgetSummary(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<typeof demoBudgets>> {
  const denied = enforcePermission<typeof demoBudgets>(actorRoleKey, 'office.invoices.view');
  if (denied) return denied;

  return runService(async () => {
    await delay(SIMULATED_DELAY_MS);
    const tenantBlock = guardServiceTenant(tenantId);
    if (tenantBlock) return tenantBlock;
    return { ok: true, data: demoBudgets };
  });
}

export function formatCurrency(amountCents: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency,
  }).format(amountCents / 100);
}
