import { Platform } from 'react-native';
import { Redirect, usePathname } from 'expo-router';
import { LiquidModuleRouteLayout } from '@/liquid-command/shell/LiquidModuleRouteLayout';
import { BUSINESS_HOME_ROUTE, isLegacyBusinessHomePath } from '@/lib/navigation/businessHome';

export default function BusinessLayout() {
  const pathname = usePathname();
  if (Platform.OS === 'web' && isLegacyBusinessHomePath(pathname)) {
    return <Redirect href={BUSINESS_HOME_ROUTE as never} />;
  }
  return <LiquidModuleRouteLayout />;
}
