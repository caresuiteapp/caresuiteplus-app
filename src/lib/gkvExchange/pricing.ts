import type { ServiceLine } from './model';
import { calculateAdjustments } from './adjustments';

/** Integer arithmetic only. Rounding is commercial, once at the documented boundary. */
function round(numerator: bigint, denominator: bigint): bigint {
  if (numerator < 0n || denominator <= 0n) throw new Error('Ungültige Berechnungsgrundlage.');
  return (numerator * 2n + denominator) / (denominator * 2n);
}
export function fixedDecimal(value: unknown, whole: number, scale: number): bigint | null {
  if (typeof value !== 'string' || !new RegExp(`^\\d{1,${whole}}(?:[.,]\\d{1,${scale}})?$`).test(value)) return null;
  const [integer, fraction = ''] = value.replace(',', '.').split('.');
  return BigInt(integer) * 10n ** BigInt(scale) + BigInt(fraction.padEnd(scale, '0'));
}
export function formatFixed(value: string, whole: number, scale: number): string {
  const parsed = fixedDecimal(value, whole, scale);
  if (parsed === null) throw new Error('Ungültiger Dezimalwert.');
  const factor = 10n ** BigInt(scale);
  return `${parsed / factor},${String(parsed % factor).padStart(scale, '0')}`;
}
export const TIME_UNIT_MINUTES: Record<string, number> = { '1': 1, '2': 5, '3': 15, '4': 60, '5': 1440, '6': 10 };
export const PRICING_RULES = {
  time_proportional: 'Zeitanteilig; Rundung des Positionsbetrags auf Cent',
  time_started_unit: 'Je angefangener Zeiteinheit; Rundung des Positionsbetrags auf Cent',
  kilometres_rounded: 'Ganze, kaufmännisch gerundete Kilometer × Preis × Anzahl',
  points_unit: 'Punktwert × Punkte; Einzelpreis auf Cent, danach × Menge',
} as const;
export type PricingRule = keyof typeof PRICING_RULES;
export type PriceResult = { totalCents: number; unitPriceCents: number; duration: string };

/** Contract choice is explicit: TA defines the fields, not a nationwide tariff or rounding contract. */
export function calculateBasePrice(line: ServiceLine): PriceResult {
  if (![line.unitPriceCents, line.quantityHundredths].every(n => Number.isSafeInteger(n) && n >= 0)
      || line.unitPriceCents > 999999999999 || line.quantityHundredths < 1 || line.quantityHundredths > 999999) throw new Error('Einzelpreis oder Menge ist ungültig.');
  let price = BigInt(line.unitPriceCents), multiplier = 1n, divisor = 1n, duration = line.duration;
  const points = Boolean(line.pointValue || line.points);
  const special = line.remuneration === '02' || (line.remuneration === '06' && line.code === '04') || points;
  if (special && (typeof line.contractReference !== 'string' || !line.contractReference.trim() || line.contractReference.length > 200)) throw new Error('Vertragsgrundlage für Berechnung und Rundung angeben.');
  if (line.remuneration === '02') {
    if (points || !['time_proportional', 'time_started_unit'].includes(line.pricingRule || '')) throw new Error('Die vertragliche Berechnung der Zeitvergütung auswählen.');
    const unit = TIME_UNIT_MINUTES[line.code?.[0]];
    if (!unit || !/^[1-6][0-9A-D]$/.test(line.code) || !/^\d{1,4}$/.test(duration) || Number(duration) < 1) throw new Error('Zeitart und tatsächliche Dauer in Minuten erforderlich.');
    multiplier = BigInt(duration); divisor = BigInt(unit);
    if (line.pricingRule === 'time_started_unit') { multiplier = (multiplier + divisor - 1n) / divisor; divisor = 1n; }
  } else if (line.remuneration === '06' && line.code === '04') {
    if (points || line.pricingRule !== 'kilometres_rounded') throw new Error('Die vertragliche Kilometerberechnung bestätigen.');
    const distance = fixedDecimal(line.distanceKm, 4, 2);
    if (distance === null || distance <= 0n) throw new Error('Tatsächlich gefahrene Kilometer mit höchstens zwei Nachkommastellen angeben.');
    multiplier = round(distance, 100n);
    if (multiplier > 9999n) throw new Error('Gerundete Kilometer überschreiten die Feldlänge.');
    duration = String(multiplier);
  } else if (points) {
    if (line.remuneration !== '01' || line.pricingRule !== 'points_unit') throw new Error('Punktwerte sind hier nur für Leistungskomplexe mit bestätigter Einzelpreisrundung verfügbar.');
    const value = fixedDecimal(line.pointValue, 1, 5);
    if (value === null || value <= 0n || typeof line.points !== 'string' || !/^\d{1,4}$/.test(line.points) || Number(line.points) < 1) throw new Error('Punktwert (bis fünf Nachkommastellen) und positive Punktzahl erforderlich.');
    price = round(value * BigInt(line.points), 1000n);
  } else if (line.pricingRule) throw new Error('Berechnungsregel passt nicht zur gewählten Vergütungsart.');
  const total = round(price * multiplier * BigInt(line.quantityHundredths), divisor * 100n);
  if (total > 999999999999n) throw new Error('Positionsbetrag überschreitet die Feldlänge.');
  return { totalCents: Number(total), unitPriceCents: Number(price), duration };
}

export function calculatePrice(line: ServiceLine): PriceResult {
  const base = calculateBasePrice(line);
  const adjustments = calculateAdjustments(line, base.totalCents);
  return { ...base, totalCents: base.totalCents + adjustments.reduce((sum, entry) => sum + entry.signedCents, 0) };
}
