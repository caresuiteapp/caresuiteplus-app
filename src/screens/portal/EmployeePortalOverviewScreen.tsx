import { useCallback, useEffect, useRef, useState } from 'react';
import { EmployeePortalDashboardScreen } from '@/screens/portal/EmployeePortalDashboardScreen';
import { PortalTabScreen } from '@/screens/portal/PortalTabScreen';
import { LoadingState } from '@/components/ui';
import { usePortalActor } from '@/hooks/usePortalActor';
import { useEmployeePortalWorkspaceContext } from '@/components/portal/employee/EmployeePortalWorkspaceContext';
import { EmployeePortalWorkspaceHome } from '@/components/portal/employee/EmployeePortalToday';
import { nextEmployeePortalMotivation } from '@/lib/portal/employee/employeePortalMotivation';

export function EmployeePortalOverviewScreen() {
  const { isReady, displayName, tenantId, actorId } = usePortalActor();
  const workspace = useEmployeePortalWorkspaceContext();
  const motivationOwner = isReady && tenantId && actorId ? JSON.stringify([tenantId, actorId]) : null;
  const [motivation, setMotivation] = useState<{ owner: string; text: string | null } | null>(null);
  const motivationRequest = useRef(0);
  const refreshMotivation = useCallback(() => {
    if (!motivationOwner) return;
    const request = ++motivationRequest.current;
    void nextEmployeePortalMotivation(motivationOwner).then(text => {
      if (motivationRequest.current === request) setMotivation({ owner: motivationOwner, text });
    });
  }, [motivationOwner]);
  useEffect(() => {
    refreshMotivation();
    return () => { motivationRequest.current++; };
  }, [refreshMotivation]);
  const motivationText = motivation && motivation.owner === motivationOwner ? motivation.text : null;
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
    <PortalTabScreen title="Mitarbeiterportal" scroll hideHeaderOnPhone>
      {workspace && workspace.selected !== 'assist' ? <EmployeePortalWorkspaceHome displayName={displayName} motivation={motivationText}
        onRefreshMotivation={refreshMotivation} /> : <EmployeePortalDashboardScreen
        motivation={motivationText}
        onRefreshMotivation={refreshMotivation}
        showSuccess={showSuccess}
        onRefresh={() => {
          setShowSuccess(true);
          if (successTimer.current) clearTimeout(successTimer.current);
          successTimer.current = setTimeout(() => setShowSuccess(false), 2000);
        }}
      />}
    </PortalTabScreen>
  );
}
