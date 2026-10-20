import { ReactNode } from 'react';
import { usePathname } from 'expo-router';
import { isLiquidCommandRoutePath } from '@/liquid-command/navigation/isLiquidCommandRoute';
import { CareAdaptiveShell } from './CareAdaptiveShell';

type ShellLayoutProps = {
  area: Parameters<typeof CareAdaptiveShell>[0]['area'];
  children: ReactNode;
  accentColor?: string;
  showModuleSwitcher?: boolean;
  tabsOverride?: Parameters<typeof CareAdaptiveShell>[0]['tabsOverride'];
};

/**
 * App shell entry point — CareAdaptiveShell (mobile / tablet / desktop / web).
 */
export function ShellLayout(props: ShellLayoutProps) {
  const pathname = usePathname();

  // Product routes already live inside LiquidCommandShell. Keeping the former
  // adaptive shell here would create a second navigation, a second background
  // and contradictory responsive breakpoints around the productive workflow.
  if (isLiquidCommandRoutePath(pathname)) {
    return <>{props.children}</>;
  }

  return <CareAdaptiveShell {...props} />;
}
