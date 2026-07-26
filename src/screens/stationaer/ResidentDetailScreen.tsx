import { ScrollView, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { DetailInfoRow } from '@/components/detail';
import { InactiveModuleBanner, ResidentDetailHero } from '@/components/stationaer';
import { ScreenShell } from '@/components/layout';
import { ErrorState, LoadingState, PremiumButton, SectionPanel } from '@/components/ui';
import { useResidentDetail } from '@/hooks/useResidentDetail';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/lib/auth/context';
import { spacing, typography } from '@/theme';
import { formatCareLevel } from '@/lib/formatters/unitFormatters';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function ResidentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const { roleLabel } = usePermissions();
  const roleKey = profile?.roleKey ?? 'nurse';

  const { data: resident, loading, error, refresh, notFound } = useResidentDetail(id);

  if (loading) {
    return (
      <ScreenShell title="Bewohner:in" subtitle="Wird geladen…">
        <LoadingState message="Details werden geladen…" />
      </ScreenShell>
    );
  }

  if (notFound || error) {
    return (
      <ScreenShell title="Bewohner:in" subtitle="Fehler">
        <ErrorState
          title={notFound ? 'Nicht gefunden' : 'Fehler'}
          message={error ?? 'Die Bewohner:in existiert nicht.'}
          onRetry={refresh}
        />
        <PremiumButton title="Zur Liste" variant="secondary" onPress={() => router.back()} />
      </ScreenShell>
    );
  }

  if (!resident) return null;

  const fullName = `${resident.firstName} ${resident.lastName}`;

  return (
    <ScreenShell
      title={fullName}
      subtitle={`${resident.roomName} · ${roleLabel ?? 'Demo'}`}
      rightSlot={
        <PremiumButton title="Zurück" size="sm" variant="ghost" onPress={() => router.back()} />
      }
    >
      <InactiveModuleBanner productKey="stationaer" />

      <ResidentDetailHero resident={resident} roleKey={roleKey} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <SectionPanel
          title="Klinische 3D-Dokumentation"
          subtitle="Befunde, Wunden, Dekubitus, Fotos und Verlauf"
        >
          <Text style={styles.clinicalText}>
            Öffnet die vollständige bewohnerbezogene 3D-Bodymap mit allen 18
            Körpervarianten und dauerhaft verankerten gelben Befundpunkten.
          </Text>
          <PremiumButton
            title="3D-Bodymap öffnen"
            onPress={() =>
              router.push(`/stationaer/bewohner/${resident.id}/bodymap` as never)
            }
          />
        </SectionPanel>

        <SectionPanel title="Aufenthalt">
          <DetailInfoRow label="Zimmer" value={resident.roomName} />
          {resident.wing ? <DetailInfoRow label="Bereich" value={resident.wing} /> : null}
          <DetailInfoRow label="Aufnahme" value={formatDate(resident.admissionDate)} />
          {resident.careLevel ? (
            <DetailInfoRow label="Pflegegrad" value={formatCareLevel(resident.careLevel)} />
          ) : null}
        </SectionPanel>

        {resident.notes ? (
          <SectionPanel title="Notizen">
            <Text style={styles.notes}>{resident.notes}</Text>
          </SectionPanel>
        ) : null}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl, gap: spacing.md },
  notes: { ...typography.body },
  clinicalText: { ...typography.body, marginBottom: spacing.sm },
});
