import { memo, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  formatMapLastUpdated,
  type AssistMapPosition,
} from '@/lib/assist/assistMapProvider';
import { getGoogleMapsBrowserKey } from '@/lib/maps/getGoogleMapsBrowserKey';
import { colors, spacing, typography } from '@/theme';
import { useStableGoogleMap } from './useStableGoogleMap';
import { useStableMapMarkers, type StableMapMarker } from './useStableMapMarkers';
import { useVisibleMapPolling } from './useVisibleMapPolling';
import { LIVE_TRACKING_POLL_MS } from '@/hooks/core';

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
  tenantId?: string | null;
  /** Optional refresh when map visible (e.g. refetch live positions). */
  onVisiblePoll?: () => void;
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

function GoogleMapsLiveMapInner({
  position = null,
  markers,
  selectedMarkerId = null,
  onMarkerSelect,
  height = 280,
  markerLabel,
  fallbackMessage = 'Keine Standortdaten — Tracking startet im Mitarbeiterportal während der Einsatzdurchführung.',
  demoMode = false,
  lastUpdatedLabel = 'Letzte Aktualisierung',
  tenantId = null,
  onVisiblePoll,
}: GoogleMapsLiveMapProps) {
  const [apiKey, setApiKey] = useState<string | null>(null);

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

  const center = useMemo(() => {
    const m = primaryMarker ?? resolvedMarkers[0];
    return m ? { lat: m.latitude, lng: m.longitude } : null;
  }, [primaryMarker, resolvedMarkers]);

  const stableMarkers: StableMapMarker[] = useMemo(
    () =>
      resolvedMarkers.map((m) => ({
        id: m.id,
        latitude: m.latitude,
        longitude: m.longitude,
        label: m.label,
        infoHtml: buildInfoContent(m, demoMode),
      })),
    [resolvedMarkers, demoMode],
  );

  useEffect(() => {
    let cancelled = false;
    void getGoogleMapsBrowserKey(tenantId).then((key) => {
      if (!cancelled) setApiKey(key);
    });
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  const { containerRef: mapContainerRef, isVisible } = useVisibleMapPolling({
    enabled: Boolean(onVisiblePoll),
    intervalMs: LIVE_TRACKING_POLL_MS,
    onPoll: () => onVisiblePoll?.(),
  });

  const { map, google, ready, error: mapError } = useStableGoogleMap({
    apiKey,
    containerRef: mapContainerRef,
    center,
    zoom: resolvedMarkers.length === 1 ? 15 : 13,
    enabled: resolvedMarkers.length > 0 && Boolean(apiKey),
  });

  useStableMapMarkers({
    map,
    google,
    markers: stableMarkers,
    selectedMarkerId,
    onMarkerSelect,
    demoMode,
    buildInfoContent: (m) => m.infoHtml ?? buildInfoContent(m as GoogleMapsLiveMarker, demoMode),
  });

  if (resolvedMarkers.length === 0) {
    return (
      <View style={[styles.fallback, { minHeight: height }]}>
        <Text style={styles.fallbackIcon}>🗺️</Text>
        <Text style={styles.fallbackText}>{fallbackMessage}</Text>
      </View>
    );
  }

  if (!apiKey) {
    return (
      <View style={[styles.fallback, { minHeight: height }]}>
        <Text style={styles.fallbackIcon}>🗺️</Text>
        <Text style={styles.fallbackText}>
          Google Maps ist nicht konfiguriert — Kartenansicht nicht verfügbar.
        </Text>
      </View>
    );
  }

  if (mapError) {
    return (
      <View style={[styles.fallback, { minHeight: height }]}>
        <Text style={styles.fallbackIcon}>🗺️</Text>
        <Text style={styles.fallbackText}>{mapError}</Text>
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
        {!ready ? (
          <View style={styles.loadingOverlay}>
            <Text style={styles.loadingText}>Karte wird geladen…</Text>
          </View>
        ) : null}
        {!isVisible && onVisiblePoll ? (
          <View style={styles.pausedBadge} pointerEvents="none">
            <Text style={styles.pausedText}>Karte pausiert (nicht sichtbar)</Text>
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

export const GoogleMapsLiveMap = memo(GoogleMapsLiveMapInner);

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
  pausedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  pausedText: { ...typography.caption, color: colors.textPrimary, fontSize: 10 },
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
