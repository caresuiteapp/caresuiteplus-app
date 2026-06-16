import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumCard } from '@/components/ui';
import { formatCareLevel } from '@/lib/formatters/unitFormatters';
import type { CarePlanListItem } from '@/types/modules/pflege';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { colors, spacing, typography } from '@/theme';

type CarePlanListCardProps = {
  plan: CarePlanListItem;
  onPress?: () => void;
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
  const fromDate = new Date(from).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  if (!until) return `ab ${fromDate}`;
  const untilDate = new Date(until).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  return `${fromDate} – ${untilDate}`;
}

export function CarePlanListCard({ plan, onPress, selected = false }: CarePlanListCardProps) {
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
        <Text style={styles.alert}>{plan.alertCount} Aufgabe(n) mit Hinweis</Text>
      ) : null}
    </>
  );

  if (!onPress) {
    return <PremiumCard style={styles.card}>{inner}</PremiumCard>;
  }

  return (
    <Pressable onPress={onPress}>
      <PremiumCard
        style={[styles.card, selected ? styles.cardSelected : null]}
        accentColor={colors.success}
        onPress={onPress}
      >
        {inner}
      </PremiumCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.sm,
  },
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
