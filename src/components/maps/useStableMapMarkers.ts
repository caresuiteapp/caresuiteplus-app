import { useEffect, useRef } from 'react';
import type {
  GoogleInfoWindowInstance,
  GoogleMapInstance,
  GoogleMarkerInstance,
  GoogleMapsNamespace,
} from '@/lib/maps/googleMapsLoader';

export type StableMapMarker = {
  id: string;
  latitude: number;
  longitude: number;
  label: string;
  infoHtml?: string;
};

export type StableMapMarkersOptions = {
  map: GoogleMapInstance | null;
  google: GoogleMapsNamespace | null;
  markers: StableMapMarker[];
  selectedMarkerId?: string | null;
  onMarkerSelect?: (id: string) => void;
  demoMode?: boolean;
  buildInfoContent?: (marker: StableMapMarker, demoMode: boolean) => string;
};

/**
 * PERF.1 — Update marker positions in-place; avoid full recreate each render.
 */
export function useStableMapMarkers(options: StableMapMarkersOptions): void {
  const {
    map,
    google,
    markers,
    selectedMarkerId = null,
    onMarkerSelect,
    demoMode = false,
    buildInfoContent,
  } = options;

  const markerRefs = useRef<Map<string, GoogleMarkerInstance>>(new Map());
  const infoWindowRef = useRef<GoogleInfoWindowInstance | null>(null);
  const onSelectRef = useRef(onMarkerSelect);
  onSelectRef.current = onMarkerSelect;

  useEffect(() => {
    if (!map || !google) return;

    const existing = markerRefs.current;
    const nextIds = new Set(markers.map((m) => m.id));

    existing.forEach((marker, id) => {
      if (!nextIds.has(id)) {
        marker.setMap(null);
        existing.delete(id);
      }
    });

    if (!infoWindowRef.current) {
      infoWindowRef.current = new google.maps.InfoWindow();
    }

    markers.forEach((item) => {
      let marker = existing.get(item.id);
      if (!marker) {
        marker = new google.maps.Marker({
          map,
          position: { lat: item.latitude, lng: item.longitude },
          title: item.label,
        });
        marker.addListener('click', () => {
          onSelectRef.current?.(item.id);
          const info = infoWindowRef.current!;
          const html =
            item.infoHtml ??
            buildInfoContent?.(item, demoMode) ??
            `<strong>${item.label}</strong>`;
          info.setContent(html);
          info.open({ map, anchor: marker! });
        });
        existing.set(item.id, marker);
      } else {
        marker.setMap(map);
      }
    });

    if (markers.length === 1) {
      map.setCenter({ lat: markers[0].latitude, lng: markers[0].longitude });
    } else if (markers.length > 1) {
      const bounds = new google.maps.LatLngBounds();
      markers.forEach((m) => bounds.extend({ lat: m.latitude, lng: m.longitude }));
      map.fitBounds(bounds);
    }

    if (selectedMarkerId) {
      const selected = markers.find((m) => m.id === selectedMarkerId);
      const marker = existing.get(selectedMarkerId);
      if (selected && marker) {
        map.panTo({ lat: selected.latitude, lng: selected.longitude });
        const info = infoWindowRef.current;
        const html =
          selected.infoHtml ??
          buildInfoContent?.(selected, demoMode) ??
          `<strong>${selected.label}</strong>`;
        info.setContent(html);
        info.open({ map, anchor: marker });
      }
    }
  }, [map, google, markers, selectedMarkerId, demoMode, buildInfoContent]);
}
