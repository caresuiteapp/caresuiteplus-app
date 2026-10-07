/**
 * Lazy-load Google Maps JavaScript API (web only).
 * API key must be restricted to Maps JavaScript API + HTTP referrers in Google Cloud.
 */

export type GoogleMapInstance = {
  setCenter: (latLng: { lat: number; lng: number }) => void;
  fitBounds: (bounds: GoogleLatLngBoundsInstance) => void;
  panTo: (latLng: { lat: number; lng: number }) => void;
};

export type GoogleMarkerInstance = {
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

declare global {
  interface Window {
    google?: GoogleMapsNamespace;
    __caresuiteGoogleMapsInit?: () => void;
    gm_authFailure?: () => void;
  }
}

let loadPromise: Promise<GoogleMapsNamespace> | null = null;
let authenticationError: Error | null = null;
const failureListeners = new Set<(error: Error) => void>();
let installedAuthFailureHandler: (() => void) | null = null;
let previousAuthFailureHandler: (() => void) | undefined;

/** Google may reject the API key only after its script and Map have initialized. */
export function subscribeGoogleMapsFailure(listener: (error: Error) => void): () => void {
  failureListeners.add(listener);
  if (authenticationError) listener(authenticationError);
  return () => { failureListeners.delete(listener); };
}

function installAuthFailureHandler(): void {
  if (window.gm_authFailure === installedAuthFailureHandler) return;
  const previous = window.gm_authFailure;
  previousAuthFailureHandler = previous;
  installedAuthFailureHandler = () => {
    authenticationError = new Error('Google Maps hat die Kartenansicht nicht freigegeben. Gespeicherte GPS-Punkte bleiben erhalten.');
    for (const listener of failureListeners) listener(authenticationError);
    previous?.();
  };
  window.gm_authFailure = installedAuthFailureHandler;
}

export function resetGoogleMapsLoaderForTests(): void {
  loadPromise = null;
  authenticationError = null;
  failureListeners.clear();
  if (typeof window !== 'undefined' && window.gm_authFailure === installedAuthFailureHandler) {
    window.gm_authFailure = previousAuthFailureHandler;
  }
  installedAuthFailureHandler = null;
  previousAuthFailureHandler = undefined;
}

export async function loadGoogleMapsApi(apiKey: string): Promise<GoogleMapsNamespace> {
  if (typeof window === 'undefined') {
    throw new Error('Google Maps ist nur im Browser verfügbar.');
  }

  installAuthFailureHandler();
  if (authenticationError) throw authenticationError;

  if (window.google?.maps) {
    return window.google;
  }

  if (!loadPromise) {
    const attempt = new Promise<GoogleMapsNamespace>((resolve, reject) => {
      let script: HTMLScriptElement;
      const existing = document.querySelector<HTMLScriptElement>('script[data-caresuite-google-maps]');
      const finish = (error?: Error) => {
        clearTimeout(timer);
        unsubscribe();
        script.removeEventListener('load', onLoad);
        script.removeEventListener('error', onError);
        if (error) {
          script.remove();
          reject(error);
        } else if (window.google?.maps) resolve(window.google);
        else reject(new Error('Google Maps konnte nicht initialisiert werden.'));
      };
      const onLoad = () => {
        if (window.google?.maps) finish();
      };
      const onError = () => finish(new Error('Google Maps Script konnte nicht geladen werden.'));
      const timer = setTimeout(() => finish(new Error('Google Maps antwortet nicht. Gespeicherte GPS-Punkte bleiben erhalten.')), 15_000);
      const unsubscribe = subscribeGoogleMapsFailure((error) => finish(error));
      if (existing) {
        script = existing;
        script.addEventListener('load', onLoad);
        script.addEventListener('error', onError);
        return;
      }

      window.__caresuiteGoogleMapsInit = () => finish();

      script = document.createElement('script');
      script.dataset.caresuiteGoogleMaps = 'true';
      script.async = true;
      script.defer = true;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&callback=__caresuiteGoogleMapsInit`;
      script.addEventListener('error', onError);
      document.head.appendChild(script);
    });
    loadPromise = attempt;
    void attempt.catch(() => { if (loadPromise === attempt) loadPromise = null; });
  }

  return loadPromise;
}
