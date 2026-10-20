import { LivingAreasListView } from '@/components/stationaer';
import { ScreenShell } from '@/components/layout';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { fetchLivingAreas } from '@/lib/stationaer/moduleExtensionService';

/** Arbeitsplan 081 — /stationaer/wohnbereiche */
export function WohnbereicheListScreen() {
  const { roleLabel } = usePermissions();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchLivingAreas(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  const items = query.data ?? [];

  if (query.loading && items.length === 0) {
    return (
      <ScreenShell title="Wohnbereiche" subtitle="Wird geladen…" scroll={false}>
        <LoadingState message="Wohnbereiche werden geladen…" />
      </ScreenShell>
    );
  }

  if (query.error && items.length === 0) {
    return (
      <ScreenShell title="Wohnbereiche" subtitle="Fehler" scroll={false}>
        <ErrorState message={query.error} onRetry={query.refresh} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Wohnbereiche" subtitle={`Wohnbereiche verwalten · ${roleLabel ?? 'Demo'}`} scroll={false}>
      {items.length === 0 ? (
        <EmptyState title="Keine Wohnbereiche" message="Es sind noch keine Wohnbereiche angelegt." />
      ) : (
        <LivingAreasListView />
      )}
    </ScreenShell>
  );
}

void fetchLivingAreas;
