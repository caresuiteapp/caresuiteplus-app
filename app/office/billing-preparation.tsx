import { StyleSheet, Text, View } from 'react-native';
import {
  EmptyState,
  LoadingState,
  PremiumButton,
  PremiumCard,
  SectionPanel,
} from '@/components/ui';
import { ScreenShell } from '@/components/layout';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { getDraftableBillingCandidates } from '@/lib/billing/clientBillingCandidateService';
import { formatCurrency } from '@/lib/formatters/numberFormatters';
import { BILLING_CANDIDATE_STATUS_LABELS } from '@/types/clientBilling';
import { useRouter } from 'expo-router';
import { colors, spacing, typography } from '@/theme';

/** Office — Abrechnungsvorbereitung (K.5, keine finale Rechnung). */
export default function OfficeBillingPreparationScreen() {
  const router = useRouter();
  const tenantId = useServiceTenantId();

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return getDraftableBillingCandidates(tenantId);
    },
    [tenantId],
    { enabled: !!tenantId },
  );

  const candidates = query.data ?? [];

  return (
    <ScreenShell
      title="Abrechnungsvorbereitung"
      subtitle="Kandidaten und Vorschau — keine finale Rechnung"
      rightSlot={<PremiumButton title="Zurück" variant="secondary" onPress={() => router.back()} />}
    >
      {query.loading && !query.data ? <LoadingState message="Kandidaten werden geladen…" /> : null}

      <SectionPanel title="Entwurfsfähige Kandidaten">
        {candidates.length === 0 && !query.loading ? (
          <EmptyState
            title="Keine entwurfsfähigen Kandidaten"
            message="Freigegebene Nachweise mit erfüllten Pflichtfeldern erscheinen hier. Finale Rechnungen werden in K.6 erstellt."
          />
        ) : (
          candidates.map((c) => (
            <PremiumCard key={c.id} style={styles.card}>
              <Text style={styles.primary}>
                Klient {c.clientId.slice(0, 8)}… · {c.proofDate ?? '—'}
              </Text>
              <Text style={styles.secondary}>
                {BILLING_CANDIDATE_STATUS_LABELS[c.status]}
                {' · '}
                {formatCurrency(c.amountPreviewCents, true)}
                {c.durationMinutes ? ` · ${c.durationMinutes} Min.` : ''}
              </Text>
            </PremiumCard>
          ))
        )}
      </SectionPanel>

      <View style={styles.hintBox}>
        <Text style={styles.hint}>
          K.5 bereitet Budgetverbrauch und Abrechnungskandidaten vor. Es werden keine Rechnungsnummern verbraucht
          und keine Rechnungen versendet.
        </Text>
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.sm },
  primary: { ...typography.label },
  secondary: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
  hintBox: { marginTop: spacing.lg, padding: spacing.md },
  hint: { ...typography.caption, color: colors.textMuted },
});
