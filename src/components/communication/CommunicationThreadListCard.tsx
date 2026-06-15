import { Pressable, StyleSheet } from 'react-native';
import { PremiumCard } from '@/components/ui';
import { ConversationListItem } from './ConversationListItem';
import type { ThreadListItem } from '@/features/communication/communication.types';
import { colors, spacing } from '@/theme';

type CommunicationThreadListCardProps = {
  thread: ThreadListItem;
  onPress?: () => void;
  selected?: boolean;
};

export function CommunicationThreadListCard({
  thread,
  onPress,
  selected = false,
}: CommunicationThreadListCardProps) {
  const inner = <ConversationListItem item={thread} />;

  if (!onPress) {
    return <PremiumCard style={styles.card}>{inner}</PremiumCard>;
  }

  return (
    <Pressable onPress={onPress}>
      <PremiumCard
        accentColor={thread.unreadCountBusiness > 0 ? colors.cyan : undefined}
        style={[styles.card, selected ? styles.cardSelected : null]}
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
    borderColor: colors.cyan,
    borderWidth: 2,
    backgroundColor: 'rgba(98,243,255,0.08)',
  },
});
