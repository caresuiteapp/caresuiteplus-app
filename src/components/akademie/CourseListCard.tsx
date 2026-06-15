import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumCard } from '@/components/ui';
import type { CourseListItem } from '@/types/modules/akademie';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { colors, spacing, typography } from '@/theme';

type CourseListCardProps = {
  course: CourseListItem;
  onPress?: () => void;
  selected?: boolean;
};

function statusVariant(status: CourseListItem['status']) {
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

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} Min.`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest > 0 ? `${hours} Std. ${rest} Min.` : `${hours} Std.`;
}

function formatDate(iso: string | null): string {
  if (!iso) return 'Termin offen';
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function CourseListCard({ course, onPress, selected = false }: CourseListCardProps) {
  const inner = (
    <>
      <View style={styles.header}>
        <Text style={styles.title}>{course.title}</Text>
        <PremiumBadge
          label={WORKFLOW_STATUS_LABELS[course.status]}
          variant={statusVariant(course.status)}
          dot
        />
      </View>
      <Text style={styles.meta}>
        {course.category} · {formatDuration(course.durationMinutes)}
        {course.isMandatory ? ' · Pflicht' : ''}
      </Text>
      <Text style={styles.enrollment}>{course.enrollmentCount} Teilnehmende</Text>
      <Text style={styles.date}>Start: {formatDate(course.startsAt)}</Text>
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
  card: { marginBottom: spacing.sm },
  cardSelected: {
    borderColor: colors.amber,
    borderWidth: 2,
    backgroundColor: 'rgba(255,209,102,0.08)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: 4,
  },
  title: { ...typography.bodyStrong, flex: 1 },
  meta: { ...typography.caption, marginBottom: 4 },
  enrollment: { ...typography.caption, color: colors.amber, marginBottom: 4 },
  date: { ...typography.caption },
});
