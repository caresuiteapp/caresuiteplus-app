// Generated native presentation from src/components/office/ClientReceivablesSummary.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { View } from 'react-native';
import { EmptyState, ErrorState, LoadingState, PremiumBadge, PremiumCard, SectionPanel } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { formatCurrency } from '@/lib/formatters/numberFormatters';
import { listCareReceivables } from '@/lib/pflege/careBillingLiveService';
import { colors, spacing, typography } from '@/theme';
const statusLabel = { open: 'Offen', partially_paid: 'Teilbezahlt', paid: 'Bezahlt' } as const;
const dueLabel = { not_due: 'Noch nicht fällig', due_today: 'Heute fällig', overdue: 'Überfällig', settled: 'Ausgeglichen' } as const;
export function ClientReceivablesSummary({ clientId }: {
    clientId: string;
}) {
    const tenantId = useServiceTenantId();
    const { roleKey } = usePermissions();
    const asOfDate = new Date().toISOString().slice(0, 10);
    const query = useAsyncQuery(() => tenantId && clientId ? listCareReceivables(tenantId, roleKey, clientId, asOfDate) : Promise.resolve({ ok: false as const, error: 'Kein Mandant oder Pflegefall.' }), [tenantId, roleKey, clientId, asOfDate], { enabled: Boolean(tenantId && clientId) });
    if (query.loading && !query.data)
        return <LoadingState message="Zahlungen und offene Posten werden geladen…"/>;
    if (query.error && !query.data)
        return <ErrorState message={query.error} onRetry={query.refresh}/>;
    const summary = query.data;
    return <SectionPanel title="Zahlungen und offene Posten" subtitle={`Stand ${asOfDate} · eigenständige Buchungsereignisse`}>
    {!summary || summary.openItems.length === 0 ? <EmptyState title="Keine offenen Posten vorbereitet" message="Eine Rechnungsfreigabe oder Gegenbuchung wird nicht automatisch als Zahlung bewertet."/> : <>
      <PremiumCard style={{ marginBottom: spacing.sm }}>
        <Text style={typography.label}>Forderungen {formatCurrency(summary.totalReceivableCents, true)}</Text>
        <Text style={{ ...typography.caption, marginTop: spacing.xs }}>Zugeordnet {formatCurrency(summary.totalPaidCents, true)} · Rest {formatCurrency(summary.totalRemainingCents, true)}</Text>
      </PremiumCard>
      {summary.openItems.map((item) => <PremiumCard key={item.openItemId} style={{ marginBottom: spacing.sm }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm, flexWrap: 'wrap' }}>
          <View style={{ flex: 1, minWidth: 180 }}><Text style={typography.label}>{item.invoiceNumber}</Text><Text style={{ ...typography.caption, color: colors.textMuted, marginTop: spacing.xs }}>Fällig {item.dueDate} · {dueLabel[item.dueStatus]}</Text></View>
          <PremiumBadge label={statusLabel[item.paymentStatus]} variant={item.paymentStatus === 'paid' ? 'green' : item.paymentStatus === 'partially_paid' ? 'orange' : 'muted'}/>
        </View>
        <Text style={{ ...typography.caption, marginTop: spacing.sm }}>Forderung {formatCurrency(item.receivableAmountCents, true)} · Zahlung {formatCurrency(item.paidAmountCents, true)}</Text>
        <Text style={{ ...typography.label, marginTop: spacing.xs }}>Restbetrag {formatCurrency(item.remainingAmountCents, true)}</Text>
        {item.lastPaymentAt ? <Text style={{ ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs }}>Letzte gebundene Zahlung {item.lastPaymentAt}</Text> : null}
        {item.paymentStatus === 'partially_paid' ? <Text style={{ ...typography.caption, color: colors.textSecondary, marginTop: spacing.sm }}>Die Teilzahlung gleicht diese Rechnung ausdrücklich nicht vollständig aus.</Text> : null}
      </PremiumCard>)}
    </>}
    <Text style={{ ...typography.caption, color: colors.textSecondary }}>Nur centgenau zugeordnete, nicht stornierte Zahlungsereignisse mindern den Restbetrag. Rückläufer, Versand, Gutschrift oder Fälligkeit allein belegen keinen Zahlungseingang.</Text>
  </SectionPanel>;
}
