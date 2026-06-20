import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useMemo } from 'react';
import { PremiumBadge, PremiumCard } from '@/components/ui';
import { VisitDispositionBadgeRow } from '@/components/assist/VisitDispositionBadge';
import type { AssignmentListItem } from '@/types/modules/assist';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import {
  VISIT_BILLING_STATUS_LABELS,
  VISIT_PLANNING_STATUS_LABELS,
  VISIT_PROOF_STATUS_LABELS,
  type VisitBillingStatus,
  type VisitPlanningStatus,
  type VisitProofStatus,
} from '@/lib/assist/visitTypes';
import { formatAssignmentSchedule } from '@/lib/formatters/dateTimeFormatters';
import { auroraGlass, useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { moduleColor } from '@/design/tokens/modules';
import { spacing, typography } from '@/theme';

type AssignmentListCardProps = {
  assignment: AssignmentListItem;
  onPress?: () => void;
  selected?: boolean;
};

function statusVariant(status: AssignmentListItem['status']) {
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

export function AssignmentListCard({ assignment, onPress, selected = false }: AssignmentListCardProps) {
  const text = useAuroraAdaptiveText();
  const accent = moduleColor('assist');
  const planning = (assignment.planningStatus as VisitPlanningStatus) ?? 'scheduled';
  const proof = (assignment.proofStatus as VisitProofStatus) ?? 'none';
  const billing = (assignment.billingStatus as VisitBillingStatus) ?? 'none';

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: { marginBottom: spacing.sm, backgroundColor: auroraGlass.card },
        cardSelected: {
          borderColor: accent,
          borderWidth: 2,
          backgroundColor: auroraGlass.rowSelected,
        },
        header: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: spacing.sm,
          marginBottom: 4,
        },
        title: { ...typography.bodyStrong, flex: 1, color: text.primary },
        service: { ...typography.caption, color: text.secondary, marginBottom: 2 },
        meta: { ...typography.caption, marginBottom: 4, color: text.secondary },
        time: { ...typography.caption, color: accent, marginBottom: 4 },
        location: { ...typography.caption, color: text.muted },
        openHint: { ...typography.caption, color: text.muted, marginTop: spacing.xs },
      }),
    [text, accent],
  );

  const inner = (
    <>
      <Text style={styles.time}>
        {formatAssignmentSchedule(assignment.scheduledStart, assignment.scheduledEnd, {
          planningStatusLabel: VISIT_PLANNING_STATUS_LABELS[planning],
          durationMinutes: assignment.durationMinutes,
        })}
      </Text>
      <Text style={styles.meta}>{assignment.clientName}</Text>
      <Text style={styles.meta}>{assignment.employeeName}</Text>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{assignment.serviceName ?? assignment.title}</Text>
          {assignment.serviceName && assignment.serviceName !== assignment.title ? (
            <Text style={styles.service}>{assignment.title}</Text>
          ) : null}
        </View>
        <PremiumBadge
          label={WORKFLOW_STATUS_LABELS[assignment.status]}
          variant={statusVariant(assignment.status)}
          dot
        />
      </View>
      <Text style={styles.location}>{assignment.location}</Text>
      <VisitDispositionBadgeRow
        planningLabel={VISIT_PLANNING_STATUS_LABELS[planning] ?? planning}
        proofLabel={VISIT_PROOF_STATUS_LABELS[proof] ?? proof}
        budgetLabel={VISIT_BILLING_STATUS_LABELS[billing] ?? billing}
        isAtRisk={assignment.isAtRisk}
        isIncomplete={assignment.isIncomplete}
      />
      {onPress ? <Text style={styles.openHint}>Öffnen →</Text> : null}
    </>
  );

  if (!onPress) {
    return <PremiumCard style={styles.card}>{inner}</PremiumCard>;
  }

  return (
    <Pressable onPress={onPress}>
      <PremiumCard
        accentColor={accent}
        style={[styles.card, selected ? styles.cardSelected : null]}
        onPress={onPress}
      >
        {inner}
      </PremiumCard>
    </Pressable>
  );
}
