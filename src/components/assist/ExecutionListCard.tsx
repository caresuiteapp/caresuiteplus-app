import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumCard } from '@/components/ui';
import { EXECUTION_PHASE_LABELS } from '@/lib/assist/executionListStats';
import type { ActiveExecutionItem } from '@/types/modules/assist';
import { colors, spacing, typography } from '@/theme';

type ExecutionListCardProps = {
  execution: ActiveExecutionItem;
  onPress?: () => void;
  selected?: boolean;
};

function phaseVariant(phase: ActiveExecutionItem['phase']) {
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

function formatTimeRange(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const datePart = startDate.toLocaleDateString('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  });
  const startTime = startDate.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const endTime = endDate.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${datePart} · ${startTime}–${endTime}`;
}

export function ExecutionListCard({
  execution,
  onPress,
  selected = false,
}: ExecutionListCardProps) {
  const inner = (
    <>
      <View style={styles.header}>
        <Text style={styles.title}>{execution.title}</Text>
        <PremiumBadge
          label={EXECUTION_PHASE_LABELS[execution.phase]}
          variant={phaseVariant(execution.phase)}
          dot
        />
      </View>
      <Text style={styles.meta}>{execution.clientName}</Text>
      <Text style={styles.time}>
        {formatTimeRange(execution.scheduledStart, execution.scheduledEnd)}
      </Text>
      <Text style={styles.location}>{execution.location}</Text>
    </>
  );

  if (!onPress) {
    return <PremiumCard style={styles.card}>{inner}</PremiumCard>;
  }

  return (
    <Pressable onPress={onPress}>
      <PremiumCard
        accentColor={colors.amber}
        style={[styles.card, selected ? styles.cardSelected : null]}
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
    borderColor: colors.amber,
    borderWidth: 2,
    backgroundColor: 'rgba(255,193,7,0.08)',
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
  time: {
    ...typography.caption,
    color: colors.cyan,
    marginBottom: 4,
  },
  location: {
    ...typography.caption,
  },
});
