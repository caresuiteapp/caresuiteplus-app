import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme';
import type { CommunicationMessage } from '@/features/communication/communication.types';
import { MessageStatusTicks } from './MessageStatusTicks';

type ChatBubbleProps = {
  message: CommunicationMessage;
  isOwn: boolean;
  showStatus?: boolean;
};

export function ChatBubble({ message, isOwn, showStatus = true }: ChatBubbleProps) {
  const isSystem = message.contentType === 'system';
  const isDeleted = message.status === 'deleted' || !!message.deletedAt;
  const body = isDeleted
    ? 'Nachricht gelöscht'
    : message.bodyText ?? (message.hasVoice ? '🎤 Sprachnachricht' : '');

  if (isSystem) {
    return (
      <View style={styles.systemWrap}>
        <Text style={styles.systemText}>{body}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.row, isOwn ? styles.rowOwn : styles.rowOther]}>
      <View
        style={[
          styles.bubble,
          isOwn ? styles.bubbleOwn : styles.bubbleOther,
          message.isInternalNote && styles.bubbleInternal,
        ]}
      >
        {!isOwn ? <Text style={styles.sender}>{message.senderDisplayName}</Text> : null}
        <Text style={styles.body}>{body}</Text>
        <View style={styles.meta}>
          <Text style={styles.time}>
            {new Date(message.sentAt ?? message.createdAt).toLocaleTimeString('de-DE', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
          {message.editedAt ? <Text style={styles.edited}>bearbeitet</Text> : null}
          {showStatus && isOwn ? <MessageStatusTicks status={message.status} /> : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { marginVertical: spacing.xs, paddingHorizontal: spacing.md },
  rowOwn: { alignItems: 'flex-end' },
  rowOther: { alignItems: 'flex-start' },
  bubble: {
    maxWidth: '82%',
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  bubbleOwn: {
    backgroundColor: colors.orange,
    borderBottomRightRadius: radius.sm,
  },
  bubbleOther: {
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.borderCyan,
    borderBottomLeftRadius: radius.sm,
  },
  bubbleInternal: {
    backgroundColor: colors.bgPanel,
    borderColor: colors.warning,
    borderStyle: 'dashed',
  },
  sender: { ...typography.caption, color: colors.cyan, marginBottom: spacing.xs },
  body: { ...typography.body, color: colors.textPrimary },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
  time: { ...typography.caption, color: colors.textMuted },
  edited: { ...typography.caption, color: colors.textMuted, fontStyle: 'italic' },
  systemWrap: { alignItems: 'center', marginVertical: spacing.sm },
  systemText: {
    ...typography.caption,
    color: colors.textSecondary,
    backgroundColor: colors.bgPanel,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.capsule,
  },
});
