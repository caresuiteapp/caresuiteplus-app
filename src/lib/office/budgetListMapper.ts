import type { Database } from '@/lib/supabase/database.types';
import type { WorkflowStatus } from '@/types';
import type { BudgetListItem, BudgetPeriod } from '@/types/modules/billing';

type BudgetStatus = Database['public']['Enums']['budget_status'];
type BudgetType = Database['public']['Enums']['budget_type'];

export type ClientBudgetListRow = Database['public']['Tables']['client_budgets']['Row'] & {
  clients?: { first_name: string | null; last_name: string | null } | null;
};

const BUDGET_TYPE_LABELS: Record<BudgetType, string> = {
  s45b: '§45b Entlastungsbetrag',
  s45a: '§45a Verhinderungspflege',
  preventive_care: 'Verhinderungspflege',
  short_term_care: 'Kurzzeitpflege',
  self_payer: 'Selbstzahler',
  health_insurance: 'Krankenkasse',
  social_welfare: 'Sozialamt',
  other: 'Sonstige',
};

const BUDGET_STATUS_TO_WORKFLOW: Record<BudgetStatus, WorkflowStatus> = {
  active: 'aktiv',
  paused: 'gesperrt',
  exhausted: 'abgeschlossen',
  expired: 'archiviert',
  cancelled: 'archiviert',
};

function eurosToCents(value: number | null | undefined): number {
  if (value == null || Number.isNaN(value)) return 0;
  return Math.round(Number(value) * 100);
}

function resolveClientName(row: ClientBudgetListRow): string {
  const client = row.clients;
  if (!client) return 'Unbekannt';
  const name = `${client.first_name ?? ''} ${client.last_name ?? ''}`.trim();
  return name || 'Unbekannt';
}

function resolvePeriod(row: ClientBudgetListRow): BudgetPeriod {
  if (row.yearly_amount != null && row.budget_month == null) return 'yearly';
  if (row.budget_month != null) return 'monthly';
  return 'yearly';
}

function resolveAllocatedCents(row: ClientBudgetListRow): number {
  const period = resolvePeriod(row);
  if (period === 'yearly') {
    return eurosToCents(row.yearly_amount ?? row.monthly_amount);
  }
  return eurosToCents(row.monthly_amount ?? row.yearly_amount);
}

function resolveUsedCents(row: ClientBudgetListRow): number {
  return eurosToCents(row.used_amount) + eurosToCents(row.reserved_amount);
}

function resolveLabel(row: ClientBudgetListRow): string {
  const typeLabel = BUDGET_TYPE_LABELS[row.budget_type] ?? row.budget_type;
  const monthSuffix = row.budget_month ? ` · Monat ${row.budget_month}` : '';
  return `${typeLabel} ${row.budget_year}${monthSuffix}`;
}

export function mapClientBudgetRowToListItem(row: ClientBudgetListRow): BudgetListItem {
  const allocatedCents = resolveAllocatedCents(row);
  const usedCents = resolveUsedCents(row);
  const usagePercent =
    allocatedCents > 0 ? Math.round((usedCents / allocatedCents) * 100) : 0;

  return {
    id: row.id,
    tenantId: row.tenant_id,
    clientId: row.client_id,
    clientName: resolveClientName(row),
    label: resolveLabel(row),
    period: resolvePeriod(row),
    allocatedCents,
    usedCents,
    currency: 'EUR',
    status: BUDGET_STATUS_TO_WORKFLOW[row.status] ?? 'aktiv',
    updatedAt: row.updated_at,
    usagePercent,
  };
}
