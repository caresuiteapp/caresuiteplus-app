/**
 * Assist live map — OpenStreetMap by default, optional Mapbox upgrade via env.
 * No provider names in user-facing copy.
 */

export type AssistMapPosition = {
  latitude: number;
  longitude: number;
  accuracyMeters?: number | null;
  capturedAt?: string | null;
};

export type AssistMapTileSource = 'osm' | 'mapbox';

const DEMO_MAP_POSITION: AssistMapPosition = {
  latitude: 52.520008,
  longitude: 13.404954,
  accuracyMeters: 50,
  capturedAt: null,
};

function readEnv(key: string): string | undefined {
  if (typeof process !== 'undefined' && process.env?.[key]) {
    return process.env[key]?.trim() || undefined;
  }
  return undefined;
}

export function getMapboxAccessToken(): string | null {
  return (
    readEnv('EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN') ??
    readEnv('MAPBOX_ACCESS_TOKEN') ??
    null
  );
}

export function getAssistMapTileSource(): AssistMapTileSource {
  return getMapboxAccessToken() ? 'mapbox' : 'osm';
}

/** OSM tiles work without API keys — always considered configured. */
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
  const { width, height } = size;
  return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/pin-s+285AEB(${longitude},${latitude})/${longitude},${latitude},14,0/${width}x${height}@2x?access_token=${encodeURIComponent(token)}`;
}

export function buildAssistMapImageUrl(
  latitude: number,
  longitude: number,
  size?: { width: number; height: number },
): string {
  const token = getMapboxAccessToken();
  if (token) {
    return buildMapboxStaticMapUrl(latitude, longitude, token, size);
  }
  return buildOsmStaticMapUrl(latitude, longitude, size);
}

export function formatMapLastUpdated(capturedAt: string | null | undefined): string | null {
  if (!capturedAt) return null;
  const date = new Date(capturedAt);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
