import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { DetailInfoRow } from '@/components/detail';
import { LockedActionBanner } from '@/components/permissions';
import {
  ErrorState,
  LoadingState,
  PremiumBadge,
  PremiumButton,
  PremiumCard,
  SectionPanel,
} from '@/components/ui';
import { useCourseDetail } from '@/hooks/useCourseDetail';
import { usePermissions } from '@/hooks/usePermissions';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { colors, spacing, typography } from '@/theme';

type CourseDetailSummaryPanelProps = {
  courseId: string;
};

function statusVariant(status: string) {
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
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function CourseDetailSummaryPanel({ courseId }: CourseDetailSummaryPanelProps) {
  const router = useRouter();
  const { isReadOnly, roleLabel } = usePermissions();
  const { data: course, loading, error, refresh, notFound } = useCourseDetail(courseId);

  if (loading) {
    return <LoadingState message="Kurs wird geladen…" />;
  }

  if (notFound || error) {
    return (
      <View style={styles.panel}>
        <ErrorState
          title={notFound ? 'Nicht gefunden' : 'Fehler'}
          message={error ?? 'Der Kurs existiert nicht.'}
          onRetry={refresh}
        />
      </View>
    );
  }

  if (!course) return null;

  return (
    <View style={styles.panel}>
      <PremiumCard accentColor={colors.amber}>
        <Text style={styles.title}>{course.title}</Text>
        <Text style={styles.category}>{course.category}</Text>
        <View style={styles.badges}>
          <PremiumBadge
            label={WORKFLOW_STATUS_LABELS[course.status]}
            variant={statusVariant(course.status)}
            dot
          />
          {course.isMandatory ? <PremiumBadge label="Pflichtkurs" variant="orange" /> : null}
        </View>
        <Text style={styles.hint}>{course.nextActionHint}</Text>
      </PremiumCard>

      {isReadOnly ? (
        <LockedActionBanner
          title="Lesemodus"
          message="Sie können Kurse einsehen, aber nicht bearbeiten."
          roleLabel={roleLabel}
        />
      ) : null}

      <SectionPanel title="Details">
        <DetailInfoRow label="Dauer" value={formatDuration(course.durationMinutes)} />
        <DetailInfoRow label="Dozent:in" value={course.instructorName} />
        <DetailInfoRow label="Start" value={formatDate(course.startsAt)} />
        <DetailInfoRow label="Teilnehmende" value={String(course.enrollmentCount)} />
        <DetailInfoRow label="Abschlussquote" value={`${course.completionRatePercent} %`} />
      </SectionPanel>

      {course.description ? (
        <SectionPanel title="Beschreibung">
          <Text style={styles.description} numberOfLines={4}>
            {course.description}
          </Text>
        </SectionPanel>
      ) : null}

      <PremiumButton
        title="Vollständigen Kurs öffnen"
        fullWidth
        onPress={() => router.push(`/akademie/courses/${courseId}` as never)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { flex: 1, padding: spacing.md, gap: spacing.md },
  title: { ...typography.h2, marginBottom: spacing.xs },
  category: { ...typography.caption, color: colors.amber, marginBottom: spacing.sm },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  hint: { ...typography.caption, color: colors.textMuted },
  description: { ...typography.body },
});
