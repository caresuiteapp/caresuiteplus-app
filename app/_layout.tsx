import { TenantDataUploadGate } from '@/components/dataTransfers/TenantDataUploadGate.native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PortalKeyboardProvider } from '@/components/keyboard/PortalKeyboard';
import 'react-native-reanimated';
import { AppStartup } from '@/components/brand/AppStartup';
import { useAppStartIntroReady } from '@/components/brand/appStartIntroSession';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, usePathname, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Pressable, Text, View, StyleSheet, Platform, useWindowDimensions, type ViewStyle } from 'react-native';
import { applyInvisibleScrollIndicators } from '@/product-workflows/design/scroll/applyInvisibleScrollIndicators';
import { ThemeModeProvider, useThemeMode } from '@/product-workflows/design/ThemeModeProvider';
import { WebFontScaleProvider } from '@/product-workflows/design/web/WebFontScaleProvider';
import { GlobalAnimatedBackground } from '@/product-workflows/components/ui/effects';
import { cleanupOrphanedFullscreenOverlays } from '@/lib/dom/cleanupOrphanedFullscreenOverlays';
import { isAuthRoutePath, isLightPortalRoutePath, isPortalRoutePath } from '@/lib/navigation/isPortalRoute';
import { GlobalScreensaver, ScreensaverSettingsProvider } from '@/product-workflows/components/screensaver';
import { GlobalAiProvider } from '@/ai/GlobalAiProvider';
import { ModalStackProvider } from '@/product-workflows/components/navigation/ModalStackProvider';
import { AuthProvider } from '@/lib/auth';
import { BusinessWelcomeGate } from '@/product-workflows/components/auth/BusinessWelcomeGate';
import { PortalWelcomeGate } from '@/product-workflows/components/auth/PortalWelcomeGate';
import { PortalBiometricGate } from '@/components/auth/PortalBiometricGate';
import { PortalPushRegistrationGate } from '@/components/portal/PortalPushRegistrationGate';
import { PerformanceProvider, useDevicePerformance, shouldUseHeavyEffects } from '@/lib/performance';
import { installPerformanceDiagnostics } from '@/lib/performance/performanceDiagnostics';
import { useHydrated } from '@/hooks/useHydrated';
import { installSystemTextDefaults } from '@/product-workflows/design/installSystemTextDefaults';
import { GlobalWorkflowFeedbackProvider } from '@/product-workflows/components/ui';
import { MobileIconButton } from '@/components/mobile/MobileWorkspace';
import { helpHref } from '@/features/help/helpNavigation';
import { isHealthOSContextualPopupRoute, resolveHealthOSPopupFallbackPath } from '@/lib/navigation/healthosRoutePresentation';
import { isLiquidCommandRoutePath } from '@/liquid-command/navigation/isLiquidCommandRoute';
import { HealthOSStoreEditionGuard } from '@/lib/platform/HealthOSStoreEditionGuard';
import { administrationWorkspaceContext } from '@/lib/navigation/administrationWorkspaceContext';
import '@/lib/employeeLogbook/employeeLogbookTracking';

import { careSuiteAppFontFamily } from '@/design/tokens/appFontFamily';
const careSuiteNavigationFonts = Object.fromEntries(Object.entries(DefaultTheme.fonts).map(([key, value]) => [key, { ...value, fontFamily: careSuiteAppFontFamily }])) as typeof DefaultTheme.fonts;

applyInvisibleScrollIndicators();
installSystemTextDefaults();

if (__DEV__ && Platform.OS === 'web') {
  require('@/devtools/registerDevAudit');
  installPerformanceDiagnostics(120_000);
}

const SURFACE_COLOR = 'transparent';

const POPUP_TITLES: Record<string, string> = {
  company: 'Unternehmen', dashboard: 'Unternehmen', clients: 'Klient:innen', employees: 'Personal',
  'time-tracking': 'Arbeitszeit', payroll: 'Gehaltsstatistik', invoices: 'Rechnungen',
  documents: 'Dokumente', messages: 'Nachrichten', portals: 'Portale & Zugänge',
  inventory: 'Inventar', audit: 'Audit', 'audit-log': 'Audit', assignments: 'Einsätze', einsaetze: 'Einsätze',
  calendar: 'Kalender & Einsatzplanung', kalender: 'Kalender & Einsatzplanung',
  'live-status': 'Live-Status', evidence: 'Nachweise', nachweise: 'Nachweise',
  budgets: 'Budgets', abrechnungsquellen: 'Budgets', 'portal-access': 'Portale',
  'command-center': 'Command Center', office: 'Office', assist: 'Assist', settings: 'Einstellungen', profile: 'Profil',
};

function popupTitle(pathname: string): string {
  const segment = pathname.split('/').filter(Boolean).at(-1) ?? '';
  return POPUP_TITLES[segment] ?? decodeURIComponent(segment).replace(/-/g, ' ');
}

function RootShell() {
  const { mode } = useThemeMode();
  const pathname = usePathname();
  const router = useRouter();
  const { width, fontScale } = useWindowDimensions();
  const compactPopup = width < 780;
  const nativeCompactPopup = Platform.OS !== 'web' && compactPopup;
  const nativeChromeMinimumHeight = Math.max(56, Math.ceil(34 * Math.max(1, fontScale) + 12));
  const chromeLayoutKey = JSON.stringify([pathname, width, fontScale]);
  const [chromeMeasurement, setChromeMeasurement] = useState<{ key: string; height: number } | null>(null);
  const nativeChromeHeight = Math.max(nativeChromeMinimumHeight, chromeMeasurement?.key === chromeLayoutKey ? chromeMeasurement.height : 0);
  const popupContext = administrationWorkspaceContext(pathname);
  const popupContentTop = nativeCompactPopup ? nativeChromeHeight + 14 : compactPopup ? 62 : 86;
  const popupFrameTop = nativeCompactPopup ? nativeChromeHeight + 8 : compactPopup ? 56 : 78;
  const insets = useSafeAreaInsets();
  const nativeTop = Platform.OS === 'web' ? 0 : insets.top;
  const nativeBottom = Platform.OS === 'web' ? 0 : insets.bottom;
  const nativeDesktop = Platform.OS !== 'web' && ['/business', '/business/(tabs)', '/business/dashboard', '/'].includes(pathname);
  const currentRouteIsPopup = !nativeDesktop && isHealthOSContextualPopupRoute(pathname);
  const returnToPrevious = () => {
    if (router.canGoBack()) router.back();
    else router.replace(resolveHealthOSPopupFallbackPath(pathname) as never);
  };
  const hydrated = useHydrated();
  const perf = useDevicePerformance();
  const isLiquidCommandRoute = isLiquidCommandRoutePath(pathname);
  const hostsGlobalBackground = !isPortalRoutePath(pathname);

  useEffect(() => {
    cleanupOrphanedFullscreenOverlays();
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.getElementById('caresuite-web-boot')?.remove();
    }
  }, []);

  useEffect(() => {
    cleanupOrphanedFullscreenOverlays();
  }, [pathname]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    // The central popup owns its complete dark HealthOS theme. Leaving the
    // former bright ORBIT attribute enabled here repainted every popup page.
    const internalOrbit = isLiquidCommandRoute && !isPortalRoutePath(pathname) && !currentRouteIsPopup;
    document.documentElement.toggleAttribute('data-cs-orbit-internal', internalOrbit);
    document.documentElement.toggleAttribute('data-cs-central-home', pathname === '/');
    document.documentElement.toggleAttribute('data-cs-central-popup', currentRouteIsPopup);
    return () => {
      document.documentElement.removeAttribute('data-cs-orbit-internal');
      document.documentElement.removeAttribute('data-cs-central-home');
      document.documentElement.removeAttribute('data-cs-central-popup');
    };
  }, [currentRouteIsPopup, isLiquidCommandRoute, pathname]);

  const backgroundAnimated =
    hydrated && hostsGlobalBackground && shouldUseHeavyEffects(perf);
  const isDark = isPortalRoutePath(pathname) && !isLightPortalRoutePath(pathname) && mode === 'dark';
  const navigationTheme = isDark
    ? {
        ...DarkTheme,
        fonts: careSuiteNavigationFonts,
        colors: { ...DarkTheme.colors, background: SURFACE_COLOR, card: SURFACE_COLOR },
      }
    : {
        ...DefaultTheme,
        fonts: careSuiteNavigationFonts,
        colors: {
          ...DefaultTheme.colors,
          background: SURFACE_COLOR,
          card: SURFACE_COLOR,
        },
      };

  return (
    <ThemeProvider value={navigationTheme}>
      <View style={styles.root}>
        <View style={styles.contentLayer} pointerEvents="box-none">
          {hostsGlobalBackground ? (
            <View style={styles.backgroundLayer} pointerEvents="none">
              <GlobalAnimatedBackground mode={mode} animated={backgroundAnimated} />
            </View>
          ) : null}
          <View style={styles.foregroundLayer} pointerEvents="box-none">
            <StatusBar style={hostsGlobalBackground || isDark ? 'light' : 'dark'} />
            <Stack
              screenOptions={({ route }) => {
                const contextualPopup = !nativeDesktop && isHealthOSContextualPopupRoute(route.name);
                return {
                  headerShown: false,
                  contentStyle: contextualPopup
                    ? {
                        backgroundColor: 'rgba(0, 7, 20, 0.74)',
                        paddingTop: Platform.OS === 'web' ? popupContentTop : nativeChromeHeight + nativeTop + 8,
                        paddingBottom: (compactPopup ? 8 : 24) + nativeBottom,
                        paddingHorizontal: compactPopup ? 8 : 24,
                      }
                    : { backgroundColor: SURFACE_COLOR },
                  animation: contextualPopup && Platform.OS === 'web' ? 'fade' : 'slide_from_right',
                  presentation: contextualPopup && Platform.OS === 'web' ? 'transparentModal' : 'card',
                };
              }}
            />
            {currentRouteIsPopup && Platform.OS !== 'web' ? <View onLayout={event => {
              const measured = Math.ceil(event.nativeEvent.layout.height);
              setChromeMeasurement(current => current?.key === chromeLayoutKey && current.height === measured ? current : { key: chromeLayoutKey, height: measured });
            }} style={{ position: 'absolute', left: 8, right: 8, top: nativeTop, minHeight: nativeChromeMinimumHeight, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(139,211,255,0.3)', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#081F3F' }}>
              <MobileIconButton label="Zurück zur vorherigen Ansicht" icon="arrow-left" dark onPress={returnToPrevious} />
              <View style={{ flex: 1, minWidth: 0 }}><Text style={{ color: '#80D9FF', fontFamily: careSuiteAppFontFamily, fontSize: 11, lineHeight: 16 }}>{popupContext.areaLabel}</Text><Text accessibilityRole="header" style={{ color: '#EDF6FF', fontFamily: careSuiteAppFontFamily, fontSize: 15, lineHeight: 21, fontWeight: '700' }} numberOfLines={2}>{popupContext.title}</Text></View>
              <MobileIconButton label="Hilfe zu dieser Seite" icon="help-circle" dark onPress={() => router.push(helpHref(pathname) as never)} />
              <MobileIconButton label="Fenster schließen und zum Desktop zurückkehren" icon="x" dark onPress={() => router.dismissTo('/business' as never)} />
            </View> : null}
            {currentRouteIsPopup && Platform.OS === 'web' ? (
              <>
                <View pointerEvents="none" style={[styles.centralPopupFrame, compactPopup && styles.centralPopupFrameCompact, { top: popupFrameTop + nativeTop, bottom: (compactPopup ? 4 : 24) + nativeBottom }]} />
                <View style={[styles.centralPopupChrome, compactPopup && styles.centralPopupChromeCompact, nativeCompactPopup && { height: nativeChromeHeight }, { top: (compactPopup ? 7 : 15) + nativeTop }]}>
                  <View style={[styles.centralPopupChromeCopy, nativeCompactPopup && { flexDirection: 'column', alignItems: 'flex-start', gap: 0 }]}>
                    <Text numberOfLines={1} style={[styles.centralPopupBrand, compactPopup && { fontSize: 14, lineHeight: 18, flexShrink: 1 }]}>CareSuite <Text style={styles.centralPopupBrandAccent}>HealthOS</Text></Text>
                    {!compactPopup ? <View style={styles.centralPopupDivider} /> : null}
                    <Text numberOfLines={1} style={[styles.centralPopupTitle, nativeCompactPopup && { flex: 0, fontSize: 12, lineHeight: 16, maxWidth: '100%' }]}>{popupTitle(pathname)}</Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Popup schließen und zur zentralen Startseite zurückkehren"
                    onPress={() => router.replace('/' as never)}
                    style={({ pressed }) => [
                      styles.centralPopupGlobalClose,
                      compactPopup && styles.centralPopupGlobalCloseCompact,
                      nativeCompactPopup && { width: 44, height: 44, borderRadius: 22 },
                      pressed && styles.centralPopupGlobalClosePressed,
                    ]}
                  >
                    <Text allowFontScaling={false} style={styles.centralPopupGlobalCloseText}>×</Text>
                  </Pressable>
                </View>
              </>
            ) : null}
          </View>
        </View>
      </View>
    </ThemeProvider>
  );
}

function RouteScopedLegacyOverlays() {
  const startupReady = useAppStartIntroReady();
  const pathname = usePathname();
  const isLiquidCommandRoute = isLiquidCommandRoutePath(pathname);
  if (!startupReady) return null;
  if (Platform.OS !== 'web' && pathname !== '/' && !isAuthRoutePath(pathname)) {
    return isPortalRoutePath(pathname) ? <PortalWelcomeGate /> : <BusinessWelcomeGate />;
  }
  if (isLiquidCommandRoute) return null;
  return (
    <>
      <BusinessWelcomeGate />
      <PortalWelcomeGate />
    </>
  );
}

export default function RootLayout() {
  return (
    <AppStartup>
      <AuthProvider>
        <PortalKeyboardProvider>
          <ThemeModeProvider>
            <PerformanceProvider>
              <WebFontScaleProvider>
                <GlobalAiProvider>
                  <GlobalWorkflowFeedbackProvider>
                    <ModalStackProvider>
                      <ScreensaverSettingsProvider>
                        <HealthOSStoreEditionGuard>
                          <PortalBiometricGate>
                            <RouteScopedLegacyOverlays />
                            <GlobalScreensaver />
                            <RootShell />
                            <PortalPushRegistrationGate />
                            <TenantDataUploadGate />
                          </PortalBiometricGate>
                        </HealthOSStoreEditionGuard>
                      </ScreensaverSettingsProvider>
                    </ModalStackProvider>
                  </GlobalWorkflowFeedbackProvider>
                </GlobalAiProvider>
              </WebFontScaleProvider>
            </PerformanceProvider>
          </ThemeModeProvider>
        </PortalKeyboardProvider>
      </AuthProvider>
    </AppStartup>
  );
}

const styles = StyleSheet.create({
  centralPopupFrame: {
    position: 'absolute',
    top: 78,
    right: 18,
    bottom: 18,
    left: 18,
    zIndex: 9998,
    borderRadius: 34,
    borderWidth: 1,
    borderColor: 'rgba(124, 211, 255, 0.46)',
    shadowColor: '#42C7FF',
    shadowOpacity: 0.22,
    shadowRadius: 28,
  },
  centralPopupFrameCompact: { top: 56, right: 4, bottom: 4, left: 4, borderRadius: 25 },
  centralPopupChrome: {
    position: 'absolute',
    top: 15,
    right: 24,
    left: 24,
    zIndex: 9999,
    height: 58,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(132, 213, 255, 0.46)',
    backgroundColor: 'rgba(3, 18, 41, 0.9)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 21,
    paddingRight: 7,
    shadowColor: '#1CB5FF',
    shadowOpacity: 0.27,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
  },
  centralPopupChromeCompact: { top: 7, right: 8, left: 8, height: 48, borderRadius: 20, paddingLeft: 14, paddingRight: 4 },
  centralPopupChromeCopy: { minWidth: 0, flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14 },
  centralPopupBrand: { flexShrink: 0, color: '#FFFFFF', fontSize: 19, lineHeight: 23, fontWeight: '700' },
  centralPopupBrandAccent: { color: '#80D9FF' },
  centralPopupDivider: { width: 1, height: 24, backgroundColor: 'rgba(140, 207, 255, 0.26)' },
  centralPopupTitle: { minWidth: 0, flex: 1, color: '#EAF7FF', fontSize: 15, lineHeight: 20, fontWeight: '800', textTransform: 'capitalize' },
  centralPopupGlobalClose: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(126, 207, 255, 0.58)',
    backgroundColor: 'rgba(4, 20, 45, 0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1CB5FF',
    shadowOpacity: 0.34,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  centralPopupGlobalCloseCompact: { width: 40, height: 40, borderRadius: 20 },
  centralPopupGlobalClosePressed: { opacity: 0.76, transform: [{ scale: 0.96 }] },
  centralPopupGlobalCloseText: { color: '#FFFFFF', fontSize: 34, lineHeight: 36, fontWeight: '300', marginTop: -3 },
  root: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  contentLayer: {
    flex: 1,
    position: 'relative',
    backgroundColor: 'transparent',
  },
  backgroundLayer: Platform.OS === 'web'
    ? ({
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 0,
      } as unknown as ViewStyle)
    : ({
        ...StyleSheet.absoluteFill,
        zIndex: 0,
      } as ViewStyle),
  foregroundLayer: {
    flex: 1,
    zIndex: 1,
    backgroundColor: 'transparent',
  },
});
