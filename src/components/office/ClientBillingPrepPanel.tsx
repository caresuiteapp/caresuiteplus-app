import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumBadge,
  PremiumButton,
  PremiumCard,
  SectionPanel,
} from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { getClientBillingPreview } from '@/lib/billing/clientBillingPreviewService';
import { reserveBudgetForCandidate } from '@/lib/billing/clientBudgetConsumptionService';
import { syncApprovedProofsToBillingCandidates } from '@/lib/billing/clientBillingCandidateService';
import { formatCurrency } from '@/lib/formatters/numberFormatters';
import {
  BILLING_BLOCKING_REASON_LABELS,
  BILLING_CANDIDATE_STATUS_LABELS,
} from '@/types/clientBilling';
import type { ClientBillingPreviewLine } from '@/types/clientBilling';
import { colors, spacing, typography } from '@/theme';

function statusVariant(status: ClientBillingPreviewLine['status']) {
  switch (status) {
    case 'draftable':
      return 'green' as const;
    case 'ready_for_review':
      return 'orange' as const;
    case 'blocked':
      return 'red' as const;
    default:
      return 'muted' as const;
  }
}

type Props = {
  clientId: string;
  onRecordRefresh?: () => void;
};

/** K.5 — Abrechnungsvorbereitung in der Akte (keine finale Rechnung). */
export function ClientBillingPrepPanel({ clientId, onRecordRefresh }: Props) {
  const tenantId = useServiceTenantId();
  const { isReadOnly } = usePermissions();
  const [refreshing, setRefreshing] = useState(false);

  const previewQuery = useAsyncQuery(
    () => {
      if (!tenantId || !clientId) return Promise.resolve({ ok: false as const, error: 'Keine ID.' });
      return getClientBillingPreview(tenantId, clientId, { refresh: true, budgetYear: 2026 });
    },
    [tenantId, clientId],
    { enabled: !!tenantId && !!clientId },
  );

  async function handleRefresh() {
    if (!tenantId || isReadOnly) return;
    setRefreshing(true);
    await syncApprovedProofsToBillingCandidates(tenantId, clientId);
    await previewQuery.refresh();
    setRefreshing(false);
    onRecordRefresh?.();
  }

  async function handleReserve(line: ClientBillingPreviewLine) {
    if (!tenantId || isReadOnly) return;
    const candidates = await syncApprovedProofsToBillingCandidates(tenantId, clientId);
    if (!candidates.ok) return;
    const candidate = candidates.data.find((c) => c.id === line.candidateId);
    if (!candidate) return;
    await reserveBudgetForCandidate(tenantId, candidate);
    await previewQuery.refresh();
    onRecordRefresh?.();
  }

  const loading = previewQuery.loading && !previewQuery.data;
  const preview = previewQuery.data;

  if (loading) return <LoadingState message="Abrechnungsvorschau wird geladen…" />;
  if (previewQuery.error && !preview) {
    return <ErrorState message={previewQuery.error} onRetry={previewQuery.refresh} />;
  }

  const draftable = preview?.lines.filter((l) => l.status === 'draftable') ?? [];
  const blocked = preview?.lines.filter((l) => l.status === 'blocked') ?? [];

  return (
    <View style={styles.panel}>
      <SectionPanel
        title="Abrechnungsvorschau"
        subtitle="Vorbereitung ohne finale Rechnung — K.5"
      >
        {preview?.warnings?.length ? (
          <PremiumCard style={styles.card}>
            <Text style={styles.warningTitle}>Hinweise</Text>
            {preview.warnings.slice(0, 4).map((w) => (
              <Text key={w} style={styles.secondary}>{w}</Text>
            ))}
          </PremiumCard>
        ) : null}

        {preview && preview.lines.length > 0 ? (
          <>
            <Text style={styles.summary}>
              Gesamt Vorschau: {formatCurrency(preview.totalAmountPreviewCents, true)}
              {' · '}
              {preview.totalDurationMinutes} Min.
              {' · '}
              {preview.draftableCount} entwurfsfähig
            </Text>
            {preview.lines.slice(0, 10).map((line) => (
              <PremiumCard key={line.candidateId} style={styles.card}>
                <View style={styles.row}>
                  <Text style={styles.primary}>
                    {line.serviceTypeName ?? 'Leistung'} · {line.proofDate ?? '—'}
                  </Text>
                  <PremiumBadge
                    label={BILLING_CANDIDATE_STATUS_LABELS[line.status]}
                    variant={statusVariant(line.status)}
                    dot
                  />
                </View>
                <Text style={styles.secondary}>
                  {formatCurrency(line.amountPreviewCents, true)}
                  {line.durationMinutes ? ` · ${line.durationMinutes} Min.` : ''}
                </Text>
                {line.blockingReasons.length > 0 ? (
                  <Text style={styles.blocked}>
                    {line.blockingReasons.map((r) => BILLING_BLOCKING_REASON_LABELS[r]).join(' · ')}
                  </Text>
                ) : null}
                {!isReadOnly && line.status === 'draftable' ? (
                  <PremiumButton
                    title="Budget reservieren"
                    variant="secondary"
                    onPress={() => void handleReserve(line)}
                  />
                ) : null}
              </PremiumCard>
            ))}
          </>
        ) : (
          <EmptyState
            title="Keine Abrechnungskandidaten"
            message="Freigegebene Nachweise werden nach Aktualisierung als Kandidaten angelegt."
            actionLabel={!isReadOnly ? 'Vorschau aktualisieren' : undefined}
            onAction={!isReadOnly ? handleRefresh : undefined}
          />
        )}
      </SectionPanel>

      {blocked.length > 0 ? (
        <SectionPanel title="Blockierte Nachweise">
          {blocked.slice(0, 5).map((line) => (
            <PremiumCard key={line.candidateId} style={styles.card}>
              <Text style={styles.primary}>Nachweis {line.proofId.slice(0, 8)}…</Text>
              <Text style={styles.blocked}>
                {line.blockingReasons.map((r) => BILLING_BLOCKING_REASON_LABELS[r]).join(' · ')}
              </Text>
            </PremiumCard>
          ))}
        </SectionPanel>
      ) : null}

      {preview?.budgetSummary ? (
        <SectionPanel title="Budgetverbrauch (Vorschau)">
          <Text style={styles.secondary}>
            Reserviert (Kandidaten): {formatCurrency(preview.budgetSummary.candidateReservedCents, true)}
            {' · '}
            Verbraucht (Kandidaten): {formatCurrency(preview.budgetSummary.candidateConsumedCents, true)}
            {' · '}
            Rest: {formatCurrency(preview.budgetSummary.totalRemainingCents, true)}
          </Text>
        </SectionPanel>
      ) : null}

      {!isReadOnly && preview && preview.lines.length > 0 ? (
        <PremiumButton
          title={refreshing ? 'Aktualisiere…' : 'Vorschau aktualisieren'}
          variant="secondary"
          disabled={refreshing}
          onPress={handleRefresh}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: spacing.sm },
  card: { marginBottom: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm },
  primary: { ...typography.label, flex: 1 },
  secondary: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
  blocked: { ...typography.caption, color: colors.error, marginTop: spacing.xs },
  summary: { ...typography.caption, marginBottom: spacing.sm },
  warningTitle: { ...typography.label, marginBottom: spacing.xs },
});
