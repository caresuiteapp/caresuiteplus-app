import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useWebFontScale } from '@/design/web/WebFontScaleProvider';
import type { WeatherPlace } from '@/hooks/useDesktopWeather.web';

type PlaceEntry = WeatherPlace & { search: string };
let placesPromise: Promise<PlaceEntry[]> | null = null;
const fold = (value: string) => value.toLocaleLowerCase('de-DE').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ß/g, 'ss').replace(/ae/g, 'a').replace(/oe/g, 'o').replace(/ue/g, 'u');

function loadPlaces() {
  if (!placesPromise) placesPromise = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch('/weather/de-places-v1.json', { signal: controller.signal, credentials: 'same-origin' });
      if (!response.ok) throw new Error('Place list unavailable');
      const rows: unknown = await response.json();
      if (!Array.isArray(rows)) throw new Error('Invalid place list');
      return rows.filter((row): row is [string, string, string, string, number, number] =>
        Array.isArray(row) && row.length === 6 && row.slice(0, 4).every(value => typeof value === 'string')
        && typeof row[4] === 'number' && Number.isFinite(row[4]) && typeof row[5] === 'number' && Number.isFinite(row[5]))
        .map(([postcode, name, region, district, latitude, longitude]) => ({
          postcode, name, region, district, latitude, longitude,
          search: fold(`${postcode} ${name} ${region} ${district}`),
        }));
    } finally { clearTimeout(timer); }
  })().catch(error => { placesPromise = null; throw error; });
  return placesPromise;
}

export function DesktopWeatherLocationDialog({ visible, place, preferenceError, onChoose, onClose }: {
  visible: boolean;
  place: WeatherPlace | null;
  preferenceError: string | null;
  onChoose: (place: WeatherPlace | null) => boolean;
  onClose: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const { scale } = useWebFontScale();
  const [query, setQuery] = useState('');
  const [entries, setEntries] = useState<PlaceEntry[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!visible) return;
    setQuery('');
    let active = true;
    setStatus('loading');
    void loadPlaces().then(data => { if (active) { setEntries(data); setStatus('ready'); } })
      .catch(() => { if (active) setStatus('error'); });
    return () => { active = false; };
  }, [visible, attempt]);
  const search = fold(query.trim());
  const matches = useMemo(() => {
    if (search.length < 2) return [];
    const words = search.split(/\s+/);
    return entries.filter(entry => words.every(word => entry.search.includes(word)))
      .sort((a, b) => {
        const rank = (p: PlaceEntry) => p.postcode === search || fold(p.name) === search ? 0 : p.postcode.startsWith(search) || fold(p.name).startsWith(search) ? 1 : 2;
        return rank(a) - rank(b) || a.name.localeCompare(b.name, 'de') || a.postcode.localeCompare(b.postcode);
      });
  }, [entries, search]);
  const choose = (next: WeatherPlace | null) => {
    const clean = next ? { name: next.name, postcode: next.postcode, region: next.region, district: next.district, latitude: next.latitude, longitude: next.longitude } : null;
    if (onChoose(clean)) onClose();
  };
  const body = { fontSize: 15 * scale, lineHeight: 21 * scale };
  const label = { fontSize: 17 * scale, lineHeight: 23 * scale };
  const small = { fontSize: 13 * scale, lineHeight: 19 * scale };
  return <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
    <Pressable accessibilityLabel="Wetterort-Auswahl schließen" onPress={onClose} style={styles.backdrop}>
      <Pressable onPress={event => event.stopPropagation()} style={[styles.panel, { width: Math.min(width - 24, 600 * scale), maxHeight: height - 32 }]}>
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
          <Text style={[styles.copy, body]}>Wählen Sie Ihren Ort in Deutschland. Die Auswahl bleibt für Ihr Konto in diesem Browser gespeichert.</Text>
          <Text nativeID="desktop-weather-city-label" style={[styles.strong, body]}>Stadt oder Postleitzahl</Text>
          <TextInput autoFocus accessibilityLabel="Stadt oder Postleitzahl in Deutschland" placeholder="Zum Beispiel Herne oder 44628" placeholderTextColor="#9BBAD1"
            value={query} onChangeText={setQuery} autoCorrect={false} maxLength={120} style={[styles.input, label]}
            {...({ 'aria-describedby': 'desktop-weather-search-status' } as object)} />
          {preferenceError ? <Text accessibilityRole="alert" style={[styles.error, body]}>{preferenceError}</Text> : null}
          <Text nativeID="desktop-weather-search-status" accessibilityLiveRegion="polite" style={[styles.muted, small]}>
            {status === 'loading' ? 'Ortsverzeichnis wird geladen …' : status === 'error' ? 'Ortsverzeichnis konnte nicht geladen werden.'
              : search.length < 2 ? 'Mindestens zwei Zeichen eingeben und anschließend einen Treffer auswählen.'
                : matches.length === 0 ? 'Kein passender Ort. Versuchen Sie einen anderen Ortsnamen oder die Postleitzahl.'
                  : matches.length > 30 ? `${matches.length} Treffer · erste 30 angezeigt. Mit der Postleitzahl eingrenzen.` : `${matches.length} passende Orte`}
          </Text>
          {status === 'error' ? <Pressable accessibilityRole="button" onPress={() => setAttempt(value => value + 1)} style={styles.automatic}><Text style={[styles.link, body]}>Erneut laden</Text></Pressable> : null}
          {status === 'ready' ? matches.slice(0, 30).map(entry => {
            const selected = place?.postcode === entry.postcode && place?.name === entry.name && place?.latitude === entry.latitude && place?.longitude === entry.longitude;
            return <Pressable key={`${entry.postcode}:${entry.name}:${entry.region}:${entry.district}:${entry.latitude}:${entry.longitude}`} accessibilityRole="button"
              accessibilityLabel={`${entry.postcode} ${entry.name}, ${entry.region} auswählen`} accessibilityState={{ selected }}
              onPress={() => choose(entry)} style={({ pressed }) => [styles.result, selected && styles.selected, pressed && styles.pressed]}>
              <View style={styles.resultText}><Text style={[styles.strong, label]}>{entry.postcode} {entry.name}</Text><Text style={[styles.muted, small]}>{[entry.district, entry.region].filter(Boolean).join(' · ')}</Text></View>
              <Text style={[styles.link, label]}>{selected ? '✓' : '›'}</Text>
            </Pressable>;
          }) : null}
          <Pressable accessibilityRole="button" onPress={() => choose(null)} style={styles.automatic}>
            <Text style={[styles.link, body]}>⌖ Aktuellen Standort verwenden</Text>
          </Pressable>
          <Text style={[styles.muted, small]}>Der Browser kann dafür nach Ihrer Standortfreigabe fragen.</Text>
          <details style={{ color: '#BED1E1', fontSize: 12 * scale, lineHeight: 1.5, paddingTop: 8 }}>
            <summary style={{ cursor: 'pointer', minHeight: 36 }}>Wetterinformationen</summary>
            <p>Das Wetter stammt von einer verfügbaren Messstation in der Umgebung des gewählten Orts. Die Uhrzeit neben dem Ort zeigt den Stand der Messung.</p>
            <p>Wetterdaten: <a href="https://www.dwd.de/EN/service/legal_notice/legal_notice.html" target="_blank" rel="noopener noreferrer" style={{ color: '#8BDFFF' }}>Deutscher Wetterdienst</a>, bereitgestellt über Bright Sky.</p>
            <p>Ortsverzeichnis: <a href="https://www.geonames.org/" target="_blank" rel="noopener noreferrer" style={{ color: '#8BDFFF' }}>GeoNames</a>, <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer" style={{ color: '#8BDFFF' }}>CC BY 4.0</a>. Für die Ortssuche aufbereitet, Stand September 2026.</p>
          </details>
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
  automatic: { minHeight: 48, padding: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#426D8C', borderRadius: 14, marginTop: 6 },
  link: { color: '#8BDFFF', fontWeight: '700' }, error: { color: '#FFB4BE', padding: 12, borderRadius: 12, backgroundColor: '#48273D' },
});
