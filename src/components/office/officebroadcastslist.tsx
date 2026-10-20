import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { spacing, radius } from '@/theme';
import type { NotificationBroadcast } from '@/types/office/broadcast';
import { BROADCAST_PRIORITIES } from '@/types/office/broadcast';
import type { OfficeMessageAudience } from '@/types/office/messaging';
import { OFFICE_AUDIENCE_LABELS } from '@/lib/office/officemessengerfilters';
import { useOfficeBroadcasts } from '@/hooks/useofficebroadcasts';

const PRIORITY_LABELS = Object.fromEntries(BROADCAST_PRIORITIES.map((p) => [p.key, p.label]));

type OfficeBroadcastsListProps = {
  audience: OfficeMessageAudience;
  selectedId: string | null;
  onSelect: (id: string) => void;
};

function broadcastMatchesAudience(
  item: NotificationBroadcast,
  audience: OfficeMessageAudience,
): boolean {
  return item.audience === audience;
}

function BroadcastRow({
  item,
  selected,
  onPress,
}: {
  item: NotificationBroadcast;
  selected: boolean;
  onPress: () => void;
}) {
  const { c } = useCareLightPalette();
  const { typography } = useLegacyTheme();

  const readLabel =
    item.recipientCount > 0
      ? `${item.readCount}/${item.recipientCount} gelesen`
      : '—';

  const ackLabel =
    item.requireAcknowledgement && item.recipientCount > 0
      ? ` · ${item.acknowledgedCount}/${item.recipientCount} bestätigt`
      : '';

  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: {
          padding: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: c.border,
          backgroundColor: selected ? `${c.violet}18` : 'transparent',
        },
        title: { ...typography.body, fontWeight: '700', color: c.text },
        meta: { ...typography.caption, color: c.muted, marginTop: spacing.xs },
        badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
        badge: {
          paddingHorizontal: spacing.sm,
          paddingVertical: 2,
          borderRadius: radius.capsule,
          backgroundColor: `${c.violet}14`,
        },
        badgeText: { ...typography.caption, color: c.violet, fontWeight: '600' },
      }),
    [c, selected, typography],
  );

  const sentLabel = item.sentAt
    ? new Date(item.sentAt).toLocaleString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

  return (
    <Pressable onPress={onPress} style={styles.row} accessibilityRole="button">
      <Text style={styles.title} numberOfLines={1}>
        {item.title}
      </Text>
      <Text style={styles.meta}>
        {sentLabel} · {readLabel}
        {ackLabel}
      </Text>
      <View style={styles.badges}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{item.categoryLabel}</Text>
        </View>
        {item.priority !== 'normal' ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {PRIORITY_LABELS[item.priority] ?? item.priority}
            </Text>
          </View>
        ) : null}
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{item.status === 'archived' ? 'Archiviert' : 'Gesendet'}</Text>
        </View>
      </View>
    </Pressable>
  );
}

export function OfficeBroadcastsList({ audience, selectedId, onSelect }: OfficeBroadcastsListProps) {
  const { c } = useCareLightPalette();
  const { typography } = useLegacyTheme();
  const { broadcasts, loading, error, refresh } = useOfficeBroadcasts();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, minWidth: 0 },
        sectionLabel: {
          ...typography.caption,
          color: c.muted,
          textTransform: 'uppercase',
          paddingHorizontal: spacing.sm,
          paddingTop: spacing.sm,
        },
      }),
    [c, typography],
  );

  const filteredBroadcasts = useMemo(
    () => broadcasts.filter((item) => broadcastMatchesAudience(item, audience)),
    [audience, broadcasts],
  );

  if (loading) return <LoadingState message="Broadcasts werden geladen …" />;
  if (error) return <ErrorState message={error} onRetry={() => void refresh()} />;
  if (filteredBroadcasts.length === 0) {
    return (
      <View style={styles.root}>
        <Text style={styles.sectionLabel}>Broadcasts · {OFFICE_AUDIENCE_LABELS[audience]}</Text>
        <EmptyState
          title="Keine Broadcasts"
          message={`Noch keine Mitteilungen an ${OFFICE_AUDIENCE_LABELS[audience]} versendet.`}
        />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Text style={styles.sectionLabel}>Broadcasts · {OFFICE_AUDIENCE_LABELS[audience]}</Text>
      <FlatList
        data={filteredBroadcasts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <BroadcastRow
            item={item}
            selected={selectedId === item.id}
            onPress={() => onSelect(item.id)}
          />
        )}
      />
    </View>
  );
}
