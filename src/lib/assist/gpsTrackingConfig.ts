import { getServiceMode } from '@/lib/services/mode';
import { isDemoMode, isSupabaseConfigured } from '@/lib/supabase/config';

/** Persisted assist_tracking_sessions / assist_location_points (0156) available in Supabase live mode. */
export function isAssistTrackingPersistenceActive(): boolean {
  return getServiceMode() === 'supabase' && isSupabaseConfigured() && !isDemoMode();
}

/** External map provider (Google/Mapbox etc.) — optional; text positions work without it. */
export function isAssistMapProviderConfigured(): boolean {
  return false;
}

export function isGpsTrackingLiveReady(): boolean {
  return isAssistTrackingPersistenceActive();
}

export const GPS_TRACKING_PREPARED_MESSAGE =
  'Tracking-Persistenz ist aktiv (assist_tracking_sessions, assist_location_points). Echtzeit-Kartenansicht erfordert optional einen Map-Provider.';

export const GPS_TRACKING_DEMO_MESSAGE =
  'Live-Tracking-Persistenz ist im Demo-Modus nicht aktiv. Tracking startet im Mitarbeiterportal nach Supabase-Anbindung.';

export const GPS_TRACKING_MAP_PROVIDER_MESSAGE =
  'Kein Map-Provider konfiguriert — Standorte werden als Text aus assist_location_points angezeigt.';

export const GPS_TRACKING_BACKEND_EMPTY_MESSAGE =
  'Noch keine Standortpunkte in assist_location_points — Tracking startet im Mitarbeiterportal.';

/** Kurztext für Fahrtenbuch-Banner. */
export const GPS_TRIPS_PREPARED_MESSAGE =
  'Fahrtenbuch liest assist_driving_log und trips — automatische GPS-Kilometererfassung folgt optional per Map-Provider.';
