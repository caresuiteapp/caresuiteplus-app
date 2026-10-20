import { isDemoMode, isSupabaseConfigured } from '@/lib/supabase/config';

/**
 * QM Dokumente live readiness (Listen + Detail, Sprint 41).
 * Freigabe-Workflow und Lesebestätigungen bleiben teilweise preparedOnly.
 */
export function isQmDocumentsLiveReady(): boolean {
  return isSupabaseConfigured() && !isDemoMode();
}

export const QM_DOCUMENTS_PREPARED_MESSAGE =
  'QM-Dokument-Freigabe und Export-Jobs sind demo-fähig. Live-Supabase nach Migration 0015 — Freigabe-Edge-Functions noch nicht produktiv.';

/** QM extension screens (Settings, KI, MD-Prüfung) — preparedOnly. */
export function isQmExtensionLiveReady(): boolean {
  return false;
}

export const QM_EXTENSION_PREPARED_MESSAGE =
  'QM-Erweiterungen (Einstellungen, KI-Assistent, MD-Prüfung) sind demo-fähig — kein Live-Sync und kein echter LLM-Aufruf.';

/** QM Dashboard — Handbuch/Dokumente live-fähig nach Migration 0015; Erweiterungen preparedOnly. */
export function isQmDashboardLiveReady(): boolean {
  return isQmDocumentsLiveReady();
}

export const QM_DASHBOARD_PREPARED_MESSAGE =
  'QM-Dashboard zeigt Demo-Kennzahlen. Handbuch und Dokumente sind Live-fähig nach Migration 0015 — KI, Export und MD-Erweiterungen bleiben preparedOnly.';

