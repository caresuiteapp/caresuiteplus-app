import { type BillingCase, type ServiceLine } from './model';

/** Decimal inputs are parsed as integers, avoiding binary rounding in persisted money. */
export function parseHundredths(value: string): number {
  if (!/^\d{1,10}([.,]\d{0,2})?$/.test(value)) return NaN;
  const [whole, fraction = ''] = value.replace(',', '.').split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}
export function lineTotal(line: ServiceLine): number {
  if (![line.unitPriceCents, line.quantityHundredths].every(Number.isSafeInteger)) return NaN;
  return Number((BigInt(line.unitPriceCents) * BigInt(line.quantityHundredths) + 50n) / 100n);
}
export function withLines(item: BillingCase, lines: ServiceLine[]): BillingCase {
  return { ...item, lines, grossCents: lines.reduce((sum, line) => sum + line.totalCents, 0) };
}
export function newLine(): ServiceLine {
  return { day: '', startTime: '', remuneration: '', qualification: '', code: '', duration: '00',
    unitPriceCents: 0, quantityHundredths: 100, totalCents: 0, employeeNumber: '' };
}
