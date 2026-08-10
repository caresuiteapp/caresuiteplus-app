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
  { elementType: 'geometry', stylers: [{ color: '#eef5fc' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#334155' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#b7d1ea' }] },
  { featureType: 'administrative.locality', elementType: 'labels', stylers: [{ visibility: 'on' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#0f2744' }] },
  { featureType: 'administrative.neighborhood', elementType: 'labels', stylers: [{ visibility: 'on' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#f4f8fc' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#e4f1e8' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#52657a' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#d4e4f3' }] },
  { featureType: 'road', elementType: 'labels', stylers: [{ visibility: 'on' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#d7ebff' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#e8eef5' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#cde9f8' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#1478e8' }] },
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
            mapTypeId: 'roadmap',
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
  }, [apiKey, enabled, containerRef, zoom, center]);

  useEffect(() => {
    if (!ready || !mapRef.current || !center) return;
    mapRef.current.panTo(center);
  }, [ready, center]);

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
