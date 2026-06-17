import { FlatList, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { AdaptiveActionBar } from '@/components/adaptive';
import { ClientCompactRow } from './ClientCompactRow';
import { ClientListCard } from './ClientListCard';
import { ClientsFilterToolbar } from './ClientsFilterToolbar';
import { ClientsListHero } from './ClientsListHero';
import { ClientsListTable } from './ClientsListTable';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumButton,
  SuccessState,
} from '@/components/ui';
import {
  buildClientListKpis,
} from '@/data/demo/clientListStats';
import { useClientList } from '@/hooks/useClientList';
import { useDesktopListViewPreference } from '@/hooks/useDesktopListViewPreference';
import { usePermissions } from '@/hooks/usePermissions';
import { useDeviceClass } from '@/hooks/platform/useDeviceClass';
import { usePlatformLayout } from '@/hooks/platform/usePlatformLayout';
import { isDesktopClass } from '@/lib/platform/breakpoints';
import { useTableColumnSort } from '@/lib/table/tableColumnSort';
import { useAuth } from '@/lib/auth/context';
import { clientCreateRoute, clientRecordRoute } from '@/lib/navigation/clientRoutes';
import { colors, spacing, typography } from '@/theme';

type ClientsListViewProps = {
  onClientPress?: (id: string) => void;
  selectedId?: string | null;
  embedded?: boolean;
  refreshToken?: number;
};

export function ClientsListView({
  onClientPress,
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
  const roleKey = profile?.roleKey ?? 'business_admin';

  const handleClientPress = (id: string) => {
    if (onClientPress) {
      onClientPress(id);
      return;
    }
    router.push(clientRecordRoute(id) as never);
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
    lifecycleFilters,
    careLevelFilters,
    costBearerFilters,
    hasMore,
    loadMore,
    refresh,
    resetFilters,
    hasActiveFilters,
    isEmpty,
    isFilterEmpty,
    hasLocalOnlyIntakeDraft,
    allItems,
    kpiItems,
  } = useClientList();

  useEffect(() => {
    if (refreshToken > 0) {
      void refresh();
    }
  }, [refreshToken, refresh]);

  const kpis = useMemo(() => buildClientListKpis(kpiItems), [kpiItems]);
  const compactHero = embedded || shellVariant === 'desktop';
  const tableSort = useTableColumnSort(sortKey, setSortKey, sortOptions, {
    name: 'lastName',
    city: 'city',
  });

  const toolbar = (
    <View style={styles.toolbar}>
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
          isReadOnly={isReadOnly}
          onCreatePress={() => router.push(clientCreateRoute() as never)}
          compact={compactHero}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          showViewToggle={isDesktop && !embedded}
        />
      )}

      {showSuccess ? (
        <SuccessState message="Liste erfolgreich aktualisiert." />
      ) : null}

      <ClientsFilterToolbar
        compact={embedded}
        search={search}
        onSearchChange={setSearch}
        filteredCount={filteredCount}
        totalCount={totalCount}
        lifecycleFilter={lifecycleFilter}
        onLifecycleChange={(value) => setLifecycleFilter(value as 'all' | 'active' | 'archived')}
        lifecycleFilters={lifecycleFilters}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        statusFilters={statusFilters}
        careLevelFilter={careLevelFilter}
        onCareLevelChange={setCareLevelFilter}
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
      <View style={styles.container}>
        {!embedded ? toolbar : null}
        <LoadingState message="Klient:innen werden geladen…" />
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

  const emptyContent = isFilterEmpty ? (
    <EmptyState
      title="Keine Treffer"
      message={
        hasLocalOnlyIntakeDraft && statusFilter === 'entwurf'
          ? 'Entwurf nur lokal gespeichert? Bitte im Aufnahme-Assistenten erneut speichern oder kurz warten, bis der Entwurf synchronisiert wurde.'
          : 'Für Ihre Suche oder Filter wurden keine Klient:innen gefunden.'
      }
      actionLabel={
        hasLocalOnlyIntakeDraft && statusFilter === 'entwurf'
          ? 'Zum Aufnahme-Assistenten'
          : 'Filter zurücksetzen'
      }
      onAction={
        hasLocalOnlyIntakeDraft && statusFilter === 'entwurf'
          ? () => router.push(clientCreateRoute() as never)
          : resetFilters
      }
    />
  ) : isEmpty ? (
    <EmptyState
      title="Noch keine Klient:innen"
      message={
        canCreate
          ? 'Legen Sie die erste Klient:in an, um mit der Verwaltung zu beginnen.'
          : `Noch keine Klient:innen vorhanden. Anlegen ist für ${roleLabel ?? 'Ihre Rolle'} nicht freigegeben.`
      }
      actionLabel={canCreate ? 'Klient:in anlegen' : undefined}
      onAction={canCreate ? () => router.push(clientCreateRoute() as never) : undefined}
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
              <ClientsListTable
                clients={items}
                selectedId={selectedId}
                onClientPress={handleClientPress}
                onOpenDetail={(id) => router.push(clientRecordRoute(id) as never)}
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
                    onPress={() => router.push(clientCreateRoute() as never)}
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
              onPress={() => router.push(clientCreateRoute() as never)}
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
        renderItem={({ item }) =>
          embedded ? (
            <ClientCompactRow
              client={item}
              selected={selectedId === item.id}
              onPress={() => handleClientPress(item.id)}
            />
          ) : (
            <ClientListCard
              client={item}
              selected={selectedId === item.id}
              onPress={() => handleClientPress(item.id)}
            />
          )
        }
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
            onPress={() => router.push(clientCreateRoute() as never)}
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
