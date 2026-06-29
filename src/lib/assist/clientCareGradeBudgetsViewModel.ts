import { formatBudgetPeriodLabelCapitalized } from '@/lib/assist/budgetPeriodLabels';
import { formatCurrency } from '@/lib/formatters/numberFormatters';
import {
  BUDGET_TEMPLATE_LABELS,
  type ClientAssistBillingProfile,
  type ClientBudgetAccount,
  type ClientCareGrade,
  type ClientServiceEntitlement,
} from '@/types/assist/clientAssistBilling';

export type AnspruchsOverviewItem = {
  id: string;
  title: string;
  subtitle: string;
  source: 'service' | 'budget' | 'template';
};

export type CompactBillingRule = {
  catalogKey: string;
  label: string;
  priorityOrder: number;
  available: boolean;
};

/** Derive Anspruchsübersicht — never empty when budgets or statutory templates exist. */
export function buildAnspruchsOverviewItems(profile: ClientAssistBillingProfile): AnspruchsOverviewItem[] {
  if (profile.serviceEntitlements.length > 0) {
    return profile.serviceEntitlements.map((s) => serviceEntitlementToItem(s));
  }

  const activeAccounts = profile.budgetAccounts.filter((a) => a.isEnabled !== false && a.status === 'active');
  if (activeAccounts.length > 0) {
    return activeAccounts.map((a) => budgetAccountToItem(a, profile));
  }

  const statutory = profile.templates.filter((t) => t.isStatutory);
  if (statutory.length > 0) {
    return statutory.map((t) => ({
      id: t.id,
      title: t.label,
      subtitle: [
        t.defaultAmountCents != null ? formatCurrency(t.defaultAmountCents, true) : 'Individuell',
        formatBudgetPeriodLabelCapitalized(t.period, t.catalogKey),
        `Priorität ${t.billingPriority}`,
      ].join(' · '),
      source: 'template' as const,
    }));
  }

  return [];
}

export function hasAnspruchsData(profile: ClientAssistBillingProfile): boolean {
  return buildAnspruchsOverviewItems(profile).length > 0;
}

function serviceEntitlementToItem(s: ClientServiceEntitlement): AnspruchsOverviewItem {
  return {
    id: s.id,
    title: s.serviceTypeKey ?? 'Leistung',
    subtitle: [
      `Modus: ${s.billingMode}`,
      s.hourlyRateCents ? `${formatCurrency(s.hourlyRateCents, true)}/Std.` : null,
    ]
      .filter(Boolean)
      .join(' · '),
    source: 'service',
  };
}

function budgetAccountToItem(a: ClientBudgetAccount, profile: ClientAssistBillingProfile): AnspruchsOverviewItem {
  const label =
    a.label ?? BUDGET_TEMPLATE_LABELS[a.catalogKey as keyof typeof BUDGET_TEMPLATE_LABELS] ?? a.catalogKey;
  const available = profile.canUseBudgetByCatalogKey[a.catalogKey];
  return {
    id: a.id,
    title: label,
    subtitle: [
      formatBudgetPeriodLabelCapitalized(a.period, a.catalogKey),
      formatCurrency(a.remainingCents ?? a.allocatedCents - a.usedCents - a.reservedCents, true),
      available ? 'verfügbar' : 'nicht verfügbar',
    ].join(' · '),
    source: 'budget',
  };
}

/** Compact Abrechnungslogik — deduplicated priority list, not raw PG2–PG5 catalog dump. */
export function buildCompactBillingRules(profile: ClientAssistBillingProfile): CompactBillingRule[] {
  const accountKeys = new Set(profile.budgetAccounts.map((a) => a.catalogKey));
  const seen = new Set<string>();

  return profile.priorityRules
    .filter((r) => accountKeys.has(r.catalogKey) || profile.templates.some((t) => t.catalogKey === r.catalogKey))
    .sort((a, b) => a.priorityOrder - b.priorityOrder)
    .reduce<CompactBillingRule[]>((acc, r) => {
      if (seen.has(r.catalogKey)) return acc;
      seen.add(r.catalogKey);
      acc.push({
        catalogKey: r.catalogKey,
        label:
          BUDGET_TEMPLATE_LABELS[r.catalogKey as keyof typeof BUDGET_TEMPLATE_LABELS] ?? r.catalogKey,
        priorityOrder: r.priorityOrder,
        available: profile.canUseBudgetByCatalogKey[r.catalogKey] ?? false,
      });
      return acc;
    }, []);
}

/** Map legacy budget tab keys to the consolidated tab. */
export const PFLEGEGRAD_BUDGETS_TAB_ALIASES: Record<string, string> = {
  pflegegrad_anspruch: 'pflegegrad_budgets',
  leistungen_abrechnung: 'pflegegrad_budgets',
  budget: 'pflegegrad_budgets',
  budgetverlauf: 'pflegegrad_budgets',
  warnungen: 'pflegegrad_budgets',
  pflegegrad: 'pflegegrad_budgets',
};

export function resolvePflegegradBudgetsTabAlias(tab: string | undefined): string | undefined {
  if (!tab) return tab;
  return PFLEGEGRAD_BUDGETS_TAB_ALIASES[tab] ?? tab;
}

export const CARE_GRADE_OPTIONS: { key: ClientCareGrade; label: string }[] = [
  { key: 'kein', label: 'Kein Pflegegrad' },
  { key: 'pg1', label: 'PG 1' },
  { key: 'pg2', label: 'PG 2' },
  { key: 'pg3', label: 'PG 3' },
  { key: 'pg4', label: 'PG 4' },
  { key: 'pg5', label: 'PG 5' },
  { key: 'hospiz', label: 'Hospiz' },
];

export type BudgetCorrectionFormValues = {
  budgetAccountId: string;
  amountEuro: string;
  reason: string;
  effectiveDate: string;
};

export function validateBudgetCorrectionForm(
  values: BudgetCorrectionFormValues,
): { ok: true } | { ok: false; error: string } {
  if (!values.budgetAccountId) return { ok: false, error: 'Budgetkonto ist Pflicht.' };
  if (!values.reason.trim()) return { ok: false, error: 'Begründung ist Pflicht.' };
  if (!values.effectiveDate.trim()) return { ok: false, error: 'Wirksamkeitsdatum ist Pflicht.' };
  const trimmed = values.amountEuro.trim().replace(',', '.');
  const parsed = parseFloat(trimmed);
  if (!trimmed || Number.isNaN(parsed) || parsed === 0) {
    return { ok: false, error: 'Betrag muss ungleich 0 sein (± erlaubt).' };
  }
  return { ok: true };
}

export function parseCorrectionAmountCents(amountEuro: string): number {
  const parsed = parseFloat(amountEuro.trim().replace(',', '.'));
  return Math.round(parsed * 100);
}

export function hasRecalculationChanges(
  diffs: import('./clientCareGradeBudgetsService').BudgetRecalcDiff[],
): boolean {
  return diffs.some((d) => !d.skipped && d.deltaCents !== 0);
}
