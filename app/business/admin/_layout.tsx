import { Stack } from 'expo-router';
import { RequireDevOrAdmin } from '@/lib/auth';
import { routeLayoutContentStyle } from '@/design/routeLayoutStyle';

export default function BusinessAdminLayout() {
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
