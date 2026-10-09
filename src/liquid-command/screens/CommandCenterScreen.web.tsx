import { WebView as View, WebPressable as Pressable, WebScrollView as ScrollView } from '@/lib/platform/reactNativeWebCompat.web';
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Image,
  ImageBackground,
  Modal,
  Platform,
  StyleSheet,
  Text as NativeText,
  TextInput,
  useWindowDimensions,
  type ImageSourcePropType,
  type TextProps,
  type ViewStyle,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useAuth } from "@/lib/auth";
import { PortalTextSizeControls } from "@/components/portal/accessibility/PortalTextSizeControls.web";
import { TopbarProfileAvatar } from "@/components/layout/TopbarProfileAvatar";
import { useDesktopWeather } from "@/hooks/useDesktopWeather.web";
import { desktopWorkspaceCss } from "./desktopWorkspaceCss.web";
import { DesktopWeatherLocationDialog } from "./DesktopWeatherLocationDialog.web";
import { useWebFontScale } from "@/design/web/WebFontScaleProvider";

import { GoogleWorkspaceWidget } from "@/components/googleWorkspace/GoogleWorkspaceWidget.web";
import {
  buildDesktopApps,
  DESKTOP_CATEGORIES,
  type DesktopApp,
  type DesktopCategory,
} from "../navigation/desktopAppCatalog.web";
import { usePermissions } from '@/hooks/usePermissions';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import { DESKTOP_MODULES, desktopModuleForRoute, moduleDesktopStorageKey, normalizeModuleWidgets, buildModuleDesktopNavigation } from '../navigation/moduleDesktop.web';
import type { ProductKey } from '@/types';
import type { PermissionKey } from '@/types/permissions';
import type { WorkspaceService } from "@/lib/googleWorkspace/workspaceModel";

import { BRAND, BACKGROUNDS, WIDGETS, DEFAULT_DESKTOP_IDS, WIDGET_BY_ID, CATEGORIES, WORKFLOWS, DESKTOP_WIDGETS_STORAGE_KEY, PREVIOUS_DESKTOP_WIDGETS_STORAGE_KEY, LEGACY_FAVORITES_STORAGE_KEY, SIDEBAR_STORAGE_KEY, BACKGROUND_STORAGE_KEY, DESKTOP_SLOT_COUNT, type WidgetDefinition, type BackgroundDefinition } from './administrationDesktopCatalog';
type Category = DesktopCategory;
type CenterTab = 'apps' | 'widgets' | 'workflows' | 'backgrounds';
const ROLE_LABELS: Record<string, string> = { business_admin: "Geschäftsführung / Admin", tenant_admin: "Mandantenadministration", platform_admin: "Plattformadministration", office_admin: "Office-Administration", admin: "Administration", employee: "Mitarbeitende:r", manager: "Leitung" };

function normalizeDesktopIds(value: unknown) {
  if (!Array.isArray(value)) return [...DEFAULT_DESKTOP_IDS];
  const valid = value.filter((id): id is string => typeof id === "string" && WIDGET_BY_ID.has(id));
  return [...new Set(valid)].slice(0, DESKTOP_SLOT_COUNT);
}

function migrateDesktopIdsToR13(value: unknown, migrationRequired: boolean) {
  const ids = normalizeDesktopIds(value);
  if (!migrationRequired || ids.includes("logbook")) return ids;
  const replaceIndex = ids.indexOf("assist");
  if (replaceIndex >= 0) ids[replaceIndex] = "logbook";
  else if (ids.length < DESKTOP_SLOT_COUNT) ids.push("logbook");
  else ids[ids.length - 1] = "logbook";
  return ids;
}

function roleLabel(key: string | null | undefined) {
  if (!key) return "CareSuite HealthOS";
  return ROLE_LABELS[key] ?? key.split("_").map((part) => part[0]?.toUpperCase() + part.slice(1)).join(" ");
}

function Text({ style, ...props }: TextProps) {
  const { effectiveScale: scale } = useWebFontScale();
  const flattened = StyleSheet.flatten(style);
  const scaled = Platform.OS === "web" && scale !== 1 ? {
    fontSize: typeof flattened?.fontSize === "number" ? flattened.fontSize * scale : undefined,
    lineHeight: typeof flattened?.lineHeight === "number" ? flattened.lineHeight * scale : undefined,
  } : null;
  return <NativeText {...props} style={[style, scaled]} />;
}

export function CommandCenterScreen() {
  const auth = useAuth();
  const permissions = usePermissions();
  useModuleAccess(); // Subscribe to changes in the existing tenant module cache.
  const tenant = permissions.tenantId ?? '';
  const user = auth.user?.id ?? '';
  const identity = JSON.stringify([tenant, user]);
  const selectionKey = `caresuite.healthos.active-desktop-module.v1.${encodeURIComponent(identity)}`;
  const availableModules = DESKTOP_MODULES.filter(module => permissions.hasModuleGate(module.key) && permissions.can(`${module.key}.access` as PermissionKey));
  const availableSignature = availableModules.map(module => module.key).join(',');
  const [selection, setSelection] = useState<{ identity: string; module: ProductKey } | null>(null);
  const [selectionError, setSelectionError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setSelectionError(false);
    if (!tenant || !user || !availableSignature) return;
    void AsyncStorage.getItem(selectionKey).then(stored => {
      if (!active) return;
      const module = availableModules.find(item => item.key === stored)?.key ?? availableModules[0].key;
      setSelection({ identity, module });
    }).catch(() => active && setSelectionError(true));
    return () => { active = false; };
    // The signature tracks access changes without depending on an unstable array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity, selectionKey, availableSignature, attempt]);
  const changeModule = (module: ProductKey) => {
    if (!availableModules.some(item => item.key === module)) return;
    setSelection({ identity, module });
    void AsyncStorage.setItem(selectionKey, module).catch(() => setSelectionError(true));
  };
  if (!selection || selection.identity !== identity || !availableModules.some(module => module.key === selection.module)) {
    return <View style={[styles.background, styles.loadingHost]}><View style={[styles.glass, styles.loadingCard]}>
      <Text style={styles.sidebarTitle}>{selectionError ? 'Modulauswahl konnte nicht geladen werden' : availableSignature ? 'Desktop wird vorbereitet' : 'Keine freigegebenen Arbeitsbereiche'}</Text>
      <Text style={styles.desktopSubtitle}>{availableSignature ? 'Ihre persönlichen Moduleinstellungen werden geladen.' : 'Für diesen Zugang ist derzeit kein Desktop-Modul verfügbar.'}</Text>
      {selectionError ? <Pressable onPress={() => setAttempt(value => value + 1)} style={styles.appsButton}><Text style={styles.appsText}>Erneut versuchen</Text></Pressable> : null}
      <Pressable onPress={() => void auth.signOut()} style={styles.editButton}><Text style={styles.editText}>Abmelden</Text></Pressable>
    </View></View>;
  }
  return <ModuleDesktopScreen key={`${identity}:${selection.module}`} moduleKey={selection.module} tenantId={tenant} availableModules={availableModules} onModuleChange={changeModule} />;
}

function ModuleDesktopScreen({ moduleKey, tenantId, availableModules, onModuleChange }: {
  moduleKey: ProductKey; tenantId: string; availableModules: readonly { key: ProductKey; label: string }[]; onModuleChange: (key: ProductKey) => void;
}) {
  const router = useRouter();
  const auth = useAuth();
  const { width, height } = useWindowDimensions();
  const { scale: fontScale, effectiveScale } = useWebFontScale();
  const mobile = width < 900;
  const compact = width < 900 * fontScale;
  const informationWidth = Math.max(0, Math.min(width - (compact ? 24 : 40), Math.round(420 * Math.max(1, fontScale))));
  const workspaceCss = useMemo(() => desktopWorkspaceCss(effectiveScale, mobile), [effectiveScale, mobile]);
  const sidebarWidth = Math.round(260 * Math.max(1, fontScale));
  const railWidth = Math.round(60 * Math.max(1, fontScale));
  const menuToggleRef = useRef<View>(null);
  const shortViewport = height < 600 * fontScale;
  const [topbarHeight, setTopbarHeight] = useState(0);
  const shortWorkspaceHeight = Math.max(220, height - topbarHeight - (compact ? 36 : 56));
  const narrow = width < 1240 * fontScale;
  const owner = auth.user?.id ?? "local";
  const weather = useDesktopWeather(owner);
  const [weatherLocationOpen, setWeatherLocationOpen] = useState(false);
  const desktopKey = moduleDesktopStorageKey(tenantId, owner, moduleKey);
  const oldDesktopKey = `${DESKTOP_WIDGETS_STORAGE_KEY}.${owner}`;
  const moduleLabel = DESKTOP_MODULES.find(module => module.key === moduleKey)?.label ?? moduleKey;
  const previousDesktopKey = `${PREVIOUS_DESKTOP_WIDGETS_STORAGE_KEY}.${owner}`;
  const sidebarKey = `${SIDEBAR_STORAGE_KEY}.${owner}`;
  const backgroundKey = `${BACKGROUND_STORAGE_KEY}.${owner}`;
  const legacyKey = `${LEGACY_FAVORITES_STORAGE_KEY}.${owner}`;
  const [now, setNow] = useState(new Date());
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const navigationOpen = compact ? mobileSidebarOpen : sidebarOpen;
  const [desktopIds, setDesktopIds] = useState<string[]>([...DEFAULT_DESKTOP_IDS]);
  const [loadedOwner, setLoadedOwner] = useState<string | null>(null);
  const [preferencesError, setPreferencesError] = useState(false);
  const [preferencesAttempt, setPreferencesAttempt] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [centerOpen, setCenterOpen] = useState(false);
  const [centerTab, setCenterTab] = useState<CenterTab>("apps");
  const [backgroundId, setBackgroundId] = useState(BACKGROUNDS[0].id);
  const [category, setCategory] = useState<Category>("Übersicht");
  const [query, setQuery] = useState("");
  const [navigationQuery, setNavigationQuery] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const profile = auth.profile;
  const displayName = profile?.displayName || auth.user?.displayName || "Profil";
  const role = roleLabel(profile?.roleKey);
  const activeBackground = BACKGROUNDS.find((item) => item.id === backgroundId) ?? BACKGROUNDS[0];

  const apps = useMemo(() => buildDesktopApps(WIDGETS, profile?.roleKey), [profile?.roleKey]);
  const matchesSearch = (app: DesktopApp, value: string) =>
    `${app.label} ${app.description} ${app.category} ${app.group ?? ""}`.toLocaleLowerCase("de-DE").includes(value.trim().toLocaleLowerCase("de-DE"));
  const moduleApps = apps.filter(app => desktopModuleForRoute(app.route) === moduleKey);
  const moduleWidgets = useMemo(() => WIDGETS.filter(widget => desktopModuleForRoute(widget.route) === moduleKey), [moduleKey]);
  const moduleWidgetIds = useMemo(() => moduleWidgets.map(widget => widget.id), [moduleWidgets]);
  const moduleDefaults = useMemo(() => moduleWidgets.filter(widget => DEFAULT_DESKTOP_IDS.some(id => id === widget.id)).map(widget => widget.id), [moduleWidgets]);
  const filteredApps = moduleApps.filter(app => app.category === category && matchesSearch(app, query));
  const filteredWidgets = moduleWidgets.filter(widget => widget.category === category && matchesSearch(widget, query));
  const navigationGroups = buildModuleDesktopNavigation(moduleApps, moduleKey, navigationQuery);
  const resultCount = centerTab === "apps" ? filteredApps.length : filteredWidgets.length;

  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => setMobileSidebarOpen(false), [compact]);
  useEffect(() => {
    let active = true;
    setLoadedOwner(null);
    setPreferencesError(false);
    setCenterOpen(false);
    setProfileOpen(false);
    setEditMode(false);
    setMobileSidebarOpen(false);
    setQuery("");
    setCategory("Übersicht");
    setNavigationQuery("");
    void Promise.all([AsyncStorage.getItem(desktopKey), AsyncStorage.getItem(oldDesktopKey), AsyncStorage.getItem(previousDesktopKey), AsyncStorage.getItem(legacyKey), AsyncStorage.getItem(sidebarKey), AsyncStorage.getItem(backgroundKey)]).then(([desktop, oldDesktop, previousDesktop, legacy, sidebar, storedBackground]) => {
      if (!active) return;
      let stored: unknown = null;
      try { stored = JSON.parse(desktop ?? oldDesktop ?? previousDesktop ?? legacy ?? "null"); } catch { stored = null; }
      const migrated = desktop ? stored : migrateDesktopIdsToR13(stored, !oldDesktop && Boolean(previousDesktop));
      const imported = normalizeModuleWidgets(migrated, moduleWidgetIds, moduleDefaults);
      // A deliberately empty saved desktop stays empty; legacy selections are only imported once.
      setDesktopIds(desktop || imported.length || (Array.isArray(stored) && stored.length === 0) ? imported : normalizeModuleWidgets(null, moduleWidgetIds, moduleDefaults));
      setSidebarOpen(sidebar !== "false");
      setBackgroundId(storedBackground && BACKGROUNDS.some((item) => item.id === storedBackground) ? storedBackground : BACKGROUNDS[0].id);
      setLoadedOwner(owner);
    }).catch(() => active && setPreferencesError(true));
    return () => { active = false; };
  }, [backgroundKey, desktopKey, legacyKey, owner, previousDesktopKey, sidebarKey, oldDesktopKey, preferencesAttempt, moduleKey, moduleWidgetIds, moduleDefaults]);
  useEffect(() => {
    if (loadedOwner === owner) void AsyncStorage.multiSet([[desktopKey, JSON.stringify(desktopIds)], [sidebarKey, String(sidebarOpen)], [backgroundKey, backgroundId]]).catch(() => setPreferencesError(true));
  }, [backgroundId, backgroundKey, desktopIds, desktopKey, loadedOwner, owner, sidebarKey, sidebarOpen]);

  const closeNavigation = () => {
    if (compact) setMobileSidebarOpen(false);
    else { setSidebarOpen(false); menuToggleRef.current?.focus(); }
  };
  const openCenter = (tab: CenterTab = "apps") => { setMobileSidebarOpen(false); setCenterTab(tab); setCenterOpen(true); };
  const openWidget = (widget: Pick<DesktopApp, "route">) => { setCenterOpen(false); setMobileSidebarOpen(false); router.push(widget.route as never); };
  const togglePinned = (id: string) => moduleWidgetIds.includes(id) && setDesktopIds((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length < DESKTOP_SLOT_COUNT ? [...current, id] : current);
  const signOut = async () => { setProfileOpen(false); await auth.signOut(); };
  const slots = Array.from({ length: DESKTOP_SLOT_COUNT }, (_, index) => WIDGET_BY_ID.get(desktopIds[index] ?? ""));

  const sidebarContent = (
          <View style={styles.sidebarInner}>
            <View style={styles.sidebarHeader}><View><Text style={styles.eyebrow}>CARESUITE HEALTHOS</Text><Text style={styles.sidebarTitle}>Navigation</Text></View><Pressable accessibilityLabel="Navigation schließen" onPress={closeNavigation} style={styles.closeSmall}><Text style={styles.closeSmallText}>‹</Text></Pressable></View>
            <ScrollView style={styles.navScroller} contentContainerStyle={styles.navScroll} showsVerticalScrollIndicator>
              <View style={styles.navSearch}>
                <TextInput nativeID="desktop-navigation-search" accessibilityLabel="Seiten in der Navigation suchen" placeholder="Seite suchen …" placeholderTextColor="#AFC9DC"
                  value={navigationQuery} onChangeText={setNavigationQuery} style={[styles.searchInput, { fontSize: 14 * fontScale }]} />
              </View>
              {!navigationQuery.trim() || "mein desktop".includes(navigationQuery.trim().toLocaleLowerCase("de-DE")) ?
                <Pressable accessibilityRole="button" accessibilityLabel="Mein Desktop anzeigen" onPress={() => setMobileSidebarOpen(false)} style={[styles.navItem, styles.navItemActive]}>
                  <View style={styles.navIcon}><Text style={styles.navGlyph}>⌂</Text></View><Text style={styles.navLabel}>Mein Desktop</Text>
                </Pressable> : null}
              {navigationGroups.map(group => <View key={group.title} style={styles.navGroup}>
                <Text style={styles.navGroupTitle}>{group.title}</Text>
                {group.items.map(app => <Pressable key={app.route} accessibilityRole="button" accessibilityLabel={`Seite ${app.label} öffnen`}
                  onPress={() => openWidget(app)} style={styles.navItem}>
                  <View style={styles.navIcon}><Text style={styles.navGlyph}>{app.glyph ?? "↗"}</Text></View>
                  <View style={styles.navEntryCopy}><Text style={styles.navLabel}>{app.label}</Text>
                    {app.group ? <Text style={styles.navEntryContext}>{app.group}</Text> : null}</View>
                  <Text style={styles.navArrow}>›</Text>
                </Pressable>)}
              </View>)}
              {navigationQuery.trim() && navigationGroups.length === 0 ? <View style={styles.navGroup}>
                <Text style={styles.centerSubtitle}>Keine passende Seite gefunden.</Text>
                <Pressable accessibilityRole="button" onPress={() => setNavigationQuery("")} style={styles.pinButton}><Text style={styles.pinText}>Suche zurücksetzen</Text></Pressable>
              </View> : null}
            <Pressable accessibilityRole="button" onPress={() => openCenter("widgets")} style={styles.sidebarCenter}><Text style={styles.sidebarCenterPlus}>＋</Text><View><Text style={styles.sidebarCenterTitle}>Widgets hinzufügen</Text><Text style={styles.sidebarCenterCopy}>Center öffnen</Text></View></Pressable>
            <Pressable accessibilityLabel="Desktop-Hintergrund ändern" onPress={() => openCenter("backgrounds")} style={styles.sidebarBackground}><Text style={styles.sidebarBackgroundGlyph}>▧</Text><View><Text style={styles.sidebarCenterTitle}>Hintergrund ändern</Text><Text style={styles.sidebarCenterCopy}>{BACKGROUNDS.length} Designs</Text></View></Pressable>
            </ScrollView>
          </View>
  );
  if (loadedOwner !== owner) return <View style={[styles.background, styles.loadingHost]}>
    <View style={[styles.glass, styles.loadingCard]}>
      <Text style={styles.sidebarTitle}>{preferencesError ? "Desktop-Einstellungen konnten nicht geladen werden" : "Desktop wird vorbereitet"}</Text>
      <Text style={styles.desktopSubtitle}>{preferencesError ? "Ihre gespeicherte Auswahl bleibt erhalten. Bitte versuchen Sie es erneut." : "Ihre Apps, Navigation und Hintergrund werden geladen."}</Text>
      {preferencesError ? <Pressable onPress={() => setPreferencesAttempt(value => value + 1)} style={styles.appsButton}><Text style={styles.appsText}>Erneut versuchen</Text></Pressable> : null}
    </View>
  </View>;

  return (
    <ImageBackground source={activeBackground.image} resizeMode="cover" style={[styles.background, shortViewport && styles.shortBackground]} testID="responsive-desktop">
      <style>{workspaceCss}</style>
      <View style={[styles.desktopFrame, compact && styles.desktopFrameCompact, shortViewport && { flexGrow: 0, flexShrink: 0, flexBasis: "auto", minHeight: "100%" }]}>
      <View style={styles.atmosphere} />
      <View style={styles.topbar} onLayout={(event) => {
        const next = Math.ceil(event.nativeEvent.layout.height);
        setTopbarHeight(current => current === next ? current : next);
      }}>
        <View style={[styles.informationRow, compact && styles.informationRowCompact]}>
        <View style={[styles.glass, styles.infoCard, mobile && styles.infoCardMobile, { width: informationWidth }]} testID="desktop-clock-weather">
          <View style={[styles.clock, mobile && styles.clockMobile]}><Text style={[styles.time, mobile && styles.timeMobile]}>{now.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}</Text><Text style={[styles.date, mobile && styles.dateMobile]}>{new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "2-digit", month: "short", year: "numeric" }).format(now)}</Text></View>
          <View style={[styles.weather, mobile && styles.weatherMobile]} testID="desktop-weather">
            <Text style={styles.weatherIcon}>{weather.data?.glyph ?? "☁"}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Wetterort ändern" onPress={() => setWeatherLocationOpen(true)} style={styles.weatherCopy}>
              <Text style={styles.weatherTitle}>{weather.data ? `${weather.data.temperature} °C · ${weather.data.label}` : mobile ? "Wetter" : "Standortwetter"}</Text>
              <Text style={styles.weatherPlace}>{weather.message}</Text>
              <Text style={styles.weatherEdit}>Ort ändern</Text>
            </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={weather.status === "idle" ? "Standort für Wetter verwenden" : "Wetter aktualisieren"} disabled={weather.status === "loading"} onPress={weather.refresh} style={styles.weatherRefresh}><Text style={styles.weatherLink}>{weather.status === "loading" ? "…" : weather.status === "idle" ? "⌖" : "↻"}</Text></Pressable>
          </View>
        </View>
        <View style={[styles.glass, styles.actions, mobile && styles.actionsMobile]} testID="desktop-topbar-actions">
          <Pressable ref={menuToggleRef} accessibilityRole="button" {...({ "aria-controls": compact ? undefined : "desktop-home-navigation" } as object)} accessibilityLabel={navigationOpen ? "Navigation schließen" : "Navigation öffnen"} accessibilityState={{ expanded: navigationOpen }} onPress={() => compact ? setMobileSidebarOpen(value => !value) : setSidebarOpen(value => !value)} style={[styles.iconButton, mobile && styles.iconButtonMobile, navigationOpen && styles.iconButtonActive]}><Text style={styles.iconGlyph}>{navigationOpen ? "‹" : "☰"}</Text></Pressable>
          <PortalTextSizeControls dense={mobile} />
          {!compact ? <View style={styles.livePill}><View style={styles.liveDot} /><Text style={styles.liveText}>Live</Text></View> : null}
          <Pressable accessibilityLabel="Apps und Widgets öffnen" onPress={() => openCenter()} style={[styles.appsButton, mobile && styles.appsButtonMobile]}><Text style={styles.appsGlyph}>▦</Text>{!compact ? <Text style={styles.appsText}>Apps & Widgets</Text> : null}</Pressable>
          <Pressable accessibilityLabel={`Kontomenü von ${displayName} öffnen`} onPress={() => setProfileOpen(true)} style={[styles.profileTrigger, mobile && styles.profileTriggerMobile]}>{!narrow ? <View style={styles.profileCopy}><Text style={styles.profileName}>{displayName}</Text><Text style={styles.profileRole}>{role}</Text></View> : null}<TopbarProfileAvatar name={displayName} avatarUrl={profile?.avatarUrl?.trim() || undefined} avatarVersion={profile?.updatedAt ?? profile?.avatarUrl} accentColor="#56C7FF" size={mobile ? "sm" : "lg"} /></Pressable>
        </View>
        </View>
        <Image accessibilityLabel="CareSuite HealthOS" source={BRAND} resizeMode="contain" style={[styles.logo, compact && styles.logoCompact, { width: informationWidth, height: informationWidth / 8 }]} />
      </View>

      <View style={[styles.workspace, compact && styles.workspaceCompact, {
        gridTemplateColumns: compact ? 'minmax(0, 1fr)' : `${sidebarOpen ? sidebarWidth : railWidth}px minmax(0, 1fr)`,
      } as unknown as ViewStyle, shortViewport && { flexGrow: 0, flexShrink: 0, flexBasis: "auto", height: shortWorkspaceHeight }]}
        {...{ dataSet: { csDesktopNavigationWorkspace: 'true' } }}>
        {!compact ? <View style={styles.navigationColumn}>
          <View nativeID="desktop-home-navigation"
            {...({ inert: !sidebarOpen ? true : undefined, "aria-hidden": !sidebarOpen,
              onKeyDown: (event: { key: string; preventDefault: () => void; stopPropagation: () => void }) => {
                if (event.key === 'Escape' && sidebarOpen) { event.preventDefault(); event.stopPropagation(); closeNavigation(); }
              } } as object)}
            {...{ dataSet: { csDesktopNavigationContent: 'true' } }}
            style={[styles.glass, styles.sidebar, styles.navigationContent, {
              width: sidebarWidth, opacity: sidebarOpen ? 1 : 0, pointerEvents: sidebarOpen ? 'auto' : 'none',
              transform: [{ translateX: sidebarOpen ? 0 : -12 }],
            }]}>{sidebarContent}</View>
          <View {...({ inert: sidebarOpen ? true : undefined, "aria-hidden": sidebarOpen } as object)}
            {...{ dataSet: { csDesktopNavigationRail: 'true' } }}
            style={[styles.navigationRail, { opacity: sidebarOpen ? 0 : 1, pointerEvents: sidebarOpen ? 'none' : 'auto' }]}>
            <Pressable accessibilityRole="button" accessibilityLabel="Navigation öffnen" accessibilityState={{ expanded: false }}
              {...({ "aria-controls": "desktop-home-navigation" } as object)}
              onPress={() => { setSidebarOpen(true); menuToggleRef.current?.focus(); }}
              style={({ pressed }) => [styles.glass, styles.sidebarReopen, pressed && styles.sidebarReopenPressed]}>
              <Text style={styles.sidebarReopenGlyph}>☰</Text>
              <Text style={styles.sidebarReopenLabel}>Menü</Text>
              <Text style={styles.sidebarReopenArrow}>›</Text>
            </Pressable>
          </View>
        </View> : null}

        <View
          {...(Platform.OS === "web" ? ({ dataSet: { healthosWorkspaceRevision: "r11-app-center", healthosResponsiveArtworkRevision: "r9", healthosVisualDensityRevision: "r11-calm" } } as object) : {})}
          style={styles.desktopPanel}
        >
          <View testID="desktop-workspace-header" style={[styles.glass, styles.desktopHeader, mobile && styles.desktopHeaderMobile]}>
            <View style={[styles.desktopHeading, mobile && styles.desktopHeadingMobile]}>
              <Text style={[styles.eyebrow, mobile && styles.eyebrowMobile]}>{mobile ? "Persönlicher Arbeitsplatz" : "PERSÖNLICHER ARBEITSPLATZ"}</Text>
              {!mobile ? <Text style={styles.desktopTitle}>{moduleLabel} · Mein Desktop</Text> : null}
            </View>
          <View style={styles.moduleTabs} accessibilityRole="tablist" accessibilityLabel="Desktop-Modul auswählen">
            {availableModules.map(module => <Pressable key={module.key} accessibilityRole="tab" accessibilityState={{ selected: module.key === moduleKey }} onPress={() => onModuleChange(module.key)} style={[styles.chip, module.key === moduleKey && styles.chipActive]}>
              <Text style={[styles.chipText, module.key === moduleKey && styles.chipTextActive]}>{module.label}</Text>
            </Pressable>)}
          </View>
            <View style={styles.desktopActions}>
              <View style={[styles.countPill, mobile && styles.countPillMobile]}><View style={styles.liveDot} /><Text style={[styles.countText, mobile && styles.countTextMobile]}>{mobile ? `${desktopIds.length} aktiv` : `${desktopIds.length}/${DESKTOP_SLOT_COUNT} aktiv`}</Text></View>
              <Pressable accessibilityRole="button" accessibilityLabel={editMode ? "Desktop-Bearbeitung abschließen" : "Desktop bearbeiten"} accessibilityState={{ selected: editMode }} onPress={() => setEditMode((value) => !value)} style={[styles.editButton, mobile && styles.editButtonMobile, editMode && styles.editButtonActive]}>
                <Text style={[styles.editText, mobile && styles.editTextMobile]}>{editMode ? "✓ Fertig" : "✎ Bearbeiten"}</Text>
              </Pressable>
            </View>
          </View>
          {preferencesError ? <Text accessibilityRole="alert" style={styles.desktopSubtitle}>Die Einstellungen konnten nicht gespeichert werden. Ihre Auswahl bleibt geöffnet; bitte prüfen Sie den Browserspeicher.</Text> : null}
          <ScrollView style={styles.gridScroll} {...{ dataSet: { csDesktopWidgetViewport: "true" } }} contentContainerStyle={styles.gridScrollContent} showsVerticalScrollIndicator keyboardShouldPersistTaps="handled">
            <View style={styles.grid} {...{ dataSet: { csDesktopWidgetGrid: "true" } }} testID="desktop-widget-grid">
              {slots.map((widget, index) => (
                <View key={widget?.id ?? `empty-${index}`} style={styles.cell}>
                  {widget ? (
                    <Pressable accessibilityRole="button" accessibilityLabel={`${widget.label} öffnen`} onPress={() => !editMode && openWidget(widget)} style={({ pressed }) => [styles.widgetCard, pressed && !editMode && styles.widgetPressed, editMode && styles.widgetEditing]}>
                      <View style={styles.labelBar} {...{ dataSet: { csDesktopWidgetLabel: "true" } }}><Text accessibilityRole="header" style={styles.widgetLabel}>{widget.label}</Text><Text style={styles.arrow}>↗</Text></View>
                      <View style={styles.imageStage} {...{ dataSet: { csDesktopWidgetArtwork: "true" } }}>
                        <>{widget.workspaceService ? <GoogleWorkspaceWidget service={widget.workspaceService} fontScale={effectiveScale}/> : <Image source={widget.images!.medium} resizeMode="contain" style={styles.widgetImage} />}</>
                        {!widget.workspaceService && <View style={styles.categoryPill}><Text style={styles.categoryText}>{widget.category}</Text></View>}
                        {editMode ? <Pressable accessibilityRole="button" accessibilityLabel={`${widget.label} entfernen`} onPress={(event) => { event.stopPropagation(); togglePinned(widget.id); }} style={styles.removeButton}><Text style={styles.removeText}>×</Text></Pressable> : null}
                      </View>
                    </Pressable>
                  ) : (
                    <Pressable accessibilityRole="button" accessibilityLabel="Widget hinzufügen" onPress={() => openCenter("widgets")} style={styles.emptyCard} {...{ dataSet: { csDesktopWidgetEmpty: "true" } }}><Text style={styles.emptyPlus}>＋</Text><Text style={styles.emptyTitle}>Hinzufügen</Text><Text style={styles.emptyCopy}>Desktop-Widget auswählen</Text></Pressable>
                  )}
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      </View>

      <DesktopWeatherLocationDialog visible={weatherLocationOpen} place={weather.place} preferenceError={weather.preferenceError}
        onChoose={weather.choosePlace} onClose={() => setWeatherLocationOpen(false)} />
      <Modal transparent animationType="fade" visible={compact && mobileSidebarOpen} onRequestClose={() => setMobileSidebarOpen(false)}>
        <Pressable onPress={() => setMobileSidebarOpen(false)} style={styles.navigationBackdrop}>
          <Pressable onPress={event => event.stopPropagation()} style={[styles.glass, styles.sidebar, styles.sidebarDrawer, { width: Math.min(width - 24, 300 * fontScale) }]}>{sidebarContent}</Pressable>
        </Pressable>
      </Modal>
      <Modal transparent animationType="fade" visible={centerOpen} onRequestClose={() => setCenterOpen(false)}>
        <Pressable onPress={() => setCenterOpen(false)} style={styles.backdrop}><Pressable onPress={(event) => event.stopPropagation()} style={[styles.glass, styles.centerPanel]}>
          <View style={styles.centerHeader}><View style={styles.centerHeading}><Text style={styles.eyebrow}>CARESUITE HEALTHOS CENTER</Text><Text style={styles.centerTitle}>{moduleLabel} · Apps & Widgets</Text><Text style={styles.centerSubtitle}>Arbeitsbereiche öffnen und Ihren Desktop gestalten.</Text></View><Pressable accessibilityLabel="Center schließen" onPress={() => setCenterOpen(false)} style={styles.closeButton}><Text style={styles.closeText}>×</Text></Pressable></View>
          <ScrollView style={styles.centerScroll} contentContainerStyle={styles.centerContent} keyboardShouldPersistTaps="handled">
          <View style={styles.centerToolbar}><View style={styles.tabs}>{(["apps", "widgets", "workflows", "backgrounds"] as const).map((tab) => <Pressable key={tab} accessibilityRole="tab" accessibilityState={{ selected: tab === centerTab }} onPress={() => setCenterTab(tab)} style={[styles.tab, tab === centerTab && styles.tabActive]}><Text style={[styles.tabText, tab === centerTab && styles.tabTextActive]}>{tab === "apps" ? "Apps" : tab === "widgets" ? "Widgets" : tab === "workflows" ? "Workflows" : "Hintergründe"}</Text></Pressable>)}</View>{centerTab === "apps" || centerTab === "widgets" ? <View style={styles.search}><Text style={styles.searchGlyph}>⌕</Text><TextInput nativeID="desktop-catalog-search" accessibilityLabel={centerTab === "apps" ? "Apps durchsuchen" : "Widgets durchsuchen"} placeholder={`${category} durchsuchen …`} placeholderTextColor="#8FA9C2" value={query} onChangeText={setQuery} style={[styles.searchInput, { fontSize: 16 * fontScale }]} /></View> : null}</View>
          {centerTab === "apps" || centerTab === "widgets" ? <View style={styles.chips}>{CATEGORIES.map((item) => <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: item === category }} onPress={() => setCategory(item)} style={[styles.chip, item === category && styles.chipActive]}><Text style={[styles.chipText, item === category && styles.chipTextActive]}>{item}</Text></Pressable>)}</View> : null}
          {centerTab === "apps" || centerTab === "widgets" ? <View style={styles.catalogIntro}>
            <Text style={styles.centerCardTitle}>{centerTab === "apps" ? `${category} · Arbeitsbereiche` : `${category} · Desktop-Widgets`}</Text>
            <Text style={styles.centerSubtitle}>{centerTab === "apps"
              ? "Öffnen Sie eine App, um im vollständigen Arbeitsbereich zu arbeiten."
              : "Live-Widgets zeigen Daten auf Ihrem Desktop. Schnellzugriffe öffnen eine Seite."}</Text>
            {centerTab === "widgets" ? <Text accessibilityLiveRegion="polite" style={styles.catalogCapacity}>
              {desktopIds.length} von {DESKTOP_SLOT_COUNT} Desktop-Plätzen belegt.{desktopIds.length >= DESKTOP_SLOT_COUNT ? " Entfernen Sie ein Widget, um Platz zu schaffen." : ""}
            </Text> : null}
          </View> : null}
          {(centerTab === "apps" || centerTab === "widgets") && resultCount === 0 ? <View style={styles.emptySearch}>
            <Text style={styles.centerCardTitle}>{centerTab === "apps" ? "Keine passenden Apps" : "Keine passenden Widgets"}</Text>
            <Text style={styles.centerSubtitle}>Ändern Sie den Suchbegriff oder wählen Sie eine andere Kategorie.</Text>
            <Pressable accessibilityRole="button" onPress={() => setQuery("")} style={styles.appsButton}><Text style={styles.appsText}>Suche zurücksetzen</Text></Pressable>
          </View> : null}
            {centerTab === "workflows" ? <View style={styles.workflowGrid}>{WORKFLOWS.filter(workflow => desktopModuleForRoute(workflow.route) === moduleKey).map((workflow) => <Pressable key={workflow.id} onPress={() => { setCenterOpen(false); router.push(workflow.route as never); }} style={({ pressed }) => [styles.workflowCard, pressed && styles.widgetPressed]}><View style={styles.workflowIcon}><Text style={styles.workflowGlyph}>{workflow.glyph}</Text></View><Text style={styles.workflowTitle}>{workflow.label}</Text><Text style={styles.workflowCopy}>{workflow.text}</Text><View style={styles.workflowFooter}><Text style={styles.workflowLink}>Workflow starten</Text><Text style={styles.arrow}>↗</Text></View></Pressable>)}</View> : centerTab === "backgrounds" ? <View style={styles.backgroundGrid}>{BACKGROUNDS.map((background) => { const selected = background.id === backgroundId; return <Pressable key={background.id} accessibilityLabel={`${background.label} als Desktop-Hintergrund verwenden`} accessibilityState={{ selected }} onPress={() => setBackgroundId(background.id)} style={({ pressed }) => [styles.backgroundCard, selected && styles.backgroundCardSelected, pressed && styles.widgetPressed]}><Image source={background.thumbnail ?? background.image} resizeMode="cover" style={styles.backgroundPreview} /><View style={styles.backgroundFooter}><View><Text style={styles.backgroundTitle}>{background.label}</Text><Text style={styles.backgroundCopy}>{selected ? "Aktiver Hintergrund" : "Auswählen"}</Text></View><View style={[styles.backgroundCheck, selected && styles.backgroundCheckSelected]}><Text style={styles.backgroundCheckText}>{selected ? "✓" : ""}</Text></View></View></Pressable>; })}</View> : centerTab === "apps" ? <View style={styles.centerGrid} testID="app-catalog">
              {filteredApps.map(app => <View key={app.route} style={[styles.centerCell, { flexBasis: 300 * fontScale }]}>
                <Pressable accessibilityRole="button" accessibilityLabel={`App ${app.label} öffnen`} onPress={() => openWidget(app)}
                  style={({ pressed }) => [styles.centerCard, styles.appCard, pressed && styles.widgetPressed]}>
                  <View style={styles.appIdentity}><View style={styles.appGlyphBox}><Text style={styles.appGlyph}>{app.glyph ?? "↗"}</Text></View>
                    <View style={styles.appTitleCopy}><Text style={styles.centerCardTitle}>{app.label}</Text>
                      <Text style={styles.catalogKind}>{app.group ?? app.category}</Text></View></View>
                  <Text style={styles.centerCardCopy}>{app.description}</Text>
                  <Text style={styles.appOpenText}>Arbeitsbereich öffnen ↗</Text>
                </Pressable>
              </View>)}
            </View> : <View style={styles.centerGrid} testID="widget-catalog">
              {filteredWidgets.map(widget => {
                const pinned = desktopIds.includes(widget.id);
                const full = desktopIds.length >= DESKTOP_SLOT_COUNT;
                return <View key={widget.id} style={[styles.centerCell, { flexBasis: 300 * fontScale }]}>
                  <View style={[styles.centerCard, styles.catalogWidgetCard]}>
                    <View style={styles.centerBody}><Text style={styles.centerCardTitle}>{widget.label}</Text>
                      <Text style={styles.catalogKind}>{widget.workspaceService ? "Live-Widget · Vorschau" : "Schnellzugriff · Vorschau"}</Text></View>
                    <View style={[styles.centerImageStage, { height: 120 * fontScale }]}>
                      {widget.workspaceService ? <GoogleWorkspaceWidget service={widget.workspaceService} preview fontScale={effectiveScale}/>
                        : <Image source={widget.images!.small} resizeMode="contain" style={styles.centerImage} />}
                    </View>
                    <View style={styles.centerBody}>
                      <Text style={styles.centerCardCopy}>{widget.workspaceService ? widget.description : `Öffnet ${widget.label} direkt von Ihrem Desktop.`}</Text>
                      <Text accessibilityLiveRegion="polite" style={styles.catalogKind}>{pinned ? "Auf Ihrem Desktop" : "Noch nicht auf dem Desktop"}</Text>
                      <Pressable accessibilityRole="button" accessibilityLabel={`${widget.label} ${pinned ? "vom Desktop entfernen" : "zum Desktop hinzufügen"}`}
                        accessibilityState={{ disabled: !pinned && full }} disabled={!pinned && full} onPress={() => togglePinned(widget.id)}
                        style={[styles.pinButton, styles.catalogPinButton, pinned && styles.pinActive, !pinned && full && styles.pinDisabled]}>
                        <Text style={styles.pinText}>{pinned ? "− Vom Desktop entfernen" : full ? "Desktop voll" : "+ Zum Desktop hinzufügen"}</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>;
              })}
            </View>}

          </ScrollView>
        </Pressable></Pressable>
      </Modal>

      <Modal transparent animationType="fade" visible={profileOpen} onRequestClose={() => setProfileOpen(false)}>
        <Pressable onPress={() => setProfileOpen(false)} style={styles.backdrop}><Pressable onPress={(event) => event.stopPropagation()} style={[styles.glass, styles.profilePanel]}><View style={styles.profileHeader}><TopbarProfileAvatar name={displayName} avatarUrl={profile?.avatarUrl?.trim() || undefined} avatarVersion={profile?.updatedAt ?? profile?.avatarUrl} accentColor="#56C7FF" size="lg" /><View style={styles.profileIdentity}><Text style={styles.profilePanelName}>{displayName}</Text><Text style={styles.profilePanelRole}>{role}</Text></View><Pressable onPress={() => setProfileOpen(false)} style={styles.closeButton}><Text style={styles.closeText}>×</Text></Pressable></View><View style={styles.profileDivider} /><Pressable onPress={() => { setProfileOpen(false); router.push("/settings/profile" as never); }} style={styles.profileRow}><View><Text style={styles.profileRowTitle}>Profil & Sicherheit</Text><Text style={styles.profileRowCopy}>Persönliche Angaben, Profilbild und Zugang</Text></View><Text style={styles.arrow}>›</Text></Pressable><View style={styles.profileDivider} /><Pressable accessibilityLabel="Sicher abmelden" onPress={() => void signOut()} style={styles.logout}><Text style={styles.logoutText}>↪  Sicher abmelden</Text></Pressable></Pressable></Pressable>
      </Modal>
      </View>
    </ImageBackground>
  );
}

const glassWeb = Platform.OS === "web" ? ({ backdropFilter: "blur(26px) saturate(1.18)", boxShadow: "0 12px 26px rgba(43,184,255,0.2)" } as const) : null;
const glassNativeShadow = Platform.OS !== "web" ? ({ shadowColor: "#2BB8FF", shadowOpacity: 0.2, shadowRadius: 26, shadowOffset: { width: 0, height: 12 } } as const) : null;
const transitionWeb = Platform.OS === "web" ? ({ transition: "transform 300ms cubic-bezier(.2,.8,.2,1), border-color 240ms ease" } as const) : null;
const styles = StyleSheet.create({
  moduleTabs: { flexDirection: "row", flexWrap: "wrap", gap: 8, flexShrink: 1, minWidth: 0 },
  actionsMobile: { alignSelf: "center", minHeight: 52, padding: 4, gap: 4, borderRadius: 16, justifyContent: "center" },
  iconButtonMobile: { width: 44, height: 44, borderRadius: 12 },
  appsButtonMobile: { width: 44, minHeight: 44, paddingHorizontal: 0, justifyContent: "center", borderRadius: 12 },
  profileTriggerMobile: { minHeight: 44, minWidth: 44, paddingHorizontal: 0, justifyContent: "center" },
  logoCompact: { alignSelf: "center" },
  infoCardMobile: { minHeight: 70, flexWrap: "nowrap", paddingHorizontal: 10, paddingVertical: 7, gap: 8, borderRadius: 16 },
  clockMobile: { minWidth: 0, flexBasis: "42%" },
  weatherMobile: { flex: 1, minWidth: 0, gap: 4 },
  dateMobile: { fontSize: 13, lineHeight: 18 },
  timeMobile: { fontSize: 30, lineHeight: 35 },
  desktopHeaderMobile: { minHeight: 62, padding: 8, gap: 6, borderRadius: 16 },
  desktopHeadingMobile: { flexBasis: 80 },
  eyebrowMobile: { fontSize: 13, lineHeight: 18, letterSpacing: 0.2 },
  countTextMobile: { fontSize: 12 },
  countPillMobile: { minHeight: 36, paddingHorizontal: 6, paddingVertical: 6, alignSelf: "center", gap: 4 },
  editButtonMobile: { minHeight: 44, paddingHorizontal: 8, paddingVertical: 6 },
  editTextMobile: { fontSize: 13 },
  navSearch: { borderWidth: 1, borderColor: "rgba(126,205,255,0.3)", borderRadius: 12, paddingHorizontal: 10, marginBottom: 12, backgroundColor: "rgba(1,11,28,0.7)" },
  navEntryCopy: { flex: 1, minWidth: 0, gap: 3 },
  navEntryContext: { color: "#AFC9DC", fontSize: 11, lineHeight: 16 },
  catalogIntro: { gap: 5, paddingVertical: 12 },
  catalogCapacity: { color: "#BEEBFA", fontSize: 13, lineHeight: 20, marginTop: 4 },
  catalogKind: { color: "#AFC9DC", fontSize: 12, lineHeight: 18, marginTop: 4 },
  appCard: { minHeight: 180, height: "100%", padding: 16, gap: 12 },
  appIdentity: { flexDirection: "row", gap: 12, alignItems: "center" },
  appTitleCopy: { flex: 1, minWidth: 0 },
  appGlyphBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(72,192,237,0.14)", alignItems: "center", justifyContent: "center" },
  appGlyph: { color: "#81DFFF", fontSize: 20, fontWeight: "800" },
  appOpenText: { color: "#81DFFF", fontSize: 13, lineHeight: 20, fontWeight: "800", marginTop: "auto", paddingTop: 8 },
  catalogWidgetCard: { height: "100%" },
  catalogPinButton: { marginTop: 12, alignItems: "center" },
  shortBackground: { overflow: "scroll" },
  background: { flex: 1, width: "100%", height: "100%", backgroundColor: "#03132B", overflow: "hidden" },
  atmosphere: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,10,27,0.2)" },
  glass: { backgroundColor: "rgba(2,15,35,0.76)", borderWidth: 1, borderColor: "rgba(139,211,255,0.3)", ...glassNativeShadow, ...glassWeb },
  desktopFrame: { flex: 1, minHeight: 0, width: "100%", padding: 20, gap: 16 }, desktopFrameCompact: { padding: 12, gap: 12 }, loadingHost: { justifyContent: "center", alignItems: "center", padding: 24 }, loadingCard: { width: "100%", maxWidth: 600, borderRadius: 24, padding: 24, gap: 18 },
  topbar: { zIndex: 20, flexShrink: 0, gap: 8 },
  informationRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "stretch", justifyContent: "space-between", gap: 12 },
  informationRowCompact: { width: "100%", flexDirection: "column", flexWrap: "nowrap", alignItems: "center", justifyContent: "center" },
  logo: { maxWidth: "100%", alignSelf: "flex-start" },
  infoCard: { maxWidth: "100%", minHeight: 80, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 14 },
  clock: { flexShrink: 1, minWidth: 150 },
  time: { color: "#FFF", fontSize: 34, lineHeight: 39, fontWeight: "900", letterSpacing: -1 }, date: { color: "#D8EAFF", fontSize: 15, lineHeight: 21, fontWeight: "700" },
  weather: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1, maxWidth: "100%" }, weatherCopy: { flexShrink: 1, minHeight: 44, maxWidth: 210, justifyContent: "center" },
  weatherIcon: { color: "#8FE4FF", fontSize: 25 }, weatherTitle: { color: "#FFF", fontSize: 16, lineHeight: 21, fontWeight: "800" }, weatherPlace: { color: "#BCD4EC", fontSize: 12, lineHeight: 17 },
  weatherRefresh: { minHeight: 44, minWidth: 36, alignItems: "center", justifyContent: "center" }, weatherLink: { color: "#8FE4FF", fontSize: 17, lineHeight: 22 }, weatherEdit: { color: "#8FE4FF", fontSize: 12, lineHeight: 18, fontWeight: "700" },
  actions: { flexWrap: "wrap", maxWidth: "100%", minHeight: 64, borderRadius: 20, padding: 6, flexDirection: "row", alignItems: "center", alignContent: "center", gap: 8 },
  iconButton: { width: 46, height: 46, borderRadius: 15, borderWidth: 1, borderColor: "rgba(146,205,255,0.25)", backgroundColor: "rgba(8,29,59,0.64)", alignItems: "center", justifyContent: "center" }, iconButtonActive: { borderColor: "rgba(102,224,255,0.72)", backgroundColor: "rgba(13,91,130,0.76)" }, iconGlyph: { color: "#FFF", fontSize: 20 },
  livePill: { height: 46, borderRadius: 15, paddingHorizontal: 13, borderWidth: 1, borderColor: "rgba(70,171,255,0.42)", flexDirection: "row", alignItems: "center", gap: 7 }, liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#58D8C1", ...(Platform.OS === "web" ? ({ boxShadow: "0 0 8px rgba(88,216,193,0.9)" } as const) : ({ shadowColor: "#58D8C1", shadowOpacity: 0.9, shadowRadius: 8 } as const)) }, liveText: { color: "#FFF", fontSize: 16, fontWeight: "800" },
  appsButton: { minHeight: 46, paddingVertical: 8, borderRadius: 15, paddingHorizontal: 14, borderWidth: 1, borderColor: "rgba(104,222,255,0.58)", backgroundColor: "rgba(9,75,111,0.78)", flexDirection: "row", alignItems: "center", gap: 8 }, appsGlyph: { color: "#83E8FF", fontSize: 21 }, appsText: { color: "#F3FCFF", fontSize: 16, fontWeight: "900" },
  profileTrigger: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 4 }, profileCopy: { maxWidth: 180, alignItems: "flex-end" }, profileName: { color: "#FFF", fontSize: 16, fontWeight: "900" }, profileRole: { color: "#BFD8EE", fontSize: 13, marginTop: 2, fontWeight: "700" },
  workspace: { flex: 1, minHeight: 0, minWidth: 0, zIndex: 5, display: "grid", gridTemplateRows: "minmax(0, 1fr)", alignContent: "stretch", alignItems: "stretch", gap: 18 } as unknown as ViewStyle, workspaceCompact: { gap: 0 },
  navigationColumn: { minWidth: 0, minHeight: 0, height: "100%", alignSelf: "stretch", position: "relative", overflow: "hidden", borderRadius: 28 },
  navigationContent: { position: "absolute", top: 0, bottom: 0, left: 0 },
  navigationRail: { position: "absolute", top: 0, left: 0, right: 0, alignItems: "stretch" },
  sidebarReopen: { width: "100%", minHeight: 116, paddingVertical: 12, borderRadius: 22, alignItems: "center", justifyContent: "center", gap: 9, borderColor: "rgba(103,224,255,0.62)", backgroundColor: "rgba(3,28,58,0.9)", ...transitionWeb }, sidebarReopenPressed: { transform: [{ scale: 0.96 }], backgroundColor: "rgba(10,75,105,0.94)" },
  sidebarReopenGlyph: { color: "#8BE8FF", fontSize: 21, fontWeight: "900" }, sidebarReopenLabel: { color: "#F2FBFF", fontSize: 13, lineHeight: 20, fontWeight: "700" }, sidebarReopenArrow: { color: "#8BE8FF", fontSize: 28, lineHeight: 28, fontWeight: "500" },
  navigationBackdrop: { flex: 1, backgroundColor: "rgba(0,5,16,0.68)", padding: 12, alignItems: "flex-start" }, sidebarDrawer: { backgroundColor: "#091B32", maxWidth: "100%" }, navScroller: { flex: 1, minHeight: 0 },
  sidebar: { flexShrink: 0, height: "100%", borderRadius: 28, overflow: "hidden" }, sidebarInner: { flex: 1, minHeight: 0, padding: 12 }, sidebarHeader: { minHeight: 61, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 5, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "rgba(139,211,255,0.16)" },
  eyebrow: { color: "#72DEFF", fontSize: 12, lineHeight: 18, fontWeight: "800", letterSpacing: 1.2 }, sidebarTitle: { color: "#FFF", fontSize: 22, fontWeight: "900" }, closeSmall: { width: 34, height: 34, borderRadius: 12, borderWidth: 1, borderColor: "rgba(126,214,255,0.28)", alignItems: "center", justifyContent: "center" }, closeSmallText: { color: "#CDEFFF", fontSize: 25 },
  navScroll: { paddingTop: 10, paddingBottom: 12 }, navGroup: { marginBottom: 10 }, navGroupTitle: { color: "rgba(174,208,232,0.64)", fontSize: 13, fontWeight: "900", letterSpacing: 1.2, textTransform: "uppercase", paddingHorizontal: 8, marginBottom: 5 },
  navItem: { minHeight: 44, paddingVertical: 6, borderRadius: 14, paddingHorizontal: 7, flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 3, borderWidth: 1, borderColor: "transparent" }, navItemActive: { backgroundColor: "rgba(18,101,145,0.55)", borderColor: "rgba(104,222,255,0.38)" }, navIcon: { width: 29, height: 29, borderRadius: 10, backgroundColor: "rgba(103,181,226,0.1)", alignItems: "center", justifyContent: "center" }, navGlyph: { color: "#93E7FF", fontSize: 14 }, navLabel: { flex: 1, minWidth: 0, color: "#E6F1FA", fontSize: 16, fontWeight: "800" }, navArrow: { color: "rgba(137,216,245,0.56)", fontSize: 19 },
  sidebarCenter: { minHeight: 64, paddingVertical: 10, marginTop: 8, borderRadius: 17, borderWidth: 1, borderColor: "rgba(100,222,255,0.38)", backgroundColor: "rgba(10,74,108,0.56)", paddingHorizontal: 11, flexDirection: "row", alignItems: "center", gap: 10 }, sidebarCenterPlus: { color: "#78E5FF", fontSize: 23 }, sidebarCenterTitle: { color: "#FFF", fontSize: 16, fontWeight: "900" }, sidebarCenterCopy: { color: "#A9CBE0", fontSize: 13 },
  sidebarBackground: { minHeight: 64, paddingVertical: 10, marginTop: 7, borderRadius: 16, borderWidth: 1, borderColor: "rgba(152,190,255,0.28)", backgroundColor: "rgba(26,47,91,0.62)", paddingHorizontal: 11, flexDirection: "row", alignItems: "center", gap: 10 }, sidebarBackgroundGlyph: { color: "#A8CFFF", fontSize: 21 },
  desktopPanel: { minHeight: 0, minWidth: 0, height: "100%", alignSelf: "stretch", display: "grid", gridTemplateRows: "auto minmax(0, 1fr)", alignContent: "stretch" } as unknown as ViewStyle, topLine: { position: "absolute", top: 0, left: 54, right: 54, height: 1, backgroundColor: "rgba(204,244,255,0.62)" },
  desktopHeader: { alignSelf: "center", width: "100%", maxWidth: 2400, borderRadius: 20, padding: 12, flexShrink: 0, flexWrap: "wrap", minHeight: 74, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16 }, desktopHeading: { flexGrow: 1, flexBasis: 280, maxWidth: "100%", minWidth: 0 }, desktopTitle: { color: "#F7FCFF", fontSize: 28, lineHeight: 34, fontWeight: "900", letterSpacing: -0.6 }, desktopSubtitle: { color: "#D2E5F4", fontSize: 16, lineHeight: 24, fontWeight: "700" }, desktopActions: { flexWrap: "wrap", flexDirection: "row", gap: 7 }, countPill: { minHeight: 42, paddingVertical: 8, borderRadius: 13, paddingHorizontal: 10, borderWidth: 1, borderColor: "rgba(105,207,242,0.22)", flexDirection: "row", alignItems: "center", gap: 6 }, countText: { color: "#CEE6F3", fontSize: 13, fontWeight: "900" }, editButton: { minHeight: 42, paddingVertical: 8, borderRadius: 13, paddingHorizontal: 11, borderWidth: 1, borderColor: "rgba(126,214,255,0.28)", backgroundColor: "rgba(7,36,67,0.7)", justifyContent: "center" }, editButtonActive: { borderColor: "rgba(103,230,197,0.62)", backgroundColor: "rgba(24,107,91,0.68)" }, editText: { color: "#EAF8FF", fontSize: 16, fontWeight: "900" },
  gridScroll: { flex: 1, minHeight: 0, minWidth: 0 }, gridScrollContent: { paddingTop: 12, paddingBottom: 12 }, grid: { width: "100%", maxWidth: 2400, alignSelf: "center", minWidth: 0 }, cell: { minWidth: 0, maxWidth: "100%" },
  widgetCard: { flex: 1, borderRadius: 18, borderWidth: 1, borderColor: "rgba(131,203,245,0.22)", backgroundColor: "rgba(1,12,29,0.78)", overflow: "hidden", ...transitionWeb }, widgetHovered: { transform: [{ translateY: -3 }, { scale: 1.012 }], borderColor: "rgba(102,221,255,0.62)", ...(Platform.OS === "web" ? ({ boxShadow: "0 8px 20px rgba(66,206,255,0.38)" } as const) : ({ shadowColor: "#42CEFF", shadowOpacity: 0.38, shadowRadius: 20 } as const)) }, widgetPressed: { transform: [{ scale: 0.988 }] }, widgetEditing: { borderColor: "rgba(96,225,194,0.46)", backgroundColor: "rgba(4,35,45,0.82)" },
  imageStage: { height: 178, margin: 10, marginTop: 0, marginBottom: 10, borderRadius: 13, backgroundColor: "rgba(4,23,47,0.5)", alignItems: "center", justifyContent: "center", overflow: "hidden" }, widgetImage: { width: "100%", maxWidth: 400, height: "100%", opacity: 0.92 }, categoryPill: { position: "absolute", top: 7, left: 7, borderRadius: 9, paddingHorizontal: 7, paddingVertical: 4, backgroundColor: "rgba(1,14,31,0.78)" }, categoryText: { color: "#B9DCEB", fontSize: 11, fontWeight: "900", textTransform: "uppercase" }, removeButton: { position: "absolute", top: 7, right: 7, width: 44, height: 44, borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,159,176,0.52)", backgroundColor: "rgba(91,15,33,0.9)", alignItems: "center", justifyContent: "center" }, removeText: { color: "#FFD4DC", fontSize: 20 },
  labelBar: { minHeight: 64, paddingVertical: 8, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 12 }, widgetLabel: { flex: 1, minWidth: 0, color: "#F3FBFF", fontSize: 18, lineHeight: 24, fontWeight: "700" }, arrow: { color: "#77DFFF", fontSize: 13, fontWeight: "900" },
  emptyCard: { borderRadius: 18, borderWidth: 1, borderStyle: "dashed", borderColor: "rgba(126,208,244,0.25)", backgroundColor: "rgba(4,23,44,0.34)", alignItems: "center", justifyContent: "center" }, emptyHovered: { borderColor: "rgba(105,226,255,0.65)", backgroundColor: "rgba(8,54,78,0.5)" }, emptyPlus: { color: "#78E4FF", fontSize: 24 }, emptyTitle: { color: "#E9F8FF", fontSize: 13, fontWeight: "900" }, emptyCopy: { color: "#91B5CA", fontSize: 11, marginTop: 2 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,5,16,0.8)", alignItems: "center", justifyContent: "center", padding: 18 }, centerPanel: { width: "100%", maxWidth: 1240, height: "86%", maxHeight: 830, borderRadius: 30, padding: 20, overflow: "hidden" }, centerHeader: { minHeight: 74, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", paddingBottom: 12 }, centerHeading: { flex: 1, minWidth: 0, paddingRight: 12 }, centerTitle: { color: "#FFF", fontSize: 31, fontWeight: "900" }, centerSubtitle: { color: "#AFC9DC", fontSize: 13, marginTop: 3 }, closeButton: { width: 38, height: 38, borderRadius: 14, borderWidth: 1, borderColor: "rgba(145,211,245,0.2)", backgroundColor: "rgba(255,255,255,0.07)", alignItems: "center", justifyContent: "center" }, closeText: { color: "#FFF", fontSize: 27 },
  centerToolbar: { flexWrap: "wrap", gap: 10, minHeight: 49, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, borderBottomWidth: 1, borderColor: "rgba(128,205,242,0.13)", paddingVertical: 7 }, tabs: { flexDirection: "row", flexWrap: "wrap", gap: 5 }, tab: { minHeight: 40, paddingVertical: 8, borderRadius: 12, paddingHorizontal: 15, justifyContent: "center" }, tabActive: { backgroundColor: "rgba(22,117,163,0.64)", borderWidth: 1, borderColor: "rgba(98,220,255,0.42)" }, tabText: { color: "#9DBACD", fontSize: 13, fontWeight: "900" }, tabTextActive: { color: "#FFF" }, search: { flexGrow: 1, flexBasis: 280, maxWidth: "100%", minWidth: 0, minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: "rgba(126,205,255,0.25)", backgroundColor: "rgba(1,11,28,0.7)", paddingHorizontal: 11, flexDirection: "row", alignItems: "center", gap: 7 }, searchGlyph: { color: "#80DFFF", fontSize: 17 }, searchInput: { backgroundColor: "transparent", borderWidth: 0, flex: 1, minWidth: 0, minHeight: 42, color: "#FFF", fontSize: 16 },
  chips: { minHeight: 46, flexWrap: "wrap", flexDirection: "row", gap: 7, paddingVertical: 8 }, chip: { minHeight: 36, paddingVertical: 7, borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: "rgba(126,205,255,0.16)", justifyContent: "center" }, chipActive: { borderColor: "rgba(104,224,255,0.48)", backgroundColor: "rgba(14,87,123,0.72)" }, chipText: { color: "#9FBDD0", fontSize: 13, fontWeight: "900" }, chipTextActive: { color: "#FFF" }, centerScroll: { flex: 1, minHeight: 0 }, emptySearch: { padding: 24, gap: 16, alignItems: "flex-start" }, centerContent: { paddingTop: 8, paddingBottom: 4 }, centerGrid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -5 }, centerCell: { flexGrow: 1, flexBasis: 300, maxWidth: "100%", padding: 5 },
  centerCard: { minHeight: 204, borderRadius: 18, borderWidth: 1, borderColor: "rgba(126,205,255,0.18)", backgroundColor: "rgba(3,20,43,0.74)", overflow: "hidden", ...transitionWeb }, centerCardHovered: { transform: [{ translateY: -2 }], borderColor: "rgba(101,224,255,0.54)", ...(Platform.OS === "web" ? ({ boxShadow: "0 7px 16px rgba(65,206,255,0.24)" } as const) : ({ shadowColor: "#41CEFF", shadowOpacity: 0.24, shadowRadius: 16 } as const)) }, centerImageStage: { height: 120, marginHorizontal: 12, marginBottom: 0, borderRadius: 13, backgroundColor: "rgba(2,15,34,0.72)", alignItems: "center", justifyContent: "center", overflow: "hidden" }, centerImage: { width: "100%", height: "100%" }, centerCategory: { position: "absolute", top: 7, left: 7, color: "#9CDDF2", fontSize: 11, fontWeight: "900", textTransform: "uppercase", backgroundColor: "rgba(1,12,29,0.82)", paddingHorizontal: 7, paddingVertical: 4, borderRadius: 9 }, centerBody: { padding: 12 }, centerCardTitle: { color: "#FFF", fontSize: 16, fontWeight: "900" }, centerCardCopy: { color: "#9CBACD", fontSize: 13, lineHeight: 19, minHeight: 26, marginTop: 3 }, centerFooter: { minHeight: 31, marginTop: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, pinButton: { minHeight: 40, paddingVertical: 8, borderRadius: 11, paddingHorizontal: 10, borderWidth: 1, borderColor: "rgba(104,218,255,0.32)", backgroundColor: "rgba(9,61,91,0.64)", justifyContent: "center" }, pinActive: { borderColor: "rgba(94,226,191,0.48)", backgroundColor: "rgba(24,107,91,0.64)" }, pinDisabled: { opacity: 0.42 }, pinText: { color: "#BEEBFA", fontSize: 11, fontWeight: "900" }, openText: { color: "#7EDFFF", fontSize: 11, fontWeight: "900" },
  workflowGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 }, workflowCard: { flexGrow: 1, flexBasis: 280, maxWidth: "100%", minHeight: 225, borderRadius: 20, borderWidth: 1, borderColor: "rgba(126,205,255,0.2)", backgroundColor: "rgba(4,23,48,0.78)", padding: 18, ...transitionWeb }, workflowIcon: { width: 47, height: 47, borderRadius: 16, backgroundColor: "rgba(67,199,237,0.14)", alignItems: "center", justifyContent: "center" }, workflowGlyph: { color: "#83E9FF", fontSize: 24 }, workflowTitle: { color: "#FFF", fontSize: 17, fontWeight: "900", marginTop: 16 }, workflowCopy: { color: "#A3C0D2", fontSize: 13, lineHeight: 17, marginTop: 6, flex: 1 }, workflowFooter: { marginTop: 17, borderTopWidth: 1, borderTopColor: "rgba(121,202,240,0.14)", paddingTop: 11, flexDirection: "row", justifyContent: "space-between" }, workflowLink: { color: "#AEEBFA", fontSize: 13, fontWeight: "900" },
  backgroundGrid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -5 }, backgroundCard: { flexGrow: 1, flexBasis: 260, maxWidth: "100%", padding: 5, borderRadius: 19, borderWidth: 1, borderColor: "transparent", ...transitionWeb }, backgroundCardSelected: { borderColor: "rgba(104,225,255,0.7)", backgroundColor: "rgba(11,73,103,0.52)" }, backgroundPreview: { width: "100%", aspectRatio: 1.65, borderRadius: 14, backgroundColor: "rgba(2,13,30,0.8)" }, backgroundFooter: { minHeight: 52, paddingHorizontal: 7, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, backgroundTitle: { color: "#F4FBFF", fontSize: 13, fontWeight: "900" }, backgroundCopy: { color: "#9DBDD0", fontSize: 11, marginTop: 2 }, backgroundCheck: { width: 27, height: 27, borderRadius: 14, borderWidth: 1, borderColor: "rgba(130,207,244,0.24)", alignItems: "center", justifyContent: "center" }, backgroundCheckSelected: { borderColor: "rgba(93,229,195,0.64)", backgroundColor: "rgba(23,111,91,0.78)" }, backgroundCheckText: { color: "#D9FFF4", fontSize: 14, fontWeight: "900" },
  profilePanel: { width: "100%", maxWidth: 520, borderRadius: 27, padding: 20 }, profileHeader: { flexDirection: "row", alignItems: "center", gap: 13 }, profileIdentity: { flex: 1 }, profilePanelName: { color: "#FFF", fontSize: 18, fontWeight: "900" }, profilePanelRole: { color: "#9DDFFF", fontSize: 13, fontWeight: "800", marginTop: 2 }, profileDivider: { height: 1, backgroundColor: "rgba(138,211,255,0.2)", marginVertical: 13 }, profileRow: { minHeight: 62, borderRadius: 15, borderWidth: 1, borderColor: "rgba(122,202,255,0.18)", backgroundColor: "rgba(6,27,57,0.72)", paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, profileRowTitle: { color: "#FFF", fontSize: 12, fontWeight: "900" }, profileRowCopy: { color: "#AAC4DE", fontSize: 13, marginTop: 2 }, logout: { minHeight: 48, borderRadius: 15, borderWidth: 1, borderColor: "rgba(255,120,143,0.46)", backgroundColor: "rgba(145,25,48,0.26)", alignItems: "center", justifyContent: "center" }, logoutText: { color: "#FFDCE2", fontSize: 12, fontWeight: "900" },
});
