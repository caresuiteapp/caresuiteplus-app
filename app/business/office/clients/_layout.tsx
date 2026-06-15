import { Stack } from 'expo-router';
import { routeLayoutContentStyle } from '@/design/routeLayoutStyle';

export default function ClientsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: routeLayoutContentStyle,
        animation: 'slide_from_right',
      }}
    />
  );
}
