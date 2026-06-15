import { FlatList, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CareLightPageShell } from '@/components/layout';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumButton,
  PremiumCard,
  PremiumInput,
} from '@/components/ui';
import { usePermissions } from '@/hooks/usePermissions';
import { colors, spacing, typography } from '@/theme';

type EntityListMeta = { primary: string; secondary: string; badge?: string };

type EntityListScreenProps<T> = {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  emptyTitle?: string;
  emptyMessage?: string;
  filterEmptyTitle?: string;
  filterEmptyMessage?: string;
  createLabel?: string;
  loading: boolean;
  error: string | null;
  refreshing: boolean;
  onRefresh: () => void;
  items: T[];
  isEmpty: boolean;
  isFilterEmpty?: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  getItemId: (item: T) => string;
  renderMeta: (item: T) => EntityListMeta;
  onOpen?: (item: T) => void;
  onCreatePress?: () => void;
  showCreate?: boolean;
};

export function EntityListScreen<T>({
  title,
  subtitle,
  eyebrow,
  emptyTitle = 'Keine Einträge',
  emptyMessage = 'Für diesen Bereich sind noch keine Daten hinterlegt.',
  filterEmptyTitle = 'Keine Treffer',
  filterEmptyMessage = 'Passen Sie die Suche an oder setzen Sie den Filter zurück.',
  createLabel = '+ Neu',
  loading,
  error,
  refreshing,
  onRefresh,
  items,
  isEmpty,
  isFilterEmpty = false,
  search,
  onSearchChange,
  getItemId,
  renderMeta,
  onOpen,
  onCreatePress,
  showCreate = false,
}: EntityListScreenProps<T>) {
  const { isReadOnly, roleLabel } = usePermissions();

  if (loading && isEmpty && !search) {
    return (
      <CareLightPageShell title={title} subtitle="Wird geladen…">
        <LoadingState message={`${title} werden geladen…`} />
      </CareLightPageShell>
    );
  }

  if (error && isEmpty && !search) {
    return (
      <CareLightPageShell title={title} subtitle="Fehler">
        <ErrorState message={error} onRetry={onRefresh} />
      </CareLightPageShell>
    );
  }

  return (
    <CareLightPageShell
      title={title}
      subtitle={subtitle ?? roleLabel ?? 'Demo'}
      rightSlot={
        showCreate && !isReadOnly && onCreatePress ? (
          <PremiumButton title={createLabel} size="sm" onPress={onCreatePress} />
        ) : null
      }
      scroll={false}
    >
      <ScrollView contentContainerStyle={styles.header}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <PremiumInput
          label="Suche"
          placeholder="Filtern…"
          value={search}
          onChangeText={onSearchChange}
        />
        <Text style={styles.count}>{items.length} Einträge</Text>
      </ScrollView>
      <FlatList
        data={items}
        keyExtractor={(item) => getItemId(item)}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          isFilterEmpty ? (
            <EmptyState title={filterEmptyTitle} message={filterEmptyMessage} />
          ) : (
            <EmptyState title={emptyTitle} message={emptyMessage} />
          )
        }
        renderItem={({ item }) => {
          const meta = renderMeta(item);
          return (
            <PremiumCard style={styles.card} onPress={onOpen ? () => onOpen(item) : undefined}>
              <View style={styles.cardHeader}>
                <Text style={styles.primary}>{meta.primary}</Text>
                {meta.badge ? <Text style={styles.badge}>{meta.badge}</Text> : null}
              </View>
              <Text style={styles.secondary}>{meta.secondary}</Text>
            </PremiumCard>
          );
        }}
      />
    </CareLightPageShell>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm, gap: spacing.sm },
  eyebrow: { ...typography.caption, color: colors.textMuted },
  count: { ...typography.caption, color: colors.textMuted },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm },
  card: { marginBottom: spacing.sm },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm },
  primary: { ...typography.label, flex: 1 },
  badge: { ...typography.caption, color: colors.orange },
  secondary: { ...typography.body, color: colors.textMuted, marginTop: spacing.xs },
});
