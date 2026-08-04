import type {
  ClientAssistBillingProfile,
  ClientBudgetAccount,
  ClientCareGrade,
} from '@/types/assist/clientAssistBilling';

export type ClientBudgetVisualKind = 'entlastung' | 'umwandlung';

export type ClientBudgetVisualModel = {
  id: ClientBudgetVisualKind;
  title: string;
  legalLabel: string;
  totalCents: number;
  usedCents: number;
  reservedCents: number;
  availableCents: number;
  availableHours: number | null;
  hourlyRateCents: number | null;
  usedPercent: number;
  reservedPercent: number;
  availablePercent: number;
  periodLabel: string;
  expiryLabel: string;
  eligible: boolean;
  enabled: boolean;
  statusLabel: string;
  careGrade: ClientCareGrade | null;
  fullCareAllowanceCents: number | null;
  remainingCareAllowanceCents: number | null;
  externalSachleistungCents: number;
  explanation: string[];
};

/** Official 2026 values in cents. Keep versioned instead of deriving legal values in UI. */
export const CARE_BUDGET_VALUES_2026: Record<
  Exclude<ClientCareGrade, 'kein' | 'pg1' | 'hospiz'>,
  { sachleistungCents: number; conversionCents: number; careAllowanceCents: number }
> = {
  pg2: { sachleistungCents: 79_600, conversionCents: 31_840, careAllowanceCents: 34_700 },
  pg3: { sachleistungCents: 149_700, conversionCents: 59_880, careAllowanceCents: 59_900 },
  pg4: { sachleistungCents: 185_900, conversionCents: 74_360, careAllowanceCents: 80_000 },
  pg5: { sachleistungCents: 229_900, conversionCents: 91_960, careAllowanceCents: 99_000 },
};

export const ENTLASTUNGSBETRAG_2026_CENTS = 13_100;

function clamp(value: number, min = 0, max = Number.POSITIVE_INFINITY): number {
  return Math.min(max, Math.max(min, value));
}

function percent(part: number, total: number): number {
  if (total <= 0) return 0;
  return clamp(Math.round((part / total) * 100), 0, 100);
}

function hoursForCents(cents: number, hourlyRateCents: number | null): number | null {
  if (!hourlyRateCents || hourlyRateCents <= 0) return null;
  return Math.max(0, Math.round((cents / hourlyRateCents) * 100) / 100);
}

function accountFor(profile: ClientAssistBillingProfile, catalogKey: string): ClientBudgetAccount | null {
  return (profile.budgetVisualAccounts ?? profile.budgetAccounts)
    .filter((account) => account.catalogKey === catalogKey)
    .sort((a, b) => b.periodStart.localeCompare(a.periodStart))[0] ?? null;
}

function accountsFor(profile: ClientAssistBillingProfile, catalogKey: string): ClientBudgetAccount[] {
  return (profile.budgetVisualAccounts ?? profile.budgetAccounts).filter(
    (account) => account.catalogKey === catalogKey,
  );
}

function templateAmount(profile: ClientAssistBillingProfile, catalogKey: string): number | null {
  return profile.templates.find((template) => template.catalogKey === catalogKey)?.defaultAmountCents ?? null;
}

function resolveHourlyRate(profile: ClientAssistBillingProfile): number | null {
  return profile.serviceEntitlements.find((item) => (item.hourlyRateCents ?? 0) > 0)?.hourlyRateCents ?? null;
}

function accountTotal(account: ClientBudgetAccount | null, fallback: number): number {
  if (!account) return fallback;
  if (account.isIndividualOverride && account.individualAmountCents != null) {
    return Math.max(0, account.individualAmountCents);
  }
  return Math.max(0, account.allocatedCents || fallback);
}

export function conversionCatalogKeyForGrade(grade: ClientCareGrade | null): string | null {
  if (grade === 'pg2' || grade === 'pg3' || grade === 'pg4' || grade === 'pg5') {
    return `umwandlung_${grade}`;
  }
  return null;
}

export function calculateRemainingCareAllowanceCents(input: {
  careGrade: ClientCareGrade | null;
  conversionUsedCents: number;
  externalSachleistungCents?: number;
}): number | null {
  const { careGrade } = input;
  if (careGrade !== 'pg2' && careGrade !== 'pg3' && careGrade !== 'pg4' && careGrade !== 'pg5') {
    return null;
  }
  const values = CARE_BUDGET_VALUES_2026[careGrade];
  const usedSachleistung = clamp(
    input.conversionUsedCents + (input.externalSachleistungCents ?? 0),
    0,
    values.sachleistungCents,
  );
  const remainingRatio = 1 - usedSachleistung / values.sachleistungCents;
  return Math.round(values.careAllowanceCents * remainingRatio);
}

export function buildClientBudgetVisualModels(
  profile: ClientAssistBillingProfile,
): [ClientBudgetVisualModel, ClientBudgetVisualModel] {
  const hourlyRateCents = resolveHourlyRate(profile);
  const entlastungAccounts = accountsFor(profile, 'paragraph_45b');
  const entlastungAccount = entlastungAccounts[0] ?? null;
  const entlastungTotal = entlastungAccounts.length > 0
    ? entlastungAccounts.reduce((sum, account) => sum + accountTotal(account, 0), 0)
    : templateAmount(profile, 'paragraph_45b') ?? ENTLASTUNGSBETRAG_2026_CENTS;
  const entlastungUsed = clamp(
    entlastungAccounts.reduce((sum, account) => sum + account.usedCents, 0),
    0,
    entlastungTotal,
  );
  const entlastungReserved = clamp(
    entlastungAccounts.reduce((sum, account) => sum + account.reservedCents, 0),
    0,
    entlastungTotal - entlastungUsed,
  );
  const entlastungAvailable = clamp(entlastungTotal - entlastungUsed - entlastungReserved);

  const conversionKey = conversionCatalogKeyForGrade(profile.careGrade);
  const conversionAccount = conversionKey ? accountFor(profile, conversionKey) : null;
  const legalValues =
    profile.careGrade === 'pg2'
    || profile.careGrade === 'pg3'
    || profile.careGrade === 'pg4'
    || profile.careGrade === 'pg5'
      ? CARE_BUDGET_VALUES_2026[profile.careGrade]
      : null;
  const conversionEligible = legalValues !== null;
  const conversionFallback = legalValues?.conversionCents ?? 0;
  const conversionTotal = accountTotal(conversionAccount, conversionFallback);
  const conversionUsed = clamp(conversionAccount?.usedCents ?? 0, 0, conversionTotal);
  const conversionReserved = clamp(
    conversionAccount?.reservedCents ?? 0,
    0,
    conversionTotal - conversionUsed,
  );
  const conversionAvailable = clamp(conversionTotal - conversionUsed - conversionReserved);
  const externalSachleistungCents = conversionAccount?.externalSachleistungCents ?? 0;
  const conversionEnabled = conversionEligible && profile.careEntitlement?.conversionEnabled === true;

  const entlastung: ClientBudgetVisualModel = {
    id: 'entlastung',
    title: 'Entlastungsbetrag',
    legalLabel: '§ 45b SGB XI',
    totalCents: entlastungTotal,
    usedCents: entlastungUsed,
    reservedCents: entlastungReserved,
    availableCents: entlastungAvailable,
    availableHours: hoursForCents(entlastungAvailable, hourlyRateCents),
    hourlyRateCents,
    usedPercent: percent(entlastungUsed, entlastungTotal),
    reservedPercent: percent(entlastungReserved, entlastungTotal),
    availablePercent: percent(entlastungAvailable, entlastungTotal),
    periodLabel: 'Monatlicher Zugang · nicht verbrauchtes Budget wird übertragen',
    expiryLabel: `Guthaben ${profile.budgetYear} nutzbar bis 30.06.${profile.budgetYear + 1}`,
    eligible: profile.careGrade !== 'kein' && profile.careGrade !== 'hospiz' && profile.careGrade !== null,
    enabled: entlastungAccount?.isEnabled !== false,
    statusLabel: entlastungAccount?.isIndividualOverride ? 'Individueller Gesamtbetrag' : 'Automatisch aktiv',
    careGrade: profile.careGrade,
    fullCareAllowanceCents: null,
    remainingCareAllowanceCents: null,
    externalSachleistungCents: 0,
    explanation: [
      'Jeden Monat kommen 131,00 € hinzu. Der dargestellte Gesamtbetrag berücksichtigt einen individuell hinterlegten Übertrag.',
      'Geplante Einsätze werden vorgemerkt. Nach Abschluss und Freigabe wird der abrechenbare Betrag als Verbrauch fortgeschrieben.',
      `Nicht verbrauchtes Guthaben aus ${profile.budgetYear} kann grundsätzlich bis zum 30.06.${profile.budgetYear + 1} eingesetzt werden.`,
    ],
  };

  const remainingCareAllowance = calculateRemainingCareAllowanceCents({
    careGrade: profile.careGrade,
    conversionUsedCents: conversionUsed,
    externalSachleistungCents,
  });
  const umwandlung: ClientBudgetVisualModel = {
    id: 'umwandlung',
    title: '40-%-Umwandlung',
    legalLabel: '§ 45a Abs. 4 SGB XI',
    totalCents: conversionTotal,
    usedCents: conversionUsed,
    reservedCents: conversionReserved,
    availableCents: conversionAvailable,
    availableHours: hoursForCents(conversionAvailable, hourlyRateCents),
    hourlyRateCents,
    usedPercent: percent(conversionUsed, conversionTotal),
    reservedPercent: percent(conversionReserved, conversionTotal),
    availablePercent: percent(conversionAvailable, conversionTotal),
    periodLabel: 'Monatliches Potenzial · kein Übertrag in den Folgemonat',
    expiryLabel: 'Nicht genutzter Monatsbetrag verfällt zum Monatsende',
    eligible: conversionEligible,
    enabled: conversionEnabled,
    statusLabel: !conversionEligible
      ? 'Ab Pflegegrad 2 verfügbar'
      : conversionEnabled
        ? 'Für die Abrechnung aktiviert'
        : 'Noch nicht aktiviert · Potenzial sichtbar',
    careGrade: profile.careGrade,
    fullCareAllowanceCents: legalValues?.careAllowanceCents ?? null,
    remainingCareAllowanceCents: remainingCareAllowance,
    externalSachleistungCents,
    explanation: [
      'Bis zu 40 % des monatlichen Sachleistungsbetrags können für anerkannte Angebote zur Unterstützung im Alltag eingesetzt werden.',
      'Die Umwandlung wird wie eine genutzte Pflegesachleistung behandelt und mindert deshalb das anteilige Pflegegeld.',
      'Die Pflegegeldanzeige ist eine Prognose. Externe Sachleistungen eines Pflegedienstes müssen von der Verwaltung zusätzlich eingetragen werden.',
    ],
  };

  return [entlastung, umwandlung];
}
