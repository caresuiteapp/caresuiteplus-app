import { StyleSheet, Text, View } from 'react-native';
import { useMemo } from 'react';
import { PlatformModal } from '@/components/layout/platform/platformmodal';
import { PremiumButton } from '@/components/ui';
import type { AssignmentListItem } from '@/types/modules/assist';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import {
  formatAssignmentTimeRange,
  formatAssignmentWeekdayDate,
} from '@/lib/formatters/dateTimeFormatters';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { spacing, typography } from '@/theme';

export type AssignmentMobileAction = {
  key: string;
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
};

type AssignmentMobileActionSheetProps = {
  visible: boolean;
  assignment: AssignmentListItem | null;
  onClose: () => void;
  actions: AssignmentMobileAction[];
};

/** iOS/Android-style bottom sheet for assignment quick actions on mobile. */
export function AssignmentMobileActionSheet({
  visible,
  assignment,
  onClose,
  actions,
}: AssignmentMobileActionSheetProps) {
  const text = useAuroraAdaptiveText();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        summary: { gap: 4, marginBottom: spacing.sm },
        title: { ...typography.bodyStrong, color: text.primary },
        meta: { ...typography.caption, color: text.secondary },
        actions: { gap: spacing.xs },
        actionBtn: { width: '100%' },
      }),
    [text.primary, text.secondary],
  );

  if (!assignment) return null;

  return (
    <PlatformModal
      visible={visible}
      title={assignment.clientName}
      subtitle={`${WORKFLOW_STATUS_LABELS[assignment.status]} · ${formatAssignmentWeekdayDate(assignment.scheduledStart)}`}
      onClose={onClose}
      variant="bottomSheet"
      animationType="slide"
    >
      <View style={styles.summary}>
        <Text style={styles.title}>{assignment.serviceName ?? assignment.title}</Text>
        <Text style={styles.meta}>
          {formatAssignmentTimeRange(assignment.scheduledStart, assignment.scheduledEnd)}
        </Text>
        <Text style={styles.meta}>{assignment.employeeName}</Text>
        <Text style={styles.meta}>{assignment.location}</Text>
      </View>
      <View style={styles.actions}>
        {actions.map((action) => (
          <PremiumButton
            key={action.key}
            title={action.label}
            variant={action.variant ?? 'secondary'}
            fullWidth
            onPress={() => {
              onClose();
              action.onPress();
            }}
            style={styles.actionBtn}
          />
        ))}
      </View>
    </PlatformModal>
  );
}
