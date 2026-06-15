import { isDemoMode, isSupabaseConfigured } from '@/lib/supabase/config';

/**
 * Beratung module — Fälle/Protokolle demo-functional.
 */
export function isBeratungCasesLiveReady(): boolean {
  return isSupabaseConfigured() && !isDemoMode();
}

export function isBeratungExtensionLiveReady(): boolean {
  return true;
}

export const BERATUNG_EXTENSION_PREPARED_MESSAGE =
  'Beratungs-Auswertungen und Modul-Einstellungen sind demo-funktional im Demo-Mandanten.';
