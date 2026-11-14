import { defaultDesktopWidgetIds, desktopHeaderLayout } from '../navigation/desktopLayoutModel';
import { PortalTextSizeControls } from '@/components/portal/accessibility/PortalTextSizeControls';
import { TopbarProfileAvatar } from '@/components/layout/TopbarProfileAvatar';
import { careSuiteAppFontFamily } from '@/design/tokens/appFontFamily';
import type { PermissionKey } from '@/types/permissions';
import { useEffect, useMemo, useRef, useState, type ComponentProps } from 'react';
import { ActivityIndicator, Animated, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { CareSuiteImage as Image, CareSuiteImageBackground as ImageBackground } from '@/components/images/CareSuiteImage';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createDesktopPreferenceStorage } from '@/lib/preferences/desktopPreferenceStorage';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { usePermissions } from '@/hooks/usePermissions';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import { usePrefersReducedMotion } from '@/hooks/useprefersreducedmotion';
import { useDesktopWeather } from '@/hooks/useDesktopWeather.native';
import { useLocalMinute } from '@/hooks/useLocalMinute';
import { MobileButton, MobileSheet, MobileIconButton, MobileIcon, m } from '@/components/mobile/MobileWorkspace';
import { DESKTOP_AREAS, desktopAreaStorageKey, type DesktopAreaKey } from '../navigation/desktopAreas';
import { DesktopCatalogArtwork } from '../components/DesktopCatalogArtwork';
import { DesktopClockWeather } from '../components/DesktopClockWeather';
import { DesktopToday } from '../components/DesktopToday';
import { buildDesktopAreaNavigation } from '../navigation/moduleDesktopModel';
import { nativeAdministrationRoute } from '../navigation/nativeAdministrationModel';
import { filterDesktopCatalogEntries, desktopCatalogAreaForRoute, isDesktopCatalogRouteAvailableInArea } from '../navigation/appsWidgetsCatalogModel.shared';
import { suggestDesktopWidgets } from '../navigation/desktopWidgetSuggestions';
const ui = { ...m, surface: [m.card, { backgroundColor: 'rgba(2,15,35,0.76)', borderColor: 'rgba(139,211,255,0.3)' }], title: [m.title, { color: '#fff' }], body: [m.body, { color: '#E6F1FA' }], muted: [m.muted, { color: '#AFC9DC' }], label: [m.label, { color: '#E6F1FA' }], row: m.wrap, pressed: { opacity: 0.78 } };
const NativeAction = (props: ComponentProps<typeof MobileButton>) => <MobileButton {...props} dark />;
const NativeWorkspaceDialog = (props: ComponentProps<typeof MobileSheet>) => <MobileSheet {...props} dark />;
import { GoogleWorkspaceWidget } from '@/components/googleWorkspace/GoogleWorkspaceWidget.native';
import { DESKTOP_MODULES, moduleDesktopStorageKey, desktopStorageKey, restoreDesktopWidgetIds, previousDesktopWidgetIds } from '../navigation/moduleDesktopModel';
import { buildDesktopApps, type DesktopApp } from '../navigation/desktopAppCatalogModel';
import { DesktopAppsWidgetsCenter, type DesktopCenterTab as CenterTab } from './DesktopAppsWidgetsCenter.native';
import { nativeDesktopLayout } from '../navigation/nativeDesktopLayout';
import {
  addDesktopPage, addDesktopWidgets, DESKTOP_SLOT_COUNT, desktopPageCount, desktopPageSlots, desktopWidgetIds,
  firstFreeDesktopSlot, moveDesktopWidgetInOrder, placeDesktopWidget, readDesktopSlots, removeDesktopWidget,
  removeEmptyDesktopPage, restoreDesktopSlots, type DesktopSlot,
} from '../navigation/desktopSlots';
import { NATIVE_DESKTOP_SCROLL_PADDING, useNativeDesktopPlacement } from '../components/useNativeDesktopPlacement.native';
import { BRAND, BACKGROUNDS, WIDGETS, DEFAULT_DESKTOP_IDS, WORKFLOWS, type WidgetDefinition } from './administrationDesktopCatalog';
import { DesktopWeatherLocationDialog } from './DesktopWeatherLocationDialog.native';
import type { ProductKey } from '@/types';

const desktopStorage = createDesktopPreferenceStorage(AsyncStorage);

type Preferences = { slots: readonly DesktopSlot[]; background: string; dismissed: string[] };

export function CommandCenterScreen() {
  const auth = useAuth(); const permissions = usePermissions(); const access = useModuleAccess();
  const modules = DESKTOP_MODULES.filter(item => access.hasGate(item.key) && permissions.can(`${item.key}.access` as PermissionKey));
  const identity = JSON.stringify([permissions.tenantId, auth.user?.id]);
  const [selection, setSelection] = useState<{ identity: string; area: DesktopAreaKey } | null>(null);
  const [selectionError, setSelectionError] = useState('');
  const [center, setCenter] = useState<CenterTab | null>(null);
  useEffect(() => setCenter(null), [identity]);
  const areaKey = `caresuite.healthos.active-area.v1.${encodeURIComponent(identity)}`;
  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(areaKey).then(value => {
      if (active) setSelection({ identity, area: DESKTOP_AREAS.find(area => area.key === value)?.key ?? 'office' });
    }).catch(() => { if (active) { setSelection({ identity, area: 'office' }); setSelectionError('Der zuletzt geöffnete Bereich konnte nicht geladen werden.'); } });
    return () => { active = false; };
  }, [areaKey, identity]);
  const selectArea = (area: DesktopAreaKey) => {
    setSelection({ identity, area });
    void AsyncStorage.setItem(areaKey, area).then(() => setSelectionError('')).catch(() => setSelectionError('Die Bereichsauswahl konnte nicht gespeichert werden.'));
  };
  const signature = modules.map(item => item.key).join(',');
  if (!permissions.tenantId || !auth.user?.id || !signature) return <SafeAreaView style={styles.loading}><View style={ui.surface}>
    <Text accessibilityRole="header" style={ui.title}>Keine freigegebenen Arbeitsbereiche</Text>
    <NativeAction label="Abmelden" onPress={() => void auth.signOut()} />
  </View></SafeAreaView>;
  if (selection?.identity !== identity) return <SafeAreaView style={styles.loading}><ActivityIndicator color="#75BEFF" /></SafeAreaView>;
  return <View style={{ flex: 1, backgroundColor: '#071629' }}>{selectionError ? <Text style={styles.notice}>{selectionError}</Text> : null}<NativeModuleDesktop key={`${identity}:${signature}:${selection.area}`} tenantId={permissions.tenantId} availableSignature={signature} selectedArea={selection.area} onSelectArea={selectArea} center={center} onCenterChange={setCenter} /></View>;
}

function NativeModuleDesktop({ tenantId, availableSignature, selectedArea, onSelectArea, center, onCenterChange: setCenter }: { tenantId: string; availableSignature: string; selectedArea: DesktopAreaKey; onSelectArea: (area: DesktopAreaKey) => void; center: CenterTab | null; onCenterChange: (tab: CenterTab | null) => void }) {
  const availableKeys = useMemo(() => availableSignature.split(',') as ProductKey[], [availableSignature]);
  const router = useRouter(); const auth = useAuth(); const { width, height, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const viewportWidth = width - insets.left - insets.right;
  const viewportHeight = height - insets.top - insets.bottom;
  const header = desktopHeaderLayout(viewportWidth, viewportHeight, fontScale);
  const shortViewport = header.short;
  const owner = auth.user!.id; const scope = JSON.stringify([tenantId, owner]);
  const desktopKey = desktopAreaStorageKey(tenantId, owner, selectedArea);
  const dismissedKey = `${desktopKey}.dismissed-suggestions.v1`;
  const combinedKey = desktopStorageKey(tenantId, owner);
  const permissions = usePermissions();
  const areaAllowed = selectedArea === 'settings' || selectedArea === 'premium' || (selectedArea === 'robotics' ? permissions.can('robotics.access' as PermissionKey) : availableKeys.includes(selectedArea as ProductKey));
  const backgroundKey = `caresuite.healthos.native-background.v1.${encodeURIComponent(scope)}`;
  const permissionSignature = (permissions.permissions ?? []).join(',');
  const catalogAccess = useMemo(() => ({ ...permissions, hasModuleGate: (key: ProductKey) => availableKeys.includes(key) }), [permissionSignature, availableSignature, permissions.roleKey]);
  const catalogApps = useMemo(() => areaAllowed ? [...new Map(filterDesktopCatalogEntries(buildDesktopApps(WIDGETS, auth.profile?.roleKey).map(app => ({ ...app, route: nativeAdministrationRoute(app.route) })), 'all', catalogAccess).map(app => [app.route, app])).values()] : [], [auth.profile?.roleKey, areaAllowed, catalogAccess]);
  const apps = useMemo(() => catalogApps.filter(app => isDesktopCatalogRouteAvailableInArea(app.route, selectedArea)), [catalogApps, selectedArea]);
  const widgets = useMemo<WidgetDefinition[]>(() => {
    const existing = areaAllowed ? filterDesktopCatalogEntries(WIDGETS.map(widget => ({ ...widget, route: nativeAdministrationRoute(widget.route) })), 'all', catalogAccess) : [];
    const routes = new Set(existing.map(widget => widget.route));
    return [...existing, ...catalogApps.filter(app => !routes.has(app.route)).map(app => ({ ...app, id: app.desktopWidgetId ?? `area-app:${app.id}` }))];
  }, [catalogApps, areaAllowed, catalogAccess]);
  const widgetById = useMemo(() => new Map(widgets.map(widget => [widget.id, widget])), [widgets]);
  const allowed = useMemo(() => widgets.map(widget => widget.id), [widgets]);
  const ownWidgets = useMemo(() => widgets.filter(widget => desktopCatalogAreaForRoute(widget.route) === selectedArea), [widgets, selectedArea]);
  const migrationAllowed = useMemo(() => ownWidgets.map(widget => widget.id), [ownWidgets]);
  const defaults = useMemo(() => defaultDesktopWidgetIds(ownWidgets, selectedArea, DEFAULT_DESKTOP_IDS, DESKTOP_SLOT_COUNT), [ownWidgets, selectedArea]);
  const [preferences, setPreferences] = useState<Preferences>({ slots: [], background: BACKGROUNDS[0].id, dismissed: [] });
  const [recoverableWidgetIds, setRecoverableWidgetIds] = useState<string[]>([]);
  const current = useRef(preferences); const writes = useRef<Promise<void> | null>(null);
  const [ready, setReady] = useState(false); const [error, setError] = useState(''); const [attempt, setAttempt] = useState(0);
  const [gridHeight, setGridHeight] = useState(0); const [controlsHeight, setControlsHeight] = useState(0);
  const [saving, setSaving] = useState(false); const [edit, setEdit] = useState(false); const [navigationOpen, setNavigationOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [placingId, setPlacingId] = useState<string | null>(null);
  const [placementSlot, setPlacementSlot] = useState<number | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  const tick = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!edit || reducedMotion) return;
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(tick, { toValue: 1, duration: 155, useNativeDriver: true, isInteraction: false }),
      Animated.timing(tick, { toValue: 0, duration: 155, useNativeDriver: true, isInteraction: false }),
    ]));
    animation.start();
    return () => { animation.stop(); tick.setValue(0); };
  }, [edit, reducedMotion, tick]);
  const [areaStripWidth, setAreaStripWidth] = useState(0);
  const [selectedTabBounds, setSelectedTabBounds] = useState<{ x: number; width: number } | null>(null);
  const areaStripRef = useRef<ScrollView>(null);
  const [navQuery, setNavQuery] = useState('');
  const [weatherOpen, setWeatherOpen] = useState(false); const weather = useDesktopWeather(scope);
  const canOpenAssignments = availableKeys.includes('assist') && permissions.can('assist.assignments.view');
  const canReview = availableKeys.includes('assist') && permissions.can('assist.records.view');
  const canReadCalendar = availableKeys.includes('office') && permissions.can('office.appointments.view');
  const employeeId = canOpenAssignments && auth.profile?.tenantId === tenantId ? auth.profile.employeeId ?? undefined : undefined;
  const now = useLocalMinute();
  const ids = useMemo(() => desktopWidgetIds(preferences.slots, allowed), [preferences.slots, allowed]);
  const pages = desktopPageCount(preferences.slots);
  const visiblePage = Math.min(page, pages - 1);
  const pageStart = visiblePage * DESKTOP_SLOT_COUNT;
  const pageSlots = desktopPageSlots(preferences.slots, visiblePage);
  const lastWidget = pageSlots.findLastIndex(id => Boolean(id && widgetById.has(id)));
  const renderedSlots = edit ? pageSlots : pageSlots.slice(0, lastWidget + 1);
  const suggestions = useMemo(() => edit && areaAllowed ? suggestDesktopWidgets(
    widgets.filter(widget => isDesktopCatalogRouteAvailableInArea(widget.route, selectedArea)), ids, selectedArea, desktopCatalogAreaForRoute,
  ) : [], [widgets, ids, selectedArea, areaAllowed, edit]);
  const layout = nativeDesktopLayout(viewportWidth, fontScale);
  const weatherInline = viewportWidth >= 1360 * Math.max(1, fontScale);
  const actionsInline = viewportWidth >= 600 && !header.phone;
  const logoWidth = Math.min(header.wide ? 234 : 182, Math.max(1, (viewportWidth - 2 * layout.framePadding - 88) / 2));
  useEffect(() => { setNavigationOpen(false); }, [layout.sidebar]);
  useEffect(() => {
    if (areaStripWidth && selectedTabBounds) {
      const { x, width } = selectedTabBounds;
      areaStripRef.current?.scrollTo?.({ x: Math.max(0, x + Math.min(width, areaStripWidth) - areaStripWidth), animated: false });
    }
  }, [areaStripWidth, selectedTabBounds]);
  useEffect(() => {
    let active = true; setReady(false); setError('');
    void desktopStorage.read([desktopKey, backgroundKey, `caresuite.healthos.desktop-widgets.v3.${owner}`, `caresuite.healthos.desktop-widgets.v2.${owner}`, `caresuite.healthos.top-widgets.v1.${owner}`, `caresuite.healthos.desktop-background.v1.${owner}`, ...(['office', 'assist'] as ProductKey[]).map(key => moduleDesktopStorageKey(tenantId, owner, key)), combinedKey, dismissedKey]).then(async values => {
      if (!active) return;
      const previousModules = values.slice(6, 8);
      const previous = values[8] !== null ? [values[8]] : previousModules.some(value => value !== null) ? previousModules : [values[2] ?? values[3] ?? values[4]].filter(value => value !== null);
      const savedSlots = readDesktopSlots(values[0]);
      const ids = savedSlots ? desktopWidgetIds(savedSlots, allowed) : restoreDesktopWidgetIds(null, previous, migrationAllowed, defaults);
      if (selectedArea === 'office' && values[0] === null && ids.length > 0 && allowed.includes('document-catalog') && !ids.includes('document-catalog')) ids.unshift('document-catalog');
      setRecoverableWidgetIds(previousDesktopWidgetIds([...previousModules, values[2] ?? values[3] ?? values[4]], allowed));
      const background = values[1] ?? values[5];
      let dismissed: string[] = [];
      if (values[9]) {
        try {
          // Older native clients stored widget IDs; new dismissals use routes.
          const stored: unknown = JSON.parse(values[9]);
          if (Array.isArray(stored)) dismissed = stored.filter((id): id is string => typeof id === 'string');
        } catch { /* Keep recommendations available when old preferences are unreadable. */ }
      }
      const next = { slots: restoreDesktopSlots(savedSlots, ids), dismissed, background: BACKGROUNDS.some(item => item.id === background) ? background! : BACKGROUNDS[0].id };
      if (values[0] === null && previous.some(value => value !== null)) {
        await desktopStorage.write([[desktopKey, JSON.stringify(next.slots)], [backgroundKey, next.background]]);
        if (!active) return;
      }
      current.current = next; setPreferences(next); setReady(true);
    }).catch(() => { if (active) setError('Desktop-Einstellungen konnten nicht geladen werden. Ihre gespeicherte Auswahl bleibt erhalten.'); });
    return () => { active = false; };
  }, [desktopKey, combinedKey, backgroundKey, dismissedKey, owner, tenantId, selectedArea, allowed, migrationAllowed, defaults, attempt]);
  const persist = (next: Preferences) => {
    if (!ready) return;
    current.current = next; setPreferences(next); setSaving(true); setError('');
    const request = desktopStorage.write([[desktopKey, JSON.stringify(next.slots)], [backgroundKey, next.background], [dismissedKey, JSON.stringify(next.dismissed)]]);
    writes.current = request;
    void request.then(() => { if (request === writes.current) setSaving(false); }).catch(() => {
      if (request === writes.current) { setSaving(false); setError('Die Desktop-Auswahl konnte nicht gespeichert werden. Bitte erneut speichern.'); }
    });
  };
  const updateSlots = (slots: readonly DesktopSlot[]) => {
    if (slots !== current.current.slots) persist({ ...current.current, slots });
  };
  const changePage = (next: number) => {
    if (next === visiblePage) return;
    placement.scrollOffset.current = 0;
    placement.scroll.current?.scrollTo({ y: 0, animated: false });
    setPage(next);
  };
  const moveWidget = (id: string, index: number) => {
    if (!edit || !ids.includes(id)) return;
    updateSlots(placeDesktopWidget(current.current.slots, id, pageStart + index));
    setPlacingId(null);
  };
  const placement = useNativeDesktopPlacement(visiblePage, pages, changePage, moveWidget);
  const addWidget = (id: string, slot = firstFreeDesktopSlot(current.current.slots, visiblePage)) => {
    if (!allowed.includes(id) || current.current.slots.includes(id)) return;
    updateSlots(placeDesktopWidget(current.current.slots, id, slot));
    if (edit) changePage(Math.floor(slot / DESKTOP_SLOT_COUNT));
  };
  const toggle = (id: string) => {
    if (!allowed.includes(id)) return;
    if (current.current.slots.includes(id)) updateSlots(removeDesktopWidget(current.current.slots, id));
    else {
      addWidget(id, placementSlot ?? undefined);
      if (placementSlot !== null) closeCenter();
    }
  };
  const open = (app: Pick<DesktopApp, 'route'>) => { setNavigationOpen(false); setCenter(null); setProfileOpen(false); router.push(nativeAdministrationRoute(app.route) as never); };
  const openCenter = (tab: CenterTab, slot: number | null = null) => { setNavigationOpen(false); setPlacementSlot(slot); setCenter(tab); };
  const closeCenter = () => { setPlacementSlot(null); setCenter(null); };
  const selectPosition = (index: number, id?: string) => {
    if (placingId && placingId !== id) moveWidget(placingId, index);
    else if (id) setPlacingId(placingId === id ? null : id);
    else openCenter('widgets', pageStart + index);
  };
  const groups = buildDesktopAreaNavigation(apps, selectedArea, navQuery);

  const gridRows = Math.ceil(DESKTOP_SLOT_COUNT / layout.columns);
  const cardChromeHeight = layout.labelHeight + layout.artworkInset + 2;
  const fittingArtworkHeight = Math.floor((gridHeight - 2 * NATIVE_DESKTOP_SCROLL_PADDING - layout.gap * (gridRows - 1)) / gridRows) - cardChromeHeight;
  const artworkHeight = Math.max(layout.artworkMinHeight, Math.min(fittingArtworkHeight, layout.cardWidth - 2 * layout.artworkInset - 2));
  const cellHeight = cardChromeHeight + artworkHeight;
  const widgetGeometry = { artworkHeight, artworkInset: layout.artworkInset, mobile: layout.mobile, labelHeight: layout.labelHeight };
  const animateWidgets = edit && !reducedMotion && !placement.movingId && !placingId;
  const suggestionsBySlot = new Map<number, WidgetDefinition>();
  if (edit && !placingId && !placement.movingId) {
    let next = 0;
    for (const [index, id] of pageSlots.entries()) {
      if (id && widgetById.has(id)) continue;
      const suggestion = suggestions[next++];
      if (suggestion && !preferences.dismissed.includes(suggestion.id) && !preferences.dismissed.includes(suggestion.route)) {
        suggestionsBySlot.set(index, suggestion);
      }
    }
  }
  const pageArrow = (direction: -1 | 1) => {
    const next = visiblePage + direction;
    const disabled = next < 0 || next >= pages;
    return <Pressable accessibilityRole="button" accessibilityLabel={direction === -1 ? 'Vorherige Desktop-Seite' : 'Nächste Desktop-Seite'}
      disabled={disabled} onPress={() => changePage(next)} style={[styles.pageArrow, { width: layout.rail }, disabled && { opacity: .38 }]}>
      <MobileIcon name={direction === -1 ? 'chevron-left' : 'chevron-right'} size={22} color="#EAF8FF" />
    </Pressable>;
  };
  const selectedBackground = BACKGROUNDS.find(item => item.id === preferences.background) ?? BACKGROUNDS[0];
  const moduleLabel = DESKTOP_AREAS.find(area => area.key === selectedArea)!.label;
  const navigation = <View style={ui.stack}>
    <View style={{ gap: 5 }}><Text style={styles.navigationKicker}>CARESUITE HEALTHOS</Text><Text accessibilityRole="header" style={styles.navigationTitle}>Navigation · {moduleLabel}</Text></View>
    <View style={styles.navigationSearch}><TextInput accessibilityLabel="Seiten suchen" value={navQuery} onChangeText={setNavQuery} autoCorrect={false} placeholder="Seite suchen …" placeholderTextColor="#AFC9DC" style={styles.navigationInput} /></View>
    <NativeAction label="Mein Desktop" selected style={{ backgroundColor: "rgba(13,91,130,0.56)", borderColor: "rgba(104,222,255,0.58)" }} onPress={() => setNavigationOpen(false)} />
    {groups.map(group => <View key={group.title} style={ui.stack}><Text style={styles.group}>{group.title}</Text>{group.items.map(app => <Pressable key={app.route} testID={`native-navigation-${app.id}`} accessibilityRole="button" accessibilityLabel={`${app.label} öffnen${app.group ? ` · ${app.group}` : ''}`} onPress={() => open(app)} style={({ pressed }) => [styles.navItem, pressed && ui.pressed]}><DesktopCatalogArtwork route={app.route} label={app.label} size={34} /><View style={{ flex: 1, minWidth: 0 }}><Text style={styles.navLabel} textBreakStrategy="highQuality" android_hyphenationFrequency="none">{app.label}</Text>{app.group ? <Text style={styles.desktopEyebrow}>{app.group}</Text> : null}</View><MobileIcon name="chevron-right" size={18} color="#8BE8FF" /></Pressable>)}</View>)}
    {!groups.length ? <Text style={ui.muted}>Keine passende Seite gefunden.</Text> : null}
    <NativeAction label="Widgets hinzufügen" onPress={() => openCenter('widgets')} />
    <NativeAction label="Hintergrund ändern" onPress={() => openCenter('backgrounds')} />
    <NativeAction label="Einstellungen" onPress={() => open({ route: '/settings' })} />
    <NativeAction label="Hilfe & Anleitungen" onPress={() => open({ route: '/hilfe' })} />
  </View>;
  if (!ready) return <SafeAreaView style={styles.loading}><View style={ui.surface}><Text style={ui.title}>Desktop wird vorbereitet</Text>{error ? <><Text style={ui.error}>{error}</Text><NativeAction label="Erneut laden" onPress={() => setAttempt(value => value + 1)} /></> : <ActivityIndicator color="#8dc8ff" />}</View></SafeAreaView>;
  const profileName = auth.profile?.displayName || auth.user?.displayName || 'Profil';
  const profileControl = (
    <Pressable accessibilityRole="button" accessibilityLabel="Mein Profil" onPress={() => setProfileOpen(true)} style={styles.profileTrigger}>
      {header.wide ? <View style={styles.profileCopy}><Text numberOfLines={1} style={styles.profileName}>{profileName}</Text><Text numberOfLines={1} style={styles.profileRole}>{permissions.roleLabel ?? 'Verwaltung'}</Text></View> : null}
      <TopbarProfileAvatar name={profileName} avatarUrl={auth.profile?.avatarUrl} avatarVersion={auth.profile?.updatedAt ?? auth.profile?.avatarUrl} accentColor="#56C7FF" size={header.wide ? 'lg' : 'sm'} />
    </Pressable>
  );
  const clockWeather = <DesktopClockWeather now={now} weather={weather} onChoosePlace={() => setWeatherOpen(true)}
    availableWidth={weatherInline ? 500 : viewportWidth - 2 * layout.framePadding - 20} layoutFontScale={fontScale}
    style={weatherInline ? styles.inlineClockWeather : undefined}
    today={now && (canReview || canReadCalendar || employeeId) ? <DesktopToday now={now} owner={owner} tenantId={tenantId}
      roleKey={permissions.roleKey} canReview={canReview} canReadCalendar={canReadCalendar} employeeId={employeeId}
      calendarRoute={canOpenAssignments ? '/assist/calendar' : undefined} canOpenAssignments={canOpenAssignments}
      onOpenRoute={route => open({ route })} /> : undefined} />;
  const headerActions = (
    <View style={[styles.headerActions, actionsInline && styles.headerHalf]} testID="desktop-topbar-actions">
      {!layout.sidebar ? <MobileIconButton label="Navigation" icon="menu" dark onPress={() => setNavigationOpen(true)} /> : null}
      <PortalTextSizeControls compact appearance="desktop-header" />
      {layout.sidebar ? <View style={[styles.livePill, !header.wide && styles.livePillCompact]} accessibilityLabel="Live"><View style={styles.liveDot}/>{header.wide ? <Text style={styles.liveText}>Live</Text> : null}</View> : null}
      <Pressable accessibilityRole="button" accessibilityLabel="Apps und Widgets öffnen" onPress={() => openCenter('apps')} style={[styles.headerControl, !header.wide && styles.headerControlCompact]}>
        <MobileIcon name="grid" size={20} color="#83E8FF" />
        {header.wide ? <Text style={styles.headerControlText}>Apps & Widgets</Text> : null}
      </Pressable>
      <MobileIconButton label="Hilfe & Anleitungen" icon="help-circle" dark onPress={() => open({ route: '/hilfe' })} />
      {actionsInline ? profileControl : null}
    </View>
  );

  return <ImageBackground source={selectedBackground.image} resizeMode="cover" style={styles.root} testID="native-administration-desktop">
    <NativeDesktopFrame compact={shortViewport} padding={layout.framePadding}>
      <View style={styles.header} testID="desktop-full-width-header">
        <View style={styles.headerRow}>
          <View style={styles.brandGroup} testID="desktop-header-brand">
            {logoWidth < 140 ? <View accessible accessibilityLabel="CareSuite HealthOS">
              <Text allowFontScaling={false} style={styles.brandName}>CareSuite</Text>
              <Text allowFontScaling={false} style={[styles.brandName, styles.brandAccent]}>HealthOS</Text>
            </View> : <Image source={BRAND} accessibilityLabel="CareSuite HealthOS" style={{ width: logoWidth, height: logoWidth / 8 }} resizeMode="contain" />}
            {weatherInline ? clockWeather : null}
          </View>
          <View testID="native-neo-header-dock" pointerEvents="none" style={styles.assistantDock} />
          {actionsInline ? headerActions : <View style={styles.headerProfile}>{profileControl}</View>}
        </View>
        {!weatherInline ? clockWeather : null}
        {!actionsInline ? headerActions : null}
      </View>
      <View style={[styles.workarea, { gap: layout.workareaGap }, shortViewport && { flex: 0, height: Math.max(360, controlsHeight + 220), minHeight: Math.max(360, controlsHeight + 220) }]}>
        {layout.sidebar ? <ScrollView keyboardShouldPersistTaps="handled" style={[styles.sidebar, { width: layout.sidebarWidth }]} contentContainerStyle={{ padding: 12, gap: 14 }}>{navigation}</ScrollView> : null}
        <View style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
          <View testID="desktop-workspace-header" onLayout={event => { const value = Math.ceil(event.nativeEvent.layout.height); setControlsHeight(current => current === value ? current : value); }} style={styles.desktopToolbar}>
            <View style={styles.desktopTitleRow}>
              <Text accessibilityRole="header" style={[styles.desktopTitle, header.phone && styles.desktopTitlePhone]}>Mein Desktop · {moduleLabel}</Text>
              <View style={styles.desktopActions}>
                <View style={styles.livePill}><View style={styles.liveDot}/><Text style={styles.countText}>{ids.length}{!layout.mobile && pages === 1 ? `/${DESKTOP_SLOT_COUNT}` : ''} aktiv</Text></View>
                <Pressable accessibilityRole="button" accessibilityLabel={edit ? 'Bearbeitung beenden' : 'Desktop bearbeiten'} accessibilityState={{ selected: edit }} disabled={!areaAllowed} onPress={() => { setPlacingId(null); setEdit(!edit); }} style={[styles.headerControl, edit && styles.editingControl]}>
                  <MobileIcon name={edit ? 'check' : 'edit-3'} color="#EAF8FF" size={16}/><Text style={styles.editText}>{edit ? 'Fertig' : 'Bearbeiten'}</Text>
                </Pressable>
              </View>
            </View>
            <ScrollView ref={areaStripRef} horizontal showsHorizontalScrollIndicator accessibilityRole="tablist" accessibilityLabel="Desktop-Bereiche"
              onLayout={event => setAreaStripWidth(event.nativeEvent.layout.width)} style={styles.moduleBar} contentContainerStyle={styles.moduleContent}>
              {DESKTOP_AREAS.map(area => {
                const selected = area.key === selectedArea;
                return <Pressable key={area.key} accessibilityRole="tab" accessibilityLabel={area.label} accessibilityState={{ selected }}
                  onLayout={selected ? event => {
                    const { x, width } = event.nativeEvent.layout;
                    setSelectedTabBounds(previous => previous?.x === x && previous.width === width ? previous : { x, width });
                  } : undefined}
                  onPress={() => { if (!selected) onSelectArea(area.key); }} style={[styles.areaTab, selected && styles.areaTabActive]}>
                  <Text style={styles.areaText}>{area.label}</Text>
                </Pressable>;
              })}
            </ScrollView>
          </View>
          {error ? <View style={ui.surface}><Text accessibilityRole="alert" style={ui.error}>{error}</Text><NativeAction label="Erneut speichern" onPress={() => persist(current.current)} /></View> : null}
          {saving ? <Text accessibilityLiveRegion="polite" style={styles.desktopEyebrow}>Auswahl wird gespeichert …</Text> : null}
          {!areaAllowed ? <Text accessibilityRole="alert" style={styles.notice}>Dieser Arbeitsbereich ist für Ihren Zugang derzeit nicht freigegeben.</Text> : null}
          <View style={[styles.pageFrame, pages === 1 && { paddingHorizontal: layout.padding }]}>
            {pages > 1 ? pageArrow(-1) : null}
            <View ref={placement.viewport} collapsable={false} {...(edit ? placement.handlers : {})} onTouchEnd={placement.clearPending} onTouchCancel={placement.clearPending}
              onLayout={event => setGridHeight(Math.floor(event.nativeEvent.layout.height))} style={styles.placementViewport}>
              <ScrollView ref={placement.scroll} testID="native-desktop-widget-viewport" style={{ flex: 1, minHeight: 0 }} keyboardShouldPersistTaps="handled"
                scrollEnabled={!placement.movingId} showsVerticalScrollIndicator contentContainerStyle={{ paddingVertical: NATIVE_DESKTOP_SCROLL_PADDING }}
                onContentSizeChange={(_width, height) => { placement.contentHeight.current = height; }}
                onScroll={event => { placement.scrollOffset.current = event.nativeEvent.contentOffset.y; }} scrollEventThrottle={16}>
                <View style={[ui.row, { alignItems: 'stretch', gap: layout.gap }]}>
                  {renderedSlots.map((id, index) => {
                    const widget = id ? widgetById.get(id) : undefined;
                    const suggestion = suggestionsBySlot.get(index);
                    const canPlace = placingId !== null || placement.movingId !== null;
                    return <View key={index} testID={`native-desktop-slot-${index + 1}`}
                      onLayout={edit ? event => { placement.cells.current.set(index, event.nativeEvent.layout); } : undefined}
                      style={[{ width: layout.cardWidth, minHeight: cellHeight }, placement.drag?.slot === index && styles.dropTarget]}>
                      {widget && edit ? <Animated.View style={[
                        styles.widget, styles.editWidget,
                        animateWidgets && { transform: [{ rotate: tick.interpolate({ inputRange: [0, 1], outputRange: index % 2 ? ['.5deg', '-.5deg'] : ['-.5deg', '.5deg'] }) }] },
                        placement.movingId === widget.id && { opacity: .4 },
                      ]}>
                        <NativeWidget widget={widget} {...widgetGeometry} editing />
                        <View style={styles.nativeDragHandle} onTouchStart={() => placement.prepare(widget.id)}>
                          <Pressable accessibilityRole="button" accessibilityState={{ selected: placingId === widget.id }}
                            accessibilityLabel={placingId && placingId !== widget.id ? `Mit ${widget.label} tauschen` : `${widget.label} verschieben`}
                            onPress={() => selectPosition(index, widget.id)} style={[styles.widgetAction, placingId === widget.id && styles.editingControl]}>
                            <MobileIcon name="move" color="#E6F5FE" size={17} />
                          </Pressable>
                        </View>
                        <Pressable accessibilityRole="button" accessibilityLabel={`${widget.label} vom Desktop entfernen`}
                          onPress={() => { if (placingId === widget.id) setPlacingId(null); toggle(widget.id); }}
                          style={[styles.widgetAction, styles.nativeRemove, { top: layout.labelHeight + 4 }]}><MobileIcon name="x" color="#FFDEE4" size={17} /></Pressable>
                      </Animated.View>
                      : widget ? <View style={styles.widget}>
                        {widget.workspaceService ? <Pressable accessibilityRole="button" accessibilityLabel={`${widget.label} öffnen`} onPress={() => open(widget)} style={{ flex: 1 }}><GoogleWorkspaceWidget service={widget.workspaceService} /></Pressable>
                          : <NativeWidget widget={widget} {...widgetGeometry} onOpen={() => open(widget)} />}
                      </View>
                      : suggestion ? <View style={[styles.widget, styles.suggestionCard]}>
                        <NativeWidget widget={suggestion} {...widgetGeometry} onOpen={() => addWidget(suggestion.id, pageStart + index)} suggestion />
                        <Pressable accessibilityRole="button" accessibilityLabel={`${suggestion.label} als Vorschlag ausblenden`}
                          onPress={() => persist({ ...current.current, dismissed: [...new Set([...current.current.dismissed, suggestion.route])] })}
                          style={[styles.dismissSuggestion, { top: layout.labelHeight + 4 }]}><MobileIcon name="x" color="#D6E9FF" size={18} /></Pressable>
                      </View>
                      : edit ? <Pressable accessibilityRole="button" accessibilityLabel={placingId ? `Auf Platz ${index + 1} ablegen` : 'Widget hinzufügen'}
                        accessibilityHint={placingId ? undefined : `Platz ${index + 1}`} onPress={() => selectPosition(index)} style={styles.emptyWidget}>
                        <Text style={styles.emptyPlus}>{canPlace ? '⊕' : '＋'}</Text>
                        <Text style={styles.emptyTitle}>{canPlace ? 'Hier ablegen' : 'Hinzufügen'}</Text>
                      </Pressable> : null}
                    </View>;
                  })}
                </View>
              </ScrollView>
              {placement.drag ? <View pointerEvents="none" style={[styles.dragPreview, {
                left: Math.min(Math.max(0, layout.cardWidth * layout.columns + (layout.columns - 1) * layout.gap - 150), Math.max(0, placement.drag.x - 75)),
                top: Math.max(0, placement.drag.y - 52),
              }]}><Text style={styles.editText}>{widgetById.get(placement.drag.id)?.label}</Text></View> : null}
            </View>
            {pages > 1 ? pageArrow(1) : null}
          </View>
          {edit || pages > 1 ? <View style={styles.pageBar}>
            <Text accessibilityLiveRegion="polite" style={styles.pageCount}>Seite {visiblePage + 1} von {pages}</Text>
            {edit ? <>
              <Pressable accessibilityRole="button" onPress={() => { updateSlots(addDesktopPage(current.current.slots)); changePage(pages); }}
                style={styles.pageAction}><Text style={styles.editText}>＋ Seite hinzufügen</Text></Pressable>
              {pages > 1 && !pageSlots.some(Boolean) ? <Pressable accessibilityRole="button" onPress={() => {
                updateSlots(removeEmptyDesktopPage(current.current.slots, visiblePage));
                changePage(Math.min(visiblePage, pages - 2));
              }} style={styles.pageAction}><Text style={styles.editText}>Leere Seite entfernen</Text></Pressable> : null}
              <Text style={styles.pageCount}>{placingId ? 'Zielplatz wählen' : 'Kacheln ziehen oder antippen'}</Text>
            </> : null}
          </View> : null}
        </View>
      </View>
    </NativeDesktopFrame>
    <NativeWorkspaceDialog visible={navigationOpen} title="Navigation" onClose={() => setNavigationOpen(false)}>{navigation}</NativeWorkspaceDialog>
    <DesktopAppsWidgetsCenter visible={center !== null} onClose={closeCenter} areaLabel={moduleLabel}
      selectedArea={selectedArea} areas={DESKTOP_AREAS.map(area => ({ key: area.key, label: area.label,
        disabled: area.key === 'settings' || area.key === 'premium' ? false : area.key === 'robotics' ? !permissions.can('robotics.access' as PermissionKey) : !availableKeys.includes(area.key as ProductKey) }))}
      onSelectArea={onSelectArea} initialTab={center ?? 'apps'} onTabChange={setCenter}
      apps={catalogApps} widgets={widgets} workflows={WORKFLOWS.filter(item => areaAllowed && apps.some(app => app.route === nativeAdministrationRoute(item.route))).map(item => ({ ...item, route: nativeAdministrationRoute(item.route) }))}
      backgrounds={BACKGROUNDS} desktopIds={ids} desktopSlots={preferences.slots} placementSlot={placementSlot} backgroundId={preferences.background}
      recoverableCount={recoverableWidgetIds.filter(id => !ids.includes(id)).length}
      onRecover={() => updateSlots(addDesktopWidgets(current.current.slots, recoverableWidgetIds, visiblePage))}
      onOpen={route => open({ route })} onToggleWidget={toggle}
      onMoveWidget={(id, direction) => updateSlots(moveDesktopWidgetInOrder(current.current.slots, ids, id, direction))}
      onBackground={background => persist({ ...current.current, background })}
      saveStatus={error ? 'error' : saving ? 'saving' : 'saved'} onRetrySave={() => persist(current.current)} />
    <NativeWorkspaceDialog visible={profileOpen} title="Mein Profil" onClose={() => setProfileOpen(false)}>
      <Text style={ui.title}>{auth.profile?.displayName || auth.user?.displayName}</Text><Text style={ui.body}>{auth.user?.email}</Text><Text style={ui.muted}>{permissions.roleLabel ?? 'Verwaltung'}</Text>
      <NativeAction label="Kontoeinstellungen" onPress={() => open({ route: '/settings/profile' })} /><NativeAction label="Hilfe & Anleitungen" onPress={() => open({ route: '/hilfe' })} /><NativeAction label="Abmelden" onPress={() => { setProfileOpen(false); void auth.signOut(); }} />
    </NativeWorkspaceDialog>
    <DesktopWeatherLocationDialog visible={weatherOpen} place={weather.place} preferenceError={weather.preferenceError}
      onChoose={weather.choosePlace} onRetryWeather={weather.status === 'error' ? weather.refresh : undefined} onClose={() => setWeatherOpen(false)} />
  </ImageBackground>;
}

function NativeDesktopFrame({ compact, padding, children }: { compact: boolean; padding: number; children: import('react').ReactNode }) {
  return <SafeAreaView style={{ flex: 1, minHeight: 0 }}>{compact ? <ScrollView style={{ flex: 1, minHeight: 0 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, padding, gap: 12 }}>{children}</ScrollView> : <View style={[styles.safe, { padding }]}>{children}</View>}</SafeAreaView>;
}

function moduleLabelForArea(area: DesktopAreaKey) { return DESKTOP_AREAS.find(item => item.key === area)!.label; }

function NativeWidget({ widget, onOpen, suggestion, artworkHeight, artworkInset, mobile, labelHeight, editing }: {
  widget: WidgetDefinition; onOpen?: () => void; suggestion?: boolean; artworkHeight: number; artworkInset: number; mobile: boolean; labelHeight: number; editing?: boolean;
}) {
  const body = <>
    <View style={[styles.widgetLabelBar, { minHeight: labelHeight }, mobile && { paddingVertical: 6, paddingHorizontal: 10, gap: 6 }]}><Text style={[styles.widgetTitle, mobile && { fontSize: 16, lineHeight: 21 }]}>{widget.label}</Text>{!suggestion && !editing ? <MobileIcon name="arrow-up-right" color="#77DFFF" size={16} /> : null}</View>
    <View style={[styles.artworkStage, { minHeight: artworkHeight, marginHorizontal: artworkInset, marginBottom: artworkInset }]}>
      <DesktopCatalogArtwork route={widget.route} label={widget.label} images={widget.images} style={StyleSheet.absoluteFill} />
    </View>
    {suggestion ? <View style={styles.suggestionBadge}><MobileIcon name="plus" color="#CDE9FF" size={14} /><Text style={styles.suggestionText}>Übernehmen</Text></View> : null}
  </>;
  if (editing) return <View style={styles.widgetBody}>{body}</View>;
  return <Pressable accessibilityRole="button" accessibilityLabel={suggestion ? `${widget.label} zum Desktop hinzufügen` : `${widget.label} öffnen`} onPress={onOpen} style={({ pressed }) => [styles.widgetBody, pressed && { opacity: 0.8, transform: [{ scale: 0.988 }] }]}>{body}</Pressable>;
}

const styles = StyleSheet.create({
  navigationKicker: { color: '#78E5FF', fontFamily: careSuiteAppFontFamily, fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 1 }, navigationTitle: { color: '#FFF', fontFamily: careSuiteAppFontFamily, fontSize: 18, lineHeight: 24, fontWeight: '700' }, navigationSearch: { borderWidth: 1, borderColor: 'rgba(126,205,255,0.3)', borderRadius: 12, paddingHorizontal: 10, backgroundColor: 'rgba(1,11,28,0.7)' }, navigationInput: { minHeight: 44, color: '#EAF6FF', fontFamily: careSuiteAppFontFamily, fontSize: 14 },
  emptyWidget: { flex: 1, borderRadius: 18, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(126,208,244,0.25)', backgroundColor: 'rgba(4,23,44,0.34)', alignItems: 'center', justifyContent: 'center' }, emptyPlus: { color: '#78E4FF', fontSize: 24 }, emptyTitle: { color: '#E9F8FF', fontFamily: careSuiteAppFontFamily, fontSize: 13, fontWeight: '700' },
  header: { padding: 9, gap: 6, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(139,211,255,0.3)', backgroundColor: 'rgba(2,15,35,0.76)' },
  headerRow: { flexDirection: 'row', alignItems: 'center', minHeight: 74, gap: 6 },
  headerHalf: { flex: 1, minWidth: 0 },
  brandGroup: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandName: { color: '#FFF', fontFamily: careSuiteAppFontFamily, fontSize: 17, lineHeight: 20, fontWeight: '700' },
  brandAccent: { color: '#8FE4FF' },
  assistantDock: { width: 68, height: 74, flexShrink: 0, alignSelf: 'flex-start' },
  headerProfile: { flex: 1, minWidth: 0, alignItems: 'flex-end' },
  inlineClockWeather: { flex: 1 },
  headerActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: 6, minWidth: 0 },
  headerControl: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 13, borderWidth: 1, borderColor: 'rgba(126,214,255,0.28)', backgroundColor: 'rgba(7,36,67,0.7)', paddingHorizontal: 11, paddingVertical: 8 },
  headerControlCompact: { minWidth: 44, paddingHorizontal: 0 },
  headerControlText: { color: '#F3FCFF', fontFamily: careSuiteAppFontFamily, fontSize: 16, fontWeight: '700' },
  livePill: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, borderRadius: 13, borderWidth: 1, borderColor: 'rgba(105,207,242,0.22)' },
  livePillCompact: { minHeight: 44, paddingHorizontal: 9 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#58D8C1' },
  liveText: { color: '#CEE6F3', fontFamily: careSuiteAppFontFamily, fontSize: 16, fontWeight: '700' },
  countText: { color: '#CEE6F3', fontFamily: careSuiteAppFontFamily, fontSize: 12, fontWeight: '700' },
  profileTrigger: { minHeight: 44, minWidth: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 3 },
  profileCopy: { maxWidth: 160, alignItems: 'flex-end' },
  profileName: { color: '#FFF', fontFamily: careSuiteAppFontFamily, fontSize: 16, fontWeight: '700' },
  profileRole: { color: '#BFD8EE', fontFamily: careSuiteAppFontFamily, fontSize: 13 },
  desktopToolbar: { gap: 6, paddingHorizontal: 2 },
  desktopTitleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  desktopTitle: { color: '#F7FCFF', fontFamily: careSuiteAppFontFamily, fontSize: 22, lineHeight: 28, fontWeight: '700', flexShrink: 1, minWidth: 0 },
  desktopTitlePhone: { fontSize: 19, lineHeight: 24 },
  desktopActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, alignItems: 'center', minWidth: 0 },
  editText: { color: '#EAF8FF', fontFamily: careSuiteAppFontFamily, fontSize: 13, fontWeight: '700' },
  editingControl: { backgroundColor: 'rgba(24,107,91,0.68)' },
  navLabel: { color: '#E6F1FA', fontFamily: careSuiteAppFontFamily, fontSize: 13, lineHeight: 19, fontWeight: '700' },
  widgetLabelBar: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
  artworkStage: { flexGrow: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  root: { flex: 1, backgroundColor: '#071629' }, safe: { flex: 1, padding: 12, gap: 16, backgroundColor: 'rgba(0,10,27,0.2)' },
  loading: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#071629' },
  moduleBar: { flexGrow: 0, flexShrink: 0 },
  moduleContent: { flexDirection: 'row', gap: 6, paddingBottom: 4 },
  areaTab: { minHeight: 44, flexShrink: 0, paddingVertical: 8, paddingHorizontal: 13, borderRadius: 12, justifyContent: 'center', backgroundColor: '#0B223D', borderWidth: 1, borderColor: '#466887' },
  areaTabActive: { backgroundColor: '#075577', borderColor: '#62DCFF' },
  areaText: { color: '#F0F7FF', fontFamily: careSuiteAppFontFamily, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  workarea: { flex: 1, minHeight: 0, flexDirection: 'row', gap: 16 }, sidebar: { flexGrow: 0, flexShrink: 0, backgroundColor: 'rgba(2,15,35,0.76)', borderWidth: 1, borderColor: 'rgba(139,211,255,0.3)', borderRadius: 28 }, navItem: { minHeight: 48, flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 7, gap: 8, borderRadius: 14 }, group: { color: '#7699B0', fontFamily: careSuiteAppFontFamily, fontSize: 13, lineHeight: 18, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  desktopEyebrow: { color: '#BDD4F0', fontFamily: careSuiteAppFontFamily, fontSize: 12, lineHeight: 19 },
  widget: { flex: 1, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(131,203,245,0.22)', backgroundColor: 'rgba(1,12,29,0.78)', overflow: 'hidden', shadowColor: '#00132B', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 3 }, widgetBody: { flex: 1 }, widgetTitle: { color: '#F1F8FF', fontFamily: careSuiteAppFontFamily, fontSize: 18, lineHeight: 24, fontWeight: '700', flex: 1, minWidth: 0 }, widgetImage: { width: '100%', aspectRatio: 1.6 }, widgetFallback: { alignItems: 'center', justifyContent: 'center', minHeight: 72 },
  suggestions: { gap: 12 }, suggestionCard: { borderStyle: 'dashed', borderColor: 'rgba(177,221,255,0.5)', backgroundColor: 'rgba(16,49,88,0.65)' }, dismissSuggestion: { position: 'absolute', right: 0, top: 0, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, suggestionBadge: { position: 'absolute', left: 8, right: 8, bottom: 8, paddingVertical: 5, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: 'rgba(7,28,58,0.88)' }, suggestionText: { color: '#DDEFFF', fontFamily: careSuiteAppFontFamily, fontSize: 11, lineHeight: 16 },
  pageFrame: { flex: 1, minHeight: 0, flexDirection: 'row', gap: 3 },
  placementViewport: { flex: 1, minWidth: 0, minHeight: 0 },
  pageArrow: { alignSelf: 'center', minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(140,216,255,.42)', backgroundColor: 'rgba(5,25,48,.88)' },
  pageBar: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 5, paddingTop: 4 },
  pageCount: { color: '#EAF8FF', fontFamily: careSuiteAppFontFamily, fontSize: 12, backgroundColor: 'rgba(5,25,48,.88)', padding: 7, borderRadius: 9 },
  pageAction: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 8, borderRadius: 9, backgroundColor: '#0B344F' },
  editWidget: { borderColor: 'rgba(96,225,194,.46)', backgroundColor: 'rgba(4,35,45,.82)' },
  dropTarget: { borderRadius: 18, outlineColor: '#9AF5D6', outlineWidth: 2, backgroundColor: 'rgba(25,104,93,.38)' },
  nativeDragHandle: { position: 'absolute', right: 4, bottom: 4 },
  nativeRemove: { position: 'absolute', right: 4, top: 4, backgroundColor: '#4E2537' },
  widgetAction: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: '#0B344F' },
  dragPreview: { position: 'absolute', maxWidth: 150, borderWidth: 1, borderColor: '#87E6EE', borderRadius: 10, padding: 8, backgroundColor: '#103A55', zIndex: 10 },
  dock: { flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 5, backgroundColor: 'rgba(5,19,40,0.94)', borderTopWidth: 1, borderColor: 'rgba(156,208,255,0.24)' }, dockItem: { flex: 1, paddingVertical: 9, minHeight: 58, alignItems: 'center', justifyContent: 'center', gap: 5 }, dockText: { maxWidth: '100%', textAlign: 'center', flexShrink: 1, color: '#DCEBFF', fontFamily: careSuiteAppFontFamily, fontSize: 11, lineHeight: 16 }, notice: { color: '#FFD5DA', fontFamily: careSuiteAppFontFamily, fontSize: 13, padding: 8 },
});
