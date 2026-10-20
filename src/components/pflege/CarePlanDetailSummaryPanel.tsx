import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumBadge,
  PremiumButton,
  PremiumCard,
  SectionPanel,
} from '@/components/ui';
import { LockedActionBanner } from '@/components/permissions';
import { useCarePlanDetail } from '@/hooks/useCarePlanDetail';
import { usePermissions } from '@/hooks/usePermissions';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { formatCareLevel } from '@/lib/formatters/unitFormatters';
import { colors, spacing, typography } from '@/theme';

type CarePlanDetailSummaryPanelProps = {
  planId: string;
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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function CarePlanDetailSummaryPanel({ planId }: CarePlanDetailSummaryPanelProps) {
  const router = useRouter();
  const { isReadOnly, roleLabel } = usePermissions();
  const { data: plan, loading, error, refresh, notFound } = useCarePlanDetail(planId);

  if (loading) {
    return <LoadingState message="Pflegeplan wird geladen…" />;
  }

  if (notFound || error) {
    return (
      <View style={styles.panel}>
        <ErrorState
          title={notFound ? 'Nicht gefunden' : 'Fehler'}
          message={error ?? 'Der Datensatz existiert nicht.'}
          onRetry={refresh}
        />
      </View>
    );
  }

  if (!plan) return null;

  return (
    <View style={styles.panel}>
      <PremiumCard accentColor={colors.success}>
        <Text style={styles.title}>{plan.title}</Text>
        <View style={styles.badgeRow}>
          <PremiumBadge
            label={WORKFLOW_STATUS_LABELS[plan.status]}
            variant={statusVariant(plan.status)}
            dot
          />
          {plan.careLevel ? <PremiumBadge label={formatCareLevel(plan.careLevel)} variant="cyan" /> : null}
        </View>
        <Text style={styles.client}>{plan.clientName}</Text>
      </PremiumCard>

      {isReadOnly ? (
        <LockedActionBanner
          title="Lesemodus"
          message="Sie können Pflegepläne einsehen, aber nicht bearbeiten."
          roleLabel={roleLabel}
        />
      ) : null}

      <SectionPanel title="Planung" subtitle="Gültigkeit & Team">
        <SummaryRow label="Gültig ab" value={formatDate(plan.validFrom)} />
        <SummaryRow label="Gültig bis" value={plan.validUntil ? formatDate(plan.validUntil) : 'Offen'} />
        <SummaryRow label="Pflegekraft" value={plan.employeeName} />
        <SummaryRow label="Standort" value={plan.city} />
        {plan.dueVitalsCount > 0 ? (
          <SummaryRow label="Fällige Vitalwerte" value={String(plan.dueVitalsCount)} />
        ) : null}
      </SectionPanel>

      {plan.summary ? (
        <PremiumCard accentColor={colors.amber}>
          <Text style={styles.hintLabel}>Zusammenfassung</Text>
          <Text style={styles.hint}>{plan.summary}</Text>
        </PremiumCard>
      ) : null}

      {plan.tasks.length === 0 ? (
        <EmptyState title="Keine Maßnahmen" message="Maßnahmen sind in der Vollansicht verfügbar." />
      ) : null}

      <View style={styles.actions}>
        <PremiumButton
          title="Vollständigen Pflegeplan öffnen"
          variant="primary"
          fullWidth
          onPress={() => router.push(`/pflege/plans/${plan.id}` as never)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { flex: 1, padding: spacing.md, gap: spacing.md },
  title: { ...typography.h2, marginBottom: spacing.sm },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.xs },
  client: { ...typography.caption, color: colors.textMuted },
  row: { marginBottom: spacing.sm },
  rowLabel: { ...typography.caption, color: colors.textMuted, marginBottom: 2 },
  rowValue: { ...typography.body },
  hintLabel: { ...typography.label, color: colors.success, marginBottom: spacing.xs },
  hint: { ...typography.body },
  actions: { gap: spacing.sm, paddingBottom: spacing.xl },
});
