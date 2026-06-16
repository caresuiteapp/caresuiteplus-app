export {
  countProtectedMedicalCatalogSources,
  getMedicalCatalogSource,
  getMedicalCatalogSourcesRequiringLicense,
  isMedicalCatalogSourceUsable,
  listMedicalCatalogSourcesByLicense,
  MEDICAL_CATALOG_SOURCE_REGISTRY,
} from './medicalCatalogRegistry';
export {
  assertMedicalFunctionAllowed,
  canUseMedicalCatalogInCurrentMode,
  countMedicalLiveFlipBlockersRemaining,
  getMedicalLiveFlipBlockers,
  isMedicalCatalogLiveReady,
  isMedicalCatalogWiringPrepared,
  isMedicalFunctionBlocked,
  MEDICAL_BLOCKED_FUNCTION_LABELS,
  MEDICAL_BLOCKED_FUNCTIONS,
  MEDICAL_LIVE_WIRING_MIGRATION,
  MEDICAL_PREPARED_MESSAGE,
} from './medicalModuleConfig';
export type { MedicalLiveFlipBlocker } from './medicalModuleConfig';
export {
  ICD_CODES_TABLE,
  ICD_CODE_SELECT_COLUMNS,
  MEDICAL_AUDIT_EVENTS_TABLE,
  MEDICAL_CATALOG_IMPORT_JOBS_TABLE,
  MEDICAL_CATALOG_SOURCES_TABLE,
  MEDICAL_CATALOG_VERSIONS_TABLE,
  MEDICAL_DOCUMENTATION_NOTES_TABLE,
  MEDICAL_DOCUMENTATION_NOTE_SELECT_COLUMNS,
  MEDICAL_LIVE_REQUIRED_MIGRATION,
  MEDICATION_CATALOG_ITEMS_TABLE,
  MEDICATION_RECORDS_TABLE,
  VITAL_SIGN_RECORDS_TABLE,
} from './medicalLiveRepository';
