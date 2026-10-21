export type CareInvoiceApprovalPosition = {
  positionNo: number;
  billingCaseId: string;
  serviceProofId: string;
  serviceDate: string;
  serviceCode: string;
  quantityMilli: number;
  unitAmountCents: number;
  amountCents: number;
  proofFingerprint: string;
};

export type CareInvoiceApprovalCandidate = {
  invoiceDraftId: string;
  invoiceNumber: string;
  tenantId: string;
  clientId: string;
  draftVersion: number;
  status: string;
  createdBy: string;
  createdAt: string;
  issuedAt: string;
  dueDate: string;
  issuerName: string;
  issuerAddress: string;
  issuerTaxReference: string;
  recipientName: string;
  recipientKey: string;
  recipientAddress: string;
  totalAmountCents: number;
  positions: readonly CareInvoiceApprovalPosition[];
};

export type CareInvoiceApprovalInput = {
  taxTreatment: 'tax_exempt_healthcare' | 'taxable';
  taxRateBasisPoints: number;
  netAmountCents: number;
  taxAmountCents: number;
  taxLegalReference: string;
  reviewerNote: string;
};

export type CareInvoiceApprovalSnapshot = CareInvoiceApprovalCandidate & CareInvoiceApprovalInput & {
  reviewerId: string;
  approvalVersion: 1;
  approvalStatus: 'approved';
  transmissionStatus: 'not_transmitted';
  paymentStatus: 'not_inferred';
};

const exactUtcMicros = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}(?:Z|\+00:00)$/;
function required(value: string, label: string): string {
  if (!value.trim()) throw new Error(`${label} fehlt.`);
  return value;
}
function safeNonNegative(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} ist ungültig.`);
  return value;
}
function calendarDate(value: string, label: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${label} ist ungültig.`);
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new Error(`${label} ist ungültig.`);
}

export function buildCareInvoiceApprovalSnapshot(
  candidate: CareInvoiceApprovalCandidate,
  input: CareInvoiceApprovalInput,
  reviewerId: string,
): CareInvoiceApprovalSnapshot {
  for (const [value, label] of [
    [candidate.invoiceDraftId, 'Rechnungsentwurf'], [candidate.invoiceNumber, 'Rechnungsnummer'],
    [candidate.tenantId, 'Mandant'], [candidate.clientId, 'Pflegefall'], [candidate.createdBy, 'Entwurfsverfasser'],
    [candidate.issuerName, 'Aussteller'], [candidate.issuerAddress, 'Ausstelleranschrift'],
    [candidate.issuerTaxReference, 'Steuerkennung'], [candidate.recipientName, 'Empfänger'],
    [candidate.recipientKey, 'Empfängerschlüssel'], [candidate.recipientAddress, 'Empfängeranschrift'],
    [reviewerId, 'Prüferidentität'], [input.taxLegalReference, 'Steuer-/Rechtsgrundlage'],
    [input.reviewerNote, 'Prüfvermerk'],
  ] as const) required(value, label);
  if (candidate.status !== 'draft') throw new Error('Nur ein unveränderter Entwurf darf freigegeben werden.');
  if (!Number.isInteger(candidate.draftVersion) || candidate.draftVersion < 1) throw new Error('Entwurfsfassung ist ungültig.');
  if (reviewerId === candidate.createdBy) throw new Error('Entwurf und Freigabe benötigen zwei verschiedene Identitäten.');
  if (!exactUtcMicros.test(candidate.createdAt) || !exactUtcMicros.test(candidate.issuedAt)) throw new Error('Entwurfszeiten benötigen exakt sechs UTC-Mikrosekundenstellen.');
  calendarDate(candidate.dueDate, 'Fälligkeitsdatum');
  if (candidate.dueDate < candidate.issuedAt.slice(0, 10)) throw new Error('Fälligkeitsdatum liegt vor dem Ausstellungsdatum.');
  if (!candidate.positions.length) throw new Error('Freigabe benötigt mindestens eine Position.');
  safeNonNegative(candidate.totalAmountCents, 'Gesamtbetrag');

  const caseIds = new Set<string>(); const proofIds = new Set<string>(); let total = 0;
  candidate.positions.forEach((position, index) => {
    if (position.positionNo !== index + 1) throw new Error('Positionsreihenfolge ist nicht lückenlos.');
    for (const [value, label] of [
      [position.billingCaseId, 'Abrechnungsfall-ID'], [position.serviceProofId, 'Leistungsnachweis-ID'],
      [position.serviceCode, 'Leistungscode'], [position.proofFingerprint, 'Freigabe-Fingerprint'],
    ] as const) required(value, label);
    calendarDate(position.serviceDate, 'Leistungsdatum');
    if (caseIds.has(position.billingCaseId) || proofIds.has(position.serviceProofId)) throw new Error('Positionen enthalten doppelte Originalidentitäten.');
    caseIds.add(position.billingCaseId); proofIds.add(position.serviceProofId);
    if (!Number.isSafeInteger(position.quantityMilli) || position.quantityMilli <= 0) throw new Error('Positionsmenge ist ungültig.');
    safeNonNegative(position.unitAmountCents, 'Einzelpreis'); safeNonNegative(position.amountCents, 'Positionsbetrag');
    const product = position.quantityMilli * position.unitAmountCents;
    if (!Number.isSafeInteger(product) || product % 1000 !== 0 || product / 1000 !== position.amountCents) throw new Error('Positionsbetrag ist nicht exakt nachrechenbar.');
    total += position.amountCents;
    if (!Number.isSafeInteger(total)) throw new Error('Rechnungssumme überschreitet den sicheren Zahlenbereich.');
  });
  if (total !== candidate.totalAmountCents) throw new Error('Rechnungssumme stimmt nicht mit den Positionen überein.');

  const net = safeNonNegative(input.netAmountCents, 'Nettobetrag');
  const tax = safeNonNegative(input.taxAmountCents, 'Steuerbetrag');
  if (!Number.isInteger(input.taxRateBasisPoints) || input.taxRateBasisPoints < 0 || input.taxRateBasisPoints > 10000) throw new Error('Steuersatz ist ungültig.');
  if (net + tax !== total) throw new Error('Netto- und Steuerbetrag stimmen nicht mit dem Gesamtbetrag überein.');
  if (input.taxTreatment === 'tax_exempt_healthcare') {
    if (input.taxRateBasisPoints !== 0 || tax !== 0 || net !== total) throw new Error('Steuerbefreite Rechnung benötigt null Steuer und den Gesamtbetrag als Netto.');
  } else if (input.taxTreatment === 'taxable') {
    if (input.taxRateBasisPoints <= 0 || Math.round(net * input.taxRateBasisPoints / 10000) !== tax) throw new Error('Steuerbetrag stimmt nicht mit Nettobetrag und Steuersatz überein.');
  } else {
    throw new Error('Steuerbehandlung ist ungültig.');
  }
  if (input.reviewerNote.trim().length < 5) throw new Error('Prüfvermerk ist zu kurz.');

  return {
    ...candidate, positions: candidate.positions.map((position) => ({ ...position })), ...input, reviewerId,
    approvalVersion: 1, approvalStatus: 'approved', transmissionStatus: 'not_transmitted', paymentStatus: 'not_inferred',
  };
}

export type CareInvoiceApprovalRequest = {
  invoiceDraftId: string;
  expectedDraftVersion: number;
  expectedDraftCreatedAt: string;
  taxTreatment: CareInvoiceApprovalInput['taxTreatment'];
  taxRateBasisPoints: number;
  netAmountCents: number;
  taxAmountCents: number;
  taxLegalReference: string;
  reviewerNote: string;
  clientRequestId: string;
};

export function validateCareInvoiceApprovalRequest(value: CareInvoiceApprovalRequest): CareInvoiceApprovalRequest {
  required(value.invoiceDraftId, 'Rechnungsentwurf'); required(value.clientRequestId, 'Anforderungs-ID');
  required(value.taxLegalReference, 'Steuer-/Rechtsgrundlage'); required(value.reviewerNote, 'Prüfvermerk');
  if (!Number.isInteger(value.expectedDraftVersion) || value.expectedDraftVersion < 1) throw new Error('Entwurfsfassung ist ungültig.');
  if (!exactUtcMicros.test(value.expectedDraftCreatedAt)) throw new Error('Erwartete Entwurfszeit benötigt exakt sechs UTC-Mikrosekundenstellen.');
  safeNonNegative(value.netAmountCents, 'Nettobetrag'); safeNonNegative(value.taxAmountCents, 'Steuerbetrag');
  if (!Number.isInteger(value.taxRateBasisPoints) || value.taxRateBasisPoints < 0 || value.taxRateBasisPoints > 10000) throw new Error('Steuersatz ist ungültig.');
  if (!['tax_exempt_healthcare', 'taxable'].includes(value.taxTreatment)) throw new Error('Steuerbehandlung ist ungültig.');
  if (value.reviewerNote.trim().length < 5) throw new Error('Prüfvermerk ist zu kurz.');
  return { ...value };
}
