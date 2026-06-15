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
