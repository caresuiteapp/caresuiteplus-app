import { isAssistMapProviderConfigured as isMapProviderReady } from '@/lib/assist/assistMapProvider';
import { getServiceMode } from '@/lib/services/mode';
import { isDemoMode, isSupabaseConfigured } from '@/lib/supabase/config';

/** Persisted tracking sessions available in live cloud mode. */
export function isAssistTrackingPersistenceActive(): boolean {
  return getServiceMode() === 'supabase' && isSupabaseConfigured() && !isDemoMode();
}

/** Kartenansicht verfügbar (OpenStreetMap standardmäßig, optional Mapbox per Env). */
export function isAssistMapProviderConfigured(): boolean {
  return isMapProviderReady();
}

export function isGpsTrackingLiveReady(): boolean {
  return isAssistTrackingPersistenceActive();
}

export const GPS_TRACKING_PREPARED_MESSAGE =
  'Einsätze, Nachweise und Standortdaten werden dauerhaft gespeichert. Die Kartenansicht nutzt OpenStreetMap — optional kann ein erweiterter Kartenmodus per Umgebungsvariable aktiviert werden.';

export const GPS_TRACKING_DEMO_MESSAGE =
  'Live-Tracking ist im Demo-Modus eingeschränkt. Tracking startet im Mitarbeiterportal nach Mandanten-Freigabe.';

export const GPS_TRACKING_MAP_PROVIDER_MESSAGE =
  'Kartenansicht nicht verfügbar — Standorte werden als Liste angezeigt.';

export const GPS_TRACKING_BACKEND_EMPTY_MESSAGE =
  'Noch keine Standortdaten — Tracking startet im Mitarbeiterportal während der Einsatzdurchführung.';

/** Kurztext für Fahrtenbuch-Banner. */
export const GPS_TRIPS_PREPARED_MESSAGE =
  'Fahrtenbuch ist aktiv. Automatische Kilometererfassung per GPS folgt optional mit Kartenanbieter.';
