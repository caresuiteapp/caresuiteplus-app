export const SGB_XI_105_EXPORT_PROFILE = Object.freeze({
  profileId: 'sgb_xi_105_ta1_6_4_0',
  legalBasis: 'sgb_xi',
  transportFormat: 'gkv_edifact',
  technicalSpecificationVersion: '6.4.0',
  keyDirectoryVersion: '6.4.0',
  carrierDirectoryFormatVersion: '5.2',
  validFrom: '2026-05-01',
  validUntil: '2027-01-31',
  technicalSpecificationUrl: 'https://www.gkv-datenaustausch.de/media/dokumente/leistungserbringer_1/pflege/technische_anlagen_aktuell_2/TA1_6.4.0_20250707_oA.pdf',
  keyDirectoryUrl: 'https://www.gkv-datenaustausch.de/media/dokumente/leistungserbringer_1/pflege/technische_anlagen_aktuell_2/TA3_6.4.0_20250707_oA.pdf',
  carrierDirectoryFormatUrl: 'https://www.gkv-datenaustausch.de/media/dokumente/leistungserbringer_1/pflege/technische_anlagen_aktuell_2/TA1_ANH5_5.2_20250707_oA.pdf',
  softwareTestCatalogUrl: 'https://www.gkv-datenaustausch.de/media/dokumente/leistungserbringer_1/pflege/technische_anlagen_aktuell_2/TA1_ANH4_ANL1_20250707_oA.pdf',
} as const);

export type CareCostCarrierExportCandidate = {
  approvalId: string;
  invoiceDraftId: string;
  invoiceNumber: string;
  tenantId: string;
  clientId: string;
  approvalVersion: number;
  approvedAt: string;
  documentFingerprint: string;
  recipientIk: string;
  legalBasis: 'sgb_xi' | 'sgb_v' | string;
  transmissionStatus: 'not_transmitted' | string;
  totalAmountCents: number;
};

export type CareCostCarrierDirectorySnapshot = {
  fileName: string;
  fileSha256: string;
  publishedOn: string;
  resolvedCostCarrierIk: string;
  dataAcceptanceIk: string;
  physicalReceiverIk: string;
  encryptionReceiverIk: string;
};

export type CareCostCarrierExportArtifact = {
  payloadFileName: string;
  payloadSha256: string;
  payloadSizeBytes: number;
  orderFileName: string;
  orderFileSha256: string;
  orderFileSizeBytes: number;
  createdAt: string;
};

export type CareCostCarrierFormatValidation = {
  validatorName: string;
  validatorVersion: string;
  validatorRulesSha256: string;
  softwareTestCatalogVersion: '1.0';
  validationRunId: string;
  validatedAt: string;
  payloadSha256: string;
  orderFileSha256: string;
  result: 'valid' | 'invalid';
  errors: readonly string[];
  warnings: readonly string[];
};

export type CareCostCarrierExportRequest = {
  clientRequestId: string;
  profileId: typeof SGB_XI_105_EXPORT_PROFILE.profileId;
  technicalSpecificationVersion: string;
  keyDirectoryVersion: string;
  carrierDirectoryFormatVersion: string;
  specificationSha256: string;
  keyDirectorySha256: string;
  carrierDirectoryFormatSha256: string;
  carrierDirectory: CareCostCarrierDirectorySnapshot;
  artifact: CareCostCarrierExportArtifact;
  validation: CareCostCarrierFormatValidation;
};

export type CareCostCarrierExportRecord = CareCostCarrierExportRequest & {
  candidate: CareCostCarrierExportCandidate;
  validationState: 'format_validated_not_submitted' | 'format_rejected_not_submitted';
  transmissionStatus: 'not_transmitted';
  acceptanceStatus: 'not_inferred';
};

const exactUtcMicros = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}(?:Z|\+00:00)$/;
const sha256 = /^[0-9a-f]{64}$/;
const fingerprint = /^(?:[0-9a-f]{32}|[0-9a-f]{64})$/;
const ik = /^\d{9}$/;

function required(value: string, label: string): string {
  if (!value.trim()) throw new Error(`${label} fehlt.`);
  return value;
}

function calendarDate(value: string, label: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${label} ist ungültig.`);
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new Error(`${label} ist ungültig.`);
}

function exactMicros(value: string, label: string): void {
  if (!exactUtcMicros.test(value) || Number.isNaN(Date.parse(value))) throw new Error(`${label} benötigt exakt sechs UTC-Mikrosekundenstellen.`);
}

function exactSha(value: string, label: string): void {
  if (!sha256.test(value)) throw new Error(`${label} benötigt einen SHA-256-Fingerabdruck.`);
}

function exactIk(value: string, label: string): void {
  if (!ik.test(value)) throw new Error(`${label} benötigt genau neun Ziffern.`);
}

function positiveSize(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${label} ist ungültig.`);
}

function cleanMessages(values: readonly string[], label: string): string[] {
  if (!Array.isArray(values)) throw new Error(`${label} ist ungültig.`);
  const clean = values.map((value) => {
    if (typeof value !== 'string') throw new Error(`${label} ist ungültig.`);
    return required(value, label).trim();
  });
  if (new Set(clean).size !== clean.length) throw new Error(`${label} enthält doppelte Einträge.`);
  return clean;
}

export function getSgbXi105ExportProfileForDate(value: string) {
  calendarDate(value, 'Exporttag');
  if (value < SGB_XI_105_EXPORT_PROFILE.validFrom || value > SGB_XI_105_EXPORT_PROFILE.validUntil) {
    throw new Error('Für den Exporttag ist das hinterlegte §105-SGB-XI-Empfangsprofil nicht gültig. Eine aktuelle Spezifikation muss ausdrücklich hinterlegt werden.');
  }
  return SGB_XI_105_EXPORT_PROFILE;
}

export function buildCareCostCarrierExportRecord(
  candidate: CareCostCarrierExportCandidate,
  request: CareCostCarrierExportRequest,
): CareCostCarrierExportRecord {
  for (const [value, label] of [
    [candidate.approvalId, 'Freigabebeleg'], [candidate.invoiceDraftId, 'Rechnungsentwurf'],
    [candidate.invoiceNumber, 'Rechnungsnummer'], [candidate.tenantId, 'Mandant'],
    [candidate.clientId, 'Pflegefall'], [request.clientRequestId, 'Anforderungs-ID'],
    [request.carrierDirectory.fileName, 'Kostenträgerdatei'], [request.artifact.payloadFileName, 'Nutzdatendatei'],
    [request.artifact.orderFileName, 'Auftragsdatei'], [request.validation.validatorName, 'Formatvalidator'],
    [request.validation.validatorVersion, 'Validatorversion'], [request.validation.validationRunId, 'Validierungslauf'],
  ] as const) required(value, label);
  if (candidate.approvalVersion !== 1) throw new Error('Export benötigt genau die unveränderte Freigabeversion 1.');
  exactMicros(candidate.approvedAt, 'Freigabezeit');
  if (!fingerprint.test(candidate.documentFingerprint)) throw new Error('Dokumentfingerprint ist ungültig.');
  if (candidate.legalBasis !== 'sgb_xi') throw new Error('Dieses Empfangsprofil gilt ausschließlich für §105 SGB XI; §302 SGB V benötigt ein eigenes Profil.');
  if (candidate.transmissionStatus !== 'not_transmitted') throw new Error('Eine bereits als übertragen markierte Fassung darf nicht neu als Erstexport vorbereitet werden.');
  if (!Number.isSafeInteger(candidate.totalAmountCents) || candidate.totalAmountCents < 0) throw new Error('Rechnungssumme ist ungültig.');
  exactIk(candidate.recipientIk, 'Kostenträger-IK');

  const profile = getSgbXi105ExportProfileForDate(request.artifact.createdAt.slice(0, 10));
  if (request.profileId !== profile.profileId || request.technicalSpecificationVersion !== profile.technicalSpecificationVersion ||
      request.keyDirectoryVersion !== profile.keyDirectoryVersion || request.carrierDirectoryFormatVersion !== profile.carrierDirectoryFormatVersion) {
    throw new Error('Technische Anlage, Schlüssel- oder Kostenträgerdateiformat stimmen nicht mit dem am Exporttag gültigen Empfangsprofil überein.');
  }
  exactSha(request.specificationSha256, 'Technische Anlage');
  exactSha(request.keyDirectorySha256, 'Schlüsselverzeichnis');
  exactSha(request.carrierDirectoryFormatSha256, 'Kostenträgerdateiformat');

  const directory = request.carrierDirectory;
  exactSha(directory.fileSha256, 'Kostenträgerdatei');
  calendarDate(directory.publishedOn, 'Veröffentlichungstag der Kostenträgerdatei');
  if (directory.publishedOn > request.artifact.createdAt.slice(0, 10)) throw new Error('Kostenträgerdatei wurde erst nach dem Export veröffentlicht.');
  exactIk(directory.resolvedCostCarrierIk, 'Aufgelöste Kostenträger-IK');
  exactIk(directory.dataAcceptanceIk, 'Datenannahme-IK');
  exactIk(directory.physicalReceiverIk, 'Physischer Empfänger');
  exactIk(directory.encryptionReceiverIk, 'Verschlüsselungsempfänger');
  if (directory.resolvedCostCarrierIk !== candidate.recipientIk) throw new Error('Kostenträgerdatei wurde für eine andere Kostenträger-IK aufgelöst.');

  const artifact = request.artifact;
  exactMicros(artifact.createdAt, 'Dateierzeugungszeit');
  exactSha(artifact.payloadSha256, 'Nutzdatendatei');
  exactSha(artifact.orderFileSha256, 'Auftragsdatei');
  positiveSize(artifact.payloadSizeBytes, 'Nutzdatendateigröße');
  positiveSize(artifact.orderFileSizeBytes, 'Auftragsdateigröße');
  if (artifact.payloadFileName === artifact.orderFileName || artifact.payloadSha256 === artifact.orderFileSha256) throw new Error('Auftrags- und Nutzdatendatei müssen getrennte Originale bleiben.');

  const validation = request.validation;
  exactMicros(validation.validatedAt, 'Validierungszeit');
  exactSha(validation.validatorRulesSha256, 'Validatorregelsatz');
  exactSha(validation.payloadSha256, 'Validierte Nutzdatendatei');
  exactSha(validation.orderFileSha256, 'Validierte Auftragsdatei');
  if (validation.softwareTestCatalogVersion !== '1.0') throw new Error('Prüfkatalogversion stimmt nicht mit dem gebundenen §105-SGB-XI-Profil überein.');
  if (validation.payloadSha256 !== artifact.payloadSha256 || validation.orderFileSha256 !== artifact.orderFileSha256) throw new Error('Prüfprotokoll gehört nicht zu den gespeicherten Exportdateien.');
  if (validation.validatedAt < artifact.createdAt) throw new Error('Formatprüfung liegt vor der Erzeugung der geprüften Dateien.');
  const errors = cleanMessages(validation.errors, 'Validierungsfehler');
  const warnings = cleanMessages(validation.warnings, 'Validierungswarnung');
  if (validation.result === 'valid' && errors.length) throw new Error('Ein gültiges Prüfprotokoll darf keine Formatfehler enthalten.');
  if (validation.result === 'invalid' && !errors.length) throw new Error('Ein ungültiges Prüfprotokoll benötigt mindestens einen konkreten Formatfehler.');
  if (!['valid', 'invalid'].includes(validation.result)) throw new Error('Validierungsergebnis ist ungültig.');

  return Object.freeze({
    ...request,
    carrierDirectory: Object.freeze({ ...directory }),
    artifact: Object.freeze({ ...artifact }),
    validation: Object.freeze({ ...validation, errors: Object.freeze(errors), warnings: Object.freeze(warnings) }),
    candidate: Object.freeze({ ...candidate }),
    validationState: validation.result === 'valid' ? 'format_validated_not_submitted' : 'format_rejected_not_submitted',
    transmissionStatus: 'not_transmitted',
    acceptanceStatus: 'not_inferred',
  });
}
