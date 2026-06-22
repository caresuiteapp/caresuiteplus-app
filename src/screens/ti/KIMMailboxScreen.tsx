import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LockedActionBanner } from '@/components/permissions';
import { ScreenShell } from '@/components/layout';
import { KIMFilterToolbar, KIMMailboxListHero, KIMMessageStatusBadge, TIPagination } from '@/components/ti';
import { EmptyState, ErrorState, LoadingState, PremiumCard } from '@/components/ui';
import { useKIMMailbox } from '@/hooks/ti';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/lib/auth/context';
import { colors, spacing, typography } from '@/theme';

function formatGermanDate(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function KIMMailboxScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { can, check, roleLabel } = usePermissions();
  const roleKey = profile?.roleKey ?? 'business_admin';
  const {
    mailbox,
    items,
    totalCount,
    filteredCount,
    loading,
    error,
    refreshing,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    statusFilters,
    page,
    pageSize,
    pageSizeOptions,
    setPageSize,
    hasMore,
    loadMore,
    refresh,
    isEmpty,
    isFilterEmpty,
  } = useKIMMailbox();

  if (!can('ti.kim.view')) {
    return (
      <ScreenShell title="KIM-Postfach" subtitle={roleLabel ?? 'TI'}>
        <LockedActionBanner message={check('ti.kim.view').reason ?? 'Keine Berechtigung.'} roleLabel={roleLabel} />
      </ScreenShell>
    );
  }

  const syncLabel =
    mailbox?.syncStatus === 'syncing'
      ? 'Synchronisiert…'
      : mailbox?.lastSyncAt
        ? `Zuletzt: ${formatGermanDate(mailbox.lastSyncAt)}`
        : 'Noch nicht synchronisiert';

  const header = (
    <View style={styles.header}>
      <KIMMailboxListHero
        items={items}
        totalCount={totalCount}
        roleKey={roleKey}
        connectionStatus="not_configured"
        syncLabel={syncLabel}
      />
      <KIMFilterToolbar
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        statusFilters={statusFilters}
        filteredCount={filteredCount}
        totalCount={totalCount}
      />
    </View>
  );

  if (loading && items.length === 0) {
    return (
      <ScreenShell title="KIM-Postfach" subtitle={syncLabel}>
        <LoadingState message="Nachrichten werden geladen…" />
      </ScreenShell>
    );
  }

  if (error && items.length === 0) {
    return (
      <ScreenShell title="KIM-Postfach" subtitle="Fehler">
        <ErrorState message={error} onRetry={refresh} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="KIM-Postfach" subtitle={`${filteredCount} Nachrichten`} scroll={false}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={header}
        ListEmptyComponent={
          isEmpty ? (
            <EmptyState title="Kein KIM-Postfach" message="Es sind noch keine Nachrichten vorhanden." />
          ) : isFilterEmpty ? (
            <EmptyState title="Keine Treffer" message="Für Ihre Suche oder Filter wurden keine Nachrichten gefunden." />
          ) : null
        }
        ListFooterComponent={
          filteredCount > 0 ? (
            <TIPagination
              page={page}
              pageSize={pageSize}
              pageSizeOptions={pageSizeOptions}
              filteredCount={filteredCount}
              hasMore={hasMore}
              onPageSizeChange={setPageSize}
              onLoadMore={loadMore}
            />
          ) : null
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.cyan} />
        }
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <PremiumCard
            accentColor={item.status === 'unread' ? colors.cyan : colors.textMuted}
            onPress={() => router.push(`/business/ti/kim/${item.id}` as never)}
            style={styles.card}
          >
            <View style={styles.row}>
              <View style={styles.main}>
                <Text style={styles.sender} numberOfLines={1}>
                  {item.senderName ?? item.sender}
                </Text>
                <Text style={styles.subject} numberOfLines={1}>
                  {item.subject}
                </Text>
                <Text style={styles.preview} numberOfLines={2}>
                  {item.preview}
                </Text>
              </View>
              <View style={styles.meta}>
                <Text style={styles.date}>{formatGermanDate(item.receivedAt)}</Text>
                <KIMMessageStatusBadge status={item.status} />
              </View>
            </View>
          </PremiumCard>
        )}
      />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.sm, marginBottom: spacing.md },
  sync: { ...typography.caption, color: colors.cyan },
  list: { gap: spacing.sm, paddingBottom: spacing.xxl },
  card: { marginBottom: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.md },
  main: { flex: 1, gap: spacing.xs },
  meta: { alignItems: 'flex-end', gap: spacing.xs },
  sender: { ...typography.bodyStrong },
  subject: { ...typography.body },
  preview: { ...typography.caption, color: colors.textSecondary },
  date: { ...typography.caption, color: colors.textMuted },
});
