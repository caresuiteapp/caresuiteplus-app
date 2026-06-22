import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ErrorState, LoadingState } from '@/components/ui';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { archiveBroadcast } from '@/lib/office/broadcastservice';
import { useOfficeBroadcastDetail } from '@/hooks/useofficebroadcasts';
import { spacing, radius } from '@/theme';
import { BROADCAST_PRIORITIES } from '@/types/office/broadcast';

const PRIORITY_LABELS = Object.fromEntries(BROADCAST_PRIORITIES.map((p) => [p.key, p.label]));

type OfficeBroadcastDetailProps = {
  broadcastId: string | null;
  onArchived?: () => void;
  onOpenThread?: (threadId: string) => void;
};

export function OfficeBroadcastDetail({
  broadcastId,
  onArchived,
  onOpenThread,
}: OfficeBroadcastDetailProps) {
  const { c } = useCareLightPalette();
  const { typography } = useLegacyTheme();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const router = useRouter();
  const { detail, loading, error, refresh } = useOfficeBroadcastDetail(broadcastId);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, padding: spacing.lg, gap: spacing.md },
        title: { ...typography.h3, color: c.text, fontWeight: '800' },
        body: { ...typography.body, color: c.text, lineHeight: 22 },
        meta: { ...typography.caption, color: c.muted },
        section: { gap: spacing.sm },
        sectionTitle: {
          ...typography.caption,
          color: c.muted,
          textTransform: 'uppercase',
          fontWeight: '700',
        },
        statRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          paddingVertical: spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: c.border,
        },
        statName: { ...typography.body, color: c.text, fontWeight: '600' },
        statStatus: { ...typography.caption, color: c.muted },
        badge: {
          alignSelf: 'flex-start',
          paddingHorizontal: spacing.sm,
          paddingVertical: 4,
          borderRadius: radius.capsule,
          backgroundColor: `${c.violet}14`,
        },
        badgeText: { ...typography.caption, color: c.violet, fontWeight: '700' },
        action: { ...typography.body, color: c.violet, fontWeight: '700' },
        empty: { ...typography.body, color: c.muted, textAlign: 'center', padding: spacing.xl },
      }),
    [c, typography],
  );

  if (!broadcastId) {
    return <Text style={styles.empty}>Broadcast auswählen, um Details anzuzeigen.</Text>;
  }

  if (loading) return <LoadingState message="Broadcast wird geladen …" />;
  if (error) return <ErrorState message={error} onRetry={() => void refresh()} />;
  if (!detail) return <Text style={styles.empty}>Broadcast nicht gefunden.</Text>;

  const handleArchive = async () => {
    if (!tenantId) return;
    const result = await archiveBroadcast(tenantId, detail.id, profile?.roleKey, profile?.id);
    if (result.ok) {
      void refresh();
      onArchived?.();
    }
  };

  return (
    <View style={styles.root}>
      <Text style={styles.title}>{detail.title}</Text>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>
          {detail.categoryLabel} · {PRIORITY_LABELS[detail.priority]}
        </Text>
      </View>
      <Text style={styles.body}>{detail.body}</Text>
      <Text style={styles.meta}>
        Gesendet: {detail.sentAt ? new Date(detail.sentAt).toLocaleString('de-DE') : '—'}
      </Text>
      <Text style={styles.meta}>
        Empfänger: {detail.recipientCount} · Gelesen: {detail.readCount}/{detail.recipientCount}
        {detail.requireAcknowledgement
          ? ` · Bestätigt: ${detail.acknowledgedCount}/${detail.recipientCount}`
          : ''}
      </Text>

      {detail.status !== 'archived' ? (
        <Pressable onPress={() => void handleArchive()}>
          <Text style={styles.action}>Broadcast archivieren</Text>
        </Pressable>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Lesestatus pro Mitarbeiter:in</Text>
        <FlatList
          data={detail.recipients}
          keyExtractor={(item) => item.id}
          style={{ maxHeight: 280 }}
          renderItem={({ item }) => (
            <View style={styles.statRow}>
              <Text style={styles.statName}>{item.employeeName}</Text>
              <Text style={styles.statStatus}>
                {item.isAcknowledged
                  ? `Bestätigt ${item.acknowledgedAt ? new Date(item.acknowledgedAt).toLocaleDateString('de-DE') : ''}`
                  : item.isRead
                    ? `Gelesen ${item.readAt ? new Date(item.readAt).toLocaleDateString('de-DE') : ''}`
                    : 'Offen'}
                {item.replyThreadId ? ' · Rückfrage' : ''}
              </Text>
            </View>
          )}
        />
      </View>

      {detail.recipients.some((r) => r.replyThreadId) ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Rückfragen (Mitarbeitenden-Chats)</Text>
          {detail.recipients
            .filter((r) => r.replyThreadId)
            .map((r) => (
              <Pressable
                key={r.id}
                onPress={() => {
                  if (r.replyThreadId) {
                    if (onOpenThread) {
                      onOpenThread(r.replyThreadId);
                    } else {
                      router.push(`/office/messages?thread=${r.replyThreadId}` as never);
                    }
                  }
                }}
              >
                <Text style={styles.action}>
                  {r.employeeName} — Chat öffnen
                </Text>
              </Pressable>
            ))}
        </View>
      ) : null}
    </View>
  );
}
