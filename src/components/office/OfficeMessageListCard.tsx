import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumCard } from '@/components/ui';
import type { MessageListItem } from '@/types/portal/communication';
import { VISIBILITY_LABELS } from '@/types/portal/visibility';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { colors, spacing, typography } from '@/theme';

type OfficeMessageListCardProps = {
  message: MessageListItem;
  onPress?: () => void;
  selected?: boolean;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function statusVariant(status: MessageListItem['status']) {
  switch (status) {
    case 'aktiv':
      return 'green' as const;
    case 'fehlerhaft':
      return 'red' as const;
    case 'in_bearbeitung':
    case 'entwurf':
      return 'orange' as const;
    default:
      return 'muted' as const;
  }
}

export function OfficeMessageListCard({
  message,
  onPress,
  selected = false,
}: OfficeMessageListCardProps) {
  const inner = (
    <>
      <View style={styles.cardHeader}>
        <Text style={[styles.subject, !message.readAt && styles.unreadSubject]}>
          {message.subject}
        </Text>
        {!message.readAt ? <PremiumBadge label="Neu" variant="orange" /> : null}
      </View>
      <Text style={styles.body} numberOfLines={3}>
        {message.body}
      </Text>
      <View style={styles.footerRow}>
        <Text style={styles.meta}>
          Von {message.senderName} an {message.recipientName} · {formatDate(message.updatedAt)}
        </Text>
      </View>
      <View style={styles.badges}>
        <PremiumBadge
          label={WORKFLOW_STATUS_LABELS[message.status]}
          variant={statusVariant(message.status)}
          dot
        />
        <PremiumBadge label={VISIBILITY_LABELS[message.visibility]} variant="cyan" />
      </View>
    </>
  );

  if (!onPress) {
    return (
      <PremiumCard accentColor={message.readAt ? undefined : colors.orange} style={styles.card}>
        {inner}
      </PremiumCard>
    );
  }

  return (
    <Pressable onPress={onPress}>
      <PremiumCard
        accentColor={message.readAt ? undefined : colors.orange}
        style={[styles.card, selected ? styles.cardSelected : null]}
        onPress={onPress}
      >
        {inner}
      </PremiumCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.sm,
  },
  cardSelected: {
    borderColor: colors.orange,
    borderWidth: 2,
    backgroundColor: 'rgba(255,149,0,0.08)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  subject: { ...typography.bodyStrong, flex: 1 },
  unreadSubject: { color: colors.orange },
  body: { ...typography.body, color: colors.textSecondary },
  footerRow: { marginTop: spacing.sm },
  meta: { ...typography.caption },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
});
