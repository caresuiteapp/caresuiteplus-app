import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  formatMapLastUpdated,
  getGoogleMapsApiKey,
  type AssistMapPosition,
} from '@/lib/assist/assistMapProvider';
import {
  loadGoogleMapsApi,
  type GoogleInfoWindowInstance,
  type GoogleMapInstance,
  type GoogleMarkerInstance,
} from '@/lib/maps/googleMapsLoader';
import { colors, spacing, typography } from '@/theme';

export type GoogleMapsLiveMarker = {
  id: string;
  latitude: number;
  longitude: number;
  label: string;
  subtitle?: string;
  capturedAt?: string | null;
  accuracyMeters?: number | null;
};

export type GoogleMapsLiveMapProps = {
  position?: AssistMapPosition | null;
  markers?: GoogleMapsLiveMarker[];
  selectedMarkerId?: string | null;
  onMarkerSelect?: (markerId: string) => void;
  height?: number;
  markerLabel?: string;
  fallbackMessage?: string;
  demoMode?: boolean;
  lastUpdatedLabel?: string;
};

function buildInfoContent(marker: GoogleMapsLiveMarker, demoMode: boolean): string {
  const updated = marker.capturedAt ? formatMapLastUpdated(marker.capturedAt) : null;
  const parts = [
    `<strong>${escapeHtml(marker.label)}</strong>`,
    marker.subtitle ? escapeHtml(marker.subtitle) : null,
    updated ? `Letzte Aktualisierung: ${escapeHtml(updated)}${demoMode ? ' · Demo' : ''}` : null,
    marker.accuracyMeters != null
      ? `Genauigkeit ca. ${Math.round(marker.accuracyMeters)} m`
      : null,
  ].filter(Boolean);
  return `<div style="font-family:system-ui,sans-serif;font-size:13px;line-height:1.4">${parts.join('<br/>')}</div>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function resolveMarkers(
  markers: GoogleMapsLiveMarker[] | undefined,
  position: AssistMapPosition | null | undefined,
  markerLabel: string | undefined,
): GoogleMapsLiveMarker[] {
  if (markers && markers.length > 0) return markers;
  if (!position) return [];
  return [
    {
      id: 'primary',
      latitude: position.latitude,
      longitude: position.longitude,
      label: markerLabel ?? 'Standort',
      capturedAt: position.capturedAt,
      accuracyMeters: position.accuracyMeters,
    },
  ];
}

export function GoogleMapsLiveMap({
  position = null,
  markers,
  selectedMarkerId = null,
  onMarkerSelect,
  height = 280,
  markerLabel,
  fallbackMessage = 'Keine Standortdaten — Tracking startet im Mitarbeiterportal während der Einsatzdurchführung.',
  demoMode = false,
  lastUpdatedLabel = 'Letzte Aktualisierung',
}: GoogleMapsLiveMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GoogleMapInstance | null>(null);
  const markerRefs = useRef<Map<string, GoogleMarkerInstance>>(new Map());
  const infoWindowRef = useRef<GoogleInfoWindowInstance | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const resolvedMarkers = useMemo(
    () => resolveMarkers(markers, position, markerLabel),
    [markers, position, markerLabel],
  );

  const primaryMarker = useMemo(() => {
    if (selectedMarkerId) {
      return resolvedMarkers.find((m) => m.id === selectedMarkerId) ?? resolvedMarkers[0] ?? null;
    }
    return resolvedMarkers[0] ?? null;
  }, [resolvedMarkers, selectedMarkerId]);

  useEffect(() => {
    const apiKey = getGoogleMapsApiKey();
    if (!apiKey || resolvedMarkers.length === 0) return;

    let cancelled = false;

    void loadGoogleMapsApi(apiKey)
      .then((google) => {
        if (cancelled || !mapContainerRef.current) return;

        const center = primaryMarker ?? resolvedMarkers[0];
        const map = new google.maps.Map(mapContainerRef.current, {
          center: { lat: center.latitude, lng: center.longitude },
          zoom: resolvedMarkers.length === 1 ? 15 : 13,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
        });
        mapRef.current = map;
        infoWindowRef.current = new google.maps.InfoWindow();
        setMapReady(true);
        setLoadError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : 'Karte konnte nicht geladen werden.');
      });

    return () => {
      cancelled = true;
    };
  }, [resolvedMarkers.length, primaryMarker?.latitude, primaryMarker?.longitude]);

  useEffect(() => {
    const apiKey = getGoogleMapsApiKey();
    if (!apiKey || !mapReady || !mapRef.current) return;

    void loadGoogleMapsApi(apiKey).then((google) => {
      const map = mapRef.current;
      if (!map) return;

      markerRefs.current.forEach((marker) => marker.setMap(null));
      markerRefs.current.clear();

      const bounds = new google.maps.LatLngBounds();
      resolvedMarkers.forEach((item) => {
        bounds.extend({ lat: item.latitude, lng: item.longitude });
        const marker = new google.maps.Marker({
          map,
          position: { lat: item.latitude, lng: item.longitude },
          title: item.label,
        });
        marker.addListener('click', () => {
          onMarkerSelect?.(item.id);
          const info = infoWindowRef.current ?? new google.maps.InfoWindow();
          infoWindowRef.current = info;
          info.setContent(buildInfoContent(item, demoMode));
          info.open({ map, anchor: marker });
        });
        markerRefs.current.set(item.id, marker);
      });

      if (resolvedMarkers.length === 1) {
        map.setCenter({
          lat: resolvedMarkers[0].latitude,
          lng: resolvedMarkers[0].longitude,
        });
      } else if (resolvedMarkers.length > 1) {
        map.fitBounds(bounds);
      }

      if (selectedMarkerId) {
        const selected = resolvedMarkers.find((m) => m.id === selectedMarkerId);
        const marker = markerRefs.current.get(selectedMarkerId);
        if (selected && marker) {
          map.panTo({ lat: selected.latitude, lng: selected.longitude });
          const info = infoWindowRef.current ?? new google.maps.InfoWindow();
          infoWindowRef.current = info;
          info.setContent(buildInfoContent(selected, demoMode));
          info.open({ map, anchor: marker });
        }
      }
    });
  }, [mapReady, resolvedMarkers, selectedMarkerId, onMarkerSelect, demoMode]);

  if (resolvedMarkers.length === 0) {
    return (
      <View style={[styles.fallback, { minHeight: height }]}>
        <Text style={styles.fallbackIcon}>🗺️</Text>
        <Text style={styles.fallbackText}>{fallbackMessage}</Text>
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={[styles.fallback, { minHeight: height }]}>
        <Text style={styles.fallbackIcon}>🗺️</Text>
        <Text style={styles.fallbackText}>{loadError}</Text>
      </View>
    );
  }

  const updated = primaryMarker?.capturedAt
    ? formatMapLastUpdated(primaryMarker.capturedAt)
    : position?.capturedAt
      ? formatMapLastUpdated(position.capturedAt)
      : null;

  return (
    <View style={styles.container}>
      <View style={[styles.mapFrame, { height }]}>
        <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
        {!mapReady ? (
          <View style={styles.loadingOverlay}>
            <Text style={styles.loadingText}>Karte wird geladen…</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.metaRow}>
        {primaryMarker?.label ? <Text style={styles.meta}>{primaryMarker.label}</Text> : null}
        {updated ? (
          <Text style={styles.meta}>
            {lastUpdatedLabel}: {updated}
            {demoMode ? ' · Demo' : ''}
          </Text>
        ) : demoMode ? (
          <Text style={styles.meta}>Demo-Vorschau</Text>
        ) : null}
        {(primaryMarker?.accuracyMeters ?? position?.accuracyMeters) != null ? (
          <Text style={styles.meta}>
            Genauigkeit ca.{' '}
            {Math.round(primaryMarker?.accuracyMeters ?? position?.accuracyMeters ?? 0)} m
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  mapFrame: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.bgPanel,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    position: 'relative',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
  },
  loadingText: { ...typography.caption, color: colors.textPrimary },
  metaRow: { gap: 2 },
  meta: { ...typography.caption, color: colors.textMuted },
  fallback: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.bgSurface,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  fallbackIcon: { fontSize: 28 },
  fallbackText: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
