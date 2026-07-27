import { Stack } from 'expo-router';
import { RequireAuth, RequireRole } from '@/lib/auth';

export default function ClientPortalLayout() {
  return (
    <RequireAuth redirectTo={'/auth/client-login' as never}>
      <RequireRole>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: 'transparent' },
            animation: 'fade',
          }}
        />
      </RequireRole>
    </RequireAuth>
  );
}
