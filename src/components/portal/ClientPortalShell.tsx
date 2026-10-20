import { ReactNode } from 'react';
import { PortalShell } from './PortalShell';

type ClientPortalShellProps = {
  children: ReactNode;
  accentColor?: string;
};

export function ClientPortalShell({ children, accentColor }: ClientPortalShellProps) {
  return (
    <PortalShell kind="client" accentColor={accentColor}>
      {children}
    </PortalShell>
  );
}
