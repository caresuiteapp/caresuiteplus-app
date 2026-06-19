import { APP_LOCALE, APP_CURRENCY } from '@/lib/i18n/locale';

const numberFormatter = new Intl.NumberFormat(APP_LOCALE, {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const currencyFormatter = new Intl.NumberFormat(APP_LOCALE, {
  style: 'currency',
  currency: APP_CURRENCY,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** 1.234 oder 1.234,56 */
export function formatNumber(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '';
  return numberFormatter.format(value);
}

/** 1.234,56 € */
export function formatCurrency(
  value: number | null | undefined,
  cents = false,
): string {
  if (value == null || Number.isNaN(value)) return '';
  const amount = cents ? value / 100 : value;
  return currencyFormatter.format(amount);
}

/** 32,75 €/Std. */
export function formatHourlyRate(cents: number | null | undefined): string {
  if (cents == null || Number.isNaN(cents)) return '';
  return `${currencyFormatter.format(cents / 100)}/Std.`;
}

const documentAmountFormatter = new Intl.NumberFormat(APP_LOCALE, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** 45,00 — für Dokument-Platzhalter ohne Währungssymbol */
export function formatHourlyRateDocumentAmount(
  value: number | string | null | undefined,
): string {
  if (value == null) return '';
  if (typeof value === 'string') {
    const normalized = value.replace(',', '.').trim();
    if (!normalized) return '';
    const parsed = Number.parseFloat(normalized);
    if (!Number.isFinite(parsed) || parsed <= 0) return '';
    return documentAmountFormatter.format(parsed);
  }
  if (!Number.isFinite(value) || value <= 0) return '';
  return documentAmountFormatter.format(value);
}

/** Parst Stundensatz-Eingabe (z. B. „45,00“) in Euro-Betrag oder null */
export function parseHourlyRateEuro(value: string): number | null {
  const normalized = value.replace(',', '.').trim();
  if (!normalized) return null;
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}
