import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { EmployeePortalVisitCompactCard } from '@/components/portal/EmployeePortalVisitCompactCard';
import { countDoneTasks } from '@/lib/portal/groupEmployeePortalTasks';
import { employeePortalExecutionText } from '@/lib/portal/employeePortalExecutionSurface';
import type { EmployeePortalTaskItem } from '@/types/modules/employeePortalExecution';
import { spacing, typography } from '@/theme';

type EmployeePortalVisitLiveDashboardProps = {
  tasks: EmployeePortalTaskItem[];
  documentationStatus: 'none' | 'draft' | 'submitted' | 'locked';
  documentationLastSavedAt?: string | null;
  signatureCaptured: boolean;
  requiresSignature: boolean;
  signatureEnabled?: boolean;
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
  signatureEnabled = true,
  serviceSeconds,
  attachmentCount = 0,
  onOpenTasks,
  onOpenDocumentation,
  onOpenSignature,
  onOpenAttachments,
}: EmployeePortalVisitLiveDashboardProps) {
  const text = employeePortalExecutionText;
  const done = countDoneTasks(tasks);
  const { width } = useWindowDimensions();
  const compact = width < 720;

  return (
    <View style={styles.wrap}>
      <View style={styles.timerBlock}>
        <View>
          <Text style={styles.liveBadge}>●  LIVE</Text>
          <Text style={[styles.timerLabel, { color: text.muted }]}>Einsatzzeit</Text>
        </View>
        <Text style={[styles.timerValue, { color: text.primary }]}>{formatTimer(serviceSeconds)}</Text>
      </View>
      <View style={[styles.cardGrid, compact ? styles.cardGridCompact : null]}>
      <EmployeePortalVisitCompactCard
        icon="✓"
        title={`${done} von ${tasks.length}`}
        status="Aufgaben erledigt"
        onPress={onOpenTasks}
        testID="portal-open-tasks"
      />
      <EmployeePortalVisitCompactCard
        icon="▤"
        title="Dokumentation"
        status={documentationStatusLabel(documentationStatus, documentationLastSavedAt)}
        onPress={onOpenDocumentation}
        testID="portal-open-documentation"
      />
      {requiresSignature ? (
        <EmployeePortalVisitCompactCard
          icon="✎"
          title="Unterschrift"
          status={signatureCaptured ? 'Gespeichert' : signatureEnabled ? 'Noch offen' : 'Nach Einsatzende'}
          onPress={onOpenSignature}
          disabled={!signatureEnabled}
          testID="portal-open-signature"
        />
      ) : null}
      </View>
      {onOpenAttachments && attachmentCount > 0 ? (
        <EmployeePortalVisitCompactCard
          icon="◉"
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
  wrap: { gap: spacing.md },
  timerBlock: {
    minHeight: 136, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.md,
    borderRadius: 22, borderWidth: 1, borderColor: 'rgba(15, 143, 138, 0.20)',
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  liveBadge: { ...typography.bodyStrong, color: '#EF4444', marginBottom: spacing.xs },
  timerLabel: { ...typography.caption },
  timerValue: { fontSize: 46, fontWeight: '800', letterSpacing: 1.5, fontVariant: ['tabular-nums'] },
  cardGrid: { flexDirection: 'row', gap: spacing.sm },
  cardGridCompact: { flexDirection: 'column' },
});
