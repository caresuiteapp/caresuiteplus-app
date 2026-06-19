import { ReactNode } from 'react';
import { usePlatformLayout } from '@/hooks/usePlatformLayout';
import { useThemeMode } from '@/design/ThemeModeProvider';
import { useShellHostsAurora } from '@/hooks/useshellhostsaurora';
import { PortalShellLayout } from '@/components/layout/portal';
import { CareDesktopShell } from './CareDesktopShell';
import { CareLightDesktopShell } from './CareLightDesktopShell';
import { CareLightMobileShell } from './CareLightMobileShell';
import { CareLightTabletShell } from './CareLightTabletShell';
import { CareMobileShell } from './CareMobileShell';
import { CareTabletShell } from './CareTabletShell';
import { CareWebShell } from './CareWebShell';

type CareAdaptiveShellProps = {
  area: Parameters<typeof CareMobileShell>[0]['area'];
  children: ReactNode;
  accentColor?: string;
  showModuleSwitcher?: boolean;
  /** Public landing / auth screens — no tab bar or side navigation. */
  bare?: boolean;
  tabsOverride?: Parameters<typeof CareMobileShell>[0]['tabsOverride'];
};

/**
 * Picks CareSuite+ shell by adaptive device class, platform, and theme mode.
 */
export function CareAdaptiveShell({
  area,
  children,
  accentColor,
  showModuleSwitcher,
  bare = false,
  tabsOverride,
}: CareAdaptiveShellProps) {
  const { adaptiveShell } = usePlatformLayout();
  const { mode } = useThemeMode();
  const shellHostsAurora = useShellHostsAurora();
  const useLightShell = mode === 'light' && !shellHostsAurora;

  if (bare) {
    return <>{children}</>;
  }

  if (area === 'portal_client') {
    return (
      <PortalShellLayout accentColor={accentColor}>
        {children}
      </PortalShellLayout>
    );
  }

  if (adaptiveShell === 'web') {
    return (
      <CareWebShell
        area={area}
        accentColor={accentColor}
        showModuleSwitcher={showModuleSwitcher}
        useLightShell={useLightShell}
        tabsOverride={tabsOverride}
      >
        {children}
      </CareWebShell>
    );
  }

  if (adaptiveShell === 'desktop') {
    const Shell = useLightShell ? CareLightDesktopShell : CareDesktopShell;
    return (
      <Shell area={area} accentColor={accentColor} showModuleSwitcher={showModuleSwitcher} tabsOverride={tabsOverride}>
        {children}
      </Shell>
    );
  }

  if (adaptiveShell === 'tablet') {
    const Shell = useLightShell ? CareLightTabletShell : CareTabletShell;
    return (
      <Shell area={area} accentColor={accentColor} showModuleSwitcher={showModuleSwitcher} tabsOverride={tabsOverride}>
        {children}
      </Shell>
    );
  }

  const Shell = useLightShell ? CareLightMobileShell : CareMobileShell;
  return (
    <Shell area={area} accentColor={accentColor} showModuleSwitcher={showModuleSwitcher} tabsOverride={tabsOverride}>
      {children}
    </Shell>
  );
}
