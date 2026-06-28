import { Image, Platform, StyleSheet, Text, View } from 'react-native';
import {
  buildAssistMapImageUrl,
  formatMapLastUpdated,
  getGoogleMapsApiKey,
  type AssistLiveMapMarker,
  type AssistMapPosition,
} from '@/lib/assist/assistMapProvider';
import { colors, spacing, typography } from '@/theme';

export type AssistLiveMapProps = {
  position: AssistMapPosition | null;
  markers?: AssistLiveMapMarker[];
  selectedMarkerId?: string | null;
  onMarkerSelect?: (markerId: string) => void;
  height?: number;
  markerLabel?: string;
  fallbackMessage?: string;
  demoMode?: boolean;
  lastUpdatedLabel?: string;
};

export function AssistLiveMap({
  position,
  markers,
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
        <Text style={styles.fallbackIcon}>🗺️</Text>
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

  const mapUrl = buildAssistMapImageUrl(mapPosition.latitude, mapPosition.longitude);
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
  },
  mapImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
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
  nativeHint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  coordLine: {
    ...typography.caption,
    color: colors.textMuted,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
