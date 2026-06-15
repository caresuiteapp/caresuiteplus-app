import { Stack } from 'expo-router';
import { RequireAuth, RequireRole } from '@/lib/auth';
import { routeLayoutContentStyle } from '@/design/routeLayoutStyle';

export default function EmployeePortalLayout() {
  return (
    <RequireAuth redirectTo={'/auth/employee-login' as never}>
      <RequireRole>
        <Stack screenOptions={{ headerShown: false, contentStyle: routeLayoutContentStyle }} />
      </RequireRole>
    </RequireAuth>
  );
}
