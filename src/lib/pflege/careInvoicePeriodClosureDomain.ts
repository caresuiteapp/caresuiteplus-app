export type CareInvoicePeriodSource = {
  invoiceApprovalId: string;
  invoiceDraftId: string;
  clientId: string;
  invoiceNumber: string;
  invoiceDate: string;
  approvalVersion: number;
  approvedAt: string;
  documentFingerprint: string;
  totalAmountCents: number;
};

export type CareInvoicePeriodOpenCase = {
  billingCaseId: string;
  clientId: string;
  serviceDate: string;
  state: 'pending' | 'blocked' | 'ready' | 'released';
  reason: string;
  sourceFingerprint: string;
  observedAt: string;
};

export type CareInvoicePeriodClosureCandidate = {
  tenantId: string;
  periodId: string;
  periodFrom: string;
  periodTo: string;
  cutoffAt: string;
  invoiceApprovals: readonly CareInvoicePeriodSource[];
  openCases: readonly CareInvoicePeriodOpenCase[];
};

export type CareInvoicePeriodClosureInput = {
  periodClosureId: string;
  clientRequestId: string;
  approvalEvidenceId: string;
  approvalEvidenceFingerprint: string;
  approvedBy: string;
  approvedByName: string;
  approvedAt: string;
  closedAt: string;
  includedInvoiceApprovalIds: readonly string[];
};

export type CareInvoicePeriodCorrection = {
  correctionId: string;
  clientRequestId: string;
  tenantId: string;
  originalPeriodClosureId: string;
  originalInvoiceApprovalId: string;
  correctionPeriodId: string;
  correctionPeriodFrom: string;
  correctionPeriodTo: string;
  adjustmentEvidenceId: string;
  adjustmentEvidenceFingerprint: string;
  reason: string;
  amountDeltaCents: number;
  recordedAt: string;
  recordedBy: string;
  recordedByName: string;
};

export type CareInvoicePeriodClosure = CareInvoicePeriodClosureCandidate & CareInvoicePeriodClosureInput & {
  invoiceApprovals: readonly CareInvoicePeriodSource[];
  invoiceCount: number;
  invoiceTotalCents: number;
  openCaseCount: 0;
  closureState: 'closed';
  correctionMode: 'subsequent_period_only';
  transmissionState: 'not_inferred';
  paymentState: 'not_inferred';
  historyMode: 'append_only';
  corrections: readonly CareInvoicePeriodCorrection[];
};

const dateOnly = /^\d{4}-\d{2}-\d{2}$/;
const exactUtcMicros = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}(?:Z|\+00:00)$/;
const fingerprint = /^[0-9a-f]{32}$/;

function required(value: string | null | undefined, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} fehlt.`);
  return value.trim();
}

function date(value: string, label: string): string {
  const result = required(value, label);
  if (!dateOnly.test(result) || Number.isNaN(Date.parse(`${result}T00:00:00Z`))) throw new Error(`${label} ist ungültig.`);
  return result;
}

function micros(value: string, label: string): string {
  const result = required(value, label);
  if (!exactUtcMicros.test(result) || Number.isNaN(Date.parse(result))) throw new Error(`${label} benötigt exakt sechs UTC-Mikrosekundenstellen.`);
  return result;
}

function exactFingerprint(value: string, label: string): string {
  const result = required(value, label);
  if (!fingerprint.test(result)) throw new Error(`${label} ist ungültig.`);
  return result;
}

function signedCents(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value === 0) throw new Error(`${label} muss ein sicherer, von null verschiedener Centbetrag sein.`);
  return value;
}

function nonNegativeCents(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} ist ungültig.`);
  return value;
}

export function buildCareInvoicePeriodClosure(
  candidate: CareInvoicePeriodClosureCandidate,
  input: CareInvoicePeriodClosureInput,
  corrections: readonly CareInvoicePeriodCorrection[] = [],
): CareInvoicePeriodClosure {
  for (const [value, label] of [
    [candidate.tenantId, 'Mandant'], [candidate.periodId, 'Perioden-ID'],
    [input.periodClosureId, 'Periodenabschluss'], [input.clientRequestId, 'Anforderungs-ID'],
    [input.approvalEvidenceId, 'Abschlussfreigabebeleg'], [input.approvedBy, 'Freigabeidentität'],
    [input.approvedByName, 'Freigabename'],
  ] as const) required(value, label);
  const periodFrom = date(candidate.periodFrom, 'Periodenbeginn');
  const periodTo = date(candidate.periodTo, 'Periodenende');
  if (periodTo < periodFrom) throw new Error('Periodengrenze ist ungültig.');
  const cutoffAt = micros(candidate.cutoffAt, 'Abschlussstichtag');
  const approvedAt = micros(input.approvedAt, 'Abschlussfreigabezeit');
  const closedAt = micros(input.closedAt, 'Abschlusszeit');
  if (approvedAt <= cutoffAt || closedAt < approvedAt) throw new Error('Abschlussfreigabe und Abschluss müssen nach dem Stichtag in Reihenfolge liegen.');
  exactFingerprint(input.approvalEvidenceFingerprint, 'Abschlussfreigabefingerprint');
  if (candidate.openCases.length) {
    for (const item of candidate.openCases) {
      required(item.billingCaseId, 'Offene Abrechnungsfall-ID');
      required(item.clientId, 'Pflegefall der offenen Position');
      const serviceDate = date(item.serviceDate, 'Leistungsdatum der offenen Position');
      required(item.reason, 'Grund der offenen Position');
      exactFingerprint(item.sourceFingerprint, 'Fingerprint der offenen Position');
      micros(item.observedAt, 'Prüfzeit der offenen Position');
      if (serviceDate < periodFrom || serviceDate > periodTo) throw new Error('Offene Position liegt außerhalb der geprüften Periode.');
      if (!['pending', 'blocked', 'ready', 'released'].includes(item.state)) throw new Error('Status der offenen Position ist ungültig.');
    }
    throw new Error('Abrechnungsperiode enthält offene Fälle und darf nicht geschlossen werden.');
  }
  if (!candidate.invoiceApprovals.length) throw new Error('Abrechnungsperiode enthält keine freigegebene Rechnungsfassung.');
  if (input.includedInvoiceApprovalIds.length !== candidate.invoiceApprovals.length) throw new Error('Abschluss muss jede freigegebene Rechnungsfassung genau einmal enthalten.');

  const approvalIds = new Set<string>();
  const draftIds = new Set<string>();
  const invoiceNumbers = new Set<string>();
  let invoiceTotalCents = 0;
  const invoiceApprovals = candidate.invoiceApprovals.map((source, index) => {
    for (const [value, label] of [
      [source.invoiceApprovalId, 'Rechnungsfreigabe'], [source.invoiceDraftId, 'Rechnungsentwurf'],
      [source.clientId, 'Pflegefall'], [source.invoiceNumber, 'Rechnungsnummer'],
    ] as const) required(value, label);
    const invoiceDate = date(source.invoiceDate, 'Rechnungsdatum');
    const sourceApprovedAt = micros(source.approvedAt, 'Rechnungsfreigabezeit');
    exactFingerprint(source.documentFingerprint, 'Dokumentfingerprint');
    if (!Number.isSafeInteger(source.approvalVersion) || source.approvalVersion < 1) throw new Error('Freigabefassung ist ungültig.');
    if (invoiceDate < periodFrom || invoiceDate > periodTo) throw new Error('Rechnungsfassung liegt außerhalb der Abschlussperiode.');
    if (sourceApprovedAt > cutoffAt) throw new Error('Nach dem Stichtag freigegebene Rechnung gehört nicht in diesen Abschluss.');
    if (input.includedInvoiceApprovalIds[index] !== source.invoiceApprovalId) throw new Error('Eingeschlossene Rechnungsfassungen sind nicht vollständig und geordnet gebunden.');
    if (approvalIds.has(source.invoiceApprovalId) || draftIds.has(source.invoiceDraftId) || invoiceNumbers.has(source.invoiceNumber)) throw new Error('Abschluss enthält doppelte Rechnungsidentitäten.');
    approvalIds.add(source.invoiceApprovalId); draftIds.add(source.invoiceDraftId); invoiceNumbers.add(source.invoiceNumber);
    invoiceTotalCents += nonNegativeCents(source.totalAmountCents, 'Rechnungsbetrag');
    if (!Number.isSafeInteger(invoiceTotalCents)) throw new Error('Periodensumme überschreitet den sicheren Zahlenbereich.');
    return Object.freeze({ ...source });
  });

  const correctionIds = new Set<string>();
  const requestIds = new Set<string>();
  const correctionList = corrections.map((source) => {
    for (const [value, label] of [
      [source.correctionId, 'Korrektur'], [source.clientRequestId, 'Korrektur-Anforderungs-ID'],
      [source.tenantId, 'Korrekturmandant'], [source.originalPeriodClosureId, 'Ursprungsabschluss'],
      [source.originalInvoiceApprovalId, 'Ursprungsrechnung'], [source.correctionPeriodId, 'Korrekturperiode'],
      [source.adjustmentEvidenceId, 'Korrekturbeleg'], [source.reason, 'Korrekturgrund'],
      [source.recordedBy, 'Korrekturidentität'], [source.recordedByName, 'Korrekturname'],
    ] as const) required(value, label);
    const correctionFrom = date(source.correctionPeriodFrom, 'Beginn der Korrekturperiode');
    const correctionTo = date(source.correctionPeriodTo, 'Ende der Korrekturperiode');
    const recordedAt = micros(source.recordedAt, 'Korrekturerfassung');
    exactFingerprint(source.adjustmentEvidenceFingerprint, 'Korrekturbelegfingerprint');
    signedCents(source.amountDeltaCents, 'Korrekturbetrag');
    if (source.tenantId !== candidate.tenantId || source.originalPeriodClosureId !== input.periodClosureId) throw new Error('Korrektur gehört nicht zum ursprünglichen Mandanten und Periodenabschluss.');
    if (!approvalIds.has(source.originalInvoiceApprovalId)) throw new Error('Korrektur verweist nicht auf eine im Abschluss enthaltene Rechnungsfassung.');
    if (correctionFrom <= periodTo || correctionTo < correctionFrom) throw new Error('Korrektur muss in einer gültigen späteren Korrekturperiode liegen.');
    if (recordedAt <= closedAt) throw new Error('Korrektur muss nach dem unveränderlichen Periodenabschluss erfasst werden.');
    if (correctionIds.has(source.correctionId) || requestIds.has(source.clientRequestId)) throw new Error('Korrektur enthält doppelte Identitäten.');
    correctionIds.add(source.correctionId); requestIds.add(source.clientRequestId);
    return Object.freeze({ ...source });
  });

  return Object.freeze({
    ...candidate,
    periodFrom,
    periodTo,
    cutoffAt,
    invoiceApprovals: Object.freeze(invoiceApprovals),
    openCases: Object.freeze([]),
    ...input,
    includedInvoiceApprovalIds: Object.freeze([...input.includedInvoiceApprovalIds]),
    approvedAt,
    closedAt,
    invoiceCount: invoiceApprovals.length,
    invoiceTotalCents,
    openCaseCount: 0,
    closureState: 'closed',
    correctionMode: 'subsequent_period_only',
    transmissionState: 'not_inferred',
    paymentState: 'not_inferred',
    historyMode: 'append_only',
    corrections: Object.freeze(correctionList),
  });
}
