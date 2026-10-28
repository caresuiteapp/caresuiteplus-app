import { usePathname } from 'expo-router';
import { useAppStartIntroReady } from '@/components/brand/appStartIntroSession';
import { isLiquidCommandRoutePath } from '@/liquid-command/navigation/isLiquidCommandRoute';
import { BusinessWelcomeGate } from './BusinessWelcomeGate';
import { PortalWelcomeGate } from './PortalWelcomeGate';

/** The current desktop and portal routes own their entry flow on every platform. */
export function RouteScopedLegacyOverlays() {
  const startupReady = useAppStartIntroReady();
  const pathname = usePathname();
  if (!startupReady || isLiquidCommandRoutePath(pathname)) return null;
  return <><BusinessWelcomeGate /><PortalWelcomeGate /></>;
}
