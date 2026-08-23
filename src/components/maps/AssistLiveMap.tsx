import { Image, Platform, StyleSheet, Text, View } from 'react-native';
import {
  buildAssistMapImageUrl,
  formatMapLastUpdated,
  getGoogleMapsApiKey,
  type AssistLiveMapMarker,
  type AssistLiveRoutePoint,
  type AssistMapPosition,
} from '@/lib/assist/assistMapProvider';
import { spacing, typography } from '@/theme';

export type AssistLiveMapProps = {
  position: AssistMapPosition | null;
  markers?: AssistLiveMapMarker[];
  routePoints?: AssistLiveRoutePoint[];
  selectedMarkerId?: string | null;
  onMarkerSelect?: (markerId: string) => void;
  height?: number;
  markerLabel?: string;
  fallbackMessage?: string;
  demoMode?: boolean;
  lastUpdatedLabel?: string;
  tenantId?: string | null;
};

export function AssistLiveMap({
  position,
  markers,
  routePoints = [],
  height = 280,
  markerLabel,
  fallbackMessage = 'Keine Standortdaten — Tracking startet im Mitarbeiterportal während der Einsatzdurchführung.',
  demoMode = false,
  lastUpdatedLabel = 'Letzte Aktualisierung',
}: AssistLiveMapProps) {
  const coordinateRows =
    markers && markers.length > 0
      ? markers
      : position
        ? [
            {
              id: 'primary',
              latitude: position.latitude,
              longitude: position.longitude,
              label: markerLabel ?? 'Standort',
              capturedAt: position.capturedAt,
              accuracyMeters: position.accuracyMeters,
            },
          ]
        : [];

  if (coordinateRows.length === 0) {
    return (
      <View style={[styles.fallback, { minHeight: height }]}>
        <View style={styles.radarVisual}>
          <View style={styles.radarRingLarge} />
          <View style={styles.radarRingMedium} />
          <View style={styles.radarRingSmall} />
          <View style={styles.radarPoint} />
          <Text style={styles.fallbackIcon}>⌖</Text>
        </View>
        <Text style={styles.fallbackEyebrow}>WARTET AUF STANDORT</Text>
        <Text style={styles.fallbackTitle}>Positionsmonitor ist bereit</Text>
        <Text style={styles.fallbackText}>{fallbackMessage}</Text>
      </View>
    );
  }

  if (Platform.OS !== 'web' && !getGoogleMapsApiKey()) {
    return (
      <View style={[styles.fallback, { minHeight: height, alignItems: 'stretch' }]}>
        <Text style={styles.nativeHint}>Karte nur im Browser verfügbar — Koordinaten:</Text>
        {coordinateRows.map((row) => (
          <Text key={row.id} style={styles.coordLine}>
            {row.label}: {row.latitude.toFixed(5)}, {row.longitude.toFixed(5)}
          </Text>
        ))}
      </View>
    );
  }

  const primary = coordinateRows[0];
  const mapPosition: AssistMapPosition = position ?? {
    latitude: primary.latitude,
    longitude: primary.longitude,
    accuracyMeters: primary.accuracyMeters ?? null,
    capturedAt: primary.capturedAt ?? null,
  };

  const mapUrl = buildAssistMapImageUrl(mapPosition.latitude, mapPosition.longitude, undefined, routePoints);
  const updated = formatMapLastUpdated(mapPosition.capturedAt);

  return (
    <View style={styles.container}>
      <View style={[styles.mapFrame, { height }]}>
        <Image
          source={{ uri: mapUrl }}
          style={styles.mapImage}
          accessibilityLabel="Kartenansicht mit aktuellem Standort"
        />
      </View>
      <View style={styles.metaRow}>
        {markerLabel ?? primary.label ? (
          <Text style={styles.meta}>{markerLabel ?? primary.label}</Text>
        ) : null}
        {updated ? (
          <Text style={styles.meta}>
            {lastUpdatedLabel}: {updated}
            {demoMode ? ' · Demo' : ''}
          </Text>
        ) : demoMode ? (
          <Text style={styles.meta}>Demo-Vorschau</Text>
        ) : null}
        {mapPosition.accuracyMeters != null ? (
          <Text style={styles.meta}>Genauigkeit ca. {Math.round(mapPosition.accuracyMeters)} m</Text>
        ) : null}
        {coordinateRows.length > 1 ? (
          <Text style={styles.meta}>{coordinateRows.length} Standorte auf der Karte</Text>
        ) : null}
        {routePoints.length > 1 ? (
          <Text style={styles.meta}>{routePoints.length} GPS-Punkte in der Route</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  mapFrame: {
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#071A31',
    borderWidth: 1,
    borderColor: 'rgba(103,216,255,0.34)',
  },
  mapImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  metaRow: { gap: 2 },
  meta: { ...typography.caption, color: '#9BB7CD' },
  fallback: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(103,216,255,0.25)',
    backgroundColor: '#06192F',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 6,
  },
  radarVisual: { width: 112, height: 112, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  radarRingLarge: { position: 'absolute', width: 112, height: 112, borderRadius: 56, borderWidth: 1, borderColor: 'rgba(82,218,255,0.14)' },
  radarRingMedium: { position: 'absolute', width: 78, height: 78, borderRadius: 39, borderWidth: 1, borderColor: 'rgba(82,218,255,0.23)' },
  radarRingSmall: { position: 'absolute', width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(82,218,255,0.34)' },
  radarPoint: { position: 'absolute', width: 8, height: 8, borderRadius: 4, right: 23, top: 32, backgroundColor: '#52E3B1' },
  fallbackIcon: { color: '#70E4FF', fontSize: 28, lineHeight: 32, fontWeight: '500' },
  fallbackEyebrow: { color: '#65DCF8', fontSize: 9, lineHeight: 12, fontWeight: '900', letterSpacing: 1.5 },
  fallbackTitle: { color: '#FFFFFF', fontSize: 17, lineHeight: 22, fontWeight: '900', textAlign: 'center', marginTop: 2 },
  fallbackText: {
    ...typography.caption,
    color: '#9DB6CA',
    textAlign: 'center',
    maxWidth: 480,
    lineHeight: 18,
  },
  nativeHint: {
    ...typography.caption,
    color: '#D7E8F5',
    marginBottom: spacing.xs,
  },
  coordLine: {
    ...typography.caption,
    color: '#9DB6CA',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
