import { useMemo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { GoogleMapsLiveMap } from '@/components/maps/GoogleMapsLiveMap.web';
import {
  buildOsmEmbedUrl,
  formatMapLastUpdated,
  getGoogleMapsApiKey,
  isGoogleMapsConfigured,
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

export function AssistLiveMap(props: AssistLiveMapProps) {
  const {
    position,
    markers,
    selectedMarkerId,
    onMarkerSelect,
    height = 280,
    markerLabel,
    fallbackMessage = 'Keine Standortdaten — Tracking startet im Mitarbeiterportal während der Einsatzdurchführung.',
    demoMode = false,
    lastUpdatedLabel = 'Letzte Aktualisierung',
  } = props;

  const useGoogleMaps = isGoogleMapsConfigured();

  const embedUrl = useMemo(() => {
    if (useGoogleMaps || !position) return null;
    return buildOsmEmbedUrl(position.latitude, position.longitude);
  }, [useGoogleMaps, position?.latitude, position?.longitude]);

  const hasMapData = Boolean(
    position || (markers && markers.length > 0),
  );

  if (!hasMapData) {
    return (
      <View style={[styles.fallback, { minHeight: height }]}>
        <Text style={styles.fallbackIcon}>🗺️</Text>
        <Text style={styles.fallbackText}>{fallbackMessage}</Text>
      </View>
    );
  }

  if (useGoogleMaps && Platform.OS === 'web') {
    return (
      <GoogleMapsLiveMap
        position={position}
        markers={markers}
        selectedMarkerId={selectedMarkerId}
        onMarkerSelect={onMarkerSelect}
        height={height}
        markerLabel={markerLabel}
        fallbackMessage={fallbackMessage}
        demoMode={demoMode}
        lastUpdatedLabel={lastUpdatedLabel}
      />
    );
  }

  if (!position || !embedUrl) {
    return (
      <View style={[styles.fallback, { minHeight: height }]}>
        <Text style={styles.fallbackIcon}>🗺️</Text>
        <Text style={styles.fallbackText}>
          {getGoogleMapsApiKey()
            ? 'Interaktive Karte nur im Browser verfügbar.'
            : fallbackMessage}
        </Text>
      </View>
    );
  }

  const updated = formatMapLastUpdated(position.capturedAt);

  return (
    <View style={styles.container}>
      <View style={[styles.mapFrame, { height }]}>
        <iframe
          title="Kartenansicht"
          src={embedUrl}
          style={{ border: 0, width: '100%', height: '100%' }}
          loading="lazy"
        />
      </View>
      <View style={styles.metaRow}>
        {markerLabel ? <Text style={styles.meta}>{markerLabel}</Text> : null}
        {updated ? (
          <Text style={styles.meta}>
            {lastUpdatedLabel}: {updated}
            {demoMode ? ' · Demo' : ''}
          </Text>
        ) : demoMode ? (
          <Text style={styles.meta}>Demo-Vorschau</Text>
        ) : null}
        {position.accuracyMeters != null ? (
          <Text style={styles.meta}>Genauigkeit ca. {Math.round(position.accuracyMeters)} m</Text>
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
