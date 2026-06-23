import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  buildOsmEmbedUrl,
  formatMapLastUpdated,
  type AssistMapPosition,
} from '@/lib/assist/assistMapProvider';
import { colors, spacing, typography } from '@/theme';

export type AssistLiveMapProps = {
  position: AssistMapPosition | null;
  height?: number;
  markerLabel?: string;
  fallbackMessage?: string;
  demoMode?: boolean;
  lastUpdatedLabel?: string;
};

export function AssistLiveMap({
  position,
  height = 280,
  markerLabel,
  fallbackMessage = 'Keine Standortdaten — Tracking startet im Mitarbeiterportal während der Einsatzdurchführung.',
  demoMode = false,
  lastUpdatedLabel = 'Letzte Aktualisierung',
}: AssistLiveMapProps) {
  const embedUrl = useMemo(() => {
    if (!position) return null;
    return buildOsmEmbedUrl(position.latitude, position.longitude);
  }, [position?.latitude, position?.longitude]);

  if (!position || !embedUrl) {
    return (
      <View style={[styles.fallback, { minHeight: height }]}>
        <Text style={styles.fallbackText}>{fallbackMessage}</Text>
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
    borderColor: colors.borderSubtle,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  fallbackText: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
