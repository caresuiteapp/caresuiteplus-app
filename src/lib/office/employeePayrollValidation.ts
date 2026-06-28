import { validateIban, normalizeIban } from '@/lib/tenant/tenantValidation';

export function normalizeSteuerId(raw: string): string {
  return raw.replace(/\s/g, '');
}

export function validateSteuerId(raw: string): string | null {
  const normalized = normalizeSteuerId(raw);
  if (!normalized) return null;
  if (!/^\d{11}$/.test(normalized)) {
    return 'Steuer-Identifikationsnummer muss genau 11 Ziffern haben.';
  }
  return null;
}

export function normalizeSocialSecurityNumber(raw: string): string {
  return raw.replace(/\s/g, '').toUpperCase();
}

/** Deutsche Sozialversicherungsnummer: 8 Ziffern + Buchstabe + 3 Ziffern */
export function validateSocialSecurityNumber(raw: string): string | null {
  const normalized = normalizeSocialSecurityNumber(raw);
  if (!normalized) return null;
  if (!/^\d{8}[A-Z]\d{3}$/.test(normalized)) {
    return 'Versicherungsnummer: Format 8 Ziffern + Buchstabe + 3 Ziffern (z. B. 12150565M007).';
  }
  return null;
}

export function validateEmployeeIban(raw: string): string | null {
  const normalized = normalizeIban(raw);
  if (!normalized) return null;
  return validateIban(normalized);
}

const DE_BLZ_BANK_NAMES: Record<string, string> = {
  '37040044': 'Commerzbank',
  '10070848': 'Deutsche Bank',
  '50010517': 'ING',
  '70150000': 'Stadtsparkasse München',
  '76050101': 'Sparkasse Nürnberg',
  '20050550': 'Hamburger Sparkasse',
  '10050000': 'Berliner Sparkasse',
  '44010046': 'Postbank',
  '66010075': 'Sparkasse Karlsruhe',
};

export function deriveBankNameFromIban(iban: string | null | undefined): string | null {
  const normalized = normalizeIban(iban ?? '');
  if (!normalized.startsWith('DE') || normalized.length < 12) return null;
  const blz = normalized.slice(4, 12);
  return DE_BLZ_BANK_NAMES[blz] ?? null;
}

export function sumWorkDayHours(schedule: Record<string, number>): number {
  return Object.values(schedule).reduce((sum, hours) => sum + (Number.isFinite(hours) ? hours : 0), 0);
}

export function calculateProRatedVacationDays(
  annualVacationDays: number | null,
  entryDate: string | null,
  referenceYear: number = new Date().getFullYear(),
): number | null {
  if (annualVacationDays == null) return null;
  if (!entryDate) return annualVacationDays;

  const entry = new Date(entryDate);
  if (Number.isNaN(entry.getTime())) return annualVacationDays;

  if (entry.getFullYear() < referenceYear) return annualVacationDays;
  if (entry.getFullYear() > referenceYear) return 0;

  const monthsRemaining = 12 - entry.getMonth();
  const proRated = (annualVacationDays / 12) * monthsRemaining;
  return Math.round(proRated * 10) / 10;
}
