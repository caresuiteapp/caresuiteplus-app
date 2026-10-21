import type { CareInvoiceApprovalPosition } from './careInvoiceApprovalDomain';

export type CareInvoiceCostShareCandidate = {
  invoiceApprovalId: string;
  invoiceDraftId: string;
  invoiceNumber: string;
  tenantId: string;
  clientId: string;
  approvalVersion: number;
  approvedAt: string;
  documentFingerprint: string;
  totalAmountCents: number;
  positions: readonly CareInvoiceApprovalPosition[];
};

export type CareInvoiceCostShareLine = {
  positionNo: number;
  billingCaseId: string;
  serviceProofId: string;
  serviceDate: string;
  serviceCode: string;
  approvedAmountCents: number;
  payerType: 'insurance' | 'self_payer';
  coverageRecipientId: string | null;
  coverageRecipientName: string | null;
  coverageRecipientIk: string | null;
  coverageRecipientAddressFingerprint: string | null;
  personalRecipientId: string;
  personalRecipientName: string;
  personalRecipientAddressFingerprint: string;
  coverageShareCents: number;
  personalShareCents: number;
  personalShareBasisKind: 'calculated' | 'exemption' | 'documented_zero' | 'self_payer';
  exemptionEvidenceId: string | null;
  exemptionEvidenceFingerprint: string | null;
  exemptionValidFrom: string | null;
  exemptionValidUntil: string | null;
  exemptionRecordedAt: string | null;
};

export type CareInvoiceCostShareInput = {
  costShareAssessmentId: string;
  clientRequestId: string;
  coverageBasisId: string;
  coverageBasisVersion: number;
  coverageBasisFingerprint: string;
  assessedAt: string;
  lines: readonly CareInvoiceCostShareLine[];
};

export type CareInvoiceCostShareAssessment = CareInvoiceCostShareCandidate & CareInvoiceCostShareInput & {
  coverageTotalCents: number;
  personalTotalCents: number;
  reconciliationState: 'reconciled';
  transmissionState: 'not_inferred';
  collectionState: 'not_inferred';
  paymentState: 'not_inferred';
  historyMode: 'append_only';
};

const dateOnly = /^\d{4}-\d{2}-\d{2}$/;
const exactUtcMicros = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}(?:Z|\+00:00)$/;
const fingerprint = /^[0-9a-f]{32}$/;

function required(value: string | null, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} fehlt.`);
  return value.trim();
}

function date(value: string | null, label: string): string {
  const text = required(value, label);
  if (!dateOnly.test(text) || Number.isNaN(Date.parse(`${text}T00:00:00Z`))) throw new Error(`${label} ist ungültig.`);
  return text;
}

function micros(value: string | null, label: string): string {
  const text = required(value, label);
  if (!exactUtcMicros.test(text) || Number.isNaN(Date.parse(text))) throw new Error(`${label} benötigt exakt sechs UTC-Mikrosekundenstellen.`);
  return text;
}

function cents(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} ist ungültig.`);
  return value;
}

function exactFingerprint(value: string | null, label: string): string {
  const text = required(value, label);
  if (!fingerprint.test(text)) throw new Error(`${label} ist ungültig.`);
  return text;
}

function noExemption(line: CareInvoiceCostShareLine): boolean {
  return line.exemptionEvidenceId == null && line.exemptionEvidenceFingerprint == null && line.exemptionValidFrom == null && line.exemptionValidUntil == null && line.exemptionRecordedAt == null;
}

export function buildCareInvoiceCostShareAssessment(
  candidate: CareInvoiceCostShareCandidate,
  input: CareInvoiceCostShareInput,
): CareInvoiceCostShareAssessment {
  for (const [value, label] of [
    [candidate.invoiceApprovalId, 'Rechnungsfreigabe'], [candidate.invoiceDraftId, 'Rechnungsentwurf'],
    [candidate.invoiceNumber, 'Rechnungsnummer'], [candidate.tenantId, 'Mandant'], [candidate.clientId, 'Pflegefall'],
    [input.costShareAssessmentId, 'Anteilsfeststellung'], [input.clientRequestId, 'Anforderungs-ID'],
    [input.coverageBasisId, 'Leistungsgrundlage'],
  ] as const) required(value, label);
  if (!Number.isSafeInteger(candidate.approvalVersion) || candidate.approvalVersion < 1) throw new Error('Freigabefassung ist ungültig.');
  if (!Number.isSafeInteger(input.coverageBasisVersion) || input.coverageBasisVersion < 1) throw new Error('Grundlagenfassung ist ungültig.');
  micros(candidate.approvedAt, 'Freigabezeit');
  micros(input.assessedAt, 'Feststellungszeit');
  if (input.assessedAt <= candidate.approvedAt) throw new Error('Anteilsfeststellung muss nach der Rechnungsfreigabe liegen.');
  exactFingerprint(candidate.documentFingerprint, 'Dokumentfingerprint');
  exactFingerprint(input.coverageBasisFingerprint, 'Grundlagenfingerprint');
  const invoiceTotal = cents(candidate.totalAmountCents, 'Freigabesumme');
  if (!candidate.positions.length || input.lines.length !== candidate.positions.length) throw new Error('Anteilsfeststellung muss jede freigegebene Position genau einmal enthalten.');

  const caseIds = new Set<string>();
  const proofIds = new Set<string>();
  let positionTotal = 0;
  let coverageTotal = 0;
  let personalTotal = 0;
  const lines = input.lines.map((source, index) => {
    const position = candidate.positions[index];
    if (position.positionNo !== index + 1 || source.positionNo !== position.positionNo) throw new Error('Positionsreihenfolge ist nicht lückenlos.');
    for (const [value, label] of [
      [position.billingCaseId, 'Freigegebene Abrechnungsfall-ID'], [position.serviceProofId, 'Freigegebene Leistungsnachweis-ID'],
      [position.serviceCode, 'Freigegebener Leistungscode'], [position.proofFingerprint, 'Leistungsnachweis-Fingerprint'],
      [source.billingCaseId, 'Abrechnungsfall-ID'], [source.serviceProofId, 'Leistungsnachweis-ID'], [source.serviceCode, 'Leistungscode'],
      [source.personalRecipientId, 'Eigenanteilsempfänger-ID'], [source.personalRecipientName, 'Eigenanteilsempfänger'],
    ] as const) required(value, label);
    date(position.serviceDate, 'Freigegebenes Leistungsdatum');
    date(source.serviceDate, 'Leistungsdatum');
    exactFingerprint(position.proofFingerprint, 'Leistungsnachweis-Fingerprint');
    exactFingerprint(source.personalRecipientAddressFingerprint, 'Eigenanteil-Empfängerfingerprint');
    if (!Number.isSafeInteger(position.quantityMilli) || position.quantityMilli <= 0) throw new Error('Freigegebene Positionsmenge ist ungültig.');
    cents(position.unitAmountCents, 'Freigegebener Einzelpreis');
    cents(position.amountCents, 'Freigegebener Positionsbetrag');
    const product = position.quantityMilli * position.unitAmountCents;
    if (!Number.isSafeInteger(product) || product % 1000 !== 0 || product / 1000 !== position.amountCents) throw new Error('Freigegebener Positionsbetrag ist nicht exakt nachrechenbar.');
    if (source.billingCaseId !== position.billingCaseId || source.serviceProofId !== position.serviceProofId || source.serviceDate !== position.serviceDate || source.serviceCode !== position.serviceCode || source.approvedAmountCents !== position.amountCents) throw new Error('Anteilszeile ist nicht exakt an die freigegebene Position gebunden.');
    if (caseIds.has(source.billingCaseId) || proofIds.has(source.serviceProofId)) throw new Error('Anteilszeilen enthalten doppelte Originalidentitäten.');
    caseIds.add(source.billingCaseId); proofIds.add(source.serviceProofId);
    const approved = cents(source.approvedAmountCents, 'Freigegebener Positionsbetrag');
    const coverage = cents(source.coverageShareCents, 'Kostenträgeranteil');
    const personal = cents(source.personalShareCents, 'Eigenanteil');
    if (coverage + personal !== approved) throw new Error('Kostenträgeranteil und Eigenanteil ergeben nicht exakt den freigegebenen Positionsbetrag.');

    if (source.payerType === 'self_payer') {
      if (coverage !== 0 || personal !== approved || source.personalShareBasisKind !== 'self_payer' || source.coverageRecipientId != null || source.coverageRecipientName != null || source.coverageRecipientIk != null || source.coverageRecipientAddressFingerprint != null || !noExemption(source)) throw new Error('Selbstzahlerposition darf keinen Kostenträger- oder Befreiungsanteil ableiten.');
    } else if (source.payerType === 'insurance') {
      required(source.coverageRecipientId, 'Kostenträgerempfänger-ID');
      required(source.coverageRecipientName, 'Kostenträgerempfänger');
      required(source.coverageRecipientIk, 'Kostenträger-IK');
      exactFingerprint(source.coverageRecipientAddressFingerprint, 'Kostenträger-Empfängerfingerprint');
      if (source.personalShareBasisKind === 'self_payer') throw new Error('Versicherte Position besitzt eine unzulässige Selbstzahlergrundlage.');
      if (source.personalShareBasisKind === 'calculated') {
        if (personal <= 0 || !noExemption(source)) throw new Error('Berechneter Eigenanteil benötigt einen positiven Betrag ohne Befreiungsbeleg.');
      } else if (source.personalShareBasisKind === 'documented_zero') {
        if (personal !== 0 || coverage !== approved || !noExemption(source)) throw new Error('Dokumentierter Null-Eigenanteil muss die Position vollständig dem Kostenträger zuordnen.');
      } else if (source.personalShareBasisKind === 'exemption') {
        if (personal !== 0 || coverage !== approved) throw new Error('Befreiung darf keinen Eigenanteil ausweisen.');
        required(source.exemptionEvidenceId, 'Befreiungsbeleg');
        exactFingerprint(source.exemptionEvidenceFingerprint, 'Befreiungsfingerprint');
        const validFrom = date(source.exemptionValidFrom, 'Befreiungsbeginn');
        const validUntil = date(source.exemptionValidUntil, 'Befreiungsende');
        const recordedAt = micros(source.exemptionRecordedAt, 'Befreiungserfassung');
        if (validUntil < validFrom || position.serviceDate < validFrom || position.serviceDate > validUntil || recordedAt > input.assessedAt) throw new Error('Befreiungsbeleg gilt nicht für die freigegebene Leistung.');
      } else {
        throw new Error('Eigenanteilsgrundlage ist ungültig.');
      }
    } else {
      throw new Error('Zahlertyp ist ungültig.');
    }
    positionTotal += approved; coverageTotal += coverage; personalTotal += personal;
    if (![positionTotal, coverageTotal, personalTotal].every(Number.isSafeInteger)) throw new Error('Anteilsbeträge überschreiten den sicheren Zahlenbereich.');
    return Object.freeze({ ...source });
  });
  if (positionTotal !== invoiceTotal || coverageTotal + personalTotal !== invoiceTotal) throw new Error('Kostenträger- und Eigenanteil stimmen nicht mit der freigegebenen Rechnungssumme überein.');
  return Object.freeze({
    ...candidate,
    positions: Object.freeze(candidate.positions.map((position) => Object.freeze({ ...position }))),
    ...input,
    lines: Object.freeze(lines),
    coverageTotalCents: coverageTotal,
    personalTotalCents: personalTotal,
    reconciliationState: 'reconciled',
    transmissionState: 'not_inferred',
    collectionState: 'not_inferred',
    paymentState: 'not_inferred',
    historyMode: 'append_only',
  });
}
