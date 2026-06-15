import { useCallback } from 'react';
import { InsightExportsListView } from '@/components/insight/InsightExportsListView';
import { ScreenShell } from '@/components/layout';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { wp499InsightA11y } from '@/lib/a11y/wp499-insight';
import { fetchInsightExports } from '@/lib/insight';

export function InsightExportsListScreen() {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { can, roleLabel } = usePermissions();
  const roleKey = profile?.roleKey ?? 'business_admin';

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchInsightExports(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  const refresh = useCallback(async () => {
    await query.refresh();
  }, [query]);

  const items = query.data ?? [];

  if (!can('dashboard.view')) {
    return (
      <ScreenShell title="Exporte" subtitle="Kein Zugriff">
        <EmptyState title="Zugriff verweigert" message="InsightCenter ist nicht freigegeben." />
      </ScreenShell>
    );
  }

  if (query.loading && items.length === 0) {
    return (
      <ScreenShell title="Geplante Exporte" subtitle="InsightCenter" a11yMeta={wp499InsightA11y}>
        <LoadingState message="Exporte werden geladen…" />
      </ScreenShell>
    );
  }

  if (query.error && items.length === 0) {
    return (
      <ScreenShell title="Geplante Exporte" subtitle="Fehler">
        <ErrorState message={query.error} onRetry={refresh} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title="Geplante Exporte"
      subtitle={`InsightCenter · ${roleLabel ?? 'Demo'}`}
      scroll={false}
      a11yMeta={wp499InsightA11y}
    >
      <InsightExportsListView
        items={items}
        roleKey={roleKey}
        loading={query.refreshing}
        onRefresh={refresh}
      />
    </ScreenShell>
  );
}
