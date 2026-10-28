// Generated native presentation from src/screens/office/InvoiceDetailScreen.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {useNativeWorkflowWindow} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {nativeWindow as window,nativeCrypto as crypto} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {NativeStyle,NativeDiv,NativeSection,NativeH1,NativeP,NativeH2,NativeButton,NativeHeader,NativeSpan,NativeBr,NativeStrong,NativeUl,NativeLi,NativeDl,NativeDt,NativeDd,NativeTable,NativeThead,NativeTr,NativeTh,NativeTbody,NativeTd,NativeSmall,NativeH3,NativeLabel,NativeInput,NativeSelect,NativeOption,NativeTextarea,NativeAside,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import {confirmNativeWorkspaceAction,runNativeWorkspaceEffect} from '@/lib/platform/nativeWorkspaceActions.native';
import { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useNavigation, useRouter, useIsFocused } from 'expo-router';
import { usePreventRemove } from "@/hooks/useNativePreventRemove.native";
import { ScreenShell } from "../../components/layout/ScreenShell.tsx";
import { InvoicePdfPreview } from "../../components/office/invoices/InvoicePdfPreview.native.tsx";
import { EInvoiceReadOnlySummary, eInvoiceTaxLabels } from "../../components/office/invoices/EInvoiceSettingsPanel.native.tsx";
import { EInvoiceOriginalDownload, EInvoiceXmlPreview } from "../../components/office/invoices/EInvoiceXmlPreview.native.tsx";
import { invoiceEditorCss } from "../../components/office/invoices/invoiceEditorStyles.native.ts";
import { invoiceEditorDate, invoiceEditorMoney, invoiceEditorToday, parseInvoiceEditorDecimal } from "../../components/office/invoices/invoiceEditorModel.native.ts";
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useAuth } from '@/lib/auth/context';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { isPortalOnlyRole } from '@/lib/permissions/workspaceRoles';
import { clientRecordRoute } from '@/lib/navigation/clientRoutes';
import { INVOICE_STATUS_LABELS } from '@/lib/office/invoiceStatus';
import { deleteOfficeInvoiceDraft, fetchOfficeInvoice, recordOfficeInvoicePayment, transitionOfficeInvoice } from "../../lib/office/invoiceWorkspaceService.native.ts";
import { issueOfficeInvoicePdf } from "../../lib/office/invoiceIssuePdf.native.ts";
import type { OfficeInvoiceDeliveryEvidence, OfficeInvoiceMutationResult, OfficeInvoicePaymentInput } from "../../lib/office/invoiceWorkspaceService.native.ts";
import type { RoleKey, ServiceResult } from '@/types';
type Props = {
    invoiceId?: string | null;
    embedded?: boolean;
};
const money = (value: number | null) => value == null ? '—' : invoiceEditorMoney(value);
const unitLabels: Record<string, string> = { hour: 'Std.', minute: 'Min.', visit: 'Leistung', day: 'Tag', km: 'km', flat: 'Pauschale' };
const paymentMethods: {
    value: OfficeInvoicePaymentInput['method'];
    label: string;
}[] = [{ value: 'bank_transfer', label: 'Überweisung' }, { value: 'direct_debit', label: 'Lastschrift' }, { value: 'cash', label: 'Barzahlung' }, { value: 'card', label: 'Kartenzahlung' }, { value: 'paypal', label: 'PayPal' }, { value: 'stripe', label: 'Stripe' }, { value: 'other', label: 'Sonstige' }];
export function InvoiceDetailScreen({ invoiceId, embedded = false }: Props = {}) {
    const auth = useAuth();
    const { roleKey, can, permissions } = usePermissions();
    const tenantId = useServiceTenantId()?.trim() ?? '';
    const params = useLocalSearchParams<{
        id?: string | string[];
    }>();
    const id = invoiceId ?? (typeof params.id === 'string' ? params.id : '');
    const allowed = Boolean(auth.authReady && auth.isAuthenticated && auth.user?.id && tenantId && roleKey && !auth.portalSession && !isPortalOnlyRole(roleKey) && can('office.invoices.view'));
    const scopeKey = JSON.stringify([tenantId, auth.user?.id, roleKey, id, [...new Set(permissions)].sort()]);
    const content = <NativeWorkspaceStyleScope css={[invoiceEditorCss]}>{<><NativeStyle>{invoiceEditorCss}</NativeStyle>{!auth.authReady ? <NativeDiv className="ie ie-empty" role="status">Zugang wird geprüft …</NativeDiv> : allowed && roleKey ? <InvoiceDetailWorkspace key={scopeKey} {...{ tenantId, roleKey, scopeKey }} invoiceId={id} canEdit={can('office.invoices.create')} canChangeStatus={can('office.invoices.status_change')} canOpenClient={can('office.clients.view')}/> : <NativeSection className="ie ie-panel ie-empty"><NativeH1>Rechnung</NativeH1><NativeP>Für diesen Bereich benötigen Sie einen Verwaltungszugang mit Zugriff auf Rechnungen.</NativeP></NativeSection>}</>}</NativeWorkspaceStyleScope>;
    return embedded ? <NativeDiv className="ie" style={{ minHeight: 0, overflow: 'auto', padding: 16 }}>{content}</NativeDiv> : <ScreenShell title="Rechnung" contentOwnsHeader>{content}</ScreenShell>;
}
function InvoiceDetailWorkspace({ tenantId, roleKey, scopeKey, invoiceId, canEdit, canChangeStatus, canOpenClient }: {
    tenantId: string;
    roleKey: RoleKey;
    scopeKey: string;
    invoiceId: string;
    canEdit: boolean;
    canChangeStatus: boolean;
    canOpenClient: boolean;
}) {
    const window = useNativeWorkflowWindow();
    const router = useRouter();
    const navigation = useNavigation();
    const focused = useIsFocused();
    const previousFocus = useRef(focused);
    const query = useAsyncQuery(() => fetchOfficeInvoice(tenantId, invoiceId, roleKey), [tenantId, invoiceId, roleKey], { queryKey: scopeKey, retryCount: 0 });
    const [busy, setBusy] = useState('');
    const [notice, setNotice] = useState<{
        tone: 'error' | 'success';
        text: string;
    } | null>(null);
    const [form, setForm] = useState<'payment' | 'delivery' | null>(null);
    const [payment, setPayment] = useState({ amount: '', paymentDate: invoiceEditorToday(), method: 'bank_transfer' as OfficeInvoicePaymentInput['method'], reference: '', notes: '' });
    const [delivery, setDelivery] = useState<OfficeInvoiceDeliveryEvidence>({ channel: 'email', date: invoiceEditorToday(), reference: '' });
    const [deliveryConfirmed, setDeliveryConfirmed] = useState(false);
    const lock = useRef(false);
    const mounted = useRef(true);
    const request = useRef({ key: '', id: '' });
    const leaveAllowed = useRef(false);
    const dirty = Boolean(form && (form === 'payment' ? payment.amount || payment.reference || payment.notes : delivery.reference || deliveryConfirmed));
    const dirtyRef = useRef(dirty);
    dirtyRef.current = dirty;
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    function discardInputs() { setForm(null); setPayment({ amount: '', paymentDate: invoiceEditorToday(), method: 'bank_transfer', reference: '', notes: '' }); setDelivery({ channel: 'email', date: invoiceEditorToday(), reference: '' }); setDeliveryConfirmed(false); dirtyRef.current = false; }
    async function mayLeave() { if (lock.current)
        return false; if (leaveAllowed.current || !dirtyRef.current)
        return true; if (!await confirmNativeWorkspaceAction('Ungespeicherte Angaben verwerfen?'))
        return false; discardInputs(); leaveAllowed.current = true; return true; }
    useEffect(() => { const returning = focused && !previousFocus.current; previousFocus.current = focused; if (returning) {
        leaveAllowed.current = false;
        if (!dirtyRef.current && !lock.current)
            void query.refresh();
    } }, [focused, query.refresh]);
    usePreventRemove(dirty || !!busy, async ({ data }) => { if (await mayLeave())
        navigation.dispatch(data.action); });
    useEffect(() => { if (!dirty && !busy)
        return; const listener = (event: BeforeUnloadEvent) => { if (!leaveAllowed.current) {
        event.preventDefault();
        event.returnValue = '';
    } }; window.addEventListener('beforeunload', listener); return () => window.removeEventListener('beforeunload', listener); }, [dirty, busy]);
    const invoice = query.data;
    const queryError = query.error || query.refreshError;
    const stale = query.loading || query.refreshing || !!queryError || !invoice;
    const actionDisabled = stale || !!busy;
    function actionId(key: string) { if (request.current.key !== key)
        request.current = { key, id: crypto.randomUUID() }; return request.current.id; }
    async function operate(key: string, message: string, action: () => Promise<ServiceResult<OfficeInvoiceMutationResult>>, deleted = false) {
        if (lock.current || stale)
            return;
        lock.current = true;
        setBusy(key);
        setNotice(null);
        try {
            const result = await action();
            if (!mounted.current)
                return;
            if (!result.ok) {
                setNotice({ tone: 'error', text: result.error });
                return;
            }
            setNotice({ tone: 'success', text: message });
            setForm(null);
            setPayment({ amount: '', paymentDate: invoiceEditorToday(), method: 'bank_transfer', reference: '', notes: '' });
            setDelivery({ channel: 'email', date: invoiceEditorToday(), reference: '' });
            setDeliveryConfirmed(false);
            dirtyRef.current = false;
            if (deleted) {
                leaveAllowed.current = true;
                lock.current = false;
                setBusy('');
                router.replace('/business/office/invoices' as never);
                return;
            }
            await query.refresh();
        }
        catch (cause) {
            if (mounted.current)
                setNotice({ tone: 'error', text: cause instanceof Error ? cause.message : 'Die Aktion konnte nicht bestätigt werden. Bitte den aktuellen Stand prüfen.' });
        }
        finally {
            lock.current = false;
            if (mounted.current)
                setBusy('');
        }
    }
    async function openForm(next: 'payment' | 'delivery' | null) {
        if (lock.current || (dirtyRef.current && !await confirmNativeWorkspaceAction('Die eingegebenen Angaben verwerfen?')))
            return;
        setForm(next);
        setNotice(null);
        leaveAllowed.current = false;
        setPayment({ amount: '', paymentDate: invoiceEditorToday(), method: 'bank_transfer', reference: '', notes: '' });
        setDelivery({ channel: 'email', date: invoiceEditorToday(), reference: '' });
        setDeliveryConfirmed(false);
    }
    async function issue() {
        if (lock.current || !invoice || !canChangeStatus || invoice.status !== 'draft' || !invoice.officeManaged || actionDisabled)
            return;
        if (!await confirmNativeWorkspaceAction(`Rechnung für ${invoice.recipient.name} über ${money(invoice.amountCents)} verbindlich freigeben?\n\n${invoice.eInvoice?.format === 'xrechnung' ? 'Nach der vollständigen Normprüfung werden die endgültige Rechnungsnummer, XML und PDF gemeinsam gespeichert.' : 'Die endgültige Rechnungsnummer und das PDF werden gespeichert.'} Danach sind die Rechnungsdaten nicht mehr direkt bearbeitbar. Die Rechnung wird dabei nicht versendet.`))
            return;
        const id = actionId(`issue:${invoice.updatedAt}`);
        await operate('issue', invoice.eInvoice?.format === 'xrechnung' ? 'XRechnung ausgestellt. XML und PDF wurden mit derselben Rechnungsnummer gespeichert.' : 'Rechnung freigegeben. Rechnungsnummer und PDF wurden unveränderlich gespeichert.', () => issueOfficeInvoicePdf(tenantId, invoice, roleKey, id));
    }
    async function remove() {
        if (lock.current || !invoice || !canChangeStatus || invoice.status !== 'draft' || !invoice.officeManaged || actionDisabled)
            return;
        if (!await confirmNativeWorkspaceAction('Diesen Rechnungsentwurf wirklich verwerfen? Verknüpfte Leistungsnachweise werden wieder für die Abrechnung freigegeben.'))
            return;
        await operate('delete', 'Entwurf verworfen.', () => deleteOfficeInvoiceDraft(tenantId, invoice.id, invoice.updatedAt, actionId(`delete:${invoice.updatedAt}`), roleKey), true);
    }
    async function savePayment() {
        if (lock.current || !invoice || !canChangeStatus || actionDisabled || invoice.openCents == null)
            return;
        const amount = parseInvoiceEditorDecimal(payment.amount);
        if (amount == null || amount <= 0 || Math.round(amount * 100) > invoice.openCents) {
            setNotice({ tone: 'error', text: 'Der Zahlungsbetrag muss größer als null sein und darf den offenen Rechnungsbetrag nicht überschreiten.' });
            return;
        }
        if (!payment.reference.trim() || !payment.paymentDate || payment.paymentDate > invoiceEditorToday()) {
            setNotice({ tone: 'error', text: 'Bitte ein gültiges Zahlungsdatum und eine Buchungsreferenz angeben.' });
            return;
        }
        if (!await confirmNativeWorkspaceAction(`Zahlungseingang über ${invoiceEditorMoney(Math.round(amount * 100))} vom ${invoiceEditorDate(payment.paymentDate)} buchen?`))
            return;
        const input = { ...payment, amountCents: Math.round(amount * 100), requestId: actionId(`payment:${invoice.updatedAt}:${JSON.stringify(payment)}`) };
        await operate('payment', 'Zahlungseingang gebucht. Der offene Betrag und der Zahlungsstatus wurden aktualisiert.', () => recordOfficeInvoicePayment(tenantId, invoice.id, invoice.updatedAt, input, roleKey));
    }
    async function saveDelivery() {
        if (lock.current || !invoice || !canChangeStatus || actionDisabled || !deliveryConfirmed)
            return;
        if (!delivery.reference.trim() || !delivery.date || delivery.date > invoiceEditorToday()) {
            setNotice({ tone: 'error', text: 'Bitte ein gültiges Versanddatum und einen Versandnachweis oder eine Referenz angeben.' });
            return;
        }
        const reason = `Extern übermittelt am ${delivery.date}; ${delivery.channel}; ${delivery.reference.trim()}`;
        await operate('delivery', 'Die bereits erfolgte Übermittlung wurde dokumentiert. Es wurde keine Nachricht aus CareSuite versendet.', () => transitionOfficeInvoice(tenantId, invoice.id, invoice.updatedAt, 'sent', reason, actionId(`delivery:${invoice.updatedAt}:${JSON.stringify(delivery)}`), roleKey, delivery));
    }
    if (query.loading && !invoice)
        return <NativeWorkspaceStyleScope css={[invoiceEditorCss]}>{<NativeDiv className="ie" role="status" aria-label="Rechnungsdetails werden geladen"><NativeDiv className="ie-loading"/><NativeDiv className="ie-loading"/></NativeDiv>}</NativeWorkspaceStyleScope>;
    if (!invoice)
        return <NativeWorkspaceStyleScope css={[invoiceEditorCss]}>{<NativeSection className="ie ie-panel ie-empty"><NativeH2>Rechnung nicht verfügbar</NativeH2><NativeP role="alert">{queryError || 'Die Rechnung wurde nicht gefunden.'}</NativeP><NativeButton onClick={() => void query.refresh()}>Erneut laden</NativeButton></NativeSection>}</NativeWorkspaceStyleScope>;
    const draft = invoice.status === 'draft';
    const xmlSelected = invoice.eInvoice?.format === 'xrechnung';
    const paymentAllowed = canChangeStatus && invoice.officeManaged && ['ready', 'sent', 'partly_paid', 'overdue'].includes(invoice.status) && invoice.openCents != null && invoice.openCents > 0;
    const tone = invoice.status === 'paid' ? 'success' : invoice.status === 'overdue' ? 'error' : invoice.status === 'draft' ? 'warning' : 'blue';
    return <NativeWorkspaceStyleScope css={[invoiceEditorCss]}>{<NativeSection className="ie ie-fade" data-testid="invoice-detail" data-healthos-invoice-revision="office-invoices-20261018">
    <NativeHeader className="ie-header"><NativeDiv className="ie-heading"><NativeSpan className="ie-mark" aria-hidden="true">▤</NativeSpan><NativeDiv><NativeP className="ie-eyebrow">Office · Rechnungen</NativeP><NativeH1>{invoice.invoiceNumber || 'Rechnungsentwurf'}</NativeH1><NativeP>{invoice.clientName} · {invoiceEditorDate(invoice.servicePeriodStart)} bis {invoiceEditorDate(invoice.servicePeriodEnd)}</NativeP></NativeDiv></NativeDiv><NativeDiv className="ie-actions"><NativeSpan className="ie-badge" data-tone={tone}>{INVOICE_STATUS_LABELS[invoice.status]}</NativeSpan><NativeButton disabled={!!busy} onClick={async () => { if (await mayLeave())
        router.back(); }}>Zurück</NativeButton><NativeButton disabled={!!busy || query.refreshing} onClick={async () => { if (await mayLeave()) {
        discardInputs();
        leaveAllowed.current = false;
        void query.refresh();
    } }}>↻ Aktualisieren</NativeButton>{canEdit && draft && <NativeButton className="ie-primary" disabled={actionDisabled} onClick={async () => { if (await mayLeave())
        router.push(`/business/office/invoices/${invoice.id}/edit` as never); }}>Entwurf bearbeiten</NativeButton>}</NativeDiv></NativeHeader>
    {notice && <NativeDiv className="ie-notice" data-tone={notice.tone} role={notice.tone === 'error' ? 'alert' : 'status'}>{notice.text}</NativeDiv>}
    {queryError && <NativeDiv className="ie-notice" data-tone="error" role="alert">{queryError}<NativeBr />Angezeigt wird der letzte erfolgreiche Stand. Änderungen sind bis zum erneuten Laden gesperrt.</NativeDiv>}
    {invoice.issues.length > 0 && <NativeDiv className="ie-notice" data-tone="warning"><NativeStrong>Diese Angaben benötigen eine Prüfung:</NativeStrong><NativeUl>{invoice.issues.map(issue => <NativeLi key={issue}>{issue}</NativeLi>)}</NativeUl></NativeDiv>}
    <NativeDiv className="ie-kpis"><NativeDiv className="ie-kpi"><NativeSpan>Rechnungsbetrag</NativeSpan><NativeStrong>{money(invoice.amountCents)}</NativeStrong></NativeDiv><NativeDiv className="ie-kpi"><NativeSpan>Gebuchte Zahlungen</NativeSpan><NativeStrong>{money(invoice.paidCents)}</NativeStrong></NativeDiv><NativeDiv className="ie-kpi"><NativeSpan>Offener Betrag</NativeSpan><NativeStrong>{money(invoice.openCents)}</NativeStrong></NativeDiv></NativeDiv>
    <NativeDiv className="ie-layout"><NativeDiv className="ie-main"><NativeSection className="ie-panel"><NativeDiv className="ie-panel-head"><NativeDiv><NativeH2>Empfänger & Rechnungsdaten</NativeH2><NativeP>{draft ? 'Gespeicherter Entwurf' : 'Gespeicherter Rechnungsstand'}</NativeP></NativeDiv>{canOpenClient && invoice.clientId && <NativeButton className="ie-link" disabled={!!busy} onClick={async () => { if (await mayLeave())
        router.push(clientRecordRoute(invoice.clientId!) as never); }}>Klientenakte öffnen ↗</NativeButton>}</NativeDiv><NativeDiv className="ie-info"><NativeDl><NativeDt>Rechnungsempfänger</NativeDt><NativeDd>{invoice.recipient.name}{'\n'}{invoice.recipient.street} {invoice.recipient.houseNumber}{'\n'}{invoice.recipient.postalCode} {invoice.recipient.city}{'\n'}{invoice.recipient.country}{invoice.recipient.email ? `\n${invoice.recipient.email}` : ''}</NativeDd></NativeDl><NativeDl><NativeDt>Zugeordnete Klientin / zugeordneter Klient</NativeDt><NativeDd>{invoice.clientName}{invoice.clientNumber ? `\nKundennummer ${invoice.clientNumber}` : ''}</NativeDd></NativeDl><NativeDl><NativeDt>Rechnungsdatum</NativeDt><NativeDd>{invoiceEditorDate(invoice.invoiceDate)}</NativeDd></NativeDl><NativeDl><NativeDt>Fälligkeit</NativeDt><NativeDd>{invoiceEditorDate(invoice.dueDate)}</NativeDd></NativeDl><NativeDl><NativeDt>Leistungszeitraum</NativeDt><NativeDd>{invoiceEditorDate(invoice.servicePeriodStart)} – {invoiceEditorDate(invoice.servicePeriodEnd)}</NativeDd></NativeDl><NativeDl><NativeDt>Leistungsnachweise als Anlage</NativeDt><NativeDd>{invoice.includeProofs ? `${invoice.selectedProofIds.length} ausgewählt` : 'Ohne Anlagen'}</NativeDd></NativeDl></NativeDiv></NativeSection>
    {invoice.eInvoice && <EInvoiceReadOnlySummary value={invoice.eInvoice} draft={draft} context={{ invoiceDate: invoice.invoiceDate, servicePeriodStart: invoice.servicePeriodStart, servicePeriodEnd: invoice.servicePeriodEnd, totalCents: invoice.amountCents, lines: invoice.lines }}/>}
    <NativeSection className="ie-panel"><NativeDiv className="ie-panel-head"><NativeH2>Rechnungspositionen</NativeH2><NativeSpan className="ie-badge">{invoice.lines.length} Positionen</NativeSpan></NativeDiv><NativeDiv className="ie-table-scroll"><NativeTable><NativeThead><NativeTr><NativeTh>Leistung</NativeTh><NativeTh className="ie-number">Menge</NativeTh><NativeTh className="ie-number">Einzelpreis netto</NativeTh><NativeTh className="ie-number">USt.</NativeTh><NativeTh className="ie-number">Brutto</NativeTh></NativeTr></NativeThead><NativeTbody>{invoice.lines.map(line => <NativeTr key={line.id}><NativeTd>{line.description}{line.serviceDate && <NativeSmall>{invoiceEditorDate(line.serviceDate)}</NativeSmall>}{line.serviceRecordId && <NativeSmall>Aus Leistungsnachweis</NativeSmall>}{line.eInvoiceTax?.category && <NativeSmall>{eInvoiceTaxLabels[line.eInvoiceTax.category]}{line.eInvoiceTax.exemptionReason ? ` · ${line.eInvoiceTax.exemptionReason}` : ''}</NativeSmall>}</NativeTd><NativeTd className="ie-number">{Number.isFinite(line.quantity) ? new Intl.NumberFormat('de-DE', { maximumFractionDigits: 4 }).format(line.quantity) : '—'} {unitLabels[line.unit] || line.unit}</NativeTd><NativeTd className="ie-number">{Number.isFinite(line.unitPriceCents) ? money(line.unitPriceCents) : '—'}</NativeTd><NativeTd className="ie-number">{Number.isFinite(line.taxRatePercent) ? `${line.taxRatePercent} %` : '—'}</NativeTd><NativeTd className="ie-number">{money(line.totalCents)}</NativeTd></NativeTr>)}</NativeTbody></NativeTable></NativeDiv><NativeDiv className="ie-summary"><NativeDiv className="ie-total"><NativeSpan>Rechnungsbetrag</NativeSpan><NativeStrong>{money(invoice.amountCents)}</NativeStrong></NativeDiv></NativeDiv>{!invoice.lines.length && <NativeP className="ie-inline-note">Es sind keine Positionen hinterlegt. Den Entwurf vor der Freigabe bearbeiten.</NativeP>}</NativeSection>
    {draft && xmlSelected && <EInvoiceXmlPreview {...{ tenantId, invoice, roleKey }} disabled={actionDisabled}/>}
    {!draft && xmlSelected && <EInvoiceOriginalDownload {...{ tenantId, invoice, roleKey }} disabled={actionDisabled}/>}
    {(invoice.footerText || invoice.notes) && <NativeSection className="ie-panel"><NativeDiv className="ie-panel-head"><NativeH2>Hinweise</NativeH2></NativeDiv><NativeDiv className="ie-info">{invoice.footerText && <NativeDl><NativeDt>Text auf der Rechnung</NativeDt><NativeDd>{invoice.footerText}</NativeDd></NativeDl>}{invoice.notes && <NativeDl><NativeDt>Interne Notiz</NativeDt><NativeDd>{invoice.notes}</NativeDd></NativeDl>}</NativeDiv></NativeSection>}
    <NativeSection className="ie-panel"><NativeDiv className="ie-panel-head"><NativeDiv><NativeH2>Nächster Schritt</NativeH2><NativeP>{draft ? xmlSelected ? 'Die strukturierten Angaben prüfen und die XRechnung nach der Normprüfung ausstellen.' : 'Den Entwurf prüfen und anschließend verbindlich freigeben.' : invoice.status === 'ready' ? xmlSelected ? 'Die gespeicherte XML-Datei übermitteln und den Versand dokumentieren.' : 'Das gespeicherte PDF übermitteln und den Versand dokumentieren.' : invoice.status === 'paid' ? 'Die Rechnung ist vollständig bezahlt.' : 'Zahlungseingänge und den gespeicherten Rechnungsstand prüfen.'}</NativeP></NativeDiv></NativeDiv>
      {!canChangeStatus ? <NativeP className="ie-inline-note">Ihre Rolle kann Rechnungen ansehen. Freigaben und Zahlungen sind nicht freigeschaltet.</NativeP> : <NativeDiv className="ie-actions">{draft && invoice.officeManaged && <><NativeButton className="ie-primary" disabled={actionDisabled || invoice.amountCents == null || !invoice.lines.length} onClick={() => void issue()}>{busy === 'issue' ? xmlSelected ? 'XRechnung wird geprüft und ausgestellt …' : 'Rechnung wird freigegeben …' : xmlSelected ? 'XRechnung ausstellen' : 'Rechnung freigeben'}</NativeButton><NativeButton className="ie-danger" disabled={actionDisabled} onClick={() => void remove()}>Entwurf verwerfen</NativeButton></>}{!draft && invoice.officeManaged && invoice.status === 'ready' && <NativeButton disabled={actionDisabled} onClick={async () => await openForm('delivery')}>Erfolgten Versand dokumentieren</NativeButton>}{paymentAllowed && <NativeButton className="ie-primary" disabled={actionDisabled} onClick={async () => await openForm('payment')}>Zahlungseingang erfassen</NativeButton>}</NativeDiv>}
      {draft && xmlSelected && <NativeP className="ie-inline-note">Vor der Ausstellung werden die endgültigen XML-Daten vollständig gegen den gewählten Standard geprüft. Fehler verhindern die Freigabe. Die PDF bleibt eine lesbare Darstellung; maßgeblich ist die gespeicherte XML-Datei.</NativeP>}
      {draft && !invoice.officeManaged && <NativeP className="ie-inline-note">Diesen älteren Entwurf zuerst bearbeiten und speichern. Danach stehen Freigabe und Verwerfen zur Verfügung.</NativeP>}{!draft && <NativeP className="ie-inline-note">Freigegebene Rechnungsdaten sind unveränderlich. Der Zahlungsstatus ergibt sich aus den gebuchten Zahlungseingängen.</NativeP>}{!draft && !invoice.officeManaged && <NativeP className="ie-inline-note">Diese bestehende Rechnung wurde vor dem neuen Rechnungsablauf erstellt. Sie wird schreibgeschützt angezeigt.</NativeP>}
      {form === 'payment' && <NativeDiv><NativeDiv className="ie-divider"/><NativeH3>Zahlungseingang buchen</NativeH3><NativeP className="ie-inline-note">Nur tatsächlich eingegangene Zahlungen erfassen.</NativeP><NativeDiv className="ie-fields"><NativeLabel className="ie-field">Betrag (€)<NativeInput value={payment.amount} inputMode="decimal" disabled={!!busy} onChange={event => setPayment(current => ({ ...current, amount: event.target.value }))}/>{invoice.openCents != null && <NativeButton className="ie-link" disabled={!!busy} onClick={() => setPayment(current => ({ ...current, amount: (invoice.openCents! / 100).toFixed(2).replace('.', ',') }))}>Offenen Betrag übernehmen</NativeButton>}</NativeLabel><NativeLabel className="ie-field">Zahlungsdatum<NativeInput type="date" max={invoiceEditorToday()} value={payment.paymentDate} disabled={!!busy} onChange={event => setPayment(current => ({ ...current, paymentDate: event.target.value }))}/></NativeLabel><NativeLabel className="ie-field">Zahlungsart<NativeSelect value={payment.method} disabled={!!busy} onChange={event => setPayment(current => ({ ...current, method: event.target.value as OfficeInvoicePaymentInput['method'] }))}>{paymentMethods.map(method => <NativeOption key={method.value} value={method.value}>{method.label}</NativeOption>)}</NativeSelect></NativeLabel><NativeLabel className="ie-field">Buchungsreferenz<NativeInput maxLength={500} value={payment.reference} placeholder="Zum Beispiel Kontoauszug / Buchungsnummer" disabled={!!busy} onChange={event => setPayment(current => ({ ...current, reference: event.target.value }))}/></NativeLabel><NativeLabel className="ie-field ie-field-wide">Interner Vermerk, optional<NativeTextarea maxLength={10000} value={payment.notes} disabled={!!busy} onChange={event => setPayment(current => ({ ...current, notes: event.target.value }))}/></NativeLabel></NativeDiv><NativeDiv className="ie-footer"><NativeButton disabled={!!busy} onClick={async () => await openForm(null)}>Abbrechen</NativeButton><NativeButton className="ie-primary" disabled={actionDisabled} onClick={() => void savePayment()}>{busy === 'payment' ? 'Wird gebucht …' : 'Zahlung buchen'}</NativeButton></NativeDiv></NativeDiv>}
      {form === 'delivery' && <NativeDiv><NativeDiv className="ie-divider"/><NativeH3>Bereits erfolgte Übermittlung dokumentieren</NativeH3><NativeP className="ie-inline-note">Hier wird der tatsächliche Versand vermerkt. Die Aktion versendet selbst keine E-Mail.</NativeP><NativeDiv className="ie-fields"><NativeLabel className="ie-field">Übermittelt per<NativeSelect value={delivery.channel} disabled={!!busy} onChange={event => setDelivery(current => ({ ...current, channel: event.target.value as OfficeInvoiceDeliveryEvidence['channel'] }))}><NativeOption value="email">E-Mail</NativeOption><NativeOption value="post">Post</NativeOption><NativeOption value="personal">Persönlich übergeben</NativeOption><NativeOption value="other">Sonstiger Weg</NativeOption></NativeSelect></NativeLabel><NativeLabel className="ie-field">Versanddatum<NativeInput type="date" max={invoiceEditorToday()} value={delivery.date} disabled={!!busy} onChange={event => setDelivery(current => ({ ...current, date: event.target.value }))}/></NativeLabel><NativeLabel className="ie-field ie-field-wide">Versandnachweis / Referenz<NativeInput maxLength={500} value={delivery.reference} placeholder="Empfänger, Übergabevermerk oder Versandreferenz" disabled={!!busy} onChange={event => setDelivery(current => ({ ...current, reference: event.target.value }))}/></NativeLabel></NativeDiv><NativeLabel className="ie-choice"><NativeInput type="checkbox" checked={deliveryConfirmed} disabled={!!busy} onChange={event => setDeliveryConfirmed(event.target.checked)}/><NativeSpan>Die Rechnung wurde tatsächlich über den angegebenen Weg übermittelt.</NativeSpan></NativeLabel><NativeDiv className="ie-footer"><NativeButton disabled={!!busy} onClick={async () => await openForm(null)}>Abbrechen</NativeButton><NativeButton className="ie-primary" disabled={actionDisabled || !deliveryConfirmed} onClick={() => void saveDelivery()}>{busy === 'delivery' ? 'Wird gespeichert …' : 'Übermittlung dokumentieren'}</NativeButton></NativeDiv></NativeDiv>}
    </NativeSection>
    </NativeDiv><NativeAside className="ie-panel ie-preview-sticky"><InvoicePdfPreview {...{ tenantId, roleKey, invoice }} proofIds={invoice.selectedProofIds} allowProofSelection={false} disabled={actionDisabled}/></NativeAside></NativeDiv>
  </NativeSection>}</NativeWorkspaceStyleScope>;
}
