import { StyleSheet, Text, View } from 'react-native';
import type { KIMMessageStatus } from '@/types/modules/ti';
import { KIM_MESSAGE_STATUS_LABELS } from '@/types/modules/ti';
import { colors, radius, spacing, typography } from '@/theme';

const STATUS_COLORS: Record<KIMMessageStatus, string> = {
  unread: colors.cyan,
  read: colors.textMuted,
  archived: colors.violet,
  error: colors.error,
};

type Props = {
  status: KIMMessageStatus;
};

export function KIMMessageStatusBadge({ status }: Props) {
  return (
    <View style={[styles.badge, { borderColor: STATUS_COLORS[status] }]}>
      <Text style={[styles.text, { color: STATUS_COLORS[status] }]}>
        {KIM_MESSAGE_STATUS_LABELS[status]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  text: { ...typography.caption, fontWeight: '600' },
});
