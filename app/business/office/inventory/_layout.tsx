import { Stack } from 'expo-router';
import { RequireAuth, RequireRole } from '@/lib/auth';

export default function OfficeInventoryLayout() {
  return (
    <RequireAuth redirectTo={'/auth/business-login' as never}>
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
