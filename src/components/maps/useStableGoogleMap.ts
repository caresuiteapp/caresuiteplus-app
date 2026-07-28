import { useEffect, useRef, useState, type RefObject } from 'react';
import { loadGoogleMapsApi, type GoogleMapInstance, type GoogleMapsNamespace } from '@/lib/maps/googleMapsLoader';

export type StableMapOptions = {
  apiKey: string | null;
  containerRef: RefObject<HTMLDivElement | null>;
  center: { lat: number; lng: number } | null;
  zoom?: number;
  enabled?: boolean;
};

export type StableMapResult = {
  map: GoogleMapInstance | null;
  google: GoogleMapsNamespace | null;
  ready: boolean;
  error: string | null;
};

const HEALTH_OS_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#071b35' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8bc1ff' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#06152b' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#0d315e' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#081f3d' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#09284c' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#6fa9ec' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#123d70' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#06152b' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#1764b8' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#0b2c52' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#031126' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#3d91ff' }] },
] as const;

/**
 * PERF.1 — Single Google Map instance; no recreate on marker/center updates.
 */
export function useStableGoogleMap(options: StableMapOptions): StableMapResult {
  const { apiKey, containerRef, center, zoom = 15, enabled = true } = options;
  const mapRef = useRef<GoogleMapInstance | null>(null);
  const googleRef = useRef<GoogleMapsNamespace | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mapInstance, setMapInstance] = useState<GoogleMapInstance | null>(null);
  const [googleNs, setGoogleNs] = useState<GoogleMapsNamespace | null>(null);

  useEffect(() => {
    if (!enabled || !apiKey || !center || !containerRef.current) {
      setReady(false);
      return;
    }

    let cancelled = false;

    void loadGoogleMapsApi(apiKey)
      .then((google) => {
        if (cancelled || !containerRef.current) return;

        googleRef.current = google;
        setGoogleNs(google);

        if (!mapRef.current) {
          mapRef.current = new google.maps.Map(containerRef.current, {
            center,
            zoom,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
            styles: HEALTH_OS_MAP_STYLE,
          });
          setMapInstance(mapRef.current);
        }

        setReady(true);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Karte konnte nicht geladen werden.');
        setReady(false);
      });

    return () => {
      cancelled = true;
    };
  }, [apiKey, enabled, containerRef, zoom]);

  useEffect(() => {
    if (!ready || !mapRef.current || !center) return;
    mapRef.current.panTo(center);
  }, [ready, center?.lat, center?.lng]);

  useEffect(() => {
    return () => {
      mapRef.current = null;
      googleRef.current = null;
    };
  }, []);

  return {
    map: mapInstance,
    google: googleNs,
    ready,
    error,
  };
}
