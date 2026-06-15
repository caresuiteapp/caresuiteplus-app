import { InsightDataSourcesListView } from '@/components/insight/InsightDataSourcesListView';
import { ScreenShell } from '@/components/layout';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { useInsightDataSources } from '@/hooks/useInsightDataSources';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/lib/auth/context';
import { wp499InsightA11y } from '@/lib/a11y/wp499-insight';

export function InsightDataSourcesListScreen() {
  const { profile } = useAuth();
  const { can, roleLabel } = usePermissions();
  const roleKey = profile?.roleKey ?? 'business_admin';
  const { items, loading, error, refresh } = useInsightDataSources();

  if (!can('dashboard.view')) {
    return (
      <ScreenShell title="Datenquellen" subtitle="Kein Zugriff">
        <EmptyState title="Zugriff verweigert" message="InsightCenter ist nicht freigegeben." />
      </ScreenShell>
    );
  }

  if (loading && items.length === 0) {
    return (
      <ScreenShell title="Datenquellen" subtitle="InsightCenter" showBack a11yMeta={wp499InsightA11y}>
        <LoadingState message="Datenquellen werden geladen…" />
      </ScreenShell>
    );
  }

  if (error && items.length === 0) {
    return (
      <ScreenShell title="Datenquellen" subtitle="Fehler" showBack>
        <ErrorState message={error} onRetry={refresh} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title="Datenquellen"
      subtitle={`KPI-Feeds · ${roleLabel ?? 'Demo'}`}
      showBack
      scroll={false}
      a11yMeta={wp499InsightA11y}
    >
      <InsightDataSourcesListView
        items={items}
        roleKey={roleKey}
        loading={loading}
        onRefresh={refresh}
      />
    </ScreenShell>
  );
}
