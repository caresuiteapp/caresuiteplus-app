import { ScrollView, StyleSheet, Text } from 'react-native';
import { fetchResidentDetail } from '@/lib/stationaer/residentDetailService';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { DetailInfoRow } from '@/components/detail';
import { InactiveModuleBanner, ResidentDetailHero } from '@/components/stationaer';
import { CareLightPageShell } from '@/components/layout';
import { EmptyState, ErrorState, LoadingState, PremiumButton, PremiumInput, SectionPanel } from '@/components/ui';
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
      <CareLightPageShell title="Bewohner:in" subtitle="Wird geladen…">
        <LoadingState message="Details werden geladen…" />
      </CareLightPageShell>
    );
  }

  if (notFound || error) {
    return (
      <CareLightPageShell title="Bewohner:in" subtitle="Fehler">
        <ErrorState
          title={notFound ? 'Nicht gefunden' : 'Fehler'}
          message={error ?? 'Die Bewohner:in existiert nicht.'}
          onRetry={refresh}
        />
        <PremiumButton title="Zur Liste" variant="secondary" onPress={() => router.back()} />
      </CareLightPageShell>
    );
  }

  if (!resident) return null;

  const fullName = `${resident.firstName} ${resident.lastName}`;

  return (
    <CareLightPageShell
      title={fullName}
      subtitle={`${resident.roomName} · ${roleLabel ?? 'Demo'}`}
      rightSlot={
        <PremiumButton title="Zurück" size="sm" variant="ghost" onPress={() => router.back()} />
      }
    >
      <InactiveModuleBanner productKey="stationaer" />

      <ResidentDetailHero resident={resident} roleKey={roleKey} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
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
    </CareLightPageShell>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl, gap: spacing.md },
  notes: { ...typography.body },
});
