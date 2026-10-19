export type CareInvoicePayerType = 'krankenkasse' | 'pflegekasse' | 'self_payer' | 'mixed';

export type CareInvoiceFoundationCandidate = {
  billingCaseId: string;
  serviceProofId: string;
  tenantId: string;
  clientId: string;
  serviceDate: string;
  amountCents: number;
  billingStatus: string;
  invoiceFoundationId: string | null;
  payerType: CareInvoicePayerType;
  recipientName: string;
  recipientIk: string;
  proofStatus: string;
  proofFingerprint: string;
  proofApprovedAt: string;
  logicalContractId: string;
  contractEventId: string;
  contractVersion: number;
  contractFingerprint: string;
};

export type CareInvoiceFoundationGroup = {
  key: string;
  tenantId: string;
  clientId: string;
  periodFrom: string;
  periodTo: string;
  payerType: Exclude<CareInvoicePayerType, 'mixed'>;
  recipientName: string;
  recipientKey: string;
  logicalContractId: string;
  contractEventId: string;
  contractVersion: number;
  contractFingerprint: string;
  billingCaseIds: string[];
  serviceProofIds: string[];
  proofFingerprints: string[];
  proofCount: number;
  totalAmountCents: number;
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

function microsecondInstant(value: string, label: string): void {
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})\.(\d{6})Z$/.exec(value);
  if (!match || Number.isNaN(Date.parse(`${match[1]}Z`)) || new Date(Date.parse(`${match[1]}Z`)).toISOString().slice(0, 19) !== match[1]) {
    throw new Error(`${label} muss als UTC-Zeitpunkt mikrosekundengenau vorliegen.`);
  }
}

function recipientKey(candidate: CareInvoiceFoundationCandidate): string {
  if (candidate.payerType === 'mixed') throw new Error('Gemischte Kostenträger sind keine eindeutige Rechnungsgrundlage.');
  if (candidate.payerType === 'self_payer') return `self:${required(candidate.clientId, 'Pflegefall')}`;
  return `ik:${required(candidate.recipientIk, 'Kostenträger-IK')}`;
}

function validateCandidate(candidate: CareInvoiceFoundationCandidate, tenantId: string, clientId: string, periodFrom: string, periodTo: string): void {
  for (const [value, label] of [
    [candidate.billingCaseId, 'Abrechnungsfall-ID'], [candidate.serviceProofId, 'Leistungsnachweis-ID'],
    [candidate.tenantId, 'Mandant'], [candidate.clientId, 'Pflegefall'], [candidate.recipientName, 'Empfänger'],
    [candidate.proofFingerprint, 'Freigabe-Fingerprint'], [candidate.logicalContractId, 'Logische Vertrags-ID'],
    [candidate.contractEventId, 'Vertragsereignis-ID'], [candidate.contractFingerprint, 'Vertragsfingerprint'],
  ] as const) required(value, label);
  calendarDate(candidate.serviceDate, 'Leistungsdatum');
  microsecondInstant(candidate.proofApprovedAt, 'Freigabezeitpunkt');
  if (candidate.tenantId !== tenantId || candidate.clientId !== clientId) throw new Error('Abrechnungsfall überschreitet Mandant oder Pflegefall.');
  if (candidate.serviceDate < periodFrom || candidate.serviceDate > periodTo) throw new Error('Abrechnungsfall liegt außerhalb des gewählten Zeitraums.');
  if (candidate.billingStatus !== 'released' || candidate.invoiceFoundationId !== null) throw new Error('Abrechnungsfall ist nicht frei und freigegeben.');
  if (candidate.proofStatus !== 'approved') throw new Error('Originalnachweis ist nicht tatsächlich freigegeben.');
  if (!Number.isSafeInteger(candidate.amountCents) || candidate.amountCents <= 0) throw new Error('Abrechnungsbetrag ist ungültig.');
  if (!Number.isInteger(candidate.contractVersion) || candidate.contractVersion < 1) throw new Error('Vertragsversion ist ungültig.');
  recipientKey(candidate);
}

export function buildCareInvoiceFoundationGroups(
  candidates: readonly CareInvoiceFoundationCandidate[],
  scope: { tenantId: string; clientId: string; periodFrom: string; periodTo: string },
): CareInvoiceFoundationGroup[] {
  required(scope.tenantId, 'Mandant'); required(scope.clientId, 'Pflegefall');
  calendarDate(scope.periodFrom, 'Zeitraumbeginn'); calendarDate(scope.periodTo, 'Zeitraumende');
  if (scope.periodTo < scope.periodFrom) throw new Error('Abrechnungszeitraum ist ungültig.');
  const caseIds = new Set<string>(); const proofIds = new Set<string>();
  const groups = new Map<string, CareInvoiceFoundationGroup>();
  for (const candidate of candidates) {
    validateCandidate(candidate, scope.tenantId, scope.clientId, scope.periodFrom, scope.periodTo);
    if (caseIds.has(candidate.billingCaseId)) throw new Error('Abrechnungsfall-ID ist doppelt.');
    if (proofIds.has(candidate.serviceProofId)) throw new Error('Leistungsnachweis-ID ist doppelt.');
    caseIds.add(candidate.billingCaseId); proofIds.add(candidate.serviceProofId);
    const target = recipientKey(candidate);
    const key = [candidate.tenantId, candidate.clientId, scope.periodFrom, scope.periodTo, candidate.payerType, target,
      candidate.logicalContractId, candidate.contractEventId, String(candidate.contractVersion), candidate.contractFingerprint].join('|');
    const group = groups.get(key) ?? {
      key, tenantId: candidate.tenantId, clientId: candidate.clientId, periodFrom: scope.periodFrom, periodTo: scope.periodTo,
      payerType: candidate.payerType as Exclude<CareInvoicePayerType, 'mixed'>, recipientName: candidate.recipientName,
      recipientKey: target, logicalContractId: candidate.logicalContractId, contractEventId: candidate.contractEventId,
      contractVersion: candidate.contractVersion, contractFingerprint: candidate.contractFingerprint,
      billingCaseIds: [], serviceProofIds: [], proofFingerprints: [], proofCount: 0, totalAmountCents: 0,
    };
    if (group.recipientName !== candidate.recipientName) throw new Error('Empfängername ist für denselben Empfängerschlüssel widersprüchlich.');
    group.billingCaseIds.push(candidate.billingCaseId); group.serviceProofIds.push(candidate.serviceProofId);
    group.proofFingerprints.push(candidate.proofFingerprint); group.proofCount += 1; group.totalAmountCents += candidate.amountCents;
    if (!Number.isSafeInteger(group.totalAmountCents)) throw new Error('Gesamtbetrag überschreitet den sicheren Zahlenbereich.');
    groups.set(key, group);
  }
  return [...groups.values()].map((group) => ({ ...group,
    billingCaseIds: [...group.billingCaseIds].sort(), serviceProofIds: [...group.serviceProofIds].sort(),
    proofFingerprints: [...group.proofFingerprints].sort(),
  })).sort((left, right) => left.key.localeCompare(right.key));
}

export function requireCompleteCareInvoiceFoundationSelection(group: CareInvoiceFoundationGroup, selectedIds: readonly string[]): string[] {
  const selected = [...selectedIds];
  if (new Set(selected).size !== selected.length) throw new Error('Auswahl enthält doppelte Abrechnungsfall-IDs.');
  const expected = [...group.billingCaseIds].sort();
  if (selected.length !== expected.length || [...selected].sort().some((id, index) => id !== expected[index])) {
    throw new Error('Auswahl muss die vollständige, unveränderte Bereitschaftsgruppe enthalten.');
  }
  return expected;
}
