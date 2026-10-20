import { Stack } from 'expo-router';
import { RedirectIfAuthenticated } from '@/lib/auth/RedirectIfAuthenticated';

export default function AuthLayout() {
  return (
    <RedirectIfAuthenticated>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: 'transparent' },
          animation: 'fade',
        }}
      />
    </RedirectIfAuthenticated>
  );
}
