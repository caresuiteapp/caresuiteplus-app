import { StyleSheet, Text, View } from 'react-native';
import { useMemo } from 'react';
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
import { useAssignmentDetail } from '@/hooks/useAssignmentDetail';
import { usePermissions } from '@/hooks/usePermissions';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { colors, spacing } from '@/theme';

type AssignmentDetailSummaryPanelProps = {
  assignmentId: string;
  onOpenFullRecord?: () => void;
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

export function AssignmentDetailSummaryPanel({
  assignmentId,
  onOpenFullRecord,
}: AssignmentDetailSummaryPanelProps) {
  const router = useRouter();
  const { isReadOnly, roleLabel, can } = usePermissions();
  const { data: assignment, loading, error, refresh, notFound } = useAssignmentDetail(assignmentId);
  const { colors: themeColors, typography } = useLegacyTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        panel: { flex: 1, padding: spacing.md, gap: spacing.md },
        title: { ...typography.h2, marginBottom: spacing.xs, color: themeColors.textPrimary },
        participants: {
          ...typography.caption,
          color: themeColors.textSecondary,
          marginBottom: spacing.sm,
        },
        badges: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.xs,
          marginBottom: spacing.sm,
        },
        hint: { ...typography.caption, color: themeColors.textSecondary },
        notes: { ...typography.body, color: themeColors.textPrimary },
        actions: { gap: spacing.sm, paddingBottom: spacing.md },
      }),
    [themeColors, typography],
  );

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

  const handleOpenFull = () => {
    if (onOpenFullRecord) {
      onOpenFullRecord();
      return;
    }
    router.push(`/assist/assignments/${assignment.id}` as never);
  };

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

      <View style={styles.actions}>
        <PremiumButton title="Vollständigen Einsatz öffnen" fullWidth onPress={handleOpenFull} />
        {can('assist.execution.view') ? (
          <PremiumButton
            title="Einsatz durchführen"
            variant="secondary"
            fullWidth
            onPress={() => router.push(`/assist/assignments/${assignment.id}/execute` as never)}
          />
        ) : null}
      </View>
    </View>
  );
}
