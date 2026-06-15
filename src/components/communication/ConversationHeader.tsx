import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';
import {
  PRIORITY_LABELS,
  THREAD_STATUS_LABELS,
  THREAD_TYPE_LABELS,
} from '@/features/communication/communication.constants';
import type { CommunicationThread } from '@/features/communication/communication.types';

type ConversationHeaderProps = {
  thread: CommunicationThread;
};

export function ConversationHeader({ thread }: ConversationHeaderProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{thread.title}</Text>
      <View style={styles.badges}>
        <PremiumBadge label={THREAD_TYPE_LABELS[thread.threadType]} variant="cyan" />
        <PremiumBadge label={THREAD_STATUS_LABELS[thread.status]} variant="muted" />
        {thread.priority !== 'normal' ? (
          <PremiumBadge label={PRIORITY_LABELS[thread.priority]} variant="orange" />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs, paddingBottom: spacing.sm },
  title: { ...typography.h3, color: colors.textPrimary },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});
