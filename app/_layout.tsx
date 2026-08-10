import 'react-native-reanimated';
import { Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View, StyleSheet, Platform, type ViewStyle } from 'react-native';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
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

applyInvisibleScrollIndicators();
installSystemTextDefaults();

if (__DEV__ && Platform.OS === 'web') {
  require('@/devtools/registerDevAudit');
  installPerformanceDiagnostics(120_000);
}

const SURFACE_COLOR = 'transparent';

function RootShell() {
  const { mode } = useThemeMode();
  const pathname = usePathname();
  const hydrated = useHydrated();
  const perf = useDevicePerformance();
  const isLiquidCommandRoute = isLiquidCommandRoutePath(pathname);
  const hostsGlobalBackground = !isLiquidCommandRoute && !isPortalRoutePath(pathname);

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
    const internalOrbit = isLiquidCommandRoute && !isPortalRoutePath(pathname);
    document.documentElement.toggleAttribute('data-cs-orbit-internal', internalOrbit);
    return () => document.documentElement.removeAttribute('data-cs-orbit-internal');
  }, [isLiquidCommandRoute, pathname]);

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
                  contentStyle: { backgroundColor: SURFACE_COLOR },
                  animation: contextualPopup ? 'fade' : 'slide_from_right',
                  presentation: contextualPopup ? 'transparentModal' : 'card',
                };
              }}
            />
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
      <GlobalScreensaver />
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
                    <RouteScopedLegacyOverlays />
                    <RootShell />
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
        ...StyleSheet.absoluteFillObject,
        zIndex: 0,
      } as ViewStyle),
  foregroundLayer: {
    flex: 1,
    zIndex: 1,
    backgroundColor: 'transparent',
  },
});
