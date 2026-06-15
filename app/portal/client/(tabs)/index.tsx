import { useState } from 'react';
import { PortalOverviewTab } from '@/components/portal';
import { PortalTabScreen } from '@/screens/portal/PortalTabScreen';
import { useAuth } from '@/lib/auth/context';

export default function ClientPortalOverviewRoute() {
  const { profile, user } = useAuth();
  const [showSuccess, setShowSuccess] = useState(false);
  const displayName = profile?.displayName ?? user?.displayName ?? 'Portal';

  return (
    <PortalTabScreen title="Klient:innenportal">
      <PortalOverviewTab
        scope="portal_client"
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
