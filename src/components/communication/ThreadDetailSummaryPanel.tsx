import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LockedActionBanner } from '@/components/permissions';
import {
  ErrorState,
  LoadingState,
  PremiumBadge,
  PremiumButton,
  PremiumCard,
  SectionPanel,
} from '@/components/ui';
import {
  PRIORITY_LABELS,
  THREAD_STATUS_LABELS,
  THREAD_TYPE_LABELS,
} from '@/features/communication/communication.constants';
import { useThread } from '@/hooks/communication';
import { usePermissions } from '@/hooks/usePermissions';
import { colors, spacing, typography } from '@/theme';

type ThreadDetailSummaryPanelProps = {
  threadId: string;
};

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ThreadDetailSummaryPanel({ threadId }: ThreadDetailSummaryPanelProps) {
  const router = useRouter();
  const { isReadOnly, roleLabel } = usePermissions();
  const { thread, loading, error, refresh, notFound } = useThread(threadId);

  if (loading) {
    return <LoadingState message="Thread wird geladen…" />;
  }

  if (notFound || error) {
    return (
      <View style={styles.panel}>
        <ErrorState
          title={notFound ? 'Nicht gefunden' : 'Fehler'}
          message={error ?? 'Der Thread existiert nicht.'}
          onRetry={refresh}
        />
      </View>
    );
  }

  if (!thread) return null;

  return (
    <View style={styles.panel}>
      <PremiumCard accentColor={thread.unreadCountBusiness > 0 ? colors.cyan : undefined}>
        <Text style={styles.title}>{thread.title}</Text>
        <Text style={styles.participant}>
          {thread.lastMessageByDisplayName ?? THREAD_TYPE_LABELS[thread.threadType]}
        </Text>
        <View style={styles.badges}>
          <PremiumBadge label={THREAD_TYPE_LABELS[thread.threadType]} variant="muted" />
          <PremiumBadge label={THREAD_STATUS_LABELS[thread.status]} variant="cyan" dot />
          {thread.priority !== 'normal' ? (
            <PremiumBadge label={PRIORITY_LABELS[thread.priority]} variant="orange" />
          ) : null}
          {thread.unreadCountBusiness > 0 ? (
            <PremiumBadge label={`${thread.unreadCountBusiness} ungelesen`} variant="orange" />
          ) : null}
        </View>
      </PremiumCard>

      {isReadOnly ? (
        <LockedActionBanner
          title="Lesemodus"
          message="Sie können Threads einsehen, aber nicht antworten."
          roleLabel={roleLabel}
        />
      ) : null}

      <SectionPanel title="Vorschau" subtitle="Letzte Nachricht">
        <Text style={styles.preview}>{thread.previewText ?? 'Keine Vorschau verfügbar.'}</Text>
        {thread.lastMessageByDisplayName ? (
          <Text style={styles.meta}>Von {thread.lastMessageByDisplayName}</Text>
        ) : null}
      </SectionPanel>

      <SectionPanel title="Metadaten" subtitle="Zeitstempel & Kontext">
        <Text style={styles.meta}>Letzte Aktivität: {formatDateTime(thread.lastMessageAt)}</Text>
        <Text style={styles.meta}>Aktualisiert: {formatDateTime(thread.updatedAt)}</Text>
        {thread.moduleKey ? <Text style={styles.meta}>Modul: {thread.moduleKey}</Text> : null}
        {thread.isPortalVisible ? (
          <Text style={styles.meta}>Sichtbar im Portal</Text>
        ) : null}
      </SectionPanel>

      <PremiumButton
        title="Vollansicht öffnen"
        onPress={() => router.push(`/business/messages/${threadId}` as never)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { flex: 1, padding: spacing.md, gap: spacing.md },
  title: { ...typography.h2, marginBottom: spacing.xs },
  participant: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.sm },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  preview: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  meta: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
});
