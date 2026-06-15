import type { RoleKey, ServiceResult } from '@/types';
import type { BillingDashboardStats, BudgetListItem } from '@/types/modules/billing';
import { demoBudgets } from '@/data/demo/budgets';
import { demoClients } from '@/data/demo/clients';
import { demoInvoices } from '@/data/demo/invoices';
import { enforcePermission } from '@/lib/permissions';
import { getServiceMode } from '@/lib/services/mode';
import { invoiceSupabaseRepository } from '@/lib/services/repositories/invoiceRepository.supabase';
import { assertTenantForMode } from '@/lib/tenant/tenantResolver';

function resolveClientName(clientId: string): string {
  const client = demoClients.find((c) => c.id === clientId);
  return client ? `${client.firstName} ${client.lastName}` : 'Unbekannt';
}

export async function fetchBudgetList(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<BudgetListItem[]>> {
  const denied = enforcePermission<BudgetListItem[]>(actorRoleKey, 'office.budgets.view');
  if (denied) return denied;

  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return { ok: false, error: tenantErr.error };

  if (getServiceMode() === 'supabase') {
    return {
      ok: false,
      error: 'Budgets im Live-Modus noch nicht angebunden.',
    };
  }

  await new Promise((r) => setTimeout(r, 320));

  const data: BudgetListItem[] = demoBudgets.map((b) => {
    const usagePercent =
      b.allocatedCents > 0 ? Math.round((b.usedCents / b.allocatedCents) * 100) : 0;
    return {
      id: b.id,
      tenantId: b.tenantId,
      clientId: b.clientId,
      clientName: resolveClientName(b.clientId),
      label: b.label,
      period: b.period,
      allocatedCents: b.allocatedCents,
      usedCents: b.usedCents,
      currency: b.currency,
      status: b.status,
      updatedAt: b.updatedAt,
      usagePercent,
    };
  });

  return { ok: true, data };
}

export async function fetchBillingDashboardStats(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<BillingDashboardStats>> {
  const denied = enforcePermission<BillingDashboardStats>(actorRoleKey, 'office.invoices.view');
  if (denied) return denied;

  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return { ok: false, error: tenantErr.error };

  if (getServiceMode() === 'supabase') {
    const result = await invoiceSupabaseRepository.list(tenantId);
    if (!result.ok) return result;

    const closedStatuses = new Set<string>(['paid', 'cancelled', 'written_off']);
    const open = result.data.filter((i) => !closedStatuses.has(i.status));

    return {
      ok: true,
      data: {
        openInvoicesCount: open.length,
        openInvoicesCents: 0,
        overdueCount: 0,
        activeBudgetsCount: 0,
        budgetsNearLimitCount: 0,
      },
    };
  }

  await new Promise((r) => setTimeout(r, 200));

  const open = demoInvoices.filter(
    (i) => i.status === 'aktiv' || i.status === 'in_bearbeitung' || i.status === 'entwurf',
  );
  const today = new Date().toISOString().slice(0, 10);
  const overdue = demoInvoices.filter((i) => i.dueDate < today && i.status !== 'abgeschlossen');

  const budgets = demoBudgets.filter((b) => b.status === 'aktiv' || b.status === 'in_bearbeitung');
  const nearLimit = budgets.filter(
    (b) => b.allocatedCents > 0 && b.usedCents / b.allocatedCents >= 0.85,
  );

  return {
    ok: true,
    data: {
      openInvoicesCount: open.length,
      openInvoicesCents: open.reduce((s, i) => s + i.amountCents, 0),
      overdueCount: overdue.length,
      activeBudgetsCount: budgets.length,
      budgetsNearLimitCount: nearLimit.length,
    },
  };
}
