import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { DetailInfoRow } from '@/components/detail';
import { LockedActionBanner } from '@/components/permissions';
import {
  ErrorState,
  LoadingState,
  PremiumBadge,
  PremiumButton,
  PremiumCard,
  SectionPanel,
} from '@/components/ui';
import { EXECUTION_PHASE_LABELS } from '@/lib/assist/executionListStats';
import { useAssignmentExecution } from '@/hooks/useAssignmentExecution';
import { usePermissions } from '@/hooks/usePermissions';
import { colors, spacing, typography } from '@/theme';

type ExecutionDetailSummaryPanelProps = {
  assignmentId: string;
};

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function phaseVariant(phase: string) {
  switch (phase) {
    case 'pending':
      return 'orange' as const;
    case 'checked_in':
    case 'in_progress':
      return 'green' as const;
    case 'completed':
      return 'cyan' as const;
    case 'cancelled':
      return 'red' as const;
    default:
      return 'muted' as const;
  }
}

export function ExecutionDetailSummaryPanel({ assignmentId }: ExecutionDetailSummaryPanelProps) {
  const router = useRouter();
  const { can, isReadOnly, roleLabel } = usePermissions();
  const canManage = can('assist.execution.manage');
  const { data: execution, loading, error, refresh } = useAssignmentExecution(assignmentId);

  if (loading) {
    return <LoadingState message="Durchführung wird geladen…" />;
  }

  if (error || !execution) {
    return (
      <View style={styles.panel}>
        <ErrorState
          title="Fehler"
          message={error ?? 'Die Durchführung konnte nicht geladen werden.'}
          onRetry={refresh}
        />
      </View>
    );
  }

  const ctaLabel =
    execution.phase === 'pending'
      ? 'Check-in starten'
      : execution.phase === 'completed'
        ? 'Abgeschlossen ansehen'
        : 'Durchführung fortsetzen';

  return (
    <View style={styles.panel}>
      <PremiumCard accentColor={colors.amber}>
        <Text style={styles.title}>Einsatz #{assignmentId.slice(-3)}</Text>
        <View style={styles.badges}>
          <PremiumBadge
            label={EXECUTION_PHASE_LABELS[execution.phase]}
            variant={phaseVariant(execution.phase)}
            dot
          />
        </View>
      </PremiumCard>

      {isReadOnly ? (
        <LockedActionBanner
          title="Lesemodus"
          message="Sie können Einsätze einsehen, aber nicht durchführen."
          roleLabel={roleLabel}
        />
      ) : null}

      <SectionPanel title="Zeiterfassung">
        <DetailInfoRow label="Check-in" value={formatDateTime(execution.checkedInAt)} />
        <DetailInfoRow label="Einsatzstart" value={formatDateTime(execution.actualStartAt)} />
        <DetailInfoRow label="Check-out" value={formatDateTime(execution.checkedOutAt)} />
        <DetailInfoRow
          label="Dauer"
          value={
            execution.durationMinutes != null
              ? `${execution.durationMinutes} Minuten`
              : '—'
          }
        />
        {execution.locationNote ? (
          <DetailInfoRow label="Vor Ort" value={execution.locationNote} />
        ) : null}
      </SectionPanel>

      {execution.activityNote ? (
        <SectionPanel title="Aktivität">
          <Text style={styles.notes}>{execution.activityNote}</Text>
        </SectionPanel>
      ) : null}

      {canManage ? (
        <PremiumButton
          title={ctaLabel}
          fullWidth
          onPress={() =>
            router.push(`/assist/assignments/${assignmentId}/execute` as never)
          }
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { flex: 1, padding: spacing.md, gap: spacing.md },
  title: { ...typography.h2, marginBottom: spacing.sm },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  notes: { ...typography.body },
});
