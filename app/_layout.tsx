import 'react-native-reanimated';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, usePathname, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Pressable, Text, View, StyleSheet, Platform, useWindowDimensions, type ViewStyle } from 'react-native';
import { applyInvisibleScrollIndicators } from '@/product-workflows/design/scroll/applyInvisibleScrollIndicators';
import { ThemeModeProvider, useThemeMode } from '@/product-workflows/design/ThemeModeProvider';
import { WebFontScaleProvider } from '@/product-workflows/design/web/WebFontScaleProvider';
import { GlobalAnimatedBackground } from '@/product-workflows/components/ui/effects';
import { cleanupOrphanedFullscreenOverlays } from '@/lib/dom/cleanupOrphanedFullscreenOverlays';
import { isPortalRoutePath } from '@/lib/navigation/isPortalRoute';
import { GlobalScreensaver, ScreensaverSettingsProvider } from '@/product-workflows/components/screensaver';
import { GlobalAiProvider } from '@/ai/GlobalAiProvider';
import { ModalStackProvider } from '@/product-workflows/components/navigation/ModalStackProvider';
import { AuthProvider } from '@/lib/auth';
import { BusinessWelcomeGate } from '@/product-workflows/components/auth/BusinessWelcomeGate';
import { PortalWelcomeGate } from '@/product-workflows/components/auth/PortalWelcomeGate';
import { PerformanceProvider, useDevicePerformance, shouldUseHeavyEffects } from '@/lib/performance';
import { installPerformanceDiagnostics } from '@/lib/performance/performanceDiagnostics';
import { useHydrated } from '@/hooks/useHydrated';
import { installSystemTextDefaults } from '@/product-workflows/design/installSystemTextDefaults';
import { GlobalWorkflowFeedbackProvider } from '@/product-workflows/components/ui';
import { isHealthOSContextualPopupRoute } from '@/lib/navigation/healthosRoutePresentation';
import { isLiquidCommandRoutePath } from '@/liquid-command/navigation/isLiquidCommandRoute';
import { HealthOSStoreEditionGuard } from '@/lib/platform/HealthOSStoreEditionGuard';
import '@/lib/employeeLogbook/employeeLogbookTracking';

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
  const { width } = useWindowDimensions();
  const compactPopup = width < 780;
  const currentRouteIsPopup = isHealthOSContextualPopupRoute(pathname);
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
  const isDark = isPortalRoutePath(pathname) && mode === 'dark';
  const navigationTheme = isDark
    ? {
        ...DarkTheme,
        colors: { ...DarkTheme.colors, background: SURFACE_COLOR, card: SURFACE_COLOR },
      }
    : {
        ...DefaultTheme,
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
            <StatusBar style={isDark ? 'light' : 'dark'} />
            <Stack
              screenOptions={({ route }) => {
                const contextualPopup = isHealthOSContextualPopupRoute(route.name);
                return {
                  headerShown: false,
                  contentStyle: contextualPopup
                    ? {
                        backgroundColor: 'rgba(0, 7, 20, 0.74)',
                        paddingTop: compactPopup ? 62 : 86,
                        paddingBottom: compactPopup ? 8 : 24,
                        paddingHorizontal: compactPopup ? 8 : 24,
                      }
                    : { backgroundColor: SURFACE_COLOR },
                  animation: contextualPopup ? 'fade' : 'slide_from_right',
                  presentation: contextualPopup ? 'transparentModal' : 'card',
                };
              }}
            />
            {currentRouteIsPopup ? (
              <>
                <View pointerEvents="none" style={[styles.centralPopupFrame, compactPopup && styles.centralPopupFrameCompact]} />
                <View style={[styles.centralPopupChrome, compactPopup && styles.centralPopupChromeCompact]}>
                  <View style={styles.centralPopupChromeCopy}>
                    <Text numberOfLines={1} style={styles.centralPopupBrand}>CareSuite <Text style={styles.centralPopupBrandAccent}>HealthOS</Text></Text>
                    {!compactPopup ? <View style={styles.centralPopupDivider} /> : null}
                    <Text numberOfLines={1} style={styles.centralPopupTitle}>{popupTitle(pathname)}</Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Popup schließen und zur zentralen Startseite zurückkehren"
                    onPress={() => router.replace('/' as never)}
                    style={({ pressed }) => [
                      styles.centralPopupGlobalClose,
                      compactPopup && styles.centralPopupGlobalCloseCompact,
                      pressed && styles.centralPopupGlobalClosePressed,
                    ]}
                  >
                    <Text style={styles.centralPopupGlobalCloseText}>×</Text>
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
  const pathname = usePathname();
  const isLiquidCommandRoute = isLiquidCommandRoutePath(pathname);
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
    <AuthProvider>
      <ThemeModeProvider>
        <PerformanceProvider>
          <WebFontScaleProvider>
            <GlobalAiProvider>
              <GlobalWorkflowFeedbackProvider>
                <ModalStackProvider>
                  <ScreensaverSettingsProvider>
                    <HealthOSStoreEditionGuard>
                      <RouteScopedLegacyOverlays />
                      <GlobalScreensaver />
                      <RootShell />
                    </HealthOSStoreEditionGuard>
                  </ScreensaverSettingsProvider>
                </ModalStackProvider>
              </GlobalWorkflowFeedbackProvider>
            </GlobalAiProvider>
          </WebFontScaleProvider>
        </PerformanceProvider>
      </ThemeModeProvider>
    </AuthProvider>
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
