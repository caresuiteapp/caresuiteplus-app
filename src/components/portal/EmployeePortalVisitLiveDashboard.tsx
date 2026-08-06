import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { EmployeePortalVisitCompactCard } from '@/components/portal/EmployeePortalVisitCompactCard';
import { countDoneTasks } from '@/lib/portal/groupEmployeePortalTasks';
import {
  employeePortalExecutionSurface,
  employeePortalExecutionText,
} from '@/lib/portal/employeePortalExecutionSurface';
import type { EmployeePortalTaskItem } from '@/types/modules/employeePortalExecution';
import { spacing, typography } from '@/theme';

type EmployeePortalVisitLiveDashboardProps = {
  tasks: EmployeePortalTaskItem[];
  documentationStatus: 'none' | 'draft' | 'submitted' | 'locked';
  documentationLastSavedAt?: string | null;
  signatureCaptured: boolean;
  signatureConfirmationPending?: boolean;
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
  if (seconds == null) return '00:00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
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
  signatureConfirmationPending = false,
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
  const compact = width < 900;

  return (
    <View style={styles.wrap}>
      <View style={[styles.timerBlock, compact ? styles.timerBlockCompact : null]}>
        <View>
          <Text style={styles.liveBadge}>●  LIVE</Text>
          <Text style={[styles.timerLabel, { color: text.muted }]}>Einsatzzeit</Text>
        </View>
        <Text style={[styles.timerValue, compact ? styles.timerValueCompact : null, { color: text.primary }]}>
          {formatTimer(serviceSeconds)}
        </Text>
      </View>
      <View style={[styles.cardGrid, compact ? styles.cardGridCompact : null]}>
        <View style={styles.cardCell}>
          <EmployeePortalVisitCompactCard
            icon="✓"
            title={`${done} von ${tasks.length}`}
            status="Aufgaben erledigt"
            onPress={onOpenTasks}
            testID="portal-open-tasks"
          />
        </View>
        <View style={styles.cardCell}>
          <EmployeePortalVisitCompactCard
            icon="▤"
            title="Dokumentation"
            status={documentationStatusLabel(documentationStatus, documentationLastSavedAt)}
            onPress={onOpenDocumentation}
            testID="portal-open-documentation"
          />
        </View>
        {requiresSignature ? (
          <View style={styles.cardCell}>
            <EmployeePortalVisitCompactCard
              icon="✎"
              title="Unterschrift"
              status={
                signatureConfirmationPending
                  ? 'Unterschrift wird gerade geprüft – bitte warten'
                  : signatureCaptured
                    ? 'Gespeichert'
                    : signatureEnabled
                      ? 'Noch offen'
                      : 'Nach Einsatzende'
              }
              subtitle={
                signatureConfirmationPending
                  ? 'Der Serverabgleich läuft automatisch. Bitte nicht erneut tippen.'
                  : undefined
              }
              onPress={signatureConfirmationPending ? undefined : onOpenSignature}
              disabled={signatureConfirmationPending || !signatureEnabled}
              pending={signatureConfirmationPending}
              testID="portal-open-signature"
            />
          </View>
        ) : null}
        {onOpenAttachments ? (
          <View style={styles.cardCell}>
            <EmployeePortalVisitCompactCard
              icon="▣"
              title="Foto & Video"
              status={attachmentCount > 0 ? `${attachmentCount} intern gespeichert` : 'Jetzt hinzufügen'}
              subtitle="Gut sichtbar im Einsatz – nicht im Leistungsnachweis"
              accentColor="#8B5CF6"
              onPress={onOpenAttachments}
              testID="portal-open-attachments"
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  timerBlock: {
    minHeight: 136, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.md,
    borderRadius: 22, borderWidth: 1, borderColor: employeePortalExecutionSurface.borderStrong,
    backgroundColor: employeePortalExecutionSurface.subtleBackground,
  },
  timerBlockCompact: { flexDirection: 'column', alignItems: 'stretch' },
  liveBadge: { ...typography.bodyStrong, color: '#EF4444', marginBottom: spacing.xs },
  timerLabel: { ...typography.caption },
  timerValue: { fontSize: 46, fontWeight: '800', letterSpacing: 1.5, fontVariant: ['tabular-nums'] },
  timerValueCompact: { width: '100%', fontSize: 38, lineHeight: 46 },
  cardGrid: { flexDirection: 'row', gap: spacing.sm },
  cardGridCompact: { flexDirection: 'column' },
  cardCell: { flex: 1, minWidth: 0, width: '100%' },
});
