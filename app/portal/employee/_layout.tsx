import { Stack } from 'expo-router';
import { RequireAuth, RequireEmployeePasswordSetup, RequireRole } from '@/lib/auth';
import { routeLayoutContentStyle } from '@/design/routeLayoutStyle';

export default function EmployeePortalLayout() {
  return (
    <RequireAuth redirectTo={'/auth/employee-login' as never}>
      <RequireEmployeePasswordSetup>
        <RequireRole>
          <Stack screenOptions={{ headerShown: false, contentStyle: routeLayoutContentStyle }} />
        </RequireRole>
      </RequireEmployeePasswordSetup>
    </RequireAuth>
  );
}
