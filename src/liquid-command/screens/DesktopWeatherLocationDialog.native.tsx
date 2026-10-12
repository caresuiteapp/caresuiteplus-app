import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { NativeAction, NativeField, NativeWorkspaceDialog, nativeWorkspaceStyles as ui } from '@/components/ui/NativeWorkspaceUi';
import type { WeatherPlace } from '@/lib/platform/desktopWeatherModel';
const fold = (value: string) => value.toLocaleLowerCase('de-DE').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ß/g, 'ss').replace(/ae/g, 'a').replace(/oe/g, 'o').replace(/ue/g, 'u');
const rows: [string, string, string, string, number, number][] = require('../../../assets/weather/de-places-v1.json');
const places = rows.map(([postcode, name, region, district, latitude, longitude]) => ({ postcode, name, region, district, latitude, longitude, search: fold(`${postcode} ${name} ${region} ${district}`) }));
export function DesktopWeatherLocationDialog({ visible, place, preferenceError, onChoose, onClose }: { visible: boolean; place: WeatherPlace | null; preferenceError: string | null; onChoose: (place: WeatherPlace | null) => Promise<boolean>; onClose: () => void }) {
  const [query, setQuery] = useState(''); const [busy, setBusy] = useState(false);
  const matches = useMemo(() => { const search = fold(query.trim()); if (search.length < 2) return []; const words = search.split(/\s+/); return places.filter(item => words.every(word => item.search.includes(word))).sort((a, b) => {
    const rank = (p: typeof a) => p.postcode === search || fold(p.name) === search ? 0 : p.postcode.startsWith(search) || fold(p.name).startsWith(search) ? 1 : 2;
    return rank(a) - rank(b) || a.name.localeCompare(b.name, 'de') || a.postcode.localeCompare(b.postcode);
  }); }, [query]);
  const choose = async (next: WeatherPlace | null) => { if (busy) return; setBusy(true); try { if (await onChoose(next)) { setQuery(''); onClose(); } } finally { setBusy(false); } };
  return <NativeWorkspaceDialog visible={visible} title="Wetterort ändern" onClose={onClose}>
    <Text style={ui.body}>{place ? `${place.postcode} ${place.name}` : 'Automatischer Standort'}</Text>
    <Text style={ui.muted}>Wählen Sie Ihren Ort in Deutschland. Die Auswahl bleibt für Ihr Konto auf diesem Gerät gespeichert.</Text>
    <NativeField label="Stadt oder Postleitzahl" placeholder="Zum Beispiel Herne oder 44628" value={query} onChangeText={setQuery} autoCorrect={false} maxLength={120} />
    {preferenceError ? <Text accessibilityRole="alert" style={ui.error}>{preferenceError}</Text> : null}
    <Text accessibilityLiveRegion="polite" style={ui.muted}>{query.trim().length < 2 ? 'Mindestens zwei Zeichen eingeben.' : matches.length ? `${matches.length} Treffer · bis zu 30 angezeigt` : 'Kein passender Ort. Mit einem Ortsnamen oder der Postleitzahl versuchen.'}</Text>
    {matches.slice(0, 30).map(item => <View key={`${item.postcode}:${item.name}:${item.latitude}:${item.longitude}`} style={ui.surface}><NativeAction label={`${item.postcode} ${item.name}`} disabled={busy} selected={place?.postcode === item.postcode && place?.latitude === item.latitude && place?.longitude === item.longitude} onPress={() => void choose({ name: item.name, postcode: item.postcode, region: item.region, district: item.district, latitude: item.latitude, longitude: item.longitude })} /><Text style={ui.muted}>{item.district} · {item.region}</Text></View>)}
    <NativeAction label="Aktuellen Standort verwenden" busy={busy} onPress={() => void choose(null)} />
    <Text style={ui.muted}>Die App fragt bei Bedarf nach der Standortfreigabe. Für das Wetter werden nur ungefähre Koordinaten an Bright Sky übermittelt. Die Messwerte stammen vom Deutschen Wetterdienst und können vom Wetter direkt am gewählten Ort abweichen.</Text>
  </NativeWorkspaceDialog>;
}
