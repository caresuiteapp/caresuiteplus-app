import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { PremiumInput, EmptyState, LoadingState, ErrorState } from '@/components/ui';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { spacing, radius } from '@/theme';
import type { OfficeInboxFilter, OfficeMessageThread } from '@/types/office/messaging';
import { useOfficeMessageThreads } from '@/hooks/useofficemessagethreads';

const INBOX_FILTERS: { key: OfficeInboxFilter; label: string }[] = [
  { key: 'inbox', label: 'Posteingang' },
  { key: 'clients', label: 'Klient:innen' },
  { key: 'employees', label: 'Mitarbeitende' },
  { key: 'internal', label: 'Intern' },
  { key: 'closed', label: 'Abgeschlossen' },
];

const PRIORITY_LABELS: Record<OfficeMessageThread['priority'], string> = {
  low: 'Niedrig',
  normal: 'Normal',
  high: 'Hoch',
  urgent: 'Dringend',
};

const THREAD_TYPE_LABELS: Record<OfficeMessageThread['threadType'], string> = {
  client_office: 'Klient:in',
  employee_office: 'Mitarbeiter:in',
  internal: 'Intern',
};

type OfficeMessagesInboxProps = {
  filter: OfficeInboxFilter;
  onFilterChange: (filter: OfficeInboxFilter) => void;
  selectedThreadId: string | null;
  onThreadSelect: (threadId: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
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
          backgroundColor: selected ? `${c.violet}14` : 'transparent',
        },
        header: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
        subject: { ...typography.body, fontWeight: '700', color: c.text, flex: 1 },
        time: { ...typography.caption, color: c.muted },
        preview: { ...typography.caption, color: c.muted, marginTop: spacing.xs },
        meta: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
        badge: {
          paddingHorizontal: spacing.sm,
          paddingVertical: 2,
          borderRadius: radius.capsule,
          backgroundColor: c.surfaceAlt,
        },
        badgeText: { ...typography.caption, color: c.muted },
        unread: {
          minWidth: 20,
          height: 20,
          borderRadius: 10,
          backgroundColor: c.violet,
          alignItems: 'center',
          justifyContent: 'center',
        },
        unreadText: { ...typography.caption, color: '#fff', fontWeight: '700', fontSize: 11 },
      }),
    [c, typography, selected],
  );

  const participant =
    thread.clientName ?? thread.employeeName ?? THREAD_TYPE_LABELS[thread.threadType];
  const timeLabel = thread.lastMessageAt
    ? new Date(thread.lastMessageAt).toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

  return (
    <Pressable onPress={onPress} style={styles.row} accessibilityRole="button">
      <View style={styles.header}>
        <Text style={styles.subject} numberOfLines={1}>
          {thread.subject}
        </Text>
        {thread.unreadCount > 0 ? (
          <View style={styles.unread}>
            <Text style={styles.unreadText}>{thread.unreadCount}</Text>
          </View>
        ) : (
          <Text style={styles.time}>{timeLabel}</Text>
        )}
      </View>
      <Text style={styles.preview} numberOfLines={2}>
        {participant}: {thread.lastMessagePreview ?? '—'}
      </Text>
      <View style={styles.meta}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{THREAD_TYPE_LABELS[thread.threadType]}</Text>
        </View>
        {thread.categoryLabel ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{thread.categoryLabel}</Text>
          </View>
        ) : null}
        {thread.priority !== 'normal' ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{PRIORITY_LABELS[thread.priority]}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

export function OfficeMessagesInbox({
  filter,
  onFilterChange,
  selectedThreadId,
  onThreadSelect,
  search,
  onSearchChange,
}: OfficeMessagesInboxProps) {
  const { c } = useCareLightPalette();
  const { typography } = useLegacyTheme();
  const { threads, loading, error, refresh, isEmpty } = useOfficeMessageThreads(filter);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, minWidth: 0 },
        filters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, padding: spacing.sm },
        filterChip: {
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs,
          borderRadius: radius.capsule,
          borderWidth: 1,
          borderColor: c.border,
        },
        filterChipActive: { backgroundColor: `${c.violet}14`, borderColor: c.violet },
        filterText: { ...typography.caption, color: c.muted },
        filterTextActive: { color: c.violet, fontWeight: '700' },
        search: { paddingHorizontal: spacing.sm, paddingBottom: spacing.sm },
        list: { flex: 1 },
      }),
    [c, typography],
  );

  const filteredThreads = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return threads;
    return threads.filter(
      (thread) =>
        thread.subject.toLowerCase().includes(term) ||
        (thread.clientName ?? '').toLowerCase().includes(term) ||
        (thread.employeeName ?? '').toLowerCase().includes(term) ||
        (thread.lastMessagePreview ?? '').toLowerCase().includes(term),
    );
  }, [threads, search]);

  if (loading && threads.length === 0) {
    return (
      <View style={styles.root}>
        <LoadingState message="Daten werden geladen…" />
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
        {INBOX_FILTERS.map((item) => {
          const active = item.key === filter;
          return (
            <Pressable
              key={item.key}
              onPress={() => onFilterChange(item.key)}
              style={[styles.filterChip, active && styles.filterChipActive]}
            >
              <Text style={[styles.filterText, active && styles.filterTextActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.search}>
        <PremiumInput
          value={search}
          onChangeText={onSearchChange}
          placeholder="Suchen…"
        />
      </View>
      {isEmpty ? (
        <EmptyState
          title="Keine Chats"
          message="In diesem Postfach sind noch keine Nachrichten vorhanden."
        />
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
