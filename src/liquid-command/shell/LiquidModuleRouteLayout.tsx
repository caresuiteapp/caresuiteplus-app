import type { ReactNode } from 'react';
import { Stack, usePathname, useRouter } from 'expo-router';
import { RequireAuth, RequireRole } from '@/lib/auth';
import { PortalPremiumProvider } from '@/design/tokens/portalPremium';
import { LiquidProductAccessGuard } from '../guards/LiquidProductAccessGuard';
import { LiquidCommandShell } from './LiquidCommandShell';
import type { LiquidModuleKey } from '../types';
import { describeLiquidRoute } from '../navigation/routeContext';
import {
  getLiquidPrimaryActionLabel,
  getLiquidPrimaryWorkflowRoute,
} from '../navigation/workflowRoutes';
import { DeferredSignatureApprovalPopup } from '@/components/assist/DeferredSignatureApprovalPopup';

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
  if (
    pathname.startsWith('/business/connect') ||
    pathname.startsWith('/business/integrations') ||
    pathname.startsWith('/business/templates') ||
    pathname.startsWith('/business/security') ||
    pathname.startsWith('/business/settings') ||
    pathname.startsWith('/design-system') ||
    pathname.startsWith('/onboarding')
  ) return 'settings';
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

function isModuleRoot(pathname: string, moduleKey: LiquidModuleKey): boolean {
  return MODULE_ROOTS[moduleKey].includes(pathname);
}

function LiquidModuleContent() {
  const pathname = usePathname();
  const router = useRouter();
  const moduleKey = inferLiquidModule(pathname);
  if (isModuleRoot(pathname, moduleKey)) {
    return (
      <>
        <LiquidModuleStack />
        {moduleKey === 'assist' ? <DeferredSignatureApprovalPopup /> : null}
      </>
    );
  }
  const routeContext = describeLiquidRoute(pathname, moduleKey);
  const primaryRoute = routeContext.areaId
    ? getLiquidPrimaryWorkflowRoute(moduleKey, routeContext.areaId)
    : null;
  const primaryActionLabel = routeContext.areaId
    ? getLiquidPrimaryActionLabel(moduleKey, routeContext.areaId)
    : null;

  return (
    <>
      <LiquidCommandShell
      activeModule={moduleKey}
      activeArea={routeContext.areaId}
      title="Facharbeitsbereich"
      subtitle="Produktiver CareSuite-Workflow im gemeinsamen Liquid-Command-System."
      contextLabel={routeContext.contextLabel}
      contextDetail={routeContext.contextDetail}
      primaryActionLabel={primaryActionLabel ?? undefined}
      onPrimaryAction={primaryRoute ? () => router.push(primaryRoute as never) : undefined}
      contentMode="fill"
      showPageHeader={false}
    >
      <LiquidModuleStack />
      </LiquidCommandShell>
      {moduleKey === 'assist' ? <DeferredSignatureApprovalPopup /> : null}
    </>
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
  let content: ReactNode = (
    <PortalPremiumProvider kind="workspace">
      <LiquidModuleContent />
    </PortalPremiumProvider>
  );

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
