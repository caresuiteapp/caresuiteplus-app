import { Stack } from 'expo-router';
import { PlatformAuthGate, PlatformErrorBoundary } from '@/product-workflows/components/platformConsole';

export default function PlatformConsoleLayout() {
  return (
    <PlatformAuthGate>
      <PlatformErrorBoundary>
        <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />
      </PlatformErrorBoundary>
    </PlatformAuthGate>
  );
}
