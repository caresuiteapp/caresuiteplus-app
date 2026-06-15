import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumCard } from '@/components/ui';
import { PURPOSE_LABELS } from '@/lib/assist';
import type { TripLogListItem } from '@/types/modules/assist';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { colors, spacing, typography } from '@/theme';

type TripListCardProps = {
  trip: TripLogListItem;
  onPress?: () => void;
  selected?: boolean;
};

function statusVariant(status: TripLogListItem['status']) {
  switch (status) {
    case 'in_bearbeitung':
      return 'green' as const;
    case 'abgeschlossen':
      return 'cyan' as const;
    case 'fehlerhaft':
    case 'gesperrt':
      return 'red' as const;
    case 'aktiv':
    case 'entwurf':
      return 'orange' as const;
    default:
      return 'muted' as const;
  }
}

function formatStartedAt(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function TripListCard({ trip, onPress, selected = false }: TripListCardProps) {
  const inner = (
    <>
      <View style={styles.header}>
        <Text style={styles.title}>{trip.employeeName}</Text>
        <PremiumBadge
          label={WORKFLOW_STATUS_LABELS[trip.status]}
          variant={statusVariant(trip.status)}
          dot
        />
      </View>
      <Text style={styles.meta}>{PURPOSE_LABELS[trip.purpose]} · {trip.vehicleLabel}</Text>
      <Text style={styles.route} numberOfLines={2}>
        {trip.routeSummary}
      </Text>
      <View style={styles.footer}>
        <Text style={styles.time}>{formatStartedAt(trip.startedAt)}</Text>
        {trip.distanceKm != null ? (
          <Text style={styles.distance}>{trip.distanceKm} km</Text>
        ) : null}
      </View>
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
  route: {
    ...typography.caption,
    marginBottom: 4,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  time: {
    ...typography.caption,
    color: colors.cyan,
  },
  distance: {
    ...typography.caption,
    color: colors.textMuted,
  },
});
