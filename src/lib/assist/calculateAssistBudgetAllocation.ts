/**
 * Automatic budget allocation for Assist assignments — spec §16B.
 * Pure calculation from client billing profile; cent-only math.
 */
import type { RoleKey } from '@/types';
import type { ClientAssistBillingProfile, ClientBudgetAccount } from '@/types/assist/clientAssistBilling';
import {
  BUDGET_TEMPLATE_LABELS,
  isConversionEligibleForGrade,
} from '@/types/assist/clientAssistBilling';
import type {
  AssistBudgetAllocationInput,
  AssistBudgetAllocationResult,
  BudgetAllocationProposalLine,
  ManualBudgetAllocationOverride,
} from '@/types/assist/assignmentBudgetAllocation';
import { getUmwandlungTemplateKeyForGrade } from './budgetTemplateCatalogService';
import { computeAvailableCents } from './clientBudgetTransactionService';
import { getClientAssistBillingProfile } from './clientAssistBillingProfileService';
import { hasPermission } from '@/lib/permissions/check';

const PREVENTIVE_KEYS = new Set(['verhinderungspflege', 'kurzzeitpflege', 'gemeinsames_jahresbudget']);
const NON_RESERVABLE_KEYS = new Set(['kulanz', 'ungeklaert']);

/** Cent-accurate: plannedMinutes * hourlyRateCents / 60 */
export function computeAssignmentAmountCents(
  plannedMinutes: number,
  hourlyRateCents: number,
): number {
  if (plannedMinutes <= 0 || hourlyRateCents <= 0) return 0;
  return Math.round((plannedMinutes * hourlyRateCents) / 60);
}

function accountLabel(account: ClientBudgetAccount): string {
  return (
    account.label
    ?? BUDGET_TEMPLATE_LABELS[account.catalogKey as keyof typeof BUDGET_TEMPLATE_LABELS]
    ?? account.catalogKey
  );
}

function hasSelfPayerAgreement(profile: ClientAssistBillingProfile): boolean {
  return profile.serviceEntitlements.some(
    (s) => s.isActive && (s.billingMode === 'self_payer' || s.billingMode === 'mixed'),
  );
}

function isPreventiveCareActivated(
  profile: ClientAssistBillingProfile,
  catalogKey: string,
): boolean {
  if (catalogKey === 'gemeinsames_jahresbudget') {
    return profile.budgetAccounts.some(
      (a) => a.catalogKey === 'gemeinsames_jahresbudget' && a.status === 'active',
    );
  }
  if (catalogKey === 'verhinderungspflege') {
    return profile.serviceEntitlements.some(
      (s) => s.isActive && s.serviceTypeKey?.includes('verhinderung') === true,
    );
  }
  return false;
}

function isUmwandlungEligible(profile: ClientAssistBillingProfile): boolean {
  if (!isConversionEligibleForGrade(profile.careGrade)) return false;
  if (!profile.careEntitlement?.conversionEnabled) return false;
  return true;
}

function buildPriorityOrderedAccounts(profile: ClientAssistBillingProfile): ClientBudgetAccount[] {
  const jointAccount = profile.budgetAccounts.find(
    (a) => a.catalogKey === 'gemeinsames_jahresbudget' && a.status === 'active',
  );
  const useJoint =
    !!jointAccount
    && computeAvailableCents(jointAccount) > 0
    && isPreventiveCareActivated(profile, 'gemeinsames_jahresbudget');

  const umwandlungKey = getUmwandlungTemplateKeyForGrade(profile.careGrade);

  const orderedKeys: string[] = ['paragraph_45b'];
  if (umwandlungKey) {
    orderedKeys.push(umwandlungKey);
  }
  if (useJoint) {
    orderedKeys.push('gemeinsames_jahresbudget');
  } else if (profile.budgetAccounts.some((a) => a.catalogKey === 'verhinderungspflege')) {
    orderedKeys.push('verhinderungspflege');
  }
  orderedKeys.push('selbstzahler', 'kulanz', 'ungeklaert');

  const accountByKey = new Map(profile.budgetAccounts.map((a) => [a.catalogKey, a]));
  const result: ClientBudgetAccount[] = [];

  for (const key of orderedKeys) {
    const account = accountByKey.get(key);
    if (account && account.status === 'active') {
      result.push(account);
    }
  }
  return result;
}

function canAutoUseAccount(
  profile: ClientAssistBillingProfile,
  account: ClientBudgetAccount,
): { allowed: boolean; reason: string } {
  if (account.status !== 'active' || account.isEnabled === false || account.locked) {
    return { allowed: false, reason: 'Budgetkonto nicht aktiv' };
  }
  if (account.catalogKey.startsWith('umwandlung_')) {
    if (profile.careGrade === 'pg1') {
      return {
        allowed: false,
        reason: 'Umwandlungsanspruch in Assist nicht automatisch verfügbar bei PG1',
      };
    }
    if (!isUmwandlungEligible(profile)) {
      return { allowed: false, reason: 'Umwandlung nicht aktiviert oder freigegeben' };
    }
  }
  if (account.catalogKey === 'verhinderungspflege') {
    if (!isPreventiveCareActivated(profile, 'verhinderungspflege')) {
      return { allowed: false, reason: 'Verhinderungspflege nicht aktiviert oder freigegeben' };
    }
  }
  if (account.catalogKey === 'gemeinsames_jahresbudget') {
    if (!isPreventiveCareActivated(profile, 'gemeinsames_jahresbudget')) {
      return { allowed: false, reason: 'Gemeinsames Jahresbudget nicht aktiviert' };
    }
  }
  if (NON_RESERVABLE_KEYS.has(account.catalogKey)) {
    return { allowed: false, reason: 'Kein automatischer Abrechnungstopf' };
  }
  const canUse = profile.canUseBudgetByCatalogKey[account.catalogKey];
  if (canUse === false && account.catalogKey !== 'selbstzahler') {
    return { allowed: false, reason: 'Kein verfügbares Restbudget' };
  }
  return { allowed: true, reason: '' };
}

export function calculateAssistBudgetAllocationFromProfile(
  profile: ClientAssistBillingProfile,
  input: Omit<
    AssistBudgetAllocationInput,
    'tenantId' | 'clientId' | 'profile' | 'assignmentDate'
  > & { assignmentDate?: string },
): AssistBudgetAllocationResult {
  const warnings: string[] = [...profile.warnings.map((w) => w.message)];
  const totalAmountCents = computeAssignmentAmountCents(
    input.plannedMinutes,
    input.hourlyRateCents,
  );

  if (!profile.careGrade || profile.careGrade === 'kein') {
    warnings.push('Pflegegrad fehlt — automatische Kassenabrechnung eingeschränkt.');
  }

  if (profile.careGrade === 'pg1' && profile.careEntitlement?.conversionEnabled) {
    warnings.push('Pflegegrad 1 — Umwandlungsanspruch wird nicht automatisch verwendet.');
  }

  const selfPayerAgreement = hasSelfPayerAgreement(profile);
  let remaining = totalAmountCents;
  let priorityCounter = 1;
  const proposal: BudgetAllocationProposalLine[] = [];
  let statutoryAmountCents = 0;
  let selfPayerAmountCents = 0;
  let primaryCatalogKey: string | null = null;

  const orderedAccounts = buildPriorityOrderedAccounts(profile);

  for (const account of orderedAccounts) {
    const { allowed, reason: blockReason } = canAutoUseAccount(profile, account);
    const available = computeAvailableCents(account);
    const label = accountLabel(account);

    if (remaining <= 0) {
      proposal.push({
        priorityOrder: priorityCounter++,
        catalogKey: account.catalogKey,
        budgetAccountId: account.id,
        label,
        amountCents: 0,
        status: 'not_needed',
        reason: 'Gesamtbetrag bereits abgedeckt',
      });
      continue;
    }

    if (!allowed) {
      proposal.push({
        priorityOrder: priorityCounter++,
        catalogKey: account.catalogKey,
        budgetAccountId: account.id,
        label,
        amountCents: 0,
        status: 'blocked',
        reason: blockReason,
      });
      if (account.catalogKey.startsWith('umwandlung_') && !isUmwandlungEligible(profile)) {
        warnings.push('Umwandlung nicht aktiviert — wird nicht verwendet.');
      }
      if (account.catalogKey === 'verhinderungspflege' && !isPreventiveCareActivated(profile, 'verhinderungspflege')) {
        warnings.push('Verhinderungspflege nicht aktiviert — wird nicht verwendet.');
      }
      continue;
    }

    if (account.catalogKey === 'selbstzahler') {
      const amount = remaining;
      selfPayerAmountCents = amount;
      if (amount > 0 && !selfPayerAgreement) {
        warnings.push('Selbstzahlervereinbarung fehlt — Speichern nur mit Sonderberechtigung.');
      }
      proposal.push({
        priorityOrder: priorityCounter++,
        catalogKey: account.catalogKey,
        budgetAccountId: account.id,
        label,
        amountCents: amount,
        status: amount > 0 ? 'used' : 'not_needed',
        reason:
          amount > 0
            ? selfPayerAgreement
              ? 'Restbetrag Selbstzahler'
              : 'Restbetrag Selbstzahler (Vereinbarung fehlt)'
            : 'Nicht benötigt',
      });
      remaining = 0;
      continue;
    }

    const take = Math.min(remaining, Math.max(0, available));
    if (take <= 0 && account.catalogKey !== 'selbstzahler') {
      proposal.push({
        priorityOrder: priorityCounter++,
        catalogKey: account.catalogKey,
        budgetAccountId: account.id,
        label,
        amountCents: 0,
        status: 'blocked',
        reason: 'Budget erschöpft',
      });
      if (account.catalogKey === 'paragraph_45b') {
        warnings.push('Entlastungsbetrag ausgeschöpft.');
      }
      continue;
    }

    if (!primaryCatalogKey && take > 0 && !NON_RESERVABLE_KEYS.has(account.catalogKey)) {
      primaryCatalogKey = account.catalogKey;
    }

    statutoryAmountCents += take;
    remaining -= take;

    proposal.push({
      priorityOrder: priorityCounter++,
      catalogKey: account.catalogKey,
      budgetAccountId: account.id,
      label,
      amountCents: take,
      status: 'used',
      reason:
        take > 0
          ? account.catalogKey === 'paragraph_45b'
            ? 'Restbudget §45b vorhanden'
            : `Anteil aus ${label}`
          : 'Nicht benötigt',
    });
  }

  if (remaining > 0 && selfPayerAmountCents === 0) {
    selfPayerAmountCents = remaining;
    proposal.push({
      priorityOrder: priorityCounter++,
      catalogKey: 'selbstzahler',
      budgetAccountId: null,
      label: BUDGET_TEMPLATE_LABELS.selbstzahler ?? 'Selbstzahler',
      amountCents: remaining,
      status: 'used',
      reason: selfPayerAgreement
        ? 'Keine Kassenbudgets — Selbstzahler'
        : 'Keine Kassenbudgets — Selbstzahler (Vereinbarung fehlt)',
    });
    if (!selfPayerAgreement) {
      warnings.push('Selbstzahlervereinbarung fehlt.');
    }
    remaining = 0;
  }

  if (totalAmountCents > 0 && statutoryAmountCents + selfPayerAmountCents < totalAmountCents) {
    warnings.push('Budget reicht nicht vollständig — Prüfung erforderlich.');
  }

  let requiresManualApproval = warnings.some(
    (w) =>
      w.includes('Selbstzahlervereinbarung fehlt')
      || w.includes('Pflegegrad fehlt')
      || w.includes('ungeklärt'),
  );
  let auditRequired = false;

  if (input.manualOverride) {
    return applyManualOverride(
      profile,
      input.manualOverride,
      totalAmountCents,
      input.actorRoleKey ?? null,
      warnings,
    );
  }

  const canSave =
    totalAmountCents === 0
    || statutoryAmountCents > 0
    || (selfPayerAmountCents > 0 && selfPayerAgreement)
    || hasPermission(input.actorRoleKey, 'assist.assignment.budget.use_self_payer')
    || hasPermission(input.actorRoleKey, 'assist.assignment.budget.mark_unclear');

  if (selfPayerAmountCents > 0 && !selfPayerAgreement) {
    requiresManualApproval = true;
  }

  return {
    totalAmountCents,
    allocationProposal: proposal,
    selfPayerAmountCents,
    statutoryAmountCents,
    primaryCatalogKey,
    warnings,
    canSave,
    requiresManualApproval,
    auditRequired,
    hasSelfPayerAgreement: selfPayerAgreement,
  };
}

function applyManualOverride(
  profile: ClientAssistBillingProfile,
  override: ManualBudgetAllocationOverride,
  totalAmountCents: number,
  actorRoleKey: RoleKey | null,
  baseWarnings: string[],
): AssistBudgetAllocationResult {
  const warnings = [...baseWarnings];
  const canOverride = hasPermission(actorRoleKey, 'assist.assignment.budget.override');

  if (!canOverride) {
    warnings.push('Manuelle Überschreibung ohne Berechtigung blockiert.');
    return {
      totalAmountCents,
      allocationProposal: [],
      selfPayerAmountCents: 0,
      statutoryAmountCents: 0,
      primaryCatalogKey: null,
      warnings,
      canSave: false,
      requiresManualApproval: true,
      auditRequired: false,
      hasSelfPayerAgreement: hasSelfPayerAgreement(profile),
    };
  }

  if (!override.reason.trim()) {
    warnings.push('Manuelle Überschreibung erfordert Pflichtgrund.');
    return {
      totalAmountCents,
      allocationProposal: [],
      selfPayerAmountCents: 0,
      statutoryAmountCents: 0,
      primaryCatalogKey: override.catalogKey,
      warnings,
      canSave: false,
      requiresManualApproval: true,
      auditRequired: true,
      hasSelfPayerAgreement: hasSelfPayerAgreement(profile),
    };
  }

  const account = profile.budgetAccounts.find((a) => a.catalogKey === override.catalogKey);
  const amount = override.amountCents > 0 ? override.amountCents : totalAmountCents;
  const isSelfPayer = override.catalogKey === 'selbstzahler';

  return {
    totalAmountCents,
    allocationProposal: [
      {
        priorityOrder: 1,
        catalogKey: override.catalogKey,
        budgetAccountId: account?.id ?? null,
        label:
          account?.label
          ?? BUDGET_TEMPLATE_LABELS[override.catalogKey as keyof typeof BUDGET_TEMPLATE_LABELS]
          ?? override.catalogKey,
        amountCents: amount,
        status: 'used',
        reason: `Manuelle Korrektur: ${override.reason}`,
      },
    ],
    selfPayerAmountCents: isSelfPayer ? amount : Math.max(0, totalAmountCents - amount),
    statutoryAmountCents: isSelfPayer ? 0 : amount,
    primaryCatalogKey: override.catalogKey,
    warnings,
    canSave: true,
    requiresManualApproval: true,
    auditRequired: true,
    hasSelfPayerAgreement: hasSelfPayerAgreement(profile),
  };
}

/** Async wrapper — loads profile then calculates. */
export async function calculateAssistBudgetAllocation(
  input: AssistBudgetAllocationInput,
): Promise<
  import('@/types').ServiceResult<AssistBudgetAllocationResult>
> {
  const { runService } = await import('@/lib/services/serviceRunner');
  const { guardServiceTenant } = await import('@/lib/services/liveServiceGuard');

  return runService(async () => {
    const denied = guardServiceTenant(input.tenantId);
    if (denied) return denied;

    let profile = input.profile;
    if (!profile) {
      const profileResult = await getClientAssistBillingProfile({
        tenantId: input.tenantId,
        clientId: input.clientId,
        date: input.assignmentDate,
      });
      if (!profileResult.ok) return profileResult;
      profile = profileResult.data;
    }

    const data = calculateAssistBudgetAllocationFromProfile(profile, input);
    return { ok: true, data };
  });
}

/** Expand recurrence dates for series budget simulation (spec §9). */
export function expandVisitRecurrenceDates(input: {
  assignmentDate: string;
  recurrencePattern: import('./visitTypes').VisitRecurrencePattern;
  recurrenceWeekdays?: import('./visitTypes').VisitWeekdayKey[];
  recurrenceEndDate?: string | null;
  recurrenceOccurrenceCount?: number | null;
  maxOccurrences?: number;
}): string[] {
  const { assignmentDate, recurrencePattern } = input;
  if (recurrencePattern === 'none') return [assignmentDate.slice(0, 10)];

  const max = input.maxOccurrences ?? input.recurrenceOccurrenceCount ?? 52;
  const endDate = input.recurrenceEndDate
    ? new Date(`${input.recurrenceEndDate.slice(0, 10)}T23:59:59`)
    : null;
  const dates: string[] = [];
  const start = new Date(`${assignmentDate.slice(0, 10)}T12:00:00`);

  const weekdayMap: Record<string, number> = {
    so: 0,
    mo: 1,
    di: 2,
    mi: 3,
    do: 4,
    fr: 5,
    sa: 6,
  };
  const targetWeekdays =
    input.recurrenceWeekdays && input.recurrenceWeekdays.length > 0
      ? input.recurrenceWeekdays.map((d) => weekdayMap[d])
      : [start.getDay()];

  let cursor = new Date(start);
  let safety = 0;

  while (dates.length < max && safety < 400) {
    safety += 1;
    if (endDate && cursor > endDate) break;

    if (recurrencePattern === 'daily') {
      dates.push(cursor.toISOString().slice(0, 10));
      cursor.setDate(cursor.getDate() + 1);
    } else if (recurrencePattern === 'weekly' || recurrencePattern === 'biweekly') {
      if (targetWeekdays.includes(cursor.getDay())) {
        dates.push(cursor.toISOString().slice(0, 10));
      }
      cursor.setDate(cursor.getDate() + 1);
      if (cursor.getDay() === start.getDay() && recurrencePattern === 'biweekly') {
        if (dates.length > 0 && dates.length % targetWeekdays.length === 0) {
          cursor.setDate(cursor.getDate() + 7);
        }
      }
    } else if (recurrencePattern === 'monthly') {
      if (dates.length === 0 || cursor.getDate() === start.getDate()) {
        dates.push(cursor.toISOString().slice(0, 10));
      }
      cursor.setMonth(cursor.getMonth() + 1);
    }
  }

  return dates.length > 0 ? dates : [assignmentDate.slice(0, 10)];
}

export type SeriesBudgetAllocationSummary = {
  occurrenceDates: string[];
  perOccurrence: AssistBudgetAllocationResult[];
  cumulativeWarnings: string[];
  seriesCanSave: boolean;
};

/** Simulate budget allocation per recurrence occurrence with running balances. */
export function calculateSeriesBudgetAllocations(
  profile: ClientAssistBillingProfile,
  input: Omit<AssistBudgetAllocationInput, 'profile' | 'tenantId' | 'clientId'>,
  occurrenceDates: string[],
): SeriesBudgetAllocationSummary {
  const workingProfile: ClientAssistBillingProfile = JSON.parse(JSON.stringify(profile));
  const perOccurrence: AssistBudgetAllocationResult[] = [];
  const cumulativeWarnings: string[] = [];

  for (const date of occurrenceDates) {
    const result = calculateAssistBudgetAllocationFromProfile(workingProfile, {
      ...input,
      assignmentDate: date,
    });
    perOccurrence.push(result);
    cumulativeWarnings.push(...result.warnings);

    for (const line of result.allocationProposal) {
      if (line.amountCents <= 0 || !line.budgetAccountId) continue;
      const account = workingProfile.budgetAccounts.find((a) => a.id === line.budgetAccountId);
      if (account) {
        account.reservedCents += line.amountCents;
      }
    }
  }

  const seriesCanSave = perOccurrence.every((r) => r.canSave);

  return {
    occurrenceDates,
    perOccurrence,
    cumulativeWarnings: [...new Set(cumulativeWarnings)],
    seriesCanSave,
  };
}

export function resolveHourlyRateCents(
  profile: ClientAssistBillingProfile,
  serviceType?: string | null,
  fallbackCents = 3275,
): number {
  const match = profile.serviceEntitlements.find(
    (s) =>
      s.isActive
      && s.hourlyRateCents != null
      && (serviceType ? s.serviceTypeKey === serviceType : true),
  );
  return match?.hourlyRateCents ?? fallbackCents;
}
