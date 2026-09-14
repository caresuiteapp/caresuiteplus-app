import { Platform } from 'react-native';
import { Redirect, usePathname } from 'expo-router';
import { LiquidModuleRouteLayout } from '@/liquid-command/shell/LiquidModuleRouteLayout';
import { isLegacyBusinessHomePath } from '@/lib/navigation/businessHome';

export default function BusinessLayout() {
  const pathname = usePathname();
  if (Platform.OS === 'web' && isLegacyBusinessHomePath(pathname)) {
    return <Redirect href="/" />;
  }
  return <LiquidModuleRouteLayout />;
}
