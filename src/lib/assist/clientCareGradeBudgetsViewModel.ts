import { formatBudgetPeriodLabelCapitalized } from '@/lib/assist/budgetPeriodLabels';
import { formatCurrency } from '@/lib/formatters/numberFormatters';
import {
  BUDGET_TEMPLATE_LABELS,
  type ClientAssistBillingProfile,
  type ClientBudgetAccount,
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
