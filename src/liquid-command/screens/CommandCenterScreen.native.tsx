import { careSuiteAppFontFamily } from '@/design/tokens/appFontFamily';
import type { PermissionKey } from '@/types/permissions';
import { useEffect, useMemo, useRef, useState, type ComponentProps } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { CareSuiteImage as Image, CareSuiteImageBackground as ImageBackground } from '@/components/images/CareSuiteImage';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { usePermissions } from '@/hooks/usePermissions';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import { useDesktopWeather } from '@/hooks/useDesktopWeather.native';
import { MobileButton, MobileField, MobileSheet, MobileIconButton, MobileIcon, m } from '@/components/mobile/MobileWorkspace';
import { DESKTOP_AREAS, desktopAreaStorageKey, type DesktopAreaKey } from '../navigation/desktopAreas';
import { DesktopCatalogArtwork } from '../components/DesktopCatalogArtwork';
import { buildDesktopAreaNavigation } from '../navigation/moduleDesktopModel';
import { nativeAdministrationRoute } from '../navigation/nativeAdministrationModel';
import { filterDesktopCatalogEntries, desktopCatalogAreaForRoute } from '../navigation/appsWidgetsCatalogModel.shared';
import { suggestDesktopWidgets } from '../navigation/desktopWidgetSuggestions';
const ui = { ...m, surface: [m.card, { backgroundColor: 'rgba(2,15,35,0.76)', borderColor: 'rgba(139,211,255,0.3)' }], title: [m.title, { color: '#fff' }], body: [m.body, { color: '#E6F1FA' }], muted: [m.muted, { color: '#AFC9DC' }], label: [m.label, { color: '#E6F1FA' }], row: m.wrap, pressed: { opacity: 0.78 } };
const NativeAction = (props: ComponentProps<typeof MobileButton>) => <MobileButton {...props} dark />;
const NativeField = (props: ComponentProps<typeof MobileField>) => <MobileField {...props} dark />;
const NativeWorkspaceDialog = (props: ComponentProps<typeof MobileSheet>) => <MobileSheet {...props} dark />;
import { GoogleWorkspaceWidget } from '@/components/googleWorkspace/GoogleWorkspaceWidget.native';
import { DESKTOP_MODULES, moduleDesktopStorageKey, desktopStorageKey, restoreDesktopWidgetIds, previousDesktopWidgetIds } from '../navigation/moduleDesktopModel';
import { buildDesktopApps, DESKTOP_CATEGORIES, type DesktopApp } from '../navigation/desktopAppCatalogModel';
import { nativeDesktopLayout, moveNativeDesktopWidget } from '../navigation/nativeDesktopLayout';
import { BRAND, BACKGROUNDS, WIDGETS, DEFAULT_DESKTOP_IDS, WORKFLOWS, type WidgetDefinition } from './administrationDesktopCatalog';
import { DesktopWeatherLocationDialog } from './DesktopWeatherLocationDialog.native';
import type { ProductKey } from '@/types';

type CenterTab = 'apps' | 'widgets' | 'workflows' | 'backgrounds';
type Preferences = { ids: string[]; background: string; dismissed: string[] };

export function CommandCenterScreen() {
  const auth = useAuth(); const permissions = usePermissions(); const access = useModuleAccess();
  const modules = DESKTOP_MODULES.filter(item => access.hasGate(item.key) && permissions.can(`${item.key}.access` as PermissionKey));
  const identity = JSON.stringify([permissions.tenantId, auth.user?.id]);
  const [selection, setSelection] = useState<{ identity: string; area: DesktopAreaKey } | null>(null);
  const [selectionError, setSelectionError] = useState('');
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
  return <View style={{ flex: 1, backgroundColor: '#071629' }}>{selectionError ? <Text style={styles.notice}>{selectionError}</Text> : null}<NativeModuleDesktop key={`${identity}:${signature}:${selection.area}`} tenantId={permissions.tenantId} availableSignature={signature} selectedArea={selection.area} onSelectArea={selectArea} /></View>;
}

function NativeModuleDesktop({ tenantId, availableSignature, selectedArea, onSelectArea }: { tenantId: string; availableSignature: string; selectedArea: DesktopAreaKey; onSelectArea: (area: DesktopAreaKey) => void }) {
  const availableKeys = useMemo(() => availableSignature.split(',') as ProductKey[], [availableSignature]);
  const router = useRouter(); const auth = useAuth(); const { width, height, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const compactHeight = height - insets.top - insets.bottom < 500 && width > height && fontScale < 1.4;
  const layout = nativeDesktopLayout(width - insets.left - insets.right, fontScale);
  const owner = auth.user!.id; const scope = JSON.stringify([tenantId, owner]);
  const desktopKey = desktopAreaStorageKey(tenantId, owner, selectedArea);
  const dismissedKey = `${desktopKey}.dismissed-suggestions.v1`;
  const combinedKey = desktopStorageKey(tenantId, owner);
  const permissions = usePermissions();
  const areaAllowed = selectedArea === 'settings' || selectedArea === 'premium' || (selectedArea === 'robotics' ? permissions.can('robotics.access' as PermissionKey) : availableKeys.includes(selectedArea as ProductKey));
  const backgroundKey = `caresuite.healthos.native-background.v1.${encodeURIComponent(scope)}`;
  const permissionSignature = (permissions.permissions ?? []).join(',');
  const catalogAccess = useMemo(() => ({ ...permissions, hasModuleGate: (key: ProductKey) => availableKeys.includes(key) }), [permissionSignature, availableSignature, permissions.roleKey]);
  const apps = useMemo(() => areaAllowed ? [...new Map(filterDesktopCatalogEntries(buildDesktopApps(WIDGETS, auth.profile?.roleKey).map(app => ({ ...app, route: nativeAdministrationRoute(app.route) })), selectedArea, catalogAccess).map(app => [app.route, app])).values()] : [], [auth.profile?.roleKey, areaAllowed, selectedArea, catalogAccess]);
  const widgets = useMemo<WidgetDefinition[]>(() => {
    const existing = areaAllowed ? filterDesktopCatalogEntries(WIDGETS.map(widget => ({ ...widget, route: nativeAdministrationRoute(widget.route) })), selectedArea, catalogAccess) : [];
    const routes = new Set(existing.map(widget => widget.route));
    return [...existing, ...apps.filter(app => !routes.has(app.route)).map(app => ({ ...app, id: `area-app:${app.id}` }))];
  }, [apps, areaAllowed, selectedArea, catalogAccess]);
  const widgetById = useMemo(() => new Map(widgets.map(widget => [widget.id, widget])), [widgets]);
  const allowed = useMemo(() => widgets.map(widget => widget.id), [widgets]);
  const ownWidgets = useMemo(() => widgets.filter(widget => desktopCatalogAreaForRoute(widget.route) === selectedArea), [widgets, selectedArea]);
  const migrationAllowed = useMemo(() => ownWidgets.map(widget => widget.id), [ownWidgets]);
  const defaults = useMemo(() => ownWidgets.filter(widget => widget.id === 'document-catalog' || widget.id === 'company' || (DEFAULT_DESKTOP_IDS as readonly string[]).includes(widget.id) || !['office', 'assist'].includes(selectedArea)).slice(0, 12).map(widget => widget.id), [ownWidgets, selectedArea]);
  const [preferences, setPreferences] = useState<Preferences>({ ids: [], background: BACKGROUNDS[0].id, dismissed: [] });
  const [recoverableWidgetIds, setRecoverableWidgetIds] = useState<string[]>([]);
  const current = useRef(preferences); const writes = useRef(Promise.resolve());
  const [ready, setReady] = useState(false); const [error, setError] = useState(''); const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false); const [edit, setEdit] = useState(false); const [navigationOpen, setNavigationOpen] = useState(false);
  const [center, setCenter] = useState<CenterTab | null>(null); const [profileOpen, setProfileOpen] = useState(false);
  const [query, setQuery] = useState(''); const [navQuery, setNavQuery] = useState(''); const [category, setCategory] = useState<string>('Alle');
  const [weatherOpen, setWeatherOpen] = useState(false); const weather = useDesktopWeather(scope);
  const [now, setNow] = useState(new Date());
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 60_000); return () => clearInterval(timer); }, []);
  useEffect(() => { setNavigationOpen(false); }, [layout.sidebar]);
  useEffect(() => {
    let active = true; setReady(false); setError('');
    void AsyncStorage.multiGet([desktopKey, backgroundKey, `caresuite.healthos.desktop-widgets.v3.${owner}`, `caresuite.healthos.desktop-widgets.v2.${owner}`, `caresuite.healthos.top-widgets.v1.${owner}`, `caresuite.healthos.desktop-background.v1.${owner}`, ...(['office', 'assist'] as ProductKey[]).map(key => moduleDesktopStorageKey(tenantId, owner, key)), combinedKey, dismissedKey]).then(async entries => {
      if (!active) return;
      const values = entries.map(entry => entry[1]);
      const previousModules = values.slice(6, 8);
      const previous = values[8] !== null ? [values[8]] : previousModules.some(value => value !== null) ? previousModules : [values[2] ?? values[3] ?? values[4]].filter(value => value !== null);
      const ids = restoreDesktopWidgetIds(values[0], previous, values[0] === null ? migrationAllowed : allowed, defaults);
      if (selectedArea === 'office' && values[0] === null && ids.length > 0 && allowed.includes('document-catalog') && !ids.includes('document-catalog')) ids.unshift('document-catalog');
      setRecoverableWidgetIds(previousDesktopWidgetIds([...previousModules, values[2] ?? values[3] ?? values[4]], allowed));
      const background = values[1] ?? values[5];
      let dismissed: string[] = [];
      if (values[9]) { try { const stored = JSON.parse(values[9]); if (Array.isArray(stored)) dismissed = stored.filter((id): id is string => typeof id === 'string'); } catch { /* Keep all suggestions available when old preferences are unreadable. */ } }
      const next = { ids, dismissed, background: BACKGROUNDS.some(item => item.id === background) ? background! : BACKGROUNDS[0].id };
      if (values[0] === null && previous.some(value => value !== null)) {
        await AsyncStorage.multiSet([[desktopKey, JSON.stringify(ids)], [backgroundKey, next.background]]);
        if (!active) return;
      }
      current.current = next; setPreferences(next); setReady(true);
    }).catch(() => { if (active) setError('Desktop-Einstellungen konnten nicht geladen werden. Ihre gespeicherte Auswahl bleibt erhalten.'); });
    return () => { active = false; };
  }, [desktopKey, combinedKey, backgroundKey, dismissedKey, owner, tenantId, selectedArea, allowed, migrationAllowed, defaults, attempt]);
  const persist = (next: Preferences) => {
    current.current = next; setPreferences(next); setSaving(true); setError('');
    writes.current = writes.current.catch(() => undefined).then(() => AsyncStorage.multiSet([[desktopKey, JSON.stringify(next.ids)], [backgroundKey, next.background], [dismissedKey, JSON.stringify(next.dismissed)]]));
    const request = writes.current;
    void request.then(() => { if (request === writes.current) setSaving(false); }).catch(() => {
      if (request === writes.current) { setSaving(false); setError('Die Desktop-Auswahl konnte nicht gespeichert werden. Bitte erneut speichern.'); }
    });
  };
  const toggle = (id: string) => {
    if (!allowed.includes(id)) return;
    const ids = current.current.ids;
    const capacity = Math.max(12, Math.ceil(ids.length / 12) * 12);
    if (!ids.includes(id) && ids.length >= capacity) { setError('Alle Desktop-Plätze sind belegt. Entfernen Sie zuerst ein Widget.'); return; }
    persist({ ...current.current, ids: ids.includes(id) ? ids.filter(item => item !== id) : [...ids, id] });
  };
  const open = (app: Pick<DesktopApp, 'route'>) => { setNavigationOpen(false); setCenter(null); setProfileOpen(false); router.push(nativeAdministrationRoute(app.route) as never); };
  const openCenter = (tab: CenterTab) => { setNavigationOpen(false); setQuery(''); setCategory('Alle'); setCenter(tab); };
  const matches = (app: { label: string; description: string; category?: string }) => (category === 'Alle' || app.category === category) && `${app.label} ${app.description}`.toLocaleLowerCase('de-DE').includes(query.trim().toLocaleLowerCase('de-DE'));
  const groups = buildDesktopAreaNavigation(apps, selectedArea, navQuery);
  const suggestions = useMemo(() => suggestDesktopWidgets(widgets.filter(widget => !preferences.dismissed.includes(widget.id)), preferences.ids, selectedArea, desktopCatalogAreaForRoute, Math.min(4, Math.max(0, 12 - preferences.ids.length))), [widgets, preferences.ids, preferences.dismissed, selectedArea]);
  const selectedBackground = BACKGROUNDS.find(item => item.id === preferences.background) ?? BACKGROUNDS[0];
  const moduleLabel = DESKTOP_AREAS.find(area => area.key === selectedArea)!.label;
  const navigation = <View style={ui.stack}>
    <Text accessibilityRole="header" style={ui.title}>{moduleLabel} · Navigation</Text>
    <NativeField label="Seiten suchen" value={navQuery} onChangeText={setNavQuery} autoCorrect={false} placeholder="Name oder Arbeitsbereich" />
    <NativeAction label="Mein Desktop" selected onPress={() => setNavigationOpen(false)} />
    {groups.map(group => <View key={group.title} style={ui.stack}><Text style={styles.group}>{group.title}</Text>{group.items.map(app => <Pressable key={app.route} testID={`native-navigation-${app.id}`} accessibilityRole="button" accessibilityLabel={`${app.label} öffnen${app.group ? ` · ${app.group}` : ''}`} onPress={() => open(app)} style={({ pressed }) => [styles.navItem, pressed && ui.pressed]}><DesktopCatalogArtwork route={app.route} label={app.label} size={34} /><View style={{ flex: 1, minWidth: 0 }}><Text style={styles.navLabel}>{app.label}</Text>{app.group ? <Text style={styles.desktopEyebrow}>{app.group}</Text> : null}</View><MobileIcon name="chevron-right" size={18} color="#8BE8FF" /></Pressable>)}</View>)}
    {!groups.length ? <Text style={ui.muted}>Keine passende Seite gefunden.</Text> : null}
    <NativeAction label="Widgets hinzufügen" onPress={() => openCenter('widgets')} />
    <NativeAction label="Hintergrund ändern" onPress={() => openCenter('backgrounds')} />
    <NativeAction label="Einstellungen" onPress={() => open({ route: '/settings' })} />
    <NativeAction label="Hilfe & Anleitungen" onPress={() => open({ route: '/hilfe' })} />
  </View>;
  if (!ready) return <SafeAreaView style={styles.loading}><View style={ui.surface}><Text style={ui.title}>Desktop wird vorbereitet</Text>{error ? <><Text style={ui.error}>{error}</Text><NativeAction label="Erneut laden" onPress={() => setAttempt(value => value + 1)} /></> : <ActivityIndicator color="#8dc8ff" />}</View></SafeAreaView>;
  return <ImageBackground source={selectedBackground.image} resizeMode="cover" style={styles.root} testID="native-administration-desktop">
    <SafeAreaView style={[styles.safe, { padding: layout.framePadding }]}>
      <View style={[styles.header, compactHeight && { paddingVertical: 6 }]} testID="desktop-full-width-header">
        <Image source={BRAND} accessibilityLabel="CareSuite HealthOS" style={[styles.brand, { width: Math.min(width - 64, 234), height: Math.min(width - 64, 234) / 8 }]} resizeMode="contain" />
        <View style={[styles.headerInfo, width < 780 && { flexBasis: '100%' }]} testID="desktop-clock-weather">
          <View style={styles.timeBlock}><Text style={styles.clock}>{now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</Text><Text style={styles.desktopEyebrow}>{now.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Wetterort ändern" onPress={() => setWeatherOpen(true)} style={styles.weather}><Text style={styles.weatherText}>{weather.data ? `${weather.data.glyph} ${weather.data.temperature} °C · ${weather.data.label}` : 'Standortwetter'}</Text><Text style={styles.desktopEyebrow}>{weather.message}</Text><Text style={styles.weatherEdit}>Ort ändern</Text></Pressable>
        </View>
        <View style={[styles.headerActions, width < 780 && { flexBasis: '100%', justifyContent: 'center' }]}>
          <MobileIconButton label="Navigation" icon="menu" dark onPress={() => setNavigationOpen(true)} />
          <MobileIconButton label="Apps und Widgets öffnen" icon="grid" dark onPress={() => openCenter('apps')} />
          <MobileIconButton label="Hilfe & Anleitungen" icon="help-circle" dark onPress={() => open({ route: '/hilfe' })} />
          <MobileIconButton label="Mein Profil" icon="user" dark onPress={() => setProfileOpen(true)} />
        </View>
      </View>
      <View style={styles.workarea}>
        {layout.sidebar ? <ScrollView keyboardShouldPersistTaps="handled" style={[styles.sidebar, { width: layout.sidebarWidth }]} contentContainerStyle={{ padding: 16, gap: 16 }}>{navigation}</ScrollView> : null}
        <ScrollView style={{ flex: 1, minWidth: 0 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: compactHeight ? 12 : layout.padding, gap: compactHeight ? 8 : 14, paddingBottom: 24 }}>
          <View style={styles.desktopToolbar}>
            <View style={{ flex: 1, minWidth: 0 }}><Text accessibilityRole="header" style={styles.desktopTitle}>Mein Desktop · {moduleLabel}</Text><Text style={styles.desktopEyebrow}>{preferences.ids.length} Widgets</Text></View>
            <MobileIconButton label={edit ? 'Bearbeitung beenden' : 'Desktop bearbeiten'} icon={edit ? 'check' : 'sliders'} dark selected={edit} onPress={() => setEdit(!edit)} />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator style={styles.moduleBar} contentContainerStyle={styles.moduleContent} accessibilityLabel="Arbeitsbereiche">
            {DESKTOP_AREAS.map(area => <Pressable key={area.key} accessibilityRole="tab" accessibilityLabel={area.label} accessibilityState={{ selected: selectedArea === area.key }} onPress={() => onSelectArea(area.key)} style={[styles.areaTab, selectedArea === area.key && styles.areaTabActive]}><Text style={[styles.areaText, selectedArea === area.key && { color: '#fff' }]}>{area.label}</Text></Pressable>)}
          </ScrollView>
          {error ? <View style={ui.surface}><Text accessibilityRole="alert" style={ui.error}>{error}</Text><NativeAction label="Erneut speichern" onPress={() => persist(current.current)} /></View> : null}
          {saving ? <Text accessibilityLiveRegion="polite" style={styles.desktopEyebrow}>Auswahl wird gespeichert …</Text> : null}
          <View style={[ui.row, { alignItems: 'stretch', gap: layout.gap }]}>{preferences.ids.map((id, index) => {
            const widget = widgetById.get(id); if (!widget) return null;
            return <View key={id} style={[styles.widget, { width: layout.cardWidth }]}>
              {widget.workspaceService ? <GoogleWorkspaceWidget service={widget.workspaceService} /> : <NativeWidget widget={widget} compact={compactHeight} narrow={layout.cardWidth / fontScale < 190} onOpen={() => open(widget)} />}
              {edit ? <View style={styles.widgetEdit}><NativeAction label="Entfernen" accessibilityLabel={`${widget.label} vom Desktop entfernen`} onPress={() => toggle(id)} /><View style={ui.row}><NativeAction label="←" accessibilityLabel={`${widget.label} nach vorne verschieben`} disabled={index === 0} onPress={() => persist({ ...current.current, ids: moveNativeDesktopWidget(current.current.ids, id, -1) })} /><NativeAction label="→" accessibilityLabel={`${widget.label} nach hinten verschieben`} disabled={index === preferences.ids.length - 1} onPress={() => persist({ ...current.current, ids: moveNativeDesktopWidget(current.current.ids, id, 1) })} /></View></View> : null}
            </View>;
          })}</View>
          {suggestions.length ? <View style={styles.suggestions}>
            <Text style={styles.sectionLabel}>Vorschläge für {moduleLabel}</Text>
            <View style={[ui.row, { alignItems: 'stretch', gap: layout.gap }]}>{suggestions.map(widget => <View key={widget.id} style={[styles.widget, styles.suggestionCard, { width: layout.cardWidth }]}>
              <NativeWidget widget={widget} compact={compactHeight} narrow={layout.cardWidth / fontScale < 190} onOpen={() => toggle(widget.id)} suggestion />
              <Pressable accessibilityRole="button" accessibilityLabel={`${widget.label} als Vorschlag ausblenden`} onPress={() => persist({ ...current.current, dismissed: [...new Set([...current.current.dismissed, widget.id])] })} style={styles.dismissSuggestion}><MobileIcon name="x" color="#D6E9FF" size={18} /></Pressable>
            </View>)}</View>
          </View> : null}
          {!areaAllowed ? <View style={ui.surface}><Text style={ui.title}>{moduleLabel}</Text><Text style={ui.body}>Dieser Arbeitsbereich ist für Ihren Zugang derzeit nicht freigegeben.</Text></View> : !preferences.ids.length ? <View style={ui.surface}><Text style={ui.title}>Ihr Desktop ist frei</Text><Text style={ui.body}>Wählen Sie Widgets für diesen Arbeitsbereich. Alle Seiten finden Sie weiterhin in Apps und Navigation.</Text><NativeAction label="Widgets auswählen" primary onPress={() => openCenter('widgets')} /></View> : null}
        </ScrollView>
      </View>
    </SafeAreaView>
    <NativeWorkspaceDialog visible={navigationOpen} title="Navigation" onClose={() => setNavigationOpen(false)}>{navigation}</NativeWorkspaceDialog>
    <NativeWorkspaceDialog visible={center !== null} title={`${moduleLabel} · ${center === 'backgrounds' ? 'Hintergründe' : center === 'widgets' ? 'Widgets' : center === 'workflows' ? 'Abläufe' : 'Apps'}`} wide onClose={() => setCenter(null)}>
      <View style={ui.row}>{(['apps', 'widgets', 'workflows', 'backgrounds'] as const).map(tab => <NativeAction key={tab} label={{ apps: 'Apps', widgets: 'Widgets', workflows: 'Abläufe', backgrounds: 'Hintergründe' }[tab]} selected={center === tab} onPress={() => { setCenter(tab); setQuery(''); setCategory('Alle'); }} />)}</View>
      {center === 'widgets' && recoverableWidgetIds.some(id => !preferences.ids.includes(id)) ? <View style={ui.surface}>
        <Text style={ui.body}>Weitere Widgets aus Ihrer gespeicherten Auswahl sind verfügbar.</Text>
        <NativeAction label="Gespeicherte Widgets wiederherstellen" onPress={() => persist({ ...current.current, ids: [...new Set([...current.current.ids, ...recoverableWidgetIds])] })} />
      </View> : null}
      {center === 'apps' || center === 'widgets' ? <><NativeField label="Im Center suchen" value={query} onChangeText={setQuery} autoCorrect={false} /><View style={ui.row}>{['Alle', ...DESKTOP_CATEGORIES].map(item => <NativeAction key={item} label={item} selected={category === item} onPress={() => setCategory(item)} />)}</View>
        {(center === 'apps' ? apps : widgets).filter(matches).map(app => <View key={app.id} style={ui.surface}><Text style={ui.label}>{app.label}</Text><Text style={ui.muted}>{app.description}</Text><View style={ui.row}><NativeAction label="Öffnen" onPress={() => open(app)} />{center === 'widgets' ? <NativeAction label={preferences.ids.includes(app.id) ? 'Vom Desktop entfernen' : 'Zum Desktop hinzufügen'} selected={preferences.ids.includes(app.id)} disabled={!preferences.ids.includes(app.id) && preferences.ids.length >= Math.max(12, Math.ceil(preferences.ids.length / 12) * 12)} onPress={() => toggle(app.id)} /> : null}</View></View>)}
        {!(center === 'apps' ? apps : widgets).some(matches) ? <Text style={ui.body}>Keine passenden Einträge. Passen Sie die Suche oder Kategorie an.</Text> : null}
        {center === 'widgets' ? <Text style={ui.muted}>{preferences.ids.length > 12 ? `${preferences.ids.length} gespeicherte Widgets` : `${preferences.ids.length} von zwölf Widgets ausgewählt`}</Text> : null}
      </> : null}
      {center === 'workflows' ? WORKFLOWS.filter(item => areaAllowed && apps.some(app => app.route === nativeAdministrationRoute(item.route))).map(item => <View key={item.id} style={ui.surface}><Text style={ui.label}>{item.label}</Text><Text style={ui.body}>{item.text}</Text><NativeAction label="Workflow öffnen" onPress={() => open(item)} /></View>) : null}
      {center === 'backgrounds' ? BACKGROUNDS.map(item => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Hintergrund ${item.label} auswählen`} accessibilityState={{ selected: item.id === preferences.background }} onPress={() => persist({ ...current.current, background: item.id })} style={[styles.backgroundChoice, item.id === preferences.background && styles.selected]}><Image source={item.thumbnail ?? item.image} resizeMode="cover" resizeMethod="resize" style={styles.backgroundPreview} /><Text style={[ui.body, { padding: 14 }]}>{item.label}{item.id === preferences.background ? ' ✓' : ''}</Text></Pressable>) : null}
    </NativeWorkspaceDialog>
    <NativeWorkspaceDialog visible={profileOpen} title="Mein Profil" onClose={() => setProfileOpen(false)}>
      <Text style={ui.title}>{auth.profile?.displayName || auth.user?.displayName}</Text><Text style={ui.body}>{auth.user?.email}</Text><Text style={ui.muted}>{permissions.roleLabel ?? 'Verwaltung'}</Text>
      <NativeAction label="Kontoeinstellungen" onPress={() => open({ route: '/settings/profile' })} /><NativeAction label="Hilfe & Anleitungen" onPress={() => open({ route: '/hilfe' })} /><NativeAction label="Abmelden" onPress={() => { setProfileOpen(false); void auth.signOut(); }} />
    </NativeWorkspaceDialog>
    <DesktopWeatherLocationDialog visible={weatherOpen} place={weather.place} preferenceError={weather.preferenceError} onChoose={weather.choosePlace} onClose={() => setWeatherOpen(false)} />
  </ImageBackground>;
}

function moduleLabelForArea(area: DesktopAreaKey) { return DESKTOP_AREAS.find(item => item.key === area)!.label; }

function NativeWidget({ widget, narrow, compact, onOpen, suggestion }: { widget: WidgetDefinition; narrow: boolean; compact: boolean; onOpen: () => void; suggestion?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={suggestion ? `${widget.label} zum Desktop hinzufügen` : `${widget.label} öffnen`} onPress={onOpen} style={({ pressed }) => [styles.widgetBody, pressed && { opacity: 0.8, transform: [{ scale: 0.988 }] }]}>
    <View style={styles.widgetLabelBar}><Text style={[styles.widgetTitle, narrow && { fontSize: 14, lineHeight: 21 }, suggestion && { paddingRight: 24 }]}>{widget.label}</Text><MobileIcon name="arrow-up-right" color="#77DFFF" size={16} /></View>
    <View style={[styles.artworkStage, { height: compact ? 88 : narrow ? 112 : 156 }]}><DesktopCatalogArtwork route={widget.route} label={widget.label} images={widget.images} /><View style={styles.categoryPill}><Text style={styles.categoryText}>{widget.category}</Text></View></View>
    {suggestion ? <View style={styles.suggestionBadge}><MobileIcon name="plus" color="#CDE9FF" size={14} /><Text style={styles.suggestionText}>Übernehmen</Text></View> : null}
  </Pressable>;
}

const styles = StyleSheet.create({
  headerInfo: { flexGrow: 1, flexShrink: 1, flexBasis: 320, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12 },
  timeBlock: { flexShrink: 0 },
  weatherEdit: { color: '#8FE4FF', fontFamily: careSuiteAppFontFamily, fontSize: 12, lineHeight: 18, fontWeight: '700' },
  navLabel: { color: '#E6F1FA', fontFamily: careSuiteAppFontFamily, fontSize: 16, lineHeight: 23, fontWeight: '700' },
  widgetLabelBar: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 },
  artworkStage: { margin: 10, marginTop: 0, borderRadius: 13, backgroundColor: 'rgba(4,23,47,0.5)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  categoryPill: { position: 'absolute', top: 7, left: 7, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3, backgroundColor: 'rgba(0,11,27,0.7)' },
  categoryText: { color: '#C5E7F8', fontFamily: careSuiteAppFontFamily, fontSize: 10, lineHeight: 14 },
  root: { flex: 1, backgroundColor: '#071629' }, safe: { flex: 1, padding: 12, gap: 12, backgroundColor: 'rgba(0,10,27,0.2)' },
  loading: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#071629' },
  header: { padding: 10, gap: 12, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(139,211,255,0.3)', backgroundColor: 'rgba(2,15,35,0.76)' }, headerActions: { flexDirection: 'row', gap: 8 },
  brand: { maxWidth: '100%', flexShrink: 1 }, moduleBar: { flexGrow: 0, flexShrink: 0 }, moduleContent: { paddingBottom: 10, paddingTop: 3, gap: 6 },
  areaTab: { minHeight: 44, paddingVertical: 11, paddingHorizontal: 17, borderRadius: 15, justifyContent: 'center', backgroundColor: 'rgba(90,150,220,0.09)', borderWidth: 1, borderColor: 'rgba(161,210,255,0.16)' }, areaTabActive: { backgroundColor: '#075577', borderColor: '#62DCFF' }, areaText: { color: '#BDD2EC', fontFamily: careSuiteAppFontFamily, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  workarea: { flex: 1, minHeight: 0, flexDirection: 'row', gap: 16 }, sidebar: { flexGrow: 0, flexShrink: 0, backgroundColor: 'rgba(2,15,35,0.76)', borderWidth: 1, borderColor: 'rgba(139,211,255,0.3)', borderRadius: 28 }, navItem: { minHeight: 48, flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 7, gap: 8, borderRadius: 14 }, group: { color: '#AFC9DC', fontFamily: careSuiteAppFontFamily, fontSize: 12, lineHeight: 18, fontWeight: '700' },
  welcome: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12, borderRadius: 23, borderWidth: 1, borderColor: 'rgba(157,205,255,0.3)' }, desktopEyebrow: { color: '#BDD4F0', fontFamily: careSuiteAppFontFamily, fontSize: 12, lineHeight: 19 }, desktopTitle: { color: '#F5FAFF', fontFamily: careSuiteAppFontFamily, fontSize: 23, lineHeight: 32, fontWeight: '700' }, weather: { flex: 1, alignItems: 'center', minWidth: 0, gap: 3, minHeight: 52, justifyContent: 'center' }, clock: { color: '#fff', fontFamily: careSuiteAppFontFamily, fontSize: 28, lineHeight: 35, fontWeight: '600', fontVariant: ['tabular-nums'] }, weatherText: { color: '#D4E8FF', fontFamily: careSuiteAppFontFamily, fontSize: 12, lineHeight: 18, textAlign: 'right' },
  desktopToolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, sectionLabel: { color: '#E0EEFF', fontFamily: careSuiteAppFontFamily, fontSize: 14, lineHeight: 22, fontWeight: '600', flexShrink: 1 },
  widget: { borderRadius: 18, borderWidth: 1, borderColor: 'rgba(131,203,245,0.22)', backgroundColor: 'rgba(1,12,29,0.78)', overflow: 'hidden', shadowColor: '#00132B', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 3 }, widgetBody: { minHeight: 120 }, widgetTitle: { color: '#F1F8FF', fontFamily: careSuiteAppFontFamily, fontSize: 18, lineHeight: 24, fontWeight: '700', flex: 1, minWidth: 0 }, widgetImage: { width: '100%', aspectRatio: 1.6 }, widgetFallback: { alignItems: 'center', justifyContent: 'center', minHeight: 72 },
  suggestions: { gap: 12 }, suggestionCard: { borderStyle: 'dashed', borderColor: 'rgba(177,221,255,0.5)', backgroundColor: 'rgba(16,49,88,0.65)' }, dismissSuggestion: { position: 'absolute', right: 0, top: 0, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, suggestionBadge: { position: 'absolute', left: 8, right: 8, bottom: 8, paddingVertical: 5, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: 'rgba(7,28,58,0.88)' }, suggestionText: { color: '#DDEFFF', fontFamily: careSuiteAppFontFamily, fontSize: 11, lineHeight: 16 },
  widgetEdit: { padding: 8, gap: 8, backgroundColor: '#F3F7FD' }, backgroundChoice: { borderRadius: 18, overflow: 'hidden', borderWidth: 2, borderColor: '#D7E5F5' }, backgroundPreview: { width: '100%', height: 140 }, selected: { borderColor: '#1569E8' },
  dock: { flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 5, backgroundColor: 'rgba(5,19,40,0.94)', borderTopWidth: 1, borderColor: 'rgba(156,208,255,0.24)' }, dockItem: { flex: 1, paddingVertical: 9, minHeight: 58, alignItems: 'center', justifyContent: 'center', gap: 5 }, dockText: { maxWidth: '100%', textAlign: 'center', flexShrink: 1, color: '#DCEBFF', fontFamily: careSuiteAppFontFamily, fontSize: 11, lineHeight: 16 }, notice: { color: '#FFD5DA', fontFamily: careSuiteAppFontFamily, fontSize: 13, padding: 8 },
});
