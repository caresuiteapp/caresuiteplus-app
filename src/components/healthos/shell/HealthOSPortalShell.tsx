import { ReactNode } from 'react';
import {
  PortalShellLayout,
  type PortalShellKind,
} from '@/components/layout/portal/PortalShellLayout';

type Props = {
  children: ReactNode;
  kind?: PortalShellKind;
  accentColor?: string;
};

/**
 * Optional HealthOS portal wrapper — delegates to existing PortalShellLayout.
 * Does not replace EmployeePortalShell (onboarding) or ClientPortalShell until H5/H6.
 */
export function HealthOSPortalShell({ children, kind = 'client', accentColor }: Props) {
  return (
    <PortalShellLayout kind={kind} accentColor={accentColor}>
      {children}
    </PortalShellLayout>
  );
}
