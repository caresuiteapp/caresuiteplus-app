import { FlatList, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { PreparedModeBanner } from '@/components/modules/PreparedModeBanner';
import { WoundDocumentationListCard } from '@/components/pflege/WoundDocumentationListCard';
import {
  WoundDocumentationListHero,
  WOUND_DOCUMENTATION_PREPARED_MESSAGE,
} from '@/components/pflege/WoundDocumentationListHero';
import { WoundDocumentationListTable } from '@/components/pflege/WoundDocumentationListTable';
import { ScreenShell } from '@/components/layout';
import { demoClients } from '@/data/demo/clients';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useDeviceClass } from '@/hooks/platform/useDeviceClass';
import { useDesktopListViewPreference } from '@/hooks/useDesktopListViewPreference';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { isDesktopClass } from '@/lib/platform/breakpoints';
import { fetchWoundDocumentationList } from '@/lib/pflege/woundDocumentationService';
import { colors, spacing } from '@/theme';

function resolveClientName(clientId: string): string | undefined {
  const client = demoClients.find((c) => c.id === clientId);
  return client ? `${client.firstName} ${client.lastName}` : undefined;
}

export function WoundDocumentationListScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { roleLabel, isReadOnly } = usePermissions();
  const roleKey = profile?.roleKey ?? 'nurse';
  const deviceClass = useDeviceClass();
  const isDesktop = isDesktopClass(deviceClass);
  const { viewMode, setViewMode } = useDesktopListViewPreference('pflege.wounds');
  const useTableLayout = isDesktop && viewMode === 'table';

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchWoundDocumentationList(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  const items = query.data ?? [];
  const openDetail = (id: string) => router.push(`/pflege/wunddokumentation/${id}` as never);

  if (query.loading && items.length === 0) {
    return (
      <ScreenShell title="Wunddokumentation" subtitle="Wird geladen…">
        <LoadingState message="Wundfälle werden geladen…" />
      </ScreenShell>
    );
  }

  if (query.error && items.length === 0) {
    return (
      <ScreenShell title="Wunddokumentation" subtitle="Fehler">
        <ErrorState message={query.error} onRetry={query.refresh} />
      </ScreenShell>
    );
  }

  const header = (
    <View style={styles.header}>
      <WoundDocumentationListHero
        items={items}
        roleKey={roleKey}
        isReadOnly={isReadOnly}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        showViewToggle={isDesktop}
      />
      <PreparedModeBanner hint={WOUND_DOCUMENTATION_PREPARED_MESSAGE} />
    </View>
  );

  if (useTableLayout) {
    return (
      <ScreenShell title="Wunddokumentation" subtitle={`Wundmanagement · ${roleLabel ?? 'Demo'}`} scroll={false}>
        <ScrollView
          contentContainerStyle={styles.tableScroll}
          refreshControl={
            <RefreshControl refreshing={query.refreshing} onRefresh={query.refresh} tintColor={colors.primary} />
          }
        >
          {header}
          {items.length === 0 ? (
            <EmptyState
              title="Keine Wundfälle"
              message="Für diesen Mandanten sind noch keine Wunddokumentationen hinterlegt."
            />
          ) : (
            <WoundDocumentationListTable items={items} onOpenDetail={openDetail} />
          )}
        </ScrollView>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Wunddokumentation" subtitle={`Wundmanagement · ${roleLabel ?? 'Demo'}`} scroll={false}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <EmptyState
            title="Keine Wundfälle"
            message="Für diesen Mandanten sind noch keine Wunddokumentationen hinterlegt."
          />
        }
        renderItem={({ item }) => (
          <WoundDocumentationListCard
            item={item}
            clientName={resolveClientName(item.clientId)}
            onPress={() => openDetail(item.id)}
          />
        )}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={query.refreshing} onRefresh={query.refresh} tintColor={colors.primary} />
        }
      />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: spacing.sm, gap: spacing.sm },
  list: { paddingBottom: spacing.xxl },
  tableScroll: { paddingBottom: spacing.xxl, gap: spacing.sm },
});
