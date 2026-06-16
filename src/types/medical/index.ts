/** Lizenzstatus je medizinischer Katalogquelle. */
export type MedicalCatalogLicenseStatus =
  | 'public'
  | 'licensed_required'
  | 'provider_required'
  | 'internal_only'
  | 'disabled';

export type MedicalCatalogSourceKey =
  | 'icd10_gm'
  | 'snomed_ct'
  | 'loinc'
  | 'ucum'
  | 'atc_ddd'
  | 'pzn_ifa'
  | 'rote_liste'
  | 'abdata'
  | 'bfarm_am';

export type MedicalCatalogVersionStatus =
  | 'prepared'
  | 'importing'
  | 'active'
  | 'deprecated'
  | 'disabled';

export type MedicalDocumentationNoteType =
  | 'physician_statement'
  | 'diagnosis_documentation'
  | 'medication_hint'
  | 'vital_hint'
  | 'wound_documentation'
  | 'general_documentation';

export type MedicalBlockedFunctionKey =
  | 'diagnosis_ai'
  | 'therapy_recommendation'
  | 'medication_decision'
  | 'automatic_risk_assessment'
  | 'treatment_recommendation';

export type MedicalCatalogSourceEntry = {
  sourceKey: MedicalCatalogSourceKey;
  label: string;
  description: string;
  licenseStatus: MedicalCatalogLicenseStatus;
  isSearchEnabled: boolean;
  isImportEnabled: boolean;
  mdrRiskNote: string;
  connectIntegrationKey?: string;
};

export type IcdCodeEntry = {
  id: string;
  code: string;
  title: string;
  chapter: string | null;
  blockCode: string | null;
  isTerminal: boolean;
};

export type IcdSearchResult = {
  query: string;
  results: IcdCodeEntry[];
  sourceKey: MedicalCatalogSourceKey;
  isDemoCatalog: boolean;
};

export type PhysicianStatementDiagnosisInput = {
  clientId: string;
  icdCode: string;
  icdTitle: string;
  physicianStatementText: string;
  disclaimerAcknowledged: boolean;
};

export type PhysicianStatementDiagnosisRecord = {
  id: string;
  tenantId: string;
  clientId: string;
  icdCode: string;
  icdTitle: string;
  content: string;
  isPhysicianStatement: true;
  recordedAt: string;
};

export type MedicationDocumentationHint = {
  kind: 'informative';
  message: string;
  noMedicalDecision: true;
};

export type MedicationMasterDataRecord = {
  id: string;
  tenantId: string;
  clientId: string;
  documentedName: string;
  dosageNote: string | null;
  sourceAttribution: 'master_data' | 'physician_statement' | 'manual_entry';
  hint: MedicationDocumentationHint;
  recordedAt: string;
};

export type VitalSignDocumentationInput = {
  clientId: string;
  signType: 'blood_pressure' | 'pulse' | 'temperature' | 'weight' | 'oxygen' | 'respiratory_rate';
  valueText: string;
  unit?: string;
};

export type VitalSignDocumentationRecord = {
  id: string;
  tenantId: string;
  clientId: string;
  signType: VitalSignDocumentationInput['signType'];
  valueText: string;
  unit: string | null;
  documentationHint: string;
  measuredAt: string;
};

export type MedicalAuditEventType =
  | 'icd_documented'
  | 'medication_documented'
  | 'vital_recorded'
  | 'catalog_search'
  | 'catalog_import_blocked'
  | 'license_check'
  | 'mdr_disclaimer_shown'
  | 'blocked_function_attempt';

export const MEDICAL_DOCUMENTATION_DISCLAIMER =
  'Diese Funktion unterstützt die Dokumentation und ersetzt keine medizinische Entscheidung.';

export const MEDICAL_MDR_RISK_HINT =
  'Hinweis MDR/Medizinprodukterecht: CareSuite+ ist als Dokumentations- und Stammdatenhilfe konzipiert — ' +
  'kein Medizinprodukt, keine Diagnose-KI, keine Therapieempfehlung. Automatische klinische Entscheidungen ' +
  'sind nicht vorgesehen und würden eine gesonderte rechtliche Prüfung erfordern.';

export const MEDICAL_NO_THERAPY_HINT =
  'Keine Therapieempfehlung — nur dokumentarische Erfassung.';

export const MEDICAL_MEDICATION_HINT_PREFIX =
  'Informationshinweis (keine Medikationsentscheidung):';
