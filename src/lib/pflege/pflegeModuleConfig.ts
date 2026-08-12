/** Produktiver Funktionsstatus des Pflege-Moduls. Demo-Schreibpfade sind entfernt. */
import type { FeatureStatus } from '@/lib/status/featureStatus';
import { resolveDemoOrLiveStatus, resolveExternalProviderStatus } from '@/lib/status/featureStatus';
import { getServiceMode } from '@/lib/services/mode';

function isSupabaseLive(): boolean { return getServiceMode() === 'supabase'; }
export function isPflegeDemoFunctional(): boolean { return false; }
export function getMedicationFeatureStatus(): FeatureStatus { return resolveDemoOrLiveStatus(isSupabaseLive()); }
export function getWoundDocumentationFeatureStatus(): FeatureStatus { return resolveDemoOrLiveStatus(isSupabaseLive()); }
export function getShiftScheduleFeatureStatus(): FeatureStatus { return resolveDemoOrLiveStatus(false); }
export function getEmpFeatureStatus(): FeatureStatus { return resolveExternalProviderStatus(); }
export function getWoundBodyMapFeatureStatus(): FeatureStatus { return resolveDemoOrLiveStatus(isSupabaseLive()); }
export function isCarePlansLiveReady(): boolean { return isSupabaseLive(); }
export function isVitalReadingsLiveReady(): boolean { return isSupabaseLive(); }
export function isCareDocumentationLiveReady(): boolean { return isSupabaseLive(); }
export function isShiftScheduleLiveReady(): boolean { return false; }
export function isSisLiveReady(): boolean { return isSupabaseLive(); }
export function isPflegeReportsLiveReady(): boolean { return isSupabaseLive(); }
export function isPflegeSettingsLiveReady(): boolean { return isSupabaseLive(); }
export function isMedicationLiveReady(): boolean { return isSupabaseLive(); }
export function isWoundDocumentationLiveReady(): boolean { return isSupabaseLive(); }

export const SIS_PREPARED_MESSAGE = 'SIS-Assessments werden mit der produktiven Datenbank synchronisiert.';
export const SIS_DETAIL_PREPARED_MESSAGE = 'SIS-Detail mit produktivem Prüf- und Freigabestatus.';
export const VITAL_READINGS_PREPARED_MESSAGE = 'Produktive Vitalwertdokumentation mit klientenbezogener Konfiguration.';
export const PFLEGE_REPORTS_PREPARED_MESSAGE = 'Auswertungen basieren auf produktiven Pflegedaten.';
export const PFLEGE_SETTINGS_PREPARED_MESSAGE = 'Moduleinstellungen werden produktiv gespeichert.';
export const MEDICATION_PREPARED_MESSAGE = 'Medikationsdokumentation; eMP erfordert die TI-Anbindung.';
export const WOUND_DOCUMENTATION_PREPARED_MESSAGE = 'Produktive Wundfall- und Verlaufsdokumentation; Medienreferenzen werden getrennt über die BodyMap verwaltet.';
export const CARE_DOCUMENTATION_PREPARED_MESSAGE = 'Append-only Pflegedokumentation mit serverseitiger Urheber- und Zeitzuordnung.';
export const SHIFT_SCHEDULE_PREPARED_MESSAGE = 'Dienstplan mit produktiver Datenbasis.';
export const MEDICATION_DETAIL_PREPARED_MESSAGE = 'Medikationsdetail; eMP-Abgleich erfordert die TI-Anbindung.';
export const WOUND_DETAIL_PREPARED_MESSAGE = 'Wunddetail mit BodyMap- und serverseitigem Verlauf.';
export function isVitalWriteReady(): boolean { return isSupabaseLive(); }
export function isSisWriteReady(): boolean { return isSupabaseLive(); }
export function isCareDocumentationSignReady(): boolean { return isSupabaseLive(); }
export function isCareDocumentationPdfReady(): boolean { return false; }
export function isShiftScheduleImportReady(): boolean { return false; }
export function isMedicationEmpReady(): boolean { return false; }
export function isWoundBodyMapReady(): boolean { return isSupabaseLive(); }
export const VITAL_WRITE_PREPARED_MESSAGE = 'Live-Erfassung aktiv · Zeitstempel und Mitarbeiter:in werden serverseitig protokolliert.';
export const SIS_CREATE_PREPARED_MESSAGE = 'SIS-Assessment wird produktiv angelegt.';
export const SIS_EDIT_PREPARED_MESSAGE = 'SIS-Assessment wird produktiv bearbeitet.';
export const CARE_DOCUMENTATION_SIGN_PREPARED_MESSAGE = 'Fachliche Signatur mit serverseitiger Person- und Zeitzuordnung.';
export const CARE_DOCUMENTATION_PDF_PREPARED_MESSAGE = 'PDF-Export über die produktive Dokumentenpipeline.';
export const SHIFT_SCHEDULE_IMPORT_PREPARED_MESSAGE = 'Dienstplan-Import ist noch nicht freigegeben.';
export const MEDICATION_EMP_PREPARED_MESSAGE = 'eMP-Abgleich erfordert die TI-Anbindung.';
export const WOUND_BODYMAP_PREPARED_MESSAGE = 'BodyMap-Markierung und Verlaufsfoto-Upload nutzen Storage.';
