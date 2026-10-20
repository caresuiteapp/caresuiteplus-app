import { Stack } from 'expo-router';
import { PlatformAuthProvider } from '@/lib/platformConsole/PlatformAuthProvider';
import { PortalPremiumProvider } from '@/design/tokens/portalPremium';

export default function PlatformRootLayout() {
  return (
    <PortalPremiumProvider kind="workspace">
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
    </PortalPremiumProvider>
  );
}
