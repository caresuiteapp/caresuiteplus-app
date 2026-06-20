import { ReactNode } from 'react';
import { PortalShell } from './PortalShell';

type EmployeePortalShellProps = {
  children: ReactNode;
  accentColor?: string;
};

export function EmployeePortalShell({ children, accentColor }: EmployeePortalShellProps) {
  return (
    <PortalShell kind="employee" accentColor={accentColor}>
      {children}
    </PortalShell>
  );
}
