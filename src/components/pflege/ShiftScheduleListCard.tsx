import { StyleSheet, Text, View } from 'react-native';
import type { ShiftScheduleListItem } from '@/lib/pflege/shiftScheduleDemo';
import { PremiumBadge, PremiumCard } from '@/components/ui';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { colors, spacing, typography } from '@/theme';

type ShiftScheduleListCardProps = {
  item: ShiftScheduleListItem;
};

function statusVariant(status: ShiftScheduleListItem['status']) {
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

export function ShiftScheduleListCard({ item }: ShiftScheduleListCardProps) {
  return (
    <PremiumCard style={styles.card} accentColor={colors.violet}>
      <View style={styles.header}>
        <Text style={styles.title}>{item.employeeName}</Text>
        <PremiumBadge label={WORKFLOW_STATUS_LABELS[item.status]} variant={statusVariant(item.status)} dot />
      </View>
      <Text style={styles.role}>{item.roleLabel}</Text>
      <Text style={styles.meta}>
        {new Date(item.shiftDate).toLocaleDateString('de-DE', {
          weekday: 'short',
          day: '2-digit',
          month: '2-digit',
        })}{' '}
        · {item.startTime}–{item.endTime}
      </Text>
      <Text style={styles.location}>{item.location}</Text>
    </PremiumCard>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.sm },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  title: { ...typography.h3, flex: 1, marginRight: spacing.sm },
  role: { ...typography.bodyStrong, marginBottom: 4 },
  meta: { ...typography.caption, color: colors.cyan, marginBottom: 2 },
  location: { ...typography.caption, color: colors.textMuted },
});
