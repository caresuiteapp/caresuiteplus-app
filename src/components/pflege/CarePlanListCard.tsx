import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumButton, PremiumCard } from '@/components/ui';
import type { CarePlanListItem } from '@/types/modules/pflege';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { formatCareLevel } from '@/lib/formatters/unitFormatters';
import { storedDateLabel } from '@/lib/pflege/carePlanDailyWorklist';
import { colors, spacing, typography } from '@/theme';

type CarePlanListCardProps = {
  plan: CarePlanListItem;
  onPress?: () => void;
  onOpenMeasures?: () => void;
  selected?: boolean;
};

function statusVariant(status: CarePlanListItem['status']) {
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

function formatDateRange(from: string, until: string | null): string {
  const fromDate = storedDateLabel(from);
  return until === null ? `Gültig ab: ${fromDate} · Ohne Enddatum` : `Gültig ab: ${fromDate} · Bis: ${storedDateLabel(until)}`;
}

export function CarePlanListCard({ plan, onPress, onOpenMeasures, selected = false }: CarePlanListCardProps) {
  const inner = (
    <>
      <View style={styles.header}>
        <Text style={styles.title}>{plan.title}</Text>
        <PremiumBadge
          label={WORKFLOW_STATUS_LABELS[plan.status]}
          variant={statusVariant(plan.status)}
          dot
        />
      </View>
      <Text style={styles.meta}>
        {plan.clientName}
        {plan.careLevel ? ` · ${formatCareLevel(plan.careLevel)}` : ''}
      </Text>
      <Text style={styles.period}>{formatDateRange(plan.validFrom, plan.validUntil)}</Text>
      {plan.alertCount > 0 ? (
        <Text style={styles.alert}>{plan.alertCount === 1 ? '1 Evaluationstermin erreicht' : `${plan.alertCount} Evaluationstermine erreicht`}</Text>
      ) : null}
    </>
  );

  return (
    <PremiumCard style={[styles.card, selected ? styles.cardSelected : null]} accentColor={colors.success}>
      {inner}
      {onPress || onOpenMeasures ? <View style={styles.actions}>
        {onPress ? <PremiumButton title="Plan öffnen" accessibilityLabel={`Plan ${plan.title} öffnen`} size="sm" variant="secondary" onPress={onPress} /> : null}
        {onOpenMeasures ? <PremiumButton title="Maßnahmen" accessibilityLabel={`Maßnahmen für ${plan.title} öffnen`} size="sm" variant="ghost" onPress={onOpenMeasures} /> : null}
      </View> : null}
    </PremiumCard>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.sm,
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  cardSelected: {
    borderColor: colors.success,
    borderWidth: 2,
    backgroundColor: 'rgba(74,222,128,0.08)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: 4,
  },
  title: {
    ...typography.bodyStrong,
    flex: 1,
  },
  meta: {
    ...typography.caption,
    marginBottom: 4,
  },
  period: {
    ...typography.caption,
    color: colors.cyan,
    marginBottom: 4,
  },
  alert: {
    ...typography.caption,
    color: colors.warning,
  },
});
