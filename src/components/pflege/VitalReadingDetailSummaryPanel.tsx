import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ErrorState,
  LoadingState,
  PremiumBadge,
  PremiumButton,
  PremiumCard,
  SectionPanel,
} from '@/components/ui';
import { LockedActionBanner } from '@/components/permissions';
import { useVitalReadingDetail } from '@/hooks/useVitalReadingDetail';
import { usePermissions } from '@/hooks/usePermissions';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { colors, spacing, typography } from '@/theme';

type VitalReadingDetailSummaryPanelProps = {
  readingId: string;
};

function SummaryRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

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

export function VitalReadingDetailSummaryPanel({ readingId }: VitalReadingDetailSummaryPanelProps) {
  const router = useRouter();
  const { isReadOnly, roleLabel } = usePermissions();
  const { data: reading, loading, error, refresh, notFound } = useVitalReadingDetail(readingId);

  if (loading) {
    return <LoadingState message="Messung wird geladen…" />;
  }

  if (notFound || error) {
    return (
      <View style={styles.panel}>
        <ErrorState
          title={notFound ? 'Nicht gefunden' : 'Fehler'}
          message={error ?? 'Die Messung existiert nicht.'}
          onRetry={refresh}
        />
      </View>
    );
  }

  if (!reading) return null;

  const accent = reading.isAlert ? colors.danger : reading.isDue ? colors.warning : colors.success;

  return (
    <View style={styles.panel}>
      <PremiumCard accentColor={accent}>
        <Text style={styles.type}>{reading.typeLabel}</Text>
        <Text style={styles.value}>
          {reading.value} {reading.unit}
        </Text>
        <View style={styles.badgeRow}>
          <PremiumBadge
            label={WORKFLOW_STATUS_LABELS[reading.status]}
            variant={statusVariant(reading.status)}
            dot
          />
          {reading.isDue ? <PremiumBadge label="Fällig" variant="orange" /> : null}
          {reading.isAlert ? <PremiumBadge label="Auffällig" variant="red" /> : null}
        </View>
        <Text style={styles.client}>{reading.clientName}</Text>
      </PremiumCard>

      {isReadOnly ? (
        <LockedActionBanner
          title="Lesemodus"
          message="Sie können Vitalwerte einsehen, aber nicht bearbeiten."
          roleLabel={roleLabel}
        />
      ) : null}

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

      <View style={styles.actions}>
        <PremiumButton
          title="Vollständige Messung öffnen"
          variant="primary"
          fullWidth
          onPress={() => router.push(`/pflege/vitalwerte/${reading.id}` as never)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { flex: 1, padding: spacing.md, gap: spacing.md },
  type: { ...typography.label, color: colors.cyan, marginBottom: spacing.xs },
  value: { ...typography.h2, marginBottom: spacing.sm },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.xs },
  client: { ...typography.caption, color: colors.textMuted },
  row: { marginBottom: spacing.sm },
  rowLabel: { ...typography.caption, color: colors.textMuted, marginBottom: 2 },
  rowValue: { ...typography.body },
  hintLabel: { ...typography.label, color: colors.danger, marginBottom: spacing.xs },
  hint: { ...typography.body },
  actions: { gap: spacing.sm, paddingBottom: spacing.xl },
});
