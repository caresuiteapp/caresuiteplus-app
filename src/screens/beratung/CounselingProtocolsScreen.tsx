import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { ProtocolsListView } from '@/components/beratung/ProtocolsListView';
import { ScreenShell } from '@/components/layout';
import { EmptyState, ErrorState, LoadingState, PremiumInput } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { fetchCounselingProtocols } from '@/lib/beratung/moduleExtensionService';

export function CounselingProtocolsScreen() {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { roleLabel } = usePermissions();
  const pageTitle = 'Beratungsprotokolle';
  const roleKey = profile?.roleKey ?? 'counselor';

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchCounselingProtocols(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  const items = query.data ?? [];

  if (query.loading && items.length === 0) {
    return (
      <ScreenShell title={pageTitle} subtitle="Wird geladen…">
        <LoadingState message="Protokolle werden geladen…" />
      </ScreenShell>
    );
  }

  if (query.error && items.length === 0) {
    return (
      <ScreenShell title={pageTitle} subtitle="Fehler">
        <ErrorState message={query.error} onRetry={query.refresh} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title={pageTitle} subtitle={`Fallbezug · ${roleLabel ?? 'Demo'}`} scroll={false}>
      <ProtocolsListView
        items={items}
        roleKey={roleKey}
        refreshing={query.refreshing}
        onRefresh={query.refresh}
      />
    </ScreenShell>
  );
}
