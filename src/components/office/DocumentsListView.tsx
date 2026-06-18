import { FlatList, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { AdaptiveActionBar } from '@/components/adaptive';
import { DocumentListCard } from './DocumentListCard';
import { DocumentsListHero } from './DocumentsListHero';
import { DocumentsListTable } from './DocumentsListTable';
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
import {
  buildOfficeDocumentListKpis,
  type OfficeDocumentCategoryFilterKey,
} from '@/data/demo/officeDocumentListStats';
import { useOfficeDocuments } from '@/hooks/useOfficeDocuments';
import { useDesktopListViewPreference } from '@/hooks/useDesktopListViewPreference';
import { usePermissions } from '@/hooks/usePermissions';
import { useDeviceClass } from '@/hooks/platform/useDeviceClass';
import { usePlatformLayout } from '@/hooks/platform/usePlatformLayout';
import { isDesktopClass } from '@/lib/platform/breakpoints';
import { useTableColumnSort } from '@/lib/table/tableColumnSort';
import { useAuth } from '@/lib/auth/context';
import { colors, spacing, typography } from '@/theme';

export function DocumentsListView() {
  const router = useRouter();
  const { profile } = useAuth();
  const { can, isReadOnly, roleLabel, check } = usePermissions();
  const { shellVariant } = usePlatformLayout();
  const deviceClass = useDeviceClass();
  const isDesktop = isDesktopClass(deviceClass);
  const { viewMode, setViewMode } = useDesktopListViewPreference('office.documents');
  const useTableLayout = isDesktop && viewMode === 'table';
  const canView = can('office.documents.view');
  const canUpload = can('office.documents.upload' as never);
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
    sortOptions,
    statusFilters,
    categoryFilters,
    hasMore,
    loadMore,
    refresh,
    resetFilters,
    hasActiveFilters,
    isEmpty,
    isFilterEmpty,
    allItems,
  } = useOfficeDocuments();

  const kpis = useMemo(() => buildOfficeDocumentListKpis(allItems), [allItems]);
  const compactHero = shellVariant === 'desktop';
  const tableSort = useTableColumnSort(sortKey, setSortKey, sortOptions, {
    title: 'title',
    updated: 'updatedAt',
  });

  if (!canView) {
    return (
      <LockedActionBanner
        message={check('office.documents.view').reason ?? 'Keine Berechtigung.'}
        roleLabel={roleLabel}
      />
    );
  }

  const toolbar = (
    <View style={styles.toolbar}>
      <DocumentsListHero
        kpis={kpis}
        roleKey={roleKey}
        filteredCount={filteredCount}
        totalCount={totalCount}
        canUpload={canUpload}
        isReadOnly={isReadOnly}
        onUploadPress={() => router.push('/office/documents/upload' as never)}
        compact={compactHero}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        showViewToggle={isDesktop}
      />

      {showSuccess ? <SuccessState message="Dokumente erfolgreich aktualisiert." /> : null}

      <PremiumInput
        label="Suche"
        placeholder="Titel oder Dateiname…"
        value={search}
        onChangeText={setSearch}
        autoCorrect={false}
        hint={`${filteredCount} von ${totalCount} Dokumenten`}
      />

      <Text style={styles.filterLabel}>Kategorie</Text>
      <FilterChipGroup
        options={categoryFilters}
        value={categoryFilter}
        onChange={(value) => setCategoryFilter(value as OfficeDocumentCategoryFilterKey)}
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
        <LoadingState message="Office-Dokumente werden geladen…" />
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
      title="Noch keine Dokumente"
      message={
        canUpload
          ? 'Laden Sie das erste Office-Dokument hoch, um die Ablage zu starten.'
          : `Noch keine Office-Dokumente vorhanden. Upload ist für ${roleLabel ?? 'Ihre Rolle'} nicht freigegeben.`
      }
      actionLabel={canUpload ? 'Dokument hochladen' : undefined}
      onAction={
        canUpload ? () => router.push('/office/documents/upload' as never) : undefined
      }
    />
  ) : isFilterEmpty ? (
    <EmptyState
      title="Keine Treffer"
      message="Für Ihre Suche oder Filter wurden keine Dokumente gefunden."
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
        {filteredCount} Dokumente angezeigt
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
              <DocumentsListTable
                documents={items}
                sortColumnKey={tableSort.sortColumnKey}
                sortDirection={tableSort.sortDirection}
                onSortColumn={tableSort.onSortColumn}
              />
              {footerContent}
            </>
          )}
          {useTableLayout ? (
            <AdaptiveActionBar
              tertiary={
                <Text style={styles.actionMeta}>
                  {filteredCount} von {totalCount} Dokumenten
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
                canUpload ? (
                  <PremiumButton
                    title="+ Hochladen"
                    size="sm"
                    onPress={() => router.push('/office/documents/upload' as never)}
                  />
                ) : undefined
              }
            />
          ) : null}
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
        renderItem={({ item }) => <DocumentListCard document={item} />}
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
  actionMeta: {
    ...typography.caption,
    color: colors.textMuted,
  },
});
