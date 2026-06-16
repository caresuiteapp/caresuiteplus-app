export const RECRUITING_LIVE_WIRING_MIGRATION = '0051_recruiting_employee_onboarding_prepared.sql';

export const RECRUITING_PREPARED_MESSAGE =
  'Bewerbermanagement und Mitarbeiter-Onboarding sind vorbereitet. ' +
  'Persistenz über Migration 0051 — noch nicht produktiv bis Remote-Migration angewendet.';

export const APPLICANT_DEFAULT_RETENTION_DAYS = 180;

export const APPLICANT_EXTENDED_RETENTION_DAYS = 730;

/** Pflichtunterlagen bei Einstellung (Prompt 76 C) */
export const DEFAULT_REQUIRED_APPLICANT_DOCUMENT_TYPES = [
  'cv',
  'cover_letter',
  'qualifications',
] as const;

/** Pflichtschulungen bei Einstellung — Integration Prompt 75 */
export const DEFAULT_MANDATORY_TRAINING_KEYS_ON_HIRE = [
  'datenschutz',
  'schweigepflicht',
  'hygiene',
  'documentation_duty',
] as const;

export function isRecruitingLiveReady(): boolean {
  return false;
}

export function isRecruitingPreparedOnly(): boolean {
  return true;
}
