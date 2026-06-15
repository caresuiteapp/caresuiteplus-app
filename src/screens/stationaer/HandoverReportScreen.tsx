import { HandoverReportsListView } from '@/components/stationaer';
import { ScreenShell } from '@/components/layout';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { fetchHandoverReports } from '@/lib/stationaer/moduleExtensionService';

export function HandoverReportScreen() {
  const { roleLabel } = usePermissions();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchHandoverReports(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  const items = query.data ?? [];

  if (query.loading && items.length === 0) {
    return (
      <ScreenShell title="Übergabeberichte" subtitle="Wird geladen…" scroll={false}>
        <LoadingState message="Übergabeberichte werden geladen…" />
      </ScreenShell>
    );
  }

  if (query.error && items.length === 0) {
    return (
      <ScreenShell title="Übergabeberichte" subtitle="Fehler" scroll={false}>
        <ErrorState message={query.error} onRetry={query.refresh} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Übergabeberichte" subtitle={`Dienstübergabe · ${roleLabel ?? 'Demo'}`} scroll={false}>
      {items.length === 0 ? (
        <EmptyState title="Keine Übergaben" message="Es sind noch keine Übergabeberichte dokumentiert." />
      ) : (
        <HandoverReportsListView />
      )}
    </ScreenShell>
  );
}

void fetchHandoverReports;
