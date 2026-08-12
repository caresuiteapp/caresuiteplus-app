import { FlatList, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MedicationListCard } from '@/components/pflege/MedicationListCard';
import { MedicationListHero } from '@/components/pflege/MedicationListHero';
import { MedicationListTable } from '@/components/pflege/MedicationListTable';
import { ScreenShell } from '@/components/layout';
import { EmptyState, ErrorState, FilterChipGroup, LoadingState, PremiumButton, PremiumInput } from '@/components/ui';
import { useMemo, useState } from 'react';
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
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchMedicationList(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  const items = useMemo(() => query.data ?? [], [query.data]);
  const filteredItems = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('de-DE');
    return items.filter((item) => (statusFilter === 'all' || item.status === statusFilter)
      && (!needle || `${item.clientName} ${item.medicationName} ${item.activeIngredient ?? ''}`.toLocaleLowerCase('de-DE').includes(needle)));
  }, [items, search, statusFilter]);
  const openDetail = (id: string) => router.push(`/pflege/medikation/${id}` as never);

  if (query.loading && items.length === 0) {
    return (
      <ScreenShell title="Medikationsplan" subtitle="Wird geladen…">
        <LoadingState message="Verordnungen werden geladen…" />
      </ScreenShell>
    );
  }

  if (query.error && items.length === 0) {
    return (
      <ScreenShell title="Medikationsplan" subtitle="Fehler">
        <ErrorState message={query.error} onRetry={query.refresh} />
      </ScreenShell>
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
      <View style={styles.toolbar}>
        <PremiumButton title="+ Verordnung anlegen" disabled={isReadOnly} onPress={() => router.push('/pflege/medikation/new' as never)} />
        <PremiumButton title="Aktualisieren" variant="secondary" onPress={query.refresh} />
      </View>
      <PremiumInput label="Suche" placeholder="Klient:in, Präparat oder Wirkstoff" value={search} onChangeText={setSearch} />
      <FilterChipGroup options={[{ key: 'active', label: 'Aktiv' }, { key: 'paused', label: 'Pausiert' }, { key: 'stopped', label: 'Beendet' }, { key: 'all', label: 'Alle' }]} value={statusFilter} onChange={setStatusFilter} />
    </View>
  );

  if (useTableLayout) {
    return (
      <ScreenShell title="Medikationsplan" subtitle={`Medikation · ${roleLabel ?? 'Pflegefachkraft'}`} scroll={false}>
        <ScrollView
          contentContainerStyle={styles.tableScroll}
          refreshControl={
            <RefreshControl refreshing={query.refreshing} onRefresh={query.refresh} tintColor={colors.primary} />
          }
        >
          {header}
          {filteredItems.length === 0 ? (
            <EmptyState
              title="Keine Verordnungen"
              message="Für diesen Mandanten sind noch keine Medikationspläne hinterlegt."
            />
          ) : (
            <MedicationListTable items={filteredItems} onOpenDetail={openDetail} />
          )}
        </ScrollView>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Medikationsplan" subtitle={`Medikation · ${roleLabel ?? 'Pflegefachkraft'}`} scroll={false}>
      <FlatList
        data={filteredItems}
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
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: spacing.sm, gap: spacing.sm },
  list: { paddingBottom: spacing.xxl },
  tableScroll: { paddingBottom: spacing.xxl, gap: spacing.sm },
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
