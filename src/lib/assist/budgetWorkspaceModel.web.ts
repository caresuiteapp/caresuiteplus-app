import type { ClientAssistBillingProfile, ClientBillingWarning, ClientBudgetAccount } from '@/types/assist/clientAssistBilling';
import { BUDGET_TEMPLATE_LABELS, isConversionEligibleForGrade } from '@/types/assist/clientAssistBilling';
import { isActivePlannedVisit, derivePlannedVisitAmountCents } from './clientAssistBillingProfileService';

export type BudgetPlanningVisit = Parameters<typeof isActivePlannedVisit>[0];
export type BudgetPlanningAllocation = { assignment_id: string; budget_account_id: string | null; planned_amount_cents: number | null; reserved_amount_cents: number | null; allocation_status: string };
export type BudgetReservation = { reference_id: string | null; budget_account_id: string; amount_cents: number; reference_type: string | null };
export type BudgetPlanningProjection = { accounts: ClientBudgetAccount[]; additionalCents: number; unallocatedCents: number; unpricedVisits: number };

export function validBudgetDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function currentBudgetDate(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

/** Keep every bucket that can be used on the chosen day, including §45b carry-over. */
export function currentWorkspaceAccounts(accounts: ClientBudgetAccount[], asOfDate: string): ClientBudgetAccount[] {
  const seen = new Set<string>();
  return accounts.filter((account) => {
    if (seen.has(account.id) || account.status === 'closed' || account.periodStart > asOfDate || account.periodEnd < asOfDate) return false;
    seen.add(account.id);
    return true;
  });
}

function cents(value: unknown): number { const n = Number(value); return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0; }

/** The ledger stays authoritative. Add only planning which has no matching active reservation. */
export function projectWorkspacePlanning(input: {
  accounts: ClientBudgetAccount[]; visits: BudgetPlanningVisit[]; allocations: BudgetPlanningAllocation[];
  reservations: BudgetReservation[]; hourlyRateCents: number | null;
}): BudgetPlanningProjection {
  const accounts = input.accounts.map((account) => ({ ...account }));
  const byId = new Map(accounts.map((account) => [account.id, account]));
  const ledger = new Map<string, number>();
  for (const row of input.reservations) {
    if (row.reference_type !== 'assist_visit' || !row.reference_id) continue;
    const key = `${row.reference_id}:${row.budget_account_id}`;
    ledger.set(key, (ledger.get(key) ?? 0) + cents(row.amount_cents));
  }
  let additionalCents = 0;
  let unallocatedCents = 0;
  let unpricedVisits = 0;
  const add = (account: ClientBudgetAccount, amount: number) => { account.reservedCents += amount; additionalCents += amount; };
  for (const visit of input.visits.filter(isActivePlannedVisit)) {
    const linked = input.allocations.filter((row) => row.assignment_id === visit.id && ['planned', 'reserved'].includes(row.allocation_status) && Math.max(cents(row.planned_amount_cents), cents(row.reserved_amount_cents)) > 0);
    if (linked.length) {
      const planned = new Map<string, number>();
      for (const row of linked) {
        const amount = Math.max(cents(row.planned_amount_cents), cents(row.reserved_amount_cents));
        if (!row.budget_account_id) { unallocatedCents += amount; continue; }
        planned.set(row.budget_account_id, (planned.get(row.budget_account_id) ?? 0) + amount);
      }
      for (const [accountId, amount] of planned) {
        const missing = Math.max(0, amount - (ledger.get(`${visit.id}:${accountId}`) ?? 0));
        const account = byId.get(accountId);
        if (account && account.periodStart <= visit.assignment_date && account.periodEnd >= visit.assignment_date && account.status === 'active' && account.isEnabled !== false && !account.locked) add(account, missing);
        else unallocatedCents += missing;
      }
      continue;
    }
    const booked = input.reservations.filter((row) => row.reference_type === 'assist_visit' && row.reference_id === visit.id).reduce((sum, row) => sum + cents(row.amount_cents), 0);
    const estimate = derivePlannedVisitAmountCents(visit, input.hourlyRateCents);
    if (!Number.isFinite(estimate) || estimate <= 0) { if (!booked) unpricedVisits += 1; continue; }
    let remaining = Math.max(0, estimate - booked);
    const eligible = accounts.filter((account) => account.status === 'active' && account.isEnabled !== false && !account.locked
      && account.periodStart <= visit.assignment_date && account.periodEnd >= visit.assignment_date
      && (!visit.billing_budget_source_key || account.catalogKey === visit.billing_budget_source_key))
      .sort((a, b) => a.billingPriority - b.billingPriority || a.periodEnd.localeCompare(b.periodEnd) || a.periodStart.localeCompare(b.periodStart));
    for (const account of eligible) {
      const share = Math.min(remaining, Math.max(0, account.allocatedCents - account.usedCents - account.reservedCents));
      add(account, share); remaining -= share;
      if (!remaining) break;
    }
    unallocatedCents += remaining;
  }
  return { accounts: accounts.map((account) => ({ ...account, remainingCents: account.allocatedCents - account.usedCents - account.reservedCents })), additionalCents, unallocatedCents, unpricedVisits };
}

export function workspaceAvailability(accounts: ClientBudgetAccount[], profile: Pick<ClientAssistBillingProfile, 'careGrade' | 'careEntitlement' | 'fundingSources'>): Record<string, boolean> {
  const flags: Record<string, boolean> = {};
  for (const account of accounts) {
    const usable = account.status === 'active' && account.isEnabled !== false && !account.locked && account.allocatedCents > account.usedCents + account.reservedCents;
    flags[account.catalogKey] = (flags[account.catalogKey] ?? false) || usable;
    if (account.catalogKey === 'paragraph_45b' && !['pg1', 'pg2', 'pg3', 'pg4', 'pg5'].includes(profile.careGrade ?? '')) flags[account.catalogKey] = false;
    if (['verhinderungspflege', 'gemeinsames_jahresbudget', 'kurzzeitpflege'].includes(account.catalogKey) && !isConversionEligibleForGrade(profile.careGrade)) flags[account.catalogKey] = false;
    if (account.catalogKey.startsWith('umwandlung_') && (!isConversionEligibleForGrade(profile.careGrade) || !profile.careEntitlement?.conversionEnabled || account.catalogKey !== `umwandlung_${profile.careGrade}`)) flags[account.catalogKey] = false;
  }
  return flags;
}

export function buildWorkspaceWarnings(tenantId: string, clientId: string, profile: ClientAssistBillingProfile, projection?: Omit<BudgetPlanningProjection, 'accounts'>, existingAccounts = profile.budgetAccounts): ClientBillingWarning[] {
  const warnings: ClientBillingWarning[] = [];
  const add = (type: string, message: string, severity: ClientBillingWarning['severity'] = 'warning', account?: ClientBudgetAccount) => warnings.push({ id: `current:${type}:${account?.id ?? ''}`, tenantId, clientId, warningType: type, severity, catalogKey: account?.catalogKey ?? null, budgetAccountId: account?.id ?? null, message, isResolved: false, resolvedAt: null, createdAt: `${profile.asOfDate}T12:00:00.000Z` });
  const selected = profile.fundingSources ?? [];
  if (selected.some((source) => source !== 'selbstzahler') && (!profile.careGrade || profile.careGrade === 'kein' || profile.careGrade === 'hospiz')) add('missing_care_grade', 'Für die gewählten Kassenleistungen fehlt ein gültiger Pflegegrad. Bitte den Anspruch prüfen.');
  if (selected.includes('umwandlung') && !isConversionEligibleForGrade(profile.careGrade)) add('conversion_ineligible', 'Die gewählte Umwandlung ist erst ab Pflegegrad 2 verfügbar.', 'critical');
  else if (selected.includes('umwandlung') && !profile.careEntitlement?.conversionEnabled) add('conversion_not_enabled', 'Die Umwandlung ist ausgewählt, aber im Anspruch noch nicht aktiviert.');
  if (!profile.budgetAccounts.length && profile.templates.some((template) => (template.autoGenerate || template.catalogKey === 'gemeinsames_jahresbudget' && profile.budgetYear === 2026) && template.defaultAmountCents != null)) add('no_budget_accounts', `Für den ${profile.asOfDate} sind noch keine nutzbaren Budgetkonten angelegt.`, 'info');
  if (profile.budgetYear === 2026) {
    const prevention = existingAccounts.filter((account) => account.catalogYear === profile.budgetYear);
    const hasSplit = prevention.some((account) => ['verhinderungspflege', 'kurzzeitpflege'].includes(account.catalogKey));
    const hasJoint = prevention.some((account) => account.catalogKey === 'gemeinsames_jahresbudget');
    if (hasSplit && hasJoint) add('prevention_duplicate_accounts', 'Es bestehen getrennte Konten und ein gemeinsames Jahresbudget für Verhinderungs- und Kurzzeitpflege. Der gemeinsame Jahresbetrag beträgt 2026 insgesamt 3.539,00 €. Bitte die vorhandenen Zuteilungen und Buchungen abstimmen, bevor Budget erhöht wird.', 'critical');
    else if (hasSplit) add('prevention_legacy_accounts', 'Es bestehen getrennte Bestandskonten für Verhinderungs- oder Kurzzeitpflege. Seit Juli 2025 gilt ein gemeinsamer Jahresbetrag, 2026 insgesamt 3.539,00 €. Vor einer Umstellung müssen vorhandene Zuteilungen und Buchungen geprüft werden, damit kein Budget doppelt zugeteilt wird.', 'warning');
  }
  for (const account of profile.budgetAccounts) {
    if (account.status !== 'active' || account.isEnabled === false || account.locked) continue;
    const remaining = account.allocatedCents - account.usedCents - account.reservedCents;
    const label = account.label?.trim() || BUDGET_TEMPLATE_LABELS[account.catalogKey as keyof typeof BUDGET_TEMPLATE_LABELS] || account.catalogKey;
    if (remaining < 0) add('budget_overdrawn', `„${label}“ ist um ${new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(-remaining / 100)} überplant oder überschritten.`, 'critical', account);
    else if (remaining === 0 && account.allocatedCents > 0) add('budget_exhausted', `„${label}“ ist vollständig verbraucht oder verplant.`, 'warning', account);
    else if (remaining > 0 && remaining < account.allocatedCents * 0.1) add('budget_low', `Bei „${label}“ sind weniger als 10 % verfügbar.`, 'info', account);
  }
  if (projection?.additionalCents) add('planning_projection', 'Noch nicht verbuchte Einsatzplanung dieses Monats ist in „Geplant“ berücksichtigt. Diese Beträge sind eine Prognose.', 'info');
  if (projection?.unallocatedCents) add('planning_unallocated', `${new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(projection.unallocatedCents / 100)} aus der Einsatzplanung dieses Monats lassen sich keinem verfügbaren Budget zuordnen. Bitte die Einsatzplanung prüfen.`, 'warning');
  if (projection?.unpricedVisits) add('planning_unpriced', `${projection.unpricedVisits} geplante Einsätze dieses Monats können ohne Betrag oder gültigen Stundensatz nicht eingerechnet werden.`, 'warning');
  for (const service of profile.serviceEntitlements.filter((item) => item.billingMode === 'unclear')) add(`billing_unclear:${service.id}`, `Die Abrechnung für „${service.serviceTypeKey ?? 'Leistung'}“ ist ungeklärt.`);
  return warnings;
}
