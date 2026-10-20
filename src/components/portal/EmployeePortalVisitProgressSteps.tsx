import { StyleSheet, Text, View } from 'react-native';
import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import { employeePortalExecutionSurface, employeePortalExecutionText } from '@/lib/portal/employeePortalExecutionSurface';
import { spacing, typography } from '@/theme';
import { buildVisitProgress } from '@/lib/portal/visitProgress';

type Props = {
  status: AssignmentStatus; requiresSignature?: boolean; signatureCaptured?: boolean;
  tasksComplete?: boolean; documentationComplete?: boolean; serviceEnded?: boolean;
};

export function EmployeePortalVisitProgressSteps({
  status, requiresSignature = true, signatureCaptured = false,
  documentationComplete = false, serviceEnded = false,
}: Props) {
  const { steps, current } = buildVisitProgress({ status, requiresSignature, signatureCaptured, documentationComplete, serviceEnded });
  return (
    <View style={styles.row}>
      {steps.map((step, index) => (
        <View key={step.label} style={styles.step} accessibilityLabel={step.label + (step.done ? ': erledigt' : index === current ? ': aktueller Schritt' : ': offen')}>
          <View style={[styles.dot, step.done ? styles.done : index === current ? styles.active : null]}>
            <Text style={[styles.number, step.done ? styles.check : null]}>{step.done ? '✓' : index + 1}</Text>
          </View>
          <Text style={[styles.label, index === current ? styles.current : null]}>{step.label}</Text>
        </View>
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.xs, paddingTop: spacing.xs },
  step: { flex: 1, alignItems: 'center', gap: 3 },
  dot: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: employeePortalExecutionSurface.border },
  done: { backgroundColor: '#17834B', borderColor: '#17834B' },
  active: { backgroundColor: '#EAF4FF', borderColor: '#056CE8', borderWidth: 2 },
  number: { fontSize: 11, color: employeePortalExecutionText.primary },
  check: { color: '#FFFFFF' },
  label: { ...typography.caption, fontSize: 11, color: employeePortalExecutionText.secondary, textAlign: 'center' },
  current: { color: '#056CE8', fontWeight: '800' },
});
