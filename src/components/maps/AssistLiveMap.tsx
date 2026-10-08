import { useEffect, useRef, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { careSuiteAppFontFamily } from '@/design/tokens/appFontFamily';
import { formatMapLastUpdated, type AssistLiveMapMarker, type AssistLiveRoutePoint, type AssistMapPosition } from '@/lib/assist/assistMapProvider';
import { FREE_NATIVE_MAP_HTML, mapUpdateScript } from '@/lib/maps/freeNativeMapHtml';
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
export function AssistLiveMap({ position, markers, routePoints = [], routeSegments, plannedRoutePoints = [], routeIdentity, selectedMarkerId, onMarkerSelect, height = 280, markerLabel, fallbackMessage = 'Keine Standortdaten vorhanden.', lastUpdatedLabel = 'Letzte Aktualisierung', demoMode = false }: AssistLiveMapProps) {
    const webView = useRef<WebView<unknown>>(null);
    const [failed, setFailed] = useState(false);
    const [retry, setRetry] = useState(0);
    const readyRef=useRef(false);
    const rows = (markers?.length ? markers : position ? [{ id: 'primary', ...position, label: markerLabel ?? 'Standort' }] : []).filter(row=>Number.isFinite(row.latitude)&&Number.isFinite(row.longitude)&&Math.abs(row.latitude)<=90&&Math.abs(row.longitude)<=180);
    const data = { markers: rows, segments: routeSegments ?? (routePoints.length > 1 ? [routePoints] : []), planned: plannedRoutePoints, routeIdentity, selectedMarkerId };
    const hasData=rows.length>0;
    useEffect(()=>{readyRef.current=false;if(!hasData)return;const timeout=setTimeout(()=>{if(!readyRef.current)setFailed(true);},15000);return()=>clearTimeout(timeout);},[retry,hasData]);
    const dataRef = useRef(data);
    dataRef.current = data;
    useEffect(() => { webView.current?.injectJavaScript(mapUpdateScript(data)); }, [position, markers, routePoints, routeSegments, plannedRoutePoints, routeIdentity, selectedMarkerId]);
    if (!rows.length)
        return <View style={[styles.fallback, { minHeight: height }]}><Text style={styles.fallbackTitle}>Positionsmonitor ist bereit</Text><Text style={styles.fallbackText}>{fallbackMessage}</Text></View>;
    const updated = formatMapLastUpdated(position?.capturedAt ?? rows[0].capturedAt);
    return <View style={styles.container}><View style={[styles.mapFrame, { height }]}>
    <WebView<unknown> key={retry} ref={webView} source={{ html: FREE_NATIVE_MAP_HTML, baseUrl: 'https://www.caresuiteplus.app/' }} originWhitelist={['https://www.caresuiteplus.app', 'about:blank']} javaScriptEnabled mixedContentMode="never" allowFileAccess={false} allowUniversalAccessFromFileURLs={false} onError={() => setFailed(true)} onHttpError={() => setFailed(true)} onLoadEnd={() => webView.current?.injectJavaScript(mapUpdateScript(dataRef.current))} onShouldStartLoadWithRequest={request => { if (request.url === 'about:blank' || request.url === 'https://www.caresuiteplus.app/')
        return true; if (/^https:\/\/(www\.)?openstreetmap\.org\//.test(request.url))
        void Linking.openURL(request.url); return false; }} onMessage={event => { try {
        const message = JSON.parse(event.nativeEvent.data);
        if(message.type==='ready')readyRef.current=true;
        if (message.type === 'ready' || message.type === 'initialized') {
            setFailed(false);
            webView.current?.injectJavaScript(mapUpdateScript(dataRef.current));
        }
        if (message.type === 'error')
            setFailed(true);
        if (message.type === 'select' && rows.some(r => r.id === message.id))
            onMarkerSelect?.(message.id);
    }
    catch { /* Ignore unrecognized map messages. */ } }}/>
  </View>{failed ? <View style={styles.fallback}><Text style={styles.fallbackText}>Karte nicht erreichbar. GPS-Daten bleiben erhalten.</Text><Pressable accessibilityRole="button" onPress={() => { setFailed(false); setRetry(v => v + 1); }}><Text style={styles.meta}>Erneut versuchen</Text></Pressable>{rows.map(row => <Text key={row.id} style={styles.coordLine}>{row.label}: {row.latitude.toFixed(5)}, {row.longitude.toFixed(5)}</Text>)}</View> : null}
  <Text style={styles.meta}>{markerLabel ?? rows[0].label}{updated ? ` · ${lastUpdatedLabel}: ${updated}` : ''}{demoMode ? ' · Demo' : ''}</Text></View>;
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
        fontFamily: careSuiteAppFontFamily ?? (Platform.OS === 'ios' ? 'Menlo' : 'monospace'),
    },
});
