import { useCallback } from 'react';
import { HealthOSEmployeePortalTodayView } from '@/components/healthos/employee';
import { useEmployeePortalDashboard } from '@/hooks/useEmployeePortalDashboard';
import { usePortalActor } from '@/hooks/usePortalActor';
import { usePortalOfficeMessages } from '@/hooks/useportalofficemessages';

type EmployeePortalDashboardScreenProps = {
  showSuccess?: boolean;
  onRefresh?: () => void;
  motivation?: string | null;
  onRefreshMotivation?: () => void;
};

export function EmployeePortalDashboardScreen({
  showSuccess,
  onRefresh,
  motivation,
  onRefreshMotivation,
}: EmployeePortalDashboardScreenProps) {
  const { displayName } = usePortalActor();
  const { dashboard, loading, error, refreshWithResult, refreshing, refreshError, fromCache, cachedAt } = useEmployeePortalDashboard();
  const inbox = usePortalOfficeMessages('open', true);
  const refreshInbox = inbox.refreshWithResult;

  const handleRefresh = useCallback(async () => {
    onRefreshMotivation?.();
    const results = await Promise.all([refreshWithResult(), refreshInbox()]);
    if (results.every(Boolean)) onRefresh?.();
  }, [refreshWithResult, refreshInbox, onRefresh, onRefreshMotivation]);

  return (
    <HealthOSEmployeePortalTodayView
      dashboard={dashboard ? { ...dashboard,
        messageCount: inbox.threads.reduce((count, thread) => count + thread.unreadCount, 0),
        messageCountUnavailable: inbox.loading || Boolean(inbox.error || inbox.refreshError),
        messagesError: inbox.error || inbox.refreshError,
      } : null}
      loading={loading}
      error={error}
      displayName={displayName ?? 'Mitarbeiter:in'}
      motivation={motivation}
      onRefresh={() => void handleRefresh()}
      fromCache={fromCache}
      cachedAt={cachedAt}
      refreshing={refreshing || inbox.refreshing}
      refreshError={refreshError}
      showSuccess={showSuccess}
    />
  );
}
