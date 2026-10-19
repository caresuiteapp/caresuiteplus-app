import { type BillingCase, type ServiceLine } from './model';
import { calculatePrice } from './pricing';

/** Decimal inputs are parsed as integers, avoiding binary rounding in persisted money. */
export function parseHundredths(value: string): number {
  if (!/^\d{1,10}([.,]\d{0,2})?$/.test(value)) return NaN;
  const [whole, fraction = ''] = value.replace(',', '.').split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}
export function lineTotal(line: ServiceLine): number {
  try { return calculatePrice(line).totalCents; } catch { return NaN; }
}
export function recalculateLine(line: ServiceLine): ServiceLine {
  try { return { ...line, ...calculatePrice(line) }; } catch {
    // An incomplete contract can remain a draft; malformed money cannot be saved.
    return { ...line, totalCents: [line.unitPriceCents,line.quantityHundredths].every(n => Number.isSafeInteger(n) && n >= 0) ? 0 : Number.NaN };
  }
}
export function withLines(item: BillingCase, lines: ServiceLine[]): BillingCase {
  return { ...item, lines, grossCents: lines.reduce((sum, line) => sum + line.totalCents, 0) };
}
export function newLine(): ServiceLine {
  return { day: '', startTime: '', remuneration: '', qualification: '', code: '', duration: '00',
    unitPriceCents: 0, quantityHundredths: 100, totalCents: 0, employeeNumber: '' };
}
