import { useState } from 'react';
import { PortalOverviewTab } from '@/components/portal';
import { PortalTabScreen } from '@/screens/portal/PortalTabScreen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useAuth } from '@/lib/auth/context';
import { fetchClientPortalDashboard } from '@/lib/portal/clientPortalService';

export function RelativePortalOverviewScreen() {
  const { profile, user } = useAuth();
  const [showSuccess, setShowSuccess] = useState(false);
  const displayName = profile?.displayName ?? user?.displayName ?? 'Portal';

  const query = useAsyncQuery(
    () => fetchClientPortalDashboard(profile?.tenantId ?? '', profile?.roleKey),
    [profile?.tenantId, profile?.roleKey],
    { enabled: !!profile?.tenantId },
  );

  if (query.loading && !query.data) {
    return (
      <PortalTabScreen title="Angehörigenportal">
        <LoadingState message="Portal wird geladen…" />
      </PortalTabScreen>
    );
  }

  if (query.error && !query.data) {
    return (
      <PortalTabScreen title="Angehörigenportal">
        <ErrorState message={query.error} onRetry={query.refresh} />
      </PortalTabScreen>
    );
  }

  if (!query.data) {
    return (
      <PortalTabScreen title="Angehörigenportal">
        <EmptyState title="Kein Portalinhalt" message="Dashboard-Daten sind noch nicht verfügbar." />
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
          void query.refresh();
          setShowSuccess(true);
          setTimeout(() => setShowSuccess(false), 2000);
        }}
      />
    </PortalTabScreen>
  );
}

void fetchClientPortalDashboard;
