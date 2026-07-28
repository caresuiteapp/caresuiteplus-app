import { Redirect, usePathname } from 'expo-router';

export default function LiquidCommandLayout() {
  const pathname = usePathname();
  const canonicalRoutes: Record<string, string> = {
    '/liquid-command': '/',
    '/liquid-command/access': '/auth',
    '/liquid-command/access/business': '/auth/business-login',
    '/liquid-command/access/employee': '/auth/employee-login',
    '/liquid-command/access/employee-first-login': '/auth/employee-first-login',
    '/liquid-command/access/client': '/auth/client-login',
    '/liquid-command/access/family': '/auth/family-login',
    '/liquid-command/access/register': '/auth/register-business',
    '/liquid-command/access/recovery': '/auth/forgot-password',
    '/liquid-command/access/reset-password': '/auth/reset-password',
    '/liquid-command/portal/employee': '/portal/employee',
    '/liquid-command/portal/client': '/portal/client',
    '/liquid-command/portal/family': '/portal/relative',
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
  const target = canonicalRoutes[pathname] ?? '/';

  return <Redirect href={target as never} />;
}
