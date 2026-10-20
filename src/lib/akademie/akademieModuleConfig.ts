import { isDemoMode, isSupabaseConfigured } from '@/lib/supabase/config';

/**
 * Akademie module — Kurse/Prüfungen demo-functional.
 */
export function isAkademieCoursesLiveReady(): boolean {
  return isSupabaseConfigured() && !isDemoMode();
}

export function isAkademieExtensionLiveReady(): boolean {
  return true;
}

export const AKADEMIE_EXTENSION_PREPARED_MESSAGE =
  'Akademie-Auswertungen und Modul-Einstellungen sind demo-funktional im Demo-Mandanten.';
