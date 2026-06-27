import { useState } from 'react';
import { EmployeePortalDashboardScreen } from '@/screens/portal/EmployeePortalDashboardScreen';
import { PortalTabScreen } from '@/screens/portal/PortalTabScreen';
import { LoadingState } from '@/components/ui';
import { usePortalActor } from '@/hooks/usePortalActor';

export default function EmployeePortalOverviewRoute() {
  const { isReady } = usePortalActor();
  const [showSuccess, setShowSuccess] = useState(false);

  if (!isReady) {
    return (
      <PortalTabScreen title="Mitarbeiterportal" scroll={false} hideHeaderOnPhone>
        <LoadingState message="Mitarbeiterportal wird geladen…" />
      </PortalTabScreen>
    );
  }

  return (
    <PortalTabScreen title="Mitarbeiterportal" scroll={false} hideHeaderOnPhone>
      <EmployeePortalDashboardScreen
        showSuccess={showSuccess}
        onRefresh={() => {
          setShowSuccess(true);
          setTimeout(() => setShowSuccess(false), 2000);
        }}
      />
    </PortalTabScreen>
  );
}
