// Generated native presentation from src/lib/assist/clientBudgetVisuals.web.ts. Update through scripts/port-native-workspaces.mjs.
import type { ClientAssistBillingProfile, ClientBudgetAccount } from '@/types/assist/clientAssistBilling';
import { buildClientBudgetVisualModels as legacyModels, CARE_BUDGET_VALUES_2026, ENTLASTUNGSBETRAG_2026_CENTS, conversionCatalogKeyForGrade, calculateRemainingCareAllowanceCents, type ClientBudgetVisualModel as NativeBudgetVisualModel } from './clientBudgetVisuals.ts';
export { CARE_BUDGET_VALUES_2026, ENTLASTUNGSBETRAG_2026_CENTS, conversionCatalogKeyForGrade, calculateRemainingCareAllowanceCents };
export type { ClientBudgetVisualKind, ClientBudgetBookingState } from './clientBudgetVisuals.ts';
export type ClientBudgetVisualModel = NativeBudgetVisualModel & {
    balanceKnown?: boolean;
};
const money = (value: number | null | undefined) => Number.isFinite(value) ? Math.max(0, Math.round(value!)) : 0;
/** Web balances display the actual ledger and retain an overdrawn amount. */
export function buildClientBudgetVisualModels(profile: ClientAssistBillingProfile): [
    ClientBudgetVisualModel,
    ClientBudgetVisualModel
] {
    const original = legacyModels(profile);
    const all = (profile.budgetVisualAccounts ?? profile.budgetAccounts).filter((account) => account.periodStart <= profile.asOfDate && account.periodEnd >= profile.asOfDate && account.status !== 'closed');
    const usable = (account: ClientBudgetAccount) => account.status === 'active' && account.isEnabled !== false && !account.locked;
    const grades = ['pg1', 'pg2', 'pg3', 'pg4', 'pg5'];
    const rates = [...new Set(profile.serviceEntitlements.filter((service) => service.isActive && service.validFrom <= profile.asOfDate && (!service.validUntil || service.validUntil >= profile.asOfDate)).map((service) => service.hourlyRateCents).filter((rate): rate is number => rate != null && Number.isFinite(rate) && rate > 0))];
    const hourlyRate = rates.length === 1 ? rates[0] : rates.length > 1 ? null : (profile.catalogHourlyRateCents && profile.catalogHourlyRateCents > 0 ? profile.catalogHourlyRateCents : null);
    const conversionKey = conversionCatalogKeyForGrade(profile.careGrade);
    return original.map((base) => {
        const conversion = base.id === 'umwandlung';
        const catalogKey = conversion ? conversionKey : 'paragraph_45b';
        const eligible = conversion ? Boolean(conversionKey) : Boolean(profile.careGrade && grades.includes(profile.careGrade));
        const booked = profile.fundingSources ? profile.fundingSources.includes(conversion ? 'umwandlung' : 'entlastungsleistung') : conversion ? profile.careEntitlement?.conversionEnabled === true : true;
        let accounts = all.filter((account) => account.catalogKey === catalogKey && usable(account));
        // Conversion is a monthly balance; overlapping suspended or old grade rows never enlarge it.
        if (conversion)
            accounts = accounts.filter((account) => account.periodStart.slice(0, 7) === profile.asOfDate.slice(0, 7)).sort((a, b) => b.periodStart.localeCompare(a.periodStart)).slice(0, 1);
        const template = profile.templates.find((item) => item.catalogKey === catalogKey);
        const legal = profile.budgetYear === 2026 && conversionKey ? CARE_BUDGET_VALUES_2026[profile.careGrade as keyof typeof CARE_BUDGET_VALUES_2026] : null;
        const fallback = profile.budgetYear === 2026 ? (conversion ? legal?.conversionCents ?? 0 : ENTLASTUNGSBETRAG_2026_CENTS) : 0;
        const previewTotal = money(template?.defaultAmountCents ?? fallback);
        let total = !eligible ? 0 : !booked ? previewTotal : accounts.reduce((sum, account) => sum + money(account.allocatedCents), 0);
        const used = eligible && booked ? accounts.reduce((sum, account) => sum + money(account.usedCents), 0) : 0;
        const reserved = eligible && booked ? accounts.reduce((sum, account) => sum + money(account.reservedCents), 0) : 0;
        const external = conversion && booked ? money(accounts[0]?.externalSachleistungCents) : 0;
        if (conversion && legal && booked)
            total = Math.min(total, Math.max(0, legal.sachleistungCents - external));
        const available = total - used - reserved;
        const denominator = Math.max(total, used + reserved);
        const usedPercent = denominator ? Math.min(100, used / denominator * 100) : 0;
        const reservedPercent = denominator ? Math.min(100 - usedPercent, reserved / denominator * 100) : 0;
        const enabled = eligible && booked && accounts.length > 0 && (!conversion || profile.careEntitlement?.conversionEnabled === true);
        const disabledAccount = all.some((account) => account.catalogKey === catalogKey && !usable(account));
        const statusLabel = !eligible ? (conversion ? 'Ab Pflegegrad 2 verfügbar' : 'Gültiger Pflegegrad erforderlich') : !booked ? 'Noch nicht gebucht · unverbindliches Potenzial' : !accounts.length ? (disabledAccount ? 'Budgetkonto gesperrt oder deaktiviert' : 'Kein Budgetkonto für diesen Zeitraum') : conversion && !profile.careEntitlement?.conversionEnabled ? 'Leistung gebucht · Aktivierung noch offen' : 'Leistung gebucht · aktuelles Budget';
        const earliestExpiry = accounts.map((account) => account.periodEnd).sort()[0];
        const expiryLabel = !conversion && earliestExpiry ? `Nächster Ablauf am ${earliestExpiry.slice(8, 10)}.${earliestExpiry.slice(5, 7)}.${earliestExpiry.slice(0, 4)}` : base.expiryLabel;
        const explanation = conversion ? [
            'Die Umwandlung kann bis zu 40 % des monatlichen Sachleistungsbetrags umfassen. Bereits erfasste externe Sachleistungen begrenzen den noch nutzbaren Betrag.',
            'Die Pflegegeldanzeige ist eine Prognose aus dem gebuchten Verbrauch und den erfassten externen Sachleistungen. Geplante Einsätze sind noch nicht abgezogen.',
            'Ohne Erfassung der Leistungen anderer Anbieter lässt sich der tatsächliche Anspruch nicht abschließend bestimmen.',
        ] : [
            'Angezeigt werden vorhandene, aktive Budgetkonten im gewählten Zeitraum einschließlich noch gültiger Überträge. Das Öffnen der Übersicht legt keine neuen Konten an.',
            '„Geplant“ enthält gespeicherte Reservierungen und ergänzend noch nicht verbuchte Einsatzplanung. Verbrauch wird aus den Budgetkonten übernommen.',
            'Für den tatsächlichen Erstattungsanspruch sind der Bescheid und bereits außerhalb von CareSuite abgerechnete Leistungen maßgeblich.',
        ];
        if (rates.length > 1)
            explanation.push('Es sind unterschiedliche Stundensätze hinterlegt. Deshalb wird keine pauschale Stundenprognose angezeigt.');
        if (external)
            explanation.push('Der dargestellte Gesamtbetrag berücksichtigt die erfassten Sachleistungen anderer Anbieter.');
        return { ...base, totalCents: total, usedCents: used, reservedCents: reserved, availableCents: available,
            availableHours: enabled && hourlyRate ? Math.floor(Math.max(0, available) / hourlyRate * 100) / 100 : null,
            hourlyRateCents: hourlyRate, usedPercent, reservedPercent, availablePercent: denominator ? Math.max(0, 100 - usedPercent - reservedPercent) : 0,
            eligible, enabled, balanceKnown: eligible && (!booked || accounts.length > 0), bookingState: !eligible ? 'not_eligible' : booked ? 'booked' : 'preview', statusLabel, expiryLabel,
            externalSachleistungCents: external, fullCareAllowanceCents: legal?.careAllowanceCents ?? null,
            remainingCareAllowanceCents: legal && booked && accounts.length > 0 ? calculateRemainingCareAllowanceCents({ careGrade: profile.careGrade, conversionUsedCents: used, externalSachleistungCents: external }) : null,
            explanation,
        };
    }) as [
        ClientBudgetVisualModel,
        ClientBudgetVisualModel
    ];
}
export function buildClientBudgetVisualPlaceholders(asOfDate = new Date().toISOString().slice(0, 10)): [
    ClientBudgetVisualModel,
    ClientBudgetVisualModel
] {
    const profile: ClientAssistBillingProfile = { asOfDate, budgetYear: Number(asOfDate.slice(0, 4)), careGrade: null, careEntitlement: null, conversionEligible: false, carePreventionMode: 'separate_preventive_short_term', serviceEntitlements: [], budgetAccounts: [], priorityRules: [], warnings: [], templates: [], canUseBudgetByCatalogKey: {} };
    return buildClientBudgetVisualModels(profile).map((model) => ({ ...model, bookingState: 'loading' as const, enabled: false, totalCents: 0, usedCents: 0, reservedCents: 0, availableCents: 0, availableHours: null, statusLabel: 'Budgetdaten werden geladen' })) as [
        ClientBudgetVisualModel,
        ClientBudgetVisualModel
    ];
}
