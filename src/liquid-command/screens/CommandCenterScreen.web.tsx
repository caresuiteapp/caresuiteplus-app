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
  type TextProps,
  type ViewStyle,
} from "react-native";
import { useDesktopPreferences, desktopPreferenceStorage } from "@/hooks/useDesktopPreferences.web";
import { DesktopAppsWidgetsCenter } from "./DesktopAppsWidgetsCenter.web";
import { DesktopCatalogArtwork } from "../components/DesktopCatalogArtwork.web";
import { canonicalDesktopCatalogRoute, filterDesktopCatalogEntries } from "../navigation/appsWidgetsCatalogModel.web";
import { confirmAction } from '@/lib/platform/confirmAction';
import { useRouter } from "expo-router";
import { useAuth } from "@/lib/auth";
import { PortalTextSizeControls } from "@/components/portal/accessibility/PortalTextSizeControls.web";
import { HelpButton } from '@/components/help/HelpButton.web';
import { TopbarProfileAvatar } from "@/components/layout/TopbarProfileAvatar";
import { useDesktopWeather } from "@/hooks/useDesktopWeather.web";
import { desktopWorkspaceCss } from "./desktopWorkspaceCss.web";
import { DesktopWeatherLocationDialog } from "./DesktopWeatherLocationDialog.web";
import { useWebFontScale } from "@/design/web/WebFontScaleProvider";
import { desktopHeaderControl, desktopHeaderControlColors } from "@/design/web/desktopHeaderControls";

import { GoogleWorkspaceWidget } from "@/components/googleWorkspace/GoogleWorkspaceWidget.web";
import {
  buildDesktopApps,
  type DesktopApp,
} from "../navigation/desktopAppCatalog.web";
import { usePermissions } from '@/hooks/usePermissions';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import { DESKTOP_MODULES, buildDesktopNavigationGroups } from '../navigation/moduleDesktop.web';
import { DESKTOP_AREAS, type DesktopAreaKey } from '../navigation/desktopAreas';
import type { ProductKey } from '@/types';
import type { PermissionKey } from '@/types/permissions';


import { BRAND, BACKGROUNDS, WIDGETS, DEFAULT_DESKTOP_IDS, WORKFLOWS, DESKTOP_SLOT_COUNT, type WidgetDefinition } from './administrationDesktopCatalog';
type CenterTab = 'apps' | 'widgets' | 'workflows' | 'backgrounds';
const ROLE_LABELS: Record<string, string> = { business_admin: "Geschäftsführung / Admin", tenant_admin: "Mandantenadministration", platform_admin: "Plattformadministration", office_admin: "Office-Administration", admin: "Administration", employee: "Mitarbeitende:r", manager: "Leitung" };

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
  const [selection, setSelection] = useState<{ identity: string; area: DesktopAreaKey } | null>(null);
  const [selectionWarning, setSelectionWarning] = useState(false);
  const selectionRequest = useRef(0);
  const currentIdentity = useRef(identity);
  currentIdentity.current = identity;
  const selectionKey = `caresuite.healthos.active-area.v1.${encodeURIComponent(identity)}`;
  useEffect(() => {
    let active = true;
    const request = ++selectionRequest.current;
    setSelectionWarning(false);
    if (!tenant || !user) return;
    void desktopPreferenceStorage.read([selectionKey]).then(([value]) => {
      if (!active || request !== selectionRequest.current) return;
      const area = DESKTOP_AREAS.find(item => item.key === value)?.key ?? 'office';
      setSelection({ identity, area });
    }).catch(() => { if (active && request === selectionRequest.current) { setSelection({ identity, area: 'office' }); setSelectionWarning(true); } });
    return () => { active = false; };
  }, [tenant, user, identity, selectionKey]);
  const selectedArea = selection?.identity === identity ? selection.area : 'office';
  const setSelectedArea = (area: DesktopAreaKey) => {
    const request = ++selectionRequest.current;
    setSelection({ identity, area });
    void desktopPreferenceStorage.write([[selectionKey, area]]).then(() => {
      if (request === selectionRequest.current && currentIdentity.current === identity) setSelectionWarning(false);
    }).catch(() => {
      if (request === selectionRequest.current && currentIdentity.current === identity) setSelectionWarning(true);
    });
  };
  const availableModules = DESKTOP_MODULES.filter(module => permissions.hasModuleGate(module.key) && permissions.can(`${module.key}.access` as PermissionKey));
  const availableSignature = availableModules.map(module => module.key).join(',');
  if (!tenant || !user || !availableSignature) return <View style={[styles.background, styles.loadingHost]}><View style={[styles.glass, styles.loadingCard]}>
    <Text style={styles.sidebarTitle}>Keine freigegebenen Arbeitsbereiche</Text>
    <Pressable onPress={() => void auth.signOut()} style={styles.editButton}><Text style={styles.editText}>Abmelden</Text></Pressable>
  </View></View>;
  if (selection?.identity !== identity) return <View style={[styles.background, styles.loadingHost]}><Text style={styles.desktopSubtitle}>Desktop wird wiederhergestellt…</Text></View>;
  return <View style={{ flex: 1, minHeight: 0 }}>{selectionWarning ? <View style={styles.desktopActions}><Text accessibilityRole="alert" style={styles.desktopSubtitle}>Der Desktop-Bereich konnte nicht dauerhaft gespeichert werden.</Text><Pressable accessibilityRole="button" accessibilityLabel="Desktop-Bereich erneut speichern" onPress={() => setSelectedArea(selectedArea)} style={styles.editButton}><Text style={styles.editText}>Erneut speichern</Text></Pressable></View> : null}<ModuleDesktopScreen key={`${identity}:${availableSignature}:${selectedArea}`} tenantId={tenant} availableSignature={availableSignature} selectedArea={selectedArea} onSelectArea={setSelectedArea} /></View>;
}

function ModuleDesktopScreen({ tenantId, availableSignature, selectedArea, onSelectArea }: { tenantId: string; availableSignature: string; selectedArea: DesktopAreaKey; onSelectArea: (area: DesktopAreaKey) => void }) {
  const availableKeys = useMemo(() => availableSignature.split(',') as ProductKey[], [availableSignature]);
  const permissions = usePermissions();
  const router = useRouter();
  const auth = useAuth();
  const { width, height } = useWindowDimensions();
  const { scale: fontScale, effectiveScale } = useWebFontScale();
  const mobile = width < 900;
  const compact = width < 900 * fontScale;
  const headerNarrow = width - (compact ? 24 : 40) < 780 * Math.max(1, fontScale);
  const headerStacked = width - (compact ? 24 : 40) < 1360 * Math.max(1, fontScale);
  const headerLogoWidth = Math.max(0, Math.min(width - (compact ? 48 : 64), Math.round(234 * Math.max(1, fontScale))));
  const workspaceCss = useMemo(() => desktopWorkspaceCss(effectiveScale, mobile), [effectiveScale, mobile]);
  const sidebarWidth = Math.round(260 * Math.max(1, fontScale));
  const railWidth = Math.round(60 * Math.max(1, fontScale));
  const menuToggleRef = useRef<View>(null);
  const navigationRailRef = useRef<View>(null);
  const navigationCloseRef = useRef<View>(null);
  const shortViewport = height < 600 * fontScale;
  const [topbarHeight, setTopbarHeight] = useState(0);
  const shortWorkspaceHeight = Math.max(220, height - topbarHeight - (compact ? 36 : 56));
  const narrow = width < 1240 * fontScale;
  const owner = auth.user?.id ?? "local";
  const weather = useDesktopWeather(owner);
  const [weatherLocationOpen, setWeatherLocationOpen] = useState(false);
  const moduleLabel = DESKTOP_AREAS.find(area => area.key === selectedArea)!.label;
  const [now, setNow] = useState(new Date());
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [desktopPage, setDesktopPage] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [centerOpen, setCenterOpen] = useState(false);
  const [centerTab, setCenterTab] = useState<CenterTab>("apps");
  const [navigationQuery, setNavigationQuery] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const profile = auth.profile;
  const displayName = profile?.displayName || auth.user?.displayName || "Profil";
  const role = roleLabel(profile?.roleKey);

  const apps = useMemo(() => {
    const catalog = buildDesktopApps(WIDGETS, profile?.roleKey);
    if (!catalog.some(app => app.route === '/business/subscription')) catalog.push({ id: 'desktop-premium', label: 'Premium', description: 'Aktuellen Tarif und verfügbare Angebote ansehen', route: '/business/subscription', category: 'Verwaltung', glyph: '◇' });
    const unique = new Map<string, DesktopApp>();
    for (const app of catalog) {
      const route = canonicalDesktopCatalogRoute(app.route);
      if (!unique.has(route)) unique.set(route, { ...app, route });
    }
    return [...unique.values()];
  }, [profile?.roleKey]);
  const matchesSearch = (app: DesktopApp, value: string) =>
    `${app.label} ${app.description} ${app.category} ${app.group ?? ""}`.toLocaleLowerCase("de-DE").includes(value.trim().toLocaleLowerCase("de-DE"));
  const areaAllowed = selectedArea === 'settings' || selectedArea === 'premium' ||
    (selectedArea === 'robotics' ? permissions.can('robotics.access' as PermissionKey) : availableKeys.includes(selectedArea as ProductKey));
  const moduleApps = useMemo(() => areaAllowed ? filterDesktopCatalogEntries(apps, selectedArea, permissions) : [], [apps, areaAllowed, selectedArea, permissions]);
  const moduleWidgets = useMemo<WidgetDefinition[]>(() => {
    const existing = areaAllowed ? filterDesktopCatalogEntries(WIDGETS, selectedArea, permissions).map(widget => ({ ...widget, route: canonicalDesktopCatalogRoute(widget.route) })) : [];
    const routes = new Set(existing.map(widget => widget.route));
    return [...existing, ...moduleApps.filter(app => !routes.has(app.route)).map(app => ({ ...app, id: `area-app:${app.id}` }))];
  }, [areaAllowed, selectedArea, moduleApps, permissions]);
  const areaWidgetById = useMemo(() => new Map(moduleWidgets.map(widget => [widget.id, widget])), [moduleWidgets]);
  const moduleWidgetIds = useMemo(() => moduleWidgets.map(widget => widget.id), [moduleWidgets]);
  const moduleDefaults = useMemo(() => moduleWidgets.filter(widget => widget.id === 'document-catalog' || DEFAULT_DESKTOP_IDS.some(id => id === widget.id) || !['office', 'assist'].includes(selectedArea)).slice(0, DESKTOP_SLOT_COUNT).map(widget => widget.id), [moduleWidgets, selectedArea]);
  const navigationGroups = (['office', 'assist', 'pflege', 'stationaer', 'beratung'].includes(selectedArea) ? buildDesktopNavigationGroups(moduleApps, [selectedArea as ProductKey], navigationQuery) : [{ title: moduleLabel, items: moduleApps.filter(app => matchesSearch(app, navigationQuery)) }].filter(group => group.items.length));
  const moduleWorkflows = useMemo(() => areaAllowed ? filterDesktopCatalogEntries(WORKFLOWS.map(workflow => ({
    ...workflow, permission: workflow.id === 'assignment' ? 'assist.assignments.manage' as PermissionKey : undefined,
  })), selectedArea, permissions) : [], [areaAllowed, selectedArea, permissions]);
  const { ready, loadError, saveStatus, desktopIds, setDesktopIds, sidebarOpen, setSidebarOpen,
    backgroundId, setBackgroundId, recoverableWidgetIds, retry } = useDesktopPreferences({
    tenantId, owner, selectedArea, availableWidgetIds: moduleWidgetIds, defaultWidgetIds: moduleDefaults,
  });
  const navigationOpen = compact ? mobileSidebarOpen : sidebarOpen;
  const activeBackground = BACKGROUNDS.find(item => item.id === backgroundId) ?? BACKGROUNDS[0];

  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => setMobileSidebarOpen(false), [compact]);
  useEffect(() => {
    setDesktopPage(0); setCenterOpen(false); setProfileOpen(false); setEditMode(false);
    setMobileSidebarOpen(false); setNavigationQuery('');
  }, [tenantId, owner, selectedArea]);
  useEffect(() => {
    if (saveStatus !== 'saving' && saveStatus !== 'error') return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [saveStatus]);

  const closeNavigation = () => {
    if (compact) setMobileSidebarOpen(false);
    else { setSidebarOpen(false); requestAnimationFrame(() => navigationRailRef.current?.focus()); }
  };
  const openCenter = (tab: CenterTab = "apps") => { setMobileSidebarOpen(false); setCenterTab(tab); setCenterOpen(true); };
  const leaveDesktop = async (action: () => void | Promise<void>) => {
    if (saveStatus === 'error' && !await confirmAction({ title: 'Auswahl noch nicht gespeichert', message: 'Die letzte Desktop-Auswahl konnte nicht gespeichert werden. Möchten Sie den Bereich trotzdem verlassen? Sie können abbrechen und das Speichern erneut versuchen.', confirmLabel: 'Trotzdem verlassen' })) return;
    await action();
  };
  const openWidget = (widget: Pick<DesktopApp, "route">) => { void leaveDesktop(() => { setCenterOpen(false); setMobileSidebarOpen(false); router.push(widget.route as never); }); };
  const togglePinned = (id: string) => moduleWidgetIds.includes(id) && setDesktopIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  const movePinned = (id: string, direction: -1 | 1) => setDesktopIds(current => {
    const index = current.indexOf(id), target = index + direction;
    if (index < 0 || target < 0 || target >= current.length) return current;
    const next = [...current]; [next[index], next[target]] = [next[target], next[index]];
    return next;
  });
  const signOut = async () => leaveDesktop(async () => { setProfileOpen(false); await auth.signOut(); });
  const desktopPages = Math.max(1, Math.ceil(desktopIds.length / DESKTOP_SLOT_COUNT));
  const visiblePage = Math.min(desktopPage, desktopPages - 1);
  const slots = Array.from({ length: DESKTOP_SLOT_COUNT }, (_, index) => areaWidgetById.get(desktopIds[visiblePage * DESKTOP_SLOT_COUNT + index] ?? ""));
  const missingSavedWidgets = recoverableWidgetIds.filter(id => !desktopIds.includes(id));

  const sidebarContent = (
          <View style={styles.sidebarInner}>
            <View style={styles.sidebarHeader}><View><Text style={styles.eyebrow}>CARESUITE HEALTHOS</Text><Text style={styles.sidebarTitle}>Navigation · {moduleLabel}</Text></View><Pressable ref={navigationCloseRef} accessibilityLabel="Navigation schließen" onPress={closeNavigation} style={styles.closeSmall}><Text style={styles.closeSmallText}>‹</Text></Pressable></View>
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
                  <View style={styles.navIcon}><DesktopCatalogArtwork route={app.route} label={app.label} size={36}/></View>
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
  if (!ready) return <View style={[styles.background, styles.loadingHost]}>
    <View style={[styles.glass, styles.loadingCard]}>
      <Text style={styles.sidebarTitle}>{loadError ? "Desktop-Einstellungen konnten nicht geladen werden" : "Desktop wird vorbereitet"}</Text>
      <Text style={styles.desktopSubtitle}>{loadError ? "Ihre gespeicherte Auswahl bleibt erhalten. Bitte versuchen Sie es erneut." : "Ihre Apps, Navigation und Hintergrund werden geladen."}</Text>
      {loadError ? <Pressable onPress={retry} style={styles.appsButton}><Text style={styles.appsText}>Erneut versuchen</Text></Pressable> : null}
    </View>
  </View>;

  return (
    <ImageBackground source={activeBackground.image} resizeMode="cover" style={[styles.background, shortViewport && styles.shortBackground]} testID="responsive-desktop">
      <style>{workspaceCss}</style>
      <View style={[styles.desktopFrame, compact && styles.desktopFrameCompact, shortViewport && { flexGrow: 0, flexShrink: 0, flexBasis: "auto", minHeight: "100%" }]}>
      <View style={styles.atmosphere} />
      <View style={[styles.glass, styles.topbar, !mobile && { display: "grid", gridTemplateColumns: headerNarrow ? "minmax(0, 1fr)" : headerStacked ? "max-content minmax(0, 1fr)" : `max-content minmax(${280 * Math.max(1, fontScale)}px, ${360 * Math.max(1, fontScale)}px) max-content max-content max-content max-content max-content`, justifyContent: headerStacked ? "normal" : "space-between", gap: 12, padding: 9 } as unknown as ViewStyle]} testID="desktop-full-width-header" onLayout={(event) => {
        const next = Math.ceil(event.nativeEvent.layout.height);
        setTopbarHeight(current => current === next ? current : next);
        if (typeof window !== "undefined") window.dispatchEvent(new Event("caresuite:neo-dock-layout"));
      }}>
        <View style={styles.brandGroup} testID="desktop-header-brand">
          <Image accessibilityLabel="CareSuite HealthOS" source={BRAND} resizeMode="contain" style={[styles.logo, { width: headerLogoWidth, height: headerLogoWidth / 8 }]} />
          <View style={[styles.neoDock, !mobile && { width: 68, height: 72 }]} {...{ dataSet: { csNeoDock: "true" } }} />
        </View>
        <View style={[styles.infoCard, mobile ? styles.infoCardMobile : styles.infoCardDesktop, { flexBasis: (mobile ? 400 : 280) * Math.max(1, fontScale), minWidth: mobile || headerNarrow ? 0 : 280 * Math.max(1, fontScale), flexWrap: !mobile && headerNarrow ? "wrap" : "nowrap" }]} testID="desktop-clock-weather">
          <View style={[styles.clock, !mobile && { minWidth: 126 }, mobile && styles.clockMobile]}><Text style={[styles.time, mobile && styles.timeMobile]}>{now.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}</Text><Text style={[styles.date, mobile && styles.dateMobile]}>{new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "2-digit", month: "short", year: "numeric" }).format(now)}</Text></View>
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
        <View style={[styles.actions, headerStacked && styles.actionsSecondRow, !mobile && { gridColumn: headerStacked ? "1 / -1" : "auto", marginLeft: "auto", flexWrap: headerStacked ? "wrap" : "nowrap" } as unknown as ViewStyle, mobile && styles.actionsMobile, !mobile && !headerStacked && { display: "contents" } as unknown as ViewStyle]} testID="desktop-topbar-actions">
          {compact && <Pressable ref={menuToggleRef} accessibilityRole="button" {...({ "aria-controls": compact ? undefined : "desktop-home-navigation" } as object)} accessibilityLabel={navigationOpen ? "Navigation schließen" : "Navigation öffnen"} accessibilityState={{ expanded: navigationOpen }} onPress={() => compact ? setMobileSidebarOpen(value => !value) : setSidebarOpen(value => !value)} style={[styles.iconButton, mobile && styles.iconButtonMobile, navigationOpen && styles.iconButtonActive]}><Text style={styles.iconGlyph}>{navigationOpen ? "‹" : "☰"}</Text></Pressable>}
          <PortalTextSizeControls dense={mobile} appearance="desktop-header" />
          {!compact ? <View style={styles.livePill}><View style={styles.liveDot} /><Text style={styles.liveText}>Live</Text></View> : null}
          <Pressable accessibilityRole="button" accessibilityLabel="Apps und Widgets öffnen" onPress={() => openCenter()} style={[styles.appsButton, styles.headerAppsButton, mobile && styles.appsButtonMobile]}><Text style={styles.appsGlyph}>▦</Text>{!compact ? <Text style={styles.appsText}>Apps & Widgets</Text> : null}</Pressable>
          <HelpButton compact={mobile} />
          <Pressable accessibilityLabel={`Kontomenü von ${displayName} öffnen`} onPress={() => setProfileOpen(true)} style={[styles.profileTrigger, mobile && styles.profileTriggerMobile]}>{!narrow ? <View style={styles.profileCopy}><Text style={styles.profileName}>{displayName}</Text><Text style={styles.profileRole}>{role}</Text></View> : null}<TopbarProfileAvatar name={displayName} avatarUrl={profile?.avatarUrl?.trim() || undefined} avatarVersion={profile?.updatedAt ?? profile?.avatarUrl} accentColor="#56C7FF" size={mobile ? "sm" : "lg"} /></Pressable>
        </View>
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
            <Pressable ref={navigationRailRef} accessibilityRole="button" accessibilityLabel="Navigation öffnen" accessibilityState={{ expanded: false }}
              {...({ "aria-controls": "desktop-home-navigation" } as object)}
              onPress={() => { setSidebarOpen(true); requestAnimationFrame(() => navigationCloseRef.current?.focus()); }}
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
          <View testID="desktop-workspace-header" style={[styles.desktopHeader, mobile && styles.desktopHeaderMobile]}>
            <View style={[styles.desktopHeading, mobile && styles.desktopHeadingMobile]}>
              <Text accessibilityRole="header" style={styles.desktopTitle}>Mein Desktop · {moduleLabel}</Text>
              <View style={styles.areaTabs}>{DESKTOP_AREAS.map(area => <Pressable key={area.key} accessibilityRole="tab" accessibilityState={{ selected: selectedArea === area.key }} onPress={() => { void leaveDesktop(() => onSelectArea(area.key)); }} style={[styles.tab, selectedArea === area.key && styles.tabActive]}><Text style={[styles.tabText, selectedArea === area.key && styles.tabTextActive]}>{area.label}</Text></Pressable>)}</View>
            </View>
            <View style={styles.desktopActions}>
              {desktopPages > 1 ? <View style={styles.desktopActions}>
                <Pressable accessibilityRole="button" accessibilityLabel="Vorherige Desktop-Seite" disabled={visiblePage === 0} onPress={() => setDesktopPage(visiblePage - 1)} style={styles.editButton}><Text style={styles.editText}>‹</Text></Pressable>
                <Text accessibilityLiveRegion="polite" style={styles.countText}>{visiblePage + 1}/{desktopPages}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel="Nächste Desktop-Seite" disabled={visiblePage === desktopPages - 1} onPress={() => setDesktopPage(visiblePage + 1)} style={styles.editButton}><Text style={styles.editText}>›</Text></Pressable>
              </View> : null}
              <View style={[styles.countPill, mobile && styles.countPillMobile]}><View style={styles.liveDot} /><Text style={[styles.countText, mobile && styles.countTextMobile]}>{desktopPages > 1 ? `${desktopIds.length} Widgets` : mobile ? `${desktopIds.length} aktiv` : `${desktopIds.length}/${DESKTOP_SLOT_COUNT} aktiv`}</Text></View>
              <Pressable accessibilityRole="button" accessibilityLabel={editMode ? "Desktop-Bearbeitung abschließen" : "Desktop bearbeiten"} accessibilityState={{ selected: editMode }} onPress={() => setEditMode((value) => !value)} style={[styles.editButton, mobile && styles.editButtonMobile, editMode && styles.editButtonActive]}>
                <Text style={[styles.editText, mobile && styles.editTextMobile]}>{editMode ? "✓ Fertig" : "✎ Bearbeiten"}</Text>
              </Pressable>
            </View>
          </View>
          {!areaAllowed ? <Text accessibilityRole="alert" style={styles.desktopSubtitle}>Dieser Bereich ist für Ihr Konto noch nicht freigegeben.</Text> : null}
          {saveStatus === 'error' ? <View style={styles.desktopActions}><Text accessibilityRole="alert" style={styles.desktopSubtitle}>Ihre letzte Auswahl wurde noch nicht gespeichert.</Text><Pressable accessibilityRole="button" onPress={retry} style={styles.editButton}><Text style={styles.editText}>Erneut speichern</Text></Pressable></View> : null}
          <ScrollView style={styles.gridScroll} {...{ dataSet: { csDesktopWidgetViewport: "true" } }} contentContainerStyle={styles.gridScrollContent} showsVerticalScrollIndicator keyboardShouldPersistTaps="handled">
            <View style={styles.grid} {...{ dataSet: { csDesktopWidgetGrid: "true" } }} testID="desktop-widget-grid">
              {slots.map((widget, index) => (
                <View key={widget?.id ?? `empty-${index}`} style={styles.cell}>
                  {widget ? (
                    <Pressable accessibilityRole="button" accessibilityLabel={`${widget.label} öffnen`} onPress={() => !editMode && openWidget(widget)} style={({ pressed }) => [styles.widgetCard, pressed && !editMode && styles.widgetPressed, editMode && styles.widgetEditing]}>
                      <View style={styles.labelBar} {...{ dataSet: { csDesktopWidgetLabel: "true" } }}>{widget.workspaceService ? <DesktopCatalogArtwork route={widget.route} label={widget.label} size={26}/> : null}<Text accessibilityRole="header" style={styles.widgetLabel}>{widget.label}</Text><Text style={styles.arrow}>↗</Text></View>
                      <View style={styles.imageStage} {...{ dataSet: { csDesktopWidgetArtwork: "true" } }}>
                        {widget.workspaceService ? <GoogleWorkspaceWidget service={widget.workspaceService} fontScale={effectiveScale}/> : <DesktopCatalogArtwork route={widget.route} label={widget.label} images={widget.images} style={{ maxWidth: 400 }}/>}
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
      <DesktopAppsWidgetsCenter visible={centerOpen} onClose={() => setCenterOpen(false)} areaLabel={moduleLabel} initialTab={centerTab}
        apps={moduleApps} widgets={moduleWidgets} workflows={moduleWorkflows} backgrounds={BACKGROUNDS}
        desktopIds={desktopIds} backgroundId={backgroundId} recoverableCount={missingSavedWidgets.length}
        onRecover={() => setDesktopIds(ids => [...new Set([...ids, ...missingSavedWidgets])])}
        onOpen={route => openWidget({ route })} onToggleWidget={togglePinned} onMoveWidget={movePinned}
        onBackground={setBackgroundId} saveStatus={saveStatus} onRetrySave={retry} />

      <Modal transparent animationType="fade" visible={profileOpen} onRequestClose={() => setProfileOpen(false)}>
        <Pressable onPress={() => setProfileOpen(false)} style={styles.backdrop}><Pressable onPress={(event) => event.stopPropagation()} style={[styles.glass, styles.profilePanel]}><View style={styles.profileHeader}><TopbarProfileAvatar name={displayName} avatarUrl={profile?.avatarUrl?.trim() || undefined} avatarVersion={profile?.updatedAt ?? profile?.avatarUrl} accentColor="#56C7FF" size="lg" /><View style={styles.profileIdentity}><Text style={styles.profilePanelName}>{displayName}</Text><Text style={styles.profilePanelRole}>{role}</Text></View><Pressable onPress={() => setProfileOpen(false)} style={styles.closeButton}><Text style={styles.closeText}>×</Text></Pressable></View><View style={styles.profileDivider} /><Pressable onPress={() => { void leaveDesktop(() => { setProfileOpen(false); router.push("/settings/profile" as never); }); }} style={styles.profileRow}><View><Text style={styles.profileRowTitle}>Profil & Sicherheit</Text><Text style={styles.profileRowCopy}>Persönliche Angaben, Profilbild und Zugang</Text></View><Text style={styles.arrow}>›</Text></Pressable><View style={styles.profileDivider} /><Pressable accessibilityLabel="Sicher abmelden" onPress={() => void signOut()} style={styles.logout}><Text style={styles.logoutText}>↪  Sicher abmelden</Text></Pressable></Pressable></Pressable>
      </Modal>
      </View>
    </ImageBackground>
  );
}

const glassWeb = Platform.OS === "web" ? ({ backdropFilter: "blur(26px) saturate(1.18)", boxShadow: "0 12px 26px rgba(43,184,255,0.2)" } as const) : null;
const glassNativeShadow = Platform.OS !== "web" ? ({ shadowColor: "#2BB8FF", shadowOpacity: 0.2, shadowRadius: 26, shadowOffset: { width: 0, height: 12 } } as const) : null;
const transitionWeb = Platform.OS === "web" ? ({ transition: "transform 300ms cubic-bezier(.2,.8,.2,1), border-color 240ms ease" } as const) : null;
const styles = StyleSheet.create({
  actionsSecondRow: { flexBasis: "100%", width: "100%", justifyContent: "flex-end", borderTopWidth: 1, borderTopColor: "rgba(139,211,255,0.18)", paddingTop: 10 },
  neoDock: { width: 76, height: 80, flexShrink: 0, alignItems: "center", justifyContent: "center" },
  brandGroup: { flexDirection: "row", alignItems: "center", gap: 12, minWidth: 0, maxWidth: "100%", flexShrink: 1 },
  headerAppsButton: { ...desktopHeaderControl, justifyContent: "center", paddingVertical: 0, flexShrink: 0 },
  areaTabs: { flexDirection: "row", flexWrap: "wrap", gap: 6, paddingTop: 8 },
  actionsMobile: { alignSelf: "center", minHeight: 52, padding: 4, gap: 4, borderRadius: 16, justifyContent: "center" },
  iconButtonMobile: { width: 44, height: 44, borderRadius: 12 },
  appsButtonMobile: { width: 44, minHeight: 44, paddingHorizontal: 0, justifyContent: "center", borderRadius: 12 },
  profileTriggerMobile: { minHeight: 44, minWidth: 44, paddingHorizontal: 0, justifyContent: "center" },
  infoCardMobile: { minHeight: 70, flexWrap: "nowrap", paddingHorizontal: 10, paddingVertical: 7, gap: 8, borderRadius: 16 },
  infoCardDesktop: { minHeight: 72, paddingHorizontal: 0, paddingVertical: 4, gap: 8 },
  clockMobile: { minWidth: 0, flexBasis: "42%" },
  weatherMobile: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 4 },
  dateMobile: { fontSize: 13, lineHeight: 18 },
  timeMobile: { fontSize: 30, lineHeight: 35 },
  desktopHeaderMobile: { minHeight: 62, padding: 8, gap: 6, borderRadius: 16 },
  desktopHeadingMobile: { flexBasis: 80 },
  countTextMobile: { fontSize: 12 },
  countPillMobile: { minHeight: 36, paddingHorizontal: 6, paddingVertical: 6, alignSelf: "center", gap: 4 },
  editButtonMobile: { minHeight: 44, paddingHorizontal: 8, paddingVertical: 6 },
  editTextMobile: { fontSize: 13 },
  navSearch: { borderWidth: 1, borderColor: "rgba(126,205,255,0.3)", borderRadius: 12, paddingHorizontal: 10, marginBottom: 12, backgroundColor: "rgba(1,11,28,0.7)" },
  navEntryCopy: { flex: 1, minWidth: 0, gap: 3 },
  navEntryContext: { color: "#AFC9DC", fontSize: 11, lineHeight: 16 },
  shortBackground: { overflow: "scroll" },
  background: { flex: 1, width: "100%", height: "100%", backgroundColor: "#03132B", overflow: "hidden" },
  atmosphere: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,10,27,0.2)" },
  glass: { backgroundColor: "rgba(2,15,35,0.76)", borderWidth: 1, borderColor: "rgba(139,211,255,0.3)", ...glassNativeShadow, ...glassWeb },
  desktopFrame: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minHeight: 0, width: "100%", padding: 20, gap: 16 }, desktopFrameCompact: { padding: 12, gap: 12 }, loadingHost: { justifyContent: "center", alignItems: "center", padding: 24 }, loadingCard: { width: "100%", maxWidth: 600, borderRadius: 24, padding: 24, gap: 18 },
  topbar: { zIndex: 20, width: "100%", minWidth: 0, flexShrink: 0, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12, padding: 10, borderRadius: 20 },
  logo: { maxWidth: "100%", flexShrink: 1 },
  infoCard: { flexGrow: 1, flexShrink: 0, minWidth: 0, maxWidth: "100%", minHeight: 80, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, flexDirection: "row", flexWrap: "nowrap", alignItems: "center", justifyContent: "flex-start", gap: 14 },
  clock: { flexShrink: 0, minWidth: 140 },
  time: { color: "#FFF", fontSize: 34, lineHeight: 39, fontWeight: "900", letterSpacing: -1 }, date: { color: "#D8EAFF", fontSize: 15, lineHeight: 21, fontWeight: "700" },
  weather: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1, maxWidth: "100%" }, weatherCopy: { flexShrink: 1, minHeight: 52, maxWidth: 210, justifyContent: "center", alignItems: "center" },
  weatherIcon: { color: "#8FE4FF", fontSize: 25 }, weatherTitle: { color: "#FFF", fontSize: 17, lineHeight: 22, fontWeight: "800", textAlign: "center" }, weatherPlace: { color: "#BCD4EC", fontSize: 13, lineHeight: 18, textAlign: "center" },
  weatherRefresh: { minHeight: 44, minWidth: 36, alignItems: "center", justifyContent: "center" }, weatherLink: { color: "#8FE4FF", fontSize: 17, lineHeight: 22 }, weatherEdit: { color: "#8FE4FF", fontSize: 13, lineHeight: 19, fontWeight: "700", textAlign: "center" },
  actions: { flexGrow: 0, flexShrink: 1, flexBasis: "auto", minWidth: 0, justifyContent: "flex-end", flexWrap: "wrap", maxWidth: "100%", minHeight: 64, borderRadius: 20, padding: 6, flexDirection: "row", alignItems: "center", alignContent: "center", gap: 8 },
  iconButton: { width: 46, height: 46, borderRadius: 15, borderWidth: 1, borderColor: "rgba(146,205,255,0.25)", backgroundColor: "rgba(8,29,59,0.64)", alignItems: "center", justifyContent: "center" }, iconButtonActive: { borderColor: "rgba(102,224,255,0.72)", backgroundColor: "rgba(13,91,130,0.76)" }, iconGlyph: { color: "#FFF", fontSize: 20 },
  livePill: { ...desktopHeaderControl, flexShrink: 0, justifyContent: "center", paddingHorizontal: 13, flexDirection: "row", alignItems: "center", gap: 7 }, liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#58D8C1", ...(Platform.OS === "web" ? ({ boxShadow: "0 0 8px rgba(88,216,193,0.9)" } as const) : ({ shadowColor: "#58D8C1", shadowOpacity: 0.9, shadowRadius: 8 } as const)) }, liveText: { color: desktopHeaderControlColors.text, fontSize: 16, fontWeight: "800" },
  appsButton: { minHeight: 46, paddingVertical: 8, borderRadius: 15, paddingHorizontal: 14, borderWidth: 1, borderColor: "rgba(104,222,255,0.58)", backgroundColor: "rgba(9,75,111,0.78)", flexDirection: "row", alignItems: "center", gap: 8 }, appsGlyph: { color: "#83E8FF", fontSize: 21 }, appsText: { color: "#F3FCFF", fontSize: 16, fontWeight: "900" },
  profileTrigger: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 4 }, profileCopy: { maxWidth: 180, alignItems: "flex-end" }, profileName: { color: "#FFF", fontSize: 16, fontWeight: "900" }, profileRole: { color: "#BFD8EE", fontSize: 13, marginTop: 2, fontWeight: "700" },
  workspace: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minHeight: 0, minWidth: 0, zIndex: 5, display: "grid", gridTemplateRows: "minmax(0, 1fr)", alignContent: "stretch", alignItems: "stretch", gap: 18 } as unknown as ViewStyle, workspaceCompact: { gap: 0 },
  navigationColumn: { minWidth: 0, minHeight: 0, height: "100%", alignSelf: "stretch", position: "relative", overflow: "hidden", borderRadius: 28 },
  navigationContent: { position: "absolute", top: 0, bottom: 0, left: 0 },
  navigationRail: { position: "absolute", top: 0, left: 0, right: 0, alignItems: "stretch" },
  sidebarReopen: { width: "100%", minHeight: 116, paddingVertical: 12, borderRadius: 22, alignItems: "center", justifyContent: "center", gap: 9, borderColor: "rgba(103,224,255,0.62)", backgroundColor: "rgba(3,28,58,0.9)", ...transitionWeb }, sidebarReopenPressed: { transform: [{ scale: 0.96 }], backgroundColor: "rgba(10,75,105,0.94)" },
  sidebarReopenGlyph: { color: "#8BE8FF", fontSize: 21, fontWeight: "900" }, sidebarReopenLabel: { color: "#F2FBFF", fontSize: 13, lineHeight: 20, fontWeight: "700" }, sidebarReopenArrow: { color: "#8BE8FF", fontSize: 28, lineHeight: 28, fontWeight: "500" },
  navigationBackdrop: { flex: 1, backgroundColor: "rgba(0,5,16,0.68)", padding: 12, alignItems: "flex-start" }, sidebarDrawer: { backgroundColor: "#091B32", maxWidth: "100%" }, navScroller: { flex: 1, minHeight: 0 },
  sidebar: { flexShrink: 0, height: "100%", borderRadius: 28, overflow: "hidden" }, sidebarInner: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minHeight: 0, padding: 12 }, sidebarHeader: { minHeight: 61, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 5, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "rgba(139,211,255,0.16)" },
  eyebrow: { color: "#72DEFF", fontSize: 12, lineHeight: 18, fontWeight: "800", letterSpacing: 1.2 }, sidebarTitle: { color: "#FFF", fontSize: 22, fontWeight: "900" }, closeSmall: { width: 34, height: 34, borderRadius: 12, borderWidth: 1, borderColor: "rgba(126,214,255,0.28)", alignItems: "center", justifyContent: "center" }, closeSmallText: { color: "#CDEFFF", fontSize: 25 },
  navScroll: { paddingTop: 10, paddingBottom: 12 }, navGroup: { marginBottom: 10 }, navGroupTitle: { color: "rgba(174,208,232,0.64)", fontSize: 13, fontWeight: "900", letterSpacing: 1.2, textTransform: "uppercase", paddingHorizontal: 8, marginBottom: 5 },
  navItem: { minHeight: 44, paddingVertical: 6, borderRadius: 14, paddingHorizontal: 7, flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 3, borderWidth: 1, borderColor: "transparent" }, navItemActive: { backgroundColor: "rgba(18,101,145,0.55)", borderColor: "rgba(104,222,255,0.38)" }, navIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: "transparent", alignItems: "center", justifyContent: "center" }, navGlyph: { color: "#93E7FF", fontSize: 14 }, navLabel: { flex: 1, minWidth: 0, color: "#E6F1FA", fontSize: 16, fontWeight: "800" }, navArrow: { color: "rgba(137,216,245,0.56)", fontSize: 19 },
  sidebarCenter: { minHeight: 64, paddingVertical: 10, marginTop: 8, borderRadius: 17, borderWidth: 1, borderColor: "rgba(100,222,255,0.38)", backgroundColor: "rgba(10,74,108,0.56)", paddingHorizontal: 11, flexDirection: "row", alignItems: "center", gap: 10 }, sidebarCenterPlus: { color: "#78E5FF", fontSize: 23 }, sidebarCenterTitle: { color: "#FFF", fontSize: 16, fontWeight: "900" }, sidebarCenterCopy: { color: "#A9CBE0", fontSize: 13 },
  sidebarBackground: { minHeight: 64, paddingVertical: 10, marginTop: 7, borderRadius: 16, borderWidth: 1, borderColor: "rgba(152,190,255,0.28)", backgroundColor: "rgba(26,47,91,0.62)", paddingHorizontal: 11, flexDirection: "row", alignItems: "center", gap: 10 }, sidebarBackgroundGlyph: { color: "#A8CFFF", fontSize: 21 },
  desktopPanel: { minHeight: 0, minWidth: 0, height: "100%", alignSelf: "stretch", display: "grid", gridTemplateRows: "auto minmax(0, 1fr)", alignContent: "stretch" } as unknown as ViewStyle,
  desktopHeader: { alignSelf: "center", width: "100%", maxWidth: 2400, borderRadius: 20, paddingVertical: 4, paddingHorizontal: 2, flexShrink: 0, flexWrap: "wrap", minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16 }, desktopHeading: { flexGrow: 1, flexBasis: 280, maxWidth: "100%", minWidth: 0 }, desktopTitle: { color: "#F7FCFF", fontSize: 22, lineHeight: 28, fontWeight: "700", letterSpacing: -0.3 }, desktopSubtitle: { color: "#D2E5F4", fontSize: 16, lineHeight: 24, fontWeight: "700" }, desktopActions: { flexWrap: "wrap", flexDirection: "row", gap: 7 }, countPill: { minHeight: 42, paddingVertical: 8, borderRadius: 13, paddingHorizontal: 10, borderWidth: 1, borderColor: "rgba(105,207,242,0.22)", flexDirection: "row", alignItems: "center", gap: 6 }, countText: { color: "#CEE6F3", fontSize: 13, fontWeight: "900" }, editButton: { minHeight: 42, paddingVertical: 8, borderRadius: 13, paddingHorizontal: 11, borderWidth: 1, borderColor: "rgba(126,214,255,0.28)", backgroundColor: "rgba(7,36,67,0.7)", justifyContent: "center" }, editButtonActive: { borderColor: "rgba(103,230,197,0.62)", backgroundColor: "rgba(24,107,91,0.68)" }, editText: { color: "#EAF8FF", fontSize: 16, fontWeight: "900" },
  gridScroll: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minHeight: 0, minWidth: 0 }, gridScrollContent: { paddingTop: 12, paddingBottom: 12 }, grid: { width: "100%", maxWidth: 2400, alignSelf: "center", minWidth: 0 }, cell: { minWidth: 0, maxWidth: "100%" },
  widgetCard: { flex: 1, borderRadius: 18, borderWidth: 1, borderColor: "rgba(131,203,245,0.22)", backgroundColor: "rgba(1,12,29,0.78)", overflow: "hidden", ...transitionWeb }, widgetPressed: { transform: [{ scale: 0.988 }] }, widgetEditing: { borderColor: "rgba(96,225,194,0.46)", backgroundColor: "rgba(4,35,45,0.82)" },
  imageStage: { height: 178, margin: 10, marginTop: 0, marginBottom: 10, borderRadius: 13, backgroundColor: "rgba(4,23,47,0.5)", alignItems: "center", justifyContent: "center", overflow: "hidden" }, categoryPill: { position: "absolute", top: 7, left: 7, borderRadius: 9, paddingHorizontal: 7, paddingVertical: 4, backgroundColor: "rgba(1,14,31,0.78)" }, categoryText: { color: "#B9DCEB", fontSize: 11, fontWeight: "900", textTransform: "uppercase" }, removeButton: { position: "absolute", top: 7, right: 7, width: 44, height: 44, borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,159,176,0.52)", backgroundColor: "rgba(91,15,33,0.9)", alignItems: "center", justifyContent: "center" }, removeText: { color: "#FFD4DC", fontSize: 20 },
  labelBar: { minHeight: 64, paddingVertical: 8, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 12 }, widgetLabel: { flex: 1, minWidth: 0, color: "#F3FBFF", fontSize: 18, lineHeight: 24, fontWeight: "700" }, arrow: { color: "#77DFFF", fontSize: 13, fontWeight: "900" },
  emptyCard: { borderRadius: 18, borderWidth: 1, borderStyle: "dashed", borderColor: "rgba(126,208,244,0.25)", backgroundColor: "rgba(4,23,44,0.34)", alignItems: "center", justifyContent: "center" }, emptyPlus: { color: "#78E4FF", fontSize: 24 }, emptyTitle: { color: "#E9F8FF", fontSize: 13, fontWeight: "900" }, emptyCopy: { color: "#91B5CA", fontSize: 11, marginTop: 2 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,5,16,0.8)", alignItems: "center", justifyContent: "center", padding: 18 }, centerSubtitle: { color: "#AFC9DC", fontSize: 13, marginTop: 3 }, closeButton: { width: 38, height: 38, borderRadius: 14, borderWidth: 1, borderColor: "rgba(145,211,245,0.2)", backgroundColor: "rgba(255,255,255,0.07)", alignItems: "center", justifyContent: "center" }, closeText: { color: "#FFF", fontSize: 27 }, tab: { minHeight: 40, paddingVertical: 8, borderRadius: 12, paddingHorizontal: 15, justifyContent: "center", backgroundColor: "#0B223D", borderWidth: 1, borderColor: "#466887" }, tabActive: { backgroundColor: "#075577", borderWidth: 1, borderColor: "#62DCFF" }, tabText: { color: "#F0F7FF", fontSize: 13, fontWeight: "900" }, tabTextActive: { color: "#FFF" }, searchInput: { backgroundColor: "transparent", borderWidth: 0, flex: 1, minWidth: 0, minHeight: 42, color: "#FFF", fontSize: 16 }, pinButton: { minHeight: 40, paddingVertical: 8, borderRadius: 11, paddingHorizontal: 10, borderWidth: 1, borderColor: "rgba(104,218,255,0.32)", backgroundColor: "rgba(9,61,91,0.64)", justifyContent: "center" }, pinText: { color: "#BEEBFA", fontSize: 11, fontWeight: "900" },
  profilePanel: { width: "100%", maxWidth: 520, borderRadius: 27, padding: 20 }, profileHeader: { flexDirection: "row", alignItems: "center", gap: 13 }, profileIdentity: { flex: 1 }, profilePanelName: { color: "#FFF", fontSize: 18, fontWeight: "900" }, profilePanelRole: { color: "#9DDFFF", fontSize: 13, fontWeight: "800", marginTop: 2 }, profileDivider: { height: 1, backgroundColor: "rgba(138,211,255,0.2)", marginVertical: 13 }, profileRow: { minHeight: 62, borderRadius: 15, borderWidth: 1, borderColor: "rgba(122,202,255,0.18)", backgroundColor: "rgba(6,27,57,0.72)", paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, profileRowTitle: { color: "#FFF", fontSize: 12, fontWeight: "900" }, profileRowCopy: { color: "#AAC4DE", fontSize: 13, marginTop: 2 }, logout: { minHeight: 48, borderRadius: 15, borderWidth: 1, borderColor: "rgba(255,120,143,0.46)", backgroundColor: "rgba(145,25,48,0.26)", alignItems: "center", justifyContent: "center" }, logoutText: { color: "#FFDCE2", fontSize: 12, fontWeight: "900" },
});
