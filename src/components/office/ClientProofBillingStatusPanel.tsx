import { StyleSheet, Text, View } from 'react-native';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumBadge,
  PremiumCard,
  SectionPanel,
} from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { getBillingCandidatesForClient } from '@/lib/billing/clientBillingCandidateService';
import {
  BILLING_BLOCKING_REASON_LABELS,
  BILLING_CANDIDATE_STATUS_LABELS,
} from '@/types/clientBilling';
import { colors, spacing, typography } from '@/theme';

type Props = {
  clientId: string;
};

/** K.5 — Abrechnungsstatus je Nachweis im Tab Einsätze & Nachweise. */
export function ClientProofBillingStatusPanel({ clientId }: Props) {
  const tenantId = useServiceTenantId();

  const query = useAsyncQuery(
    () => {
      if (!tenantId || !clientId) return Promise.resolve({ ok: false as const, error: 'Keine ID.' });
      return getBillingCandidatesForClient(tenantId, clientId);
    },
    [tenantId, clientId],
    { enabled: !!tenantId && !!clientId },
  );

  if (query.loading && !query.data) {
    return <LoadingState message="Abrechnungsstatus wird geladen…" />;
  }
  if (query.error && !query.data) {
    return <ErrorState message={query.error} onRetry={query.refresh} />;
  }

  const candidates = query.data ?? [];

  return (
    <SectionPanel title="Nachweise — Abrechnungsstatus">
      {candidates.length === 0 ? (
        <EmptyState
          title="Keine Abrechnungskandidaten"
          message="Freigegebene Nachweise erscheinen hier mit Abrechnungsstatus und Sperrgründen."
        />
      ) : (
        candidates.slice(0, 15).map((c) => (
          <PremiumCard key={c.id} style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.primary}>
                Nachweis {c.proofId.slice(0, 8)}
                {c.proofDate ? ` · ${c.proofDate}` : ''}
              </Text>
              <PremiumBadge label={BILLING_CANDIDATE_STATUS_LABELS[c.status]} variant="muted" dot />
            </View>
            {c.budgetTypeId ? (
              <Text style={styles.secondary}>Budgetzuordnung hinterlegt</Text>
            ) : (
              <Text style={styles.secondary}>Keine Budgetzuordnung</Text>
            )}
            {c.blockingReasons.length > 0 ? (
              <Text style={styles.blocked}>
                {c.blockingReasons.map((r) => BILLING_BLOCKING_REASON_LABELS[r]).join(' · ')}
              </Text>
            ) : null}
          </PremiumCard>
        ))
      )}
    </SectionPanel>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  primary: { ...typography.label, flex: 1 },
  secondary: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
  blocked: { ...typography.caption, color: colors.error, marginTop: spacing.xs },
});
