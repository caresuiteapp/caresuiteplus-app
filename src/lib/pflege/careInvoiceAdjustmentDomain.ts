export type CareInvoiceLedgerPosition = {
  positionNo: number;
  billingCaseId: string;
  serviceProofId: string;
  amountCents: number;
};

export type CareReleasedInvoice = {
  invoiceApprovalId: string;
  invoiceDraftId: string;
  invoiceNumber: string;
  tenantId: string;
  clientId: string;
  claimLineageId: string;
  documentFingerprint: string;
  createdByUserId: string;
  approvedByUserId: string;
  approvedAt: string;
  approvalState: 'approved' | string;
  totalAmountCents: number;
  positions: readonly CareInvoiceLedgerPosition[];
};

export type CareInvoiceCreditPosition = {
  originalPositionNo: number;
  billingCaseId: string;
  serviceProofId: string;
  creditAmountCents: number;
};

export type CareReplacementInvoice = CareReleasedInvoice & {
  replacesInvoiceApprovalId: string;
};

export type CareInvoiceAdjustmentRequest = {
  clientRequestId: string;
  adjustmentId: string;
  adjustmentNumber: string;
  adjustmentKind: 'full_cancellation' | 'partial_credit' | 'cancel_and_rebill' | string;
  adjustmentBasis: 'documented_billing_correction' | string;
  reason: string;
  createdByUserId: string;
  approvedByUserId: string;
  approvedAt: string;
  documentFingerprint: string;
  creditPositions: readonly CareInvoiceCreditPosition[];
  creditTotalCents: number;
  replacementInvoice: CareReplacementInvoice | null;
};

export type CareInvoiceAdjustmentRecord = CareInvoiceAdjustmentRequest & {
  originalInvoice: CareReleasedInvoice;
  ledger: {
    originalDebitCents: number;
    counterEntryCents: number;
    replacementDebitCents: number;
    resultingBalanceCents: number;
  };
  chainAction: 'append_only_invoice_adjustment';
  carrierReturnEffect: 'none';
  transmissionStatus: 'not_inferred';
  paymentStatus: 'not_inferred';
};

const exactUtcMicros = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}(?:Z|\+00:00)$/;
const fingerprint = /^[0-9a-f]{32}$/;

function required(value: string, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} fehlt.`);
  return value.trim();
}

function exactMicros(value: string, label: string): void {
  if (!exactUtcMicros.test(value) || Number.isNaN(Date.parse(value))) throw new Error(`${label} benötigt exakt sechs UTC-Mikrosekundenstellen.`);
}

function compareUtcMicros(left: string, right: string): number {
  return left.replace('+00:00', 'Z').localeCompare(right.replace('+00:00', 'Z'));
}

function cents(value: number, label: string, positive = false): void {
  if (!Number.isSafeInteger(value) || value < 0 || (positive && value === 0)) throw new Error(`${label} ist ungültig.`);
}

function validateReleasedInvoice(invoice: CareReleasedInvoice, label: string): CareInvoiceLedgerPosition[] {
  for (const [value, field] of [
    [invoice.invoiceApprovalId, `${label}-Freigabe`],
    [invoice.invoiceDraftId, `${label}-Entwurf`], [invoice.invoiceNumber, `${label}-Nummer`],
    [invoice.tenantId, `${label}-Mandant`], [invoice.clientId, `${label}-Pflegefall`],
    [invoice.claimLineageId, `${label}-Forderungshistorie`], [invoice.createdByUserId, `${label}-Ersteller`],
    [invoice.approvedByUserId, `${label}-Prüfer`],
  ] as const) required(value, field);
  if (invoice.createdByUserId === invoice.approvedByUserId) throw new Error(`${label} benötigt eine getrennte prüfende Identität.`);
  if (!fingerprint.test(invoice.documentFingerprint)) throw new Error(`${label}-Dokumentfingerprint ist ungültig.`);
  exactMicros(invoice.approvedAt, `${label}-Freigabezeit`);
  if (invoice.approvalState !== 'approved') throw new Error(`${label} ist nicht freigegeben.`);
  cents(invoice.totalAmountCents, `${label}-Gesamtbetrag`, true);
  if (!Array.isArray(invoice.positions) || !invoice.positions.length) throw new Error(`${label}-Positionen fehlen.`);
  const cases = new Set<string>(); const proofs = new Set<string>();
  const positions = invoice.positions.map((position, index) => {
    if (!position || position.positionNo !== index + 1) throw new Error(`${label}-Positionen müssen lückenlos und geordnet sein.`);
    required(position.billingCaseId, `${label}-Abrechnungsfall`); required(position.serviceProofId, `${label}-Leistungsnachweis`);
    cents(position.amountCents, `${label}-Positionsbetrag`, true);
    if (cases.has(position.billingCaseId) || proofs.has(position.serviceProofId)) throw new Error(`${label} enthält doppelte Originalpositionen.`);
    cases.add(position.billingCaseId); proofs.add(position.serviceProofId);
    return Object.freeze({ ...position });
  });
  if (positions.reduce((sum, position) => sum + position.amountCents, 0) !== invoice.totalAmountCents) throw new Error(`${label}-Positionssumme stimmt nicht mit dem Gesamtbetrag überein.`);
  return positions;
}

export function buildCareInvoiceAdjustmentRecord(
  originalInvoice: CareReleasedInvoice,
  request: CareInvoiceAdjustmentRequest,
): CareInvoiceAdjustmentRecord {
  const originalPositions = validateReleasedInvoice(originalInvoice, 'Originalrechnung');
  for (const [value, label] of [
    [request.clientRequestId, 'Anforderungs-ID'], [request.adjustmentId, 'Gegenbuchung'],
    [request.adjustmentNumber, 'Gutschrift-/Stornonummer'], [request.reason, 'Korrekturgrund'],
    [request.createdByUserId, 'Gegenbuchungs-Ersteller'], [request.approvedByUserId, 'Gegenbuchungs-Prüfer'],
  ] as const) required(value, label);
  if (!['full_cancellation', 'partial_credit', 'cancel_and_rebill'].includes(request.adjustmentKind)) throw new Error('Art der Gegenbuchung ist ungültig.');
  if (request.adjustmentBasis !== 'documented_billing_correction') throw new Error('Rückläufer oder Folgeversuch dürfen keine Gegenbuchung auslösen.');
  if (request.createdByUserId === request.approvedByUserId) throw new Error('Gegenbuchung benötigt eine getrennte prüfende Identität.');
  if (!fingerprint.test(request.documentFingerprint) || request.documentFingerprint === originalInvoice.documentFingerprint) throw new Error('Gegenbuchung benötigt einen neuen Dokumentfingerprint.');
  exactMicros(request.approvedAt, 'Gegenbuchungs-Freigabezeit');
  if (compareUtcMicros(request.approvedAt, originalInvoice.approvedAt) <= 0) throw new Error('Gegenbuchung muss nach der Originalfreigabe liegen.');
  cents(request.creditTotalCents, 'Gegenbuchungsbetrag', true);
  if (!Array.isArray(request.creditPositions) || !request.creditPositions.length) throw new Error('Gegenbuchungspositionen fehlen.');
  const credited = new Set<number>();
  const creditPositions = request.creditPositions.map((credit) => {
    if (!credit || !Number.isSafeInteger(credit.originalPositionNo) || credit.originalPositionNo <= 0) throw new Error('Gegenbuchung benötigt eine Originalpositionsnummer.');
    if (credited.has(credit.originalPositionNo)) throw new Error('Originalposition ist doppelt gegengebucht.');
    credited.add(credit.originalPositionNo);
    const original = originalPositions[credit.originalPositionNo - 1];
    if (!original || original.billingCaseId !== credit.billingCaseId || original.serviceProofId !== credit.serviceProofId) throw new Error('Gegenbuchung gehört nicht exakt zur Originalposition.');
    cents(credit.creditAmountCents, 'Gutschriftbetrag', true);
    if (credit.creditAmountCents > original.amountCents) throw new Error('Gutschrift übersteigt die Originalposition.');
    return Object.freeze({ ...credit });
  });
  if (creditPositions.reduce((sum, credit) => sum + credit.creditAmountCents, 0) !== request.creditTotalCents) throw new Error('Gegenbuchungspositionen stimmen nicht mit dem Gegenbuchungsbetrag überein.');
  const fullCredit = request.creditTotalCents === originalInvoice.totalAmountCents && creditPositions.length === originalPositions.length && creditPositions.every((credit) => credit.creditAmountCents === originalPositions[credit.originalPositionNo - 1].amountCents);
  if (request.adjustmentKind === 'partial_credit' && (fullCredit || request.replacementInvoice)) throw new Error('Teil-Gutschrift darf weder vollständig stornieren noch automatisch neu berechnen.');
  if (request.adjustmentKind !== 'partial_credit' && !fullCredit) throw new Error('Vollstorno benötigt die exakte Gegenbuchung aller Originalpositionen.');
  if (request.adjustmentKind === 'full_cancellation' && request.replacementInvoice) throw new Error('Reines Vollstorno darf keine Neurechnung enthalten.');
  if (request.adjustmentKind === 'cancel_and_rebill' && !request.replacementInvoice) throw new Error('Storno mit Neurechnung benötigt eine neue freigegebene Rechnung.');

  let replacementInvoice: CareReplacementInvoice | null = null;
  if (request.replacementInvoice) {
    const replacementPositions = validateReleasedInvoice(request.replacementInvoice, 'Neurechnung');
    const replacement = request.replacementInvoice;
    if (replacement.replacesInvoiceApprovalId !== originalInvoice.invoiceApprovalId) throw new Error('Neurechnung referenziert nicht die Originalfreigabe.');
    if (replacement.tenantId !== originalInvoice.tenantId || replacement.clientId !== originalInvoice.clientId || replacement.claimLineageId !== originalInvoice.claimLineageId) throw new Error('Neurechnung muss Mandant, Pflegefall und Forderungshistorie bewahren.');
    if (replacement.invoiceApprovalId === originalInvoice.invoiceApprovalId || replacement.invoiceDraftId === originalInvoice.invoiceDraftId || replacement.invoiceNumber === originalInvoice.invoiceNumber || replacement.documentFingerprint === originalInvoice.documentFingerprint) throw new Error('Neurechnung benötigt neue native Dokumentidentitäten.');
    if (compareUtcMicros(replacement.approvedAt, request.approvedAt) <= 0) throw new Error('Neurechnung muss nach der freigegebenen Gegenbuchung liegen.');
    replacementInvoice = Object.freeze({ ...replacement, positions: Object.freeze(replacementPositions) });
  }
  const replacementDebitCents = replacementInvoice?.totalAmountCents ?? 0;
  const resultingBalanceCents = originalInvoice.totalAmountCents - request.creditTotalCents + replacementDebitCents;
  if (!Number.isSafeInteger(resultingBalanceCents) || resultingBalanceCents < 0) throw new Error('Saldo der unveränderlichen Rechnungskette ist ungültig.');
  return Object.freeze({
    ...request,
    reason: request.reason.trim(),
    creditPositions: Object.freeze(creditPositions),
    replacementInvoice,
    originalInvoice: Object.freeze({ ...originalInvoice, positions: Object.freeze(originalPositions) }),
    ledger: Object.freeze({ originalDebitCents: originalInvoice.totalAmountCents, counterEntryCents: -request.creditTotalCents, replacementDebitCents, resultingBalanceCents }),
    chainAction: 'append_only_invoice_adjustment', carrierReturnEffect: 'none', transmissionStatus: 'not_inferred', paymentStatus: 'not_inferred',
  });
}
