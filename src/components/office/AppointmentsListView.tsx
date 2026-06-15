import { FlatList, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { AdaptiveActionBar } from '@/components/adaptive';
import { AppointmentListCard } from './AppointmentListCard';
import { AppointmentsListHero } from './AppointmentsListHero';
import { AppointmentsListTable } from './AppointmentsListTable';
import { LockedActionBanner } from '@/components/permissions';
import {
  EmptyState,
  ErrorState,
  FilterChipGroup,
  LoadingState,
  PremiumButton,
  PremiumInput,
  SuccessState,
} from '@/components/ui';
import { buildAppointmentListKpis } from '@/data/demo/appointmentListStats';
import { useAppointmentList } from '@/hooks/useAppointmentList';
import { useDesktopListViewPreference } from '@/hooks/useDesktopListViewPreference';
import { usePermissions } from '@/hooks/usePermissions';
import { useDeviceClass } from '@/hooks/platform/useDeviceClass';
import { usePlatformLayout } from '@/hooks/platform/usePlatformLayout';
import { isDesktopClass } from '@/lib/platform/breakpoints';
import { useTableColumnSort } from '@/lib/table/tableColumnSort';
import { useAuth } from '@/lib/auth/context';
import { colors, spacing, typography } from '@/theme';

type AppointmentsListViewProps = {
  onAppointmentPress?: (id: string) => void;
  selectedId?: string | null;
  embedded?: boolean;
};

export function AppointmentsListView({
  onAppointmentPress,
  selectedId = null,
  embedded = false,
}: AppointmentsListViewProps) {
  const router = useRouter();
  const { profile } = useAuth();
  const { can, isReadOnly, roleLabel, check } = usePermissions();
  const { shellVariant } = usePlatformLayout();
  const deviceClass = useDeviceClass();
  const isDesktop = isDesktopClass(deviceClass);
  const { viewMode, setViewMode } = useDesktopListViewPreference('office.appointments');
  const useTableLayout = isDesktop && viewMode === 'table';
  const canView = can('office.appointments.view');
  const canCreate = can('office.appointments.view') && !isReadOnly;
  const roleKey = profile?.roleKey ?? 'business_admin';

  const {
    items,
    totalCount,
    filteredCount,
    loading,
    error,
    refreshing,
    showSuccess,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    sortKey,
    setSortKey,
    sortOptions,
    statusFilters,
    hasMore,
    loadMore,
    refresh,
    resetFilters,
    hasActiveFilters,
    isEmpty,
    isFilterEmpty,
    allItems,
  } = useAppointmentList();

  const kpis = useMemo(() => buildAppointmentListKpis(allItems), [allItems]);
  const compactHero = embedded || shellVariant === 'desktop';
  const tableSort = useTableColumnSort(sortKey, setSortKey, sortOptions, {
    title: 'title',
    startsAt: 'startsAt',
  });

  const handleAppointmentPress = (id: string) => {
    if (onAppointmentPress) {
      onAppointmentPress(id);
      return;
    }
    router.push(`/office/appointments/${id}` as never);
  };

  if (!canView) {
    return (
      <LockedActionBanner
        message={check('office.appointments.view').reason ?? 'Keine Berechtigung.'}
        roleLabel={roleLabel}
      />
    );
  }

  const toolbar = (
    <View style={styles.toolbar}>
      {embedded ? (
        <View style={styles.embeddedHeader}>
          <Text style={styles.embeddedTitle}>Termine</Text>
          <Text style={styles.embeddedMeta}>
            {filteredCount} von {totalCount}
          </Text>
        </View>
      ) : (
        <AppointmentsListHero
          kpis={kpis}
          roleKey={roleKey}
          filteredCount={filteredCount}
          totalCount={totalCount}
          canCreate={canCreate}
          isReadOnly={isReadOnly}
          onCreatePress={() => router.push('/office/appointments/create' as never)}
          compact={compactHero}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          showViewToggle={isDesktop && !embedded}
        />
      )}

      {showSuccess ? <SuccessState message="Liste erfolgreich aktualisiert." /> : null}

      <PremiumInput
        label="Suche"
        placeholder="Titel, Klient:in oder Ort…"
        value={search}
        onChangeText={setSearch}
        hint={`${filteredCount} von ${totalCount} Terminen`}
      />

      <Text style={styles.filterLabel}>Status</Text>
      <FilterChipGroup options={statusFilters} value={statusFilter} onChange={setStatusFilter} />

      <Text style={styles.filterLabel}>Sortierung</Text>
      <FilterChipGroup options={sortOptions} value={sortKey} onChange={setSortKey} />
    </View>
  );

  if (loading && items.length === 0) {
    return (
      <View style={styles.container}>
        {!embedded ? toolbar : null}
        <LoadingState message="Termine werden geladen…" />
      </View>
    );
  }

  if (error && items.length === 0 && totalCount === 0) {
    return (
      <View style={styles.container}>
        <ErrorState message={error} onRetry={refresh} />
      </View>
    );
  }

  const emptyContent = isEmpty ? (
    <EmptyState
      title="Noch keine Termine"
      message={
        canCreate
          ? 'Legen Sie den ersten Termin an, um die Planung zu starten.'
          : `Noch keine Termine vorhanden. Anlegen ist für ${roleLabel ?? 'Ihre Rolle'} nicht freigegeben.`
      }
      actionLabel={canCreate ? 'Termin anlegen' : undefined}
      onAction={
        canCreate ? () => router.push('/office/appointments/create' as never) : undefined
      }
    />
  ) : isFilterEmpty ? (
    <EmptyState
      title="Keine Treffer"
      message="Für Ihre Suche oder Filter wurden keine Termine gefunden."
      actionLabel="Filter zurücksetzen"
      onAction={resetFilters}
    />
  ) : null;

  const footerContent =
    hasMore ? (
      <PremiumButton
        title="Weitere laden"
        variant="secondary"
        fullWidth
        onPress={loadMore}
        style={styles.loadMore}
      />
    ) : filteredCount > 0 ? (
      <Text style={styles.footer}>
        {filteredCount} Termine angezeigt
        {hasActiveFilters ? ' (gefiltert)' : ''}
      </Text>
    ) : null;

  if (useTableLayout) {
    return (
      <View style={styles.container}>
        <ScrollView
          style={styles.flatList}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />
          }
        >
          {toolbar}
          {emptyContent ?? (
            <>
              <AppointmentsListTable
                appointments={items}
                selectedId={selectedId}
                onAppointmentPress={handleAppointmentPress}
                onOpenDetail={(id) => router.push(`/office/appointments/${id}` as never)}
                sortColumnKey={tableSort.sortColumnKey}
                sortDirection={tableSort.sortDirection}
                onSortColumn={tableSort.onSortColumn}
              />
              {footerContent}
            </>
          )}
          {useTableLayout && !embedded ? (
            <AdaptiveActionBar
              tertiary={
                <Text style={styles.actionMeta}>
                  {filteredCount} von {totalCount} Terminen
                </Text>
              }
              secondary={
                hasActiveFilters ? (
                  <PremiumButton
                    title="Filter zurücksetzen"
                    variant="ghost"
                    size="sm"
                    onPress={resetFilters}
                  />
                ) : (
                  <PremiumButton title="Aktualisieren" variant="ghost" size="sm" onPress={refresh} />
                )
              }
              primary={
                canCreate ? (
                  <PremiumButton
                    title="+ Neu"
                    size="sm"
                    onPress={() => router.push('/office/appointments/create' as never)}
                  />
                ) : undefined
              }
            />
          ) : null}
        </ScrollView>
        {embedded && canCreate ? (
          <View style={styles.embeddedCta}>
            <PremiumButton
              title="+ Neu"
              size="sm"
              onPress={() => router.push('/office/appointments/create' as never)}
            />
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        style={styles.flatList}
        data={items}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={toolbar}
        ListEmptyComponent={emptyContent}
        ListFooterComponent={footerContent}
        renderItem={({ item }) => (
          <AppointmentListCard
            appointment={item}
            selected={selectedId === item.id}
            onPress={() => handleAppointmentPress(item.id)}
          />
        )}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />
        }
      />
      {embedded && canCreate ? (
        <View style={styles.embeddedCta}>
          <PremiumButton
            title="+ Neu"
            size="sm"
            onPress={() => router.push('/office/appointments/create' as never)}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flatList: {
    flex: 1,
  },
  toolbar: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  filterLabel: {
    ...typography.label,
    marginTop: spacing.xs,
  },
  list: {
    paddingBottom: spacing.xxl,
  },
  loadMore: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  footer: {
    ...typography.caption,
    textAlign: 'center',
    marginVertical: spacing.md,
  },
  embeddedCta: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.md,
    zIndex: 2,
  },
  embeddedHeader: {
    marginBottom: spacing.xs,
    paddingRight: spacing.xxl,
  },
  embeddedTitle: {
    ...typography.h3,
  },
  embeddedMeta: {
    ...typography.caption,
    color: colors.textMuted,
  },
  actionMeta: {
    ...typography.caption,
    color: colors.textMuted,
  },
});
