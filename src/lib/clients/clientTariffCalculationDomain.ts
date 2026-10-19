import type {
  ClientTariffPosition,
  ClientTariffRoundingRule,
} from '@/lib/clients/clientTariffPositionDomain';

const MAX_AMOUNT_CENTS = 999_999_999n;

export type ClientTariffCalculation = {
  positionId: string;
  financingPathId: string;
  billingUnit: ClientTariffPosition['billingUnit'];
  normalizedQuantity: string;
  roundingRule: ClientTariffRoundingRule;
  unitPriceCents: number;
  baseAmountCents: number;
  percentageSurchargeCents: number;
  fixedSurchargeCents: number;
  totalAmountCents: number;
};

function parseQuantity(value: string): { thousandths: bigint; normalized: string } {
  if (typeof value !== 'string' || !/^\d{1,5}(?:[,.]\d{1,3})?$/.test(value)) {
    throw new Error('Menge muss als positive Dezimalzahl mit höchstens drei Nachkommastellen vorliegen.');
  }
  const [whole, fraction = ''] = value.replace(',', '.').split('.');
  const thousandths = BigInt(whole!) * 1000n + BigInt(fraction.padEnd(3, '0'));
  if (thousandths <= 0n) throw new Error('Menge muss größer als null sein.');
  const normalizedFraction = fraction.replace(/0+$/, '');
  return {
    thousandths,
    normalized: normalizedFraction ? `${BigInt(whole!)}.${normalizedFraction}` : BigInt(whole!).toString(),
  };
}

function roundPositiveRatio(numerator: bigint, denominator: bigint, rule: ClientTariffRoundingRule): bigint {
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  if (rule === 'floor_cent' || remainder === 0n) return quotient;
  if (rule === 'ceil_cent') return quotient + 1n;
  return remainder * 2n >= denominator ? quotient + 1n : quotient;
}

function safeCents(value: bigint, field: string): number {
  if (value < 0n || value > MAX_AMOUNT_CENTS) throw new Error(`${field} überschreitet die zulässige Betragsgrenze.`);
  return Number(value);
}

export function calculateClientTariffAmount(
  position: ClientTariffPosition,
  quantity: string,
): ClientTariffCalculation {
  if (!position.id || !position.financingPathId) throw new Error('Tarifposition und Finanzierungsweg müssen nativ gebunden sein.');
  if (!Number.isSafeInteger(position.unitPriceCents) || position.unitPriceCents <= 0) throw new Error('Tarifpreis ist ungültig.');
  if (position.roundingRule === null) throw new Error('Dokumentierte Rundungsregel fehlt.');
  if (!['half_up_cent', 'ceil_cent', 'floor_cent'].includes(position.roundingRule)) throw new Error('Rundungsregel ist ungültig.');
  if (position.surchargeBasisPoints === null
    || !Number.isSafeInteger(position.surchargeBasisPoints)
    || position.surchargeBasisPoints < 0
    || position.surchargeBasisPoints > 10000) {
    throw new Error('Dokumentierter prozentualer Zuschlag fehlt oder ist ungültig.');
  }
  if (position.fixedSurchargeCents === null
    || !Number.isSafeInteger(position.fixedSurchargeCents)
    || position.fixedSurchargeCents < 0) {
    throw new Error('Dokumentierter Festzuschlag fehlt oder ist ungültig.');
  }

  const parsed = parseQuantity(quantity);
  const baseAmount = roundPositiveRatio(
    parsed.thousandths * BigInt(position.unitPriceCents),
    1000n,
    position.roundingRule,
  );
  const percentageSurcharge = roundPositiveRatio(
    baseAmount * BigInt(position.surchargeBasisPoints),
    10000n,
    position.roundingRule,
  );
  const fixedSurcharge = BigInt(position.fixedSurchargeCents);
  const total = baseAmount + percentageSurcharge + fixedSurcharge;

  return {
    positionId: position.id,
    financingPathId: position.financingPathId,
    billingUnit: position.billingUnit,
    normalizedQuantity: parsed.normalized,
    roundingRule: position.roundingRule,
    unitPriceCents: position.unitPriceCents,
    baseAmountCents: safeCents(baseAmount, 'Grundbetrag'),
    percentageSurchargeCents: safeCents(percentageSurcharge, 'Prozentualer Zuschlag'),
    fixedSurchargeCents: safeCents(fixedSurcharge, 'Festzuschlag'),
    totalAmountCents: safeCents(total, 'Gesamtbetrag'),
  };
}
