import type { GeoProviderKey, LocationPurpose } from '@/types/geo';

export type GeoProviderDefinition = {
  key: GeoProviderKey;
  label: string;
  connectIntegrationKey: string;
  requiresCredential: boolean;
  supportsGeocoding: boolean;
  supportsRouting: boolean;
  supportsLiveTracking: boolean;
  defaultPurposes: LocationPurpose[];
};

export const GEO_PROVIDER_REGISTRY: GeoProviderDefinition[] = [
  {
    key: 'google_maps',
    label: 'Google Maps',
    connectIntegrationKey: 'maps_google',
    requiresCredential: true,
    supportsGeocoding: true,
    supportsRouting: true,
    supportsLiveTracking: false,
    defaultPurposes: ['address_validation', 'assignment_route', 'travel_time', 'distance_calculation'],
  },
  {
    key: 'here_maps',
    label: 'HERE Maps',
    connectIntegrationKey: 'maps_here',
    requiresCredential: true,
    supportsGeocoding: true,
    supportsRouting: true,
    supportsLiveTracking: false,
    defaultPurposes: ['assignment_route', 'travel_time', 'distance_calculation'],
  },
  {
    key: 'mapbox',
    label: 'Mapbox',
    connectIntegrationKey: 'maps_mapbox',
    requiresCredential: true,
    supportsGeocoding: true,
    supportsRouting: true,
    supportsLiveTracking: false,
    defaultPurposes: ['assignment_route', 'travel_time'],
  },
  {
    key: 'osm_nominatim',
    label: 'OpenStreetMap / Nominatim',
    connectIntegrationKey: 'maps_osm',
    requiresCredential: false,
    supportsGeocoding: true,
    supportsRouting: false,
    supportsLiveTracking: false,
    defaultPurposes: ['address_validation'],
  },
  {
    key: 'tomtom',
    label: 'TomTom',
    connectIntegrationKey: 'maps_tomtom',
    requiresCredential: true,
    supportsGeocoding: true,
    supportsRouting: true,
    supportsLiveTracking: false,
    defaultPurposes: ['assignment_route', 'travel_time', 'distance_calculation'],
  },
  {
    key: 'generic_geocoder',
    label: 'Generischer Geocoder',
    connectIntegrationKey: 'maps_generic_geocoder',
    requiresCredential: true,
    supportsGeocoding: true,
    supportsRouting: false,
    supportsLiveTracking: false,
    defaultPurposes: ['address_validation'],
  },
];

export function getGeoProviderDefinition(key: GeoProviderKey): GeoProviderDefinition | undefined {
  return GEO_PROVIDER_REGISTRY.find((p) => p.key === key);
}

export function listGeoProviderKeys(): GeoProviderKey[] {
  return GEO_PROVIDER_REGISTRY.map((p) => p.key);
}

export function resolveDefaultProviderForPurpose(purpose: LocationPurpose): GeoProviderKey | null {
  const match = GEO_PROVIDER_REGISTRY.find((p) => p.defaultPurposes.includes(purpose));
  return match?.key ?? null;
}
