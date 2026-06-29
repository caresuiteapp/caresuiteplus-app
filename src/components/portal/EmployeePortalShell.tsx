import { ReactNode } from 'react';
import { PortalShell } from './PortalShell';
import {
  EmployeePermissionOnboarding,
  useEmployeePermissionOnboardingGate,
} from './EmployeePermissionOnboarding';
import { useAuth } from '@/lib/auth/context';
import { usePortalActor } from '@/hooks/usePortalActor';
import { useServiceTenantId } from '@/hooks/useTenantId';

type EmployeePortalShellProps = {
  children: ReactNode;
  accentColor?: string;
};

export function EmployeePortalShell({ children, accentColor }: EmployeePortalShellProps) {
  const { profile } = useAuth();
  const { tenantId: portalTenantId, employeeId } = usePortalActor();
  const tenantId = useServiceTenantId() ?? portalTenantId;
  const { showOnboarding, complete, dismiss } = useEmployeePermissionOnboardingGate(
    tenantId,
    employeeId,
  );

  return (
    <PortalShell kind="employee" accentColor={accentColor}>
      {tenantId && employeeId ? (
        <EmployeePermissionOnboarding
          tenantId={tenantId}
          employeeId={employeeId}
          profileId={profile?.id}
          visible={showOnboarding}
          onComplete={complete}
          onDismiss={dismiss}
        />
      ) : null}
      {children}
    </PortalShell>
  );
}
