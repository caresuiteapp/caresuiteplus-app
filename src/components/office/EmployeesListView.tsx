import { FlatList, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { AdaptiveActionBar } from '@/components/adaptive';
import { EmployeeListCard } from './EmployeeListCard';
import { EmployeesListHero } from './EmployeesListHero';
import { EmployeesListTable } from './EmployeesListTable';
import { LockedActionBanner } from '@/components/permissions';
import {
  EmptyState,
  ErrorState,
  ListFilterSelect,
  LoadingState,
  PremiumButton,
  PremiumInput,
  SuccessState,
} from '@/components/ui';
import { buildEmployeeListKpis } from '@/lib/office/employeeListStats';
import { useEmployeeList } from '@/hooks/useEmployeeList';
import { useDesktopListViewPreference } from '@/hooks/useDesktopListViewPreference';
import { usePermissions } from '@/hooks/usePermissions';
import { useDeviceClass } from '@/hooks/platform/useDeviceClass';
import { usePlatformLayout } from '@/hooks/platform/usePlatformLayout';
import { isDesktopClass } from '@/lib/platform/breakpoints';
import { useTableColumnSort } from '@/lib/table/tableColumnSort';
import { useAuth } from '@/lib/auth/context';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { spacing } from '@/theme';

type EmployeesListViewProps = {
  onEmployeePress?: (id: string) => void;
  onOpenDetail?: (id: string) => void;
  onCreatePress?: () => void;
  selectedId?: string | null;
  embedded?: boolean;
  routePrefix?: string;
  refreshToken?: number;
};

export function EmployeesListView({
  onEmployeePress,
  onOpenDetail,
  onCreatePress,
  selectedId = null,
  embedded = false,
  routePrefix = '/business/office/employees',
  refreshToken = 0,
}: EmployeesListViewProps) {
  const router = useRouter();
  const { profile } = useAuth();
  const { can, isReadOnly, roleLabel, check } = usePermissions();
  const { shellVariant } = usePlatformLayout();
  const deviceClass = useDeviceClass();
  const isDesktop = isDesktopClass(deviceClass);
  const { viewMode, setViewMode } = useDesktopListViewPreference('office.employees');
  const useTableLayout = isDesktop && viewMode === 'table' && !embedded;
  const canView = can('office.employees.view');
  const canCreate = can('office.employees.create');
  const canCsv = can('tenant.settings.csv.view');
  const roleKey = profile?.roleKey ?? 'business_admin';

  const handleCreate = onCreatePress ?? (() => router.push('/office/employees/create' as never));
  const handleOpenDetail =
    onOpenDetail ?? onEmployeePress ?? ((id: string) => router.push(`${routePrefix}/${id}` as never));

  const handleEmployeePress = (id: string) => {
    if (onEmployeePress) {
      onEmployeePress(id);
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
  } = useEmployeeList();

  useEffect(() => {
    if (refreshToken > 0) {
      void refresh();
    }
  }, [refreshToken, refresh]);

  const kpis = useMemo(() => buildEmployeeListKpis(allItems), [allItems]);
  const compactHero = embedded || shellVariant === 'desktop';
  const tableSort = useTableColumnSort(sortKey, setSortKey, sortOptions, {
    name: 'lastName',
    role: 'jobTitle',
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
        filterRow: {
          flexDirection: 'row',
          gap: spacing.sm,
          alignItems: 'flex-start',
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

  if (!canView) {
    return (
      <LockedActionBanner
        message={check('office.employees.view').reason ?? 'Keine Berechtigung.'}
        roleLabel={roleLabel}
      />
    );
  }

  const toolbar = (
    <View style={styles.toolbar} testID="filter-bar">
      {embedded ? (
        <View style={styles.embeddedHeader}>
          <Text style={styles.embeddedTitle}>Mitarbeitende</Text>
          <Text style={styles.embeddedMeta}>
            {filteredCount} von {totalCount}
          </Text>
        </View>
      ) : (
        <EmployeesListHero
          kpis={kpis}
          roleKey={roleKey}
          filteredCount={filteredCount}
          totalCount={totalCount}
          canCreate={canCreate}
          canCsv={canCsv}
          onCsvPress={() => router.push('/business/office/settings/csv-import-export?tab=employees-import' as never)}
          isReadOnly={isReadOnly}
          onCreatePress={canCreate ? handleCreate : undefined}
          compact={compactHero}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          showViewToggle={isDesktop && !embedded}
        />
      )}

      {showSuccess ? <SuccessState message="Liste erfolgreich aktualisiert." /> : null}

      <PremiumInput
        label="Suche"
        placeholder="Name, Rolle oder E-Mail…"
        value={search}
        onChangeText={setSearch}
        autoCapitalize="words"
        autoCorrect={false}
        hint={`${filteredCount} von ${totalCount} Mitarbeitende`}
      />

      <View style={styles.filterRow}>
        <ListFilterSelect
          label="Status"
          value={statusFilter}
          options={statusFilters}
          onChange={setStatusFilter}
        />
        <ListFilterSelect
          label="Sortierung"
          value={sortKey}
          options={sortOptions}
          onChange={setSortKey}
        />
      </View>
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
      title="Noch keine Mitarbeitenden"
      message={
        canCreate
          ? 'Legen Sie das erste Teammitglied an, um mit der Verwaltung zu beginnen.'
          : `Noch keine Mitarbeitenden vorhanden. Anlegen ist für ${roleLabel ?? 'Ihre Rolle'} nicht freigegeben.`
      }
      actionLabel={canCreate ? 'Mitarbeitende anlegen' : undefined}
      onAction={canCreate ? handleCreate : undefined}
    />
  ) : isFilterEmpty ? (
    <EmptyState
      title="Keine Treffer"
      message="Für Ihre Suche oder Filter wurden keine Mitarbeitenden gefunden."
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
        {filteredCount} Mitarbeitende angezeigt
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
              <EmployeesListTable
                employees={items}
                selectedId={selectedId}
                onEmployeePress={handleEmployeePress}
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
                  {filteredCount} von {totalCount} Mitarbeitende
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
          <EmployeeListCard
            employee={item}
            selected={selectedId === item.id}
            onPress={() => handleEmployeePress(item.id)}
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
            onPress={handleCreate}
          />
        </View>
      ) : null}
    </View>
  );
}

