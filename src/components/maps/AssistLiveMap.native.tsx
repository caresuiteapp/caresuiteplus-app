import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Camera, GeoJSONSource, Layer, Map, type CameraRef } from '@maplibre/maplibre-react-native';
import type { AssistLiveMapProps } from './AssistLiveMap';
import { formatMapLastUpdated } from '@/lib/assist/assistMapProvider';
import { nativeMapBounds, nativeMapLines, nativeMapMarkers, validNativeMapPosition } from '@/lib/maps/nativeAssistMapData';
import { typography } from '@/theme';

export function AssistLiveMap(props: AssistLiveMapProps) {
  return <NativeAssistLiveMap key={`${props.tenantId ?? 'session'}:${props.routeIdentity ?? 'positions'}`} {...props} />;
}
function NativeAssistLiveMap({ position, markers, routePoints = [], routeSegments, plannedRoutePoints = [], selectedMarkerId, onMarkerSelect, height = 280, markerLabel, fallbackMessage = 'Keine Standortdaten vorhanden.', lastUpdatedLabel = 'Letzte Aktualisierung', demoMode = false }: AssistLiveMapProps) {
  const camera = useRef<CameraRef>(null); const fitted = useRef(false); const [ready, setReady] = useState(false); const [failed, setFailed] = useState(false); const [retry, setRetry] = useState(0); const [follow, setFollow] = useState((markers?.length ?? 0) <= 1);
  const rows = useMemo(() => (markers?.length ? markers : position ? [{ id: 'primary', ...position, label: markerLabel ?? 'Standort' }] : []).filter(validNativeMapPosition), [markers, position, markerLabel]);
  const markerData = useMemo(() => nativeMapMarkers(rows, selectedMarkerId), [rows, selectedMarkerId]);
  const segments = routeSegments ?? [routePoints];
  const tracks = useMemo(() => nativeMapLines(segments), [routeSegments, routePoints]);
  const planned = useMemo(() => nativeMapLines([plannedRoutePoints]), [plannedRoutePoints]);
  const selected = rows.find(row => row.id === selectedMarkerId) ?? rows[0];
  const hasData = rows.length > 0;
  useEffect(() => { if (!hasData || ready) return; const timeout = setTimeout(() => setFailed(true), 15000); return () => clearTimeout(timeout); }, [hasData, retry, ready]);
  useEffect(() => {
    if (!ready || !selected) return;
    if (!fitted.current) {
      const bounds = nativeMapBounds([...rows, ...segments.flat(), ...plannedRoutePoints]);
      if (bounds && (bounds[0] !== bounds[2] || bounds[1] !== bounds[3])) camera.current?.fitBounds(bounds, { padding: { top: 38, right: 38, bottom: 38, left: 38 }, duration: 0 });
      else camera.current?.jumpTo({ center: [selected.longitude, selected.latitude], zoom: 14 });
      fitted.current = true;
    } else if (follow) camera.current?.easeTo({ center: [selected.longitude, selected.latitude], duration: 450 });
  }, [ready, rows, selected, follow, routePoints, routeSegments, plannedRoutePoints]);
  if (!hasData) return <View style={[styles.fallback, { minHeight: height }]}><Text style={styles.title}>Positionsmonitor ist bereit</Text><Text style={[styles.meta, styles.onDark]}>{fallbackMessage}</Text></View>;
  const updated = formatMapLastUpdated(position?.capturedAt ?? selected?.capturedAt);
  return <View style={styles.container} testID="native-live-map"><View style={[styles.frame, { height }]}>
    <Map key={retry} mapStyle="https://tiles.openfreemap.org/styles/bright" style={{ flex: 1 }}
      androidView="texture" attribution logo={false} compass scaleBar preferredFramesPerSecond={30}
      onDidFinishLoadingMap={() => { setReady(true); setFailed(false); }} onDidFailLoadingMap={() => setFailed(true)}
      onRegionWillChange={event => { if (event.nativeEvent.userInteraction) setFollow(false); }}>
      <Camera ref={camera} initialViewState={{ center: [selected.longitude, selected.latitude], zoom: 14 }} maxZoom={19} minZoom={2} />
      <GeoJSONSource id="care-planned-route" data={planned}><Layer id="care-planned-line" type="line" paint={{ 'line-color': '#1478e8', 'line-width': 4, 'line-opacity': 0.65, 'line-dasharray': [2, 1] }} /></GeoJSONSource>
      <GeoJSONSource id="care-recorded-route" data={tracks}><Layer id="care-recorded-line" type="line" paint={{ 'line-color': '#059669', 'line-width': 5 }} /></GeoJSONSource>
      <GeoJSONSource id="care-position-markers" data={markerData} hitbox={{ top: 24, right: 24, bottom: 24, left: 24 }} onPress={event => {
        const id = event.nativeEvent.features?.[0]?.properties?.markerId;
        if (typeof id === 'string' && rows.some(row => row.id === id)) { event.stopPropagation(); onMarkerSelect?.(id); }
      }}><Layer id="care-marker-points" type="circle" paint={{ 'circle-radius': ['case', ['get', 'selected'], 10, 8], 'circle-color': ['case', ['get', 'selected'], '#E88718', '#1478e8'], 'circle-stroke-width': 3, 'circle-stroke-color': '#ffffff' }} /></GeoJSONSource>
    </Map>
    {!ready && !failed ? <View pointerEvents="none" style={styles.loading}><ActivityIndicator color="#1478e8" /><Text style={styles.meta}>Karte wird geladen …</Text></View> : null}
  </View>
    <View style={styles.actions}><Pressable accessibilityRole="button" accessibilityState={{ selected: follow }} onPress={() => { setFollow(true); if (selected) camera.current?.easeTo({ center: [selected.longitude, selected.latitude], duration: 450 }); }} style={styles.action}><Text style={styles.actionText}>{follow ? 'Standort wird verfolgt' : 'Standort folgen'}</Text></Pressable>
    <Pressable accessibilityRole="button" onPress={() => { fitted.current = false; setReady(false); setFailed(false); setRetry(value => value + 1); }} style={styles.action}><Text style={styles.actionText}>{failed ? 'Karte erneut laden' : 'Karte aktualisieren'}</Text></Pressable></View>
    {failed ? <View style={styles.fallback}><Text accessibilityRole="alert" style={styles.title}>Karte nicht erreichbar</Text><Text style={[styles.meta, styles.onDark]}>GPS-Daten und Fahrtstrecken bleiben erhalten.</Text>{rows.map(row => <Text key={row.id} style={[styles.meta, styles.onDark]}>{row.label}: {row.latitude.toFixed(5)}, {row.longitude.toFixed(5)}</Text>)}</View> : null}
    {rows.length > 1 ? <View style={styles.actions}>{rows.map(row => <Pressable key={row.id} accessibilityRole="button" accessibilityState={{ selected: row.id === selectedMarkerId }} accessibilityLabel={`Standort ${row.label} auswählen`} onPress={() => { onMarkerSelect?.(row.id); camera.current?.easeTo({ center: [row.longitude, row.latitude], duration: 450 }); }} style={[styles.action, row.id === selectedMarkerId && styles.selected]}><Text style={styles.actionText}>{row.label}</Text>{row.subtitle ? <Text style={styles.meta}>{row.subtitle}</Text> : null}</Pressable>)}</View> : null}
    <View style={styles.caption}><Text style={styles.meta}>{markerLabel ?? selected?.label}{updated ? ` · ${lastUpdatedLabel}: ${updated}` : ''}{demoMode ? ' · Demo' : ''}</Text></View>
  </View>;
}
const styles = StyleSheet.create({
  container: { gap: 8 }, frame: { borderRadius: 18, overflow: 'hidden', backgroundColor: '#e8f1fb', borderWidth: 1, borderColor: '#bdd1e5' },
  loading: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#edf4fb' },
  fallback: { borderRadius: 18, backgroundColor: '#06192f', padding: 20, gap: 8, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.bodyStrong, color: '#ffffff' }, meta: { ...typography.caption, color: '#38556f' }, onDark: { color: '#c9ddea' }, caption: { backgroundColor: '#eef5fc', borderRadius: 10, padding: 10 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, action: { minHeight: 48, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#bdd1e5', backgroundColor: '#eef5fc', justifyContent: 'center', maxWidth: '100%' },
  actionText: { ...typography.bodyStrong, color: '#145689', flexShrink: 1 }, selected: { borderColor: '#e88718', backgroundColor: '#fff4e6' },
});
