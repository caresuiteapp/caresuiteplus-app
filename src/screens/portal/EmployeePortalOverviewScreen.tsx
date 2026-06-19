import { useState } from 'react';
import { PortalOverviewTab } from '@/components/portal';
import { PortalTabScreen } from '@/screens/portal/PortalTabScreen';
import { LoadingState } from '@/components/ui';
import { usePortalActor } from '@/hooks/usePortalActor';
import { getUserDisplayName } from '@/lib/auth/userdisplayname';
import { useAuth } from '@/lib/auth/context';

export function EmployeePortalOverviewScreen() {
  const { profile, user } = useAuth();
  const { isReady } = usePortalActor();
  const [showSuccess, setShowSuccess] = useState(false);
  const displayName = getUserDisplayName(profile, user, 'Portal');

  if (!isReady) {
    return (
      <PortalTabScreen title="Mitarbeiterportal">
        <LoadingState message="Portal wird geladen…" />
      </PortalTabScreen>
    );
  }

  return (
    <PortalTabScreen title="Mitarbeiterportal">
      <PortalOverviewTab
        scope="portal_employee"
        displayName={displayName}
        showSuccess={showSuccess}
        onRefresh={() => {
          setShowSuccess(true);
          setTimeout(() => setShowSuccess(false), 2000);
        }}
      />
    </PortalTabScreen>
  );
}
