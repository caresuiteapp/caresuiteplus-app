import { Stack } from 'expo-router';
import { routeLayoutContentStyle } from '@/design/routeLayoutStyle';

/** WP322/342 — Portal-Root-Navigation */
export default function PortalRootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: routeLayoutContentStyle }} />
  );
}
