import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PremiumBadge } from '@/components/ui';
import type { MessageListItem } from '@/types/portal/communication';
import { colors, spacing, typography } from '@/theme';

type OfficeMessageCompactRowProps = {
  message: MessageListItem;
  selected?: boolean;
  onPress?: () => void;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function OfficeMessageCompactRow({
  message,
  selected = false,
  onPress,
}: OfficeMessageCompactRowProps) {
  const unread = !message.readAt;

  return (
    <Pressable
      onPress={onPress}
      style={[styles.row, selected ? styles.rowSelected : null, unread ? styles.rowUnread : null]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <View style={styles.main}>
        <Text
          style={[styles.subject, unread ? styles.subjectUnread : null]}
          numberOfLines={1}
        >
          {message.subject}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {message.senderName} · {formatDate(message.updatedAt)}
        </Text>
      </View>
      {unread ? <PremiumBadge label="Neu" variant="orange" /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSoft,
    backgroundColor: colors.bgBase,
    minHeight: 56,
  },
  rowSelected: {
    backgroundColor: 'rgba(255,149,0,0.10)',
    borderLeftWidth: 3,
    borderLeftColor: colors.orange,
  },
  rowUnread: {
    backgroundColor: 'rgba(255,149,0,0.04)',
  },
  main: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  subject: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
  },
  subjectUnread: {
    color: colors.orange,
  },
  meta: {
    ...typography.caption,
    color: colors.textMuted,
  },
});
