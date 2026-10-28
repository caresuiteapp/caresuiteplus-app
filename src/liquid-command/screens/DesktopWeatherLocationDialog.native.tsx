// Generated native presentation from src/liquid-command/screens/DesktopWeatherLocationDialog.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeDetails,NativeSummary,NativeP,NativeA} from '@/components/layout/NativeWorkspaceElements.native';
import {CareSuiteNativeText as Text,CareSuiteNativeTextInput as TextInput} from '@/components/ui/CareSuiteNativeText';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import type { WeatherPlace } from '@/lib/platform/desktopWeatherModel';
type PlaceEntry = WeatherPlace & {
    search: string;
};
let placesPromise: Promise<PlaceEntry[]> | null = null;
const fold = (value: string) => value.toLocaleLowerCase('de-DE').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ß/g, 'ss').replace(/ae/g, 'a').replace(/oe/g, 'o').replace(/ue/g, 'u');
function loadPlaces() {
    if (!placesPromise)
        placesPromise = (async () => {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 15000);
            try {
                const rows: unknown = require('../../../assets/weather/de-places-v1.json');
                if (!Array.isArray(rows))
                    throw new Error('Invalid place list');
                return rows.filter((row): row is [
                    string,
                    string,
                    string,
                    string,
                    number,
                    number
                ] => Array.isArray(row) && row.length === 6 && row.slice(0, 4).every(value => typeof value === 'string')
                    && typeof row[4] === 'number' && Number.isFinite(row[4]) && typeof row[5] === 'number' && Number.isFinite(row[5]))
                    .map(([postcode, name, region, district, latitude, longitude]) => ({
                    postcode, name, region, district, latitude, longitude,
                    search: fold(`${postcode} ${name} ${region} ${district}`),
                }));
            }
            finally {
                clearTimeout(timer);
            }
        })().catch(error => { placesPromise = null; throw error; });
    return placesPromise;
}
export function DesktopWeatherLocationDialog({ visible, place, preferenceError, onChoose, onClose }: {
    visible: boolean;
    place: WeatherPlace | null;
    preferenceError: string | null;
    onChoose: (place: WeatherPlace | null) => boolean | Promise<boolean>;
    onClose: () => void;
}) {
    const { width, height } = useWindowDimensions();
    const scale = 1; // Android Text applies the system font scale once.
    const [query, setQuery] = useState('');
    const [busy, setBusy] = useState(false), [choiceError, setChoiceError] = useState('');
    const selectionRequest = useRef(0), selectionBusy = useRef(false);
    const [entries, setEntries] = useState<PlaceEntry[]>([]);
    const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
    const [attempt, setAttempt] = useState(0);
    useEffect(() => {
        if (!visible)
            return;
        setQuery('');
        setChoiceError('');
        setBusy(false);
        selectionBusy.current = false;
        selectionRequest.current++;
        let active = true;
        setStatus('loading');
        void loadPlaces().then(data => { if (active) {
            setEntries(data);
            setStatus('ready');
        } })
            .catch(() => { if (active)
            setStatus('error'); });
        return () => { active = false; selectionRequest.current++; selectionBusy.current = false; };
    }, [visible, attempt]);
    const search = fold(query.trim());
    const matches = useMemo(() => {
        if (search.length < 2)
            return [];
        const words = search.split(/\s+/);
        return entries.filter(entry => words.every(word => entry.search.includes(word)))
            .sort((a, b) => {
            const rank = (p: PlaceEntry) => p.postcode === search || fold(p.name) === search ? 0 : p.postcode.startsWith(search) || fold(p.name).startsWith(search) ? 1 : 2;
            return rank(a) - rank(b) || a.name.localeCompare(b.name, 'de') || a.postcode.localeCompare(b.postcode);
        });
    }, [entries, search]);
    const choose = async (next: WeatherPlace | null) => {
        if (!visible || selectionBusy.current)
            return;
        const request = selectionRequest.current;
        selectionBusy.current = true;
        setBusy(true);
        setChoiceError('');
        const clean = next ? { name: next.name, postcode: next.postcode, region: next.region, district: next.district, latitude: next.latitude, longitude: next.longitude } : null;
        try {
            if (await onChoose(clean) && request === selectionRequest.current)
                onClose();
        }
        catch {
            if (request === selectionRequest.current)
                setChoiceError('Der Wetterort konnte nicht gespeichert werden. Bitte erneut versuchen.');
        }
        finally {
            if (request === selectionRequest.current) {
                selectionBusy.current = false;
                setBusy(false);
            }
        }
    };
    const body = { fontSize: 15 * scale, lineHeight: 21 * scale };
    const label = { fontSize: 17 * scale, lineHeight: 23 * scale };
    const small = { fontSize: 13 * scale, lineHeight: 19 * scale };
    return <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
    <Pressable accessibilityLabel="Wetterort-Auswahl schließen" onPress={onClose} style={styles.backdrop}>
      <Pressable accessibilityViewIsModal onPress={event => event.stopPropagation()} style={[styles.panel, { width: Math.min(width - 24, 600 * scale), maxHeight: height - 32 }]}>
        <View style={styles.heading}>
          <View style={styles.titleGroup}>
            <Text style={[styles.eyebrow, small]}>IHR DESKTOP</Text>
            <Text accessibilityRole="header" style={[styles.title, { fontSize: 25 * scale, lineHeight: 32 * scale }]}>Wetterort ändern</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Wetterort-Auswahl schließen" onPress={onClose} style={styles.close}>
            <Text style={[styles.closeText, { fontSize: 25 * scale }]}>×</Text>
          </Pressable>
        </View>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.current}>
            <Text style={[styles.muted, small]}>Aktuelle Auswahl</Text>
            <Text style={[styles.strong, label]}>{place ? `${place.postcode} ${place.name}` : 'Automatischer Standort'}</Text>
          </View>
          <Text style={[styles.copy, body]}>Wählen Sie Ihren Ort in Deutschland. Die Auswahl bleibt für Ihr Konto auf diesem Gerät gespeichert.</Text>
          <Text nativeID="desktop-weather-city-label" style={[styles.strong, body]}>Stadt oder Postleitzahl</Text>
          <TextInput autoFocus accessibilityLabel="Stadt oder Postleitzahl in Deutschland" placeholder="Zum Beispiel Herne oder 44628" placeholderTextColor="#9BBAD1" value={query} onChangeText={setQuery} autoCorrect={false} maxLength={120} style={[styles.input, label]} {...({ 'aria-describedby': 'desktop-weather-search-status' } as object)}/>
          {preferenceError || choiceError ? <Text accessibilityRole="alert" style={[styles.error, body]}>{preferenceError || choiceError}</Text> : null}
          <Text nativeID="desktop-weather-search-status" accessibilityLiveRegion="polite" style={[styles.muted, small]}>
            {busy ? 'Wetterort wird gespeichert …' : status === 'loading' ? 'Ortsverzeichnis wird geladen …' : status === 'error' ? 'Ortsverzeichnis konnte nicht geladen werden.'
            : search.length < 2 ? 'Mindestens zwei Zeichen eingeben und anschließend einen Treffer auswählen.'
                : matches.length === 0 ? 'Kein passender Ort. Versuchen Sie einen anderen Ortsnamen oder die Postleitzahl.'
                    : matches.length === 1 ? '1 passender Ort' : matches.length > 30 ? `${matches.length} Treffer · erste 30 angezeigt. Mit der Postleitzahl eingrenzen.` : `${matches.length} passende Orte`}
          </Text>
          {status === 'error' ? <Pressable accessibilityRole="button" onPress={() => setAttempt(value => value + 1)} style={styles.automatic}><Text style={[styles.link, body]}>Erneut laden</Text></Pressable> : null}
          {status === 'ready' ? matches.slice(0, 30).map(entry => {
            const selected = place?.postcode === entry.postcode && place?.name === entry.name && place?.latitude === entry.latitude && place?.longitude === entry.longitude;
            return <Pressable key={`${entry.postcode}:${entry.name}:${entry.region}:${entry.district}:${entry.latitude}:${entry.longitude}`} accessibilityRole="button" accessibilityLabel={`${entry.postcode} ${entry.name}, ${entry.region} auswählen`} accessibilityState={{ selected, disabled: busy, busy }} disabled={busy} onPress={() => void choose(entry)} style={({ pressed }) => [styles.result, selected && styles.selected, pressed && styles.pressed]}>
              <View style={styles.resultText}><Text style={[styles.strong, label]}>{entry.postcode} {entry.name}</Text><Text style={[styles.muted, small]}>{[entry.district, entry.region].filter(Boolean).join(' · ')}</Text></View>
              <Text style={[styles.link, label]}>{selected ? '✓' : '›'}</Text>
            </Pressable>;
        }) : null}
          <Pressable accessibilityRole="button" accessibilityLabel="Aktuellen Standort verwenden" onPress={() => void choose(null)} disabled={busy} accessibilityState={{ disabled: busy, busy }} style={styles.automatic}>
            <Feather name="crosshair" size={18 * scale} color="#8BDFFF" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"/>
            <Text style={[styles.link, body, styles.automaticText]}>Aktuellen Standort verwenden</Text>
          </Pressable>
          <Text style={[styles.muted, small]}>Die App fragt bei Bedarf nach Ihrer Standortfreigabe. Für das Wetter werden nur ungefähre Koordinaten an Bright Sky übermittelt.</Text>
          <NativeDetails style={{ color: '#BED1E1', fontSize: 12 * scale, lineHeight: 1.5, paddingTop: 8 }}>
            <NativeSummary style={{ cursor: 'pointer', minHeight: 36 }}>Wetterinformationen</NativeSummary>
            <NativeP>Das Wetter stammt von einer verfügbaren Messstation in der Umgebung des gewählten Orts. Die Uhrzeit neben dem Ort zeigt den Stand der Messung.</NativeP>
            <NativeP>Wetterdaten: <NativeA href="https://www.dwd.de/EN/service/legal_notice/legal_notice.html" target="_blank" rel="noopener noreferrer" style={{ color: '#8BDFFF' }}>Deutscher Wetterdienst</NativeA>, bereitgestellt über Bright Sky.</NativeP>
            <NativeP>Ortsverzeichnis: <NativeA href="https://www.geonames.org/" target="_blank" rel="noopener noreferrer" style={{ color: '#8BDFFF' }}>GeoNames</NativeA>, <NativeA href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer" style={{ color: '#8BDFFF' }}>CC BY 4.0</NativeA>. Für die Ortssuche aufbereitet, Stand September 2026.</NativeP>
          </NativeDetails>
        </ScrollView>
      </Pressable>
    </Pressable>
  </Modal>;
}
const styles = StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,8,22,0.72)', alignItems: 'center', justifyContent: 'center', padding: 12 },
    panel: { flexShrink: 1, minHeight: 0, padding: 22, borderRadius: 28, borderWidth: 1, borderColor: '#4A829F', backgroundColor: '#0B2038', boxShadow: '0 24px 80px rgba(0,0,0,0.4)' },
    heading: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 18 }, titleGroup: { flex: 1, minWidth: 0, gap: 5 },
    eyebrow: { color: '#77DFFF', fontWeight: '800', letterSpacing: 1.4 }, title: { color: '#F4FAFF', fontWeight: '800' },
    close: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: '#4A748F' }, closeText: { color: '#F4FAFF' },
    scroll: { flexShrink: 1, minHeight: 0 }, content: { gap: 12, paddingBottom: 4 },
    current: { gap: 4, backgroundColor: '#143C57', borderRadius: 16, padding: 14 },
    strong: { color: '#F4FAFF', fontWeight: '700' }, copy: { color: '#DCE9F4' }, muted: { color: '#B4CCDF' },
    input: { minHeight: 52, borderWidth: 1, borderColor: '#739FBF', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#06182D', color: '#F4FAFF' },
    result: { minHeight: 64, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: '#325774', borderRadius: 15, backgroundColor: '#112B45' },
    resultText: { flex: 1, minWidth: 0, gap: 4 }, selected: { borderColor: '#77DFFF', backgroundColor: '#134563' }, pressed: { backgroundColor: '#205574' },
    automatic: { minHeight: 48, padding: 12, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#426D8C', borderRadius: 14, marginTop: 6 },
    automaticText: { flexShrink: 1, minWidth: 0, textAlign: 'center' },
    link: { color: '#8BDFFF', fontWeight: '700' }, error: { color: '#FFB4BE', padding: 12, borderRadius: 12, backgroundColor: '#48273D' },
});
