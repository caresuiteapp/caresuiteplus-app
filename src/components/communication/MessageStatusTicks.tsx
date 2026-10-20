import { StyleSheet, Text } from 'react-native';
import { colors, typography } from '@/theme';
import type { MessageStatus } from '@/features/communication/communication.types';
import { MESSAGE_STATUS_LABELS } from '@/features/communication/communication.constants';

type MessageStatusTicksProps = { status: MessageStatus };

export function MessageStatusTicks({ status }: MessageStatusTicksProps) {
  const tick = status === 'read' ? '✓✓' : status === 'delivered' || status === 'sent' ? '✓' : '…';
  return (
    <Text
      style={[styles.ticks, status === 'read' && styles.read, status === 'failed' && styles.failed]}
      accessibilityLabel={MESSAGE_STATUS_LABELS[status]}
    >
      {status === 'failed' ? '!' : tick}
    </Text>
  );
}

const styles = StyleSheet.create({
  ticks: { ...typography.caption, color: colors.textMuted },
  read: { color: colors.cyan },
  failed: { color: colors.danger },
});
