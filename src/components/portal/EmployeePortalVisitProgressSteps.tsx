import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  assignmentStatusToWorkflowStep,
  isWorkflowStepComplete,
} from '@/features/assistWorkflow';
import { auroraGlass, useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import { colors, spacing, typography } from '@/theme';

type EmployeePortalVisitProgressStepsProps = {
  status: AssignmentStatus;
  requiresSignature?: boolean;
  signatureCaptured?: boolean;
};

const PROGRESS_STEPS = [
  { key: 'start', label: 'Start', match: ['consent', 'en_route', 'arrived', 'in_service', 'paused'] },
  { key: 'tasks', label: 'Aufgaben', match: ['in_service', 'paused', 'tasks'] },
  { key: 'documentation', label: 'Doku', match: ['documentation'] },
  { key: 'signature', label: 'Unterschrift', match: ['signature'] },
  { key: 'finalize', label: 'Abschluss', match: ['finalize', 'completed'] },
] as const;

function stepDone(
  stepKey: string,
  status: AssignmentStatus,
  requiresSignature: boolean,
  signatureCaptured: boolean,
): boolean {
  if (stepKey === 'start') {
    return ['angekommen', 'gestartet', 'pausiert', 'beendet', 'dokumentation_offen', 'unterschrift_offen', 'abgeschlossen'].includes(
      status,
    );
  }
  if (stepKey === 'tasks') {
    return ['beendet', 'dokumentation_offen', 'unterschrift_offen', 'abgeschlossen'].includes(status);
  }
  if (stepKey === 'documentation') {
    return ['dokumentation_offen', 'unterschrift_offen', 'abgeschlossen'].includes(status) ||
      isWorkflowStepComplete('documentation', status);
  }
  if (stepKey === 'signature') {
    if (!requiresSignature) return true;
    return signatureCaptured || status === 'abgeschlossen';
  }
  if (stepKey === 'finalize') {
    return status === 'abgeschlossen';
  }
  return false;
}

function stepActive(
  stepKey: string,
  currentStep: ReturnType<typeof assignmentStatusToWorkflowStep>,
  status: AssignmentStatus,
  requiresSignature: boolean,
): boolean {
  if (stepKey === 'start') {
    return ['consent', 'en_route', 'arrived', 'in_service', 'paused'].includes(currentStep) ||
      ['geplant', 'bestaetigt', 'unterwegs', 'angekommen', 'gestartet', 'pausiert'].includes(status);
  }
  if (stepKey === 'tasks') {
    return currentStep === 'in_service' || currentStep === 'paused' || currentStep === 'tasks' ||
      status === 'gestartet' || status === 'pausiert';
  }
  if (stepKey === 'documentation') {
    return currentStep === 'documentation' || status === 'beendet' || status === 'dokumentation_offen';
  }
  if (stepKey === 'signature') {
    if (!requiresSignature) return false;
    return currentStep === 'signature' || status === 'unterschrift_offen';
  }
  if (stepKey === 'finalize') {
    return currentStep === 'finalize';
  }
  return false;
}

export function EmployeePortalVisitProgressSteps({
  status,
  requiresSignature = true,
  signatureCaptured = false,
}: EmployeePortalVisitProgressStepsProps) {
  const text = useAuroraAdaptiveText();
  const current = assignmentStatusToWorkflowStep(status);

  const visibleSteps = PROGRESS_STEPS.filter(
    (step) => step.key !== 'signature' || requiresSignature,
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
          marginTop: spacing.xs,
        },
        step: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
        dot: {
          width: 18,
          height: 18,
          borderRadius: 9,
          borderWidth: 1,
          borderColor: auroraGlass.innerBorder,
          alignItems: 'center',
          justifyContent: 'center',
        },
        dotDone: { backgroundColor: colors.success, borderColor: colors.success },
        dotActive: { borderColor: colors.amber, backgroundColor: 'rgba(255, 149, 0, 0.15)' },
        check: { ...typography.caption, color: '#fff', fontSize: 10, fontWeight: '700' },
        label: { ...typography.caption, color: text.muted, fontSize: 11 },
        labelActive: { color: text.primary, fontWeight: '600' },
        labelDone: { color: text.secondary },
        arrow: { ...typography.caption, color: text.muted, fontSize: 10 },
      }),
    [text],
  );

  return (
    <View style={styles.row}>
      {visibleSteps.map((step, index) => {
        const done = stepDone(step.key, status, requiresSignature, signatureCaptured);
        const active = !done && stepActive(step.key, current, status, requiresSignature);
        return (
          <View key={step.key} style={styles.step}>
            {index > 0 ? <Text style={styles.arrow}>→</Text> : null}
            <View style={[styles.dot, done ? styles.dotDone : null, active ? styles.dotActive : null]}>
              {done ? <Text style={styles.check}>✓</Text> : null}
            </View>
            <Text
              style={[
                styles.label,
                done ? styles.labelDone : null,
                active ? styles.labelActive : null,
              ]}
              numberOfLines={1}
            >
              {step.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
