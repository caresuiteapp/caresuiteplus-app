export type ClientClinicalEntryKind = 'diagnosis' | 'allergy' | 'intolerance' | 'unresolved_hint';
export type ClientClinicalDateMeaning = 'diagnosed_on' | 'onset_on' | 'reported_on' | 'unknown';
export type ClientClinicalVerification = 'unconfirmed' | 'provisional' | 'confirmed' | 'refuted';
export type ClientClinicalRecordState = 'active' | 'resolved' | 'entered_in_error';
export type ClientClinicalLegacyOriginKind = 'client_diagnoses' | 'client_diagnoses_notes' | 'client_allergies' | 'care_diagnosis';

export type ClientClinicalLegacyOriginReference = Readonly<{
  originKind: ClientClinicalLegacyOriginKind;
  originId: string;
  originUpdatedAt: string;
  original: Readonly<Record<string, unknown>>;
}>;

export type ClientClinicalLegacyCandidate = ClientClinicalLegacyOriginReference & Readonly<{
  displayLabel: string;
  displayText: string;
  linkedEntryId: string | null;
}>;

export type ClientClinicalHistoryEntry = Readonly<{
  id: string;
  requestId: string;
  tenantId: string;
  clientId: string;
  kind: ClientClinicalEntryKind;
  clinicalCode: string | null;
  clinicalText: string;
  sourceType: string;
  sourceReference: string;
  clinicalDate: string | null;
  dateMeaning: ClientClinicalDateMeaning;
  verification: ClientClinicalVerification;
  recordState: ClientClinicalRecordState;
  revision: number;
  supersedesId: string | null;
  recordedByProfileId: string;
  recordedByName: string;
  createdAt: string;
  updatedAt: string;
  legacyOrigin: ClientClinicalLegacyOriginReference | null;
}>;

export type ClientClinicalHistorySummary = Readonly<{
  clientName: string;
  clientUpdatedAt: string;
  diagnosesState: 'unknown' | 'present';
  allergiesState: 'unknown' | 'present';
  current: readonly ClientClinicalHistoryEntry[];
  history: readonly ClientClinicalHistoryEntry[];
  legacyCandidates: readonly ClientClinicalLegacyCandidate[];
}>;
