// Generated native presentation from src/components/office/ClientInvoiceDraftSummary.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {nativeCrypto as crypto} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {CareSuiteNativeText as Text,CareSuiteNativeTextInput as TextInput} from '@/components/ui/CareSuiteNativeText';
import { useState } from 'react';
import { View } from 'react-native';
import { EmptyState, ErrorState, LoadingState, PremiumBadge, PremiumButton, PremiumCard, SectionPanel } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { formatCurrency } from '@/lib/formatters/numberFormatters';
import { createPflegeInvoiceDraft, listCareInvoiceDraftSources } from '@/lib/pflege/careBillingLiveService';
import { colors, spacing, typography } from '@/theme';
export function ClientInvoiceDraftSummary({ clientId }: {
    clientId: string;
}) {
    const tenantId = useServiceTenantId();
    const { roleKey, can } = usePermissions();
    const [paymentTerm, setPaymentTerm] = useState('14');
    const [submitting, setSubmitting] = useState<string | null>(null);
    const [message, setMessage] = useState('');
    const query = useAsyncQuery(() => tenantId && clientId ? listCareInvoiceDraftSources(tenantId, roleKey, clientId) : Promise.resolve({ ok: false as const, error: 'Kein Mandant oder Pflegefall.' }), [tenantId, roleKey, clientId], { enabled: Boolean(tenantId && clientId) });
    if (query.loading && !query.data)
        return <LoadingState message="Rechnungsgrundlagen werden nachgerechnet…"/>;
    if (query.error && !query.data)
        return <ErrorState message={query.error} onRetry={query.refresh}/>;
    const sources = query.data ?? [];
    const days = Number(paymentTerm);
    const valid = Number.isInteger(days) && days >= 1 && days <= 365;
    async function create(foundationId: string) {
        if (!tenantId || !valid || submitting)
            return;
        setSubmitting(foundationId);
        setMessage('');
        const requestId = crypto.randomUUID();
        const result = await createPflegeInvoiceDraft(tenantId, roleKey, foundationId, days, requestId);
        setMessage(result.ok ? `Entwurf ${result.data.invoiceNumber} wurde erstellt – noch nicht freigegeben oder versendet.` : result.error);
        setSubmitting(null);
        if (result.ok)
            await query.refresh();
    }
    return <SectionPanel title="Rechnungsentwurf" subtitle="Nachrechenbare Positionen; Freigabe und Versand bleiben getrennt">
    <View style={{ gap: spacing.xs, marginBottom: spacing.sm }}>
      <Text style={typography.caption}>Zahlungsziel in Tagen (1–365)</Text>
      <TextInput accessibilityLabel="Zahlungsziel in Tagen" value={paymentTerm} onChangeText={setPaymentTerm} inputMode="numeric" style={{ borderWidth: 1, borderColor: valid ? colors.borderSoft : colors.error, borderRadius: 6, padding: spacing.sm }}/>
    </View>
    {sources.length === 0 ? <EmptyState title="Keine validierte Grundlage" message="Ein Entwurf benötigt genau eine vollständig gebundene und nachrechenbare Rechnungsgrundlage."/> : sources.map((source) => <PremiumCard key={source.foundationId} style={{ marginBottom: spacing.sm }}>
      <PremiumBadge label="Nur Entwurf" variant="orange"/>
      <Text style={{ ...typography.label, marginTop: spacing.xs }}>{source.recipientName} · {source.foundationNumber}</Text>
      <Text style={{ ...typography.caption, marginTop: spacing.xs }}>{source.positions.length} Position(en) · {formatCurrency(source.totalAmountCents, true)}</Text>
      {source.positions.slice(0, 3).map((position) => <Text key={position.billingCaseId} style={{ ...typography.caption, marginTop: spacing.xs }}>{position.serviceDate} · {position.serviceCode} · {(position.quantityMilli / 1000).toLocaleString('de-DE')} × {formatCurrency(position.unitAmountCents, true)} = {formatCurrency(position.amountCents, true)}</Text>)}
      {can('pflege.invoices.manage') ? <PremiumButton title={submitting === source.foundationId ? 'Erstelle…' : 'Rechnungsentwurf erstellen'} disabled={!valid || Boolean(submitting)} onPress={() => void create(source.foundationId)}/> : null}
    </PremiumCard>)}
    {message ? <Text style={{ ...typography.caption, color: message.includes('wurde erstellt') ? colors.success : colors.error }}>{message}</Text> : null}
    <Text style={{ ...typography.caption, marginTop: spacing.xs }}>Das Erstellen bestätigt keine Leistung, gibt keine Rechnung frei und löst weder Übertragung noch Versand aus.</Text>
  </SectionPanel>;
}
