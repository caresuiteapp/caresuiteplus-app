import { ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { PortalShell } from './PortalShell';
import {
  EmployeePermissionOnboarding,
  useEmployeePermissionOnboardingGate,
} from './EmployeePermissionOnboarding';
import { OfflineNotice } from '@/components/ui/OfflineNotice';
import { useAuth } from '@/lib/auth/context';
import { useConnectivity } from '@/hooks/useConnectivity';
import { useOfflineAssignmentPrefetch } from '@/hooks/useOfflineAssignmentPrefetch';
import { useOfflineDbInit } from '@/hooks/useOfflineDbInit';
import { usePortalActor } from '@/hooks/usePortalActor';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { spacing } from '@/theme';

type EmployeePortalShellProps = {
  children: ReactNode;
  accentColor?: string;
};

export function EmployeePortalShell({ children, accentColor }: EmployeePortalShellProps) {
  const { profile } = useAuth();
  const { tenantId: portalTenantId, employeeId } = usePortalActor();
  const tenantId = useServiceTenantId() ?? portalTenantId;
  const { isOffline } = useConnectivity();
  useOfflineDbInit();
  useOfflineAssignmentPrefetch();
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
      {isOffline ? (
        <View style={styles.offlineBanner} accessibilityLiveRegion="polite">
          <OfflineNotice visible />
        </View>
      ) : null}
      {children}
    </PortalShell>
  );
}

const styles = StyleSheet.create({
  offlineBanner: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
});
