import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  ErrorState,
  LoadingState,
  PremiumBadge,
  PremiumButton,
  PremiumCard,
  PremiumInput,
  SectionPanel,
  SuccessState,
} from '@/components/ui';
import { LockedActionBanner } from '@/components/permissions';
import { useOfficeMessageDetail } from '@/hooks/useOfficeMessageDetail';
import { usePermissions } from '@/hooks/usePermissions';
import { isLiveServiceMode } from '@/lib/services/liveServiceGuard';
import { VISIBILITY_LABELS } from '@/types/portal/visibility';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { colors, spacing, typography } from '@/theme';

type OfficeMessageDetailSummaryPanelProps = {
  messageId: string;
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function OfficeMessageDetailSummaryPanel({ messageId }: OfficeMessageDetailSummaryPanelProps) {
  const { can, check, isReadOnly, roleLabel } = usePermissions();
  const canReply = can('office.access') && !isReadOnly;
  const [replyText, setReplyText] = useState('');
  const {
    data: message,
    loading,
    error,
    refresh,
    reply,
    replyLoading,
    replyError,
    successMessage,
    notFound,
  } = useOfficeMessageDetail(messageId);

  if (loading) {
    return <LoadingState message="Nachricht wird geladen…" />;
  }

  if (notFound || error) {
    return (
      <View style={styles.panel}>
        <ErrorState
          title={notFound ? 'Nicht gefunden' : 'Fehler'}
          message={error ?? 'Die Nachricht existiert nicht.'}
          onRetry={refresh}
        />
      </View>
    );
  }

  if (!message) return null;

  const handleReply = async () => {
    const sent = await reply(replyText);
    if (sent) setReplyText('');
  };

  return (
    <View style={styles.panel}>
      {successMessage ? <SuccessState message={successMessage} /> : null}

      <PremiumCard accentColor={message.readAt ? undefined : colors.orange}>
        <Text style={styles.subject}>{message.subject}</Text>
        <Text style={styles.participants}>
          {message.senderName} → {message.recipientName}
        </Text>
        <View style={styles.badges}>
          <PremiumBadge
            label={WORKFLOW_STATUS_LABELS[message.status]}
            variant={message.status === 'fehlerhaft' ? 'red' : 'muted'}
            dot
          />
          <PremiumBadge label={VISIBILITY_LABELS[message.visibility]} variant="cyan" />
          {!message.readAt ? <PremiumBadge label="Ungelesen" variant="orange" /> : null}
        </View>
      </PremiumCard>

      {isReadOnly ? (
        <LockedActionBanner
          title="Lesemodus"
          message="Sie können Nachrichten einsehen, aber nicht beantworten."
          roleLabel={roleLabel}
        />
      ) : null}

      <SectionPanel title="Inhalt" subtitle="Nachrichtentext">
        <Text style={styles.body}>{message.body}</Text>
      </SectionPanel>

      <SectionPanel title="Metadaten" subtitle="Zeitstempel & Kanal">
        <Text style={styles.meta}>Erstellt: {formatDateTime(message.createdAt)}</Text>
        <Text style={styles.meta}>Aktualisiert: {formatDateTime(message.updatedAt)}</Text>
        <Text style={styles.meta}>Kanal: {message.channel}</Text>
      </SectionPanel>

      {message.canReply && canReply ? (
        <SectionPanel
          title="Antworten"
          subtitle={isLiveServiceMode() ? 'Antwort an den Absender' : 'Demo-Versand mit Persistenz'}
        >
          <PremiumInput
            label="Antwort"
            value={replyText}
            onChangeText={setReplyText}
            placeholder="Ihre Antwort an den Absender…"
            multiline
            hint="Mindestens 10 Zeichen"
          />
          {replyError ? <Text style={styles.replyError}>{replyError}</Text> : null}
          <PremiumButton
            title="Antwort senden"
            onPress={handleReply}
            loading={replyLoading}
            disabled={replyText.trim().length < 10}
          />
        </SectionPanel>
      ) : message.canReply ? (
        <LockedActionBanner
          message={check('office.access').reason ?? 'Keine Berechtigung zum Antworten.'}
          roleLabel={roleLabel}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { flex: 1, padding: spacing.md, gap: spacing.md },
  subject: { ...typography.h2, marginBottom: spacing.xs },
  participants: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.sm },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  body: {
    ...typography.body,
    color: colors.textSecondary,
  },
  meta: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  replyError: {
    ...typography.caption,
    color: colors.danger,
    marginBottom: spacing.xs,
  },
});
