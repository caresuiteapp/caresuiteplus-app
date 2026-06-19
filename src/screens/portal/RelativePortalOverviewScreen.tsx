import { useState } from 'react';
import { PortalOverviewTab } from '@/components/portal';
import { PortalTabScreen } from '@/screens/portal/PortalTabScreen';
import { LoadingState } from '@/components/ui';
import { usePortalActor } from '@/hooks/usePortalActor';
import { getUserDisplayName } from '@/lib/auth/userdisplayname';
import { useAuth } from '@/lib/auth/context';

export function RelativePortalOverviewScreen() {
  const { profile, user } = useAuth();
  const { isReady } = usePortalActor();
  const [showSuccess, setShowSuccess] = useState(false);
  const displayName = getUserDisplayName(profile, user, 'Portal');

  if (!isReady) {
    return (
      <PortalTabScreen title="Angehörigenportal">
        <LoadingState message="Portal wird geladen…" />
      </PortalTabScreen>
    );
  }

  return (
    <PortalTabScreen title="Angehörigenportal">
      <PortalOverviewTab
        scope="portal_family"
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
