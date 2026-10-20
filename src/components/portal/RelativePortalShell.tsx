import { ReactNode } from 'react';
import { PortalShell } from './PortalShell';

type RelativePortalShellProps = {
  children: ReactNode;
  accentColor?: string;
};

export function RelativePortalShell({ children, accentColor }: RelativePortalShellProps) {
  return (
    <PortalShell kind="relative" accentColor={accentColor}>
      {children}
    </PortalShell>
  );
}
