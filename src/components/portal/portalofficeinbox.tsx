import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { PremiumInput, EmptyState, LoadingState, ErrorState } from '@/components/ui';
import { PortalEmptyState } from '@/components/portal/assist/PortalEmptyState';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { auroraGlass } from '@/design/tokens/auroraGlass';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { spacing, radius } from '@/theme';
import type { PortalOfficeInboxFilter } from '@/lib/office/portalofficemessageservice';
import { getPortalStatusLabel } from '@/lib/office/portalofficemessageservice';
import type { OfficeMessageThread } from '@/types/office/messaging';
import { usePortalOfficeMessages } from '@/hooks/useportalofficemessages';

const FILTERS: { key: PortalOfficeInboxFilter; label: string }[] = [
  { key: 'open', label: 'Offen' },
  { key: 'closed', label: 'Abgeschlossen' },
];

type PortalOfficeInboxProps = {
  filter: PortalOfficeInboxFilter;
  onFilterChange: (filter: PortalOfficeInboxFilter) => void;
  selectedThreadId: string | null;
  onThreadSelect: (threadId: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  variant?: 'default' | 'glass';
  onCompose?: () => void;
  composeLabel?: string;
};

function ThreadRow({
  thread,
  selected,
  onPress,
}: {
  thread: OfficeMessageThread;
  selected: boolean;
  onPress: () => void;
}) {
  const { c } = useCareLightPalette();
  const { typography } = useLegacyTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: {
          padding: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: c.border,
          backgroundColor: selected ? `${c.violet}22` : 'transparent',
        },
        subject: { ...typography.body, fontWeight: '700', color: c.text },
        preview: { ...typography.caption, color: c.muted, marginTop: spacing.xs },
        meta: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
        badge: {
          paddingHorizontal: spacing.sm,
          paddingVertical: 2,
          borderRadius: radius.capsule,
          backgroundColor: `${c.violet}18`,
        },
        badgeText: { ...typography.caption, color: c.violet },
      }),
    [c, selected, typography],
  );

  return (
    <Pressable onPress={onPress} style={styles.row}>
      <Text style={styles.subject} numberOfLines={1}>
        {thread.subject}
      </Text>
      <Text style={styles.preview} numberOfLines={2}>
        {thread.lastMessagePreview ?? '—'}
      </Text>
      <View style={styles.meta}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{getPortalStatusLabel(thread.status)}</Text>
        </View>
        {thread.categoryLabel ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{thread.categoryLabel}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

export function PortalOfficeInbox({
  filter,
  onFilterChange,
  selectedThreadId,
  onThreadSelect,
  search,
  onSearchChange,
  variant = 'default',
  onCompose,
  composeLabel = 'Verwaltung anschreiben',
}: PortalOfficeInboxProps) {
  const { c } = useCareLightPalette();
  const { typography } = useLegacyTheme();
  const { threads, loading, error, refresh, isEmpty } = usePortalOfficeMessages(filter);
  const isGlass = variant === 'glass';

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, minWidth: 0 },
        filters: { flexDirection: 'row', gap: spacing.xs, padding: spacing.sm },
        filterChip: {
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs,
          borderRadius: radius.capsule,
          borderWidth: 1,
          borderColor: isGlass ? auroraGlass.border : c.border,
        },
        filterChipActive: {
          backgroundColor: isGlass ? auroraGlass.chipActive : `${c.violet}22`,
          borderColor: isGlass ? '#FF9500' : c.violet,
        },
        filterText: { ...typography.caption, color: isGlass ? auroraGlass.text.muted : c.muted },
        filterTextActive: { color: isGlass ? '#FF9500' : c.violet, fontWeight: '700' },
        search: { paddingHorizontal: spacing.sm, paddingBottom: spacing.sm },
        list: { flex: 1 },
        emptyWrap: { padding: spacing.md },
      }),
    [c, isGlass, typography],
  );

  const filteredThreads = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return threads;
    return threads.filter(
      (thread) =>
        thread.subject.toLowerCase().includes(term) ||
        (thread.lastMessagePreview ?? '').toLowerCase().includes(term) ||
        (thread.categoryLabel ?? '').toLowerCase().includes(term),
    );
  }, [threads, search]);

  if (loading && threads.length === 0) {
    return (
      <View style={styles.root}>
        <LoadingState message="Chats werden geladen…" />
      </View>
    );
  }

  if (error && threads.length === 0) {
    return (
      <View style={styles.root}>
        <ErrorState message={error} onRetry={refresh} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.filters}>
        {FILTERS.map((item) => {
          const active = item.key === filter;
          return (
            <Pressable
              key={item.key}
              onPress={() => onFilterChange(item.key)}
              style={[styles.filterChip, active && styles.filterChipActive]}
            >
              <Text style={[styles.filterText, active && styles.filterTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.search}>
        <PremiumInput value={search} onChangeText={onSearchChange} placeholder="Suchen…" />
      </View>
      {isEmpty ? (
        <View style={styles.emptyWrap}>
          {isGlass ? (
            <PortalEmptyState
              title="Keine Chats"
              message="Schreiben Sie der Verwaltung — Ihre Nachricht erscheint im Verwaltungs-Postfach und Antworten sehen Sie hier."
              actionLabel={composeLabel}
              onAction={onCompose}
            />
          ) : (
            <EmptyState
              title="Keine Chats"
              message="Noch keine Nachrichten an die Verwaltung vorhanden."
              actionLabel={composeLabel}
              onAction={onCompose}
            />
          )}
        </View>
      ) : (
        <FlatList
          style={styles.list}
          data={filteredThreads}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ThreadRow
              thread={item}
              selected={item.id === selectedThreadId}
              onPress={() => onThreadSelect(item.id)}
            />
          )}
          onRefresh={refresh}
          refreshing={loading}
        />
      )}
    </View>
  );
}
