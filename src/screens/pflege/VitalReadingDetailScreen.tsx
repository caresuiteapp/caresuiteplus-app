import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { PreparedModeBanner } from '@/components/modules/PreparedModeBanner';
import { VitalReadingDetailHero } from '@/components/pflege/VitalReadingDetailHero';
import { PflegeCrossModuleLinksPanel } from '@/components/pflege/PflegeCrossModuleLinksPanel';
import { ScreenShell } from '@/components/layout';
import {
  ErrorState,
  InfoBanner,
  LoadingState,
  PremiumButton,
  PremiumCard,
  SectionPanel,
} from '@/components/ui';
import { LockedActionBanner } from '@/components/permissions';
import { useVitalReadingDetail } from '@/hooks/useVitalReadingDetail';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/lib/auth/context';
import { VITAL_READINGS_PREPARED_MESSAGE, isVitalWriteReady, VITAL_WRITE_PREPARED_MESSAGE } from '@/lib/pflege/pflegeModuleConfig';
import { colors, spacing, typography } from '@/theme';

function SummaryRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function formatMeasuredAt(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function VitalReadingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const { isReadOnly, roleLabel } = usePermissions();
  const { data: reading, loading, error, refresh, notFound } = useVitalReadingDetail(id);

  if (loading) {
    return (
      <ScreenShell title="Vitalwert" subtitle="Wird geladen…">
        <LoadingState message="Messung wird geladen…" />
      </ScreenShell>
    );
  }

  if (notFound || error) {
    return (
      <ScreenShell title="Vitalwert" subtitle="Fehler">
        <ErrorState
          title={notFound ? 'Nicht gefunden' : 'Fehler'}
          message={error ?? 'Die Messung existiert nicht.'}
          onRetry={refresh}
        />
      </ScreenShell>
    );
  }

  if (!reading) return null;

  const writeReady = isVitalWriteReady();

  return (
    <ScreenShell title="Vitalwert" subtitle={reading.typeLabel} scroll>
      <ScrollView contentContainerStyle={styles.scroll}>
        <VitalReadingDetailHero reading={reading} roleKey={profile?.roleKey ?? 'nurse'} isReadOnly={isReadOnly} />
        <PreparedModeBanner hint={VITAL_READINGS_PREPARED_MESSAGE} />
        {!writeReady ? (
          <InfoBanner variant="warning" title="Demo-funktional" message={VITAL_WRITE_PREPARED_MESSAGE} />
        ) : null}

        {isReadOnly ? (
          <LockedActionBanner
            title="Lesemodus"
            message="Sie können Vitalwerte einsehen, aber nicht bearbeiten."
            roleLabel={roleLabel}
          />
        ) : null}

        <SectionPanel title="Aktionen" subtitle="Erfassung und Schwellenwerte (vorbereitet)">
          <PremiumButton
            title="Messung korrigieren"
            fullWidth
            disabled={!writeReady || isReadOnly}
            onPress={() => undefined}
          />
          <PremiumButton
            title="Schwellenwert setzen"
            variant="secondary"
            fullWidth
            disabled={!writeReady || isReadOnly}
            onPress={() => undefined}
          />
          <PremiumButton
            title="Pflegeplan verknüpfen"
            variant="secondary"
            fullWidth
            disabled={!writeReady || isReadOnly}
            onPress={() => undefined}
          />
        </SectionPanel>

        <SectionPanel title="Messung" subtitle="Zeitpunkt & Kontext">
          <SummaryRow label="Gemessen am" value={formatMeasuredAt(reading.measuredAt)} />
          <SummaryRow label="Klient:in" value={reading.clientName} />
          <SummaryRow label="Messart" value={reading.typeLabel} />
          {reading.carePlanId ? (
            <SummaryRow label="Pflegeplan" value={reading.carePlanId} />
          ) : null}
        </SectionPanel>

        {reading.isAlert ? (
          <PremiumCard accentColor={colors.danger}>
            <Text style={styles.hintLabel}>Hinweis</Text>
            <Text style={styles.hint}>
              Dieser Wert ist als auffällig markiert. Bitte im Pflegekontext prüfen und dokumentieren.
            </Text>
          </PremiumCard>
        ) : null}

        <PflegeCrossModuleLinksPanel context="vital-reading" />
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl, gap: spacing.md },
  row: { marginBottom: spacing.sm },
  rowLabel: { ...typography.caption, color: colors.textMuted, marginBottom: 2 },
  rowValue: { ...typography.body },
  hintLabel: { ...typography.label, color: colors.danger, marginBottom: spacing.xs },
  hint: { ...typography.body },
});
