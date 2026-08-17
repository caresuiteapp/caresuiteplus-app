import { FlatList, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { AdaptiveActionBar } from '@/components/adaptive';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { ClientListCard } from './ClientListCard';
import { ClientsListHero } from './ClientsListHero';
import { ClientsListTable } from './ClientsListTable';
import { ClientsFilterToolbar } from './ClientsFilterToolbar';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumButton,
  SuccessState,
} from '@/components/ui';
import {
  buildClientListKpis,
  type ClientCareLevelFilterKey,
} from '@/lib/office/clientListStats';
import { useClientList } from '@/hooks/useClientList';
import { useDesktopListViewPreference } from '@/hooks/useDesktopListViewPreference';
import { usePermissions } from '@/hooks/usePermissions';
import { useDeviceClass } from '@/hooks/platform/useDeviceClass';
import { usePlatformLayout } from '@/hooks/platform/usePlatformLayout';
import { isDesktopClass } from '@/lib/platform/breakpoints';
import { useTableColumnSort } from '@/lib/table/tableColumnSort';
import { useAuth } from '@/lib/auth/context';
import { CLIENT_INTAKE_NEW_ROUTE, clientRecordRoute } from '@/lib/navigation/clientRoutes';
import { spacing } from '@/theme';

type ClientsListViewProps = {
  onClientPress?: (id: string) => void;
  onOpenDetail?: (id: string) => void;
  onCreatePress?: () => void;
  selectedId?: string | null;
  embedded?: boolean;
  refreshToken?: number;
};

export function ClientsListView({
  onClientPress,
  onOpenDetail,
  onCreatePress,
  selectedId = null,
  embedded = false,
  refreshToken = 0,
}: ClientsListViewProps) {
  const router = useRouter();
  const { profile } = useAuth();
  const { can, isReadOnly, roleLabel } = usePermissions();
  const { shellVariant } = usePlatformLayout();
  const deviceClass = useDeviceClass();
  const isDesktop = isDesktopClass(deviceClass);
  const { viewMode, setViewMode } = useDesktopListViewPreference('office.clients');
  const useTableLayout = isDesktop && viewMode === 'table' && !embedded;
  const canCreate = can('office.clients.create');
  const canCsv = can('tenant.settings.csv.view');
  const roleKey = profile?.roleKey ?? 'business_admin';
  const handleCreate = onCreatePress ?? (() => router.push(CLIENT_INTAKE_NEW_ROUTE as never));
  const handleOpenDetail = onOpenDetail ?? onClientPress ?? ((id: string) => router.push(clientRecordRoute(id) as never));

  const handleClientPress = (id: string) => {
    if (onClientPress) {
      onClientPress(id);
      return;
    }
    handleOpenDetail(id);
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
    careLevelFilter,
    setCareLevelFilter,
    lifecycleFilter,
    setLifecycleFilter,
    costBearerFilter,
    setCostBearerFilter,
    sortKey,
    setSortKey,
    sortOptions,
    statusFilters,
    careLevelFilters,
    hasMore,
    loadMore,
    refresh,
    resetFilters,
    hasActiveFilters,
    isEmpty,
    isFilterEmpty,
    kpiItems,
    lifecycleFilters,
    costBearerFilters,
    isLive,
    isLiveConnected,
  } = useClientList();

  useEffect(() => {
    if (refreshToken > 0) {
      void refresh();
    }
  }, [refreshToken, refresh]);

  const kpis = useMemo(() => buildClientListKpis(kpiItems), [kpiItems]);
  const activeKpiId = useMemo(() => {
    if (search || careLevelFilter !== 'all' || costBearerFilter !== 'all') return null;
    if (lifecycleFilter === 'active' && statusFilter === 'aktiv') return 'clients-kpi-active';
    if (lifecycleFilter === 'all' && statusFilter === 'in_bearbeitung') return 'clients-kpi-intake';
    if (lifecycleFilter === 'all' && statusFilter === 'entwurf') return 'clients-kpi-drafts';
    if (lifecycleFilter === 'all' && statusFilter === 'all') return 'clients-kpi-total';
    return null;
  }, [careLevelFilter, costBearerFilter, lifecycleFilter, search, statusFilter]);
  const compactHero = embedded || shellVariant === 'desktop';
  const tableSort = useTableColumnSort(sortKey, setSortKey, sortOptions, {
    name: 'lastName',
    city: 'city',
  });
  const { colors, typography } = useLegacyTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: 'transparent',
        },
        flatList: {
          flex: 1,
          backgroundColor: 'transparent',
        },
        toolbar: {
          gap: spacing.sm,
          marginBottom: spacing.md,
          backgroundColor: 'transparent',
        },
        list: {
          paddingBottom: spacing.xxl,
          backgroundColor: 'transparent',
        },
        loadMore: {
          marginTop: spacing.sm,
          marginBottom: spacing.md,
        },
        footer: {
          ...typography.caption,
          textAlign: 'center',
          marginVertical: spacing.md,
          color: colors.textMuted,
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
          color: colors.textPrimary,
        },
        embeddedMeta: {
          ...typography.caption,
          color: colors.textMuted,
        },
        actionMeta: {
          ...typography.caption,
          color: colors.textMuted,
        },
      }),
    [colors, typography],
  );

  const handleKpiPress = (kpiId: string) => {
    setSearch('');
    setCareLevelFilter('all');
    setCostBearerFilter('all');
    if (kpiId === 'clients-kpi-active') {
      setLifecycleFilter('active');
      setStatusFilter('aktiv');
      return;
    }
    if (kpiId === 'clients-kpi-intake') {
      setLifecycleFilter('all');
      setStatusFilter('in_bearbeitung');
      return;
    }
    if (kpiId === 'clients-kpi-drafts') {
      setLifecycleFilter('all');
      setStatusFilter('entwurf');
      return;
    }
    setLifecycleFilter('all');
    setStatusFilter('all');
  };

  const toolbar = (
    <View style={styles.toolbar} testID="filter-bar">
      {embedded ? (
        <View style={styles.embeddedHeader}>
          <Text style={styles.embeddedTitle}>Klient:innen</Text>
          <Text style={styles.embeddedMeta}>
            {filteredCount} von {totalCount}
          </Text>
        </View>
      ) : (
        <ClientsListHero
          kpis={kpis}
          roleKey={roleKey}
          filteredCount={filteredCount}
          totalCount={totalCount}
          canCreate={canCreate}
          canCsv={canCsv}
          onCsvPress={() => router.push('/business/office/settings/csv-import-export?tab=clients-import' as never)}
          isReadOnly={isReadOnly}
          onCreatePress={canCreate ? handleCreate : undefined}
          compact={compactHero}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          showViewToggle={isDesktop && !embedded}
          onRefresh={refresh}
          onKpiPress={handleKpiPress}
          activeKpiId={activeKpiId}
          isLive={isLive}
          isLiveConnected={isLiveConnected}
        />
      )}

      {showSuccess ? (
        <SuccessState message="Liste erfolgreich aktualisiert." />
      ) : null}

      <ClientsFilterToolbar
        compact={!isDesktop || embedded}
        search={search}
        onSearchChange={setSearch}
        filteredCount={filteredCount}
        totalCount={totalCount}
        lifecycleFilter={lifecycleFilter}
        onLifecycleChange={(value) => setLifecycleFilter(value as typeof lifecycleFilter)}
        lifecycleFilters={lifecycleFilters}
        statusFilter={statusFilter}
        onStatusChange={(value) => setStatusFilter(value as typeof statusFilter)}
        statusFilters={statusFilters}
        careLevelFilter={careLevelFilter}
        onCareLevelChange={(value) => setCareLevelFilter(value as ClientCareLevelFilterKey)}
        careLevelFilters={careLevelFilters}
        costBearerFilter={costBearerFilter}
        onCostBearerChange={setCostBearerFilter}
        costBearerFilters={costBearerFilters}
        sortKey={sortKey}
        onSortChange={setSortKey}
        sortOptions={sortOptions}
        hasActiveFilters={hasActiveFilters}
        onResetFilters={resetFilters}
      />
    </View>
  );

  if (loading && items.length === 0) {
    return (
      <View style={styles.container} testID="list-wrapper">
        {!embedded ? toolbar : null}
        <LoadingState message="Daten werden geladen…" />
      </View>
    );
  }

  if (error && items.length === 0 && totalCount === 0) {
    return (
      <View style={styles.container} testID="list-wrapper">
        <ErrorState message={error} onRetry={refresh} />
      </View>
    );
  }

  const emptyContent = isEmpty ? (
    <EmptyState
      title="Noch keine Klient:innen"
      message={
        canCreate
          ? 'Legen Sie die erste Klient:in an, um mit der Verwaltung zu beginnen.'
          : `Noch keine Klient:innen vorhanden. Anlegen ist für ${roleLabel ?? 'Ihre Rolle'} nicht freigegeben.`
      }
      actionLabel={canCreate ? 'Klient:in anlegen' : undefined}
      onAction={canCreate ? handleCreate : undefined}
    />
  ) : isFilterEmpty ? (
    <EmptyState
      title="Keine Treffer"
      message="Für Ihre Suche oder Filter wurden keine Klient:innen gefunden."
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
        {filteredCount} Klient:innen angezeigt
        {hasActiveFilters ? ' (gefiltert)' : ''}
      </Text>
    ) : null;

  if (useTableLayout) {
    return (
      <View style={styles.container} testID="list-wrapper">
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
              <ClientsListTable
                clients={items}
                selectedId={selectedId}
                onClientPress={handleClientPress}
                onOpenDetail={handleOpenDetail}
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
                  {filteredCount} von {totalCount} Klient:innen
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
                  <PremiumButton
                    title="Aktualisieren"
                    variant="ghost"
                    size="sm"
                    onPress={refresh}
                  />
                )
              }
              primary={
                canCreate ? (
                  <PremiumButton
                    title="+ Neu"
                    size="sm"
                    onPress={handleCreate}
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
              onPress={handleCreate}
            />
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.container} testID="list-wrapper">
      <FlatList
        style={styles.flatList}
        data={items}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={toolbar}
        ListEmptyComponent={emptyContent}
        ListFooterComponent={footerContent}
        renderItem={({ item }) => (
          <ClientListCard
            client={item}
            selected={selectedId === item.id}
            onPress={() => handleClientPress(item.id)}
          />
        )}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.primary}
          />
        }
      />
      {embedded && canCreate ? (
        <View style={styles.embeddedCta}>
          <PremiumButton
            title="+ Neu"
            size="sm"
            onPress={handleCreate}
          />
        </View>
      ) : null}
    </View>
  );
}
