import { Stack } from 'expo-router';
import { RequireAuth } from '@/lib/auth';
import { routeLayoutContentStyle } from '@/design/routeLayoutStyle';

export default function SettingsLayout() {
  return (
    <RequireAuth redirectTo={'/auth/business-login' as never}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: routeLayoutContentStyle,
          animation: 'slide_from_right',
        }}
      />
    </RequireAuth>
  );
}
