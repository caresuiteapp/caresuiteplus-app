// Generated native presentation from src/components/office/ClientServiceCombinationSummary.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { View } from 'react-native';
import { EmptyState, ErrorState, LoadingState, PremiumBadge, PremiumCard, SectionPanel } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { validateClientServiceCombinationReview } from '@/lib/clients/clientServiceCombinationDomain';
import { listClientServiceCombinationLedger } from '@/lib/clients/clientServiceCombinationService';
import { formatDate } from '@/lib/formatters/dateTimeFormatters';
import { spacing, typography } from '@/theme';
import { careSuiteAuroraTheme } from '@/theme/careSuiteAurora';
const OUTCOME_LABELS = {
    allowed: 'Zulässig dokumentiert',
    prohibited: 'Unzulässige Kombination',
    surcharge_required: 'Zuschlag erforderlich',
} as const;
export function ClientServiceCombinationSummary({ clientId }: {
    clientId: string;
}) {
    const tenantId = useServiceTenantId();
    const query = useAsyncQuery(() => tenantId && clientId
        ? listClientServiceCombinationLedger(tenantId, clientId)
        : Promise.resolve({ ok: false as const, error: 'Kein Mandant oder Pflegefall.' }), [tenantId, clientId], { enabled: Boolean(tenantId && clientId) });
    if (query.loading && !query.data)
        return <LoadingState message="Leistungskombinationen werden geladen…"/>;
    if (query.error && !query.data)
        return <ErrorState message={query.error} onRetry={query.refresh}/>;
    const reviews = query.data?.reviews ?? [];
    const rules = query.data?.rules ?? [];
    return <SectionPanel title="Leistungskombinationen" subtitle="Kostenträger-, leistungs- und datumsgenaue Regelprüfung">
    {reviews.length === 0 ? (<EmptyState title="Keine konkrete Kombinationsprüfung dokumentiert" message="Vertrag, Tarif oder Finanzierungsweg werden nicht als Zulässigkeitsregel ausgelegt."/>) : reviews.map((review) => {
            try {
                const evaluation = validateClientServiceCombinationReview(review, rules);
                const rule = evaluation.rule!;
                return <PremiumCard key={review.id} style={{ marginBottom: spacing.sm }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}>
            <Text style={{ ...typography.label, color: careSuiteAuroraTheme.text.primary, flex: 1 }}>
              {review.serviceTypeA} + {review.serviceTypeB}
            </Text>
            <PremiumBadge label={OUTCOME_LABELS[evaluation.state as keyof typeof OUTCOME_LABELS]} variant={evaluation.state === 'prohibited' ? 'orange' : evaluation.state === 'allowed' ? 'green' : 'cyan'}/>
          </View>
          <Text style={{ ...typography.caption, color: careSuiteAuroraTheme.text.muted, marginTop: spacing.xs }}>
            {review.costCarrierReference} · {review.financingKind} · Leistungsdatum {formatDate(review.serviceOn)}
          </Text>
          <Text style={{ ...typography.caption, color: careSuiteAuroraTheme.text.muted, marginTop: spacing.xs }}>
            {evaluation.reason}
          </Text>
          <Text style={{ ...typography.caption, color: careSuiteAuroraTheme.text.muted, marginTop: spacing.xs }}>
            Regelfassung {rule.version} · gültig {formatDate(rule.validFrom)} bis {rule.validUntil ? formatDate(rule.validUntil) : 'unbefristet'} · Prüfbeleg {review.evidenceReference}
          </Text>
        </PremiumCard>;
            }
            catch {
                return <Text key={review.id} style={{ ...typography.caption, color: careSuiteAuroraTheme.text.muted, marginBottom: spacing.sm }}>
          Kombinationsprüfung ist wegen unvollständiger, widersprüchlicher oder nicht datumsgültig gebundener Originaldaten nicht auswertbar.
        </Text>;
            }
        })}
    <Text style={{ ...typography.caption, color: careSuiteAuroraTheme.text.muted }}>
      Das Prüfergebnis bestätigt weder Leistungserbringung noch Genehmigung, Vertrags- oder Abrechnungsfreigabe.
    </Text>
  </SectionPanel>;
}
