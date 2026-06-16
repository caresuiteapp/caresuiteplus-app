import { Stack } from 'expo-router';
import { routeLayoutContentStyle } from '@/design/routeLayoutStyle';
import { RedirectIfAuthenticated } from '@/lib/auth/RedirectIfAuthenticated';

export default function AuthLayout() {
  return (
    <RedirectIfAuthenticated>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: routeLayoutContentStyle,
          animation: 'fade',
        }}
      />
    </RedirectIfAuthenticated>
  );
}
