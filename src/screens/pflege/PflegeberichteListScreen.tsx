import { FlatList, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CareDocumentationListCard } from '@/components/pflege/CareDocumentationListCard';
import { CareDocumentationListTable } from '@/components/pflege/CareDocumentationListTable';
import { CareLightPageShell } from '@/components/layout';
import { EmptyState, ErrorState, LoadingState, PremiumButton } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useDeviceClass } from '@/hooks/platform/useDeviceClass';
import { useDesktopListViewPreference } from '@/hooks/useDesktopListViewPreference';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { isDesktopClass } from '@/lib/platform/breakpoints';
import { fetchPflegeBerichteList } from '@/lib/pflege/pflegeReportListService';
import { colors, spacing } from '@/theme';

/** Arbeitsplan 065 — /pflege/berichte */
export function PflegeberichteListScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { roleLabel, isReadOnly } = usePermissions();
  const deviceClass = useDeviceClass();
  const isDesktop = isDesktopClass(deviceClass);
  const { viewMode } = useDesktopListViewPreference('pflege.berichte');
  const useTableLayout = isDesktop && viewMode === 'table';

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchPflegeBerichteList(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  const items = query.data ?? [];
  const openDetail = (id: string) => router.push(`/pflege/berichte/${id}` as never);

  if (query.loading && items.length === 0) {
    return (
      <CareLightPageShell title="Pflegeberichte" subtitle="Wird geladen…">
        <LoadingState message="Pflegeberichte werden geladen…" />
      </CareLightPageShell>
    );
  }

  if (query.error && items.length === 0) {
    return (
      <CareLightPageShell title="Pflegeberichte" subtitle="Fehler">
        <ErrorState message={query.error} onRetry={query.refresh} />
      </CareLightPageShell>
    );
  }

  if (useTableLayout) {
    return (
      <CareLightPageShell
        title="Pflegeberichte"
        subtitle={`Berichte, Übergaben, Beobachtungen · ${roleLabel ?? 'Demo'}`}
        rightSlot={
          !isReadOnly ? (
            <PremiumButton title="+ Neu" size="sm" onPress={() => router.push('/pflege/berichte/new' as never)} />
          ) : undefined
        }
        scroll={false}
      >
        <ScrollView
          contentContainerStyle={styles.tableScroll}
          refreshControl={
            <RefreshControl refreshing={query.refreshing} onRefresh={query.refresh} tintColor={colors.primary} />
          }
        >
          {items.length === 0 ? (
            <EmptyState title="Keine Pflegeberichte" message="Es sind noch keine Berichte dokumentiert." />
          ) : (
            <CareDocumentationListTable items={items} onOpenDetail={openDetail} />
          )}
        </ScrollView>
      </CareLightPageShell>
    );
  }

  return (
    <CareLightPageShell
      title="Pflegeberichte"
      subtitle={`Berichte, Übergaben, Beobachtungen · ${roleLabel ?? 'Demo'}`}
      rightSlot={
        !isReadOnly ? (
          <PremiumButton title="+ Neu" size="sm" onPress={() => router.push('/pflege/berichte/new' as never)} />
        ) : undefined
      }
      scroll={false}
    >
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <EmptyState title="Keine Pflegeberichte" message="Es sind noch keine Berichte dokumentiert." />
        }
        renderItem={({ item }) => (
          <CareDocumentationListCard item={item} onPress={() => openDetail(item.id)} />
        )}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={query.refreshing} onRefresh={query.refresh} tintColor={colors.primary} />
        }
      />
    </CareLightPageShell>
  );
}

void fetchPflegeBerichteList;

const styles = StyleSheet.create({
  list: { paddingBottom: spacing.xxl },
  tableScroll: { paddingBottom: spacing.xxl, gap: spacing.sm },
});
