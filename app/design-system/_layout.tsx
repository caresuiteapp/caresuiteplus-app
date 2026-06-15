import { Stack } from 'expo-router';
import { DevToolGate } from '@/components/auth/DevToolGate';
import { routeLayoutContentStyle } from '@/design/routeLayoutStyle';

export default function DesignSystemLayout() {
  return (
    <DevToolGate>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: routeLayoutContentStyle,
        }}
      />
    </DevToolGate>
  );
}
