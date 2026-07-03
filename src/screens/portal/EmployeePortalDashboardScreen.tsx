import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { HealthOSEmployeePortalTodayView } from '@/components/healthos/employee';
import { useEmployeePortalDashboard } from '@/hooks/useEmployeePortalDashboard';
import { usePortalActor } from '@/hooks/usePortalActor';

type EmployeePortalDashboardScreenProps = {
  showSuccess?: boolean;
  onRefresh?: () => void;
};

export function EmployeePortalDashboardScreen({
  onRefresh,
}: EmployeePortalDashboardScreenProps) {
  const { displayName } = usePortalActor();
  const { dashboard, loading, error, refresh } = useEmployeePortalDashboard();
  const router = useRouter();

  const handleRefresh = useCallback(async () => {
    await refresh();
    onRefresh?.();
  }, [refresh, onRefresh]);

  return (
    <HealthOSEmployeePortalTodayView
      dashboard={dashboard}
      loading={loading}
      error={error}
      displayName={displayName ?? 'Mitarbeiter:in'}
      onRefresh={() => void handleRefresh()}
    />
  );
}
