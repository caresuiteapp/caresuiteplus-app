import type {
  BudgetTemplateCatalogEntry,
  ClientBillingPriorityRule,
  ClientBillingWarning,
  ClientBudgetAccount,
  ClientBudgetMode,
  ClientBudgetTransaction,
  ClientCareEntitlement,
  ClientCareGrade,
  ClientServiceEntitlement,
} from '@/types/assist/clientAssistBilling';

export function mapCatalogRow(row: Record<string, unknown>): BudgetTemplateCatalogEntry {
  return {
    id: row.id as string,
    catalogKey: row.catalog_key as string,
    budgetYear: row.budget_year as number,
    label: row.label as string,
    description: row.description as string | null,
    period: row.period as BudgetTemplateCatalogEntry['period'],
    defaultAmountCents: row.default_amount_cents != null ? Number(row.default_amount_cents) : null,
    careGradeMin: row.care_grade_min as ClientCareGrade | null,
    careGradeMax: row.care_grade_max as ClientCareGrade | null,
    billingPriority: row.billing_priority as number,
    allowsIndividualOverride: row.allows_individual_override as boolean,
    autoGenerate: row.auto_generate as boolean,
    isStatutory: row.is_statutory as boolean,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    isActive: row.is_active as boolean,
  };
}

export function mapCareEntitlementRow(row: Record<string, unknown>): ClientCareEntitlement {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    clientId: row.client_id as string,
    careGrade: row.care_grade as ClientCareGrade,
    validFrom: row.valid_from as string,
    validUntil: row.valid_until as string | null,
    conversionEnabled: row.conversion_enabled as boolean,
    careFundName: row.care_fund_name as string | null,
    careFundMemberId: row.care_fund_member_id as string | null,
    mdAssessmentDate: row.md_assessment_date as string | null,
    notes: row.notes as string | null,
    source: row.source as string,
  };
}

export function mapServiceEntitlementRow(row: Record<string, unknown>): ClientServiceEntitlement {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    clientId: row.client_id as string,
    serviceTypeId: row.service_type_id as string | null,
    serviceTypeKey: row.service_type_key as string | null,
    billingMode: row.billing_mode as ClientServiceEntitlement['billingMode'],
    isActive: row.is_active as boolean,
    validFrom: row.valid_from as string,
    validUntil: row.valid_until as string | null,
    hourlyRateCents: row.hourly_rate_cents != null ? Number(row.hourly_rate_cents) : null,
    notes: row.notes as string | null,
  };
}

export function mapBudgetAccountRow(
  row: Record<string, unknown>,
  label?: string,
): ClientBudgetAccount {
  const allocated = Number(row.allocated_cents);
  const used = Number(row.used_cents);
  const reserved = Number(row.reserved_cents);
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    clientId: row.client_id as string,
    catalogTemplateId: row.catalog_template_id as string | null,
    catalogKey: row.catalog_key as string,
    catalogYear: row.catalog_year as number,
    period: row.period as ClientBudgetAccount['period'],
    periodStart: row.period_start as string,
    periodEnd: row.period_end as string,
    allocatedCents: allocated,
    usedCents: used,
    reservedCents: reserved,
    isIndividualOverride: row.is_individual_override as boolean,
    individualAmountCents: row.individual_amount_cents != null ? Number(row.individual_amount_cents) : null,
    standardAmountCents: row.standard_amount_cents != null ? Number(row.standard_amount_cents) : null,
    locked: (row.locked as boolean | undefined) ?? false,
    lockReason: (row.lock_reason as string | null | undefined) ?? null,
    isEnabled: (row.is_enabled as boolean | undefined) ?? true,
    catalogSnapshot: (row.catalog_snapshot as Record<string, unknown>) ?? {},
    billingPriority: row.billing_priority as number,
    status: row.status as ClientBudgetAccount['status'],
    notes: row.notes as string | null,
    remainingCents: allocated - used - reserved,
    label,
  };
}

export function mapPriorityRuleRow(row: Record<string, unknown>): ClientBillingPriorityRule {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    clientId: row.client_id as string | null,
    catalogKey: row.catalog_key as string,
    priorityOrder: row.priority_order as number,
    isActive: row.is_active as boolean,
    notes: row.notes as string | null,
  };
}

export function mapTransactionRow(row: Record<string, unknown>): ClientBudgetTransaction {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    clientId: row.client_id as string,
    budgetAccountId: row.budget_account_id as string,
    transactionType: row.transaction_type as ClientBudgetTransaction['transactionType'],
    amountCents: Number(row.amount_cents),
    balanceAfterCents: row.balance_after_cents != null ? Number(row.balance_after_cents) : null,
    referenceType: row.reference_type as string | null,
    referenceId: row.reference_id as string | null,
    note: row.note as string | null,
    createdBy: row.created_by as string | null,
    createdAt: row.created_at as string,
  };
}

export function mapBudgetModeRow(row: Record<string, unknown>): ClientBudgetMode {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    clientId: row.client_id as string,
    budgetYear: row.budget_year as number,
    carePreventionMode: row.care_prevention_mode as ClientBudgetMode['carePreventionMode'],
    modeChangeReason: row.mode_change_reason as string | null,
  };
}

export function mapWarningRow(row: Record<string, unknown>): ClientBillingWarning {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    clientId: row.client_id as string,
    warningType: row.warning_type as string,
    severity: row.severity as ClientBillingWarning['severity'],
    catalogKey: row.catalog_key as string | null,
    budgetAccountId: row.budget_account_id as string | null,
    message: row.message as string,
    isResolved: row.is_resolved as boolean,
    resolvedAt: row.resolved_at as string | null,
    createdAt: row.created_at as string,
  };
}

export function periodBoundsForDate(
  period: BudgetTemplateCatalogEntry['period'],
  date: Date,
): { periodStart: string; periodEnd: string } {
  const y = date.getFullYear();
  const m = date.getMonth();
  if (period === 'monthly') {
    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 0);
    return {
      periodStart: start.toISOString().slice(0, 10),
      periodEnd: end.toISOString().slice(0, 10),
    };
  }
  return {
    periodStart: `${y}-01-01`,
    periodEnd: `${y}-12-31`,
  };
}
