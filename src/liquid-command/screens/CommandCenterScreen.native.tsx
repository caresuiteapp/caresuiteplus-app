import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { CareSuiteImage as Image, CareSuiteImageBackground as ImageBackground } from '@/components/images/CareSuiteImage';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { usePermissions } from '@/hooks/usePermissions';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import { useDesktopWeather } from '@/hooks/useDesktopWeather.native';
import { NativeAction, NativeField, NativeWorkspaceDialog, nativeWorkspaceStyles as ui } from '@/components/ui/NativeWorkspaceUi';
import { GoogleWorkspaceWidget } from '@/components/googleWorkspace/GoogleWorkspaceWidget.native';
import { DESKTOP_MODULES, desktopModuleForRoute, moduleDesktopStorageKey, normalizeModuleWidgets, buildModuleDesktopNavigation } from '../navigation/moduleDesktopModel';
import { buildDesktopApps, DESKTOP_CATEGORIES, type DesktopApp } from '../navigation/desktopAppCatalogModel';
import { nativeDesktopLayout, moveNativeDesktopWidget } from '../navigation/nativeDesktopLayout';
import { BRAND, BACKGROUNDS, WIDGETS, DEFAULT_DESKTOP_IDS, WIDGET_BY_ID, WORKFLOWS, type WidgetDefinition } from './administrationDesktopCatalog';
import { DesktopWeatherLocationDialog } from './DesktopWeatherLocationDialog.native';
import type { ProductKey } from '@/types';
import type { PermissionKey } from '@/types/permissions';

type CenterTab = 'apps' | 'widgets' | 'workflows' | 'backgrounds';
type Preferences = { ids: string[]; background: string };

export function CommandCenterScreen() {
  const auth = useAuth(); const permissions = usePermissions(); const access = useModuleAccess();
  const modules = DESKTOP_MODULES.filter(item => access.hasGate(item.key) && permissions.can(`${item.key}.access` as PermissionKey));
  const identity = JSON.stringify([permissions.tenantId, auth.user?.id]);
  const key = `caresuite.healthos.active-desktop-module.v1.${encodeURIComponent(identity)}`;
  const signature = modules.map(item => item.key).join(',');
  const [selection, setSelection] = useState<{ identity: string; module: ProductKey }>();
  const [error, setError] = useState(''); const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true; setError('');
    if (!permissions.tenantId || !auth.user?.id || !signature) return;
    void AsyncStorage.getItem(key).then(saved => {
      if (active) setSelection({ identity, module: modules.find(item => item.key === saved)?.key ?? modules[0].key });
    }).catch(() => { if (active) setError('Die persönliche Modulauswahl konnte nicht geladen werden.'); });
    return () => { active = false; };
    // The signature includes every entitlement change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity, key, signature, attempt]);
  const changeModule = (module: ProductKey) => {
    if (!modules.some(item => item.key === module)) return;
    setSelection({ identity, module });
    void AsyncStorage.setItem(key, module).catch(() => setError('Die Modulauswahl konnte nicht gespeichert werden.'));
  };
  if (!selection || selection.identity !== identity || !modules.some(item => item.key === selection.module)) {
    return <SafeAreaView style={styles.loading}><View style={ui.surface}>
      <Text accessibilityRole="header" style={ui.title}>{signature ? 'Ihr Desktop' : 'Keine freigegebenen Arbeitsbereiche'}</Text>
      {error ? <><Text accessibilityRole="alert" style={ui.error}>{error}</Text><NativeAction label="Erneut versuchen" onPress={() => setAttempt(value => value + 1)} /></> : signature ? <ActivityIndicator accessibilityLabel="Desktop wird geladen" color="#8dc8ff" /> : <Text style={ui.body}>Für diesen Zugang ist derzeit kein Desktop-Modul verfügbar.</Text>}
      <NativeAction label="Abmelden" onPress={() => void auth.signOut()} />
    </View></SafeAreaView>;
  }
  return <NativeModuleDesktop key={`${identity}:${selection.module}`} tenantId={permissions.tenantId!} module={selection.module} modules={modules} onModuleChange={changeModule} selectionError={error} />;
}

function NativeModuleDesktop({ tenantId, module, modules, onModuleChange, selectionError }: {
  tenantId: string; module: ProductKey; modules: readonly { key: ProductKey; label: string }[]; onModuleChange: (module: ProductKey) => void; selectionError: string;
}) {
  const router = useRouter(); const auth = useAuth(); const { width, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const layout = nativeDesktopLayout(width - insets.left - insets.right, fontScale);
  const owner = auth.user!.id; const scope = JSON.stringify([tenantId, owner]);
  const desktopKey = moduleDesktopStorageKey(tenantId, owner, module);
  const backgroundKey = `caresuite.healthos.native-background.v1.${encodeURIComponent(scope)}`;
  const apps = useMemo(() => buildDesktopApps(WIDGETS, auth.profile?.roleKey).filter(app => desktopModuleForRoute(app.route) === module), [auth.profile?.roleKey, module]);
  const widgets = useMemo(() => WIDGETS.filter(widget => desktopModuleForRoute(widget.route) === module), [module]);
  const allowed = useMemo(() => widgets.map(widget => widget.id), [widgets]);
  const defaults = useMemo(() => widgets.filter(widget => (DEFAULT_DESKTOP_IDS as readonly string[]).includes(widget.id)).map(widget => widget.id), [widgets]);
  const [preferences, setPreferences] = useState<Preferences>({ ids: [], background: BACKGROUNDS[0].id });
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
    void AsyncStorage.multiGet([desktopKey, backgroundKey, `caresuite.healthos.desktop-widgets.v3.${owner}`, `caresuite.healthos.desktop-widgets.v2.${owner}`, `caresuite.healthos.top-widgets.v1.${owner}`, `caresuite.healthos.desktop-background.v1.${owner}`]).then(entries => {
      if (!active) return;
      const values = entries.map(entry => entry[1]);
      const raw = values[0] ?? values[2] ?? values[3] ?? values[4];
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      if (raw && !Array.isArray(parsed)) throw new Error('Invalid saved widgets');
      let ids = normalizeModuleWidgets(parsed, allowed, defaults);
      if (!values[0] && ids.length === 0 && !(Array.isArray(parsed) && parsed.length === 0)) ids = [...defaults];
      const background = values[1] ?? values[5];
      const next = { ids, background: BACKGROUNDS.some(item => item.id === background) ? background! : BACKGROUNDS[0].id };
      current.current = next; setPreferences(next); setReady(true);
    }).catch(() => { if (active) setError('Desktop-Einstellungen konnten nicht geladen werden. Ihre gespeicherte Auswahl bleibt erhalten.'); });
    return () => { active = false; };
  }, [desktopKey, backgroundKey, owner, allowed, defaults, attempt]);
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
    if (!ids.includes(id) && ids.length >= 12) { setError('Ihr Desktop enthält bereits zwölf Widgets. Entfernen Sie zuerst ein Widget.'); return; }
    persist({ ...current.current, ids: ids.includes(id) ? ids.filter(item => item !== id) : [...ids, id] });
  };
  const open = (app: Pick<DesktopApp, 'route'>) => { setNavigationOpen(false); setCenter(null); setProfileOpen(false); router.push(app.route as never); };
  const openCenter = (tab: CenterTab) => { setNavigationOpen(false); setQuery(''); setCategory('Alle'); setCenter(tab); };
  const matches = (app: { label: string; description: string; category?: string }) => (category === 'Alle' || app.category === category) && `${app.label} ${app.description}`.toLocaleLowerCase('de-DE').includes(query.trim().toLocaleLowerCase('de-DE'));
  const groups = buildModuleDesktopNavigation(apps, module, navQuery);
  const selectedBackground = BACKGROUNDS.find(item => item.id === preferences.background) ?? BACKGROUNDS[0];
  const moduleLabel = modules.find(item => item.key === module)?.label ?? module;
  const navigation = <View style={ui.stack}>
    <Text accessibilityRole="header" style={ui.title}>{moduleLabel} · Navigation</Text>
    <NativeField label="Seiten suchen" value={navQuery} onChangeText={setNavQuery} autoCorrect={false} placeholder="Name oder Arbeitsbereich" />
    <NativeAction label="Mein Desktop" selected onPress={() => setNavigationOpen(false)} />
    {groups.map(group => <View key={group.title} style={ui.stack}><Text style={styles.group}>{group.title}</Text>{group.items.map(app => <Pressable key={app.route} accessibilityRole="button" accessibilityLabel={`${app.label} öffnen`} onPress={() => open(app)} style={({ pressed }) => [styles.navItem, pressed && ui.pressed]}><Text style={ui.body}>{app.label}</Text>{app.group ? <Text style={ui.muted}>{app.group}</Text> : null}</Pressable>)}</View>)}
    {!groups.length ? <Text style={ui.muted}>Keine passende Seite gefunden.</Text> : null}
    <NativeAction label="Widgets hinzufügen" onPress={() => openCenter('widgets')} />
    <NativeAction label="Hintergrund ändern" onPress={() => openCenter('backgrounds')} />
    <NativeAction label="Einstellungen" onPress={() => open({ route: '/settings' })} />
    <NativeAction label="Support & Hilfe" onPress={() => open({ route: '/support' })} />
  </View>;
  if (!ready) return <SafeAreaView style={styles.loading}><View style={ui.surface}><Text style={ui.title}>Desktop wird vorbereitet</Text>{error ? <><Text style={ui.error}>{error}</Text><NativeAction label="Erneut laden" onPress={() => setAttempt(value => value + 1)} /></> : <ActivityIndicator color="#8dc8ff" />}</View></SafeAreaView>;
  return <ImageBackground source={selectedBackground.image} resizeMode="cover" style={styles.root} testID="native-administration-desktop">
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Image source={BRAND} accessibilityLabel="CareSuite HealthOS" style={styles.brand} resizeMode="contain" />
        <View style={ui.row}>{!layout.sidebar ? <NativeAction label="Navigation" onPress={() => setNavigationOpen(true)} /> : null}<NativeAction label="Apps" primary onPress={() => openCenter('apps')} /><NativeAction label={auth.profile?.displayName || auth.user?.displayName || 'Mein Profil'} onPress={() => setProfileOpen(true)} /></View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.moduleBar} contentContainerStyle={styles.moduleContent}>{modules.map(item => <NativeAction key={item.key} label={item.label} selected={item.key === module} onPress={() => onModuleChange(item.key)} />)}</ScrollView>
      <View style={styles.workarea}>
        {layout.sidebar ? <ScrollView keyboardShouldPersistTaps="handled" style={[styles.sidebar, { width: layout.sidebarWidth }]} contentContainerStyle={{ padding: 16, gap: 16 }}>{navigation}</ScrollView> : null}
        <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: layout.padding, gap: 20, paddingBottom: 48 }}>
          <View style={[ui.surface, styles.welcome]}>
            <Text style={styles.group}>{moduleLabel.toLocaleUpperCase('de-DE')}</Text><Text accessibilityRole="header" style={ui.title}>Mein Desktop</Text>
            <Text style={ui.body}>{now.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })} · {now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</Text>
            <View style={ui.row}><NativeAction label={edit ? 'Bearbeitung beenden' : 'Desktop bearbeiten'} selected={edit} onPress={() => setEdit(!edit)} /><NativeAction label="Widgets hinzufügen" onPress={() => openCenter('widgets')} /><NativeAction label="Hintergrund" onPress={() => openCenter('backgrounds')} /></View>
            <Pressable accessibilityRole="button" accessibilityLabel="Wetterort ändern" onPress={() => setWeatherOpen(true)} style={styles.weather}><Text style={ui.body}>{weather.data ? `${weather.data.glyph} ${weather.data.temperature} °C · ${weather.data.label}` : weather.message}</Text><Text style={ui.muted}>{weather.data ? `${weather.message} · ${weather.data.station}` : 'Stadt oder Postleitzahl auswählen'} ›</Text></Pressable>
            {saving ? <Text accessibilityLiveRegion="polite" style={ui.muted}>Desktop wird gespeichert …</Text> : null}
            {error || selectionError ? <View style={ui.stack}><Text accessibilityRole="alert" style={ui.error}>{error || selectionError}</Text>{error ? <NativeAction label="Erneut speichern" onPress={() => persist(current.current)} /> : null}</View> : null}
          </View>
          <View style={[ui.row, { alignItems: 'stretch', gap: layout.gap }]}>{preferences.ids.map((id, index) => {
            const widget = WIDGET_BY_ID.get(id); if (!widget) return null;
            return <View key={id} style={[styles.widget, { width: layout.cardWidth }]}>
              {widget.workspaceService ? <GoogleWorkspaceWidget service={widget.workspaceService} /> : <NativeWidget widget={widget} onOpen={() => open(widget)} />}
              {edit ? <View style={styles.widgetEdit}><NativeAction label="Entfernen" accessibilityLabel={`${widget.label} vom Desktop entfernen`} onPress={() => toggle(id)} /><View style={ui.row}><NativeAction label="←" accessibilityLabel={`${widget.label} nach vorne verschieben`} disabled={index === 0} onPress={() => persist({ ...current.current, ids: moveNativeDesktopWidget(current.current.ids, id, -1) })} /><NativeAction label="→" accessibilityLabel={`${widget.label} nach hinten verschieben`} disabled={index === preferences.ids.length - 1} onPress={() => persist({ ...current.current, ids: moveNativeDesktopWidget(current.current.ids, id, 1) })} /></View></View> : null}
            </View>;
          })}</View>
          {!preferences.ids.length ? <View style={ui.surface}><Text style={ui.title}>Ihr Desktop ist frei</Text><Text style={ui.body}>Wählen Sie Widgets für diesen Arbeitsbereich. Alle Seiten finden Sie weiterhin in Apps und Navigation.</Text><NativeAction label="Widgets auswählen" primary onPress={() => openCenter('widgets')} /></View> : null}
        </ScrollView>
      </View>
    </SafeAreaView>
    <NativeWorkspaceDialog visible={navigationOpen && !layout.sidebar} title="Navigation" onClose={() => setNavigationOpen(false)}>{navigation}</NativeWorkspaceDialog>
    <NativeWorkspaceDialog visible={center !== null} title={`${moduleLabel} · Center`} wide onClose={() => setCenter(null)}>
      <View style={ui.row}>{(['apps', 'widgets', 'workflows', 'backgrounds'] as const).map(tab => <NativeAction key={tab} label={{ apps: 'Apps', widgets: 'Widgets', workflows: 'Workflows', backgrounds: 'Hintergründe' }[tab]} selected={center === tab} onPress={() => { setCenter(tab); setQuery(''); setCategory('Alle'); }} />)}</View>
      {center === 'apps' || center === 'widgets' ? <><NativeField label="Im Center suchen" value={query} onChangeText={setQuery} autoCorrect={false} /><View style={ui.row}>{['Alle', ...DESKTOP_CATEGORIES].map(item => <NativeAction key={item} label={item} selected={category === item} onPress={() => setCategory(item)} />)}</View>
        {(center === 'apps' ? apps : widgets).filter(matches).map(app => <View key={app.id} style={ui.surface}><Text style={ui.label}>{app.label}</Text><Text style={ui.muted}>{app.description}</Text><View style={ui.row}><NativeAction label="Öffnen" onPress={() => open(app)} />{center === 'widgets' ? <NativeAction label={preferences.ids.includes(app.id) ? 'Vom Desktop entfernen' : 'Zum Desktop hinzufügen'} selected={preferences.ids.includes(app.id)} disabled={!preferences.ids.includes(app.id) && preferences.ids.length >= 12} onPress={() => toggle(app.id)} /> : null}</View></View>)}
        {!(center === 'apps' ? apps : widgets).some(matches) ? <Text style={ui.body}>Keine passenden Einträge. Passen Sie die Suche oder Kategorie an.</Text> : null}
        {center === 'widgets' ? <Text style={ui.muted}>{preferences.ids.length} von zwölf Widgets ausgewählt</Text> : null}
      </> : null}
      {center === 'workflows' ? WORKFLOWS.filter(item => desktopModuleForRoute(item.route) === module).map(item => <View key={item.id} style={ui.surface}><Text style={ui.label}>{item.label}</Text><Text style={ui.body}>{item.text}</Text><NativeAction label="Workflow öffnen" onPress={() => open(item)} /></View>) : null}
      {center === 'backgrounds' ? BACKGROUNDS.map(item => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Hintergrund ${item.label} auswählen`} accessibilityState={{ selected: item.id === preferences.background }} onPress={() => persist({ ...current.current, background: item.id })} style={[styles.backgroundChoice, item.id === preferences.background && styles.selected]}><Image source={item.thumbnail ?? item.image} resizeMode="cover" resizeMethod="resize" style={styles.backgroundPreview} /><Text style={[ui.body, { padding: 14 }]}>{item.label}{item.id === preferences.background ? ' ✓' : ''}</Text></Pressable>) : null}
    </NativeWorkspaceDialog>
    <NativeWorkspaceDialog visible={profileOpen} title="Mein Profil" onClose={() => setProfileOpen(false)}>
      <Text style={ui.title}>{auth.profile?.displayName || auth.user?.displayName}</Text><Text style={ui.body}>{auth.user?.email}</Text><Text style={ui.muted}>{auth.profile?.roleKey}</Text>
      <NativeAction label="Kontoeinstellungen" onPress={() => open({ route: '/settings/profile' })} /><NativeAction label="Support & Hilfe" onPress={() => open({ route: '/support' })} /><NativeAction label="Abmelden" onPress={() => { setProfileOpen(false); void auth.signOut(); }} />
    </NativeWorkspaceDialog>
    <DesktopWeatherLocationDialog visible={weatherOpen} place={weather.place} preferenceError={weather.preferenceError} onChoose={weather.choosePlace} onClose={() => setWeatherOpen(false)} />
  </ImageBackground>;
}

function NativeWidget({ widget, onOpen }: { widget: WidgetDefinition; onOpen: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`${widget.label} öffnen`} onPress={onOpen} style={({ pressed }) => [styles.widgetBody, pressed && ui.pressed]}>
    {widget.images ? <Image source={widget.images.medium} resizeMode="contain" resizeMethod="resize" style={styles.widgetImage} accessible={false} /> : null}
    <Text style={ui.label}>{widget.label}</Text><Text style={ui.muted}>{widget.description}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#071629' }, safe: { flex: 1, backgroundColor: 'rgba(3,13,28,0.32)' },
  loading: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#071629' },
  header: { paddingHorizontal: 16, paddingVertical: 12, gap: 12, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(6,17,33,0.9)' },
  brand: { width: 210, height: 48 }, moduleBar: { flexGrow: 0, flexShrink: 0, backgroundColor: 'rgba(6,17,33,0.85)' }, moduleContent: { padding: 12, gap: 10 },
  workarea: { flex: 1, flexDirection: 'row', gap: 16 }, sidebar: { backgroundColor: 'rgba(6,17,33,0.94)', borderRightWidth: 1, borderColor: '#3d5d7b' },
  group: { color: '#90c9f3', fontSize: 14, lineHeight: 22, fontWeight: '700' }, navItem: { minHeight: 48, padding: 12, gap: 4, borderRadius: 12, backgroundColor: '#0d2843' },
  welcome: { gap: 12 }, weather: { gap: 5, paddingTop: 12, borderTopWidth: 1, borderColor: '#34516e', minHeight: 48 },
  widget: { borderRadius: 22, borderWidth: 1, borderColor: '#6985a1', backgroundColor: 'rgba(7,25,45,0.9)', overflow: 'hidden' }, widgetBody: { padding: 18, gap: 8, flex: 1 }, widgetImage: { width: '100%', aspectRatio: 2.07 },
  widgetEdit: { padding: 12, gap: 10, borderTopWidth: 1, borderColor: '#34516e' }, backgroundChoice: { borderRadius: 18, overflow: 'hidden', borderWidth: 2, borderColor: '#34516e' }, backgroundPreview: { width: '100%', height: 150 }, selected: { borderColor: '#88c8ff' },
});
