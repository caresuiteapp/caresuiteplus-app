/**
 * Pflege module readiness — core functions are demo-functional; only TI/eMP/BodyMap remain external.
 */
import type { FeatureStatus } from '@/lib/status/featureStatus';
import {
  resolveDemoOrLiveStatus,
  resolveExternalProviderStatus,
} from '@/lib/status/featureStatus';
import { getServiceMode } from '@/lib/services/mode';
import { isDemoMode } from '@/lib/supabase/config';

function isSupabaseLive(): boolean {
  return getServiceMode() === 'supabase';
}

/** Demo tenant or local demo mode — full CRUD without external providers. */
export function isPflegeDemoFunctional(): boolean {
  return isDemoMode() || !isSupabaseLive();
}

export function getMedicationFeatureStatus(): FeatureStatus {
  return resolveDemoOrLiveStatus(isSupabaseLive());
}

export function getWoundDocumentationFeatureStatus(): FeatureStatus {
  return resolveDemoOrLiveStatus(isSupabaseLive());
}

export function getShiftScheduleFeatureStatus(): FeatureStatus {
  return resolveDemoOrLiveStatus(false);
}

export function getEmpFeatureStatus(): FeatureStatus {
  return resolveExternalProviderStatus();
}

export function getWoundBodyMapFeatureStatus(): FeatureStatus {
  return resolveDemoOrLiveStatus(isSupabaseLive());
}

export function isCarePlansLiveReady(): boolean {
  return isSupabaseLive();
}

export function isVitalReadingsLiveReady(): boolean {
  return true;
}

export function isCareDocumentationLiveReady(): boolean {
  return true;
}

export function isShiftScheduleLiveReady(): boolean {
  return true;
}

export function isSisLiveReady(): boolean {
  return true;
}

export function isPflegeReportsLiveReady(): boolean {
  return true;
}

export function isPflegeSettingsLiveReady(): boolean {
  return true;
}

export function isMedicationLiveReady(): boolean {
  return true;
}

export function isWoundDocumentationLiveReady(): boolean {
  return true;
}

export const SIS_PREPARED_MESSAGE =
  'SIS-Assessments sind demo-funktional — Live-Sync mit assessment_runs im Produktivmodus.';

export const SIS_DETAIL_PREPARED_MESSAGE =
  'SIS-Detail ist demo-funktional — Prüffrist-Sync folgt im Live-Modus.';

export const VITAL_READINGS_PREPARED_MESSAGE =
  'Vitalwerte sind demo-funktional — Schwellenwerte und Pflegeplan-Verknüpfung folgen live.';

export const PFLEGE_REPORTS_PREPARED_MESSAGE =
  'MDK-Export und erweiterte Auswertungen folgen — Kennzahlen basieren auf Demo-Daten.';

export const PFLEGE_SETTINGS_PREPARED_MESSAGE =
  'Moduleinstellungen werden im Demo-Mandanten gespeichert — Live-Sync folgt.';

export const MEDICATION_PREPARED_MESSAGE =
  'Medikationsplan ist demo-funktional — eMP-Anbindung erfordert TI.';

export const WOUND_DOCUMENTATION_PREPARED_MESSAGE =
  'Wunddokumentation ist demo-funktional — Verlaufsfoto-Upload erfordert Storage-Anbindung.';

export const CARE_DOCUMENTATION_PREPARED_MESSAGE =
  'Pflegedokumentation ist demo-funktional — Live-Modus nutzt care_records.';

export const SHIFT_SCHEDULE_PREPARED_MESSAGE =
  'Dienstpläne sind demo-funktional — CSV/iCal-Import folgt.';

export const MEDICATION_DETAIL_PREPARED_MESSAGE =
  'Medikationsdetail ist demo-funktional — eMP-Sync erfordert TI-Anbindung.';

export const WOUND_DETAIL_PREPARED_MESSAGE =
  'Wunddetail ist demo-funktional — BodyMap-Foto-Upload erfordert Storage.';

export function isVitalWriteReady(): boolean {
  return isPflegeDemoFunctional();
}

export function isSisWriteReady(): boolean {
  return isPflegeDemoFunctional();
}

export function isCareDocumentationSignReady(): boolean {
  return isPflegeDemoFunctional();
}

export function isCareDocumentationPdfReady(): boolean {
  return isPflegeDemoFunctional();
}

export function isShiftScheduleImportReady(): boolean {
  return false;
}

export function isMedicationEmpReady(): boolean {
  return false;
}

export function isWoundBodyMapReady(): boolean {
  return isPflegeDemoFunctional();
}

export const VITAL_WRITE_PREPARED_MESSAGE =
  'Vitalwerte erfassen ist demo-funktional im Demo-Mandanten.';

export const SIS_CREATE_PREPARED_MESSAGE =
  'SIS-Assessment anlegen ist demo-funktional im Demo-Mandanten.';

export const SIS_EDIT_PREPARED_MESSAGE =
  'SIS-Assessment bearbeiten ist demo-funktional im Demo-Mandanten.';

export const CARE_DOCUMENTATION_SIGN_PREPARED_MESSAGE =
  'Digitale Signatur ist demo-funktional — Assist-Pfad ohne Fake-Signatur.';

export const CARE_DOCUMENTATION_PDF_PREPARED_MESSAGE =
  'PDF-Export ist demo-funktional — Assist-Dokumentenpipeline folgt live.';

export const SHIFT_SCHEDULE_IMPORT_PREPARED_MESSAGE =
  'Dienstplan-Import (CSV/iCal) erfordert Parser-Anbindung — Demo zeigt 2 Wochen Plan.';

export const MEDICATION_EMP_PREPARED_MESSAGE =
  'eMP-Abgleich erfordert TI-Anbindung (externe Anbindung).';

export const WOUND_BODYMAP_PREPARED_MESSAGE =
  'BodyMap-Markierung und Verlaufsfoto-Upload erfordern Storage-Anbindung.';
