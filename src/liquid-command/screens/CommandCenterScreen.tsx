import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo, Animated, Easing, Image, ImageBackground, Modal, Platform,
  Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View,
  type ImageSourcePropType, type ViewStyle,
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
type WidgetDragPayload = { widgetId: string; source: 'dock' | 'favorite'; slotIndex?: number };
type WebDragEvent = {
  preventDefault?: () => void;
  stopPropagation?: () => void;
  dataTransfer?: {
    effectAllowed?: string;
    dropEffect?: string;
    setData?: (type: string, value: string) => void;
    getData?: (type: string) => string;
  };
};

const BACKGROUND = require('../../../assets/healthos/caresuite-alien-planet-no-logo.png');
const BRAND = require('../../../assets/healthos/caresuite-healthos-logo.png');
const LOCATION_STORAGE_KEY = 'caresuite.healthos.weather-location.v1';
const DOCK_ORDER_STORAGE_KEY = 'caresuite.healthos.widget-order.v1';
const FAVORITES_STORAGE_KEY = 'caresuite.healthos.top-widgets.v1';
const FAVORITE_SLOT_COUNT = 10;
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

const DEFAULT_WIDGET_ORDER = WIDGETS.map((widget) => widget.id);
const WIDGET_BY_ID = new Map(WIDGETS.map((widget) => [widget.id, widget]));
const WEB_GRAB_STYLE = Platform.OS === 'web' ? ({ cursor: 'grab', userSelect: 'none' } as unknown as ViewStyle) : undefined;

function normalizeWidgetOrder(value: unknown) {
  const supplied = Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string' && WIDGET_BY_ID.has(id)) : [];
  return [...new Set([...supplied, ...DEFAULT_WIDGET_ORDER])];
}

function normalizeFavoriteSlots(value: unknown) {
  const slots = Array<unknown>(FAVORITE_SLOT_COUNT).fill(null);
  if (Array.isArray(value)) value.slice(0, FAVORITE_SLOT_COUNT).forEach((item, index) => { slots[index] = item; });
  const seen = new Set<string>();
  return slots.map((item) => {
    if (typeof item !== 'string' || !WIDGET_BY_ID.has(item) || seen.has(item)) return null;
    seen.add(item);
    return item;
  });
}

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

function DockWidget({ widget, index, compact, reducedMotion, dragging, onOpen, onDragStart, onDragEnd, onDragOver, onDrop }: {
  widget: WidgetDefinition;
  index: number;
  compact: boolean;
  reducedMotion: boolean;
  dragging: boolean;
  onOpen: () => void;
  onDragStart: (event: WebDragEvent) => void;
  onDragEnd: () => void;
  onDragOver: (event: WebDragEvent) => void;
  onDrop: (event: WebDragEvent) => void;
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
        {...(Platform.OS === 'web' ? ({ draggable: true, onDragStart, onDragEnd, onDragOver, onDrop } as object) : {})}
        style={({ pressed }) => [styles.widget, WEB_GRAB_STYLE, hovered && styles.widgetHovered, dragging && styles.widgetDragging, pressed && styles.widgetPressed]}
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

function FavoriteWidgetSlot({ slotIndex, widget, compact, dragging, dragOver, onOpen, onRemove, onDragStart, onDragEnd, onDragOver, onDragLeave, onDrop }: {
  slotIndex: number;
  widget: WidgetDefinition | null;
  compact: boolean;
  dragging: boolean;
  dragOver: boolean;
  onOpen: () => void;
  onRemove: () => void;
  onDragStart: (event: WebDragEvent) => void;
  onDragEnd: () => void;
  onDragOver: (event: WebDragEvent) => void;
  onDragLeave: () => void;
  onDrop: (event: WebDragEvent) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const webDropProps = Platform.OS === 'web'
    ? ({ draggable: Boolean(widget), onDragStart, onDragEnd, onDragOver, onDragLeave, onDrop } as object)
    : {};

  return (
    <Pressable
      accessibilityRole={widget ? 'button' : undefined}
      accessibilityLabel={widget ? `${widget.label} aus Top 10 öffnen` : `Freier Top-10-Platz ${slotIndex + 1}`}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onPress={widget ? onOpen : undefined}
      {...webDropProps}
      style={({ pressed }) => [
        styles.favoriteSlot,
        compact && styles.favoriteSlotCompact,
        widget && styles.favoriteSlotFilled,
        WEB_GRAB_STYLE,
        dragOver && styles.favoriteSlotDropTarget,
        dragging && styles.favoriteSlotDragging,
        pressed && widget && styles.widgetPressed,
      ]}
    >
      {widget ? (
        <>
          <Image resizeMode="contain" source={widget.image} style={styles.favoriteImage} />
          <View pointerEvents="none" style={[styles.favoriteTooltip, hovered && styles.favoriteTooltipVisible]}><Text numberOfLines={1} style={styles.favoriteTooltipText}>{widget.label}</Text></View>
          <Pressable accessibilityLabel={`${widget.label} aus Top 10 entfernen`} onPress={(event) => { event.stopPropagation(); onRemove(); }} style={styles.favoriteRemove}><Text style={styles.favoriteRemoveText}>×</Text></Pressable>
        </>
      ) : (
        <View pointerEvents="none" style={styles.favoriteEmpty}><Text style={styles.favoriteEmptyPlus}>＋</Text><Text style={styles.favoriteEmptyText}>{slotIndex + 1}</Text></View>
      )}
    </Pressable>
  );
}

export function CommandCenterScreen() {
  const router = useRouter();
  const auth = useAuth();
  const { width, height } = useWindowDimensions();
  const compact = width < 780;
  const pageSize = compact ? 2 : width < 1180 ? 3 : 5;
  const preferenceOwner = auth.user?.id ?? 'local';
  const dockOrderStorageKey = `${DOCK_ORDER_STORAGE_KEY}.${preferenceOwner}`;
  const favoritesStorageKey = `${FAVORITES_STORAGE_KEY}.${preferenceOwner}`;
  const [page, setPage] = useState(0);
  const [widgetOrder, setWidgetOrder] = useState<string[]>(DEFAULT_WIDGET_ORDER);
  const [favoriteSlots, setFavoriteSlots] = useState<(string | null)[]>(() => Array(FAVORITE_SLOT_COUNT).fill(null));
  const [preferencesOwnerLoaded, setPreferencesOwnerLoaded] = useState<string | null>(null);
  const [dragPayload, setDragPayload] = useState<WidgetDragPayload | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);
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
  const auroraX = useRef(new Animated.Value(0)).current;
  const auroraY = useRef(new Animated.Value(0)).current;
  const auroraPulse = useRef(new Animated.Value(0)).current;
  const dragPayloadRef = useRef<WidgetDragPayload | null>(null);
  const suppressOpenUntil = useRef(0);
  const auroraWidth = Math.min(Math.max(width * 0.36, 340), 760);
  const auroraHeight = Math.min(Math.max(height * 0.34, 220), 440);
  const auroraMaxX = Math.max(0, width - auroraWidth);
  const auroraMaxY = Math.max(0, height - auroraHeight);

  const orderedWidgets = useMemo(() => widgetOrder.map((id) => WIDGET_BY_ID.get(id)).filter((widget): widget is WidgetDefinition => Boolean(widget)), [widgetOrder]);
  const pageCount = Math.ceil(orderedWidgets.length / pageSize);
  const dockHeight = height < 720 ? 184 : compact ? 196 : 226;
  const dockBottom = height < 720 ? 8 : compact ? 12 : 26;
  const dockTop = height - dockBottom - dockHeight;
  const favoritesWidth = Math.min(width - (compact ? 24 : 190), compact ? 720 : 980);
  const favoritesHeight = compact ? 142 : Math.min(238, Math.max(188, height * 0.23));
  const favoritesMinimumTop = compact ? 112 : 218;
  const favoritesMaximumTop = Math.max(favoritesMinimumTop, dockTop - favoritesHeight - 18);
  const favoritesTop = Math.min(favoritesMaximumTop, Math.max(favoritesMinimumTop, favoritesMinimumTop + (favoritesMaximumTop - favoritesMinimumTop) * 0.48));

  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    let active = true;
    setPreferencesOwnerLoaded(null);
    void Promise.all([AsyncStorage.getItem(dockOrderStorageKey), AsyncStorage.getItem(favoritesStorageKey)]).then(([storedOrder, storedFavorites]) => {
      if (!active) return;
      try { setWidgetOrder(normalizeWidgetOrder(storedOrder ? JSON.parse(storedOrder) : null)); } catch { setWidgetOrder(DEFAULT_WIDGET_ORDER); }
      try { setFavoriteSlots(normalizeFavoriteSlots(storedFavorites ? JSON.parse(storedFavorites) : null)); } catch { setFavoriteSlots(Array(FAVORITE_SLOT_COUNT).fill(null)); }
      setPreferencesOwnerLoaded(preferenceOwner);
    }).catch(() => { if (active) setPreferencesOwnerLoaded(preferenceOwner); });
    return () => { active = false; };
  }, [dockOrderStorageKey, favoritesStorageKey, preferenceOwner]);
  useEffect(() => { if (preferencesOwnerLoaded === preferenceOwner) void AsyncStorage.setItem(dockOrderStorageKey, JSON.stringify(widgetOrder)); }, [dockOrderStorageKey, preferenceOwner, preferencesOwnerLoaded, widgetOrder]);
  useEffect(() => { if (preferencesOwnerLoaded === preferenceOwner) void AsyncStorage.setItem(favoritesStorageKey, JSON.stringify(favoriteSlots)); }, [favoriteSlots, favoritesStorageKey, preferenceOwner, preferencesOwnerLoaded]);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => mounted && setReducedMotion(enabled));
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    return () => { mounted = false; subscription.remove(); };
  }, []);
  useEffect(() => {
    auroraX.stopAnimation();
    auroraY.stopAnimation();
    auroraPulse.stopAnimation();

    if (reducedMotion) {
      auroraX.setValue(auroraMaxX * 0.5);
      auroraY.setValue(auroraMaxY * 0.42);
      auroraPulse.setValue(0.45);
      return;
    }

    auroraX.setValue(auroraMaxX * 0.04);
    auroraY.setValue(auroraMaxY * 0.18);
    auroraPulse.setValue(0);

    // Independent axis loops create a true screen-wide ping-pong path: each
    // axis reverses as soon as its own viewport edge is reached.
    const horizontalLoop = Animated.loop(Animated.sequence([
      Animated.timing(auroraX, {
        toValue: auroraMaxX,
        duration: Math.max(12_000, Math.round(auroraMaxX * 21)),
        easing: Easing.linear,
        useNativeDriver: DOCK_NATIVE_DRIVER,
      }),
      Animated.timing(auroraX, {
        toValue: 0,
        duration: Math.max(12_000, Math.round(auroraMaxX * 21)),
        easing: Easing.linear,
        useNativeDriver: DOCK_NATIVE_DRIVER,
      }),
    ]));
    const verticalLoop = Animated.loop(Animated.sequence([
      Animated.timing(auroraY, {
        toValue: auroraMaxY,
        duration: Math.max(10_000, Math.round(auroraMaxY * 25)),
        easing: Easing.linear,
        useNativeDriver: DOCK_NATIVE_DRIVER,
      }),
      Animated.timing(auroraY, {
        toValue: 0,
        duration: Math.max(10_000, Math.round(auroraMaxY * 25)),
        easing: Easing.linear,
        useNativeDriver: DOCK_NATIVE_DRIVER,
      }),
    ]));
    const pulseLoop = Animated.loop(Animated.sequence([
      Animated.timing(auroraPulse, { toValue: 1, duration: 5200, easing: Easing.inOut(Easing.sin), useNativeDriver: DOCK_NATIVE_DRIVER }),
      Animated.timing(auroraPulse, { toValue: 0, duration: 5200, easing: Easing.inOut(Easing.sin), useNativeDriver: DOCK_NATIVE_DRIVER }),
    ]));

    horizontalLoop.start();
    verticalLoop.start();
    pulseLoop.start();
    return () => {
      horizontalLoop.stop();
      verticalLoop.stop();
      pulseLoop.stop();
    };
  }, [auroraMaxX, auroraMaxY, auroraPulse, auroraX, auroraY, reducedMotion]);
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

  const visibleWidgets = useMemo(() => orderedWidgets.slice(page * pageSize, page * pageSize + pageSize), [orderedWidgets, page, pageSize]);
  const searchResults = useMemo(() => { const normalized = query.trim().toLocaleLowerCase('de-DE'); return normalized ? orderedWidgets.filter((widget) => widget.label.toLocaleLowerCase('de-DE').includes(normalized)) : orderedWidgets; }, [orderedWidgets, query]);
  const profile = auth.profile;
  const displayName = profile?.displayName || auth.user?.displayName || 'Profil';
  const role = profile?.roleKey ?? 'CareSuite';
  const openWidget = (widget: WidgetDefinition) => {
    if (Date.now() < suppressOpenUntil.current) return;
    setSearchOpen(false); setQuery(''); router.push(widget.route as never);
  };

  const readDragPayload = (event: WebDragEvent) => {
    if (dragPayloadRef.current) return dragPayloadRef.current;
    try {
      const serialized = event.dataTransfer?.getData?.('application/x-caresuite-widget');
      if (!serialized) return null;
      const parsed = JSON.parse(serialized) as WidgetDragPayload;
      return WIDGET_BY_ID.has(parsed.widgetId) ? parsed : null;
    } catch { return null; }
  };
  const beginDrag = (payload: WidgetDragPayload, event: WebDragEvent) => {
    dragPayloadRef.current = payload;
    setDragPayload(payload);
    suppressOpenUntil.current = Date.now() + 500;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData?.('application/x-caresuite-widget', JSON.stringify(payload));
      event.dataTransfer.setData?.('text/plain', payload.widgetId);
    }
  };
  const finishDrag = () => {
    suppressOpenUntil.current = Date.now() + 350;
    dragPayloadRef.current = null;
    setDragPayload(null);
    setDragOverSlot(null);
  };
  const allowDrop = (event: WebDragEvent) => {
    event.preventDefault?.();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  };
  const dropOnDockWidget = (targetWidgetId: string, event: WebDragEvent) => {
    event.preventDefault?.(); event.stopPropagation?.();
    const payload = readDragPayload(event);
    if (payload?.source === 'dock' && payload.widgetId !== targetWidgetId) {
      setWidgetOrder((current) => {
        const sourceIndex = current.indexOf(payload.widgetId);
        const targetIndex = current.indexOf(targetWidgetId);
        if (sourceIndex < 0 || targetIndex < 0) return current;
        const next = [...current];
        next.splice(sourceIndex, 1);
        next.splice(targetIndex, 0, payload.widgetId);
        return next;
      });
    }
    finishDrag();
  };
  const dropOnFavoriteSlot = (targetSlot: number, event: WebDragEvent) => {
    event.preventDefault?.(); event.stopPropagation?.();
    const payload = readDragPayload(event);
    if (!payload) { finishDrag(); return; }
    setFavoriteSlots((current) => {
      const next = [...current];
      const existingSlot = next.indexOf(payload.widgetId);
      if (existingSlot === targetSlot) return current;
      if (existingSlot >= 0) {
        const targetWidget = next[targetSlot];
        next[targetSlot] = payload.widgetId;
        next[existingSlot] = targetWidget;
      } else {
        next[targetSlot] = payload.widgetId;
      }
      return next;
    });
    finishDrag();
  };
  const removeFavorite = (slotIndex: number) => setFavoriteSlots((current) => current.map((widgetId, index) => index === slotIndex ? null : widgetId));
  const switchPageWhileDragging = (direction: -1 | 1, event: WebDragEvent) => {
    if (!readDragPayload(event)) return;
    allowDrop(event);
    setPage((current) => Math.max(0, Math.min(pageCount - 1, current + direction)));
  };

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
      <Animated.View
        pointerEvents="none"
        testID="healthos-ping-pong-aurora"
        style={[
          styles.aurora,
          {
            width: auroraWidth,
            height: auroraHeight,
            opacity: auroraPulse.interpolate({ inputRange: [0, 1], outputRange: [0.075, 0.145] }),
            transform: [{ translateX: auroraX }, { translateY: auroraY }],
          },
        ]}
      />
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
      <View style={[styles.favoritesRegion, { top: favoritesTop, left: (width - favoritesWidth) / 2, width: favoritesWidth, height: favoritesHeight }]}>
        <View style={[styles.glass, styles.favoritesPanel, compact && styles.favoritesPanelCompact]}>
          <View pointerEvents="none" style={styles.favoritesHighlight} />
          <View style={styles.favoritesHeader}><Text style={styles.favoritesTitle}>TOP 10</Text><Text numberOfLines={1} style={styles.favoritesHint}>Widgets aus dem Dock hierher ziehen</Text></View>
          <View style={styles.favoritesGrid}>
            {favoriteSlots.map((widgetId, slotIndex) => {
              const widget = widgetId ? WIDGET_BY_ID.get(widgetId) ?? null : null;
              return <FavoriteWidgetSlot key={slotIndex} slotIndex={slotIndex} widget={widget} compact={compact} dragging={Boolean(widget && dragPayload?.widgetId === widget.id)} dragOver={dragOverSlot === slotIndex} onOpen={() => widget && openWidget(widget)} onRemove={() => removeFavorite(slotIndex)} onDragStart={(event) => widget && beginDrag({ widgetId: widget.id, source: 'favorite', slotIndex }, event)} onDragEnd={finishDrag} onDragOver={(event) => { allowDrop(event); setDragOverSlot(slotIndex); }} onDragLeave={() => setDragOverSlot((current) => current === slotIndex ? null : current)} onDrop={(event) => dropOnFavoriteSlot(slotIndex, event)} />;
            })}
          </View>
        </View>
      </View>
      <View style={[styles.dockRegion, compact && styles.dockRegionCompact, height < 720 && styles.dockRegionShort]}>
        <Pressable accessibilityLabel="Vorherige Widget-Seite" disabled={page === 0} onPress={() => setPage((value) => Math.max(0, value - 1))} {...(Platform.OS === 'web' ? ({ onDragEnter: (event: WebDragEvent) => switchPageWhileDragging(-1, event), onDragOver: allowDrop } as object) : {})} style={({ pressed }) => [styles.arrow, page === 0 && styles.arrowDisabled, pressed && styles.arrowPressed]}><Text style={styles.arrowText}>‹</Text></Pressable>
        <View style={[styles.glass, styles.dock, compact && styles.dockCompact]}>
          <View pointerEvents="none" style={styles.dockHighlight} />
          <Animated.View style={[styles.widgetRow, { opacity: pageMotion, transform: [{ translateX: pageMotion.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] }]}>
            {visibleWidgets.map((widget, index) => <DockWidget key={widget.id} widget={widget} index={index} compact={compact} reducedMotion={reducedMotion} dragging={dragPayload?.source === 'dock' && dragPayload.widgetId === widget.id} onOpen={() => openWidget(widget)} onDragStart={(event) => beginDrag({ widgetId: widget.id, source: 'dock' }, event)} onDragEnd={finishDrag} onDragOver={allowDrop} onDrop={(event) => dropOnDockWidget(widget.id, event)} />)}
          </Animated.View>
          <View style={styles.pageDots}>{Array.from({ length: pageCount }, (_, index) => <Pressable key={index} accessibilityLabel={`Widget-Seite ${index + 1}`} onPress={() => setPage(index)} style={[styles.pageDot, index === page && styles.pageDotActive]} />)}</View>
        </View>
        <Pressable accessibilityLabel="Nächste Widget-Seite" disabled={page >= pageCount - 1} onPress={() => setPage((value) => Math.min(pageCount - 1, value + 1))} {...(Platform.OS === 'web' ? ({ onDragEnter: (event: WebDragEvent) => switchPageWhileDragging(1, event), onDragOver: allowDrop } as object) : {})} style={({ pressed }) => [styles.arrow, page >= pageCount - 1 && styles.arrowDisabled, pressed && styles.arrowPressed]}><Text style={styles.arrowText}>›</Text></Pressable>
      </View>
      <Modal animationType="fade" transparent visible={searchOpen} onRequestClose={() => setSearchOpen(false)}><Pressable onPress={() => setSearchOpen(false)} style={styles.modalBackdrop}><Pressable onPress={(event) => event.stopPropagation()} style={[styles.glass, styles.searchPanel]}><View style={styles.searchHeader}><Text style={styles.searchTitle}>Widgets durchsuchen</Text><Pressable accessibilityLabel="Suche schließen" onPress={() => setSearchOpen(false)} style={styles.closeButton}><Text style={styles.closeText}>×</Text></Pressable></View><TextInput autoFocus placeholder="Funktion suchen …" placeholderTextColor="#90A5BF" value={query} onChangeText={setQuery} style={styles.searchInput} /><ScrollView contentContainerStyle={styles.searchResults} keyboardShouldPersistTaps="handled">{searchResults.map((widget) => <Pressable key={widget.id} onPress={() => openWidget(widget)} style={styles.searchResult}><Image source={widget.image} resizeMode="contain" style={styles.searchThumb} /><Text style={styles.searchResultText}>{widget.label}</Text><Text style={styles.searchChevron}>›</Text></Pressable>)}</ScrollView></Pressable></Pressable></Modal>
      <Modal animationType="fade" transparent visible={locationOpen} onRequestClose={() => setLocationOpen(false)}><Pressable onPress={() => setLocationOpen(false)} style={styles.modalBackdrop}><Pressable onPress={(event) => event.stopPropagation()} style={[styles.glass, styles.locationPanel]}><View style={styles.searchHeader}><View><Text style={styles.searchTitle}>Wetterstandort</Text><Text style={styles.locationSubtitle}>Automatisch ermitteln oder Ort manuell festlegen</Text></View><Pressable accessibilityLabel="Standortdialog schließen" onPress={() => setLocationOpen(false)} style={styles.closeButton}><Text style={styles.closeText}>×</Text></Pressable></View><Pressable onPress={() => { setLocationOpen(false); void detectAutomaticLocation(); }} style={styles.autoLocationButton}><Text style={styles.autoLocationIcon}>⌖</Text><View style={styles.autoLocationCopy}><Text style={styles.autoLocationTitle}>Aktuellen Standort verwenden</Text><Text style={styles.autoLocationDetail}>GPS-/Browserfreigabe und automatische Ortsnamenermittlung</Text></View><Text style={styles.searchChevron}>›</Text></Pressable><View style={styles.locationSearchRow}><TextInput placeholder="Ort oder Postleitzahl eingeben …" placeholderTextColor="#90A5BF" value={locationQuery} onChangeText={setLocationQuery} onSubmitEditing={() => void searchLocations()} style={[styles.searchInput, styles.locationInput]} /><Pressable onPress={() => void searchLocations()} style={styles.locationSearchButton}><Text style={styles.locationSearchButtonText}>{locationSearching ? '…' : 'Suchen'}</Text></Pressable></View><ScrollView contentContainerStyle={styles.searchResults} keyboardShouldPersistTaps="handled">{locationResults.map((result) => <Pressable key={`${result.id}-${result.latitude}-${result.longitude}`} onPress={() => void chooseManualLocation(result)} style={styles.locationResult}><Text style={styles.locationResultTitle}>{result.name}</Text><Text style={styles.locationResultDetail}>{[result.admin1, result.country].filter(Boolean).join(' · ')}</Text></Pressable>)}</ScrollView></Pressable></Pressable></Modal>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, width: '100%', height: '100%', minHeight: '100%', backgroundColor: '#03132B', overflow: 'hidden' }, backgroundImage: { width: '100%', height: '100%' }, atmosphere: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,12,31,0.05)' }, aurora: { position: 'absolute', top: 0, left: 0, borderRadius: 999, backgroundColor: '#4FD9FF', shadowColor: '#4FD9FF', shadowOpacity: 0.32, shadowRadius: 90 },
  topLayer: { position: 'absolute', top: 28, left: 32, right: 32, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24 }, topLayerCompact: { top: 16, left: 14, right: 14, gap: 10 }, identityColumn: { width: 440, alignItems: 'flex-start', gap: 10 }, identityColumnCompact: { width: 'auto', flex: 1 }, logo: { width: 370, height: 48 }, logoCompact: { width: 210, height: 30 },
  glass: { backgroundColor: 'rgba(2,15,35,0.72)', borderWidth: 1, borderColor: 'rgba(139,211,255,0.36)', shadowColor: '#2BB8FF', shadowOpacity: 0.23, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, ...(Platform.OS === 'web' ? ({ backdropFilter: 'blur(24px) saturate(1.2)' } as const) : null) },
  timeWeather: { minWidth: 430, minHeight: 86, borderRadius: 28, paddingHorizontal: 22, paddingVertical: 12, flexDirection: 'row', alignItems: 'center' }, timeWeatherCompact: { minWidth: 0, alignSelf: 'stretch', minHeight: 70, paddingHorizontal: 14, borderRadius: 22 }, timeBlock: { flex: 1, minWidth: 0 }, time: { color: '#FFF', fontSize: 36, lineHeight: 39, fontWeight: '900', letterSpacing: -1.4 }, timeCompact: { fontSize: 25, lineHeight: 28 }, date: { color: '#D8EAFF', fontSize: 12, lineHeight: 17, fontWeight: '600' }, glassDivider: { width: 1, height: 48, backgroundColor: 'rgba(149,210,255,0.24)', marginHorizontal: 18 }, weatherBlock: { flex: 1, minWidth: 0, minHeight: 56, borderRadius: 18, paddingHorizontal: 6, flexDirection: 'row', alignItems: 'center', gap: 10 }, weatherCopy: { flex: 1, minWidth: 0 }, weatherIcon: { color: '#8FE4FF', fontSize: 30 }, weatherLine: { color: '#FFF', fontSize: 22, lineHeight: 25, fontWeight: '900' }, weatherState: { fontSize: 13, fontWeight: '800' }, place: { color: '#BCD4EC', fontSize: 11, marginTop: 3 },
  actions: { minHeight: 88, borderRadius: 28, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }, actionsCompact: { minHeight: 60, padding: 7, borderRadius: 22, gap: 6 }, actionButton: { width: 48, height: 48, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(146,205,255,0.28)', backgroundColor: 'rgba(8,29,59,0.62)', alignItems: 'center', justifyContent: 'center' }, actionGlyph: { color: '#FFF', fontSize: 23, fontWeight: '700' }, controlPressed: { opacity: 0.72, transform: [{ scale: 0.97 }] }, livePill: { height: 48, borderRadius: 16, paddingHorizontal: 15, borderWidth: 1, borderColor: 'rgba(70,171,255,0.5)', flexDirection: 'row', alignItems: 'center', gap: 8 }, liveDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#58D8C1', shadowColor: '#58D8C1', shadowOpacity: 0.9, shadowRadius: 8 }, liveText: { color: '#FFF', fontSize: 15, fontWeight: '900' }, profileCopy: { maxWidth: 160, alignItems: 'flex-end', marginLeft: 4 }, profileName: { color: '#FFF', fontSize: 14, fontWeight: '900' }, profileRole: { color: '#AFC7DF', fontSize: 11, marginTop: 2 },
  favoritesRegion: { position: 'absolute', zIndex: 4 }, favoritesPanel: { flex: 1, borderRadius: 30, paddingHorizontal: 15, paddingTop: 10, paddingBottom: 13, backgroundColor: 'rgba(2,15,35,0.52)', overflow: 'visible' }, favoritesPanelCompact: { borderRadius: 22, paddingHorizontal: 8, paddingTop: 6, paddingBottom: 8 }, favoritesHighlight: { position: 'absolute', top: 0, left: 42, right: 42, height: 1, backgroundColor: 'rgba(190,231,255,0.48)' }, favoritesHeader: { height: 25, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, gap: 12 }, favoritesTitle: { color: '#92E5FF', fontSize: 11, fontWeight: '900', letterSpacing: 1.5 }, favoritesHint: { flex: 1, color: 'rgba(211,235,255,0.7)', fontSize: 10, textAlign: 'right' }, favoritesGrid: { flex: 1, minHeight: 0, flexDirection: 'row', flexWrap: 'wrap', alignContent: 'space-between', justifyContent: 'space-between' }, favoriteSlot: { width: '19%', height: '46%', minWidth: 0, borderRadius: 15, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(139,211,255,0.25)', backgroundColor: 'rgba(2,12,29,0.34)', alignItems: 'center', justifyContent: 'center', overflow: 'visible' }, favoriteSlotCompact: { borderRadius: 10 }, favoriteSlotFilled: { borderStyle: 'solid', borderColor: 'rgba(130,214,255,0.3)', backgroundColor: 'rgba(2,11,27,0.7)' }, favoriteSlotDropTarget: { borderStyle: 'solid', borderColor: '#6FE0FF', backgroundColor: 'rgba(34,151,210,0.3)', shadowColor: '#5DDCFF', shadowOpacity: 0.8, shadowRadius: 16, transform: [{ scale: 1.035 }] }, favoriteSlotDragging: { opacity: 0.42, borderColor: '#72DEFF' }, favoriteImage: { width: '94%', height: '94%' }, favoriteEmpty: { alignItems: 'center', justifyContent: 'center' }, favoriteEmptyPlus: { color: 'rgba(129,214,255,0.42)', fontSize: 19, lineHeight: 20 }, favoriteEmptyText: { color: 'rgba(186,220,245,0.45)', fontSize: 9, fontWeight: '800' }, favoriteRemove: { position: 'absolute', top: 3, right: 3, width: 19, height: 19, borderRadius: 10, backgroundColor: 'rgba(1,10,24,0.88)', borderWidth: 1, borderColor: 'rgba(139,211,255,0.35)', alignItems: 'center', justifyContent: 'center', zIndex: 9 }, favoriteRemoveText: { color: '#DDF5FF', fontSize: 15, lineHeight: 16, marginTop: -1 }, favoriteTooltip: { position: 'absolute', top: -27, left: 3, right: 3, minHeight: 23, borderRadius: 8, paddingHorizontal: 6, backgroundColor: 'rgba(2,16,36,0.96)', borderWidth: 1, borderColor: 'rgba(113,211,255,0.5)', alignItems: 'center', justifyContent: 'center', opacity: 0, zIndex: 15 }, favoriteTooltipVisible: { opacity: 1 }, favoriteTooltipText: { color: '#FFF', fontSize: 10, fontWeight: '900', textAlign: 'center' },
  dockRegion: { position: 'absolute', left: 42, right: 42, bottom: 26, height: 226, flexDirection: 'row', alignItems: 'center', gap: 16 }, dockRegionCompact: { left: 10, right: 10, bottom: 12, height: 196, gap: 7 }, dockRegionShort: { bottom: 8, height: 184 }, dock: { flex: 1, height: '100%', borderRadius: 38, paddingHorizontal: 25, paddingTop: 22, paddingBottom: 10, overflow: 'visible' }, dockCompact: { paddingHorizontal: 10, paddingTop: 15, borderRadius: 27 }, dockHighlight: { position: 'absolute', top: 0, left: 50, right: 50, height: 1, backgroundColor: 'rgba(190,231,255,0.52)' },
  widgetRow: { flex: 1, minHeight: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 13 }, widgetMotion: { flex: 1, minWidth: 0, maxWidth: 315, height: '100%' }, widget: { flex: 1, minWidth: 0, borderRadius: 26, padding: 5, backgroundColor: 'rgba(2,11,27,0.5)', borderWidth: 1, borderColor: 'rgba(133,205,255,0.14)', alignItems: 'center', justifyContent: 'center', overflow: 'visible' }, widgetHovered: { borderColor: 'rgba(111,218,255,0.72)', backgroundColor: 'rgba(6,28,58,0.88)', shadowColor: '#4FD7FF', shadowOpacity: 0.62, shadowRadius: 26, shadowOffset: { width: 0, height: 12 } }, widgetDragging: { opacity: 0.4, borderColor: '#72DEFF' }, widgetPressed: { opacity: 0.84 }, widgetImage: { width: '100%', height: '100%' }, widgetGlow: { position: 'absolute', top: -4, right: -4, bottom: -4, left: -4, borderRadius: 29, backgroundColor: 'rgba(76,207,255,0.12)', shadowColor: '#54D9FF', shadowOpacity: 0.72, shadowRadius: 30 }, widgetTooltip: { position: 'absolute', top: -42, left: 8, right: 8, minHeight: 33, zIndex: 40, borderRadius: 12, backgroundColor: 'rgba(2,16,36,0.96)', borderWidth: 1, borderColor: 'rgba(113,211,255,0.55)', paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', shadowColor: '#4ACDFF', shadowOpacity: 0.42, shadowRadius: 14 }, widgetTooltipText: { color: '#FFF', fontSize: 13, lineHeight: 17, fontWeight: '900', textAlign: 'center' }, tooltipArrow: { position: 'absolute', bottom: -5, width: 10, height: 10, backgroundColor: 'rgba(2,16,36,0.96)', borderRightWidth: 1, borderBottomWidth: 1, borderColor: 'rgba(113,211,255,0.55)', transform: [{ rotate: '45deg' }] },
  arrow: { width: 58, height: 58, borderRadius: 29, borderWidth: 1, borderColor: 'rgba(142,210,255,0.42)', backgroundColor: 'rgba(3,18,39,0.78)', alignItems: 'center', justifyContent: 'center', shadowColor: '#3AC7FF', shadowOpacity: 0.22, shadowRadius: 16 }, arrowDisabled: { opacity: 0.28 }, arrowPressed: { transform: [{ scale: 0.92 }], borderColor: '#7DDCFF' }, arrowText: { color: '#FFF', fontSize: 45, lineHeight: 48, fontWeight: '300', marginTop: -4 }, pageDots: { height: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 5 }, pageDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(186,219,245,0.32)' }, pageDotActive: { width: 22, backgroundColor: '#68D4FF', shadowColor: '#68D4FF', shadowOpacity: 0.8, shadowRadius: 7 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,5,16,0.72)', alignItems: 'center', justifyContent: 'center', padding: 18 }, searchPanel: { width: '100%', maxWidth: 720, maxHeight: '82%', borderRadius: 30, padding: 20 }, searchHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 14 }, searchTitle: { color: '#FFF', fontSize: 23, fontWeight: '900' }, closeButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }, closeText: { color: '#FFF', fontSize: 29, lineHeight: 31 }, searchInput: { minHeight: 52, borderRadius: 17, borderWidth: 1, borderColor: 'rgba(126,205,255,0.35)', backgroundColor: 'rgba(1,9,24,0.7)', color: '#FFF', fontSize: 16, paddingHorizontal: 17, marginBottom: 12 }, searchResults: { gap: 8, paddingBottom: 4 }, searchResult: { minHeight: 65, borderRadius: 17, backgroundColor: 'rgba(9,30,61,0.75)', borderWidth: 1, borderColor: 'rgba(116,190,242,0.18)', padding: 8, flexDirection: 'row', alignItems: 'center', gap: 12 }, searchThumb: { width: 86, height: 48 }, searchResultText: { flex: 1, color: '#FFF', fontSize: 15, fontWeight: '800' }, searchChevron: { color: '#88DFFF', fontSize: 28 },
  locationPanel: { width: '100%', maxWidth: 690, maxHeight: '78%', borderRadius: 30, padding: 20 }, locationSubtitle: { color: '#AFC7DF', fontSize: 13, marginTop: 4 }, autoLocationButton: { minHeight: 76, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(106,205,255,0.34)', backgroundColor: 'rgba(8,35,69,0.72)', padding: 13, flexDirection: 'row', alignItems: 'center', gap: 13, marginBottom: 13 }, autoLocationIcon: { color: '#76DAFF', fontSize: 29 }, autoLocationCopy: { flex: 1 }, autoLocationTitle: { color: '#FFF', fontSize: 15, fontWeight: '900' }, autoLocationDetail: { color: '#AFC7DF', fontSize: 12, lineHeight: 17, marginTop: 3 }, locationSearchRow: { flexDirection: 'row', alignItems: 'stretch', gap: 9 }, locationInput: { flex: 1, marginBottom: 0 }, locationSearchButton: { minWidth: 96, borderRadius: 17, backgroundColor: '#0B79E8', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 }, locationSearchButtonText: { color: '#FFF', fontSize: 14, fontWeight: '900' }, locationResult: { minHeight: 58, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(114,196,247,0.2)', backgroundColor: 'rgba(8,29,58,0.68)', paddingHorizontal: 15, paddingVertical: 10, justifyContent: 'center' }, locationResultTitle: { color: '#FFF', fontSize: 15, fontWeight: '900' }, locationResultDetail: { color: '#AFC7DF', fontSize: 12, marginTop: 3 },
});
