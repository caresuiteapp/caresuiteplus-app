import { Stack } from 'expo-router';
import { RequireAuth, RequireRole } from '@/lib/auth';
import { RequireProductAccess } from '@/components/ui';
import { routeLayoutContentStyle } from '@/design/routeLayoutStyle';

export default function AssistLayout() {
  return (
    <RequireAuth redirectTo={'/auth/business-login' as never}>
      <RequireRole>
        <RequireProductAccess>
          <Stack screenOptions={{ headerShown: false, contentStyle: routeLayoutContentStyle }} />
        </RequireProductAccess>
      </RequireRole>
    </RequireAuth>
  );
}
