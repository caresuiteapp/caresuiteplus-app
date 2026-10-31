// Generated native presentation from src/components/office/ClientInvoiceAdjustmentSummary.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { View } from 'react-native';
import { EmptyState, ErrorState, LoadingState, PremiumBadge, PremiumCard, SectionPanel } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { formatCurrency } from '@/lib/formatters/numberFormatters';
import { listCareInvoiceAdjustments } from '@/lib/pflege/careBillingLiveService';
import { colors, spacing, typography } from '@/theme';
const kindLabel = { full_cancellation: 'Vollstorno', partial_credit: 'Teil-Gutschrift', cancel_and_rebill: 'Storno und Neurechnung' } as const;
export function ClientInvoiceAdjustmentSummary({ clientId }: {
    clientId: string;
}) {
    const tenantId = useServiceTenantId();
    const { roleKey } = usePermissions();
    const query = useAsyncQuery(() => tenantId && clientId ? listCareInvoiceAdjustments(tenantId, roleKey, clientId) : Promise.resolve({ ok: false as const, error: 'Kein Mandant oder Pflegefall.' }), [tenantId, roleKey, clientId], { enabled: Boolean(tenantId && clientId) });
    if (query.loading && !query.data)
        return <LoadingState message="Storno- und Gutschrifthistorie wird geladen…"/>;
    if (query.error && !query.data)
        return <ErrorState message={query.error} onRetry={query.refresh}/>;
    const adjustments = query.data ?? [];
    return <SectionPanel title="Storno und Gutschrift" subtitle="Original, Gegenbuchung und Neurechnung als unveränderliche Kette">
    {adjustments.length === 0 ? <EmptyState title="Keine Gegenbuchung dokumentiert" message="Rückläufer und Folgeversuche erzeugen weder Storno noch Gutschrift."/> : adjustments.map((item) => <PremiumCard key={item.adjustmentId} style={{ marginBottom: spacing.sm }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm }}>
        <View style={{ flex: 1 }}><Text style={typography.label}>{item.adjustmentNumber} · {item.originalInvoiceNumber}</Text><Text style={{ ...typography.caption, color: colors.textMuted, marginTop: spacing.xs }}>{item.reason} · {item.approvedAt}</Text></View>
        <PremiumBadge label={kindLabel[item.adjustmentKind] ?? item.adjustmentKind} variant="orange"/>
      </View>
      <Text style={{ ...typography.caption, marginTop: spacing.sm }}>Original {formatCurrency(item.originalTotalAmountCents, true)} · Gegenbuchung {formatCurrency(item.counterEntryCents, true)} · Neurechnung {formatCurrency(item.replacementTotalAmountCents, true)}</Text>
      <Text style={{ ...typography.label, marginTop: spacing.xs }}>Saldo {formatCurrency(item.resultingBalanceCents, true)}</Text>
      {item.replacementInvoiceNumber ? <Text style={{ ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs }}>Neue Rechnung {item.replacementInvoiceNumber}</Text> : null}
      <Text style={{ ...typography.caption, color: colors.textSecondary, marginTop: spacing.sm }}>Übermittlung und Zahlung sind aus dieser Buchung ausdrücklich nicht abgeleitet.</Text>
    </PremiumCard>)}
    <Text style={{ ...typography.caption, color: colors.textSecondary }}>Ein Kostenträger-Rückläufer oder Folgeversuch löst keine Gegenbuchung aus. Jede Korrektur benötigt eigene Freigabe, Identität, Positionen und Beleg.</Text>
  </SectionPanel>;
}
