import { ReactNode } from 'react';
import type { AppShellArea } from '@/types/navigation/shell';
import type { ShellTabConfig } from '@/types/navigation/shell';
import { MobileAppShell } from './MobileAppShell';

type CompactPlatformShellProps = {
  area: AppShellArea;
  children: ReactNode;
  accentColor?: string;
  tabsOverride?: ShellTabConfig[];
};

/** Platform modules (business/office/assist/…) on mobile and tablet — delegates to MobileAppShell. */
export function CompactPlatformShell(props: CompactPlatformShellProps) {
  return <MobileAppShell {...props} />;
}
