import 'react-native-reanimated';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, Platform } from 'react-native';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { applyInvisibleScrollIndicators } from '@/design/scroll/applyInvisibleScrollIndicators';
import { ThemeModeProvider, useThemeMode } from '@/design/ThemeModeProvider';
import { WebFontScaleProvider } from '@/design/web/WebFontScaleProvider';
import { GlobalAnimatedBackground } from '@/components/ui/effects';
import { GlobalScreensaver, ScreensaverSettingsProvider } from '@/components/screensaver';
import { GlobalAiProvider } from '@/ai/GlobalAiProvider';
import { ModalStackProvider } from '@/components/navigation/ModalStackProvider';
import { AuthProvider } from '@/lib/auth';
import { BusinessWelcomeGate } from '@/components/auth/BusinessWelcomeGate';

applyInvisibleScrollIndicators();

if (__DEV__ && Platform.OS === 'web') {
  require('@/devtools/registerDevAudit');
}

const SURFACE_COLOR = 'transparent';

function RootShell() {
  const { mode } = useThemeMode();
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
      <View style={[styles.root, isDark ? styles.rootDark : styles.rootLight]}>
        <View style={styles.backgroundLayer} pointerEvents="none">
          <GlobalAnimatedBackground mode={mode} animated />
        </View>
        <View style={styles.contentLayer} pointerEvents="box-none">
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
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <ThemeModeProvider>
        <WebFontScaleProvider>
          <GlobalAiProvider>
            <ModalStackProvider>
              <ScreensaverSettingsProvider>
                <BusinessWelcomeGate />
                <GlobalScreensaver />
                <RootShell />
              </ScreensaverSettingsProvider>
            </ModalStackProvider>
          </GlobalAiProvider>
        </WebFontScaleProvider>
      </ThemeModeProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  rootDark: {
    backgroundColor: '#050816',
  },
  rootLight: {
    backgroundColor: 'transparent',
  },
  backgroundLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
    ...(Platform.OS === 'web'
      ? ({
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100vw',
          height: '100vh',
        } as const)
      : null),
  },
  contentLayer: {
    flex: 1,
    zIndex: 1,
    position: 'relative',
    backgroundColor: 'transparent',
  },
});
