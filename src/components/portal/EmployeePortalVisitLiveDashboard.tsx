import { StyleSheet, Text, View } from 'react-native';
import { EmployeePortalVisitCompactCard } from '@/components/portal/EmployeePortalVisitCompactCard';
import { countDoneTasks } from '@/lib/portal/groupEmployeePortalTasks';
import type { EmployeePortalTaskItem } from '@/types/modules/employeePortalExecution';
import { colors, spacing, typography } from '@/theme';

type EmployeePortalVisitLiveDashboardProps = {
  tasks: EmployeePortalTaskItem[];
  documentationStatus: 'none' | 'draft' | 'submitted' | 'locked';
  documentationLastSavedAt?: string | null;
  signatureCaptured: boolean;
  requiresSignature: boolean;
  serviceSeconds: number | null;
  attachmentCount?: number;
  onOpenTasks: () => void;
  onOpenDocumentation: () => void;
  onOpenSignature: () => void;
  onOpenAttachments?: () => void;
};

function formatTimer(seconds: number | null): string {
  if (seconds == null) return '00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function documentationStatusLabel(
  status: EmployeePortalVisitLiveDashboardProps['documentationStatus'],
  lastSavedAt?: string | null,
): string {
  if (status === 'submitted' || status === 'locked') {
    return lastSavedAt
      ? `Gespeichert · zuletzt ${new Date(lastSavedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`
      : 'Gespeichert';
  }
  if (status === 'draft') return 'Begonnen';
  return 'Offen';
}

export function EmployeePortalVisitLiveDashboard({
  tasks,
  documentationStatus,
  documentationLastSavedAt,
  signatureCaptured,
  requiresSignature,
  serviceSeconds,
  attachmentCount = 0,
  onOpenTasks,
  onOpenDocumentation,
  onOpenSignature,
  onOpenAttachments,
}: EmployeePortalVisitLiveDashboardProps) {
  const done = countDoneTasks(tasks);

  return (
    <View style={styles.wrap}>
      <View style={styles.timerBlock}>
        <Text style={styles.timerLabel}>Einsatzzeit</Text>
        <Text style={styles.timerValue}>{formatTimer(serviceSeconds)}</Text>
      </View>
      <EmployeePortalVisitCompactCard
        title="Aufgaben"
        status={`${done} / ${tasks.length} erledigt`}
        onPress={onOpenTasks}
        testID="portal-open-tasks"
      />
      <EmployeePortalVisitCompactCard
        title="Dokumentation"
        status={documentationStatusLabel(documentationStatus, documentationLastSavedAt)}
        onPress={onOpenDocumentation}
        testID="portal-open-documentation"
      />
      {requiresSignature ? (
        <EmployeePortalVisitCompactCard
          title="Unterschrift"
          status={signatureCaptured ? 'Gespeichert' : 'Noch offen'}
          onPress={onOpenSignature}
          testID="portal-open-signature"
        />
      ) : null}
      {onOpenAttachments ? (
        <EmployeePortalVisitCompactCard
          title="Fotos / Anhänge"
          status={attachmentCount > 0 ? `${attachmentCount} gespeichert` : 'Optional'}
          onPress={onOpenAttachments}
          testID="portal-open-attachments"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  timerBlock: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.xs,
  },
  timerLabel: { ...typography.caption, color: colors.textMuted },
  timerValue: { fontSize: 42, fontWeight: '700', color: colors.textPrimary, letterSpacing: 1 },
});
