// Generated native presentation from src/components/office/ClientInvoiceFoundationReadinessSummary.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import {} from 'react-native';
import { EmptyState, ErrorState, LoadingState, PremiumBadge, PremiumCard, SectionPanel } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { formatCurrency } from '@/lib/formatters/numberFormatters';
import { listCareInvoiceFoundationGroups } from '@/lib/pflege/careBillingLiveService';
import { spacing, typography } from '@/theme';
export function ClientInvoiceFoundationReadinessSummary({ clientId }: {
    clientId: string;
}) {
    const tenantId = useServiceTenantId();
    const today = new Date().toISOString().slice(0, 10);
    const periodFrom = `${today.slice(0, 7)}-01`;
    const query = useAsyncQuery(() => tenantId && clientId ? listCareInvoiceFoundationGroups(tenantId, undefined, clientId, periodFrom, today)
        : Promise.resolve({ ok: false as const, error: 'Kein Mandant oder Pflegefall.' }), [tenantId, clientId, periodFrom, today], { enabled: Boolean(tenantId && clientId) });
    if (query.loading && !query.data)
        return <LoadingState message="Bereitschaftsgruppen werden geprüft…"/>;
    if (query.error && !query.data)
        return <ErrorState message={query.error} onRetry={query.refresh}/>;
    const groups = query.data ?? [];
    return <SectionPanel title="Rechnungsgrundlagen – Bereitschaft" subtitle="Nur lesende, strikt gebundene Gruppen">
    {groups.length === 0 ? <EmptyState title="Keine vollständige Bereitschaftsgruppe" message="Nur freigegebene Originalnachweise mit Fingerprint, Mikrosekundenzeit, eindeutigem Empfänger und exakter Vertragsfassung werden angezeigt."/>
            : groups.map((group) => <PremiumCard key={group.key} style={{ marginBottom: spacing.sm }}>
        <PremiumBadge label="Bereit zur ausdrücklichen Auswahl" variant="green"/>
        <Text style={{ ...typography.label, marginTop: spacing.xs }}>{group.recipientName} · {group.payerType}</Text>
        <Text style={{ ...typography.caption, marginTop: spacing.xs }}>{group.proofCount} Nachweis(e) · {formatCurrency(group.totalAmountCents, true)}</Text>
        <Text style={{ ...typography.caption, marginTop: spacing.xs }}>Vertragsfassung {group.contractVersion} · {group.contractEventId.slice(0, 8)}…</Text>
      </PremiumCard>)}
    <Text style={{ ...typography.caption }}>Diese Anzeige erstellt, genehmigt oder versendet keine Rechnung und leitet keine Leistung aus Vertrag oder Planung ab.</Text>
  </SectionPanel>;
}
