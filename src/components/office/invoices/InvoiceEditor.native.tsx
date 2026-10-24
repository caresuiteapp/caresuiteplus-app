// Generated native presentation from src/components/office/invoices/InvoiceEditor.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {useNativeWorkflowWindow} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {nativeCrypto as crypto,nativeWindow as window} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {NativeSection,NativeSpan,NativeH2,NativeP,NativeButton,NativeHeader,NativeDiv,NativeH1,NativeBr,NativeStrong,NativeUl,NativeLi,NativeLabel,NativeSelect,NativeOption,NativeSmall,NativeInput,NativeH3,NativeDatalist,NativeTextarea,NativeAside,NativeFooter} from '@/components/layout/NativeWorkspaceElements.native';
import {confirmNativeWorkspaceAction,runNativeWorkspaceEffect} from '@/lib/platform/nativeWorkspaceActions.native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigation, useRouter } from 'expo-router';
import { usePreventRemove } from "@/hooks/useNativePreventRemove.native";
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { calculateOfficeInvoiceLines, fetchOfficeInvoiceEditorOptions, saveOfficeInvoiceDraft, validateOfficeInvoiceDraft } from "../../../lib/office/invoiceWorkspaceService.native.ts";
import type { InvoiceOfficeDraft, OfficeInvoice, OfficeInvoiceDraftLine, OfficeInvoiceProductKey, OfficeInvoiceRecipient, OfficeInvoiceRecipientType, OfficeInvoiceBillingParty, OfficeInvoiceClient } from "../../../lib/office/invoiceWorkspaceService.native.ts";
import type { RoleKey } from '@/types';
import { InvoicePdfPreview } from "./InvoicePdfPreview.native.tsx";
import { EInvoiceLineTaxFields, EInvoiceSettingsPanel } from "./EInvoiceSettingsPanel.native.tsx";
import { createEmptyOfficeEInvoiceMetadata, normalizeOfficeEInvoiceMetadata } from "../../../lib/office/eInvoiceModel.native.ts";
import { invoiceEditorDueDate, invoiceEditorMoney, invoiceEditorMonthPeriod, invoiceEditorToday, parseInvoiceEditorDecimal, validateInvoiceEditorLineText, type InvoiceEditorLineText } from "./invoiceEditorModel.native.ts";
const modules: {
    value: OfficeInvoiceProductKey;
    label: string;
}[] = [{ value: 'assist', label: 'Assist' }, { value: 'pflege', label: 'Pflege' }, { value: 'stationaer', label: 'Stationär' }, { value: 'beratung', label: 'Beratung' }];
const emptyRecipient: OfficeInvoiceRecipient = { name: '', street: '', houseNumber: '', postalCode: '', city: '', country: 'Deutschland', email: '' };
function clientBilling(client: OfficeInvoiceClient): Pick<InvoiceOfficeDraft, 'recipient' | 'recipientType' | 'billingParty'> {
    if (['care_insurance', 'health_insurance', 'social_welfare'].includes(client.billingParty))
        return {
            billingParty: client.billingParty as OfficeInvoiceBillingParty,
            recipientType: client.billingParty as OfficeInvoiceRecipientType,
            recipient: { ...emptyRecipient, name: ['care_insurance', 'health_insurance'].includes(client.billingParty) ? client.insuranceName : '' },
        };
    return { recipient: { ...client.recipient }, recipientType: 'client', billingParty: 'self_payer' };
}
type Props = {
    tenantId: string;
    roleKey: RoleKey;
    initialInvoice?: OfficeInvoice;
    initialModule?: OfficeInvoiceProductKey;
    initialClientId?: string;
    scopeKey: string;
    onReload?: () => Promise<void>;
};
function freshLine(productKey: OfficeInvoiceProductKey): OfficeInvoiceDraftLine { return { description: '', quantity: 1, unit: 'hour', unitPriceCents: 0, taxRatePercent: 0, productKey }; }
function lineText(line: OfficeInvoiceDraftLine): InvoiceEditorLineText { return { quantity: Number.isFinite(line.quantity) ? String(line.quantity).replace('.', ',') : '', price: Number.isSafeInteger(line.unitPriceCents) ? (line.unitPriceCents / 100).toFixed(2).replace('.', ',') : '', tax: Number.isFinite(line.taxRatePercent) ? String(line.taxRatePercent).replace('.', ',') : '' }; }
export function makeInvoiceEditorDraft(invoice?: OfficeInvoice, module: OfficeInvoiceProductKey = 'assist'): InvoiceOfficeDraft {
    const today = invoiceEditorToday();
    const period = invoiceEditorMonthPeriod(today);
    if (invoice)
        return { id: invoice.id, expectedUpdatedAt: invoice.updatedAt, requestId: crypto.randomUUID(), clientId: invoice.clientId ?? '', invoiceNumber: invoice.invoiceNumber.startsWith('DRAFT-') ? '' : invoice.invoiceNumber, invoiceDate: invoice.invoiceDate, dueDate: invoice.dueDate ?? '', servicePeriodStart: invoice.servicePeriodStart ?? '', servicePeriodEnd: invoice.servicePeriodEnd ?? '', clientName: invoice.clientName, clientNumber: invoice.clientNumber, insuranceNumber: invoice.insuranceNumber, recipient: { ...invoice.recipient }, recipientType: invoice.recipientType ?? 'other', billingParty: invoice.billingParty ?? 'other', notes: invoice.notes ?? '', footerText: invoice.footerText ?? '', includeProofs: invoice.includeProofs, selectedProofIds: invoice.selectedProofIds, lines: invoice.lines.map(line => ({ ...line })), eInvoice: normalizeOfficeEInvoiceMetadata(invoice.eInvoice) };
    return { requestId: crypto.randomUUID(), clientId: '', invoiceNumber: '', invoiceDate: today, dueDate: invoiceEditorDueDate(today, 14), servicePeriodStart: period.start, servicePeriodEnd: period.end, recipient: { ...emptyRecipient }, recipientType: 'client', billingParty: 'self_payer', notes: '', footerText: '', includeProofs: false, selectedProofIds: [], lines: [freshLine(module)], eInvoice: createEmptyOfficeEInvoiceMetadata() };
}
export function InvoiceEditor({ tenantId, roleKey, initialInvoice, initialModule = 'assist', initialClientId, scopeKey, onReload }: Props) {
    const window = useNativeWorkflowWindow();
    const router = useRouter();
    const navigation = useNavigation();
    const [draft, setDraft] = useState(() => makeInvoiceEditorDraft(initialInvoice, initialModule));
    const [texts, setTexts] = useState(() => draft.lines.map(lineText));
    const [catalogId, setCatalogId] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [savedId, setSavedId] = useState('');
    const [showIssues, setShowIssues] = useState(false);
    const initial = useRef(JSON.stringify(draft));
    const lock = useRef(false);
    const mounted = useRef(true);
    const leaveAllowed = useRef(false);
    const requestSnapshot = useRef({ key: '', id: draft.requestId });
    const options = useAsyncQuery(() => fetchOfficeInvoiceEditorOptions(tenantId, roleKey), [tenantId, roleKey], { queryKey: scopeKey, retryCount: 0 });
    const dirty = JSON.stringify(draft) !== initial.current && !savedId;
    const dirtyRef = useRef(dirty);
    dirtyRef.current = dirty;
    const validation = useMemo(() => [...texts.flatMap((text, index) => { const issue = validateInvoiceEditorLineText(text); return issue ? [`Position ${index + 1}: ${issue}`] : []; }), ...validateOfficeInvoiceDraft(draft)], [draft, texts]);
    const validLines = texts.every(text => !validateInvoiceEditorLineText(text));
    const totals = useMemo(() => { try {
        return validLines ? calculateOfficeInvoiceLines(draft.lines) : null;
    }
    catch {
        return null;
    } }, [draft.lines, validLines]);
    const stale = !!options.error || !!options.refreshError || options.loading || options.refreshing || !options.data;
    const selectedClient = options.data?.clients.find(client => client.id === draft.clientId);
    const linked = draft.lines.some(line => !!line.serviceRecordId);
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    useEffect(() => {
        if (!initialClientId || initialInvoice || dirtyRef.current || !options.data)
            return;
        const client = options.data.clients.find(item => item.id === initialClientId);
        if (client) {
            const next = { ...draft, clientId: client.id, clientName: client.name, clientNumber: client.clientNumber, insuranceNumber: client.insuranceNumber, ...clientBilling(client) };
            setDraft(next);
            initial.current = JSON.stringify(next);
        }
        // Initial URL selection is applied once, after the authoritative client list is ready.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [options.data, initialClientId, initialInvoice]);
    async function canLeave() {
        if (lock.current)
            return false;
        if (leaveAllowed.current || !dirtyRef.current)
            return true;
        if (!await confirmNativeWorkspaceAction('Ungespeicherte Änderungen an der Rechnung verwerfen?'))
            return false;
        leaveAllowed.current = true;
        dirtyRef.current = false;
        return true;
    }
    usePreventRemove(dirty || busy, async ({ data }) => { if (await canLeave())
        navigation.dispatch(data.action); });
    useEffect(() => { if (!dirty && !busy)
        return; const leave = (event: BeforeUnloadEvent) => { if (!leaveAllowed.current) {
        event.preventDefault();
        event.returnValue = '';
    } }; window.addEventListener('beforeunload', leave); return () => window.removeEventListener('beforeunload', leave); }, [dirty, busy]);
    function patch<K extends keyof InvoiceOfficeDraft>(key: K, value: InvoiceOfficeDraft[K]) { if (lock.current)
        return; leaveAllowed.current = false; setDraft(current => ({ ...current, [key]: value })); setError(''); }
    function recipient<K extends keyof OfficeInvoiceRecipient>(key: K, value: OfficeInvoiceRecipient[K]) { patch('recipient', { ...draft.recipient, [key]: value }); }
    function patchLine(index: number, change: Partial<OfficeInvoiceDraftLine>) { patch('lines', draft.lines.map((line, position) => position === index ? { ...line, ...change } : line)); }
    function numericLine(index: number, key: keyof InvoiceEditorLineText, text: string) {
        if (lock.current)
            return;
        setTexts(current => current.map((line, position) => position === index ? { ...line, [key]: text } : line));
        const value = parseInvoiceEditorDecimal(text, 2);
        patchLine(index, key === 'quantity' ? { quantity: value ?? Number.NaN } : key === 'price' ? { unitPriceCents: value == null ? Number.NaN : Math.round(value * 100) } : { taxRatePercent: value ?? Number.NaN });
    }
    function addLine() { const line = freshLine(initialModule); patch('lines', [...draft.lines, line]); setTexts(current => [...current, lineText(line)]); }
    async function removeLine(index: number) {
        if (lock.current)
            return;
        if (draft.lines[index]?.serviceRecordId && !await confirmNativeWorkspaceAction('Diese Position aus dem Entwurf entfernen? Der Leistungsnachweis wird nach dem Speichern wieder für einen späteren Rechnungslauf frei.'))
            return;
        patch('lines', draft.lines.filter((_, position) => position !== index));
        setTexts(current => current.filter((_, position) => position !== index));
    }
    function addCatalog() {
        const item = options.data?.catalog.find(entry => entry.id === catalogId);
        if (!item || lock.current)
            return;
        const line: OfficeInvoiceDraftLine = { description: item.name, quantity: 1, unit: item.unit, unitPriceCents: item.unitPriceCents, taxRatePercent: item.taxRatePercent, productKey: item.productKey };
        const replaceEmpty = draft.lines.length === 1 && !draft.lines[0].description.trim() && !draft.lines[0].serviceRecordId && draft.lines[0].unitPriceCents === 0;
        setDraft(current => ({ ...current, lines: replaceEmpty ? [line] : [...current.lines, line], footerText: current.footerText || item.taxNotice }));
        setTexts(current => replaceEmpty ? [lineText(line)] : [...current, lineText(line)]);
        setCatalogId('');
        setError('');
    }
    async function changeClient(id: string) {
        if (linked || lock.current || (draft.clientId && draft.clientId !== id && !await confirmNativeWorkspaceAction('Klientenzuordnung und Empfängeranschrift wechseln? Bereits eingegebene Positionen bleiben erhalten.')))
            return;
        const client = options.data?.clients.find(item => item.id === id);
        setDraft(current => ({ ...current, clientId: id, clientName: client?.name ?? '', clientNumber: client?.clientNumber ?? '', insuranceNumber: client?.insuranceNumber ?? '', ...(client ? clientBilling(client) : { recipient: { ...emptyRecipient }, recipientType: 'client' as const, billingParty: 'self_payer' as const }), selectedProofIds: [], eInvoice: { ...createEmptyOfficeEInvoiceMetadata(), format: current.eInvoice?.format ?? 'pdf', sellerCountryCode: current.eInvoice?.sellerCountryCode ?? '', sellerIdentifier: current.eInvoice?.sellerIdentifier ?? '', sellerEndpoint: current.eInvoice?.sellerEndpoint ?? { schemeId: '', value: '' }, sellerContact: current.eInvoice?.sellerContact ?? { name: '', phone: '', email: '' }, legal: { ...createEmptyOfficeEInvoiceMetadata().legal, sellerDomestic: current.eInvoice?.legal.sellerDomestic ?? 'unknown', sellerSmallBusiness: current.eInvoice?.legal.sellerSmallBusiness ?? 'unknown', priorYearRevenueCents: current.eInvoice?.legal.priorYearRevenueCents ?? null, priorYearRevenueYear: current.eInvoice?.legal.priorYearRevenueYear ?? null, transmissionDate: current.eInvoice?.legal.transmissionDate ?? '' } } }));
    }
    async function save() {
        if (lock.current || stale || savedId)
            return;
        setShowIssues(true);
        setError('');
        if (validation.length)
            return;
        const payloadKey = JSON.stringify({ ...draft, requestId: undefined });
        if (requestSnapshot.current.key !== payloadKey)
            requestSnapshot.current = { key: payloadKey, id: crypto.randomUUID() };
        lock.current = true;
        setBusy(true);
        try {
            const result = await saveOfficeInvoiceDraft(tenantId, { ...draft, requestId: requestSnapshot.current.id }, roleKey);
            if (!mounted.current)
                return;
            if (!result.ok) {
                setError(result.error);
                return;
            }
            leaveAllowed.current = true;
            dirtyRef.current = false;
            initial.current = JSON.stringify(draft);
            setSavedId(result.data.id);
        }
        catch (cause) {
            if (mounted.current)
                setError(cause instanceof Error ? cause.message : 'Der Entwurf konnte nicht gespeichert werden. Bitte den gespeicherten Stand prüfen.');
        }
        finally {
            lock.current = false;
            if (mounted.current)
                setBusy(false);
        }
    }
    async function reloadInvoice() {
        if (!onReload || !await canLeave())
            return;
        lock.current = true;
        setBusy(true);
        setError('');
        try {
            await onReload();
        }
        catch (cause) {
            if (mounted.current) {
                leaveAllowed.current = false;
                setError(cause instanceof Error ? cause.message : 'Der aktuelle Rechnungsstand konnte nicht geladen werden.');
            }
        }
        finally {
            lock.current = false;
            if (mounted.current)
                setBusy(false);
        }
    }
    if (savedId)
        return <NativeSection className="ie ie-panel ie-empty" data-testid="invoice-editor-saved"><NativeSpan className="ie-badge" data-tone="success">Gespeichert</NativeSpan><NativeH2>Rechnungsentwurf gespeichert</NativeH2><NativeP>Der Entwurf kann jetzt geprüft, weiterbearbeitet oder freigegeben werden.</NativeP><NativeButton className="ie-primary" onClick={() => router.replace(`/business/office/invoices/${savedId}` as never)}>Rechnung öffnen</NativeButton></NativeSection>;
    return <NativeSection className="ie ie-fade" data-testid="invoice-editor">
    <NativeHeader className="ie-header"><NativeDiv className="ie-heading"><NativeSpan className="ie-mark" aria-hidden="true">▤</NativeSpan><NativeDiv><NativeP className="ie-eyebrow">Office · Rechnungen</NativeP><NativeH1>{initialInvoice ? 'Entwurf bearbeiten' : 'Einzelrechnung erstellen'}</NativeH1><NativeP>{(initialInvoice?.invoiceNumber.startsWith('DRAFT-') ? '' : initialInvoice?.invoiceNumber) || 'Empfänger und Positionen festlegen. Vor dem Speichern als PDF prüfen.'}</NativeP></NativeDiv></NativeDiv><NativeDiv className="ie-actions"><NativeButton disabled={busy} onClick={async () => { if (await canLeave())
        router.back(); }}>Zurück</NativeButton><NativeButton className="ie-primary" disabled={busy || stale} onClick={() => void save()}>{busy ? 'Wird gespeichert …' : 'Entwurf speichern'}</NativeButton></NativeDiv></NativeHeader>
    {(options.error || options.refreshError) && <NativeDiv className="ie-notice" data-tone="error" role="alert">{options.error || options.refreshError}<NativeBr />Änderungen bleiben bis zum erfolgreichen Laden gesperrt. <NativeButton disabled={busy} onClick={() => void options.refresh()}>Erneut laden</NativeButton></NativeDiv>}
    {error && <NativeDiv className="ie-notice" data-tone="error" role="alert">{error}{onReload && <><NativeBr /><NativeButton disabled={busy} onClick={() => void reloadInvoice()}>Aktuellen Rechnungsstand laden</NativeButton></>}</NativeDiv>}
    {showIssues && validation.length > 0 && <NativeDiv className="ie-notice" data-tone="error" role="alert"><NativeStrong>Bitte vor dem Speichern prüfen:</NativeStrong><NativeUl>{[...new Set(validation)].map(issue => <NativeLi key={issue}>{issue}</NativeLi>)}</NativeUl></NativeDiv>}
    {initialInvoice && (!initialInvoice.recipientType || !initialInvoice.billingParty) && <NativeDiv className="ie-notice" data-tone="warning">In diesem älteren Entwurf fehlen Empfängerart und Kostenträger. Bitte die Zuordnung vor dem Speichern prüfen.</NativeDiv>}{options.loading && <NativeDiv className="ie-notice" role="status">Klienten und Leistungskatalog werden geladen …</NativeDiv>}
    <NativeDiv className="ie-layout"><NativeDiv className="ie-main"><NativeSection className="ie-panel"><NativeDiv className="ie-panel-head"><NativeDiv><NativeP className="ie-step">01 · EMPFÄNGER & ZEITRAUM</NativeP><NativeH2>Rechnungsangaben</NativeH2></NativeDiv><NativeSpan className="ie-badge">Entwurf</NativeSpan></NativeDiv>
      <NativeDiv className="ie-fields"><NativeLabel className="ie-field ie-field-wide">Klient:in<NativeSelect value={draft.clientId} disabled={busy || stale || linked} onChange={async (event) => await changeClient(event.target.value)}><NativeOption value="">Klient:in auswählen</NativeOption>{options.data?.clients.map(client => <NativeOption value={client.id} key={client.id}>{client.name}{client.clientNumber ? ` · ${client.clientNumber}` : ''}{client.status !== 'active' && client.status !== 'aktiv' ? ' · nicht aktiv' : ''}</NativeOption>)}{draft.clientId && !selectedClient && <NativeOption value={draft.clientId}>{initialInvoice?.clientName ?? 'Zugeordnete Klientenakte'}</NativeOption>}</NativeSelect>{linked && <NativeSmall>Die Zuordnung ist durch die übernommenen Leistungsnachweise festgelegt.</NativeSmall>}{selectedClient?.insuranceName && <NativeSmall>{selectedClient.insuranceName}{selectedClient.insuranceNumber ? ` · Versichertennummer ${selectedClient.insuranceNumber}` : ''}</NativeSmall>}</NativeLabel>
      <NativeLabel className="ie-field">Rechnungsdatum<NativeInput type="date" value={draft.invoiceDate} disabled={busy} onChange={event => patch('invoiceDate', event.target.value)}/></NativeLabel><NativeLabel className="ie-field">Fällig am<NativeInput type="date" min={draft.invoiceDate} value={draft.dueDate} disabled={busy} onChange={event => patch('dueDate', event.target.value)}/><NativeDiv className="ie-actions">{[7, 14, 30].map(days => <NativeButton type="button" className="ie-link" key={days} disabled={busy} onClick={() => patch('dueDate', invoiceEditorDueDate(draft.invoiceDate, days))}>{days} Tage</NativeButton>)}</NativeDiv></NativeLabel>
      <NativeLabel className="ie-field">Leistungszeitraum von<NativeInput type="date" value={draft.servicePeriodStart} max={draft.servicePeriodEnd || undefined} disabled={busy || linked} onChange={event => { patch('servicePeriodStart', event.target.value); }}/></NativeLabel><NativeLabel className="ie-field">Leistungszeitraum bis<NativeInput type="date" value={draft.servicePeriodEnd} min={draft.servicePeriodStart || undefined} disabled={busy || linked} onChange={event => patch('servicePeriodEnd', event.target.value)}/></NativeLabel>
      <NativeLabel className="ie-field ie-field-wide">Rechnungsnummer<NativeInput value={draft.invoiceNumber} maxLength={120} disabled placeholder="Wird bei der Freigabe automatisch vergeben"/><NativeSmall>Die endgültige Rechnungsnummer wird bei der Freigabe automatisch vergeben.</NativeSmall></NativeLabel></NativeDiv>
      <NativeDiv className="ie-divider"/><NativeDiv className="ie-panel-head"><NativeDiv><NativeH3>Rechnungsempfänger</NativeH3><NativeP>Die Anschrift wird mit der Rechnung gespeichert.</NativeP></NativeDiv>{selectedClient && <NativeButton className="ie-link" disabled={busy} onClick={async () => { if (await confirmNativeWorkspaceAction('Empfängeranschrift aus der Klientenakte übernehmen?'))
        setDraft(current => ({ ...current, recipient: { ...selectedClient.recipient }, recipientType: 'client', billingParty: 'self_payer' })); }}>Klientenanschrift übernehmen</NativeButton>}</NativeDiv>
      <NativeDiv className="ie-fields"><NativeLabel className="ie-field">Abrechnung über<NativeSelect value={draft.billingParty} disabled={busy} onChange={event => patch('billingParty', event.target.value as OfficeInvoiceBillingParty)}><NativeOption value="self_payer">Selbstzahler</NativeOption><NativeOption value="care_insurance">Pflegekasse</NativeOption><NativeOption value="health_insurance">Krankenkasse</NativeOption><NativeOption value="social_welfare">Sozialhilfeträger</NativeOption><NativeOption value="other">Sonstiger Kostenträger</NativeOption></NativeSelect></NativeLabel><NativeLabel className="ie-field">Empfängerart<NativeSelect value={draft.recipientType} disabled={busy} onChange={event => patch('recipientType', event.target.value as OfficeInvoiceRecipientType)}><NativeOption value="client">Klient:in</NativeOption><NativeOption value="relative">Angehörige / Vertretung</NativeOption><NativeOption value="care_insurance">Pflegekasse</NativeOption><NativeOption value="health_insurance">Krankenkasse</NativeOption><NativeOption value="social_welfare">Sozialhilfeträger</NativeOption><NativeOption value="company">Unternehmen</NativeOption><NativeOption value="other">Sonstiger Empfänger</NativeOption></NativeSelect></NativeLabel><NativeLabel className="ie-field ie-field-wide">Name / Kostenträger<NativeInput maxLength={250} value={draft.recipient.name} disabled={busy} onChange={event => recipient('name', event.target.value)}/></NativeLabel><NativeLabel className="ie-field">Straße<NativeInput maxLength={250} value={draft.recipient.street} disabled={busy} onChange={event => recipient('street', event.target.value)}/></NativeLabel><NativeLabel className="ie-field">Hausnummer<NativeInput maxLength={40} value={draft.recipient.houseNumber} disabled={busy} onChange={event => recipient('houseNumber', event.target.value)}/></NativeLabel><NativeLabel className="ie-field">Postleitzahl<NativeInput maxLength={20} value={draft.recipient.postalCode} disabled={busy} onChange={event => recipient('postalCode', event.target.value)}/></NativeLabel><NativeLabel className="ie-field">Ort<NativeInput maxLength={150} value={draft.recipient.city} disabled={busy} onChange={event => recipient('city', event.target.value)}/></NativeLabel><NativeLabel className="ie-field">Land<NativeInput maxLength={100} list="invoice-country-options" value={draft.recipient.country} disabled={busy} onChange={event => recipient('country', event.target.value)}/><NativeDatalist id="invoice-country-options"><NativeOption>Deutschland</NativeOption><NativeOption>Österreich</NativeOption><NativeOption>Schweiz</NativeOption></NativeDatalist></NativeLabel><NativeLabel className="ie-field">E-Mail, optional<NativeInput type="email" maxLength={254} value={draft.recipient.email} disabled={busy} onChange={event => recipient('email', event.target.value)}/></NativeLabel></NativeDiv>
    </NativeSection>
    <EInvoiceSettingsPanel value={draft.eInvoice ?? createEmptyOfficeEInvoiceMetadata()} onChange={value => patch('eInvoice', value)} recipient={draft.recipient} clientRecipient={selectedClient?.recipient} context={{ invoiceDate: draft.invoiceDate, servicePeriodStart: draft.servicePeriodStart, servicePeriodEnd: draft.servicePeriodEnd, totalCents: totals?.totalCents ?? null, lines: draft.lines }} disabled={busy || stale}/>
    <NativeSection className="ie-panel"><NativeDiv className="ie-panel-head"><NativeDiv><NativeP className="ie-step">02 · LEISTUNGEN & BETRÄGE</NativeP><NativeH2>Positionen</NativeH2><NativeP>Einzelpreise netto. Steuern und Summen werden je Position berechnet.</NativeP></NativeDiv><NativeSpan className="ie-badge">{draft.lines.length} Positionen</NativeSpan></NativeDiv>
      {draft.lines.map((line, index) => <NativeDiv className="ie-line" key={line.id ?? `line-${index}`}><NativeDiv className="ie-line-top"><NativeStrong>Position {index + 1}</NativeStrong><NativeButton className="ie-remove ie-danger" disabled={busy} aria-label={`Position ${index + 1} entfernen`} onClick={async () => await removeLine(index)}>Entfernen</NativeButton></NativeDiv><NativeDiv className="ie-line-grid"><NativeLabel className="ie-field ie-line-description">Leistungsbeschreibung<NativeInput maxLength={1000} value={line.description} disabled={busy} onChange={event => patchLine(index, { description: event.target.value })}/></NativeLabel><NativeLabel className="ie-field ie-product">Bereich<NativeSelect disabled={busy || !!line.serviceRecordId} value={line.productKey} onChange={event => patchLine(index, { productKey: event.target.value as OfficeInvoiceProductKey })}>{modules.map(module => <NativeOption key={module.value} value={module.value}>{module.label}</NativeOption>)}</NativeSelect></NativeLabel><NativeLabel className="ie-field">Menge<NativeInput inputMode="decimal" value={texts[index]?.quantity ?? ''} disabled={busy || !!line.serviceRecordId} onChange={event => numericLine(index, 'quantity', event.target.value)}/></NativeLabel><NativeLabel className="ie-field">Einheit<NativeSelect value={line.unit} disabled={busy || !!line.serviceRecordId} onChange={event => patchLine(index, { unit: event.target.value, ...(line.eInvoiceTax ? { eInvoiceTax: { ...line.eInvoiceTax, unitCode: '' } } : {}) })}><NativeOption value="hour">Stunden</NativeOption><NativeOption value="minute">Minuten</NativeOption><NativeOption value="visit">Leistung</NativeOption><NativeOption value="day">Tage</NativeOption><NativeOption value="km">km</NativeOption><NativeOption value="flat">Pauschale</NativeOption>{!['hour', 'minute', 'visit', 'day', 'km', 'flat'].includes(line.unit) && <NativeOption value={line.unit}>{line.unit}</NativeOption>}</NativeSelect></NativeLabel><NativeLabel className="ie-field">Einzelpreis (€)<NativeInput inputMode="decimal" value={texts[index]?.price ?? ''} disabled={busy || !!line.serviceRecordId} onChange={event => numericLine(index, 'price', event.target.value)}/></NativeLabel><NativeLabel className="ie-field">USt. (%)<NativeInput inputMode="decimal" list="invoice-tax-rates" value={texts[index]?.tax ?? ''} disabled={busy || !!line.serviceRecordId} onChange={event => numericLine(index, 'tax', event.target.value)}/></NativeLabel></NativeDiv>{line.serviceRecordId && <NativeP className="ie-source-lock">Aus freigegebenem Leistungsnachweis übernommen. Mengen und Preise bleiben an den Nachweis gebunden.</NativeP>}<EInvoiceLineTaxFields value={line.eInvoiceTax} onChange={value => patchLine(index, { eInvoiceTax: value })} position={index + 1} disabled={busy || stale}/><NativeDiv className="ie-line-foot"><NativeSpan>{line.serviceDate ? `Leistung vom ${line.serviceDate.split('-').reverse().join('.')}` : 'Leistung im angegebenen Zeitraum'}</NativeSpan><NativeStrong>{totals?.lines[index] ? invoiceEditorMoney(totals.lines[index].totalCents) : '—'}</NativeStrong></NativeDiv></NativeDiv>)}
      <NativeDatalist id="invoice-tax-rates"><NativeOption>0</NativeOption><NativeOption>7</NativeOption><NativeOption>19</NativeOption></NativeDatalist>
      <NativeDiv className="ie-catalog"><NativeLabel className="ie-field">Leistung aus dem Katalog<NativeSelect value={catalogId} disabled={busy || stale} onChange={event => setCatalogId(event.target.value)}><NativeOption value="">Leistung auswählen</NativeOption>{options.data?.catalog.map(item => <NativeOption value={item.id} key={item.id}>{item.name} · {invoiceEditorMoney(item.unitPriceCents)} netto</NativeOption>)}</NativeSelect></NativeLabel><NativeButton disabled={busy || stale || !catalogId} onClick={addCatalog}>Übernehmen</NativeButton></NativeDiv><NativeButton disabled={busy || draft.lines.length >= 200} onClick={addLine}>+ Freie Position</NativeButton>
      <NativeP className="ie-inline-note">Vereinbarte Preisnachlässe direkt im Einzelpreis berücksichtigen und in der Leistungsbeschreibung benennen.</NativeP><NativeDiv className="ie-divider"/><NativeDiv className="ie-summary"><NativeDiv><NativeSpan>Nettobetrag</NativeSpan><NativeStrong>{totals ? invoiceEditorMoney(totals.netCents) : '—'}</NativeStrong></NativeDiv><NativeDiv><NativeSpan>Umsatzsteuer</NativeSpan><NativeStrong>{totals ? invoiceEditorMoney(totals.taxCents) : '—'}</NativeStrong></NativeDiv><NativeDiv className="ie-total"><NativeSpan>Rechnungsbetrag</NativeSpan><NativeStrong>{totals ? invoiceEditorMoney(totals.totalCents) : '—'}</NativeStrong></NativeDiv></NativeDiv>
    </NativeSection>
    <NativeSection className="ie-panel"><NativeDiv className="ie-panel-head"><NativeDiv><NativeP className="ie-step">03 · ANLAGEN & HINWEISE</NativeP><NativeH2>Ausgabe vorbereiten</NativeH2></NativeDiv></NativeDiv><NativeLabel className="ie-choice"><NativeInput type="radio" name="invoice-proofs" checked={!draft.includeProofs} disabled={busy} onChange={() => { setDraft(current => ({ ...current, includeProofs: false, selectedProofIds: [] })); }}/><NativeSpan>Ohne Leistungsnachweise<NativeSmall>Nur die Rechnung als PDF ausgeben.</NativeSmall></NativeSpan></NativeLabel><NativeLabel className="ie-choice"><NativeInput type="radio" name="invoice-proofs" checked={draft.includeProofs} disabled={busy} onChange={() => patch('includeProofs', true)}/><NativeSpan>Mit Leistungsnachweisen<NativeSmall>Verfügbare Nachweise rechts in der Vorschau auswählen.</NativeSmall></NativeSpan></NativeLabel><NativeDiv className="ie-divider"/><NativeDiv className="ie-fields"><NativeLabel className="ie-field ie-field-wide">Hinweis auf der Rechnung<NativeTextarea maxLength={10000} value={draft.footerText} disabled={busy} placeholder="Zum Beispiel vereinbarte Zahlungsangaben oder zutreffender Steuerhinweis" onChange={event => patch('footerText', event.target.value)}/></NativeLabel><NativeLabel className="ie-field ie-field-wide">Interne Notiz<NativeTextarea maxLength={10000} value={draft.notes} disabled={busy} onChange={event => patch('notes', event.target.value)}/><NativeSmall>Die interne Notiz wird nicht als Rechnungstext verwendet.</NativeSmall></NativeLabel></NativeDiv></NativeSection>
    </NativeDiv><NativeAside className="ie-panel ie-preview-sticky"><InvoicePdfPreview tenantId={tenantId} roleKey={roleKey} draft={draft} proofIds={draft.selectedProofIds} onProofIdsChange={ids => patch('selectedProofIds', ids)} disabled={busy || stale} invalid={validation.length > 0}/>{validation.length > 0 && <NativeP className="ie-inline-note">Die Vorschau wird verfügbar, sobald Empfänger, Zeitraum und Positionen vollständig sind. <NativeButton className="ie-link" onClick={() => setShowIssues(true)}>Fehlende Angaben anzeigen</NativeButton></NativeP>}</NativeAside></NativeDiv>
    <NativeFooter className="ie-footer"><NativeP>{dirty ? 'Ungespeicherte Änderungen' : 'Alle Änderungen gespeichert bzw. noch keine Eingaben'}</NativeP><NativeDiv className="ie-actions"><NativeButton disabled={busy} onClick={async () => { if (await canLeave())
        router.back(); }}>Abbrechen</NativeButton><NativeButton className="ie-primary" disabled={busy || stale} onClick={() => void save()}>{busy ? 'Wird gespeichert …' : 'Entwurf speichern'}</NativeButton></NativeDiv></NativeFooter>
  </NativeSection>;
}
