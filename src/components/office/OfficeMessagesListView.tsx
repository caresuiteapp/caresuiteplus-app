import { FlatList, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { AdaptiveActionBar } from '@/components/adaptive';
import { OfficeMessageListCard } from './OfficeMessageListCard';
import { OfficeMessagesListHero } from './OfficeMessagesListHero';
import { OfficeMessagesListTable } from './OfficeMessagesListTable';
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
import { buildOfficeMessageListKpis } from '@/lib/office/officeMessageListStats';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { useOfficeMessages } from '@/hooks/useOfficeMessages';
import { useDesktopListViewPreference } from '@/hooks/useDesktopListViewPreference';
import { usePermissions } from '@/hooks/usePermissions';
import { useDeviceClass } from '@/hooks/platform/useDeviceClass';
import { usePlatformLayout } from '@/hooks/platform/usePlatformLayout';
import { isDesktopClass } from '@/lib/platform/breakpoints';
import { useTableColumnSort } from '@/lib/table/tableColumnSort';
import { useAuth } from '@/lib/auth/context';
import { colors, spacing, typography } from '@/theme';

type OfficeMessagesListViewProps = {
  onMessagePress?: (id: string) => void;
  selectedId?: string | null;
  embedded?: boolean;
};

export function OfficeMessagesListView({
  onMessagePress,
  selectedId = null,
  embedded = false,
}: OfficeMessagesListViewProps) {
  const router = useRouter();
  const { profile } = useAuth();
  const { can, isReadOnly, roleLabel, check } = usePermissions();
  const { shellVariant } = usePlatformLayout();
  const deviceClass = useDeviceClass();
  const isDesktop = isDesktopClass(deviceClass);
  const { viewMode, setViewMode } = useDesktopListViewPreference('office.messages');
  const useTableLayout = isDesktop && viewMode === 'table';
  const { mode } = useLegacyTheme();
  const canView = can('office.messages.view');
  const canCompose = can('office.access') && !isReadOnly;
  const roleKey = profile?.roleKey ?? 'business_admin';

  const {
    items,
    totalCount,
    filteredCount,
    unreadCount,
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
  } = useOfficeMessages();

  const kpis = useMemo(
    () => buildOfficeMessageListKpis(allItems, mode),
    [allItems, mode],
  );
  const compactHero = embedded || shellVariant === 'desktop';
  const tableSort = useTableColumnSort(sortKey, setSortKey, sortOptions, {
    subject: 'subject',
    updatedAt: 'updatedAt',
  });

  const handleMessagePress = (id: string) => {
    if (onMessagePress) {
      onMessagePress(id);
      return;
    }
    router.push(`/office/messages/${id}` as never);
  };

  if (!canView) {
    return (
      <LockedActionBanner
        message={check('office.messages.view').reason ?? 'Keine Berechtigung.'}
        roleLabel={roleLabel}
      />
    );
  }

  const toolbar = (
    <View style={styles.toolbar}>
      {embedded ? (
        <View style={styles.embeddedHeader}>
          <Text style={styles.embeddedTitle}>Nachrichten</Text>
          <Text style={styles.embeddedMeta}>
            {filteredCount} von {totalCount}
            {unreadCount > 0 ? ` · ${unreadCount} ungelesen` : ''}
          </Text>
        </View>
      ) : (
        <OfficeMessagesListHero
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

      {showSuccess ? <SuccessState message="Nachrichten erfolgreich aktualisiert." /> : null}

      <PremiumInput
        label="Suche"
        placeholder="Betreff, Absender oder Empfänger…"
        value={search}
        onChangeText={setSearch}
        autoCorrect={false}
        hint={`${filteredCount} von ${totalCount} Nachrichten`}
      />

      <Text style={styles.filterLabel}>Status</Text>
      <FilterChipGroup options={statusFilters} value={statusFilter} onChange={setStatusFilter} />

      <Text style={styles.filterLabel}>Sortierung</Text>
      <FilterChipGroup options={sortOptions} value={sortKey} onChange={setSortKey} />

      {canCompose && !useTableLayout ? (
        <PremiumButton
          title="Neue Nachricht"
          onPress={() => router.push('/office/messages/compose' as never)}
        />
      ) : null}
    </View>
  );

  if (loading && items.length === 0) {
    return (
      <View style={styles.container}>
        {!embedded ? toolbar : null}
        <LoadingState message="Office-Nachrichten werden geladen…" />
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
      title="Keine Nachrichten"
      message="Es sind keine Office-Nachrichten im Demo-Mandanten vorhanden."
    />
  ) : isFilterEmpty ? (
    <EmptyState
      title="Keine Treffer"
      message="Für Ihre Suche oder Filter wurden keine Nachrichten gefunden."
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
        {filteredCount} Nachrichten angezeigt
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
              <OfficeMessagesListTable
                messages={items}
                selectedId={selectedId}
                onMessagePress={handleMessagePress}
                onOpenDetail={(id) => router.push(`/office/messages/${id}` as never)}
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
                  {filteredCount} von {totalCount} Nachrichten
                  {unreadCount > 0 ? ` · ${unreadCount} ungelesen` : ''}
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
                canCompose ? (
                  <PremiumButton
                    title="+ Neu"
                    size="sm"
                    onPress={() => router.push('/office/messages/compose' as never)}
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
        renderItem={({ item }) => (
          <OfficeMessageListCard
            message={item}
            selected={selectedId === item.id}
            onPress={onMessagePress ? () => onMessagePress(item.id) : undefined}
          />
        )}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />
        }
      />
      {isDesktop && !embedded ? (
        <AdaptiveActionBar
          tertiary={
            <Text style={styles.actionMeta}>
              {filteredCount} von {totalCount} Nachrichten
              {unreadCount > 0 ? ` · ${unreadCount} ungelesen` : ''}
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
            canCompose ? (
              <PremiumButton
                title="+ Neu"
                size="sm"
                onPress={() => router.push('/office/messages/compose' as never)}
              />
            ) : undefined
          }
        />
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
  actionMeta: { ...typography.caption, color: colors.textMuted },
});
