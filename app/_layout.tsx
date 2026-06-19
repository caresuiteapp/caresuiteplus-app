import 'react-native-reanimated';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, Platform } from 'react-native';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { ThemeModeProvider, useThemeMode } from '@/design/ThemeModeProvider';
import { resolveCareSuitePalette } from '@/design/tokens/colors';
import { AuthProvider } from '@/lib/auth';
import { useShellHostsAurora } from '@/hooks/useshellhostsaurora';

if (__DEV__ && Platform.OS === 'web') {
  require('@/devtools/registerDevAudit');
}

function RootShell() {
  const { mode } = useThemeMode();
  const shellHostsAurora = useShellHostsAurora();
  const palette = resolveCareSuitePalette(mode);
  const surfaceColor = shellHostsAurora ? 'transparent' : palette.background.app;
  const baseTheme = mode === 'dark' ? DarkTheme : DefaultTheme;

  const navigationTheme = {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      background: surfaceColor,
      card: surfaceColor,
    },
  };

  return (
    <ThemeProvider value={navigationTheme}>
      <View style={[styles.root, { backgroundColor: surfaceColor }]}>
        <StatusBar style={mode === 'light' ? 'dark' : 'light'} />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: surfaceColor },
            animation: 'slide_from_right',
          }}
        />
      </View>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <ThemeModeProvider>
        <RootShell />
      </ThemeModeProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
