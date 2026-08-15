import { useEffect, useMemo, useState } from 'react';
import {
  Image,
  ImageBackground,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { PortalTextSizeControls } from '@/components/portal/accessibility/PortalTextSizeControls';
import { TopbarProfileAvatar } from '@/components/layout/TopbarProfileAvatar';

type WidgetDefinition = {
  id: string;
  label: string;
  route: string;
  image: number;
};

const BACKGROUND = require('../../../assets/healthos/caresuite-alien-planet-no-logo.png');
const BRAND = require('../../../assets/healthos/caresuite-healthos-logo.png');

const WIDGETS: readonly WidgetDefinition[] = [
  { id: 'company', label: 'Unternehmen', route: '/business/office/dashboard', image: require('../../../assets/healthos/widgets/01-unternehmen.png') },
  { id: 'clients', label: 'Klient:innen', route: '/business/office/clients', image: require('../../../assets/healthos/widgets/02-klientinnen.png') },
  { id: 'people', label: 'Personal', route: '/business/office/employees', image: require('../../../assets/healthos/widgets/03-personal.png') },
  { id: 'time', label: 'Arbeitszeit', route: '/business/office/time-tracking', image: require('../../../assets/healthos/widgets/04-arbeitszeit.png') },
  { id: 'salary', label: 'Gehaltsstatistik', route: '/business/office/payroll', image: require('../../../assets/healthos/widgets/05-gehaltsstatistik.png') },
  { id: 'billing', label: 'Rechnungen', route: '/business/office/invoices', image: require('../../../assets/healthos/widgets/06-rechnungen.png') },
  { id: 'documents', label: 'Dokumente', route: '/business/office/documents', image: require('../../../assets/healthos/widgets/07-dokumente.png') },
  { id: 'messages', label: 'Nachrichten', route: '/business/messages', image: require('../../../assets/healthos/widgets/08-nachrichten.png') },
  { id: 'access', label: 'Portale & Zugänge', route: '/business/office/portals', image: require('../../../assets/healthos/widgets/09-portale-zugaenge.png') },
  { id: 'inventory', label: 'Inventar', route: '/business/office/inventory', image: require('../../../assets/healthos/widgets/10-inventar.png') },
  { id: 'audit', label: 'Audit', route: '/business/office/audit-log', image: require('../../../assets/healthos/widgets/11-audit.png') },
  { id: 'assignments', label: 'Einsätze', route: '/assist/einsaetze', image: require('../../../assets/healthos/widgets/12-einsaetze.png') },
  { id: 'calendar', label: 'Kalender & Einsatzplanung', route: '/assist/kalender', image: require('../../../assets/healthos/widgets/13-kalender-einsatzplanung.png') },
  { id: 'live', label: 'Live-Status', route: '/assist/live-status', image: require('../../../assets/healthos/widgets/14-live-status.png') },
  { id: 'proofs', label: 'Nachweise', route: '/assist/nachweise', image: require('../../../assets/healthos/widgets/15-nachweise.png') },
  { id: 'budgets', label: 'Budgets', route: '/assist/abrechnungsquellen', image: require('../../../assets/healthos/widgets/16-budgets.png') },
  { id: 'portals', label: 'Portale', route: '/assist/portale', image: require('../../../assets/healthos/widgets/17-portale.png') },
  { id: 'command', label: 'Command Center', route: '/command-center', image: require('../../../assets/healthos/widgets/18-command-center.png') },
  { id: 'office', label: 'Office', route: '/office', image: require('../../../assets/healthos/widgets/19-office.png') },
  { id: 'assist', label: 'Assist', route: '/assist', image: require('../../../assets/healthos/widgets/20-assist.png') },
] as const;

const WEATHER_LABELS: Record<number, string> = {
  0: 'Klar', 1: 'Heiter', 2: 'Wolkig', 3: 'Bedeckt', 45: 'Nebel', 48: 'Nebel',
  51: 'Niesel', 53: 'Niesel', 55: 'Niesel', 61: 'Regen', 63: 'Regen', 65: 'Regen',
  71: 'Schnee', 73: 'Schnee', 75: 'Schnee', 80: 'Schauer', 81: 'Schauer',
  82: 'Schauer', 95: 'Gewitter', 96: 'Gewitter', 99: 'Gewitter',
};

function formatDate(value: Date) {
  return new Intl.DateTimeFormat('de-DE', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  }).format(value);
}

function weatherGlyph(code: number) {
  if (code === 0) return '☀';
  if ([1, 2, 3, 45, 48].includes(code)) return '☁';
  if (code >= 71 && code <= 75) return '❄';
  if (code >= 95) return '⚡';
  return '☂';
}

export function CommandCenterScreen() {
  const router = useRouter();
  const auth = useAuth();
  const { width, height } = useWindowDimensions();
  const compact = width < 780;
  const pageSize = compact ? 2 : width < 1180 ? 3 : 5;
  const pageCount = Math.ceil(WIDGETS.length / pageSize);
  const [page, setPage] = useState(0);
  const [now, setNow] = useState(new Date());
  const [temperature, setTemperature] = useState<number | null>(null);
  const [weatherCode, setWeatherCode] = useState(0);
  const [place, setPlace] = useState('Berlin');
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setPage((current) => Math.min(current, Math.max(0, pageCount - 1)));
  }, [pageCount]);

  useEffect(() => {
    let active = true;
    const load = async (latitude: number, longitude: number, label: string) => {
      try {
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&timezone=auto`);
        const data = await response.json();
        if (!active) return;
        setTemperature(Math.round(Number(data?.current?.temperature_2m)));
        setWeatherCode(Number(data?.current?.weather_code ?? 0));
        setPlace(label);
      } catch {
        if (active) setPlace(label);
      }
    };
    const fallback = () => void load(52.52, 13.405, 'Berlin');
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => void load(position.coords.latitude, position.coords.longitude, 'Standort'),
        fallback,
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 600000 },
      );
    } else fallback();
    return () => { active = false; };
  }, []);

  const visibleWidgets = useMemo(
    () => WIDGETS.slice(page * pageSize, page * pageSize + pageSize),
    [page, pageSize],
  );
  const searchResults = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('de-DE');
    return normalized ? WIDGETS.filter((widget) => widget.label.toLocaleLowerCase('de-DE').includes(normalized)) : WIDGETS;
  }, [query]);
  const profile = auth.profile;
  const displayName = profile?.displayName || auth.user?.displayName || 'Profil';
  const role = profile?.roleKey ?? 'CareSuite';

  const openWidget = (widget: WidgetDefinition) => {
    setSearchOpen(false);
    setQuery('');
    router.push(widget.route as never);
  };

  return (
    <ImageBackground source={BACKGROUND} resizeMode="cover" style={styles.background} imageStyle={styles.backgroundImage}>
      <View style={styles.atmosphere} />
      <View style={[styles.topLayer, compact && styles.topLayerCompact]}>
        <View style={[styles.identityColumn, compact && styles.identityColumnCompact]}>
          <Image accessibilityLabel="CareSuite HealthOS" resizeMode="contain" source={BRAND} style={[styles.logo, compact && styles.logoCompact]} />
          <View style={[styles.glass, styles.timeWeather, compact && styles.timeWeatherCompact]}>
            <View style={styles.timeBlock}>
              <Text style={[styles.time, compact && styles.timeCompact]}>{now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</Text>
              <Text numberOfLines={1} style={styles.date}>{formatDate(now)}</Text>
            </View>
            <View style={styles.glassDivider} />
            <View style={styles.weatherBlock}>
              <Text style={styles.weatherIcon}>{weatherGlyph(weatherCode)}</Text>
              <View>
                <Text style={styles.weatherLine}>{temperature === null ? '—°' : `${temperature}°`} <Text style={styles.weatherState}>{WEATHER_LABELS[weatherCode] ?? 'Aktuell'}</Text></Text>
                <Text style={styles.place}>⌖ {place}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={[styles.glass, styles.actions, compact && styles.actionsCompact]}>
          <Pressable accessibilityLabel="Widget suchen" onPress={() => setSearchOpen(true)} style={styles.actionButton}><Text style={styles.actionGlyph}>⌕</Text></Pressable>
          {!compact ? <PortalTextSizeControls compact /> : null}
          <View style={styles.livePill}><View style={styles.liveDot} /><Text style={styles.liveText}>Live</Text></View>
          <Pressable accessibilityLabel="Einstellungen öffnen" onPress={() => router.push('/settings' as never)} style={styles.actionButton}><Text style={styles.actionGlyph}>☷</Text></Pressable>
          {!compact ? <View style={styles.profileCopy}><Text numberOfLines={1} style={styles.profileName}>{displayName}</Text><Text numberOfLines={1} style={styles.profileRole}>{role}</Text></View> : null}
          <Pressable accessibilityLabel={`Profil ${displayName} öffnen`} onPress={() => router.push('/settings/profile' as never)}>
            <TopbarProfileAvatar name={displayName} avatarUrl={profile?.avatarUrl?.trim() || undefined} avatarVersion={profile?.updatedAt ?? profile?.avatarUrl} accentColor="#56C7FF" size="lg" />
          </Pressable>
        </View>
      </View>

      <View style={[styles.dockRegion, compact && styles.dockRegionCompact, height < 720 && styles.dockRegionShort]}>
        <Pressable accessibilityLabel="Vorherige Widget-Seite" disabled={page === 0} onPress={() => setPage((value) => Math.max(0, value - 1))} style={[styles.arrow, page === 0 && styles.arrowDisabled]}><Text style={styles.arrowText}>‹</Text></Pressable>
        <View style={[styles.glass, styles.dock, compact && styles.dockCompact]}>
          <View style={styles.widgetRow}>
            {visibleWidgets.map((widget) => (
              <Pressable key={widget.id} accessibilityRole="button" accessibilityLabel={`${widget.label} öffnen`} onPress={() => openWidget(widget)} style={({ pressed }) => [styles.widget, pressed && styles.widgetPressed]}>
                <Image resizeMode="contain" source={widget.image} style={styles.widgetImage} />
                <Text numberOfLines={1} style={styles.widgetLabel}>{widget.label}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.pageDots}>{Array.from({ length: pageCount }, (_, index) => <View key={index} style={[styles.pageDot, index === page && styles.pageDotActive]} />)}</View>
        </View>
        <Pressable accessibilityLabel="Nächste Widget-Seite" disabled={page >= pageCount - 1} onPress={() => setPage((value) => Math.min(pageCount - 1, value + 1))} style={[styles.arrow, page >= pageCount - 1 && styles.arrowDisabled]}><Text style={styles.arrowText}>›</Text></Pressable>
      </View>

      <Modal animationType="fade" transparent visible={searchOpen} onRequestClose={() => setSearchOpen(false)}>
        <Pressable onPress={() => setSearchOpen(false)} style={styles.modalBackdrop}>
          <Pressable onPress={(event) => event.stopPropagation()} style={[styles.glass, styles.searchPanel]}>
            <View style={styles.searchHeader}><Text style={styles.searchTitle}>Widgets durchsuchen</Text><Pressable accessibilityLabel="Suche schließen" onPress={() => setSearchOpen(false)} style={styles.closeButton}><Text style={styles.closeText}>×</Text></Pressable></View>
            <TextInput autoFocus placeholder="Funktion suchen …" placeholderTextColor="#90A5BF" value={query} onChangeText={setQuery} style={styles.searchInput} />
            <ScrollView contentContainerStyle={styles.searchResults} keyboardShouldPersistTaps="handled">
              {searchResults.map((widget) => <Pressable key={widget.id} onPress={() => openWidget(widget)} style={styles.searchResult}><Image source={widget.image} resizeMode="contain" style={styles.searchThumb} /><Text style={styles.searchResultText}>{widget.label}</Text><Text style={styles.searchChevron}>›</Text></Pressable>)}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, minHeight: '100%', backgroundColor: '#03132B', overflow: 'hidden' },
  backgroundImage: { width: '100%', height: '100%' },
  atmosphere: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,12,31,0.08)' },
  topLayer: { position: 'absolute', top: 28, left: 32, right: 32, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24 },
  topLayerCompact: { top: 16, left: 14, right: 14, gap: 10 },
  identityColumn: { width: 420, alignItems: 'flex-start', gap: 10 },
  identityColumnCompact: { width: 'auto', flex: 1 },
  logo: { width: 370, height: 48 },
  logoCompact: { width: 210, height: 30 },
  glass: { backgroundColor: 'rgba(3,17,39,0.74)', borderWidth: 1, borderColor: 'rgba(139,211,255,0.36)', shadowColor: '#2BB8FF', shadowOpacity: 0.2, shadowRadius: 24, shadowOffset: { width: 0, height: 10 } },
  timeWeather: { minWidth: 410, minHeight: 86, borderRadius: 28, paddingHorizontal: 22, paddingVertical: 12, flexDirection: 'row', alignItems: 'center' },
  timeWeatherCompact: { minWidth: 0, alignSelf: 'stretch', minHeight: 70, paddingHorizontal: 14, borderRadius: 22 },
  timeBlock: { flex: 1, minWidth: 0 }, time: { color: '#FFF', fontSize: 36, lineHeight: 39, fontWeight: '900', letterSpacing: -1.4 }, timeCompact: { fontSize: 25, lineHeight: 28 },
  date: { color: '#D8EAFF', fontSize: 12, lineHeight: 17, fontWeight: '600' }, glassDivider: { width: 1, height: 48, backgroundColor: 'rgba(149,210,255,0.24)', marginHorizontal: 18 },
  weatherBlock: { flexDirection: 'row', alignItems: 'center', gap: 10 }, weatherIcon: { color: '#8FE4FF', fontSize: 30 }, weatherLine: { color: '#FFF', fontSize: 22, lineHeight: 25, fontWeight: '900' }, weatherState: { fontSize: 13, fontWeight: '800' }, place: { color: '#BCD4EC', fontSize: 11, marginTop: 2 },
  actions: { minHeight: 88, borderRadius: 28, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }, actionsCompact: { minHeight: 60, padding: 7, borderRadius: 22, gap: 6 },
  actionButton: { width: 48, height: 48, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(146,205,255,0.28)', backgroundColor: 'rgba(8,29,59,0.62)', alignItems: 'center', justifyContent: 'center' }, actionGlyph: { color: '#FFF', fontSize: 23, fontWeight: '700' },
  livePill: { height: 48, borderRadius: 16, paddingHorizontal: 15, borderWidth: 1, borderColor: 'rgba(70,171,255,0.5)', flexDirection: 'row', alignItems: 'center', gap: 8 }, liveDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#58D8C1', shadowColor: '#58D8C1', shadowOpacity: 0.9, shadowRadius: 8 }, liveText: { color: '#FFF', fontSize: 15, fontWeight: '900' },
  profileCopy: { maxWidth: 160, alignItems: 'flex-end', marginLeft: 4 }, profileName: { color: '#FFF', fontSize: 14, fontWeight: '900' }, profileRole: { color: '#AFC7DF', fontSize: 11, marginTop: 2 },
  dockRegion: { position: 'absolute', left: 42, right: 42, bottom: 26, height: 238, flexDirection: 'row', alignItems: 'center', gap: 16 }, dockRegionCompact: { left: 10, right: 10, bottom: 12, height: 205, gap: 7 }, dockRegionShort: { bottom: 8, height: 190 },
  dock: { flex: 1, height: '100%', borderRadius: 34, paddingHorizontal: 24, paddingTop: 18, paddingBottom: 10, overflow: 'hidden' }, dockCompact: { paddingHorizontal: 10, paddingTop: 12, borderRadius: 26 },
  widgetRow: { flex: 1, minHeight: 0, flexDirection: 'row', alignItems: 'stretch', justifyContent: 'center', gap: 16 }, widget: { flex: 1, minWidth: 0, maxWidth: 330, borderRadius: 25, padding: 7, paddingBottom: 10, backgroundColor: 'rgba(3,10,24,0.74)', borderWidth: 1, borderColor: 'rgba(133,205,255,0.22)', alignItems: 'center', justifyContent: 'space-between', overflow: 'hidden' }, widgetPressed: { transform: [{ scale: 0.97 }], borderColor: '#69D5FF', backgroundColor: 'rgba(8,34,70,0.92)' }, widgetImage: { width: '100%', flex: 1, minHeight: 0 }, widgetLabel: { color: '#F5FAFF', fontSize: 13, lineHeight: 17, fontWeight: '800', marginTop: 4, paddingHorizontal: 4 },
  arrow: { width: 58, height: 58, borderRadius: 29, borderWidth: 1, borderColor: 'rgba(142,210,255,0.42)', backgroundColor: 'rgba(3,18,39,0.78)', alignItems: 'center', justifyContent: 'center' }, arrowDisabled: { opacity: 0.28 }, arrowText: { color: '#FFF', fontSize: 45, lineHeight: 48, fontWeight: '300', marginTop: -4 },
  pageDots: { height: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 5 }, pageDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(186,219,245,0.32)' }, pageDotActive: { width: 20, backgroundColor: '#68D4FF' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,5,16,0.7)', alignItems: 'center', justifyContent: 'center', padding: 18 }, searchPanel: { width: '100%', maxWidth: 720, maxHeight: '82%', borderRadius: 30, padding: 20 }, searchHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }, searchTitle: { color: '#FFF', fontSize: 23, fontWeight: '900' }, closeButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }, closeText: { color: '#FFF', fontSize: 29, lineHeight: 31 },
  searchInput: { minHeight: 52, borderRadius: 17, borderWidth: 1, borderColor: 'rgba(126,205,255,0.35)', backgroundColor: 'rgba(1,9,24,0.7)', color: '#FFF', fontSize: 16, paddingHorizontal: 17, marginBottom: 12 }, searchResults: { gap: 8, paddingBottom: 4 }, searchResult: { minHeight: 65, borderRadius: 17, backgroundColor: 'rgba(9,30,61,0.75)', borderWidth: 1, borderColor: 'rgba(116,190,242,0.18)', padding: 8, flexDirection: 'row', alignItems: 'center', gap: 12 }, searchThumb: { width: 86, height: 48 }, searchResultText: { flex: 1, color: '#FFF', fontSize: 15, fontWeight: '800' }, searchChevron: { color: '#88DFFF', fontSize: 28 },
});
