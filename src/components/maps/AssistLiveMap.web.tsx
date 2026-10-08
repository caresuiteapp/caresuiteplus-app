import { StyleSheet, Text, View } from 'react-native';
import { GoogleMapsLiveMap } from '@/components/maps/GoogleMapsLiveMap.web';
import {
  type AssistLiveMapMarker,
  type AssistLiveRoutePoint,
  type AssistMapPosition,
} from '@/lib/assist/assistMapProvider';
import { spacing, typography } from '@/theme';

export type AssistLiveMapProps = {
  position: AssistMapPosition | null;
  markers?: AssistLiveMapMarker[];
  routePoints?: AssistLiveRoutePoint[];
  routeSegments?: AssistLiveRoutePoint[][];
  plannedRoutePoints?: AssistLiveRoutePoint[];
  routeIdentity?: string | null;
  selectedMarkerId?: string | null;
  onMarkerSelect?: (markerId: string) => void;
  height?: number;
  markerLabel?: string;
  fallbackMessage?: string;
  demoMode?: boolean;
  lastUpdatedLabel?: string;
  tenantId?: string | null;
};

export function AssistLiveMap(props: AssistLiveMapProps) {
  const {
    position,
    markers,
    routePoints = [],
    routeSegments,
    plannedRoutePoints = [],
    routeIdentity,
    selectedMarkerId,
    onMarkerSelect,
    height = 280,
    markerLabel,
    fallbackMessage = 'Keine Standortdaten — Tracking startet im Mitarbeiterportal während der Einsatzdurchführung.',
    demoMode = false,
    lastUpdatedLabel = 'Letzte Aktualisierung',
    tenantId = null,
  } = props;

  const hasMapData = Boolean(position || (markers && markers.length > 0));

  if (!hasMapData) {
    return (
      <View style={[styles.fallback, { minHeight: height }]}>
        <View style={styles.radarVisual}>
          <View style={styles.radarRingLarge} />
          <View style={styles.radarRingMedium} />
          <View style={styles.radarRingSmall} />
          <View style={styles.radarSweep} />
          <View style={styles.radarPoint} />
          <Text style={styles.fallbackIcon}>⌖</Text>
        </View>
        <Text style={styles.fallbackEyebrow}>WARTET AUF STANDORT</Text>
        <Text style={styles.fallbackTitle}>Positionsmonitor ist bereit</Text>
        <Text style={styles.fallbackText}>{fallbackMessage}</Text>
      </View>
    );
  }

  return (
      <GoogleMapsLiveMap
        position={position}
        markers={markers}
        routePoints={routePoints}
        routeSegments={routeSegments}
        plannedRoutePoints={plannedRoutePoints}
        routeIdentity={routeIdentity}
        selectedMarkerId={selectedMarkerId}
        onMarkerSelect={onMarkerSelect}
        height={height}
        markerLabel={markerLabel}
        fallbackMessage={fallbackMessage}
        demoMode={demoMode}
        lastUpdatedLabel={lastUpdatedLabel}
        tenantId={tenantId}
      />
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
  metaRow: { gap: 2 },
  meta: { ...typography.caption, color: '#9BB7CD' },
  fallback: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(103,216,255,0.25)',
    backgroundColor: '#06192F',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 6,
  },
  radarVisual: { width: 118, height: 118, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  radarRingLarge: { position: 'absolute', width: 118, height: 118, borderRadius: 59, borderWidth: 1, borderColor: 'rgba(82,218,255,0.14)' },
  radarRingMedium: { position: 'absolute', width: 82, height: 82, borderRadius: 41, borderWidth: 1, borderColor: 'rgba(82,218,255,0.23)' },
  radarRingSmall: { position: 'absolute', width: 46, height: 46, borderRadius: 23, borderWidth: 1, borderColor: 'rgba(82,218,255,0.34)' },
  radarSweep: { position: 'absolute', width: 56, height: 1, left: 59, top: 59, backgroundColor: 'rgba(92,225,255,0.55)', transform: [{ rotate: '-28deg' }] },
  radarPoint: { position: 'absolute', width: 8, height: 8, borderRadius: 4, right: 24, top: 34, backgroundColor: '#52E3B1', shadowColor: '#52E3B1', shadowOpacity: 0.9, shadowRadius: 9 },
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
});
