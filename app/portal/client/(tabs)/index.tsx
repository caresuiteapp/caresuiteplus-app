import { useState } from 'react';
import { AdaptivePortalOverview } from '@/components/portal/AdaptivePortalOverview';
import { LoadingState } from '@/components/ui';
import { usePortalActor } from '@/hooks/usePortalActor';
import { PortalTabScreen } from '@/screens/portal/PortalTabScreen';

export default function ClientPortalOverviewRoute() {
  const { isReady } = usePortalActor();
  const [showSuccess, setShowSuccess] = useState(false);

  if (!isReady) {
    return (
      <PortalTabScreen
        title="Klient:innenportal"
        eyebrow="PORTAL · KLIENT:INNEN"
        hideHeaderOnPhone
        scroll={false}
      >
        <LoadingState message="Ihre persönliche Übersicht wird geladen…" />
      </PortalTabScreen>
    );
  }

  return (
    <PortalTabScreen
      title="Klient:innenportal"
      eyebrow="PORTAL · KLIENT:INNEN"
      hideHeaderOnPhone
      scroll={false}
    >
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
