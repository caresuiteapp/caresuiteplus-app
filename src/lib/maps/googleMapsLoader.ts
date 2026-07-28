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
      opts: {
        center?: { lat: number; lng: number };
        zoom?: number;
        mapTypeControl?: boolean;
        streetViewControl?: boolean;
        fullscreenControl?: boolean;
        styles?: readonly unknown[];
      },
    ) => GoogleMapInstance;
    Marker: new (opts: {
      map?: GoogleMapInstance;
      position: { lat: number; lng: number };
      title?: string;
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
  }
}

let loadPromise: Promise<GoogleMapsNamespace> | null = null;

export function resetGoogleMapsLoaderForTests(): void {
  loadPromise = null;
}

export async function loadGoogleMapsApi(apiKey: string): Promise<GoogleMapsNamespace> {
  if (typeof window === 'undefined') {
    throw new Error('Google Maps ist nur im Browser verfügbar.');
  }

  if (window.google?.maps) {
    return window.google;
  }

  if (!loadPromise) {
    loadPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-caresuite-google-maps]');
      if (existing) {
        existing.addEventListener('load', () => {
          if (window.google?.maps) resolve(window.google);
          else reject(new Error('Google Maps konnte nicht geladen werden.'));
        });
        existing.addEventListener('error', () =>
          reject(new Error('Google Maps Script konnte nicht geladen werden.')),
        );
        return;
      }

      window.__caresuiteGoogleMapsInit = () => {
        if (window.google?.maps) resolve(window.google);
        else reject(new Error('Google Maps konnte nicht initialisiert werden.'));
      };

      const script = document.createElement('script');
      script.dataset.caresuiteGoogleMaps = 'true';
      script.async = true;
      script.defer = true;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&callback=__caresuiteGoogleMapsInit`;
      script.onerror = () => reject(new Error('Google Maps Script konnte nicht geladen werden.'));
      document.head.appendChild(script);
    });
  }

  return loadPromise;
}
