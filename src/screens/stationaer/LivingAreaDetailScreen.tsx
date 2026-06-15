import { ScrollView, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { DetailInfoRow } from '@/components/detail';
import { LivingAreaDetailHero } from '@/components/stationaer';
import { ScreenShell } from '@/components/layout';
import { ErrorState, LoadingState, PremiumButton, SectionPanel } from '@/components/ui';
import { useLivingAreaDetail } from '@/hooks/useLivingAreaDetail';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/lib/auth/context';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { spacing, typography } from '@/theme';

export function LivingAreaDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const { roleLabel } = usePermissions();
  const roleKey = profile?.roleKey ?? 'nurse';
  const { data: area, loading, error, refresh, notFound } = useLivingAreaDetail(id);

  if (loading) {
    return (
      <ScreenShell title="Wohnbereich" subtitle="Wird geladen…">
        <LoadingState message="Details werden geladen…" />
      </ScreenShell>
    );
  }

  if (notFound || error) {
    return (
      <ScreenShell title="Wohnbereich" subtitle="Fehler">
        <ErrorState
          title={notFound ? 'Nicht gefunden' : 'Fehler'}
          message={error ?? 'Der Wohnbereich existiert nicht.'}
          onRetry={refresh}
        />
        <PremiumButton title="Zur Liste" variant="secondary" onPress={() => router.back()} />
      </ScreenShell>
    );
  }

  if (!area) return null;

  return (
    <ScreenShell
      title={area.name}
      subtitle={`${area.wing ?? '—'} · ${roleLabel ?? 'Demo'}`}
      rightSlot={
        <PremiumButton title="Zurück" size="sm" variant="ghost" onPress={() => router.back()} />
      }
    >
      <LivingAreaDetailHero area={area} roleKey={roleKey} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <SectionPanel title="Belegung">
          <DetailInfoRow label="Kapazität" value={String(area.capacity)} />
          <DetailInfoRow label="Belegt" value={String(area.occupiedBeds)} />
          <DetailInfoRow label="Frei" value={String(area.freeBeds)} />
          <DetailInfoRow label="Status" value={WORKFLOW_STATUS_LABELS[area.status]} />
          <DetailInfoRow label="Letzte Reinigung" value={area.lastCleaningLabel} />
        </SectionPanel>
        {area.residentNames.length > 0 ? (
          <SectionPanel title="Bewohner:innen">
            {area.residentNames.map((name) => (
              <Text key={name} style={styles.resident}>
                • {name}
              </Text>
            ))}
          </SectionPanel>
        ) : null}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl, gap: spacing.md },
  resident: { ...typography.body, marginBottom: spacing.xs },
});
