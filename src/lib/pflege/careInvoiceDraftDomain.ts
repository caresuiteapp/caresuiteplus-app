export type CareInvoiceDraftSourceLine = {
  billingCaseId: string;
  serviceProofId: string;
  serviceDate: string;
  serviceCode: string;
  quantityMilli: number;
  unitAmountCents: number;
  amountCents: number;
  proofFingerprint: string;
};

export type CareInvoiceDraftSource = {
  foundationId: string;
  foundationNumber: string;
  tenantId: string;
  clientId: string;
  status: string;
  recipientName: string;
  recipientKey: string;
  recipientIk: string;
  totalAmountCents: number;
  lines: readonly CareInvoiceDraftSourceLine[];
};

export type CareInvoiceDraft = {
  foundationId: string;
  foundationNumber: string;
  tenantId: string;
  clientId: string;
  recipientName: string;
  recipientKey: string;
  recipientIk: string;
  paymentTermDays: number;
  totalAmountCents: number;
  positions: CareInvoiceDraftSourceLine[];
  status: 'draft';
};

function required(value: string, label: string): string {
  if (!value.trim()) throw new Error(`${label} fehlt.`);
  return value;
}

function calendarDate(value: string, label: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${label} ist ungültig.`);
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new Error(`${label} ist ungültig.`);
}

function checkedLineAmount(quantityMilli: number, unitAmountCents: number): number {
  if (!Number.isSafeInteger(quantityMilli) || quantityMilli <= 0) throw new Error('Positionsmenge ist ungültig.');
  if (!Number.isSafeInteger(unitAmountCents) || unitAmountCents < 0) throw new Error('Einzelpreis ist ungültig.');
  const product = quantityMilli * unitAmountCents;
  if (!Number.isSafeInteger(product) || product % 1000 !== 0) throw new Error('Menge und Einzelpreis ergeben keinen exakten Centbetrag.');
  return product / 1000;
}

export function buildCareInvoiceDraft(source: CareInvoiceDraftSource, paymentTermDays: number): CareInvoiceDraft {
  for (const [value, label] of [
    [source.foundationId, 'Rechnungsgrundlage'], [source.foundationNumber, 'Grundlagennummer'],
    [source.tenantId, 'Mandant'], [source.clientId, 'Pflegefall'], [source.recipientName, 'Empfänger'],
    [source.recipientKey, 'Empfängerschlüssel'],
  ] as const) required(value, label);
  if (source.status !== 'validated') throw new Error('Nur eine validierte Rechnungsgrundlage darf einen Entwurf erzeugen.');
  if (!Number.isInteger(paymentTermDays) || paymentTermDays < 1 || paymentTermDays > 365) throw new Error('Zahlungsziel muss zwischen 1 und 365 Tagen liegen.');
  if (!source.lines.length) throw new Error('Rechnung benötigt mindestens eine Einzelposition.');
  if (!Number.isSafeInteger(source.totalAmountCents) || source.totalAmountCents < 0) throw new Error('Gesamtbetrag ist ungültig.');

  const caseIds = new Set<string>();
  const proofIds = new Set<string>();
  let total = 0;
  const positions = source.lines.map((line) => {
    for (const [value, label] of [
      [line.billingCaseId, 'Abrechnungsfall-ID'], [line.serviceProofId, 'Leistungsnachweis-ID'],
      [line.serviceCode, 'Leistungscode'], [line.proofFingerprint, 'Freigabe-Fingerprint'],
    ] as const) required(value, label);
    calendarDate(line.serviceDate, 'Leistungsdatum');
    if (caseIds.has(line.billingCaseId)) throw new Error('Abrechnungsfall-ID ist doppelt.');
    if (proofIds.has(line.serviceProofId)) throw new Error('Leistungsnachweis-ID ist doppelt.');
    caseIds.add(line.billingCaseId); proofIds.add(line.serviceProofId);
    const calculated = checkedLineAmount(line.quantityMilli, line.unitAmountCents);
    if (!Number.isSafeInteger(line.amountCents) || line.amountCents !== calculated) throw new Error('Positionsbetrag stimmt nicht mit Menge und Einzelpreis überein.');
    total += line.amountCents;
    if (!Number.isSafeInteger(total)) throw new Error('Rechnungssumme überschreitet den sicheren Zahlenbereich.');
    return { ...line };
  });
  if (total !== source.totalAmountCents) throw new Error('Rechnungssumme stimmt nicht mit den nachvollziehbaren Einzelpositionen überein.');
  return {
    foundationId: source.foundationId, foundationNumber: source.foundationNumber, tenantId: source.tenantId,
    clientId: source.clientId, recipientName: source.recipientName, recipientKey: source.recipientKey,
    recipientIk: source.recipientIk, paymentTermDays, totalAmountCents: total, positions,
    status: 'draft',
  };
}
