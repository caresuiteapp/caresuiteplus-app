import { InsightSnapshotsListView } from '@/components/insight/InsightSnapshotsListView';
import { ScreenShell } from '@/components/layout';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { useInsightDashboard } from '@/hooks/useInsightDashboard';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/lib/auth/context';
import { wp499InsightA11y } from '@/lib/a11y/wp499-insight';

export function InsightSnapshotsListScreen() {
  const { profile } = useAuth();
  const { can, roleLabel } = usePermissions();
  const roleKey = profile?.roleKey ?? 'business_admin';
  const { snapshots, loading, error, refresh } = useInsightDashboard();

  if (!can('dashboard.view')) {
    return (
      <ScreenShell title="Snapshots" subtitle="Kein Zugriff">
        <EmptyState title="Zugriff verweigert" message="InsightCenter ist nicht freigegeben." />
      </ScreenShell>
    );
  }

  if (loading && snapshots.length === 0) {
    return (
      <ScreenShell title="Snapshots" subtitle="InsightCenter" a11yMeta={wp499InsightA11y}>
        <LoadingState message="Snapshots werden geladen…" />
      </ScreenShell>
    );
  }

  if (error && snapshots.length === 0) {
    return (
      <ScreenShell title="Snapshots" subtitle="Fehler">
        <ErrorState message={error} onRetry={refresh} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title="Gespeicherte Snapshots"
      subtitle={`InsightCenter · ${roleLabel ?? 'Demo'}`}
      scroll={false}
      a11yMeta={wp499InsightA11y}
    >
      <InsightSnapshotsListView
        items={snapshots}
        roleKey={roleKey}
        loading={loading}
        onRefresh={refresh}
      />
    </ScreenShell>
  );
}
