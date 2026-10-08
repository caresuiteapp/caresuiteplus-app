/**
 * Assist live map — free OpenStreetMap data with OpenFreeMap/MapLibre.
 * No provider names in user-facing copy.
 */

export type AssistMapPosition = {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  capturedAt: string | null;
};

export type AssistLiveMapMarker = {
  id: string;
  latitude: number;
  longitude: number;
  label: string;
  subtitle?: string;
  capturedAt?: string | null;
  accuracyMeters?: number | null;
};

export type AssistLiveRoutePoint = {
  latitude: number;
  longitude: number;
  capturedAt: string;
  accuracyMeters: number | null;
};

export type AssistMapTileSource = 'google' | 'osm' | 'mapbox';

const DEMO_MAP_POSITION: AssistMapPosition = {
  latitude: 52.520008,
  longitude: 13.404954,
  accuracyMeters: 50,
  capturedAt: null,
};

export function getGoogleMapsApiKey(): string | null {
  return null;
}

export function isGoogleMapsConfigured(): boolean {
  return Boolean(getGoogleMapsApiKey());
}

export function getMapboxAccessToken(): string | null {
  return null;
}

export function getAssistMapTileSource(): AssistMapTileSource {
  return 'osm';
}

/** Kartenansicht verfügbar (Google bevorzugt, sonst OSM/Mapbox). */
export function isAssistMapProviderConfigured(): boolean {
  return true;
}

export function getAssistMapDemoPosition(): AssistMapPosition {
  return { ...DEMO_MAP_POSITION, capturedAt: new Date().toISOString() };
}

export function buildOsmEmbedUrl(latitude: number, longitude: number, zoom = 15): string {
  const delta = 0.012;
  const bbox = [
    longitude - delta,
    latitude - delta,
    longitude + delta,
    latitude + delta,
  ].join(',');
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${latitude}%2C${longitude}`;
}

export function buildOsmStaticMapUrl(
  latitude: number,
  longitude: number,
  size: { width: number; height: number } = { width: 640, height: 360 },
): string {
  const { width, height } = size;
  return `https://staticmap.openstreetmap.de/staticmap.php?center=${latitude},${longitude}&zoom=15&size=${width}x${height}&markers=${latitude},${longitude},red-pushpin`;
}

export function buildMapboxStaticMapUrl(
  latitude: number,
  longitude: number,
  token: string,
  size: { width: number; height: number } = { width: 640, height: 360 },
): string {
  return buildOsmStaticMapUrl(latitude, longitude, size);
}

export function buildGoogleStaticMapUrl(
  latitude: number,
  longitude: number,
  apiKey: string,
  size: { width: number; height: number } = { width: 640, height: 360 },
  routePoints: AssistLiveRoutePoint[] = [],
  routeSegments?: AssistLiveRoutePoint[][],
): string {
  return buildOsmStaticMapUrl(latitude, longitude, size);
}

export function buildAssistMapImageUrl(
  latitude: number,
  longitude: number,
  size?: { width: number; height: number },
  routePoints: AssistLiveRoutePoint[] = [],
  routeSegments?: AssistLiveRoutePoint[][],
): string {
  return buildOsmStaticMapUrl(latitude, longitude, size);
}

export function formatMapLastUpdated(capturedAt: string | null | undefined): string | null {
  if (!capturedAt) return null;
  const date = new Date(capturedAt);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
