import { useState } from 'react';
import { PortalOverviewTab } from '@/components/portal';
import { PortalTabScreen } from '@/screens/portal/PortalTabScreen';
import { useAuth } from '@/lib/auth/context';

export default function EmployeePortalOverviewRoute() {
  const { profile, user } = useAuth();
  const [showSuccess, setShowSuccess] = useState(false);
  const displayName = profile?.displayName ?? user?.displayName ?? 'Portal';

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
