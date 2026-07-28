import type { ReactNode } from 'react';
import { Stack, usePathname } from 'expo-router';
import { RequireAuth, RequireRole } from '@/lib/auth';
import { LiquidProductAccessGuard } from '../guards/LiquidProductAccessGuard';
import { LiquidCommandShell } from './LiquidCommandShell';
import type { LiquidModuleKey } from '../types';

type LiquidModuleRouteLayoutProps = {
  children?: ReactNode;
  requireRole?: boolean;
  requireProduct?: boolean;
};

const transparentContent = { backgroundColor: 'transparent' } as const;

function LiquidModuleStack() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: transparentContent,
        animation: 'fade',
      }}
    />
  );
}

const MODULE_ROOTS: Record<LiquidModuleKey, readonly string[]> = {
  home: ['/'],
  office: ['/office'],
  assist: ['/assist'],
  pflege: ['/pflege'],
  stationaer: ['/stationaer'],
  beratung: ['/beratung'],
  akademie: ['/akademie'],
  robotics: ['/robotics'],
  platform: ['/platform'],
  settings: ['/settings'],
};

function inferLiquidModule(pathname: string): LiquidModuleKey {
  if (pathname.startsWith('/business/messages') || pathname.startsWith('/business/office')) return 'office';
  if (pathname.startsWith('/business')) return 'office';
  if (pathname.startsWith('/office') || pathname.startsWith('/communication') || pathname.startsWith('/insight')) return 'office';
  if (pathname.startsWith('/assist')) return 'assist';
  if (pathname.startsWith('/pflege') || pathname.startsWith('/medical')) return 'pflege';
  if (pathname.startsWith('/stationaer')) return 'stationaer';
  if (pathname.startsWith('/beratung')) return 'beratung';
  if (pathname.startsWith('/akademie')) return 'akademie';
  if (pathname.startsWith('/robotics')) return 'robotics';
  if (pathname.startsWith('/platform') || pathname.startsWith('/admin')) return 'platform';
  return 'settings';
}

function inferArea(pathname: string, moduleKey: LiquidModuleKey): string | null {
  const normalized = pathname.toLowerCase();
  if (normalized.includes('/messages')) return 'communication';
  if (normalized.includes('/payroll')) return 'payroll';
  if (normalized.includes('/time-tracking')) return 'timekeeping';
  if (normalized.includes('/clients') || normalized.includes('/klient')) return moduleKey === 'assist' ? 'clients' : 'clients';
  if (normalized.includes('/employees') || normalized.includes('/personal')) return 'people';
  if (normalized.includes('/documents')) return 'documents';
  if (normalized.includes('/invoice') || normalized.includes('/billing')) return 'billing';
  if (normalized.includes('/assignment') || normalized.includes('/einsatz')) return 'assignments';
  if (normalized.includes('/bodymap') || normalized.includes('/wund')) return 'wounds';
  return null;
}

function isModuleRoot(pathname: string, moduleKey: LiquidModuleKey): boolean {
  return MODULE_ROOTS[moduleKey].includes(pathname);
}

function LiquidModuleContent() {
  const pathname = usePathname();
  const moduleKey = inferLiquidModule(pathname);
  if (isModuleRoot(pathname, moduleKey)) return <LiquidModuleStack />;

  return (
    <LiquidCommandShell
      activeModule={moduleKey}
      activeArea={inferArea(pathname, moduleKey)}
      title="Facharbeitsbereich"
      subtitle="Produktiver CareSuite-Workflow im gemeinsamen Liquid-Command-System."
      contextLabel="Aktive Fachseite"
      contextDetail={pathname}
      contentMode="fill"
      showPageHeader={false}
    >
      <LiquidModuleStack />
    </LiquidCommandShell>
  );
}

/**
 * Authentication-only route boundary for migrated modules.
 *
 * It deliberately does not import ShellLayout, module colors, route layout
 * styles or another legacy visual primitive.
 */
export function LiquidModuleRouteLayout({
  requireRole = true,
  requireProduct = true,
}: LiquidModuleRouteLayoutProps) {
  let content: ReactNode = <LiquidModuleContent />;

  if (requireProduct) {
    content = <LiquidProductAccessGuard>{content}</LiquidProductAccessGuard>;
  }
  if (requireRole) {
    content = <RequireRole>{content}</RequireRole>;
  }

  return (
    <RequireAuth redirectTo={'/auth/business-login' as never}>
      {content}
    </RequireAuth>
  );
}
