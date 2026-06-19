import { ReactNode } from 'react';
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
  return <CareAdaptiveShell {...props} />;
}
