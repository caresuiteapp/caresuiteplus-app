import { usePathname } from 'expo-router';
import { Stack } from 'expo-router';
import { RequireModuleVisibility } from '@/components/ui/RequireModuleVisibility';
import { RequireAuth, RequireDevOrAdmin, RequireRole } from '@/lib/auth';
import { routeLayoutContentStyle } from '@/design/routeLayoutStyle';

export default function BusinessLayout() {
  const pathname = usePathname();
  const isAdminDevRoute = pathname.startsWith('/business/admin');

  if (isAdminDevRoute && __DEV__) {
    return (
      <RequireDevOrAdmin>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: routeLayoutContentStyle,
            animation: 'slide_from_right',
          }}
        />
      </RequireDevOrAdmin>
    );
  }

  return (
    <RequireAuth redirectTo={'/auth/business-login' as never}>
      <RequireRole>
        <RequireModuleVisibility>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: routeLayoutContentStyle,
              animation: 'slide_from_right',
            }}
          />
        </RequireModuleVisibility>
      </RequireRole>
    </RequireAuth>
  );
}
