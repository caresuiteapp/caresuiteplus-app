import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumButton, SuccessState } from '@/components/ui';
import { countDoneTasks } from '@/lib/portal/groupEmployeePortalTasks';
import { employeePortalExecutionText } from '@/lib/portal/employeePortalExecutionSurface';
import type { EmployeePortalAssignmentDetail } from '@/types/modules/employeePortalExecution';
import { spacing, typography } from '@/theme';

type EmployeePortalVisitSummaryPanelProps = {
  visit: EmployeePortalAssignmentDetail;
  onBack: () => void;
};

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(start: string | null, end: string | null): string {
  if (!start || !end) return '—';
  const mins = Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60_000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0) return `${h} Std. ${m} Min.`;
  return `${m} Min.`;
}

export function EmployeePortalVisitSummaryPanel({
  visit,
  onBack,
}: EmployeePortalVisitSummaryPanelProps) {
  const text = employeePortalExecutionText;
  const tasksDone = countDoneTasks(visit.tasks);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: { gap: spacing.md, paddingVertical: spacing.sm },
        title: { ...typography.h3, color: text.primary },
        row: { ...typography.body, color: text.secondary },
        label: { ...typography.caption, color: text.muted },
      }),
    [text],
  );

  return (
    <View style={styles.wrap}>
      <SuccessState message="Einsatz abgeschlossen" />
      <Text style={styles.title}>{visit.clientName}</Text>
      <Text style={styles.label}>Datum & Zeit</Text>
      <Text style={styles.row}>
        {formatDateTime(visit.actualStartAt ?? visit.plannedStartAt)} –{' '}
        {formatDateTime(visit.actualEndAt ?? visit.plannedEndAt)}
      </Text>
      <Text style={styles.label}>Dauer</Text>
      <Text style={styles.row}>
        {formatDuration(visit.actualStartAt, visit.actualEndAt)}
      </Text>
      <Text style={styles.label}>Aufgaben</Text>
      <Text style={styles.row}>
        {tasksDone} / {visit.tasks.length} erledigt
      </Text>
      <Text style={styles.label}>Dokumentation</Text>
      <Text style={styles.row}>
        {visit.documentationStatus === 'submitted' || visit.documentationStatus === 'locked'
          ? 'Gespeichert'
          : '—'}
      </Text>
      <Text style={styles.label}>Unterschrift</Text>
      <Text style={styles.row}>
        {visit.signatureStatus === 'captured' || visit.signatureStatus === 'locked'
          ? 'Gespeichert'
          : visit.requiresSignature
            ? 'Nicht erfasst'
            : 'Nicht erforderlich'}
      </Text>
      <Text style={styles.row}>Leistungsnachweis erstellt</Text>
      <PremiumButton title="Zurück zur Übersicht" fullWidth onPress={onBack} />
    </View>
  );
}
