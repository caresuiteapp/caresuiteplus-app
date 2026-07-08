import { Stack } from 'expo-router';
import { PlatformAuthGate } from '@/components/platformConsole';

export default function PlatformConsoleLayout() {
  return (
    <PlatformAuthGate>
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />
    </PlatformAuthGate>
  );
}
