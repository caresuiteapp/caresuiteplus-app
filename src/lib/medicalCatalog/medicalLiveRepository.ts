/** Medizinische Stammdaten — Tabellen-Registry für zukünftige Supabase-Anbindung. */

export const MEDICAL_CATALOG_SOURCES_TABLE = 'medical_catalog_sources';
export const MEDICAL_CATALOG_VERSIONS_TABLE = 'medical_catalog_versions';
export const ICD_CODES_TABLE = 'icd_codes';
export const MEDICATION_CATALOG_ITEMS_TABLE = 'medication_catalog_items';
export const MEDICATION_RECORDS_TABLE = 'medication_records';
export const VITAL_SIGN_RECORDS_TABLE = 'vital_sign_records';
export const MEDICAL_DOCUMENTATION_NOTES_TABLE = 'medical_documentation_notes';
export const MEDICAL_CATALOG_IMPORT_JOBS_TABLE = 'medical_catalog_import_jobs';
export const MEDICAL_AUDIT_EVENTS_TABLE = 'medical_audit_events';

export const MEDICAL_LIVE_REQUIRED_MIGRATION = '0047_medical_catalog_prepared.sql';

export const ICD_CODE_SELECT_COLUMNS =
  'id, version_id, code, title, chapter, block_code, parent_code, search_text, is_terminal';

export const MEDICAL_DOCUMENTATION_NOTE_SELECT_COLUMNS =
  'id, tenant_id, client_id, note_type, title, content, icd_code_id, icd_code_text, is_physician_statement, disclaimer_acknowledged, recorded_at';
