export type CareCarrierTransmissionPosition = {
  positionNo: number;
  billingCaseId: string;
  serviceProofId: string;
  amountCents: number;
};

export type CareCarrierTransmissionAttempt = {
  transmissionAttemptId: string;
  exportId: string;
  invoiceApprovalId: string;
  invoiceDraftId: string;
  invoiceNumber: string;
  tenantId: string;
  clientId: string;
  claimLineageId: string;
  attemptNumber: number;
  replacementForAttemptId: string | null;
  transportMessageId: string;
  senderIk: string;
  receiverIk: string;
  payloadSha256: string;
  orderFileSha256: string;
  transmittedAt: string;
  transmissionState: 'submitted' | string;
  totalAmountCents: number;
  positions: readonly CareCarrierTransmissionPosition[];
};

export type CareCarrierReturnError = {
  errorId: string;
  code: string;
  message: string;
  scope: 'invoice' | 'position';
  positionNo: number | null;
  billingCaseId: string | null;
  serviceProofId: string | null;
};

export type CareCarrierReturnRequest = {
  clientRequestId: string;
  returnFileName: string;
  returnFileSha256: string;
  returnFileSizeBytes: number;
  receivedAt: string;
  senderIk: string;
  receiverIk: string;
  referencedTransportMessageId: string;
  codeSystem: string;
  codeSystemVersion: string;
  errors: readonly CareCarrierReturnError[];
};

export type CareCarrierReturnRecord = CareCarrierReturnRequest & {
  attempt: CareCarrierTransmissionAttempt;
  returnState: 'rejected_requires_correction';
  acceptanceStatus: 'not_accepted';
  paymentStatus: 'not_inferred';
};

export type CareCarrierCorrection = {
  correctionId: string;
  correctionVersion: number;
  correctedExportId: string;
  correctedInvoiceApprovalId: string;
  correctedInvoiceDraftId: string;
  correctedInvoiceNumber: string;
  correctedDocumentFingerprint: string;
  correctionReason: string;
  correctedTotalAmountCents: number;
  correctedPositions: readonly CareCarrierTransmissionPosition[];
};

export type CareCarrierResubmissionRequest = {
  clientRequestId: string;
  transmissionAttemptId: string;
  attemptNumber: number;
  replacementForAttemptId: string;
  transportMessageId: string;
  senderIk: string;
  receiverIk: string;
  payloadSha256: string;
  orderFileSha256: string;
  transmittedAt: string;
};

export type CareCarrierResubmissionRecord = CareCarrierResubmissionRequest & {
  rejection: CareCarrierReturnRecord;
  correction: CareCarrierCorrection;
  claimLineageId: string;
  claimAction: 'replace_rejected_claim';
  transmissionState: 'replacement_submitted_not_accepted';
  acceptanceStatus: 'not_inferred';
  paymentStatus: 'not_inferred';
};

const exactUtcMicros = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}(?:Z|\+00:00)$/;
const sha256 = /^[0-9a-f]{64}$/;
const fingerprint = /^(?:[0-9a-f]{32}|[0-9a-f]{64})$/;
const ik = /^\d{9}$/;

function required(value: string, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} fehlt.`);
  return value.trim();
}

function exactMicros(value: string, label: string): void {
  if (!exactUtcMicros.test(value) || Number.isNaN(Date.parse(value))) throw new Error(`${label} benötigt exakt sechs UTC-Mikrosekundenstellen.`);
}

function compareUtcMicros(left: string, right: string): number {
  const canonical = (value: string) => value.replace('+00:00', 'Z');
  return canonical(left).localeCompare(canonical(right));
}

function exactSha(value: string, label: string): void {
  if (!sha256.test(value)) throw new Error(`${label} benötigt einen SHA-256-Fingerabdruck.`);
}

function exactIk(value: string, label: string): void {
  if (!ik.test(value)) throw new Error(`${label} benötigt genau neun Ziffern.`);
}

function positiveInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${label} ist ungültig.`);
}

function nonNegativeCents(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} ist ungültig.`);
}

function validatePositions(values: readonly CareCarrierTransmissionPosition[], totalAmountCents: number): CareCarrierTransmissionPosition[] {
  if (!Array.isArray(values) || !values.length) throw new Error('Rechnungspositionen fehlen.');
  nonNegativeCents(totalAmountCents, 'Rechnungssumme');
  const cases = new Set<string>();
  const proofs = new Set<string>();
  const positions = values.map((value, index) => {
    if (!value || value.positionNo !== index + 1) throw new Error('Rechnungspositionen müssen lückenlos und geordnet sein.');
    required(value.billingCaseId, 'Abrechnungsfall');
    required(value.serviceProofId, 'Leistungsnachweis');
    nonNegativeCents(value.amountCents, 'Positionsbetrag');
    if (cases.has(value.billingCaseId) || proofs.has(value.serviceProofId)) throw new Error('Abrechnungsfall oder Leistungsnachweis ist doppelt enthalten.');
    cases.add(value.billingCaseId);
    proofs.add(value.serviceProofId);
    return Object.freeze({ ...value });
  });
  if (positions.reduce((sum, value) => sum + value.amountCents, 0) !== totalAmountCents) throw new Error('Positionssumme stimmt nicht mit der Rechnungssumme überein.');
  return positions;
}

function validateAttempt(attempt: CareCarrierTransmissionAttempt): CareCarrierTransmissionPosition[] {
  for (const [value, label] of [
    [attempt.transmissionAttemptId, 'Übermittlungsversuch'], [attempt.exportId, 'Exportfassung'],
    [attempt.invoiceApprovalId, 'Rechnungsfreigabe'], [attempt.invoiceDraftId, 'Rechnungsentwurf'],
    [attempt.invoiceNumber, 'Rechnungsnummer'], [attempt.tenantId, 'Mandant'], [attempt.clientId, 'Pflegefall'],
    [attempt.claimLineageId, 'Forderungshistorie'], [attempt.transportMessageId, 'Transportnachricht'],
  ] as const) required(value, label);
  positiveInteger(attempt.attemptNumber, 'Versuchsnummer');
  if (attempt.attemptNumber === 1 && attempt.replacementForAttemptId !== null) throw new Error('Der erste Übermittlungsversuch darf keinen Vorgänger ersetzen.');
  if (attempt.attemptNumber > 1 && !attempt.replacementForAttemptId) throw new Error('Ein Folgeversuch benötigt den ersetzten Übermittlungsversuch.');
  exactIk(attempt.senderIk, 'Absender-IK');
  exactIk(attempt.receiverIk, 'Empfänger-IK');
  exactSha(attempt.payloadSha256, 'Nutzdatendatei');
  exactSha(attempt.orderFileSha256, 'Auftragsdatei');
  if (attempt.payloadSha256 === attempt.orderFileSha256) throw new Error('Auftrags- und Nutzdatendatei müssen getrennte Originale bleiben.');
  exactMicros(attempt.transmittedAt, 'Übermittlungszeit');
  if (attempt.transmissionState !== 'submitted') throw new Error('Rückläufer benötigen einen tatsächlich dokumentierten Übermittlungsversuch.');
  return validatePositions(attempt.positions, attempt.totalAmountCents);
}

export function buildCareCarrierReturnRecord(
  attempt: CareCarrierTransmissionAttempt,
  request: CareCarrierReturnRequest,
): CareCarrierReturnRecord {
  const positions = validateAttempt(attempt);
  for (const [value, label] of [
    [request.clientRequestId, 'Anforderungs-ID'], [request.returnFileName, 'Rückläuferdatei'],
    [request.referencedTransportMessageId, 'Referenzierte Transportnachricht'], [request.codeSystem, 'Fehlercodesystem'],
    [request.codeSystemVersion, 'Fehlercodesystemversion'],
  ] as const) required(value, label);
  exactSha(request.returnFileSha256, 'Rückläuferdatei');
  positiveInteger(request.returnFileSizeBytes, 'Rückläuferdateigröße');
  exactMicros(request.receivedAt, 'Empfangszeit');
  if (compareUtcMicros(request.receivedAt, attempt.transmittedAt) <= 0) throw new Error('Rückläufer muss zeitlich nach dem Übermittlungsversuch liegen.');
  exactIk(request.senderIk, 'Rückläufer-Absender-IK');
  exactIk(request.receiverIk, 'Rückläufer-Empfänger-IK');
  if (request.senderIk !== attempt.receiverIk || request.receiverIk !== attempt.senderIk) throw new Error('Rückläufer gehört nicht zu den Parteien des Übermittlungsversuchs.');
  if (request.referencedTransportMessageId !== attempt.transportMessageId) throw new Error('Rückläufer referenziert eine andere Transportnachricht.');
  if (!Array.isArray(request.errors) || !request.errors.length) throw new Error('Ein abgewiesener Rückläufer benötigt mindestens einen konkreten Fehler.');
  const errorIds = new Set<string>();
  const errors = request.errors.map((error) => {
    required(error.errorId, 'Fehler-ID');
    required(error.code, 'Fehlercode');
    required(error.message, 'Fehlermeldung');
    if (errorIds.has(error.errorId)) throw new Error('Fehler-ID ist doppelt enthalten.');
    errorIds.add(error.errorId);
    if (error.scope === 'invoice') {
      if (error.positionNo !== null || error.billingCaseId !== null || error.serviceProofId !== null) throw new Error('Rechnungsfehler darf keine erfundene Position referenzieren.');
    } else if (error.scope === 'position') {
      if (!Number.isSafeInteger(error.positionNo) || !error.positionNo || !error.billingCaseId || !error.serviceProofId) throw new Error('Positionsfehler benötigt Position, Abrechnungsfall und Leistungsnachweis.');
      const position = positions[error.positionNo - 1];
      if (!position || position.billingCaseId !== error.billingCaseId || position.serviceProofId !== error.serviceProofId) throw new Error('Positionsfehler gehört nicht zur übermittelten Originalposition.');
    } else throw new Error('Fehlerumfang ist ungültig.');
    return Object.freeze({ ...error, code: error.code.trim(), message: error.message.trim() });
  });
  return Object.freeze({
    ...request,
    errors: Object.freeze(errors),
    attempt: Object.freeze({ ...attempt, positions: Object.freeze(positions) }),
    returnState: 'rejected_requires_correction',
    acceptanceStatus: 'not_accepted',
    paymentStatus: 'not_inferred',
  });
}

export function buildCareCarrierResubmissionRecord(
  rejection: CareCarrierReturnRecord,
  correction: CareCarrierCorrection,
  request: CareCarrierResubmissionRequest,
): CareCarrierResubmissionRecord {
  const original = rejection.attempt;
  for (const [value, label] of [
    [correction.correctionId, 'Korrektur'], [correction.correctedExportId, 'Korrigierte Exportfassung'],
    [correction.correctedInvoiceApprovalId, 'Korrigierte Freigabe'], [correction.correctedInvoiceDraftId, 'Korrigierter Rechnungsentwurf'],
    [correction.correctedInvoiceNumber, 'Korrigierte Rechnungsnummer'], [correction.correctionReason, 'Korrekturgrund'],
    [request.clientRequestId, 'Anforderungs-ID'], [request.transmissionAttemptId, 'Neuer Übermittlungsversuch'],
    [request.replacementForAttemptId, 'Ersetzter Übermittlungsversuch'], [request.transportMessageId, 'Neue Transportnachricht'],
  ] as const) required(value, label);
  positiveInteger(correction.correctionVersion, 'Korrekturversion');
  if (correction.correctionVersion !== 1) throw new Error('Der erste dokumentierte Rückläufer benötigt Korrekturversion 1.');
  if (!fingerprint.test(correction.correctedDocumentFingerprint)) throw new Error('Korrigierter Dokumentfingerprint ist ungültig.');
  const correctedPositions = validatePositions(correction.correctedPositions, correction.correctedTotalAmountCents);
  if (correction.correctedExportId === original.exportId || correction.correctedInvoiceApprovalId === original.invoiceApprovalId || correction.correctedInvoiceDraftId === original.invoiceDraftId) throw new Error('Korrektur benötigt neue Export-, Freigabe- und Rechnungsfassungen.');
  if (correction.correctedInvoiceNumber !== original.invoiceNumber) throw new Error('Korrektur muss dieselbe Forderung und Rechnungsnummer fortführen.');
  if (request.attemptNumber !== original.attemptNumber + 1 || request.replacementForAttemptId !== original.transmissionAttemptId) throw new Error('Folgeversuch muss den abgewiesenen Versuch lückenlos ersetzen.');
  if (request.transmissionAttemptId === original.transmissionAttemptId || request.transportMessageId === original.transportMessageId) throw new Error('Folgeversuch benötigt neue native Transportidentitäten.');
  exactIk(request.senderIk, 'Absender-IK');
  exactIk(request.receiverIk, 'Empfänger-IK');
  if (request.senderIk !== original.senderIk || request.receiverIk !== original.receiverIk) throw new Error('Folgeversuch muss dieselben Transportparteien bewahren.');
  exactSha(request.payloadSha256, 'Korrigierte Nutzdatendatei');
  exactSha(request.orderFileSha256, 'Korrigierte Auftragsdatei');
  if (request.payloadSha256 === request.orderFileSha256 || request.payloadSha256 === original.payloadSha256 || request.orderFileSha256 === original.orderFileSha256) throw new Error('Folgeversuch benötigt getrennte, neu erzeugte Originaldateien.');
  exactMicros(request.transmittedAt, 'Erneute Übermittlungszeit');
  if (compareUtcMicros(request.transmittedAt, rejection.receivedAt) <= 0) throw new Error('Erneute Übermittlung muss nach dem dokumentierten Rückläufer liegen.');
  const rejectedPositions = rejection.errors.filter((error) => error.scope === 'position');
  for (const error of rejectedPositions) {
    const position = correctedPositions.find((value) => value.billingCaseId === error.billingCaseId && value.serviceProofId === error.serviceProofId);
    if (!position) throw new Error('Korrigierte Fassung verliert eine vom Rückläufer betroffene Originalposition.');
  }
  return Object.freeze({
    ...request,
    rejection,
    correction: Object.freeze({ ...correction, correctionReason: correction.correctionReason.trim(), correctedPositions: Object.freeze(correctedPositions) }),
    claimLineageId: original.claimLineageId,
    claimAction: 'replace_rejected_claim',
    transmissionState: 'replacement_submitted_not_accepted',
    acceptanceStatus: 'not_inferred',
    paymentStatus: 'not_inferred',
  });
}
