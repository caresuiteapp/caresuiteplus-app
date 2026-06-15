import { ScrollView, StyleSheet, Text } from 'react-native';
import { fetchCounselingCaseDetail } from '@/lib/beratung/caseDetailService';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CaseDetailHero } from '@/components/beratung';
import { DetailInfoRow } from '@/components/detail';
import { LockedActionBanner } from '@/components/permissions';
import { CareLightPageShell } from '@/components/layout';
import { EmptyState, ErrorState, LoadingState, PremiumButton, PremiumInput, SectionPanel } from '@/components/ui';
import { useCounselingCaseDetail } from '@/hooks/useCounselingCaseDetail';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/lib/auth/context';
import { spacing, typography } from '@/theme';

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function CaseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const { isReadOnly, roleLabel } = usePermissions();
  const roleKey = profile?.roleKey ?? 'counselor';

  const { data: counselingCase, loading, error, refresh, notFound } = useCounselingCaseDetail(id);

  if (loading) {
    return (
      <CareLightPageShell title="Beratungsfall" subtitle="Wird geladen…">
        <LoadingState message="Falldetails werden geladen…" />
      </CareLightPageShell>
    );
  }

  if (notFound || error) {
    return (
      <CareLightPageShell title="Beratungsfall" subtitle="Fehler">
        <ErrorState
          title={notFound ? 'Nicht gefunden' : 'Fehler'}
          message={error ?? 'Der Beratungsfall existiert nicht.'}
          onRetry={refresh}
        />
        <PremiumButton title="Zur Liste" variant="secondary" onPress={() => router.back()} />
      </CareLightPageShell>
    );
  }

  if (!counselingCase) return null;

  return (
    <CareLightPageShell
      title={counselingCase.subject}
      subtitle={`${counselingCase.clientName} · ${roleLabel ?? 'Demo'}`}
      rightSlot={
        <PremiumButton title="Zurück" size="sm" variant="ghost" onPress={() => router.back()} />
      }
    >
      <CaseDetailHero
        counselingCase={counselingCase}
        roleKey={roleKey}
        isReadOnly={isReadOnly}
      />

      {isReadOnly ? (
        <LockedActionBanner
          title="Lesemodus"
          message="Sie können Fälle einsehen, aber nicht bearbeiten."
          roleLabel={roleLabel}
        />
      ) : null}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <SectionPanel title="Fallinformationen">
          <DetailInfoRow label="Kategorie" value={counselingCase.category} />
          <DetailInfoRow label="Eröffnet" value={formatDateTime(counselingCase.openedAt)} />
          {counselingCase.closedAt ? (
            <DetailInfoRow label="Abgeschlossen" value={formatDateTime(counselingCase.closedAt)} />
          ) : null}
          {counselingCase.nextAppointmentAt ? (
            <DetailInfoRow
              label="Nächster Termin"
              value={formatDateTime(counselingCase.nextAppointmentAt)}
            />
          ) : null}
        </SectionPanel>

        <SectionPanel title="Beteiligte">
          <DetailInfoRow label="Klient:in" value={counselingCase.clientName} />
          <DetailInfoRow label="Berater:in" value={counselingCase.counselorName} />
        </SectionPanel>

        {counselingCase.summary ? (
          <SectionPanel title="Zusammenfassung">
            <Text style={styles.notes}>{counselingCase.summary}</Text>
          </SectionPanel>
        ) : null}
      </ScrollView>
    </CareLightPageShell>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl, gap: spacing.md },
  notes: { ...typography.body },
});
