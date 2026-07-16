import { FlatList, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { ExecutionListCard } from './ExecutionListCard';
import { ExecutionsListHero } from './ExecutionsListHero';
import { ExecutionsListTable } from './ExecutionsListTable';
import { LockedActionBanner } from '@/components/permissions';
import {
  EmptyState,
  ErrorState,
  FilterChipGroup,
  LoadingState,
  PremiumButton,
  PremiumInput,
} from '@/components/ui';
import { WorkflowToast } from '@/components/ui/WorkflowToast';
import { buildExecutionListKpis } from '@/lib/assist/executionListStats';
import { useExecutionList } from '@/hooks/useExecutionList';
import { usePermissions } from '@/hooks/usePermissions';
import { useDeviceClass } from '@/hooks/platform/useDeviceClass';
import { usePlatformLayout } from '@/hooks/platform/usePlatformLayout';
import { isDesktopClass } from '@/lib/platform/breakpoints';
import { useTableColumnSort } from '@/lib/table/tableColumnSort';
import { useAuth } from '@/lib/auth/context';
import { useDesktopListViewPreference } from '@/hooks/useDesktopListViewPreference';
import type { ExecutionPhase } from '@/types/modules/assist';
import { colors, spacing, typography } from '@/theme';

type ExecutionsListViewProps = {
  onExecutionPress?: (assignmentId: string) => void;
  selectedId?: string | null;
  embedded?: boolean;
};

export function ExecutionsListView({
  onExecutionPress,
  selectedId = null,
  embedded = false,
}: ExecutionsListViewProps) {
  const router = useRouter();
  const { profile } = useAuth();
  const { can, isReadOnly, roleLabel, check } = usePermissions();
  const { shellVariant } = usePlatformLayout();
  const deviceClass = useDeviceClass();
  const isDesktop = isDesktopClass(deviceClass);
  const { viewMode, setViewMode } = useDesktopListViewPreference('assist.executions');
  const useTableLayout = isDesktop && viewMode === 'table';
  const canView = can('assist.execution.view');
  const canManage = can('assist.execution.manage');
  const roleKey = profile?.roleKey ?? 'caregiver';

  const handleExecutionPress = (assignmentId: string) => {
    if (onExecutionPress) {
      onExecutionPress(assignmentId);
      return;
    }
    router.push(`/assist/assignments/${assignmentId}/execute` as never);
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
    phaseFilter,
    setPhaseFilter,
    sortKey,
    setSortKey,
    sortOptions,
    phaseFilters,
    hasMore,
    loadMore,
    refresh,
    resetFilters,
    hasActiveFilters,
    isEmpty,
    isFilterEmpty,
    allItems,
  } = useExecutionList();

  const kpis = useMemo(() => buildExecutionListKpis(allItems), [allItems]);
  const compactHero = embedded || shellVariant === 'desktop';
  const tableSort = useTableColumnSort(sortKey, setSortKey, sortOptions, {
    client: 'clientName',
    time: 'scheduledStart',
  });

  if (!canView) {
    return (
      <LockedActionBanner
        message={check('assist.execution.view').reason ?? 'Keine Berechtigung.'}
        roleLabel={roleLabel}
      />
    );
  }

  const toolbar = (
    <View style={styles.toolbar}>
      {embedded ? (
        <View style={styles.embeddedHeader}>
          <Text style={styles.embeddedTitle}>Durchführung</Text>
          <Text style={styles.embeddedMeta}>
            {filteredCount} von {totalCount}
          </Text>
        </View>
      ) : (
        <ExecutionsListHero
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

      <WorkflowToast message={showSuccess ? 'Liste erfolgreich aktualisiert.' : null} />

      <PremiumInput
        label="Suche"
        placeholder="Titel, Klient oder Ort…"
        value={search}
        onChangeText={setSearch}
        autoCapitalize="words"
        autoCorrect={false}
        hint={`${filteredCount} von ${totalCount} Einsätzen`}
      />

      <Text style={styles.filterLabel}>Phase</Text>
      <FilterChipGroup
        options={phaseFilters}
        value={phaseFilter}
        onChange={(value) => setPhaseFilter(value as ExecutionPhase | 'all')}
      />

      <Text style={styles.filterLabel}>Sortierung</Text>
      <FilterChipGroup options={sortOptions} value={sortKey} onChange={(value) => setSortKey(String(Array.isArray(value) ? value[0] : value))} />
    </View>
  );

  if (loading && items.length === 0) {
    return (
      <View style={styles.container}>
        {!embedded ? toolbar : null}
        <LoadingState message="Einsätze werden geladen…" />
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
      title="Keine Einsätze zur Durchführung"
      message="Derzeit sind keine Einsätze für Check-in und Zeiterfassung vorgesehen."
    />
  ) : isFilterEmpty ? (
    <EmptyState
      title="Keine Treffer"
      message="Für Ihre Suche oder Filter wurden keine Einsätze gefunden."
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
        {filteredCount} Einsätze angezeigt
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
              <ExecutionsListTable
                executions={items}
                selectedId={selectedId}
                onExecutionPress={handleExecutionPress}
                onOpenDetail={(id) =>
                  router.push(`/assist/assignments/${id}/execute` as never)
                }
                sortColumnKey={tableSort.sortColumnKey}
                sortDirection={tableSort.sortDirection}
                onSortColumn={tableSort.onSortColumn}
              />
              {footerContent}
            </>
          )}
        </ScrollView>
        {embedded && canManage ? (
          <View style={styles.embeddedCta}>
            <PremiumButton
              title="Kalender"
              size="sm"
              variant="ghost"
              onPress={() => router.push('/assist/calendar' as never)}
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
        keyExtractor={(item) => item.assignmentId}
        ListHeaderComponent={toolbar}
        ListEmptyComponent={emptyContent}
        ListFooterComponent={footerContent}
        renderItem={({ item }) => (
          <ExecutionListCard
            execution={item}
            selected={selectedId === item.assignmentId}
            onPress={() => handleExecutionPress(item.assignmentId)}
          />
        )}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />
        }
      />
      {embedded && canManage ? (
        <View style={styles.embeddedCta}>
          <PremiumButton
            title="Kalender"
            size="sm"
            variant="ghost"
            onPress={() => router.push('/assist/calendar' as never)}
          />
        </View>
      ) : null}
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
  embeddedCta: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.md,
    zIndex: 2,
  },
});
