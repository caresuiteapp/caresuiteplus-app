import { FlatList, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { PreparedModeBanner } from '@/components/modules/PreparedModeBanner';
import { MedicationListCard } from '@/components/pflege/MedicationListCard';
import { MedicationListHero, MEDICATION_PREPARED_MESSAGE } from '@/components/pflege/MedicationListHero';
import { MedicationListTable } from '@/components/pflege/MedicationListTable';
import { CareLightPageShell } from '@/components/layout';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useDeviceClass } from '@/hooks/platform/useDeviceClass';
import { useDesktopListViewPreference } from '@/hooks/useDesktopListViewPreference';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { isDesktopClass } from '@/lib/platform/breakpoints';
import { fetchMedicationList } from '@/lib/pflege/medicationListService';
import { colors, spacing } from '@/theme';

export function MedicationListScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { roleLabel, isReadOnly } = usePermissions();
  const roleKey = profile?.roleKey ?? 'nurse';
  const deviceClass = useDeviceClass();
  const isDesktop = isDesktopClass(deviceClass);
  const { viewMode, setViewMode } = useDesktopListViewPreference('pflege.medication');
  const useTableLayout = isDesktop && viewMode === 'table';

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchMedicationList(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  const items = query.data ?? [];
  const openDetail = (id: string) => router.push(`/pflege/medikation/${id}` as never);

  if (query.loading && items.length === 0) {
    return (
      <CareLightPageShell title="Medikationsplan" subtitle="Wird geladen…">
        <LoadingState message="Verordnungen werden geladen…" />
      </CareLightPageShell>
    );
  }

  if (query.error && items.length === 0) {
    return (
      <CareLightPageShell title="Medikationsplan" subtitle="Fehler">
        <ErrorState message={query.error} onRetry={query.refresh} />
      </CareLightPageShell>
    );
  }

  const header = (
    <View style={styles.header}>
      <MedicationListHero
        items={items}
        roleKey={roleKey}
        isReadOnly={isReadOnly}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        showViewToggle={isDesktop}
      />
      <PreparedModeBanner hint={MEDICATION_PREPARED_MESSAGE} />
    </View>
  );

  if (useTableLayout) {
    return (
      <CareLightPageShell title="Medikationsplan" subtitle={`Medikation · ${roleLabel ?? 'Demo'}`} scroll={false}>
        <ScrollView
          contentContainerStyle={styles.tableScroll}
          refreshControl={
            <RefreshControl refreshing={query.refreshing} onRefresh={query.refresh} tintColor={colors.primary} />
          }
        >
          {header}
          {items.length === 0 ? (
            <EmptyState
              title="Keine Verordnungen"
              message="Für diesen Mandanten sind noch keine Medikationspläne hinterlegt."
            />
          ) : (
            <MedicationListTable items={items} onOpenDetail={openDetail} />
          )}
        </ScrollView>
      </CareLightPageShell>
    );
  }

  return (
    <CareLightPageShell title="Medikationsplan" subtitle={`Medikation · ${roleLabel ?? 'Demo'}`} scroll={false}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <EmptyState
            title="Keine Verordnungen"
            message="Für diesen Mandanten sind noch keine Medikationspläne hinterlegt."
          />
        }
        renderItem={({ item }) => (
          <MedicationListCard item={item} onPress={() => openDetail(item.id)} />
        )}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={query.refreshing} onRefresh={query.refresh} tintColor={colors.primary} />
        }
      />
    </CareLightPageShell>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: spacing.sm, gap: spacing.sm },
  list: { paddingBottom: spacing.xxl },
  tableScroll: { paddingBottom: spacing.xxl, gap: spacing.sm },
});
