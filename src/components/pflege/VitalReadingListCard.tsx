import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumCard } from '@/components/ui';
import type { VitalReadingListItem } from '@/types/modules/pflege';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { colors, spacing, typography } from '@/theme';

type VitalReadingListCardProps = {
  reading: VitalReadingListItem;
  onPress?: () => void;
  selected?: boolean;
};

function statusVariant(status: VitalReadingListItem['status']) {
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

function formatMeasuredAt(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function accentForReading(reading: VitalReadingListItem) {
  if (reading.isAlert) return colors.danger;
  if (reading.isDue) return colors.warning;
  return colors.success;
}

export function VitalReadingListCard({
  reading,
  onPress,
  selected = false,
}: VitalReadingListCardProps) {
  const inner = (
    <>
      <View style={styles.header}>
        <Text style={styles.type}>{reading.typeLabel}</Text>
        <PremiumBadge
          label={WORKFLOW_STATUS_LABELS[reading.status]}
          variant={statusVariant(reading.status)}
          dot
        />
      </View>
      <Text style={styles.value}>
        {reading.value} {reading.unit}
      </Text>
      <Text style={styles.meta}>{reading.clientName}</Text>
      <Text style={styles.time}>{formatMeasuredAt(reading.measuredAt)}</Text>
      {reading.isDue ? <Text style={styles.hint}>Messung fällig</Text> : null}
      {reading.isAlert ? <Text style={styles.alert}>Auffälliger Wert</Text> : null}
    </>
  );

  if (!onPress) {
    return (
      <PremiumCard style={styles.card} accentColor={accentForReading(reading)}>
        {inner}
      </PremiumCard>
    );
  }

  return (
    <Pressable onPress={onPress}>
      <PremiumCard
        style={[styles.card, selected ? styles.cardSelected : null]}
        accentColor={accentForReading(reading)}
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
  type: {
    ...typography.bodyStrong,
    flex: 1,
  },
  value: {
    ...typography.h3,
    marginBottom: 4,
  },
  meta: {
    ...typography.caption,
    marginBottom: 4,
  },
  time: {
    ...typography.caption,
    color: colors.cyan,
  },
  hint: {
    ...typography.caption,
    color: colors.warning,
    marginTop: 4,
  },
  alert: {
    ...typography.caption,
    color: colors.danger,
    marginTop: 2,
  },
});
