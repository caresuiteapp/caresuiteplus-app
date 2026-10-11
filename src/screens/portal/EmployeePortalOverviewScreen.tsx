import { useEffect, useRef, useState } from 'react';
import { EmployeePortalDashboardScreen } from '@/screens/portal/EmployeePortalDashboardScreen';
import { PortalTabScreen } from '@/screens/portal/PortalTabScreen';
import { LoadingState } from '@/components/ui';
import { usePortalActor } from '@/hooks/usePortalActor';

export function EmployeePortalOverviewScreen() {
  const { isReady } = usePortalActor();
  const [showSuccess, setShowSuccess] = useState(false);
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (successTimer.current) clearTimeout(successTimer.current); }, []);

  if (!isReady) {
    return (
      <PortalTabScreen title="Mitarbeiterportal" scroll hideHeaderOnPhone>
        <LoadingState message="Übersicht wird geladen…" />
      </PortalTabScreen>
    );
  }

  return (
    <PortalTabScreen title="Mitarbeiterportal" scroll={false} hideHeaderOnPhone>
      <EmployeePortalDashboardScreen
        showSuccess={showSuccess}
        onRefresh={() => {
          setShowSuccess(true);
          if (successTimer.current) clearTimeout(successTimer.current);
          successTimer.current = setTimeout(() => setShowSuccess(false), 2000);
        }}
      />
    </PortalTabScreen>
  );
}
