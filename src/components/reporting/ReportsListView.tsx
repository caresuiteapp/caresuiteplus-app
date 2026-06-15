import { FlatList, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { ReportListCard } from './ReportListCard';
import { ReportsListHero } from './ReportsListHero';
import { ReportsListTable } from './ReportsListTable';
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
import { buildReportListKpis } from '@/data/demo/reportListStats';
import {
  REPORT_CATEGORY_FILTERS,
  REPORT_SORT_OPTIONS,
  REPORT_STATUS_FILTERS,
  useReportList,
} from '@/hooks/useReportList';
import { useDesktopListViewPreference } from '@/hooks/useDesktopListViewPreference';
import { usePermissions } from '@/hooks/usePermissions';
import { useDeviceClass } from '@/hooks/platform/useDeviceClass';
import { usePlatformLayout } from '@/hooks/platform/usePlatformLayout';
import { isDesktopClass } from '@/lib/platform/breakpoints';
import { useTableColumnSort } from '@/lib/table/tableColumnSort';
import { useAuth } from '@/lib/auth/context';
import type { ReportCategory } from '@/types/reporting';
import type { WorkflowStatus } from '@/types';
import { colors, spacing, typography } from '@/theme';

type ReportsListViewProps = {
  onReportPress?: (reportId: string) => void;
  selectedId?: string | null;
  embedded?: boolean;
};

export function ReportsListView({
  onReportPress,
  selectedId = null,
  embedded = false,
}: ReportsListViewProps) {
  const router = useRouter();
  const { profile } = useAuth();
  const { can, isReadOnly, roleLabel, check } = usePermissions();
  const { shellVariant } = usePlatformLayout();
  const deviceClass = useDeviceClass();
  const isDesktop = isDesktopClass(deviceClass);
  const { viewMode, setViewMode } = useDesktopListViewPreference('business.reporting');
  const useTableLayout = isDesktop && viewMode === 'table';
  const canView = can('business.reporting.view');
  const canCreate = can('business.reporting.create');
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
    categoryFilter,
    setCategoryFilter,
    sortKey,
    setSortKey,
    hasMore,
    loadMore,
    refresh,
    resetFilters,
    hasActiveFilters,
    isEmpty,
    isFilterEmpty,
    allItems,
  } = useReportList();

  const kpis = useMemo(() => buildReportListKpis(allItems), [allItems]);
  const compactHero = embedded || shellVariant === 'desktop';
  const tableSort = useTableColumnSort(sortKey, setSortKey, REPORT_SORT_OPTIONS, {
    title: 'title',
    updated: 'updatedAt',
  });

  const handleReportPress = (reportId: string) => {
    if (onReportPress) {
      onReportPress(reportId);
      return;
    }
    router.push(`/business/reporting/${reportId}` as never);
  };

  if (!canView) {
    return (
      <LockedActionBanner
        message={check('business.reporting.view').reason ?? 'Keine Berechtigung.'}
        roleLabel={roleLabel}
      />
    );
  }

  const toolbar = (
    <View style={styles.toolbar}>
      {embedded ? (
        <View style={styles.embeddedHeader}>
          <Text style={styles.embeddedTitle}>Berichte</Text>
          <Text style={styles.embeddedMeta}>
            {filteredCount} von {totalCount}
          </Text>
        </View>
      ) : (
        <ReportsListHero
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

      {canCreate && !embedded ? (
        <PremiumButton
          title="Neuen Bericht anlegen"
          onPress={() => router.push('/business/reporting/create' as never)}
        />
      ) : null}

      <PremiumInput
        label="Suche"
        placeholder="Titel oder Zeitraum…"
        value={search}
        onChangeText={setSearch}
        autoCapitalize="words"
        autoCorrect={false}
        hint={`${filteredCount} von ${totalCount} Berichten`}
      />

      <Text style={styles.filterLabel}>Status</Text>
      <FilterChipGroup
        options={REPORT_STATUS_FILTERS}
        value={statusFilter}
        onChange={(value) => setStatusFilter(value as WorkflowStatus | 'all')}
      />

      <Text style={styles.filterLabel}>Kategorie</Text>
      <FilterChipGroup
        options={REPORT_CATEGORY_FILTERS}
        value={categoryFilter}
        onChange={(value) => setCategoryFilter(value as ReportCategory | 'all')}
      />

      <Text style={styles.filterLabel}>Sortierung</Text>
      <FilterChipGroup options={REPORT_SORT_OPTIONS} value={sortKey} onChange={setSortKey} />
    </View>
  );

  if (loading && items.length === 0) {
    return (
      <View style={styles.container}>
        {!embedded ? toolbar : null}
        <LoadingState message="Berichte werden geladen…" />
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
      title="Noch keine Berichte"
      message="Es sind keine Berichte im Demo-Mandanten hinterlegt."
    />
  ) : isFilterEmpty ? (
    <EmptyState
      title="Keine Treffer"
      message="Für Ihre Suche oder Filter wurden keine Berichte gefunden."
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
        {filteredCount} Berichte angezeigt
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
              <ReportsListTable
                reports={items}
                selectedId={selectedId}
                onReportPress={handleReportPress}
                onOpenDetail={handleReportPress}
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
          <ReportListCard
            report={item}
            selected={selectedId === item.id}
            onPress={() => handleReportPress(item.id)}
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
