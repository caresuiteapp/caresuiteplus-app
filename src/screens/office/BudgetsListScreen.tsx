import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { BudgetsListHero } from '@/components/office';
import { ScreenShell } from '@/components/layout';
import {
  EmptyState,
  ErrorState,
  FilterChipGroup,
  LoadingState,
  PremiumBadge,
  PremiumCard,
  PremiumInput,
  SuccessState,
} from '@/components/ui';
import { useBudgetList } from '@/hooks/useBudgetList';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/lib/auth/context';
import { formatCurrency } from '@/lib/office';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { colors, spacing, typography } from '@/theme';

const PERIOD_LABELS = {
  monthly: 'Monatlich',
  quarterly: 'Quartal',
  yearly: 'Jährlich',
} as const;

type BudgetsListScreenProps = {
  embedded?: boolean;
};

export function BudgetsListScreen({ embedded = false }: BudgetsListScreenProps) {
  const router = useRouter();
  const { profile } = useAuth();
  const { can, roleLabel } = usePermissions();
  const roleKey = profile?.roleKey ?? 'billing';
  const canView = can('office.budgets.view');
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
  } = useBudgetList();

  const shell = (children: React.ReactNode, title = 'Budgets', subtitle?: string) =>
    embedded ? (
      <View style={styles.embedded}>{children}</View>
    ) : (
      <ScreenShell title={title} subtitle={subtitle}>
        {children}
      </ScreenShell>
    );

  if (!canView) {
    return shell(
      <EmptyState
        title="Zugriff verweigert"
        message={`Budgets sind für ${roleLabel ?? 'Ihre Rolle'} nicht freigegeben.`}
      />,
    );
  }

  const header = (
    <View style={styles.toolbar}>
      {!embedded ? (
        <BudgetsListHero
          items={items}
          roleKey={roleKey}
          filteredCount={filteredCount}
          totalCount={totalCount}
        />
      ) : null}
      {showSuccess ? <SuccessState message="Budgetliste aktualisiert." /> : null}
      <PremiumInput
        label="Suche"
        placeholder="Bezeichnung oder Klient:in…"
        value={search}
        onChangeText={setSearch}
        hint={`${filteredCount} von ${totalCount} Budgets`}
      />
      <Text style={styles.filterLabel}>Status</Text>
      <FilterChipGroup options={statusFilters} value={statusFilter} onChange={setStatusFilter} />
      <Text style={styles.filterLabel}>Sortierung</Text>
      <FilterChipGroup options={sortOptions} value={sortKey} onChange={setSortKey} />
    </View>
  );

  if (loading && items.length === 0) {
    return shell(<LoadingState message="Budgets werden geladen…" />, 'Budgets', 'Wird geladen…');
  }

  if (error && items.length === 0) {
    return shell(<ErrorState message={error} onRetry={refresh} />, 'Budgets', 'Fehler');
  }

  const list = (
    <FlatList
      style={embedded ? styles.embeddedList : styles.flatList}
      data={items}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={header}
      ListEmptyComponent={
        isEmpty ? (
          <EmptyState title="Keine Budgets" message="Für diesen Mandanten sind noch keine Budgets hinterlegt." />
        ) : isFilterEmpty ? (
          <EmptyState
            title="Keine Treffer"
            message="Keine Budgets für Ihre Filter."
            actionLabel="Filter zurücksetzen"
            onAction={resetFilters}
          />
        ) : null
      }
      ListFooterComponent={
        hasMore ? (
          <Text style={styles.footer} onPress={loadMore}>
            Weitere laden
          </Text>
        ) : null
      }
      renderItem={({ item }) => (
        <PremiumCard
          accentColor={item.usagePercent >= 85 ? colors.danger : colors.cyan}
          onPress={() => router.push(`/office/budgets/${item.id}` as never)}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.label}>{item.label}</Text>
            <PremiumBadge label={WORKFLOW_STATUS_LABELS[item.status]} variant="muted" dot />
          </View>
          <Text style={styles.client}>{item.clientName}</Text>
          <Text style={styles.meta}>
            {PERIOD_LABELS[item.period]} · {item.usagePercent} % genutzt
          </Text>
          <Text style={styles.amount}>
            {formatCurrency(item.usedCents, item.currency)} /{' '}
            {formatCurrency(item.allocatedCents, item.currency)}
          </Text>
        </PremiumCard>
      )}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />
      }
    />
  );

  return embedded ? list : shell(list, 'Budgets', `${filteredCount} Einträge`);
}

const styles = StyleSheet.create({
  embedded: { flex: 1 },
  embeddedList: { flex: 1 },
  flatList: { flex: 1 },
  toolbar: { gap: spacing.sm, marginBottom: spacing.md },
  filterLabel: { ...typography.label, marginTop: spacing.xs },
  list: { paddingBottom: spacing.xxl, gap: spacing.sm },
  footer: { ...typography.caption, textAlign: 'center', marginVertical: spacing.md, color: colors.cyan },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  label: { ...typography.bodyStrong, flex: 1 },
  client: { ...typography.caption, marginTop: 4 },
  meta: { ...typography.caption, marginTop: 4 },
  amount: { ...typography.bodyStrong, color: colors.cyan, marginTop: spacing.sm },
});
