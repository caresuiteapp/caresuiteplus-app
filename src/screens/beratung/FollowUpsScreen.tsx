import { FollowUpsListView } from '@/components/beratung/FollowUpsListView';
import { ScreenShell } from '@/components/layout';
import { EmptyState, ErrorState, LoadingState, PremiumInput } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { fetchFollowUps } from '@/lib/beratung/moduleExtensionService';

export function FollowUpsScreen() {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { roleLabel } = usePermissions();
  const roleKey = profile?.roleKey ?? 'counselor';

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchFollowUps(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  const items = query.data ?? [];

  if (query.loading && items.length === 0) {
    return (
      <ScreenShell title="Wiedervorlagen" subtitle="Wird geladen…">
        <LoadingState message="Wiedervorlagen werden geladen…" />
      </ScreenShell>
    );
  }

  if (query.error && items.length === 0) {
    return (
      <ScreenShell title="Wiedervorlagen" subtitle="Fehler">
        <ErrorState message={query.error} onRetry={query.refresh} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Wiedervorlagen" subtitle={`Fristen · ${roleLabel ?? 'Demo'}`} scroll={false}>
      <FollowUpsListView
        items={items}
        roleKey={roleKey}
        refreshing={query.refreshing}
        onRefresh={query.refresh}
      />
    </ScreenShell>
  );
}
