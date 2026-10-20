export const AMBULANT_QPR_PROFILE = Object.freeze({
  code: 'QPR-AMB-TEIL1A-2026-07-30',
  title: 'Qualitätsprüfungs-Richtlinien ambulante Pflege, Teil 1a – Ambulante Pflegedienste',
  versionDate: '2026-07-30',
  effectiveFrom: '2026-07-30',
  sourceUrl: 'https://md-bund.de/fileadmin/dokumente/Publikationen/SPV/PV_Qualitaetspruefung/QPR_Teil1a_ambulante_Pflegedienste_2026_07_30.pdf',
});

export type QualityInspectionEvidenceReference = {
  evidenceRefId: string;
  sourceType: 'care_record' | 'qm_document_version' | 'billing_record' | 'staff_qualification' | 'other';
  sourceEntityId: string;
  sourceVersionId: string | null;
  clientId: string | null;
  recordLocator: string;
  sourceSha256: string;
  documentedAt: string;
  capturedAt: string;
};

export type QualityInspectionGap = {
  gapId: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  identifiedAt: string;
  responsibleRole: string;
  dueAt: string | null;
};

export type QualityInspectionRequirementInput = {
  requirementMappingId: string;
  requirementCode: string;
  requirementTitle: string;
  inspectionLevel: 'person' | 'facility' | 'billing';
  clientId: string | null;
  evidence: readonly QualityInspectionEvidenceReference[];
  gaps: readonly QualityInspectionGap[];
};

export type QualityInspectionEvidenceSetInput = {
  evidenceSetId: string;
  clientRequestId: string;
  tenantId: string;
  auditId: string;
  qprProfileCode: string;
  qprVersionDate: string;
  qprEffectiveFrom: string;
  qprSourceUrl: string;
  qprSourceSha256: string;
  recordedBy: string;
  recordedByName: string;
  recordedAt: string;
  requirements: readonly QualityInspectionRequirementInput[];
};

export type QualityInspectionRequirement = QualityInspectionRequirementInput & {
  mappingState: 'evidence_linked' | 'gap_open' | 'evidence_linked_with_gap';
};

export type QualityInspectionEvidenceSet = Omit<QualityInspectionEvidenceSetInput, 'requirements'> & {
  requirements: readonly QualityInspectionRequirement[];
  requirementCount: number;
  evidenceReferenceCount: number;
  openGapCount: number;
  assessmentState: 'evidence_mapping_only';
  inspectionResult: 'not_inferred';
  careCompletion: 'not_inferred';
  historyMode: 'append_only';
};

const exactUtcMicros = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}(?:Z|\+00:00)$/;
const sha256 = /^[0-9a-f]{64}$/;
const requirementCode = /^(?:[1-5]\.\d+(?:\.\d+)?|A\.[1-3])$/;

function required(value: string | null | undefined, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} fehlt.`);
  return value.trim();
}

function micros(value: string, label: string): string {
  const result = required(value, label);
  if (!exactUtcMicros.test(result) || Number.isNaN(Date.parse(result))) throw new Error(`${label} benötigt exakt sechs UTC-Mikrosekundenstellen.`);
  return result;
}

function fingerprint(value: string, label: string): string {
  const result = required(value, label);
  if (!sha256.test(result)) throw new Error(`${label} benötigt einen SHA-256-Fingerprint.`);
  return result;
}

export function buildQualityInspectionEvidenceSet(input: QualityInspectionEvidenceSetInput): QualityInspectionEvidenceSet {
  for (const [value, label] of [
    [input.evidenceSetId, 'Nachweissatz'], [input.clientRequestId, 'Anforderungs-ID'], [input.tenantId, 'Mandant'],
    [input.auditId, 'Prüfung'], [input.recordedBy, 'Erfassungsidentität'], [input.recordedByName, 'Erfassungsname'],
  ] as const) required(value, label);
  if (input.qprProfileCode !== AMBULANT_QPR_PROFILE.code || input.qprVersionDate !== AMBULANT_QPR_PROFILE.versionDate ||
      input.qprEffectiveFrom !== AMBULANT_QPR_PROFILE.effectiveFrom || input.qprSourceUrl !== AMBULANT_QPR_PROFILE.sourceUrl) {
    throw new Error('QPR-Fassung oder Primärquelle ist nicht die gebundene ambulante Teil-1a-Fassung.');
  }
  fingerprint(input.qprSourceSha256, 'QPR-Original');
  const recordedAt = micros(input.recordedAt, 'Erfassungszeit');
  if (!input.requirements.length) throw new Error('Mindestens eine konkrete QPR-Anforderung ist erforderlich.');

  const mappingIds = new Set<string>();
  const requirementScopes = new Set<string>();
  const evidenceIds = new Set<string>();
  const gapIds = new Set<string>();
  let evidenceReferenceCount = 0;
  let openGapCount = 0;
  const requirements = input.requirements.map((item) => {
    required(item.requirementMappingId, 'Prüfzuordnung');
    const code = required(item.requirementCode, 'QPR-Anforderungsnummer');
    required(item.requirementTitle, 'QPR-Anforderung');
    if (!requirementCode.test(code)) throw new Error('QPR-Anforderungsnummer ist nicht eindeutig zuordenbar.');
    if (!['person', 'facility', 'billing'].includes(item.inspectionLevel)) throw new Error('Prüfebene ist ungültig.');
    if (item.inspectionLevel === 'person' && !item.clientId) throw new Error('Personenbezogene Prüfzuordnung benötigt eine native Pflegefall-ID.');
    if (item.inspectionLevel !== 'person' && item.clientId) throw new Error('Einrichtungs- oder Abrechnungszuordnung darf keinen Pflegefall erfinden.');
    const scopeKey = `${code}\u0000${item.inspectionLevel}\u0000${item.clientId ?? ''}`;
    if (mappingIds.has(item.requirementMappingId) || requirementScopes.has(scopeKey)) throw new Error('QPR-Prüfzuordnung ist doppelt.');
    mappingIds.add(item.requirementMappingId); requirementScopes.add(scopeKey);
    if (!item.evidence.length && !item.gaps.length) throw new Error('Jede QPR-Anforderung benötigt eine konkrete Aktenstelle oder eine ausdrücklich offene Lücke.');

    const evidence = item.evidence.map((entry) => {
      for (const [value, label] of [
        [entry.evidenceRefId, 'Nachweisreferenz'], [entry.sourceEntityId, 'Quellobjekt'], [entry.recordLocator, 'Aktenstelle'],
      ] as const) required(value, label);
      if (!['care_record', 'qm_document_version', 'billing_record', 'staff_qualification', 'other'].includes(entry.sourceType)) throw new Error('Quellart der Aktenstelle ist ungültig.');
      if (evidenceIds.has(entry.evidenceRefId)) throw new Error('Nachweisreferenz ist doppelt.');
      evidenceIds.add(entry.evidenceRefId);
      if (item.inspectionLevel === 'person' && entry.clientId !== item.clientId) throw new Error('Aktenstelle gehört nicht zum zugeordneten Pflegefall.');
      if (item.inspectionLevel !== 'person' && entry.clientId) throw new Error('Aktenstelle erfindet einen personenbezogenen Bezug.');
      fingerprint(entry.sourceSha256, 'Aktenstellen-Original');
      const documentedAt = micros(entry.documentedAt, 'Dokumentationszeit');
      const capturedAt = micros(entry.capturedAt, 'Nachweisaufnahmezeit');
      if (capturedAt < documentedAt || capturedAt > recordedAt) throw new Error('Aktenstelle wurde zeitlich widersprüchlich aufgenommen.');
      evidenceReferenceCount += 1;
      return Object.freeze({ ...entry, documentedAt, capturedAt });
    });

    const gaps = item.gaps.map((gap) => {
      for (const [value, label] of [[gap.gapId, 'Lücke'], [gap.description, 'Lückenbeschreibung'], [gap.responsibleRole, 'Verantwortliche Rolle']] as const) required(value, label);
      if (!['low', 'medium', 'high', 'critical'].includes(gap.severity)) throw new Error('Schweregrad der Lücke ist ungültig.');
      if (gapIds.has(gap.gapId)) throw new Error('Lückenidentität ist doppelt.');
      gapIds.add(gap.gapId);
      const identifiedAt = micros(gap.identifiedAt, 'Feststellungszeit');
      const dueAt = gap.dueAt ? micros(gap.dueAt, 'Lückenfrist') : null;
      if (identifiedAt > recordedAt || dueAt && dueAt <= identifiedAt) throw new Error('Lücke besitzt eine widersprüchliche Feststellungs- oder Fristzeit.');
      openGapCount += 1;
      return Object.freeze({ ...gap, identifiedAt, dueAt });
    });

    const mappingState = evidence.length && gaps.length ? 'evidence_linked_with_gap' : evidence.length ? 'evidence_linked' : 'gap_open';
    return Object.freeze({ ...item, evidence: Object.freeze(evidence), gaps: Object.freeze(gaps), mappingState });
  });

  return Object.freeze({
    ...input,
    recordedAt,
    requirements: Object.freeze(requirements),
    requirementCount: requirements.length,
    evidenceReferenceCount,
    openGapCount,
    assessmentState: 'evidence_mapping_only',
    inspectionResult: 'not_inferred',
    careCompletion: 'not_inferred',
    historyMode: 'append_only',
  });
}
