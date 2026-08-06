import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';
import { CARESUITE_VISIT_GUIDE_MASCOT } from '@/components/brand/brandassets';
import {
  assignmentStatusToWorkflowStep,
  isWorkflowStepComplete,
} from '@/features/assistWorkflow';
import {
  employeePortalExecutionSurface,
  employeePortalExecutionText,
} from '@/lib/portal/employeePortalExecutionSurface';
import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import { colors, spacing, typography } from '@/theme';

type EmployeePortalVisitProgressStepsProps = {
  status: AssignmentStatus;
  requiresSignature?: boolean;
  signatureCaptured?: boolean;
  tasksComplete?: boolean;
  documentationComplete?: boolean;
  serviceEnded?: boolean;
};

const PROGRESS_STEPS = [
  { key: 'start', label: 'Start', match: ['consent', 'en_route', 'arrived', 'in_service', 'paused'] },
  { key: 'tasks', label: 'Aufgaben', match: ['in_service', 'paused', 'tasks'] },
  { key: 'documentation', label: 'Doku', match: ['documentation'] },
  { key: 'signature', label: 'Signatur', match: ['signature'] },
  { key: 'finalize', label: 'Abschluss', match: ['finalize', 'completed'] },
] as const;

function stepDone(
  stepKey: string,
  status: AssignmentStatus,
  requiresSignature: boolean,
  signatureCaptured: boolean,
  tasksComplete: boolean,
  documentationComplete: boolean,
): boolean {
  if (stepKey === 'start') {
    return ['angekommen', 'gestartet', 'pausiert', 'beendet', 'dokumentation_offen', 'unterschrift_offen', 'abgeschlossen'].includes(
      status,
    );
  }
  if (stepKey === 'tasks') {
    return tasksComplete || ['beendet', 'dokumentation_offen', 'unterschrift_offen', 'abgeschlossen'].includes(status);
  }
  if (stepKey === 'documentation') {
    return documentationComplete || ['unterschrift_offen', 'abgeschlossen'].includes(status) ||
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
  signatureCaptured: boolean,
  tasksComplete: boolean,
  documentationComplete: boolean,
  serviceEnded: boolean,
): boolean {
  if (stepKey === 'start') {
    return ['consent', 'en_route', 'arrived', 'in_service', 'paused'].includes(currentStep) ||
      ['geplant', 'bestaetigt', 'unterwegs', 'angekommen', 'gestartet', 'pausiert'].includes(status);
  }
  if (stepKey === 'tasks') {
    return !tasksComplete && (
      currentStep === 'in_service' || currentStep === 'paused' || currentStep === 'tasks' ||
      status === 'gestartet' || status === 'pausiert'
    );
  }
  if (stepKey === 'documentation') {
    return !documentationComplete && (
      tasksComplete || currentStep === 'documentation' || status === 'beendet' || status === 'dokumentation_offen'
    );
  }
  if (stepKey === 'signature') {
    if (!requiresSignature) return false;
    return !signatureCaptured && (
      (serviceEnded && documentationComplete) ||
      currentStep === 'signature' ||
      status === 'unterschrift_offen'
    );
  }
  if (stepKey === 'finalize') {
    return (
      serviceEnded &&
      documentationComplete &&
      (!requiresSignature || signatureCaptured)
    ) || currentStep === 'finalize';
  }
  return false;
}

export function EmployeePortalVisitProgressSteps({
  status,
  requiresSignature = true,
  signatureCaptured = false,
  tasksComplete = false,
  documentationComplete = false,
  serviceEnded = false,
}: EmployeePortalVisitProgressStepsProps) {
  const text = employeePortalExecutionText;
  const current = assignmentStatusToWorkflowStep(status);
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 850,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 850,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  const visibleSteps = PROGRESS_STEPS.filter(
    (step) => step.key !== 'signature' || requiresSignature,
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between', gap: 2, marginTop: spacing.sm, paddingTop: spacing.sm,
          borderTopWidth: 1, borderTopColor: employeePortalExecutionSurface.border,
        },
        step: { alignItems: 'center', gap: 5, flex: 1, minWidth: 0 },
        employee: {
          position: 'absolute',
          top: -28,
          zIndex: 3,
          width: 34,
          height: 34,
          alignItems: 'center',
          justifyContent: 'center',
        },
        employeeImage: { width: '100%', height: '100%' },
        dot: {
          width: 28,
          height: 28,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: employeePortalExecutionSurface.borderStrong,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: employeePortalExecutionSurface.subtleBackground,
        },
        dotDone: { backgroundColor: colors.success, borderColor: colors.success },
        dotActive: { borderColor: colors.amber, backgroundColor: 'rgba(255, 149, 0, 0.15)' },
        check: { ...typography.caption, color: '#fff', fontSize: 10, fontWeight: '700' },
        label: { ...typography.caption, color: text.muted, fontSize: 11, minHeight: 28, textAlign: 'center' },
        labelActive: { color: text.primary, fontWeight: '600' },
        labelDone: { color: text.secondary },
        connector: { position: 'absolute', top: 14, left: '-50%', right: '50%', height: 2, backgroundColor: employeePortalExecutionSurface.borderStrong },
        connectorDone: { backgroundColor: colors.success },
      }),
    [text],
  );

  return (
    <View style={styles.row}>
      {visibleSteps.map((step, index) => {
        const done = stepDone(
          step.key,
          status,
          requiresSignature,
          signatureCaptured,
          tasksComplete,
          documentationComplete,
        );
        const active = !done && stepActive(
          step.key,
          current,
          status,
          requiresSignature,
          signatureCaptured,
          tasksComplete,
          documentationComplete,
          serviceEnded,
        );
        const guideActive =
          active || (step.key === 'documentation' && documentationComplete && !serviceEnded);
        return (
          <View key={step.key} style={styles.step}>
            {index > 0 ? <View style={[styles.connector, done ? styles.connectorDone : null]} /> : null}
            {guideActive ? (
              <Animated.View
                accessibilityLabel={`Aktueller Schritt: ${step.label}`}
                style={[
                  styles.employee,
                  {
                    transform: [
                      { translateY: pulse.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }) },
                      { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) },
                    ],
                  },
                ]}
              >
                <Image
                  source={CARESUITE_VISIT_GUIDE_MASCOT}
                  resizeMode="contain"
                  style={styles.employeeImage}
                />
              </Animated.View>
            ) : null}
            <Animated.View
              style={[
                styles.dot,
                done ? styles.dotDone : null,
                active ? styles.dotActive : null,
                active
                  ? { transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) }] }
                  : null,
              ]}
            >
              {done ? <Text style={styles.check}>✓</Text> : null}
            </Animated.View>
            <Text
              style={[
                styles.label,
                done ? styles.labelDone : null,
                guideActive ? styles.labelActive : null,
              ]}
              numberOfLines={2}
            >
              {step.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
