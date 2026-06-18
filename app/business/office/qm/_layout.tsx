import { Stack } from 'expo-router';
import { RequireAuth, RequireRole } from '@/lib/auth';
import { routeLayoutContentStyle } from '@/design/routeLayoutStyle';

export default function OfficeQmLayout() {
  return (
    <RequireAuth redirectTo={'/auth/business-login' as never}>
      <RequireRole>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: routeLayoutContentStyle,
            animation: 'slide_from_right',
          }}
        />
      </RequireRole>
    </RequireAuth>
  );
}
