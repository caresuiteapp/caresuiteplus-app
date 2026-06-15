import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CareLightPageShell } from '@/components/layout';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumButton,
  PremiumCard,
  PremiumInput,
} from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import type { RoleKey, ServiceResult } from '@/types';
import { colors, spacing, typography } from '@/theme';

type DedicatedListScreenProps<T> = {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  emptyTitle?: string;
  emptyMessage?: string;
  createRoute?: string;
  createLabel?: string;
  queryFn: (tenantId: string, roleKey?: RoleKey | null) => Promise<ServiceResult<T[]>>;
  searchKeys: (keyof T | ((item: T) => string))[];
  renderMeta: (item: T) => { primary: string; secondary: string; badge?: string };
  onOpen?: (item: T) => void;
  getItemId: (item: T) => string;
};

export function DedicatedListScreen<T>({
  title,
  subtitle,
  eyebrow,
  emptyTitle = 'Keine Einträge',
  emptyMessage = 'Für diesen Bereich sind noch keine Daten hinterlegt.',
  createRoute,
  createLabel = '+ Neu',
  queryFn,
  searchKeys,
  renderMeta,
  onOpen,
  getItemId,
}: DedicatedListScreenProps<T>) {
  const router = useRouter();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { isReadOnly, roleLabel } = usePermissions();
  const [search, setSearch] = useState('');

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return queryFn(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  const items = useMemo(() => {
    const data = query.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter((item) =>
      searchKeys.some((key) => {
        const value = typeof key === 'function' ? key(item) : String(item[key] ?? '');
        return value.toLowerCase().includes(q);
      }),
    );
  }, [query.data, search, searchKeys]);

  if (query.loading && !query.data) {
    return (
      <CareLightPageShell title={title} subtitle="Wird geladen…">
        <LoadingState message={`${title} werden geladen…`} />
      </CareLightPageShell>
    );
  }

  if (query.error && !query.data) {
    return (
      <CareLightPageShell title={title} subtitle="Fehler">
        <ErrorState message={query.error} onRetry={query.refresh} />
      </CareLightPageShell>
    );
  }

  return (
    <CareLightPageShell
      title={title}
      subtitle={subtitle ?? roleLabel ?? 'Demo'}
      rightSlot={
        createRoute && !isReadOnly ? (
          <PremiumButton title={createLabel} size="sm" onPress={() => router.push(createRoute as never)} />
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
          onChangeText={setSearch}
        />
        <Text style={styles.count}>{items.length} Einträge</Text>
      </ScrollView>
      <FlatList
        data={items}
        keyExtractor={(item) => getItemId(item)}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={query.refreshing} onRefresh={query.refresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={<EmptyState title={emptyTitle} message={emptyMessage} />}
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
