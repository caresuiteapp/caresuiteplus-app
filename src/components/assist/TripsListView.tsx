import { FlatList, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { TripListCard } from './TripListCard';
import { TripsListHero } from './TripsListHero';
import { TripsListTable } from './TripsListTable';
import { LockedActionBanner } from '@/components/permissions';
import {
  EmptyState,
  ErrorState,
  FilterChipGroup,
  InfoBanner,
  LoadingState,
  PremiumButton,
  PremiumInput,
  SuccessState,
} from '@/components/ui';
import {
  GPS_TRIPS_PREPARED_MESSAGE,
  isGpsTrackingLiveReady,
} from '@/lib/assist/gpsTrackingConfig';
import { buildTripListKpis } from '@/lib/assist/tripListStats';
import { useTripList } from '@/hooks/useTripList';
import { usePermissions } from '@/hooks/usePermissions';
import { useDeviceClass } from '@/hooks/platform/useDeviceClass';
import { usePlatformLayout } from '@/hooks/platform/usePlatformLayout';
import { isDesktopClass } from '@/lib/platform/breakpoints';
import { useTableColumnSort } from '@/lib/table/tableColumnSort';
import { useAuth } from '@/lib/auth/context';
import { useDesktopListViewPreference } from '@/hooks/useDesktopListViewPreference';
import type { TripPurpose } from '@/types/modules/assist';
import type { WorkflowStatus } from '@/types';
import { colors, spacing, typography } from '@/theme';

type TripsListViewProps = {
  onTripPress?: (tripId: string) => void;
  selectedId?: string | null;
  embedded?: boolean;
};

export function TripsListView({
  onTripPress,
  selectedId = null,
  embedded = false,
}: TripsListViewProps) {
  const router = useRouter();
  const { profile } = useAuth();
  const { can, isReadOnly, roleLabel, check } = usePermissions();
  const { shellVariant } = usePlatformLayout();
  const deviceClass = useDeviceClass();
  const isDesktop = isDesktopClass(deviceClass);
  const { viewMode, setViewMode } = useDesktopListViewPreference('assist.trips');
  const useTableLayout = isDesktop && viewMode === 'table';
  const canView = can('assist.trips.view');
  const roleKey = profile?.roleKey ?? 'caregiver';

  const handleTripPress = (id: string) => {
    if (onTripPress) {
      onTripPress(id);
      return;
    }
    router.push(`/assist/fahrten/${id}` as never);
  };

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
    purposeFilter,
    setPurposeFilter,
    sortKey,
    setSortKey,
    sortOptions,
    statusFilters,
    purposeFilters,
    hasMore,
    loadMore,
    refresh,
    resetFilters,
    hasActiveFilters,
    isEmpty,
    isFilterEmpty,
    allItems,
  } = useTripList();

  const kpis = useMemo(() => buildTripListKpis(allItems), [allItems]);
  const compactHero = embedded || shellVariant === 'desktop';
  const gpsPreparedOnly = !isGpsTrackingLiveReady();
  const tableSort = useTableColumnSort(sortKey, setSortKey, sortOptions, {
    driver: 'employeeName',
    time: 'startedAt',
  });

  if (!canView) {
    return (
      <LockedActionBanner
        message={check('assist.trips.view').reason ?? 'Keine Berechtigung.'}
        roleLabel={roleLabel}
      />
    );
  }

  const toolbar = (
    <View style={styles.toolbar}>
      {embedded ? (
        <View style={styles.embeddedHeader}>
          <Text style={styles.embeddedTitle}>Fahrtenbuch</Text>
          <Text style={styles.embeddedMeta}>
            {filteredCount} von {totalCount}
          </Text>
        </View>
      ) : (
        <TripsListHero
          kpis={kpis}
          roleKey={roleKey}
          filteredCount={filteredCount}
          totalCount={totalCount}
          isReadOnly={isReadOnly}
          compact={compactHero}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          showViewToggle={isDesktop && !embedded}
        />
      )}

      {showSuccess ? <SuccessState message="Liste erfolgreich aktualisiert." /> : null}

      {gpsPreparedOnly ? (
        <InfoBanner
          variant="warning"
          title="GPS extern"
          message={GPS_TRIPS_PREPARED_MESSAGE}
        />
      ) : null}

      <PremiumInput
        label="Suche"
        placeholder="Fahrer, Fahrzeug oder Route…"
        value={search}
        onChangeText={setSearch}
        autoCapitalize="words"
        autoCorrect={false}
        hint={`${filteredCount} von ${totalCount} Fahrten`}
      />

      <Text style={styles.filterLabel}>Status</Text>
      <FilterChipGroup
        options={statusFilters}
        value={statusFilter}
        onChange={(value) => setStatusFilter(value as WorkflowStatus | 'all')}
      />

      <Text style={styles.filterLabel}>Zweck</Text>
      <FilterChipGroup
        options={purposeFilters}
        value={purposeFilter}
        onChange={(value) => setPurposeFilter(value as TripPurpose | 'all')}
      />

      <Text style={styles.filterLabel}>Sortierung</Text>
      <FilterChipGroup options={sortOptions} value={sortKey} onChange={setSortKey} />
    </View>
  );

  if (loading && items.length === 0) {
    return (
      <View style={styles.container}>
        {!embedded ? toolbar : null}
        <LoadingState message="Fahrten werden geladen…" />
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
      title="Keine Fahrten"
      message="Noch keine Fahrten im Fahrtenbuch erfasst."
    />
  ) : isFilterEmpty ? (
    <EmptyState
      title="Keine Treffer"
      message="Für Ihre Suche oder Filter wurden keine Fahrten gefunden."
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
        {filteredCount} Fahrten angezeigt
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
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor={colors.primary}
            />
          }
        >
          {toolbar}
          {emptyContent ?? (
            <>
              <TripsListTable
                trips={items}
                selectedId={selectedId}
                onTripPress={handleTripPress}
                onOpenDetail={(id) => router.push(`/assist/fahrten/${id}` as never)}
                sortColumnKey={tableSort.sortColumnKey}
                sortDirection={tableSort.sortDirection}
                onSortColumn={tableSort.onSortColumn}
              />
              {footerContent}
            </>
          )}
        </ScrollView>
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
          <TripListCard
            trip={item}
            selected={selectedId === item.id}
            onPress={() => handleTripPress(item.id)}
          />
        )}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flatList: { flex: 1 },
  toolbar: { gap: spacing.sm, marginBottom: spacing.md },
  filterLabel: { ...typography.label, marginTop: spacing.xs },
  list: { paddingBottom: spacing.xxl },
  loadMore: { marginTop: spacing.sm, marginBottom: spacing.md },
  footer: { ...typography.caption, textAlign: 'center', marginVertical: spacing.md },
  embeddedHeader: {
    marginBottom: spacing.xs,
    paddingRight: spacing.xxl,
  },
  embeddedTitle: { ...typography.h3 },
  embeddedMeta: { ...typography.caption, color: colors.textMuted },
});
