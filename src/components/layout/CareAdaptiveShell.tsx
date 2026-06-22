import { ReactNode } from 'react';
import type { AppShellArea } from '@/types/navigation/shell';
import { PortalShellLayout } from '@/components/layout/portal';
import { CareDesktopShell } from './CareDesktopShell';
import { CompactPlatformShell } from './CompactPlatformShell';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import type { ShellTabConfig } from '@/types/navigation/shell';

type CareAdaptiveShellProps = {
  area: AppShellArea;
  children: ReactNode;
  accentColor?: string;
  showModuleSwitcher?: boolean;
  /** Public landing / auth screens — no tab bar or side navigation. */
  bare?: boolean;
  tabsOverride?: ShellTabConfig[];
};

/**
 * Picks CareSuite+ shell by adaptive device class.
 * Desktop (≥1024): PlatformShell rail + sidebar unchanged.
 * Mobile/tablet (<1024): compact app shell with top bar, bottom nav, drawer menu.
 */
export function CareAdaptiveShell({
  area,
  children,
  accentColor,
  bare = false,
  tabsOverride,
}: CareAdaptiveShellProps) {
  const { isDesktopOrWide } = useDeviceClass();

  if (bare) {
    return <>{children}</>;
  }

  if (area === 'portal_client' || area === 'portal_employee') {
    return (
      <PortalShellLayout
        accentColor={accentColor}
        kind={area === 'portal_employee' ? 'employee' : 'client'}
      >
        {children}
      </PortalShellLayout>
    );
  }

  if (isDesktopOrWide) {
    return (
      <CareDesktopShell area={area} accentColor={accentColor}>
        {children}
      </CareDesktopShell>
    );
  }

  return (
    <CompactPlatformShell area={area} accentColor={accentColor} tabsOverride={tabsOverride}>
      {children}
    </CompactPlatformShell>
  );
}
