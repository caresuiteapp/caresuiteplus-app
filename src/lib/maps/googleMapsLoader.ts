import { createFreeMapNamespace, type FreeMapSDK } from './freeMapAdapter';
/**
 * Lazy-load the self-hosted MapLibre SDK (web only). No API key.
 */

export type GoogleMapInstance = {
  setCenter: (latLng: { lat: number; lng: number }) => void;
  fitBounds: (bounds: GoogleLatLngBoundsInstance) => void;
  dispose?: () => void;
  onError?: (handler: (error: Error) => void) => () => void;
  panTo: (latLng: { lat: number; lng: number }) => void;
};

export type GoogleMarkerInstance = {
  setPosition?: (position: {lat: number; lng: number}) => void;
  setMap: (map: GoogleMapInstance | null) => void;
  addListener: (event: string, handler: () => void) => void;
};

export type GooglePolylineInstance = {
  setMap: (map: GoogleMapInstance | null) => void;
};

export type GoogleInfoWindowInstance = {
  setContent: (content: string) => void;
  open: (options: { map: GoogleMapInstance; anchor?: GoogleMarkerInstance }) => void;
  close: () => void;
};

export type GoogleLatLngBoundsInstance = {
  extend: (latLng: { lat: number; lng: number }) => void;
};

/** Von der Maps JavaScript API unterstützte Basiskartentypen. */
export type GoogleMapTypeId = 'roadmap' | 'satellite' | 'hybrid' | 'terrain';

export type GoogleMapOptions = {
  center?: { lat: number; lng: number };
  zoom?: number;
  mapTypeId?: GoogleMapTypeId;
  mapTypeControl?: boolean;
  streetViewControl?: boolean;
  fullscreenControl?: boolean;
  styles?: readonly unknown[];
};

export type GoogleGeocoderResult = {
  geometry: {
    location: {
      lat: () => number;
      lng: () => number;
    };
  };
  formatted_address?: string;
};

export type GoogleGeocoderInstance = {
  geocode: (
    request: { address: string },
    callback: (results: GoogleGeocoderResult[] | null, status: string) => void,
  ) => void;
};

export type GoogleMapsNamespace = {
  maps: {
    Map: new (
      el: HTMLElement,
      opts: GoogleMapOptions,
    ) => GoogleMapInstance;
    Marker: new (opts: {
      map?: GoogleMapInstance;
      position: { lat: number; lng: number };
      title?: string;
      optimized?: boolean;
      icon?: {
        url: string;
        scaledSize?: unknown;
        anchor?: unknown;
      };
    }) => GoogleMarkerInstance;
    Polyline: new (opts: {
      map?: GoogleMapInstance;
      path: { lat: number; lng: number }[];
      geodesic?: boolean;
      strokeColor?: string;
      strokeOpacity?: number;
      strokeWeight?: number;
      icons?: {
        icon: { path: string; scale?: number; strokeColor?: string; strokeOpacity?: number };
        offset: string;
        repeat?: string;
      }[];
    }) => GooglePolylineInstance;
    Size: new (width: number, height: number) => unknown;
    Point: new (x: number, y: number) => unknown;
    InfoWindow: new (opts?: { content?: string }) => GoogleInfoWindowInstance;
    LatLngBounds: new () => GoogleLatLngBoundsInstance;
    Geocoder: new () => GoogleGeocoderInstance;
    event: { trigger: (instance: unknown, event: string) => void };
  };
};

// Legacy type names are retained for screen compatibility; the runtime is MapLibre.
declare global { interface Window { careSuiteMapLibre?: FreeMapSDK; } }
let sdkPromise: Promise<FreeMapSDK> | null = null;
const listeners = new Set<(error: Error) => void>();
export function subscribeGoogleMapsFailure(listener: (error: Error) => void): () => void { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function resetGoogleMapsLoaderForTests(): void { sdkPromise = null; listeners.clear(); }
export async function loadGoogleMapsApi(_legacyKey?: string, tenantId?: string | null): Promise<GoogleMapsNamespace> {
  if (typeof window === 'undefined') throw new Error('Kartenansicht ist nur im Browser verfügbar.');
  if (window.careSuiteMapLibre) return createFreeMapNamespace(window.careSuiteMapLibre, tenantId);
  if (!sdkPromise) {
    sdkPromise = new Promise<FreeMapSDK>((resolve, reject) => {
      const script = document.createElement('script'); script.type = 'module'; script.dataset.caresuiteFreeMaps = 'true';
      let settled = false;
      const finish = (error?: Error) => { if(settled)return;settled=true; clearTimeout(timer); script.onload = null; script.onerror = null; if (error) { script.remove(); for (const listener of listeners) listener(error); reject(error); } else if (window.careSuiteMapLibre) resolve(window.careSuiteMapLibre); else { script.remove(); reject(new Error('Karte konnte nicht initialisiert werden.')); } };
      const timer = setTimeout(() => finish(new Error('Karte antwortet nicht. GPS-Daten bleiben erhalten.')), 15_000);
      script.onload = () => finish(); script.onerror = () => finish(new Error('Kartenansicht konnte nicht geladen werden. GPS-Daten bleiben erhalten.'));
      script.src = '/maps-sdk/bootstrap.mjs';
      if (!document.querySelector('link[data-caresuite-free-maps]')) { const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = '/maps-sdk/maplibre-gl.css'; link.dataset.caresuiteFreeMaps = 'true'; document.head.appendChild(link); }
      document.head.appendChild(script);
    });
    void sdkPromise.catch(() => { sdkPromise = null; });
  }
  return createFreeMapNamespace(await sdkPromise, tenantId);
}
