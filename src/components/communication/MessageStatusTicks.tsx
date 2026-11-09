import { StyleSheet, Text } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, typography } from '@/theme';
import type { MessageStatus } from '@/features/communication/communication.types';
import { MESSAGE_STATUS_LABELS } from '@/features/communication/communication.constants';
import { employeePortalDesign as employeeInk } from '@/components/portal/employee/employeePortalDesign';

type MessageStatusTicksProps = { status: MessageStatus; appearance?: 'employee' };

export function MessageStatusTicks({ status, appearance }: MessageStatusTicksProps) {
  if (appearance === 'employee') {
    const icon = status === 'read' || status === 'delivered' ? 'checkmark-done'
      : status === 'sent' ? 'checkmark'
      : status === 'failed' ? 'alert-circle-outline' : 'time-outline';
    const ink = status === 'read' ? employeeInk.accent : status === 'failed' ? employeeInk.danger : employeeInk.muted;
    return <Ionicons name={icon} size={17} color={ink} accessibilityLabel={MESSAGE_STATUS_LABELS[status]} />;
  }
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
