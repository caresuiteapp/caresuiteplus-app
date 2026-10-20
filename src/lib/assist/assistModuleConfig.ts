import { isDemoMode, isSupabaseConfigured } from '@/lib/supabase/config';

/**
 * Assist module — core Einsätze/Fahrten demo-functional; GPS realtime requires external provider.
 */
export function isAssistTripsLiveReady(): boolean {
  return isSupabaseConfigured() && !isDemoMode();
}

export function isAssistExtensionLiveReady(): boolean {
  return true;
}

export const ASSIST_EXTENSION_PREPARED_MESSAGE =
  'Einsatz-Kalender und Nachweise sind demo-funktional — GPS-Echtzeit-Ortung erfordert externe Anbindung.';
