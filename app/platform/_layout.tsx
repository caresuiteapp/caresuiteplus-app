import { Stack } from 'expo-router';
import { PlatformAuthProvider } from '@/lib/platformConsole/PlatformAuthProvider';

export default function PlatformRootLayout() {
  return (
    <PlatformAuthProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: 'transparent' },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="login" options={{ animation: 'fade' }} />
        <Stack.Screen name="forbidden" options={{ animation: 'fade' }} />
        <Stack.Screen name="(console)" />
        <Stack.Screen name="index" />
      </Stack>
    </PlatformAuthProvider>
  );
}
