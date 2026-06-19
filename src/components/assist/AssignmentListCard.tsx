import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useMemo } from 'react';
import { PremiumBadge, PremiumCard } from '@/components/ui';
import type { AssignmentListItem } from '@/types/modules/assist';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { spacing } from '@/theme';

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

export function AssignmentListCard({ assignment, onPress, selected = false }: AssignmentListCardProps) {
  const { colors, typography } = useLegacyTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
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
          color: colors.textPrimary,
        },
        meta: {
          ...typography.caption,
          marginBottom: 4,
          color: colors.textSecondary,
        },
        time: {
          ...typography.caption,
          color: colors.cyan,
          marginBottom: 4,
        },
        location: {
          ...typography.caption,
          color: colors.textMuted,
        },
      }),
    [colors, typography],
  );

  const inner = (
    <>
      <View style={styles.header}>
        <Text style={styles.title}>{assignment.title}</Text>
        <PremiumBadge
          label={WORKFLOW_STATUS_LABELS[assignment.status]}
          variant={statusVariant(assignment.status)}
          dot
        />
      </View>
      <Text style={styles.meta}>
        {assignment.clientName} · {assignment.employeeName}
      </Text>
      <Text style={styles.time}>{formatTimeRange(assignment.scheduledStart, assignment.scheduledEnd)}</Text>
      <Text style={styles.location}>{assignment.location}</Text>
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
        onPress={onPress}
      >
        {inner}
      </PremiumCard>
    </Pressable>
  );
}

