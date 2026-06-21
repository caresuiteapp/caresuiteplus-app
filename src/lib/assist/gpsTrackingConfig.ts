import { getServiceMode } from '@/lib/services/mode';
import { isDemoMode, isSupabaseConfigured } from '@/lib/supabase/config';

/** Persisted tracking sessions available in live cloud mode. */
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
  'Einsätze, Nachweise und Standortdaten werden dauerhaft gespeichert. Für eine Kartenansicht kann optional ein Kartenanbieter hinterlegt werden.';

export const GPS_TRACKING_DEMO_MESSAGE =
  'Live-Tracking ist im Demo-Modus eingeschränkt. Tracking startet im Mitarbeiterportal nach Mandanten-Freigabe.';

export const GPS_TRACKING_MAP_PROVIDER_MESSAGE =
  'Kein Kartenanbieter konfiguriert — Standorte werden als Textliste angezeigt.';

export const GPS_TRACKING_BACKEND_EMPTY_MESSAGE =
  'Noch keine Standortdaten — Tracking startet im Mitarbeiterportal während der Einsatzdurchführung.';

/** Kurztext für Fahrtenbuch-Banner. */
export const GPS_TRIPS_PREPARED_MESSAGE =
  'Fahrtenbuch ist aktiv. Automatische Kilometererfassung per GPS folgt optional mit Kartenanbieter.';
