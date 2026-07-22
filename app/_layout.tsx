import 'react-native-reanimated';
import { Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View, StyleSheet, Platform, type ViewStyle } from 'react-native';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { applyInvisibleScrollIndicators } from '@/design/scroll/applyInvisibleScrollIndicators';
import { ThemeModeProvider, useThemeMode } from '@/design/ThemeModeProvider';
import { WebFontScaleProvider } from '@/design/web/WebFontScaleProvider';
import { GlobalAnimatedBackground } from '@/components/ui/effects';
import { cleanupOrphanedFullscreenOverlays } from '@/lib/dom/cleanupOrphanedFullscreenOverlays';
import { isPortalRoutePath } from '@/lib/navigation/isPortalRoute';
import { GlobalScreensaver, ScreensaverSettingsProvider } from '@/components/screensaver';
import { GlobalAiProvider } from '@/ai/GlobalAiProvider';
import { ModalStackProvider } from '@/components/navigation/ModalStackProvider';
import { AuthProvider } from '@/lib/auth';
import { BusinessWelcomeGate } from '@/components/auth/BusinessWelcomeGate';
import { PortalWelcomeGate } from '@/components/auth/PortalWelcomeGate';
import { PerformanceProvider, useDevicePerformance, shouldUseHeavyEffects } from '@/lib/performance';
import { installPerformanceDiagnostics } from '@/lib/performance/performanceDiagnostics';
import { useHydrated } from '@/hooks/useHydrated';

applyInvisibleScrollIndicators();

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
  const hostsGlobalBackground = !isPortalRoutePath(pathname);

  useEffect(() => {
    cleanupOrphanedFullscreenOverlays();
  }, []);

  useEffect(() => {
    cleanupOrphanedFullscreenOverlays();
  }, [pathname]);

  const backgroundAnimated =
    hydrated && hostsGlobalBackground && shouldUseHeavyEffects(perf);
  const isDark = mode === 'dark';
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
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: SURFACE_COLOR },
                animation: 'slide_from_right',
              }}
            />
          </View>
        </View>
      </View>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <ThemeModeProvider>
        <PerformanceProvider>
          <WebFontScaleProvider>
            <GlobalAiProvider>
              <ModalStackProvider>
                <ScreensaverSettingsProvider>
                  <BusinessWelcomeGate />
                  <PortalWelcomeGate />
                  <GlobalScreensaver />
                  <RootShell />
                </ScreensaverSettingsProvider>
              </ModalStackProvider>
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
