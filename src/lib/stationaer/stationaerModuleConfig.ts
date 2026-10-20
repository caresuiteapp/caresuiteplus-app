import { isDemoMode, isSupabaseConfigured } from '@/lib/supabase/config';

/**
 * Stationär module — Bewohner/Zimmer demo-functional.
 */
export function isStationaerResidentsLiveReady(): boolean {
  return isSupabaseConfigured() && !isDemoMode();
}

export function isStationaerExtensionLiveReady(): boolean {
  return true;
}

export const STATIONAER_EXTENSION_PREPARED_MESSAGE =
  'Wohnbereiche, Übergabebericht und Tagesstruktur sind demo-funktional im Demo-Mandanten.';
