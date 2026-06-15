import { ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { DetailInfoRow } from '@/components/detail';
import { EnrollmentDetailHero } from '@/components/akademie';
import { ScreenShell } from '@/components/layout';
import { ErrorState, LoadingState, PremiumButton, SectionPanel } from '@/components/ui';
import { useEnrollmentDetail } from '@/hooks/useEnrollmentDetail';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/lib/auth/context';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { spacing } from '@/theme';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE');
}

export function EnrollmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const { roleLabel } = usePermissions();
  const roleKey = profile?.roleKey ?? 'akademie_admin';
  const { data: enrollment, loading, error, refresh, notFound } = useEnrollmentDetail(id);

  if (loading) {
    return (
      <ScreenShell title="Teilnahme" subtitle="Wird geladen…">
        <LoadingState message="Details werden geladen…" />
      </ScreenShell>
    );
  }

  if (notFound || error) {
    return (
      <ScreenShell title="Teilnahme" subtitle="Fehler">
        <ErrorState
          title={notFound ? 'Nicht gefunden' : 'Fehler'}
          message={error ?? 'Die Teilnahme existiert nicht.'}
          onRetry={refresh}
        />
        <PremiumButton title="Zur Liste" variant="secondary" onPress={() => router.back()} />
      </ScreenShell>
    );
  }

  if (!enrollment) return null;

  return (
    <ScreenShell
      title={enrollment.participantName}
      subtitle={`${enrollment.courseTitle} · ${roleLabel ?? 'Demo'}`}
      rightSlot={
        <PremiumButton title="Zurück" size="sm" variant="ghost" onPress={() => router.back()} />
      }
    >
      <EnrollmentDetailHero enrollment={enrollment} roleKey={roleKey} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <SectionPanel title="Teilnahme">
          <DetailInfoRow label="Kurs" value={enrollment.courseTitle} />
          <DetailInfoRow label="Dozent:in" value={enrollment.instructorName} />
          <DetailInfoRow label="Eingeschrieben" value={formatDate(enrollment.enrolledAt)} />
          <DetailInfoRow label="Fortschritt" value={`${enrollment.progressPercent} %`} />
          <DetailInfoRow label="Lektionen" value={String(enrollment.lessonCount)} />
          <DetailInfoRow label="Status" value={WORKFLOW_STATUS_LABELS[enrollment.status]} />
          {enrollment.completedAt ? (
            <DetailInfoRow label="Abgeschlossen" value={formatDate(enrollment.completedAt)} />
          ) : null}
        </SectionPanel>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl, gap: spacing.md },
});
