import { careSuiteAppFontFamily } from '@/design/tokens/appFontFamily';
import type { PermissionKey } from '@/types/permissions';
import { useEffect, useMemo, useRef, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { CareSuiteImage as Image, CareSuiteImageBackground as ImageBackground } from '@/components/images/CareSuiteImage';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { usePermissions } from '@/hooks/usePermissions';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import { useDesktopWeather } from '@/hooks/useDesktopWeather.native';
import { MobileButton as NativeAction, MobileField as NativeField, MobileSheet as NativeWorkspaceDialog, MobileIconButton, MobileIcon, m } from '@/components/mobile/MobileWorkspace';
import { DESKTOP_AREAS, desktopAreaForRoute, desktopAreaStorageKey, type DesktopAreaKey } from '../navigation/desktopAreas';
import { nativeAdministrationRoute } from '../navigation/nativeAdministrationModel';
const ui = { ...m, surface: m.card, row: m.wrap, pressed: { opacity: 0.78 } };
import { GoogleWorkspaceWidget } from '@/components/googleWorkspace/GoogleWorkspaceWidget.native';
import { DESKTOP_MODULES, moduleDesktopStorageKey, desktopStorageKey, restoreDesktopWidgetIds, previousDesktopWidgetIds, buildDesktopNavigationGroups } from '../navigation/moduleDesktopModel';
import { buildDesktopApps, DESKTOP_CATEGORIES, type DesktopApp } from '../navigation/desktopAppCatalogModel';
import { nativeDesktopLayout, moveNativeDesktopWidget } from '../navigation/nativeDesktopLayout';
import { BRAND, BACKGROUNDS, WIDGETS, DEFAULT_DESKTOP_IDS, WORKFLOWS, type WidgetDefinition } from './administrationDesktopCatalog';
import { DesktopWeatherLocationDialog } from './DesktopWeatherLocationDialog.native';
import type { ProductKey } from '@/types';

type CenterTab = 'apps' | 'widgets' | 'workflows' | 'backgrounds';
type Preferences = { ids: string[]; background: string };

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
  const combinedKey = desktopStorageKey(tenantId, owner);
  const permissions = usePermissions();
  const areaAllowed = selectedArea === 'settings' || selectedArea === 'premium' || (selectedArea === 'robotics' ? permissions.can('robotics.access' as PermissionKey) : availableKeys.includes(selectedArea as ProductKey));
  const backgroundKey = `caresuite.healthos.native-background.v1.${encodeURIComponent(scope)}`;
  const permissionSignature = (permissions.permissions ?? []).join(',');
  const apps = useMemo(() => buildDesktopApps(WIDGETS, auth.profile?.roleKey).map(app => ({ ...app, route: nativeAdministrationRoute(app.route) })).filter(app => areaAllowed && desktopAreaForRoute(app.route) === selectedArea && (app.route !== '/business/office/document-catalog' || permissions.can('office.documents.view'))), [auth.profile?.roleKey, areaAllowed, selectedArea, permissionSignature]);
  const widgets = useMemo<WidgetDefinition[]>(() => {
    const existing = WIDGETS.map(widget => ({ ...widget, route: nativeAdministrationRoute(widget.route) })).filter(widget => areaAllowed && desktopAreaForRoute(widget.route) === selectedArea && (!widget.permission || permissions.can(widget.permission)));
    const routes = new Set(existing.map(widget => widget.route));
    return [...existing, ...apps.filter(app => !routes.has(app.route)).map(app => ({ ...app, id: `area-app:${app.id}` }))];
  }, [apps, areaAllowed, selectedArea, permissionSignature]);
  const widgetById = useMemo(() => new Map(widgets.map(widget => [widget.id, widget])), [widgets]);
  const allowed = useMemo(() => widgets.map(widget => widget.id), [widgets]);
  const defaults = useMemo(() => widgets.filter(widget => widget.id === 'document-catalog' || widget.id === 'company' || (DEFAULT_DESKTOP_IDS as readonly string[]).includes(widget.id) || !['office', 'assist'].includes(selectedArea)).slice(0, 12).map(widget => widget.id), [widgets, selectedArea]);
  const [preferences, setPreferences] = useState<Preferences>({ ids: [], background: BACKGROUNDS[0].id });
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
    void AsyncStorage.multiGet([desktopKey, backgroundKey, `caresuite.healthos.desktop-widgets.v3.${owner}`, `caresuite.healthos.desktop-widgets.v2.${owner}`, `caresuite.healthos.top-widgets.v1.${owner}`, `caresuite.healthos.desktop-background.v1.${owner}`, ...(['office', 'assist'] as ProductKey[]).map(key => moduleDesktopStorageKey(tenantId, owner, key)), combinedKey]).then(async entries => {
      if (!active) return;
      const values = entries.map(entry => entry[1]);
      const previousModules = values.slice(6, 8);
      const previous = values[8] !== null ? [values[8]] : previousModules.some(value => value !== null) ? previousModules : [values[2] ?? values[3] ?? values[4]].filter(value => value !== null);
      const ids = restoreDesktopWidgetIds(values[0], previous, allowed, defaults);
      if (selectedArea === 'office' && values[0] === null && ids.length > 0 && allowed.includes('document-catalog') && !ids.includes('document-catalog')) ids.unshift('document-catalog');
      setRecoverableWidgetIds(previousDesktopWidgetIds([...previousModules, values[2] ?? values[3] ?? values[4]], allowed));
      const background = values[1] ?? values[5];
      const next = { ids, background: BACKGROUNDS.some(item => item.id === background) ? background! : BACKGROUNDS[0].id };
      if (values[0] === null && previous.some(value => value !== null)) {
        await AsyncStorage.multiSet([[desktopKey, JSON.stringify(ids)], [backgroundKey, next.background]]);
        if (!active) return;
      }
      current.current = next; setPreferences(next); setReady(true);
    }).catch(() => { if (active) setError('Desktop-Einstellungen konnten nicht geladen werden. Ihre gespeicherte Auswahl bleibt erhalten.'); });
    return () => { active = false; };
  }, [desktopKey, combinedKey, backgroundKey, owner, tenantId, selectedArea, allowed, defaults, attempt]);
  const persist = (next: Preferences) => {
    current.current = next; setPreferences(next); setSaving(true); setError('');
    writes.current = writes.current.catch(() => undefined).then(() => AsyncStorage.multiSet([[desktopKey, JSON.stringify(next.ids)], [backgroundKey, next.background]]));
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
  const groups = ['settings', 'premium', 'robotics'].includes(selectedArea) ? [{ title: DESKTOP_AREAS.find(area => area.key === selectedArea)!.label, items: apps.filter(app => `${app.label} ${app.description}`.toLocaleLowerCase('de-DE').includes(navQuery.toLocaleLowerCase('de-DE'))) }] : buildDesktopNavigationGroups(apps, [selectedArea as ProductKey], navQuery);
  const selectedBackground = BACKGROUNDS.find(item => item.id === preferences.background) ?? BACKGROUNDS[0];
  const moduleLabel = DESKTOP_AREAS.find(area => area.key === selectedArea)!.label;
  const navigation = <View style={ui.stack}>
    <Text accessibilityRole="header" style={ui.title}>{moduleLabel} · Navigation</Text>
    <NativeField label="Seiten suchen" value={navQuery} onChangeText={setNavQuery} autoCorrect={false} placeholder="Name oder Arbeitsbereich" />
    <NativeAction label="Mein Desktop" selected onPress={() => setNavigationOpen(false)} />
    {groups.map(group => <View key={group.title} style={ui.stack}><Text style={styles.group}>{group.title}</Text>{group.items.map(app => <Pressable key={app.route} accessibilityRole="button" accessibilityLabel={`${app.label} öffnen`} onPress={() => open(app)} style={({ pressed }) => [styles.navItem, pressed && ui.pressed]}><Text style={ui.body}>{app.label}</Text>{app.group ? <Text style={ui.muted}>{app.group}</Text> : null}</Pressable>)}</View>)}
    {!groups.length ? <Text style={ui.muted}>Keine passende Seite gefunden.</Text> : null}
    <NativeAction label="Widgets hinzufügen" onPress={() => openCenter('widgets')} />
    <NativeAction label="Hintergrund ändern" onPress={() => openCenter('backgrounds')} />
    <NativeAction label="Einstellungen" onPress={() => open({ route: '/settings' })} />
    <NativeAction label="Hilfe & Anleitungen" onPress={() => open({ route: '/hilfe' })} />
  </View>;
  if (!ready) return <SafeAreaView style={styles.loading}><View style={ui.surface}><Text style={ui.title}>Desktop wird vorbereitet</Text>{error ? <><Text style={ui.error}>{error}</Text><NativeAction label="Erneut laden" onPress={() => setAttempt(value => value + 1)} /></> : <ActivityIndicator color="#8dc8ff" />}</View></SafeAreaView>;
  return <ImageBackground source={selectedBackground.image} resizeMode="cover" style={styles.root} testID="native-administration-desktop">
    <SafeAreaView style={styles.safe}>
      <View style={[styles.header, compactHeight && { paddingVertical: 2 }]}>
        <Image source={BRAND} accessibilityLabel="CareSuite HealthOS" style={[styles.brand, compactHeight && { height: 40 }, { width: width < 370 ? 148 : width < 600 ? 180 : 226 }]} resizeMode="contain" />
        <View style={styles.headerActions}>{compactHeight ? <MobileIconButton label={edit ? 'Bearbeitung beenden' : 'Desktop bearbeiten'} icon={edit ? 'check' : 'sliders'} dark selected={edit} onPress={() => setEdit(!edit)} /> : null}{!layout.sidebar ? <MobileIconButton label="Navigation" icon="menu" dark onPress={() => setNavigationOpen(true)} /> : null}<MobileIconButton label="Hilfe & Anleitungen" icon="help-circle" dark onPress={() => open({ route: '/hilfe' })} /></View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.moduleBar} contentContainerStyle={styles.moduleContent} accessibilityLabel="Arbeitsbereiche">
        {DESKTOP_AREAS.map(area => <Pressable key={area.key} accessibilityRole="tab" accessibilityLabel={area.label} accessibilityState={{ selected: selectedArea === area.key }} onPress={() => onSelectArea(area.key)} style={[styles.areaTab, selectedArea === area.key && styles.areaTabActive]}><Text style={[styles.areaText, selectedArea === area.key && { color: '#fff' }]}>{area.label}</Text></Pressable>)}
      </ScrollView>
      <View style={styles.workarea}>
        {layout.sidebar ? <ScrollView keyboardShouldPersistTaps="handled" style={[styles.sidebar, { width: layout.sidebarWidth }]} contentContainerStyle={{ padding: 16, gap: 16 }}>{navigation}</ScrollView> : null}
        <ScrollView style={{ flex: 1, minWidth: 0 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: compactHeight ? 12 : layout.padding, gap: compactHeight ? 8 : 14, paddingBottom: 24 }}>
          <LinearGradient colors={['rgba(20,54,96,0.86)', 'rgba(7,28,58,0.72)']} style={[styles.welcome, compactHeight && { paddingVertical: 9 }, fontScale >= 1.4 && { flexDirection: 'column', alignItems: 'stretch' }]}>
            <View style={{ flex: 1, minWidth: 0 }}>{!compactHeight ? <Text style={styles.desktopEyebrow}>{now.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'long' })}</Text> : null}<Text accessibilityRole="header" style={[styles.desktopTitle, compactHeight && { fontSize: 20, lineHeight: 26 }]}>Mein Desktop</Text><Text style={styles.desktopEyebrow}>{moduleLabel}{compactHeight ? ` · ${preferences.ids.length} Widgets` : ''}</Text></View>
            <Pressable accessibilityRole="button" accessibilityLabel="Wetterort ändern" onPress={() => setWeatherOpen(true)} style={styles.weather}><Text style={styles.clock}>{now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</Text><Text style={styles.weatherText}>{weather.data ? `${weather.data.glyph} ${weather.data.temperature} °C · ${weather.data.label}` : weather.message}</Text></Pressable>
          </LinearGradient>
          {!compactHeight ? <View style={styles.desktopToolbar}><Text style={styles.sectionLabel}>{moduleLabel} · {preferences.ids.length} Widgets</Text><MobileIconButton label={edit ? 'Bearbeitung beenden' : 'Desktop bearbeiten'} icon={edit ? 'check' : 'sliders'} dark selected={edit} onPress={() => setEdit(!edit)} /></View> : null}
          {error ? <View style={ui.surface}><Text accessibilityRole="alert" style={ui.error}>{error}</Text><NativeAction label="Erneut speichern" onPress={() => persist(current.current)} /></View> : null}
          {saving ? <Text accessibilityLiveRegion="polite" style={styles.desktopEyebrow}>Auswahl wird gespeichert …</Text> : null}
          <View style={[ui.row, { alignItems: 'stretch', gap: layout.gap }]}>{preferences.ids.map((id, index) => {
            const widget = widgetById.get(id); if (!widget) return null;
            return <View key={id} style={[styles.widget, { width: layout.cardWidth }]}>
              {widget.workspaceService ? <GoogleWorkspaceWidget service={widget.workspaceService} /> : <NativeWidget widget={widget} narrow={layout.cardWidth / fontScale < 190} onOpen={() => open(widget)} />}
              {edit ? <View style={styles.widgetEdit}><NativeAction label="Entfernen" accessibilityLabel={`${widget.label} vom Desktop entfernen`} onPress={() => toggle(id)} /><View style={ui.row}><NativeAction label="←" accessibilityLabel={`${widget.label} nach vorne verschieben`} disabled={index === 0} onPress={() => persist({ ...current.current, ids: moveNativeDesktopWidget(current.current.ids, id, -1) })} /><NativeAction label="→" accessibilityLabel={`${widget.label} nach hinten verschieben`} disabled={index === preferences.ids.length - 1} onPress={() => persist({ ...current.current, ids: moveNativeDesktopWidget(current.current.ids, id, 1) })} /></View></View> : null}
            </View>;
          })}</View>
          {!areaAllowed ? <View style={ui.surface}><Text style={ui.title}>{moduleLabel}</Text><Text style={ui.body}>Dieser Arbeitsbereich ist für Ihren Zugang derzeit nicht freigegeben.</Text></View> : !preferences.ids.length ? <View style={ui.surface}><Text style={ui.title}>Ihr Desktop ist frei</Text><Text style={ui.body}>Wählen Sie Widgets für diesen Arbeitsbereich. Alle Seiten finden Sie weiterhin in Apps und Navigation.</Text><NativeAction label="Widgets auswählen" primary onPress={() => openCenter('widgets')} /></View> : null}
        </ScrollView>
      </View>
      <View style={styles.dock}>{([
        { label: 'Apps', icon: 'grid', action: () => openCenter('apps') },
        { label: 'Widgets', icon: 'plus-square', action: () => openCenter('widgets') },
        { label: 'Hintergrund', icon: 'image', action: () => openCenter('backgrounds') },
        { label: 'Profil', icon: 'user', action: () => setProfileOpen(true) },
      ] as const).map(item => <Pressable key={item.label} accessibilityRole="button" accessibilityLabel={item.label === 'Profil' ? 'Mein Profil' : item.label} onPress={item.action} style={[styles.dockItem, compactHeight && { minHeight: 48, paddingVertical: 3 }]}><MobileIcon name={item.icon} color="#DDEEFF" size={21} /><Text style={styles.dockText}>{fontScale >= 1.4 && item.label === 'Hintergrund' ? 'Design' : item.label}</Text></Pressable>)}</View>
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
      {center === 'workflows' ? WORKFLOWS.filter(item => areaAllowed && desktopAreaForRoute(item.route) === selectedArea).map(item => <View key={item.id} style={ui.surface}><Text style={ui.label}>{item.label}</Text><Text style={ui.body}>{item.text}</Text><NativeAction label="Workflow öffnen" onPress={() => open(item)} /></View>) : null}
      {center === 'backgrounds' ? BACKGROUNDS.map(item => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Hintergrund ${item.label} auswählen`} accessibilityState={{ selected: item.id === preferences.background }} onPress={() => persist({ ...current.current, background: item.id })} style={[styles.backgroundChoice, item.id === preferences.background && styles.selected]}><Image source={item.thumbnail ?? item.image} resizeMode="cover" resizeMethod="resize" style={styles.backgroundPreview} /><Text style={[ui.body, { padding: 14 }]}>{item.label}{item.id === preferences.background ? ' ✓' : ''}</Text></Pressable>) : null}
    </NativeWorkspaceDialog>
    <NativeWorkspaceDialog visible={profileOpen} title="Mein Profil" onClose={() => setProfileOpen(false)}>
      <Text style={ui.title}>{auth.profile?.displayName || auth.user?.displayName}</Text><Text style={ui.body}>{auth.user?.email}</Text><Text style={ui.muted}>{permissions.roleLabel ?? 'Verwaltung'}</Text>
      <NativeAction label="Kontoeinstellungen" onPress={() => open({ route: '/settings/profile' })} /><NativeAction label="Hilfe & Anleitungen" onPress={() => open({ route: '/hilfe' })} /><NativeAction label="Abmelden" onPress={() => { setProfileOpen(false); void auth.signOut(); }} />
    </NativeWorkspaceDialog>
    <DesktopWeatherLocationDialog visible={weatherOpen} place={weather.place} preferenceError={weather.preferenceError} onChoose={weather.choosePlace} onClose={() => setWeatherOpen(false)} />
  </ImageBackground>;
}

function NativeWidget({ widget, narrow, onOpen }: { widget: WidgetDefinition; narrow: boolean; onOpen: () => void }) {
  const label = narrow ? widget.label.replace('Dokumentenkatalog', 'Dokumenten-\nkatalog').replace('Gehaltsstatistik', 'Gehalts-\nstatistik') : widget.label;
  return <Pressable accessibilityRole="button" accessibilityLabel={`${widget.label} öffnen`} onPress={onOpen} style={({ pressed }) => [styles.widgetBody, pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] }]}>
    <Text style={styles.widgetTitle}>{label}</Text>
    {widget.images ? <Image source={widget.images.medium} resizeMode="contain" resizeMethod="resize" style={styles.widgetImage} accessible={false} /> : <View style={styles.widgetFallback}><MobileIcon name="layers" size={36} color="#A3D5FF" /></View>}
  </Pressable>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#071629' }, safe: { flex: 1, backgroundColor: 'rgba(3,13,28,0.38)' },
  loading: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#071629' },
  header: { paddingHorizontal: 16, paddingVertical: 8, gap: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(6,17,33,0.75)' }, headerActions: { flexDirection: 'row', gap: 8 },
  brand: { height: 48 }, moduleBar: { flexGrow: 0, flexShrink: 0, backgroundColor: 'rgba(6,17,33,0.6)' }, moduleContent: { paddingHorizontal: 16, paddingBottom: 10, paddingTop: 3, gap: 7 },
  areaTab: { minHeight: 44, paddingVertical: 11, paddingHorizontal: 17, borderRadius: 15, justifyContent: 'center', backgroundColor: 'rgba(90,150,220,0.09)', borderWidth: 1, borderColor: 'rgba(161,210,255,0.16)' }, areaTabActive: { backgroundColor: '#1B64CF', borderColor: '#6AA9FF' }, areaText: { color: '#BDD2EC', fontFamily: careSuiteAppFontFamily, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  workarea: { flex: 1, minHeight: 0, flexDirection: 'row' }, sidebar: { flexGrow: 0, flexShrink: 0, backgroundColor: '#F3F7FD', borderTopRightRadius: 22, borderBottomRightRadius: 22 }, navItem: { paddingVertical: 12, paddingHorizontal: 14, gap: 4, borderWidth: 1, borderColor: '#D7E5F5', backgroundColor: '#fff', borderRadius: 14 }, group: { color: '#1C5FB1', fontFamily: careSuiteAppFontFamily, fontSize: 12, lineHeight: 18, fontWeight: '700' },
  welcome: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12, borderRadius: 23, borderWidth: 1, borderColor: 'rgba(157,205,255,0.3)' }, desktopEyebrow: { color: '#BDD4F0', fontFamily: careSuiteAppFontFamily, fontSize: 12, lineHeight: 19 }, desktopTitle: { color: '#F5FAFF', fontFamily: careSuiteAppFontFamily, fontSize: 23, lineHeight: 32, fontWeight: '700' }, weather: { flex: 1, alignItems: 'flex-end', minWidth: 0, gap: 3, minHeight: 48, justifyContent: 'center' }, clock: { color: '#fff', fontFamily: careSuiteAppFontFamily, fontSize: 28, lineHeight: 35, fontWeight: '600', fontVariant: ['tabular-nums'] }, weatherText: { color: '#D4E8FF', fontFamily: careSuiteAppFontFamily, fontSize: 12, lineHeight: 18, textAlign: 'right' },
  desktopToolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, sectionLabel: { color: '#E0EEFF', fontFamily: careSuiteAppFontFamily, fontSize: 14, lineHeight: 22, fontWeight: '600', flexShrink: 1 },
  widget: { borderRadius: 22, borderWidth: 1, borderColor: 'rgba(177,221,255,0.32)', backgroundColor: 'rgba(10,32,63,0.7)', overflow: 'hidden', shadowColor: '#00132B', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 3 }, widgetBody: { padding: 12, gap: 4, minHeight: 120 }, widgetTitle: { color: '#F1F8FF', fontFamily: careSuiteAppFontFamily, fontSize: 14, lineHeight: 21, fontWeight: '700', textAlign: 'center' }, widgetImage: { width: '100%', aspectRatio: 1.6 }, widgetFallback: { alignItems: 'center', justifyContent: 'center', minHeight: 72 },
  widgetEdit: { padding: 8, gap: 8, backgroundColor: '#F3F7FD' }, backgroundChoice: { borderRadius: 18, overflow: 'hidden', borderWidth: 2, borderColor: '#D7E5F5' }, backgroundPreview: { width: '100%', height: 140 }, selected: { borderColor: '#1569E8' },
  dock: { flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 5, backgroundColor: 'rgba(5,19,40,0.94)', borderTopWidth: 1, borderColor: 'rgba(156,208,255,0.24)' }, dockItem: { flex: 1, paddingVertical: 9, minHeight: 58, alignItems: 'center', justifyContent: 'center', gap: 5 }, dockText: { maxWidth: '100%', textAlign: 'center', flexShrink: 1, color: '#DCEBFF', fontFamily: careSuiteAppFontFamily, fontSize: 11, lineHeight: 16 }, notice: { color: '#FFD5DA', fontFamily: careSuiteAppFontFamily, fontSize: 13, padding: 8 },
});
