import { FlatList, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { CounselingCaseListCard } from './CounselingCaseListCard';
import { CasesListHero } from './CasesListHero';
import { CasesListTable } from './CasesListTable';
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
import { buildCaseListKpis } from '@/lib/beratung/caseListStats';
import { useCounselingCaseList } from '@/hooks/useCounselingCaseList';
import { useDesktopListViewPreference } from '@/hooks/useDesktopListViewPreference';
import { usePermissions } from '@/hooks/usePermissions';
import { useDeviceClass } from '@/hooks/platform/useDeviceClass';
import { usePlatformLayout } from '@/hooks/platform/usePlatformLayout';
import { isDesktopClass } from '@/lib/platform/breakpoints';
import { useTableColumnSort } from '@/lib/table/tableColumnSort';
import { useAuth } from '@/lib/auth/context';
import type { WorkflowStatus } from '@/types';
import { colors, spacing, typography } from '@/theme';

type CasesListViewProps = {
  onCasePress?: (caseId: string) => void;
  selectedId?: string | null;
  embedded?: boolean;
};

export function CasesListView({
  onCasePress,
  selectedId = null,
  embedded = false,
}: CasesListViewProps) {
  const router = useRouter();
  const { profile } = useAuth();
  const { can, isReadOnly, roleLabel, check } = usePermissions();
  const { shellVariant } = usePlatformLayout();
  const deviceClass = useDeviceClass();
  const isDesktop = isDesktopClass(deviceClass);
  const { viewMode, setViewMode } = useDesktopListViewPreference('beratung.cases');
  const useTableLayout = isDesktop && viewMode === 'table';
  const canView = can('beratung.cases.view');
  const roleKey = profile?.roleKey ?? 'counselor';

  const handleCasePress = (caseId: string) => {
    if (onCasePress) {
      onCasePress(caseId);
      return;
    }
    router.push(`/beratung/cases/${caseId}` as never);
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
  } = useCounselingCaseList();

  const kpis = useMemo(() => buildCaseListKpis(allItems), [allItems]);
  const compactHero = embedded || shellVariant === 'desktop';
  const tableSort = useTableColumnSort(sortKey, setSortKey, sortOptions, {
    subject: 'openedAt',
    client: 'clientName',
    opened: 'openedAt',
  });

  if (!canView) {
    return (
      <LockedActionBanner
        message={check('beratung.cases.view').reason ?? 'Keine Berechtigung.'}
        roleLabel={roleLabel}
      />
    );
  }

  const toolbar = (
    <View style={styles.toolbar}>
      {embedded ? (
        <View style={styles.embeddedHeader}>
          <Text style={styles.embeddedTitle}>Beratungsfälle</Text>
          <Text style={styles.embeddedMeta}>
            {filteredCount} von {totalCount}
          </Text>
        </View>
      ) : (
        <CasesListHero
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

      <PremiumInput
        label="Suche"
        placeholder="Betreff, Kategorie, Klient oder Berater:in…"
        value={search}
        onChangeText={setSearch}
        autoCapitalize="words"
        autoCorrect={false}
        hint={`${filteredCount} von ${totalCount} Fällen`}
      />

      <Text style={styles.filterLabel}>Status</Text>
      <FilterChipGroup
        options={statusFilters}
        value={statusFilter}
        onChange={(value) => setStatusFilter(value as WorkflowStatus | 'all')}
      />

      <Text style={styles.filterLabel}>Sortierung</Text>
      <FilterChipGroup options={sortOptions} value={sortKey} onChange={setSortKey} />
    </View>
  );

  if (loading && items.length === 0) {
    return (
      <View style={styles.container}>
        {!embedded ? toolbar : null}
        <LoadingState message="Fälle werden geladen…" />
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
      title="Noch keine Fälle"
      message="Es sind keine Beratungsfälle im Demo-Mandanten hinterlegt."
    />
  ) : isFilterEmpty ? (
    <EmptyState
      title="Keine Treffer"
      message="Für Ihre Suche oder Filter wurden keine Fälle gefunden."
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
        {filteredCount} Fälle angezeigt
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
              <CasesListTable
                cases={items}
                selectedId={selectedId}
                onCasePress={handleCasePress}
                onOpenDetail={handleCasePress}
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
          <CounselingCaseListCard
            counselingCase={item}
            selected={selectedId === item.id}
            onPress={() => handleCasePress(item.id)}
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
