import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ProtocolsListView } from '@/components/beratung/ProtocolsListView';
import { ScreenShell } from '@/components/layout';
import { EmptyState, ErrorState, LoadingState, PremiumButton } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { fetchCounselingProtocols } from '@/lib/beratung/moduleExtensionService';

/** Arbeitsplan 074 — /beratung/protokolle */
export function BeratungProtokolleListScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { roleLabel, isReadOnly } = usePermissions();
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
      <ScreenShell title="Protokolle" subtitle="Wird geladen…">
        <LoadingState message="Protokolle werden geladen…" />
      </ScreenShell>
    );
  }

  if (query.error && items.length === 0) {
    return (
      <ScreenShell title="Protokolle" subtitle="Fehler">
        <ErrorState message={query.error} onRetry={query.refresh} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title="Protokolle"
      subtitle={`Beratungsprotokolle · ${roleLabel ?? 'Demo'}`}
      scroll={false}
      rightSlot={
        !isReadOnly ? (
          <PremiumButton title="+ Neu" size="sm" onPress={() => router.push('/beratung/protokolle/new' as never)} />
        ) : undefined
      }
    >
      <View style={styles.content}>
        {items.length === 0 ? (
          <EmptyState title="Keine Protokolle" message="Es sind noch keine Beratungsprotokolle erfasst." />
        ) : (
          <ProtocolsListView
            items={items}
            roleKey={roleKey}
            refreshing={query.refreshing}
            onRefresh={query.refresh}
          />
        )}
      </View>
    </ScreenShell>
  );
}

void fetchCounselingProtocols;

const styles = StyleSheet.create({ content: { flex: 1 } });
