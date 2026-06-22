import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { fetchCourseDetail } from '@/lib/akademie/courseDetailService';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CourseDetailHero } from '@/components/akademie';
import { DetailInfoRow } from '@/components/detail';
import { LockedActionBanner } from '@/components/permissions';
import { ScreenShell } from '@/components/layout';
import { EmptyState, ErrorState, LoadingState, PremiumButton, PremiumInput, SectionPanel } from '@/components/ui';
import { useCourseDetail } from '@/hooks/useCourseDetail';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/lib/auth/context';
import { spacing, typography } from '@/theme';

function formatDateTime(iso: string | null): string {
  if (!iso) return 'Noch nicht geplant';
  return new Date(iso).toLocaleString('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} Minuten`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest > 0 ? `${hours} Stunden ${rest} Minuten` : `${hours} Stunden`;
}

export function CourseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const { isReadOnly, roleLabel } = usePermissions();
  const roleKey = profile?.roleKey ?? 'akademie_admin';

  const { data: course, loading, error, refresh, notFound } = useCourseDetail(id);

  if (loading) {
    return (
      <ScreenShell title="Kurs" subtitle="Wird geladen…">
        <LoadingState message="Kursdetails werden geladen…" />
      </ScreenShell>
    );
  }

  if (notFound || error) {
    return (
      <ScreenShell title="Kurs" subtitle="Fehler">
        <ErrorState
          title={notFound ? 'Nicht gefunden' : 'Fehler'}
          message={error ?? 'Der Kurs existiert nicht.'}
          onRetry={refresh}
        />
        <PremiumButton title="Zur Liste" variant="secondary" onPress={() => router.back()} />
      </ScreenShell>
    );
  }

  if (!course) return null;

  return (
    <ScreenShell
      title={course.title}
      subtitle={`${course.category} · ${roleLabel ?? 'Demo'}`}
      rightSlot={
        <PremiumButton title="Zurück" size="sm" variant="ghost" onPress={() => router.back()} />
      }
    >
      <CourseDetailHero course={course} roleKey={roleKey} isReadOnly={isReadOnly} />

      {isReadOnly ? (
        <LockedActionBanner
          title="Lesemodus"
          message="Sie können Kurse einsehen, aber nicht bearbeiten."
          roleLabel={roleLabel}
        />
      ) : null}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <SectionPanel title="Kursinformationen">
          <DetailInfoRow label="Kategorie" value={course.category} />
          <DetailInfoRow label="Dauer" value={formatDuration(course.durationMinutes)} />
          <DetailInfoRow label="Pflichtschulung" value={course.isMandatory ? 'Ja' : 'Nein'} />
          <DetailInfoRow label="Dozent:in" value={course.instructorName} />
          <DetailInfoRow label="Start" value={formatDateTime(course.startsAt)} />
          <DetailInfoRow label="Ende" value={formatDateTime(course.endsAt)} />
        </SectionPanel>

        <SectionPanel title="Teilnahme">
          <DetailInfoRow label="Einschreibungen" value={String(course.enrollmentCount)} />
          <DetailInfoRow
            label="Abschlussquote"
            value={`${course.completionRatePercent} %`}
          />
        </SectionPanel>

        {course.description ? (
          <SectionPanel title="Beschreibung">
            <Text style={styles.notes}>{course.description}</Text>
          </SectionPanel>
        ) : null}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl, gap: spacing.md },
  notes: { ...typography.body },
});
