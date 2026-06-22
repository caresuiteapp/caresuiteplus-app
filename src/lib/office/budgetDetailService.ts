import type { RoleKey, ServiceResult } from '@/types';
import type { BudgetDetail } from '@/types/modules/billing';
import { demoBudgets } from '@/data/demo/budgets';
import { demoClients } from '@/data/demo/clients';
import { demoInvoices } from '@/data/demo/invoices';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { enforcePermission } from '@/lib/permissions';

function resolveClientName(clientId: string): string {
  const client = demoClients.find((c) => c.id === clientId);
  return client ? `${client.firstName} ${client.lastName}` : 'Unbekannt';
}

const BUDGET_NOTES: Record<string, string> = {
  'budget-001': 'Monatsbudget Entlastung — noch 37 % verfügbar.',
  'budget-003': 'Budget vollständig ausgeschöpft — Neuantrag prüfen.',
};

export async function fetchBudgetDetail(
  budgetId: string,
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<BudgetDetail>> {
  const denied = enforcePermission<BudgetDetail>(actorRoleKey, 'office.budgets.view');
  if (denied) return denied;

  if (tenantId !== DEMO_TENANT_ID) {
    return { ok: false, error: 'Mandant nicht gefunden.' };
  }

  await new Promise((r) => setTimeout(r, 280));

  const budget = demoBudgets.find((b) => b.id === budgetId);
  if (!budget) {
    return { ok: false, error: 'Budget nicht gefunden.' };
  }

  const usagePercent =
    budget.allocatedCents > 0
      ? Math.round((budget.usedCents / budget.allocatedCents) * 100)
      : 0;

  const linkedInvoiceIds = demoInvoices
    .filter((inv) => inv.clientId === budget.clientId)
    .map((inv) => inv.id);

  return {
    ok: true,
    data: {
      id: budget.id,
      tenantId: budget.tenantId,
      clientId: budget.clientId,
      clientName: resolveClientName(budget.clientId),
      label: budget.label,
      period: budget.period,
      allocatedCents: budget.allocatedCents,
      usedCents: budget.usedCents,
      currency: budget.currency,
      status: budget.status,
      updatedAt: budget.updatedAt,
      createdAt: budget.createdAt,
      usagePercent,
      notes: BUDGET_NOTES[budget.id] ?? null,
      linkedInvoiceIds,
    },
  };
}
