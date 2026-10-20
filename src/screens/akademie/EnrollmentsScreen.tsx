import { EnrollmentsListView } from '@/components/akademie';
import { ScreenShell } from '@/components/layout';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { fetchEnrollmentList } from '@/lib/akademie/moduleExtensionService';

export function EnrollmentsScreen() {
  const { roleLabel } = usePermissions();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const pageTitle = 'Teilnehmer:innen';

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchEnrollmentList(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  const items = query.data ?? [];

  if (query.loading && items.length === 0) {
    return (
      <ScreenShell title={pageTitle} subtitle="Wird geladen…" scroll={false}>
        <LoadingState message="Teilnehmer:innen werden geladen…" />
      </ScreenShell>
    );
  }

  if (query.error && items.length === 0) {
    return (
      <ScreenShell title={pageTitle} subtitle="Fehler" scroll={false}>
        <ErrorState message={query.error} onRetry={query.refresh} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title={pageTitle} subtitle={`Einschreibungen · ${roleLabel ?? 'Demo'}`} scroll={false}>
      {items.length === 0 ? (
        <EmptyState title="Keine Teilnehmer:innen" message="Es sind noch keine Einschreibungen vorhanden." />
      ) : (
        <EnrollmentsListView />
      )}
    </ScreenShell>
  );
}

void fetchEnrollmentList;
