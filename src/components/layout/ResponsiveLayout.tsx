import { ReactNode } from 'react';
import { CareAdaptiveShell } from './CareAdaptiveShell';

type ResponsiveLayoutProps = {
  area: Parameters<typeof CareAdaptiveShell>[0]['area'];
  children: ReactNode;
  accentColor?: string;
  showModuleSwitcher?: boolean;
};

/**
 * Backward-compatible alias — delegates to CareAdaptiveShell (incl. web wide).
 */
export function ResponsiveLayout(props: ResponsiveLayoutProps) {
  return <CareAdaptiveShell {...props} />;
}
