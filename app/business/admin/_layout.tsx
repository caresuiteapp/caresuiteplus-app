import { Stack } from 'expo-router';
import { RequireDevOrAdmin } from '@/lib/auth';

export default function BusinessAdminLayout() {
  return (
    <RequireDevOrAdmin>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: 'transparent' },
          animation: 'fade',
        }}
      />
    </RequireDevOrAdmin>
  );
}
