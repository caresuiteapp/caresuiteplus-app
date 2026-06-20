import { Stack } from 'expo-router';
import { RequireAuth, RequireRole } from '@/lib/auth';
import { routeLayoutContentStyle } from '@/design/routeLayoutStyle';

export default function RelativePortalLayout() {
  return (
    <RequireAuth redirectTo={'/auth/portal-code-login' as never}>
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
