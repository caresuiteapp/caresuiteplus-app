import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';
import {
  PRIORITY_LABELS,
  THREAD_TYPE_LABELS,
} from '@/features/communication/communication.constants';
import type { ThreadListItem } from '@/features/communication/communication.types';
import { UnreadBadge } from './UnreadBadge';

type ConversationListItemProps = {
  item: ThreadListItem;
};

function formatTime(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ConversationListItem({ item }: ConversationListItemProps) {
  const unread = item.unreadCountBusiness;
  return (
    <View style={styles.row}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{item.title.slice(0, 1).toUpperCase()}</Text>
      </View>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.time}>{formatTime(item.lastMessageAt)}</Text>
        </View>
        <Text style={styles.preview} numberOfLines={2}>
          {item.previewText ?? 'Keine Vorschau'}
        </Text>
        <View style={styles.badges}>
          <PremiumBadge label={THREAD_TYPE_LABELS[item.threadType]} variant="muted" />
          {item.priority !== 'normal' ? (
            <PremiumBadge label={PRIORITY_LABELS[item.priority]} variant="orange" />
          ) : null}
          {item.isPortalVisible ? <PremiumBadge label="Portal" variant="cyan" /> : null}
          {item.hasAttachments ? <PremiumBadge label="📎" variant="muted" /> : null}
          <UnreadBadge count={unread} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.sm },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.bgPanel,
    borderWidth: 1,
    borderColor: colors.borderCyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { ...typography.bodyStrong, color: colors.cyan },
  content: { flex: 1, gap: spacing.xs },
  header: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  title: { ...typography.bodyStrong, flex: 1, color: colors.textPrimary },
  time: { ...typography.caption, color: colors.textMuted },
  preview: { ...typography.body, color: colors.textSecondary },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
});
