import { StyleSheet, Text, View } from 'react-native';
import { DetailInfoRow } from '@/components/detail';
import { LockedActionBanner } from '@/components/permissions';
import {
  ErrorState,
  LoadingState,
  PremiumBadge,
  PremiumCard,
  SectionPanel,
} from '@/components/ui';
import { useAssignmentDetail } from '@/hooks/useAssignmentDetail';
import { usePermissions } from '@/hooks/usePermissions';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { colors, spacing, typography } from '@/theme';

type AssignmentDetailSummaryPanelProps = {
  assignmentId: string;
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusVariant(status: string) {
  switch (status) {
    case 'aktiv':
      return 'green' as const;
    case 'fehlerhaft':
    case 'gesperrt':
      return 'red' as const;
    case 'in_bearbeitung':
    case 'entwurf':
      return 'orange' as const;
    default:
      return 'muted' as const;
  }
}

export function AssignmentDetailSummaryPanel({ assignmentId }: AssignmentDetailSummaryPanelProps) {
  const { isReadOnly, roleLabel } = usePermissions();
  const { data: assignment, loading, error, refresh, notFound } = useAssignmentDetail(assignmentId);

  if (loading) {
    return <LoadingState message="Einsatz wird geladen…" />;
  }

  if (notFound || error) {
    return (
      <View style={styles.panel}>
        <ErrorState
          title={notFound ? 'Nicht gefunden' : 'Fehler'}
          message={error ?? 'Der Einsatz existiert nicht.'}
          onRetry={refresh}
        />
      </View>
    );
  }

  if (!assignment) return null;

  return (
    <View style={styles.panel}>
      <PremiumCard accentColor={colors.amber}>
        <Text style={styles.title}>{assignment.title}</Text>
        <Text style={styles.participants}>
          {assignment.clientName} · {assignment.employeeName}
        </Text>
        <View style={styles.badges}>
          <PremiumBadge
            label={WORKFLOW_STATUS_LABELS[assignment.status]}
            variant={statusVariant(assignment.status)}
            dot
          />
        </View>
        {assignment.nextActionHint ? (
          <Text style={styles.hint}>{assignment.nextActionHint}</Text>
        ) : null}
      </PremiumCard>

      {isReadOnly ? (
        <LockedActionBanner
          title="Lesemodus"
          message="Sie können Einsätze einsehen, aber nicht bearbeiten."
          roleLabel={roleLabel}
        />
      ) : null}

      <SectionPanel title="Zeit & Ort">
        <DetailInfoRow label="Beginn" value={formatDateTime(assignment.scheduledStart)} />
        <DetailInfoRow label="Ende" value={formatDateTime(assignment.scheduledEnd)} />
        <DetailInfoRow label="Ort" value={assignment.location} />
      </SectionPanel>

      {assignment.notes ? (
        <SectionPanel title="Notizen">
          <Text style={styles.notes}>{assignment.notes}</Text>
        </SectionPanel>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { flex: 1, padding: spacing.md, gap: spacing.md },
  title: { ...typography.h2, marginBottom: spacing.xs },
  participants: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.sm },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  hint: { ...typography.caption, color: colors.textSecondary },
  notes: { ...typography.body },
});
