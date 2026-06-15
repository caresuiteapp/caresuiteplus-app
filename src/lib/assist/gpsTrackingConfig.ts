/**
 * Assist GPS Live-Tracking readiness.
 * Geofence-Dashboard ist Live/Demo-fähig; expo-location ist integriert aber live-ready bleibt false
 * bis Backend-Streaming + Store-Permissions-Review abgeschlossen sind.
 */
export function isGpsTrackingLiveReady(): boolean {
  return false;
}

export const GPS_TRACKING_PREPARED_MESSAGE =
  'Echtzeit-GPS-Ortung ist in Vorbereitung. Fahrtenbuch und Tracking zeigen Geofence-Snapshots — keine Geräte-Ortung.';

/** Kurztext für Fahrtenbuch-Banner. */
export const GPS_TRIPS_PREPARED_MESSAGE =
  'Automatische Kilometererfassung per GPS folgt — Fahrten werden derzeit manuell erfasst.';
