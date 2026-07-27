import { Stack } from 'expo-router';
import { RequireAuth, RequireEmployeePasswordSetup, RequireRole } from '@/lib/auth';

export default function EmployeePortalLayout() {
  return (
    <RequireAuth redirectTo={'/auth/employee-login' as never}>
      <RequireEmployeePasswordSetup>
        <RequireRole>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: 'transparent' },
              animation: 'fade',
            }}
          />
        </RequireRole>
      </RequireEmployeePasswordSetup>
    </RequireAuth>
  );
}
