import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumCard } from '@/components/ui';
import type { AppointmentListItem } from '@/types/modules/appointmentList';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { colors, spacing, typography } from '@/theme';

type AppointmentListCardProps = {
  appointment: AppointmentListItem;
  onPress?: () => void;
  selected?: boolean;
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

function statusVariant(status: AppointmentListItem['status']) {
  switch (status) {
    case 'aktiv':
      return 'green' as const;
    case 'in_bearbeitung':
    case 'entwurf':
      return 'orange' as const;
    default:
      return 'muted' as const;
  }
}

export function AppointmentListCard({
  appointment,
  onPress,
  selected = false,
}: AppointmentListCardProps) {
  const inner = (
    <View style={styles.row}>
      <View style={styles.main}>
        <Text style={styles.title}>{appointment.title}</Text>
        <Text style={styles.meta}>{appointment.clientName}</Text>
        {appointment.employeeName ? (
          <Text style={styles.meta}>Mitarbeitende:r: {appointment.employeeName}</Text>
        ) : null}
        <Text style={styles.datetime}>{formatDateTime(appointment.startsAt)}</Text>
        {appointment.location ? <Text style={styles.location}>{appointment.location}</Text> : null}
      </View>
      <PremiumBadge
        label={WORKFLOW_STATUS_LABELS[appointment.status]}
        variant={statusVariant(appointment.status)}
        dot
      />
    </View>
  );

  if (!onPress) {
    return (
      <PremiumCard accentColor={colors.violet} style={styles.card}>
        {inner}
      </PremiumCard>
    );
  }

  return (
    <Pressable onPress={onPress}>
      <PremiumCard
        accentColor={colors.violet}
        style={[styles.card, selected ? styles.cardSelected : null]}
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
    borderColor: colors.violet,
    borderWidth: 2,
    backgroundColor: 'rgba(167,139,250,0.08)',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  main: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...typography.bodyStrong,
  },
  meta: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  datetime: {
    ...typography.body,
    marginTop: spacing.xs,
  },
  location: {
    ...typography.caption,
    marginTop: 2,
  },
});
