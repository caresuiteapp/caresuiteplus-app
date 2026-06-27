import { useState } from 'react';
import { AdaptivePortalOverview } from '@/components/portal/AdaptivePortalOverview';
import { PortalTabScreen } from '@/screens/portal/PortalTabScreen';
import { LoadingState } from '@/components/ui';
import { usePortalActor } from '@/hooks/usePortalActor';

export default function ClientPortalOverviewRoute() {
  const { isReady } = usePortalActor();
  const [showSuccess, setShowSuccess] = useState(false);

  if (!isReady) {
    return (
      <PortalTabScreen title="Klient:innenportal" scroll={false} hideHeaderOnPhone>
        <LoadingState message="Klient:innenportal wird geladen…" />
      </PortalTabScreen>
    );
  }

  return (
    <PortalTabScreen title="Klient:innenportal" scroll={false} hideHeaderOnPhone>
      <AdaptivePortalOverview
        showSuccess={showSuccess}
        onRefresh={() => {
          setShowSuccess(true);
          setTimeout(() => setShowSuccess(false), 2000);
        }}
      />
    </PortalTabScreen>
  );
}
