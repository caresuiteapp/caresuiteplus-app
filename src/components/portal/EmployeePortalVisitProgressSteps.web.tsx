import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import { buildVisitProgress } from '@/lib/portal/visitProgress';
import { webScaledFontMetric as font } from '@/design/web/webFontSize';

type Props = { status: AssignmentStatus; requiresSignature?: boolean; signatureCaptured?: boolean; tasksComplete?: boolean; documentationComplete?: boolean; serviceEnded?: boolean };
export function EmployeePortalVisitProgressSteps({ status, requiresSignature = true, signatureCaptured = false, documentationComplete = false, serviceEnded = false }: Props) {
  const [width, setWidth] = useState(0);
  const { steps, current } = buildVisitProgress({ status, requiresSignature, signatureCaptured, documentationComplete, serviceEnded });
  const compact = width > 0 && width < 620;
  const summary = current >= 0 ? `Schritt ${current + 1} von ${steps.length} · ${steps[current].label}` : status === 'abgeschlossen' ? 'Einsatz abgeschlossen' : 'Einsatz nicht fortsetzbar';
  return <View style={styles.root} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
    {compact ? <Text style={styles.summary}>{summary}</Text> : null}
    <View style={styles.row} accessibilityLabel={summary}>
      {steps.map((step, index) => <View key={step.label} style={styles.step} accessibilityLabel={`${step.label}: ${step.done ? 'erledigt' : index === current ? 'aktueller Schritt' : 'offen'}`}>
        <View style={[styles.dot, step.done && styles.done, index === current && styles.active]}><Text style={[styles.number, step.done && styles.check]}>{step.done ? '✓' : index + 1}</Text></View>
        {!compact ? <Text style={[styles.label, index === current && styles.current]}>{step.label}</Text> : null}
      </View>)}
    </View>
  </View>;
}
const styles = StyleSheet.create({
  root: { minWidth: 0, gap: 6, paddingTop: 4 },
  summary: { fontSize: font(14), lineHeight: font(19), fontWeight: '700', color: '#075DC7' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  step: { flex: 1, minWidth: 0, alignItems: 'center', gap: 4 },
  dot: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#B5CEE8', flexShrink: 0 },
  done: { backgroundColor: '#17834B', borderColor: '#17834B' },
  active: { backgroundColor: '#EAF4FF', borderColor: '#056CE8', borderWidth: 2 },
  number: { fontSize: 14, lineHeight: 18, color: '#102D4E' },
  check: { color: '#FFFFFF' },
  label: { fontSize: font(13), lineHeight: font(17), color: '#365672', textAlign: 'center' },
  current: { color: '#075DC7', fontWeight: '800' },
});
