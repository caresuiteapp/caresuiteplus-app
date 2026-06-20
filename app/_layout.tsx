import 'react-native-reanimated';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, Platform } from 'react-native';
import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { ThemeModeProvider } from '@/design/ThemeModeProvider';
import { WebFontScaleProvider } from '@/design/web/WebFontScaleProvider';
import { GlobalAnimatedBackground } from '@/components/ui/effects';
import { GlobalAiProvider } from '@/ai/GlobalAiProvider';
import { ModalStackProvider } from '@/components/navigation/ModalStackProvider';
import { AuthProvider } from '@/lib/auth';

if (__DEV__ && Platform.OS === 'web') {
  require('@/devtools/registerDevAudit');
}

const SURFACE_COLOR = 'transparent';

const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: SURFACE_COLOR,
    card: SURFACE_COLOR,
  },
};

function RootShell() {
  return (
    <ThemeProvider value={navigationTheme}>
      <View style={styles.root}>
        <GlobalAnimatedBackground mode="dark" animated />
        <View style={styles.contentLayer} pointerEvents="box-none">
          <StatusBar style="light" />
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
              <RootShell />
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
    backgroundColor: '#050816',
  },
  contentLayer: {
    flex: 1,
    zIndex: 1,
  },
});
