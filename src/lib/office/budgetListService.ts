import type { RoleKey, ServiceResult } from '@/types';
import type { BillingDashboardStats, BudgetListItem } from '@/types/modules/billing';
import { demoBudgets } from '@/data/demo/budgets';
import { demoClients } from '@/data/demo/clients';
import { demoInvoices } from '@/data/demo/invoices';
import { enforcePermission } from '@/lib/permissions';
import { getServiceMode } from '@/lib/services/mode';
import { budgetSupabaseRepository } from '@/lib/services/repositories/budgetRepository.supabase';
import { invoiceSupabaseRepository } from '@/lib/services/repositories/invoiceRepository.supabase';
import { assertTenantForMode } from '@/lib/tenant/tenantResolver';

function resolveClientName(clientId: string): string {
  const client = demoClients.find((c) => c.id === clientId);
  return client ? `${client.firstName} ${client.lastName}` : 'Unbekannt';
}

function mapDemoBudgets(): BudgetListItem[] {
  return demoBudgets.map((b) => {
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
    return budgetSupabaseRepository.list(tenantId);
  }

  await new Promise((r) => setTimeout(r, 320));
  return { ok: true, data: mapDemoBudgets() };
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
    const [invoiceResult, budgetResult] = await Promise.all([
      invoiceSupabaseRepository.list(tenantId),
      budgetSupabaseRepository.list(tenantId),
    ]);

    if (!invoiceResult.ok) return invoiceResult;

    const closedStatuses = new Set<string>(['paid', 'cancelled', 'written_off']);
    const open = invoiceResult.data.filter((i) => !closedStatuses.has(i.status));
    const budgets = budgetResult.ok ? budgetResult.data : [];
    const activeBudgets = budgets.filter(
      (b) => b.status === 'aktiv' || b.status === 'in_bearbeitung',
    );
    const nearLimit = activeBudgets.filter((b) => b.usagePercent >= 85);

    return {
      ok: true,
      data: {
        openInvoicesCount: open.length,
        openInvoicesCents: open.reduce(
          (sum, inv) => sum + Math.round((inv.total_amount ?? 0) * 100),
          0,
        ),
        overdueCount: 0,
        activeBudgetsCount: activeBudgets.length,
        budgetsNearLimitCount: nearLimit.length,
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
