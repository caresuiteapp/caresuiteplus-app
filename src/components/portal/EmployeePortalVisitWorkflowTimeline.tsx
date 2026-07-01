import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge } from '@/components/ui';
import {
  ASSIST_WORKFLOW_STEP_LABELS,
  assignmentStatusToWorkflowStep,
  getWorkflowTimelineSteps,
  isWorkflowStepComplete,
  type AssistWorkflowStep,
} from '@/features/assistWorkflow';
import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import { colors, spacing, typography } from '@/theme';

type EmployeePortalVisitWorkflowTimelineProps = {
  status: AssignmentStatus;
  requiresSignature?: boolean;
  signatureCaptured?: boolean;
};

const STEP_ORDER: AssistWorkflowStep[] = [
  'consent',
  'en_route',
  'arrived',
  'in_service',
  'tasks',
  'documentation',
  'signature',
  'finalize',
  'completed',
];

export function EmployeePortalVisitWorkflowTimeline({
  status,
  requiresSignature = true,
  signatureCaptured = false,
}: EmployeePortalVisitWorkflowTimelineProps) {
  const current = assignmentStatusToWorkflowStep(status);
  const steps = getWorkflowTimelineSteps(status, { requiresSignature }).filter(
    (s) => STEP_ORDER.includes(s) || s === 'no_show',
  );

  if (status === 'nicht_erschienen') {
    return (
      <View style={styles.wrap}>
        <PremiumBadge label="Nicht angetroffen" variant="orange" dot />
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      {steps.map((step) => {
        const isCurrent = step === current || (current === 'paused' && step === 'in_service');
        const done =
          step === 'signature' && signatureCaptured
            ? true
            : isWorkflowStepComplete(step, status);
        return (
          <View key={step} style={styles.row}>
            <View
              style={[
                styles.dot,
                done ? styles.dotDone : null,
                isCurrent ? styles.dotCurrent : null,
              ]}
            />
            <Text
              style={[
                styles.label,
                done ? styles.labelDone : null,
                isCurrent ? styles.labelCurrent : null,
              ]}
            >
              {ASSIST_WORKFLOW_STEP_LABELS[step]}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.textMuted,
  },
  dotDone: { backgroundColor: colors.success },
  dotCurrent: { backgroundColor: colors.amber, transform: [{ scale: 1.2 }] },
  label: { ...typography.caption, color: colors.textMuted },
  labelDone: { color: colors.textSecondary },
  labelCurrent: { ...typography.bodyStrong, color: colors.textPrimary },
});
