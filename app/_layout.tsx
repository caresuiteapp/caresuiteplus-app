import 'react-native-reanimated';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet } from 'react-native';
import { ThemeModeProvider, useThemeMode } from '@/design/ThemeModeProvider';
import { resolveCareSuitePalette } from '@/design/tokens/colors';
import { AuthProvider } from '@/lib/auth';

function RootShell() {
  const { mode } = useThemeMode();
  const palette = resolveCareSuitePalette(mode);

  return (
    <View style={[styles.root, { backgroundColor: palette.background.app }]}>
      <StatusBar style={mode === 'light' ? 'dark' : 'light'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: palette.background.app },
          animation: 'slide_from_right',
        }}
      />
    </View>
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
