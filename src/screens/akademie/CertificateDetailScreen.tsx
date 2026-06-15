import { ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { DetailInfoRow } from '@/components/detail';
import { CertificateDetailHero } from '@/components/akademie';
import { ScreenShell } from '@/components/layout';
import { ErrorState, LoadingState, PremiumButton, SectionPanel } from '@/components/ui';
import { useCertificateDetail } from '@/hooks/useCertificateDetail';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/lib/auth/context';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { spacing } from '@/theme';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE');
}

export function CertificateDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const { roleLabel } = usePermissions();
  const roleKey = profile?.roleKey ?? 'akademie_admin';
  const { data: certificate, loading, error, refresh, notFound } = useCertificateDetail(id);

  if (loading) {
    return (
      <ScreenShell title="Zertifikat" subtitle="Wird geladen…">
        <LoadingState message="Details werden geladen…" />
      </ScreenShell>
    );
  }

  if (notFound || error) {
    return (
      <ScreenShell title="Zertifikat" subtitle="Fehler">
        <ErrorState
          title={notFound ? 'Nicht gefunden' : 'Fehler'}
          message={error ?? 'Das Zertifikat existiert nicht.'}
          onRetry={refresh}
        />
        <PremiumButton title="Zur Liste" variant="secondary" onPress={() => router.back()} />
      </ScreenShell>
    );
  }

  if (!certificate) return null;

  return (
    <ScreenShell
      title={certificate.participantName}
      subtitle={`${certificate.courseTitle} · ${roleLabel ?? 'Demo'}`}
      rightSlot={
        <PremiumButton title="Zurück" size="sm" variant="ghost" onPress={() => router.back()} />
      }
    >
      <CertificateDetailHero certificate={certificate} roleKey={roleKey} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <SectionPanel title="Zertifikat">
          <DetailInfoRow label="Nummer" value={certificate.certificateNumber} />
          <DetailInfoRow label="Kurs" value={certificate.courseTitle} />
          <DetailInfoRow label="Teilnehmer:in" value={certificate.participantName} />
          <DetailInfoRow label="Aussteller" value={certificate.issuerName} />
          <DetailInfoRow label="Ausgestellt" value={formatDate(certificate.issuedAt)} />
          <DetailInfoRow
            label="Gültig bis"
            value={certificate.expiresAt ? formatDate(certificate.expiresAt) : 'unbegrenzt'}
          />
          <DetailInfoRow label="Status" value={WORKFLOW_STATUS_LABELS[certificate.status]} />
        </SectionPanel>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl, gap: spacing.md },
});
