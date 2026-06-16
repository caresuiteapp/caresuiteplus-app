/**
 * Assist GPS Live-Tracking readiness.
 * Geofence-Dashboard ist Live/Demo-fähig; expo-location ist integriert aber live-ready bleibt false
 * bis Backend-Streaming + Store-Permissions-Review abgeschlossen sind.
 *
 * Zentraler Live-Flip: @/lib/geo/geoModuleConfig
 */
export {
  isGpsTrackingLiveReady,
  GPS_TRACKING_PREPARED_MESSAGE,
  GPS_TRIPS_PREPARED_MESSAGE,
} from '@/lib/geo/geoModuleConfig';
