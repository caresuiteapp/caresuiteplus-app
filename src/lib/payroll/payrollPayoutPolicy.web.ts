/**
 * Verified 2026-10-18 against primary sources:
 * 2024–2026: https://www.minijob-zentrale.de/DE/die-minijobs/minijob-mit-verdienstgrenze
 * 2027: https://magazin.minijob-zentrale.de/minijob-grenze-2027/
 * This preserves the application's monthly payout policy. These reference amounts
 * are not a substitute for the individual annual/social-insurance assessment.
 */
export const PAYROLL_MINIJOB_MONTHLY_REFERENCE_CENTS: Readonly<Record<number, number>> = {
  2024: 53_800,
  2025: 55_600,
  2026: 60_300,
  2027: 63_300,
};

export function isMiniJobEmploymentType(value: unknown): boolean {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return normalized === 'mini_job' || normalized === 'minijob';
}

export function resolvePayrollMaxPayoutHours(input: {
  periodYear: number;
  employmentType: unknown;
  compensationType: unknown;
  compensationAmount: unknown;
  configuredMaxPayoutHours: unknown;
}): number | null {
  const configured = input.configuredMaxPayoutHours;
  if (configured != null && (typeof configured !== 'number' || !Number.isFinite(configured) || configured < 0)) {
    throw new Error('Die hinterlegte monatliche Auszahlungsgrenze ist ungültig.');
  }
  const configuredHours = configured == null ? null : configured as number;
  if (!isMiniJobEmploymentType(input.employmentType) || input.compensationType !== 'hourly') return configuredHours;
  const monthlyReferenceCents = PAYROLL_MINIJOB_MONTHLY_REFERENCE_CENTS[input.periodYear];
  if (!monthlyReferenceCents) {
    throw new Error(`Für ${input.periodYear} ist noch keine geprüfte Minijob-Verdienstgrenze hinterlegt. Die automatische Berechnung benötigt eine aktualisierte Jahresregel.`);
  }
  if (typeof input.compensationAmount !== 'number' || !Number.isFinite(input.compensationAmount) || input.compensationAmount <= 0) {
    throw new Error('Für die Minijob-Berechnung fehlt ein gültiger Stundenlohn.');
  }
  const hourlyRateCents = Math.round((input.compensationAmount + Number.EPSILON * Math.max(1, input.compensationAmount)) * 100);
  if (!Number.isSafeInteger(hourlyRateCents) || hourlyRateCents <= 0) throw new Error('Der Stundenlohn ist ungültig.');
  const referenceHours = monthlyReferenceCents / hourlyRateCents;
  return configuredHours == null ? referenceHours : Math.min(configuredHours, referenceHours);
}
