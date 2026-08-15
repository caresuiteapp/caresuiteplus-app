import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo, Animated, Easing, Image, ImageBackground, Modal, Platform,
  Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View,
  type ImageSourcePropType,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { PortalTextSizeControls } from '@/components/portal/accessibility/PortalTextSizeControls';
import { TopbarProfileAvatar } from '@/components/layout/TopbarProfileAvatar';

type WidgetDefinition = { id: string; label: string; route: string; image: ImageSourcePropType };
type WeatherLocation = { mode: 'auto' | 'manual' | 'fallback'; label: string; latitude: number; longitude: number };
type LocationSearchResult = { id: number; name: string; admin1?: string; country?: string; latitude: number; longitude: number };

const BACKGROUND = require('../../../assets/healthos/caresuite-alien-planet-no-logo.png');
const BRAND = require('../../../assets/healthos/caresuite-healthos-logo.png');
const LOCATION_STORAGE_KEY = 'caresuite.healthos.weather-location.v1';
const DOCK_NATIVE_DRIVER = Platform.OS !== 'web';

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
  return new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(value);
}

function weatherGlyph(code: number) {
  if (code === 0) return '☀';
  if ([1, 2, 3, 45, 48].includes(code)) return '☁';
  if (code >= 71 && code <= 75) return '❄';
  if (code >= 95) return '⚡';
  return '☂';
}

function locationLabel(address: Location.LocationGeocodedAddress | undefined) {
  return address?.city || address?.district || address?.subregion || address?.region || 'Aktueller Standort';
}

function DockWidget({ widget, index, compact, reducedMotion, onOpen }: {
  widget: WidgetDefinition; index: number; compact: boolean; reducedMotion: boolean; onOpen: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const entrance = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const float = useRef(new Animated.Value(0)).current;
  const interaction = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reducedMotion) { entrance.setValue(1); float.setValue(0); return; }
    const enter = Animated.timing(entrance, { toValue: 1, delay: 80 + index * 85, duration: 460, easing: Easing.out(Easing.cubic), useNativeDriver: DOCK_NATIVE_DRIVER });
    const floating = Animated.loop(Animated.sequence([
      Animated.timing(float, { toValue: 1, duration: 2500 + index * 170, easing: Easing.inOut(Easing.sin), useNativeDriver: DOCK_NATIVE_DRIVER }),
      Animated.timing(float, { toValue: 0, duration: 2500 + index * 170, easing: Easing.inOut(Easing.sin), useNativeDriver: DOCK_NATIVE_DRIVER }),
    ]));
    enter.start(); floating.start();
    return () => { enter.stop(); floating.stop(); };
  }, [entrance, float, index, reducedMotion]);

  useEffect(() => {
    Animated.spring(interaction, { toValue: hovered ? 1 : 0, friction: hovered ? 7 : 9, tension: hovered ? 90 : 72, useNativeDriver: DOCK_NATIVE_DRIVER }).start();
  }, [hovered, interaction]);

  const translateY = Animated.add(
    entrance.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }),
    Animated.add(float.interpolate({ inputRange: [0, 1], outputRange: [1, -3] }), interaction.interpolate({ inputRange: [0, 1], outputRange: [0, compact ? -7 : -18] })),
  );

  return (
    <Animated.View style={[styles.widgetMotion, { opacity: entrance, zIndex: hovered ? 20 : 1, transform: [{ translateY }, { scale: interaction.interpolate({ inputRange: [0, 1], outputRange: [1, compact ? 1.035 : 1.105] }) }] }]}>
      <Pressable
        accessibilityRole="button" accessibilityLabel={`${widget.label} öffnen`}
        onHoverIn={() => setHovered(true)} onHoverOut={() => setHovered(false)}
        onFocus={() => setHovered(true)} onBlur={() => setHovered(false)} onPress={onOpen}
        style={({ pressed }) => [styles.widget, hovered && styles.widgetHovered, pressed && styles.widgetPressed]}
      >
        <Animated.View pointerEvents="none" style={[styles.widgetGlow, { opacity: interaction }]} />
        <Animated.View pointerEvents="none" style={[styles.widgetTooltip, { opacity: interaction, transform: [{ translateY: interaction.interpolate({ inputRange: [0, 1], outputRange: [7, 0] }) }] }]}>
          <Text numberOfLines={1} style={styles.widgetTooltipText}>{widget.label}</Text><View style={styles.tooltipArrow} />
        </Animated.View>
        <Image resizeMode="contain" source={widget.image} style={styles.widgetImage} />
      </Pressable>
    </Animated.View>
  );
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
  const [weatherLocation, setWeatherLocation] = useState<WeatherLocation>({ mode: 'fallback', label: 'Berlin', latitude: 52.52, longitude: 13.405 });
  const [locationOpen, setLocationOpen] = useState(false);
  const [locationQuery, setLocationQuery] = useState('');
  const [locationResults, setLocationResults] = useState<LocationSearchResult[]>([]);
  const [locationSearching, setLocationSearching] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [reducedMotion, setReducedMotion] = useState(false);
  const pageMotion = useRef(new Animated.Value(1)).current;
  const auroraMotion = useRef(new Animated.Value(0)).current;

  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => mounted && setReducedMotion(enabled));
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    return () => { mounted = false; subscription.remove(); };
  }, []);
  useEffect(() => {
    if (reducedMotion) { auroraMotion.setValue(0); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(auroraMotion, { toValue: 1, duration: 9000, easing: Easing.inOut(Easing.sin), useNativeDriver: DOCK_NATIVE_DRIVER }),
      Animated.timing(auroraMotion, { toValue: 0, duration: 9000, easing: Easing.inOut(Easing.sin), useNativeDriver: DOCK_NATIVE_DRIVER }),
    ]));
    loop.start(); return () => loop.stop();
  }, [auroraMotion, reducedMotion]);
  useEffect(() => {
    pageMotion.setValue(reducedMotion ? 1 : 0);
    Animated.timing(pageMotion, { toValue: 1, duration: 360, easing: Easing.out(Easing.cubic), useNativeDriver: DOCK_NATIVE_DRIVER }).start();
  }, [page, pageMotion, reducedMotion]);

  const detectAutomaticLocation = useCallback(async () => {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') throw new Error('Standortfreigabe fehlt');
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const addresses = await Location.reverseGeocodeAsync({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      const detected: WeatherLocation = { mode: 'auto', label: locationLabel(addresses[0]), latitude: position.coords.latitude, longitude: position.coords.longitude };
      setWeatherLocation(detected);
      await AsyncStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(detected));
    } catch {
      setWeatherLocation((current) => current.mode === 'manual' ? current : { mode: 'fallback', label: 'Berlin', latitude: 52.52, longitude: 13.405 });
    }
  }, []);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(LOCATION_STORAGE_KEY).then((stored) => {
      if (!active) return;
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as WeatherLocation;
          if (parsed.mode === 'manual' && Number.isFinite(parsed.latitude) && Number.isFinite(parsed.longitude)) { setWeatherLocation(parsed); return; }
        } catch { /* Invalid preference is replaced automatically. */ }
      }
      void detectAutomaticLocation();
    });
    return () => { active = false; };
  }, [detectAutomaticLocation]);

  const loadWeather = useCallback(async () => {
    try {
      const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${weatherLocation.latitude}&longitude=${weatherLocation.longitude}&current=temperature_2m,weather_code&timezone=auto`);
      if (!response.ok) throw new Error('Wetterdienst nicht erreichbar');
      const data = await response.json();
      setTemperature(Math.round(Number(data?.current?.temperature_2m)));
      setWeatherCode(Number(data?.current?.weather_code ?? 0));
    } catch { setTemperature(null); }
  }, [weatherLocation.latitude, weatherLocation.longitude]);

  useEffect(() => { void loadWeather(); const timer = setInterval(() => void loadWeather(), 10 * 60 * 1000); return () => clearInterval(timer); }, [loadWeather]);
  useEffect(() => { setPage((current) => Math.min(current, Math.max(0, pageCount - 1))); }, [pageCount]);

  const visibleWidgets = useMemo(() => WIDGETS.slice(page * pageSize, page * pageSize + pageSize), [page, pageSize]);
  const searchResults = useMemo(() => { const normalized = query.trim().toLocaleLowerCase('de-DE'); return normalized ? WIDGETS.filter((widget) => widget.label.toLocaleLowerCase('de-DE').includes(normalized)) : WIDGETS; }, [query]);
  const profile = auth.profile;
  const displayName = profile?.displayName || auth.user?.displayName || 'Profil';
  const role = profile?.roleKey ?? 'CareSuite';
  const openWidget = (widget: WidgetDefinition) => { setSearchOpen(false); setQuery(''); router.push(widget.route as never); };

  const searchLocations = async () => {
    const value = locationQuery.trim(); if (value.length < 2) return;
    setLocationSearching(true);
    try {
      const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(value)}&count=8&language=de&format=json`);
      const data = await response.json(); setLocationResults(Array.isArray(data?.results) ? data.results : []);
    } catch { setLocationResults([]); } finally { setLocationSearching(false); }
  };
  const chooseManualLocation = async (result: LocationSearchResult) => {
    const selected: WeatherLocation = { mode: 'manual', label: [result.name, result.admin1].filter(Boolean).join(', '), latitude: result.latitude, longitude: result.longitude };
    setWeatherLocation(selected); await AsyncStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(selected));
    setLocationOpen(false); setLocationQuery(''); setLocationResults([]);
  };

  return (
    <ImageBackground source={BACKGROUND} resizeMode="cover" style={styles.background} imageStyle={styles.backgroundImage}>
      <View style={styles.atmosphere} />
      <Animated.View pointerEvents="none" style={[styles.aurora, { opacity: auroraMotion.interpolate({ inputRange: [0, 1], outputRange: [0.08, 0.2] }), transform: [{ translateX: auroraMotion.interpolate({ inputRange: [0, 1], outputRange: [-80, 110] }) }, { scale: auroraMotion.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.08] }) }] }]} />
      <View style={[styles.topLayer, compact && styles.topLayerCompact]}>
        <View style={[styles.identityColumn, compact && styles.identityColumnCompact]}>
          <Image accessibilityLabel="CareSuite HealthOS" resizeMode="contain" source={BRAND} style={[styles.logo, compact && styles.logoCompact]} />
          <View style={[styles.glass, styles.timeWeather, compact && styles.timeWeatherCompact]}>
            <View style={styles.timeBlock}><Text style={[styles.time, compact && styles.timeCompact]}>{now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</Text><Text numberOfLines={1} style={styles.date}>{formatDate(now)}</Text></View>
            <View style={styles.glassDivider} />
            <Pressable accessibilityRole="button" accessibilityLabel="Wetterstandort ändern" onPress={() => setLocationOpen(true)} style={({ pressed }) => [styles.weatherBlock, pressed && styles.controlPressed]}>
              <Text style={styles.weatherIcon}>{weatherGlyph(weatherCode)}</Text><View style={styles.weatherCopy}><Text style={styles.weatherLine}>{temperature === null ? '—°' : `${temperature}°`} <Text style={styles.weatherState}>{WEATHER_LABELS[weatherCode] ?? 'Aktuell'}</Text></Text><Text numberOfLines={1} style={styles.place}>⌖ {weatherLocation.label} · ändern</Text></View>
            </Pressable>
          </View>
        </View>
        <View style={[styles.glass, styles.actions, compact && styles.actionsCompact]}>
          <Pressable accessibilityLabel="Widget suchen" onPress={() => setSearchOpen(true)} style={({ pressed }) => [styles.actionButton, pressed && styles.controlPressed]}><Text style={styles.actionGlyph}>⌕</Text></Pressable>
          {!compact ? <PortalTextSizeControls /> : null}
          <View style={styles.livePill}><View style={styles.liveDot} /><Text style={styles.liveText}>Live</Text></View>
          <Pressable accessibilityLabel="Einstellungen öffnen" onPress={() => router.push('/settings' as never)} style={({ pressed }) => [styles.actionButton, pressed && styles.controlPressed]}><Text style={styles.actionGlyph}>☷</Text></Pressable>
          {!compact ? <View style={styles.profileCopy}><Text numberOfLines={1} style={styles.profileName}>{displayName}</Text><Text numberOfLines={1} style={styles.profileRole}>{role}</Text></View> : null}
          <Pressable accessibilityLabel={`Profil ${displayName} öffnen`} onPress={() => router.push('/settings/profile' as never)}><TopbarProfileAvatar name={displayName} avatarUrl={profile?.avatarUrl?.trim() || undefined} avatarVersion={profile?.updatedAt ?? profile?.avatarUrl} accentColor="#56C7FF" size="lg" /></Pressable>
        </View>
      </View>
      <View style={[styles.dockRegion, compact && styles.dockRegionCompact, height < 720 && styles.dockRegionShort]}>
        <Pressable accessibilityLabel="Vorherige Widget-Seite" disabled={page === 0} onPress={() => setPage((value) => Math.max(0, value - 1))} style={({ pressed }) => [styles.arrow, page === 0 && styles.arrowDisabled, pressed && styles.arrowPressed]}><Text style={styles.arrowText}>‹</Text></Pressable>
        <View style={[styles.glass, styles.dock, compact && styles.dockCompact]}>
          <View pointerEvents="none" style={styles.dockHighlight} />
          <Animated.View style={[styles.widgetRow, { opacity: pageMotion, transform: [{ translateX: pageMotion.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] }]}>
            {visibleWidgets.map((widget, index) => <DockWidget key={`${page}-${widget.id}`} widget={widget} index={index} compact={compact} reducedMotion={reducedMotion} onOpen={() => openWidget(widget)} />)}
          </Animated.View>
          <View style={styles.pageDots}>{Array.from({ length: pageCount }, (_, index) => <Pressable key={index} accessibilityLabel={`Widget-Seite ${index + 1}`} onPress={() => setPage(index)} style={[styles.pageDot, index === page && styles.pageDotActive]} />)}</View>
        </View>
        <Pressable accessibilityLabel="Nächste Widget-Seite" disabled={page >= pageCount - 1} onPress={() => setPage((value) => Math.min(pageCount - 1, value + 1))} style={({ pressed }) => [styles.arrow, page >= pageCount - 1 && styles.arrowDisabled, pressed && styles.arrowPressed]}><Text style={styles.arrowText}>›</Text></Pressable>
      </View>
      <Modal animationType="fade" transparent visible={searchOpen} onRequestClose={() => setSearchOpen(false)}><Pressable onPress={() => setSearchOpen(false)} style={styles.modalBackdrop}><Pressable onPress={(event) => event.stopPropagation()} style={[styles.glass, styles.searchPanel]}><View style={styles.searchHeader}><Text style={styles.searchTitle}>Widgets durchsuchen</Text><Pressable accessibilityLabel="Suche schließen" onPress={() => setSearchOpen(false)} style={styles.closeButton}><Text style={styles.closeText}>×</Text></Pressable></View><TextInput autoFocus placeholder="Funktion suchen …" placeholderTextColor="#90A5BF" value={query} onChangeText={setQuery} style={styles.searchInput} /><ScrollView contentContainerStyle={styles.searchResults} keyboardShouldPersistTaps="handled">{searchResults.map((widget) => <Pressable key={widget.id} onPress={() => openWidget(widget)} style={styles.searchResult}><Image source={widget.image} resizeMode="contain" style={styles.searchThumb} /><Text style={styles.searchResultText}>{widget.label}</Text><Text style={styles.searchChevron}>›</Text></Pressable>)}</ScrollView></Pressable></Pressable></Modal>
      <Modal animationType="fade" transparent visible={locationOpen} onRequestClose={() => setLocationOpen(false)}><Pressable onPress={() => setLocationOpen(false)} style={styles.modalBackdrop}><Pressable onPress={(event) => event.stopPropagation()} style={[styles.glass, styles.locationPanel]}><View style={styles.searchHeader}><View><Text style={styles.searchTitle}>Wetterstandort</Text><Text style={styles.locationSubtitle}>Automatisch ermitteln oder Ort manuell festlegen</Text></View><Pressable accessibilityLabel="Standortdialog schließen" onPress={() => setLocationOpen(false)} style={styles.closeButton}><Text style={styles.closeText}>×</Text></Pressable></View><Pressable onPress={() => { setLocationOpen(false); void detectAutomaticLocation(); }} style={styles.autoLocationButton}><Text style={styles.autoLocationIcon}>⌖</Text><View style={styles.autoLocationCopy}><Text style={styles.autoLocationTitle}>Aktuellen Standort verwenden</Text><Text style={styles.autoLocationDetail}>GPS-/Browserfreigabe und automatische Ortsnamenermittlung</Text></View><Text style={styles.searchChevron}>›</Text></Pressable><View style={styles.locationSearchRow}><TextInput placeholder="Ort oder Postleitzahl eingeben …" placeholderTextColor="#90A5BF" value={locationQuery} onChangeText={setLocationQuery} onSubmitEditing={() => void searchLocations()} style={[styles.searchInput, styles.locationInput]} /><Pressable onPress={() => void searchLocations()} style={styles.locationSearchButton}><Text style={styles.locationSearchButtonText}>{locationSearching ? '…' : 'Suchen'}</Text></Pressable></View><ScrollView contentContainerStyle={styles.searchResults} keyboardShouldPersistTaps="handled">{locationResults.map((result) => <Pressable key={`${result.id}-${result.latitude}-${result.longitude}`} onPress={() => void chooseManualLocation(result)} style={styles.locationResult}><Text style={styles.locationResultTitle}>{result.name}</Text><Text style={styles.locationResultDetail}>{[result.admin1, result.country].filter(Boolean).join(' · ')}</Text></Pressable>)}</ScrollView></Pressable></Pressable></Modal>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, width: '100%', height: '100%', minHeight: '100%', backgroundColor: '#03132B', overflow: 'hidden' }, backgroundImage: { width: '100%', height: '100%' }, atmosphere: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,12,31,0.05)' }, aurora: { position: 'absolute', top: '14%', left: '8%', width: '58%', height: '36%', borderRadius: 999, backgroundColor: '#4FD9FF', shadowColor: '#4FD9FF', shadowOpacity: 0.38, shadowRadius: 90 },
  topLayer: { position: 'absolute', top: 28, left: 32, right: 32, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24 }, topLayerCompact: { top: 16, left: 14, right: 14, gap: 10 }, identityColumn: { width: 440, alignItems: 'flex-start', gap: 10 }, identityColumnCompact: { width: 'auto', flex: 1 }, logo: { width: 370, height: 48 }, logoCompact: { width: 210, height: 30 },
  glass: { backgroundColor: 'rgba(2,15,35,0.72)', borderWidth: 1, borderColor: 'rgba(139,211,255,0.36)', shadowColor: '#2BB8FF', shadowOpacity: 0.23, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, ...(Platform.OS === 'web' ? ({ backdropFilter: 'blur(24px) saturate(1.2)' } as const) : null) },
  timeWeather: { minWidth: 430, minHeight: 86, borderRadius: 28, paddingHorizontal: 22, paddingVertical: 12, flexDirection: 'row', alignItems: 'center' }, timeWeatherCompact: { minWidth: 0, alignSelf: 'stretch', minHeight: 70, paddingHorizontal: 14, borderRadius: 22 }, timeBlock: { flex: 1, minWidth: 0 }, time: { color: '#FFF', fontSize: 36, lineHeight: 39, fontWeight: '900', letterSpacing: -1.4 }, timeCompact: { fontSize: 25, lineHeight: 28 }, date: { color: '#D8EAFF', fontSize: 12, lineHeight: 17, fontWeight: '600' }, glassDivider: { width: 1, height: 48, backgroundColor: 'rgba(149,210,255,0.24)', marginHorizontal: 18 }, weatherBlock: { flex: 1, minWidth: 0, minHeight: 56, borderRadius: 18, paddingHorizontal: 6, flexDirection: 'row', alignItems: 'center', gap: 10 }, weatherCopy: { flex: 1, minWidth: 0 }, weatherIcon: { color: '#8FE4FF', fontSize: 30 }, weatherLine: { color: '#FFF', fontSize: 22, lineHeight: 25, fontWeight: '900' }, weatherState: { fontSize: 13, fontWeight: '800' }, place: { color: '#BCD4EC', fontSize: 11, marginTop: 3 },
  actions: { minHeight: 88, borderRadius: 28, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }, actionsCompact: { minHeight: 60, padding: 7, borderRadius: 22, gap: 6 }, actionButton: { width: 48, height: 48, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(146,205,255,0.28)', backgroundColor: 'rgba(8,29,59,0.62)', alignItems: 'center', justifyContent: 'center' }, actionGlyph: { color: '#FFF', fontSize: 23, fontWeight: '700' }, controlPressed: { opacity: 0.72, transform: [{ scale: 0.97 }] }, livePill: { height: 48, borderRadius: 16, paddingHorizontal: 15, borderWidth: 1, borderColor: 'rgba(70,171,255,0.5)', flexDirection: 'row', alignItems: 'center', gap: 8 }, liveDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#58D8C1', shadowColor: '#58D8C1', shadowOpacity: 0.9, shadowRadius: 8 }, liveText: { color: '#FFF', fontSize: 15, fontWeight: '900' }, profileCopy: { maxWidth: 160, alignItems: 'flex-end', marginLeft: 4 }, profileName: { color: '#FFF', fontSize: 14, fontWeight: '900' }, profileRole: { color: '#AFC7DF', fontSize: 11, marginTop: 2 },
  dockRegion: { position: 'absolute', left: 42, right: 42, bottom: 26, height: 226, flexDirection: 'row', alignItems: 'center', gap: 16 }, dockRegionCompact: { left: 10, right: 10, bottom: 12, height: 196, gap: 7 }, dockRegionShort: { bottom: 8, height: 184 }, dock: { flex: 1, height: '100%', borderRadius: 38, paddingHorizontal: 25, paddingTop: 22, paddingBottom: 10, overflow: 'visible' }, dockCompact: { paddingHorizontal: 10, paddingTop: 15, borderRadius: 27 }, dockHighlight: { position: 'absolute', top: 0, left: 50, right: 50, height: 1, backgroundColor: 'rgba(190,231,255,0.52)' },
  widgetRow: { flex: 1, minHeight: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 13 }, widgetMotion: { flex: 1, minWidth: 0, maxWidth: 315, height: '100%' }, widget: { flex: 1, minWidth: 0, borderRadius: 26, padding: 5, backgroundColor: 'rgba(2,11,27,0.5)', borderWidth: 1, borderColor: 'rgba(133,205,255,0.14)', alignItems: 'center', justifyContent: 'center', overflow: 'visible' }, widgetHovered: { borderColor: 'rgba(111,218,255,0.72)', backgroundColor: 'rgba(6,28,58,0.88)', shadowColor: '#4FD7FF', shadowOpacity: 0.62, shadowRadius: 26, shadowOffset: { width: 0, height: 12 } }, widgetPressed: { opacity: 0.84 }, widgetImage: { width: '100%', height: '100%' }, widgetGlow: { position: 'absolute', top: -4, right: -4, bottom: -4, left: -4, borderRadius: 29, backgroundColor: 'rgba(76,207,255,0.12)', shadowColor: '#54D9FF', shadowOpacity: 0.72, shadowRadius: 30 }, widgetTooltip: { position: 'absolute', top: -42, left: 8, right: 8, minHeight: 33, zIndex: 40, borderRadius: 12, backgroundColor: 'rgba(2,16,36,0.96)', borderWidth: 1, borderColor: 'rgba(113,211,255,0.55)', paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', shadowColor: '#4ACDFF', shadowOpacity: 0.42, shadowRadius: 14 }, widgetTooltipText: { color: '#FFF', fontSize: 13, lineHeight: 17, fontWeight: '900', textAlign: 'center' }, tooltipArrow: { position: 'absolute', bottom: -5, width: 10, height: 10, backgroundColor: 'rgba(2,16,36,0.96)', borderRightWidth: 1, borderBottomWidth: 1, borderColor: 'rgba(113,211,255,0.55)', transform: [{ rotate: '45deg' }] },
  arrow: { width: 58, height: 58, borderRadius: 29, borderWidth: 1, borderColor: 'rgba(142,210,255,0.42)', backgroundColor: 'rgba(3,18,39,0.78)', alignItems: 'center', justifyContent: 'center', shadowColor: '#3AC7FF', shadowOpacity: 0.22, shadowRadius: 16 }, arrowDisabled: { opacity: 0.28 }, arrowPressed: { transform: [{ scale: 0.92 }], borderColor: '#7DDCFF' }, arrowText: { color: '#FFF', fontSize: 45, lineHeight: 48, fontWeight: '300', marginTop: -4 }, pageDots: { height: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 5 }, pageDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(186,219,245,0.32)' }, pageDotActive: { width: 22, backgroundColor: '#68D4FF', shadowColor: '#68D4FF', shadowOpacity: 0.8, shadowRadius: 7 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,5,16,0.72)', alignItems: 'center', justifyContent: 'center', padding: 18 }, searchPanel: { width: '100%', maxWidth: 720, maxHeight: '82%', borderRadius: 30, padding: 20 }, searchHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 14 }, searchTitle: { color: '#FFF', fontSize: 23, fontWeight: '900' }, closeButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }, closeText: { color: '#FFF', fontSize: 29, lineHeight: 31 }, searchInput: { minHeight: 52, borderRadius: 17, borderWidth: 1, borderColor: 'rgba(126,205,255,0.35)', backgroundColor: 'rgba(1,9,24,0.7)', color: '#FFF', fontSize: 16, paddingHorizontal: 17, marginBottom: 12 }, searchResults: { gap: 8, paddingBottom: 4 }, searchResult: { minHeight: 65, borderRadius: 17, backgroundColor: 'rgba(9,30,61,0.75)', borderWidth: 1, borderColor: 'rgba(116,190,242,0.18)', padding: 8, flexDirection: 'row', alignItems: 'center', gap: 12 }, searchThumb: { width: 86, height: 48 }, searchResultText: { flex: 1, color: '#FFF', fontSize: 15, fontWeight: '800' }, searchChevron: { color: '#88DFFF', fontSize: 28 },
  locationPanel: { width: '100%', maxWidth: 690, maxHeight: '78%', borderRadius: 30, padding: 20 }, locationSubtitle: { color: '#AFC7DF', fontSize: 13, marginTop: 4 }, autoLocationButton: { minHeight: 76, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(106,205,255,0.34)', backgroundColor: 'rgba(8,35,69,0.72)', padding: 13, flexDirection: 'row', alignItems: 'center', gap: 13, marginBottom: 13 }, autoLocationIcon: { color: '#76DAFF', fontSize: 29 }, autoLocationCopy: { flex: 1 }, autoLocationTitle: { color: '#FFF', fontSize: 15, fontWeight: '900' }, autoLocationDetail: { color: '#AFC7DF', fontSize: 12, lineHeight: 17, marginTop: 3 }, locationSearchRow: { flexDirection: 'row', alignItems: 'stretch', gap: 9 }, locationInput: { flex: 1, marginBottom: 0 }, locationSearchButton: { minWidth: 96, borderRadius: 17, backgroundColor: '#0B79E8', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 }, locationSearchButtonText: { color: '#FFF', fontSize: 14, fontWeight: '900' }, locationResult: { minHeight: 58, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(114,196,247,0.2)', backgroundColor: 'rgba(8,29,58,0.68)', paddingHorizontal: 15, paddingVertical: 10, justifyContent: 'center' }, locationResultTitle: { color: '#FFF', fontSize: 15, fontWeight: '900' }, locationResultDetail: { color: '#AFC7DF', fontSize: 12, marginTop: 3 },
});
