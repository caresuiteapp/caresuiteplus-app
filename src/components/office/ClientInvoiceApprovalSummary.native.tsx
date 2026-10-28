// Generated native presentation from src/components/office/ClientInvoiceApprovalSummary.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {nativeCrypto as crypto} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {CareSuiteNativeText as Text,CareSuiteNativeTextInput as TextInput} from '@/components/ui/CareSuiteNativeText';
import { useState } from 'react';
import { View } from 'react-native';
import { EmptyState, ErrorState, LoadingState, PremiumBadge, PremiumButton, PremiumCard, SectionPanel } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { formatCurrency } from '@/lib/formatters/numberFormatters';
import { approvePflegeInvoiceDraft, listCareInvoiceApprovalCandidates } from '@/lib/pflege/careBillingLiveService';
import { colors, spacing, typography } from '@/theme';
export function ClientInvoiceApprovalSummary({ clientId }: {
    clientId: string;
}) {
    const tenantId = useServiceTenantId();
    const { roleKey, can } = usePermissions();
    const [taxTreatment, setTaxTreatment] = useState('');
    const [taxRate, setTaxRate] = useState('');
    const [netAmount, setNetAmount] = useState('');
    const [taxAmount, setTaxAmount] = useState('');
    const [legalReference, setLegalReference] = useState('');
    const [reviewerNote, setReviewerNote] = useState('');
    const [submitting, setSubmitting] = useState<string | null>(null);
    const [message, setMessage] = useState('');
    const query = useAsyncQuery(() => tenantId && clientId ? listCareInvoiceApprovalCandidates(tenantId, roleKey, clientId) : Promise.resolve({ ok: false as const, error: 'Kein Mandant oder Pflegefall.' }), [tenantId, roleKey, clientId], { enabled: Boolean(tenantId && clientId) });
    if (query.loading && !query.data)
        return <LoadingState message="Rechnungsfassungen werden geprüft…"/>;
    if (query.error && !query.data)
        return <ErrorState message={query.error} onRetry={query.refresh}/>;
    const candidates = query.data ?? [];
    const rate = Number(taxRate);
    const net = Number(netAmount);
    const tax = Number(taxAmount);
    const inputValid = ['tax_exempt_healthcare', 'taxable'].includes(taxTreatment) && Number.isInteger(rate) && rate >= 0 && rate <= 10000 && Number.isSafeInteger(net) && net >= 0 && Number.isSafeInteger(tax) && tax >= 0 && legalReference.trim().length > 0 && reviewerNote.trim().length >= 5;
    async function approve(invoiceDraftId: string, createdAt: string) {
        if (!tenantId || !inputValid || submitting)
            return;
        setSubmitting(invoiceDraftId);
        setMessage('');
        const result = await approvePflegeInvoiceDraft(tenantId, roleKey, { invoiceDraftId, expectedDraftVersion: 1, expectedDraftCreatedAt: createdAt, taxTreatment: taxTreatment as 'tax_exempt_healthcare' | 'taxable', taxRateBasisPoints: rate, netAmountCents: net, taxAmountCents: tax, taxLegalReference: legalReference, reviewerNote, clientRequestId: crypto.randomUUID() });
        setMessage(result.ok ? `Freigabeversion ${result.data.approvalVersion} wurde unveränderlich gespeichert – noch nicht versendet und nicht als bezahlt gewertet.` : result.error);
        setSubmitting(null);
        if (result.ok)
            await query.refresh();
    }
    const fieldStyle = { borderWidth: 1, borderColor: inputValid ? colors.borderSoft : colors.error, borderRadius: 6, padding: spacing.sm };
    return <SectionPanel title="Rechnungsfreigabe" subtitle="Vier-Augen-Prüfung einer konkreten Entwurfsfassung">
    <View style={{ gap: spacing.xs, marginBottom: spacing.sm }}>
      <Text style={typography.caption}>Steuerbehandlung: tax_exempt_healthcare oder taxable</Text>
      <TextInput accessibilityLabel="Steuerbehandlung" value={taxTreatment} onChangeText={setTaxTreatment} autoCapitalize="none" style={fieldStyle}/>
      <Text style={typography.caption}>Steuersatz in Basispunkten (0–10000)</Text>
      <TextInput accessibilityLabel="Steuersatz in Basispunkten" value={taxRate} onChangeText={setTaxRate} inputMode="numeric" style={fieldStyle}/>
      <Text style={typography.caption}>Nettobetrag in Cent</Text>
      <TextInput accessibilityLabel="Nettobetrag in Cent" value={netAmount} onChangeText={setNetAmount} inputMode="numeric" style={fieldStyle}/>
      <Text style={typography.caption}>Steuerbetrag in Cent</Text>
      <TextInput accessibilityLabel="Steuerbetrag in Cent" value={taxAmount} onChangeText={setTaxAmount} inputMode="numeric" style={fieldStyle}/>
      <Text style={typography.caption}>Steuer-/Rechtsgrundlage</Text>
      <TextInput accessibilityLabel="Steuer- und Rechtsgrundlage" value={legalReference} onChangeText={setLegalReference} style={fieldStyle}/>
      <Text style={typography.caption}>Prüfvermerk (mindestens 5 Zeichen)</Text>
      <TextInput accessibilityLabel="Prüfvermerk" value={reviewerNote} onChangeText={setReviewerNote} multiline style={fieldStyle}/>
    </View>
    {candidates.length === 0 ? <EmptyState title="Keine freigabefähige Entwurfsfassung" message="Freigabe benötigt einen unveränderten Entwurf mit vollständigen Positionen und eine andere befugte Prüferidentität."/> : candidates.map((candidate) => <PremiumCard key={candidate.invoiceDraftId} style={{ marginBottom: spacing.sm }}>
      <PremiumBadge label="Freigabe ausstehend" variant="orange"/>
      <Text style={{ ...typography.label, marginTop: spacing.xs }}>{candidate.invoiceNumber} · {candidate.recipientName}</Text>
      <Text style={{ ...typography.caption, marginTop: spacing.xs }}>{candidate.positionCount} Position(en) · {formatCurrency(candidate.totalAmountCents, true)} · Fällig {candidate.dueDate}</Text>
      {candidate.positions.slice(0, 3).map((position) => <Text key={position.positionNo} style={{ ...typography.caption, marginTop: spacing.xs }}>{position.positionNo}. {position.serviceDate} · {position.serviceCode} · {formatCurrency(position.amountCents, true)}</Text>)}
      {can('pflege.billing.release') ? <PremiumButton title={submitting === candidate.invoiceDraftId ? 'Prüfe…' : 'Entwurfsfassung freigeben'} disabled={!inputValid || Boolean(submitting)} onPress={() => void approve(candidate.invoiceDraftId, candidate.createdAt)}/> : null}
    </PremiumCard>)}
    {message ? <Text style={{ ...typography.caption, color: message.includes('gespeichert') ? colors.success : colors.error }}>{message}</Text> : null}
    <Text style={{ ...typography.caption, marginTop: spacing.xs }}>Die Freigabe bestätigt keine Leistung, überträgt oder versendet keine Rechnung und belegt keinen Zahlungseingang.</Text>
  </SectionPanel>;
}
