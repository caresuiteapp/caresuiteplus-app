import { Redirect, usePathname, useLocalSearchParams } from 'expo-router';
import { Platform } from 'react-native';
import { liquidPortalNavigation } from '@/liquid-command/navigation/portalCatalog';
import { WEB_DESKTOP_ROUTE } from '@/lib/navigation/businessHome';

export default function LiquidCommandLayout() {
  const pathname = usePathname();
  const {section} = useLocalSearchParams<{section?: string | string[]}>();
  const home = Platform.OS === 'web' ? WEB_DESKTOP_ROUTE : '/';
  const canonicalRoutes: Record<string, string> = {
    '/liquid-command': home,
    '/liquid-command/access': '/auth',
    '/liquid-command/access/business': '/auth/business-login',
    '/liquid-command/access/employee': '/auth/employee-login',
    '/liquid-command/access/employee-first-login': '/auth/employee-first-login',
    '/liquid-command/access/client': '/auth/client-login',
    '/liquid-command/access/register': '/auth/register-business',
    '/liquid-command/access/recovery': '/auth/forgot-password',
    '/liquid-command/access/reset-password': '/auth/reset-password',
    '/liquid-command/portal/employee': '/portal/employee',
    '/liquid-command/portal/client': '/portal/client',
    '/liquid-command/portal/family': '/portal/client',
    '/liquid-command/office': '/office',
    '/liquid-command/assist': '/assist',
    '/liquid-command/pflege': '/pflege',
    '/liquid-command/stationaer': '/stationaer',
    '/liquid-command/beratung': '/beratung',
    '/liquid-command/akademie': '/akademie',
    '/liquid-command/robotics': '/robotics',
    '/liquid-command/platform': '/platform',
    '/liquid-command/settings': '/settings',
  };
  const portalKind = pathname === '/liquid-command/portal/employee' ? 'employee'
    : pathname === '/liquid-command/portal/client' || pathname === '/liquid-command/portal/family' ? 'client' : null;
  const requestedSection = typeof section === 'string' ? section : undefined;
  const sectionTarget = portalKind && requestedSection
    ? liquidPortalNavigation[portalKind].find(item => item.id === requestedSection)?.route
    : undefined;
  const target = sectionTarget ?? canonicalRoutes[pathname] ?? home;

  return <Redirect href={target as never} />;
}
