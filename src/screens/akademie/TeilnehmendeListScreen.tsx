import { EnrollmentsListView } from '@/components/akademie';
import { ScreenShell } from '@/components/layout';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { fetchEnrollmentList } from '@/lib/akademie/moduleExtensionService';

/** Arbeitsplan 092 — /akademie/teilnehmende */
export function TeilnehmendeListScreen() {
  const { roleLabel } = usePermissions();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();

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
      <ScreenShell title="Teilnehmende" subtitle="Wird geladen…" scroll={false}>
        <LoadingState message="Teilnehmende werden geladen…" />
      </ScreenShell>
    );
  }

  if (query.error && items.length === 0) {
    return (
      <ScreenShell title="Teilnehmende" subtitle="Fehler" scroll={false}>
        <ErrorState message={query.error} onRetry={query.refresh} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title="Teilnehmende"
      subtitle={`Teilnehmende und Fortschritt · ${roleLabel ?? 'Demo'}`}
      scroll={false}
    >
      {items.length === 0 ? (
        <EmptyState title="Keine Teilnehmenden" message="Es sind noch keine Teilnehmenden eingeschrieben." />
      ) : (
        <EnrollmentsListView />
      )}
    </ScreenShell>
  );
}

void fetchEnrollmentList;
