// Generated native presentation from src/components/office/invoices/EInvoiceInbox.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {useNativeWorkflowWindow} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {nativeWindow as window} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {NativeSvgPath} from '@/components/layout/NativeSvgPresentation.native';
import {NativeStyle,NativeSection,NativeH1,NativeP,NativeHeader,NativeDiv,NativeSpan,NativeButton,NativeNav,NativeBr,NativeH2,NativeSmall,NativeInput,NativeStrong,NativeLabel,NativeSelect,NativeOption,NativeH3,NativeTable,NativeThead,NativeTr,NativeTh,NativeTbody,NativeTd,NativeDetails,NativeSummary,NativeDl,NativeDt,NativeDd,NativeUl,NativeLi,NativeForm,NativeTextarea,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import {confirmNativeWorkspaceAction,runNativeWorkspaceEffect} from '@/lib/platform/nativeWorkspaceActions.native';
import { shareNativeFile } from '@/lib/platform/nativeFileDelivery.native';
import { WebActionIcon } from "../../icons/WebActionIcon.native.tsx";
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useIsFocused, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { usePreventRemove } from "@/hooks/useNativePreventRemove.native";
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useAuth } from '@/lib/auth/context';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { isPortalOnlyRole } from '@/lib/permissions/workspaceRoles';
import { inspectOfficeEInvoiceImport, officeEInvoiceSha256, parseOfficeEInvoiceXml, type OfficeEInvoiceImportInspection, type OfficeEInvoiceXmlPreview } from "../../../lib/office/eInvoiceImport.native.ts";
import { downloadOfficeEInvoiceOriginal, fetchOfficeEInvoiceInbox, reviewOfficeEInvoiceInbox, saveOfficeEInvoiceImport, validateOfficeEInvoiceInbox } from "../../../lib/office/eInvoiceInboxService.native.ts";
import type { OfficeEInvoiceInboxRecord } from "../../../lib/office/eInvoiceInboxTypes.native.ts";
import { formatInvoiceDate, invoiceMonth, invoiceParam } from "../../../lib/office/invoiceWorkspaceModel.native.ts";
import type { RoleKey } from '@/types';
import { eInvoiceInboxCss } from "./eInvoiceInboxStyles.native.ts";
type ReviewStatus = OfficeEInvoiceInboxRecord['reviewStatus'];
type Params = {
    search?: string | string[];
    month?: string | string[];
    review?: string | string[];
    sort?: string | string[];
    document?: string | string[];
};
const reviewLabels: Record<ReviewStatus, string> = { unreviewed: 'Offen', reviewed: 'Sachlich geprüft', rejected: 'Beanstandet' };
const reviewTone: Record<ReviewStatus, string> = { unreviewed: 'warning', reviewed: 'good', rejected: 'bad' };
const syntaxLabels = { ubl_invoice: 'UBL-Rechnung', ubl_credit_note: 'UBL-Gutschrift', cii: 'UN/CEFACT CII' };
const validationLabels: Record<string, {
    label: string;
    tone: string;
}> = {
    valid: { label: 'Formatprüfung bestanden', tone: 'good' },
    invalid: { label: 'Formatfehler', tone: 'bad' },
    unsupported: { label: 'Format nicht unterstützt', tone: 'warning' },
    pending_validation: { label: 'Normprüfung ausstehend', tone: 'warning' },
    unavailable: { label: 'Normprüfung ausstehend', tone: 'warning' },
    error: { label: 'Prüfung fehlgeschlagen', tone: 'bad' },
};
function validationBadge(status: string) { return validationLabels[status] ?? validationLabels.pending_validation; }
function documentMoney(value: string, currency: string) {
    if (!value)
        return '—';
    const amount = Number(value);
    if (!/^-?\d+(\.\d+)?$/.test(value) || !Number.isFinite(amount) || Math.abs(amount) > Number.MAX_SAFE_INTEGER / 100 || !/^[A-Z]{3}$/.test(currency))
        return `${value}${currency ? ` ${currency}` : ''}`;
    try {
        return new Intl.NumberFormat('de-DE', { style: 'currency', currency, maximumFractionDigits: Math.max(2, Math.min(6, value.split('.')[1]?.length ?? 0)) }).format(amount);
    }
    catch {
        return `${value} ${currency}`;
    }
}
function dateTime(value: string) {
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed.toLocaleString('de-DE', { timeZone: 'Europe/Berlin', dateStyle: 'short', timeStyle: 'short' }) : '—';
}
function fileSize(value: number) { return `${(value / 1024 / 1024).toLocaleString('de-DE', { maximumFractionDigits: 2 })} MB`; }
function message(cause: unknown, fallback: string) { return cause instanceof Error ? cause.message : fallback; }
/** JSONB key order and parser explanations are not invoice facts. Compare ordered values. */
function invoicePreviewFacts(preview: OfficeEInvoiceXmlPreview) {
    const party = (value: OfficeEInvoiceXmlPreview['seller']) => [value.name, value.addressLines, value.postalCode, value.city, value.country, value.taxId, value.vatId, value.endpointId, value.endpointScheme];
    return JSON.stringify([preview.syntax, preview.rootNamespace, preview.profileId, preview.processId,
        preview.invoiceNumber, preview.invoiceTypeCode, preview.issueDate, preview.dueDate ?? '', preview.buyerReference ?? '', preview.paymentReference ?? '', preview.currency,
        party(preview.seller), party(preview.buyer), [preview.totals.payable, preview.totals.taxExclusive, preview.totals.taxInclusive, preview.totals.tax],
        preview.lines.map(line => [line.id, line.name, line.quantity, line.unitCode, line.unitPrice, line.priceBaseQuantity ?? '', line.priceBaseUnitCode ?? '', line.lineTotal, line.taxCategory, line.taxRate])]);
}
export function EInvoiceInbox() {
    const auth = useAuth();
    const tenantId = useServiceTenantId()?.trim() ?? '';
    const { roleKey, permissions, can } = usePermissions();
    const allowed = Boolean(auth.authReady && auth.isAuthenticated && auth.user?.id && tenantId && roleKey && !auth.portalSession && !isPortalOnlyRole(roleKey) && can('office.invoices.view'));
    const scopeKey = JSON.stringify([tenantId, auth.user?.id, roleKey, [...new Set(permissions)].sort()]);
    return <NativeWorkspaceStyleScope css={[eInvoiceInboxCss, eInvoiceInboxCss]}>{<><NativeStyle>{eInvoiceInboxCss}</NativeStyle>{!auth.authReady ? <NativeSection className="iw iw-empty" role="status">Zugang wird geprüft …</NativeSection> : !allowed || !roleKey ? <NativeSection className="iw iw-empty"><NativeH1>Rechnungseingang</NativeH1><NativeP>Für diesen Bereich benötigen Sie einen Verwaltungszugang mit Zugriff auf Rechnungen.</NativeP></NativeSection> : <InboxContent key={scopeKey} {...{ tenantId, roleKey, scopeKey }} canImport={can('office.invoices.create')} canReview={can('office.invoices.status_change')}/>}</>}</NativeWorkspaceStyleScope>;
}
function InboxContent({ tenantId, roleKey, scopeKey, canImport, canReview }: {
    tenantId: string;
    roleKey: RoleKey;
    scopeKey: string;
    canImport: boolean;
    canReview: boolean;
}) {
    const window = useNativeWorkflowWindow();
    const router = useRouter();
    const navigation = useNavigation();
    const focused = useIsFocused();
    const params = useLocalSearchParams<Params>();
    const search = invoiceParam(params.search).slice(0, 180);
    const month = invoiceMonth(invoiceParam(params.month));
    const reviewParam = invoiceParam(params.review);
    const review = ['unreviewed', 'reviewed', 'rejected'].includes(reviewParam) ? reviewParam as ReviewStatus : '';
    const sortParam = invoiceParam(params.sort);
    const sort = ['date', 'seller', 'number'].includes(sortParam) ? sortParam : 'received';
    const selectedId = invoiceParam(params.document);
    const [pending, setPending] = useState<OfficeEInvoiceImportInspection | null>(null);
    const [busy, setBusy] = useState('');
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [reviewDirty, setReviewDirty] = useState(false);
    const [reviewRevision, setReviewRevision] = useState(0);
    const [limit, setLimit] = useState(30);
    const [visibleSelected, setVisibleSelected] = useState<OfficeEInvoiceInboxRecord | null>(null);
    const mounted = useRef(true);
    const lock = useRef(false);
    const leaveAllowed = useRef(false);
    const fileInput = useRef<HTMLInputElement>(null);
    const detail = useRef<HTMLElement>(null);
    const query = useAsyncQuery(useCallback(() => fetchOfficeEInvoiceInbox(tenantId, roleKey), [tenantId, roleKey]), [scopeKey], { queryKey: `office-einvoice-inbox:${scopeKey}`, retryCount: 0, refreshOnAppFocus: false });
    const selected = visibleSelected?.id === selectedId ? visibleSelected : query.data?.find(item => item.id === selectedId) ?? null;
    const selectedXmlHash = selected?.xmlSha256 ?? '';
    const originalQuery = useAsyncQuery(useCallback(async () => {
        if (!selectedId || !selectedXmlHash)
            return { ok: false, error: 'Bitte einen gespeicherten Rechnungseingang auswählen.' } as const;
        const original = await downloadOfficeEInvoiceOriginal(tenantId, selectedId, 'xml', roleKey);
        if (!original.ok)
            return original;
        if (await officeEInvoiceSha256(original.data.bytes) !== selectedXmlHash)
            return { ok: false, error: 'Das Original stimmt nicht mit der ausgewählten Rechnung überein. Bitte die Übersicht neu laden.' } as const;
        return { ok: true, data: { documentId: selectedId, xmlSha256: selectedXmlHash, preview: parseOfficeEInvoiceXml(original.data.bytes) } } as const;
    }, [tenantId, roleKey, selectedId, selectedXmlHash]), [scopeKey, selectedId, selectedXmlHash], { queryKey: `office-einvoice-original:${scopeKey}:${selectedId}:${selectedXmlHash}`, enabled: Boolean(selected && !pending), retryCount: 0, refreshOnAppFocus: false });
    const originalPreview = originalQuery.data?.documentId === selectedId && originalQuery.data.xmlSha256 === selectedXmlHash ? originalQuery.data.preview : null;
    const originalError = originalQuery.error || originalQuery.refreshError;
    const originalReady = Boolean(originalPreview && !originalQuery.loading && !originalQuery.refreshing && !originalError);
    const metadataDiffers = useMemo(() => Boolean(originalPreview && selected && invoicePreviewFacts(originalPreview) !== invoicePreviewFacts(selected.preview)), [originalPreview, selected?.preview]);
    const listReading = query.loading || query.refreshing;
    const filtered = Boolean(search || month || review);
    const rows = useMemo(() => {
        const term = search.trim().toLocaleLowerCase('de-DE');
        return (query.data ?? []).filter(row => (!month || row.preview.issueDate.startsWith(month)) && (!review || row.reviewStatus === review) && (!term || `${row.preview.invoiceNumber} ${row.preview.seller.name} ${row.preview.buyer.name} ${row.originalFileName}`.toLocaleLowerCase('de-DE').includes(term))).sort((a, b) => {
            if (sort === 'seller')
                return a.preview.seller.name.localeCompare(b.preview.seller.name, 'de');
            if (sort === 'number')
                return a.preview.invoiceNumber.localeCompare(b.preview.invoiceNumber, 'de', { numeric: true });
            return (sort === 'date' ? b.preview.issueDate.localeCompare(a.preview.issueDate) : b.createdAt.localeCompare(a.createdAt)) || a.id.localeCompare(b.id);
        });
    }, [query.data, search, month, review, sort]);
    const duplicate = pending ? query.data?.find(row => row.originalSha256 === pending.originalSha256) : null;
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    useEffect(() => { setLimit(30); }, [search, month, review, sort]);
    useEffect(() => { if (selectedId && selected && !pending)
        detail.current?.focus({ preventScroll: true }); }, [selectedId, Boolean(selected), Boolean(pending)]);
    const dirty = Boolean(pending || reviewDirty);
    async function mayLeave() {
        if (lock.current)
            return false;
        if (leaveAllowed.current || !dirty)
            return true;
        return await confirmNativeWorkspaceAction(pending ? 'Diese Datei wurde noch nicht importiert. Die lokale Vorschau verwerfen?' : 'Die Änderungen an der sachlichen Prüfung wurden noch nicht gespeichert. Verwerfen?');
    }
    usePreventRemove(dirty || Boolean(busy), async ({ data }) => { if (await mayLeave()) {
        leaveAllowed.current = true;
        navigation.dispatch(data.action);
    } });
    useEffect(() => {
        if (!dirty && !busy)
            return;
        const beforeUnload = (event: BeforeUnloadEvent) => { if (!leaveAllowed.current) {
            event.preventDefault();
            event.returnValue = '';
        } };
        window.addEventListener('beforeunload', beforeUnload);
        return () => window.removeEventListener('beforeunload', beforeUnload);
    }, [dirty, busy]);
    function updateParams(values: Record<string, string | undefined>) { if (focused && !lock.current)
        router.setParams(values); }
    async function openRecord(row: OfficeEInvoiceInboxRecord) {
        if (!focused || listReading || !await mayLeave())
            return;
        setPending(null);
        setReviewDirty(false);
        setReviewRevision(value => value + 1);
        setVisibleSelected(row);
        setError('');
        leaveAllowed.current = false;
        router.setParams({ document: row.id });
        window.requestAnimationFrame(() => detail.current?.scrollIntoView({ block: 'start', behavior: 'auto' }));
    }
    async function inspect(file: File | undefined) {
        if (!file || !canImport || !focused || lock.current || !await mayLeave())
            return;
        lock.current = true;
        setBusy('inspect');
        setError('');
        setNotice('');
        leaveAllowed.current = false;
        try {
            const result = await inspectOfficeEInvoiceImport(file);
            if (mounted.current) {
                setPending(result);
                setReviewDirty(false);
                setReviewRevision(value => value + 1);
                window.requestAnimationFrame(() => detail.current?.scrollIntoView({ block: 'start', behavior: 'auto' }));
            }
        }
        catch (cause) {
            if (mounted.current)
                setError(message(cause, 'Die Datei konnte nicht gelesen werden.'));
        }
        finally {
            lock.current = false;
            if (mounted.current) {
                setBusy('');
                if (fileInput.current)
                    fileInput.current.value = '';
            }
        }
    }
    async function importFile() {
        if (!pending || !canImport || !focused || lock.current || listReading)
            return;
        lock.current = true;
        setBusy('import');
        setError('');
        setNotice('');
        try {
            const result = await saveOfficeEInvoiceImport(tenantId, pending, roleKey);
            if (!mounted.current)
                return;
            if (!result.ok) {
                setError(result.error);
                return;
            }
            const { record, duplicate: existed } = result.data;
            query.setData(current => [record, ...(current ?? []).filter(row => row.id !== record.id)]);
            setPending(null);
            setVisibleSelected(record);
            setReviewDirty(false);
            router.setParams({ document: record.id });
            setNotice(existed ? 'Dieses Original ist bereits im Rechnungseingang gespeichert. Der vorhandene Eintrag wurde geöffnet.' : 'Originaldatei und Rechnungs-XML sind gespeichert. Die sachliche Prüfung ist noch offen.');
            window.requestAnimationFrame(() => detail.current?.scrollIntoView({ block: 'start', behavior: 'auto' }));
        }
        catch (cause) {
            if (mounted.current)
                setError(message(cause, 'Die Rechnung konnte nicht importiert werden.'));
        }
        finally {
            lock.current = false;
            if (mounted.current)
                setBusy('');
        }
    }
    async function download(record: OfficeEInvoiceInboxRecord, part: 'original' | 'xml') {
        if (!focused || lock.current)
            return;
        lock.current = true;
        setBusy(`download-${part}`);
        setError('');
        try {
            const result = await downloadOfficeEInvoiceOriginal(tenantId, record.id, part, roleKey);
            if (!mounted.current)
                return;
            if (!result.ok) {
                setError(result.error);
                return;
            }
            await shareNativeFile(new Uint8Array(result.data.bytes), result.data.fileName, result.data.mimeType);
        }
        catch (cause) {
            if (mounted.current)
                setError(message(cause, 'Das Original konnte nicht heruntergeladen werden.'));
        }
        finally {
            lock.current = false;
            if (mounted.current)
                setBusy('');
        }
    }
    async function saveReview(record: OfficeEInvoiceInboxRecord, status: ReviewStatus, note: string) {
        if (!canReview || !focused || lock.current || listReading || !originalReady || originalQuery.data?.documentId !== record.id)
            return false;
        lock.current = true;
        setBusy('review');
        setError('');
        setNotice('');
        try {
            const result = await reviewOfficeEInvoiceInbox(tenantId, record.id, { status, note: note.trim(), expectedUpdatedAt: record.updatedAt }, roleKey);
            if (!mounted.current)
                return false;
            if (!result.ok) {
                setError(result.error);
                return false;
            }
            query.setData(current => (current ?? []).map(row => row.id === result.data.id ? result.data : row));
            setVisibleSelected(result.data);
            setReviewDirty(false);
            setNotice('Die sachliche Prüfung wurde gespeichert. Der Stand der Normprüfung bleibt davon unabhängig.');
            return true;
        }
        catch (cause) {
            if (mounted.current)
                setError(message(cause, 'Der Prüfstand konnte nicht gespeichert werden.'));
            return false;
        }
        finally {
            lock.current = false;
            if (mounted.current)
                setBusy('');
        }
    }
    async function validate(record: OfficeEInvoiceInboxRecord) {
        if (!canImport || !focused || lock.current || reviewDirty || listReading)
            return;
        lock.current = true;
        setBusy('validate');
        setError('');
        setNotice('');
        try {
            const result = await validateOfficeEInvoiceInbox(tenantId, record.id, roleKey);
            if (!mounted.current)
                return;
            if (!result.ok) {
                setError(result.error);
                return;
            }
            query.setData(current => (current ?? []).map(row => row.id === result.data.id ? result.data : row));
            setVisibleSelected(result.data);
            setNotice('Das Ergebnis der Formatprüfung ist gespeichert. Die sachliche Prüfung bleibt davon unabhängig.');
        }
        catch (cause) {
            if (mounted.current)
                setError(message(cause, 'Die Formatprüfung konnte nicht abgeschlossen werden.'));
        }
        finally {
            lock.current = false;
            if (mounted.current)
                setBusy('');
        }
    }
    async function refresh() {
        if (lock.current || !await mayLeave())
            return;
        setReviewDirty(false);
        setReviewRevision(value => value + 1);
        setVisibleSelected(null);
        setPending(null);
        setError('');
        await query.refresh();
    }
    function cancelPending() { if (!lock.current) {
        setPending(null);
        setError('');
        if (fileInput.current)
            fileInput.current.value = '';
    } }
    const queryError = query.error || query.refreshError;
    return <NativeWorkspaceStyleScope css={[eInvoiceInboxCss]}>{<NativeSection className="iw ei iw-fade" data-testid="office-einvoice-inbox" data-healthos-einvoice-inbox="20261018">
    <NativeHeader className="iw-header"><NativeDiv className="iw-heading"><NativeSpan className="iw-mark" aria-hidden="true"><WebActionIcon size={24}><NativeSvgPath d="M12 3v11m-4-4 4 4 4-4M4 15v5h16v-5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/></WebActionIcon></NativeSpan><NativeDiv><NativeP className="iw-eyebrow">Office · Rechnungen</NativeP><NativeH1>Rechnungseingang</NativeH1><NativeP>Rechnungen für Ihr Unternehmen lesen, prüfen und als Original ablegen.</NativeP></NativeDiv></NativeDiv><NativeDiv className="iw-actions"><NativeButton type="button" disabled={Boolean(busy) || query.loading || query.refreshing} onClick={() => void refresh()}>{query.refreshing ? 'Wird aktualisiert …' : 'Aktualisieren'}</NativeButton></NativeDiv></NativeHeader>
    <NativeNav className="iw-tabs" aria-label="Rechnungsbereich"><NativeButton type="button" disabled={Boolean(busy)} onClick={async () => { if (focused && await mayLeave()) {
        leaveAllowed.current = true;
        router.push('/business/office/invoices' as never);
    } }}>Ausgangsrechnungen</NativeButton><NativeSpan className="ei-current-tab" aria-current="page">Rechnungseingang</NativeSpan></NativeNav>
    {error && <NativeDiv className="iw-notice" data-tone="error" role="alert">{error}</NativeDiv>}
    {notice && <NativeDiv className="iw-notice" data-tone="success" role="status">{notice}</NativeDiv>}
    {queryError && <NativeDiv className="iw-notice" data-tone="error" role="alert">{queryError}{query.data ? ' Die Liste zeigt den letzten erfolgreichen Stand.' : ''}<NativeBr /><NativeButton type="button" disabled={Boolean(busy) || query.loading || query.refreshing} onClick={() => void refresh()}>Erneut laden</NativeButton></NativeDiv>}
    {canImport && <NativeSection className="ei-upload" aria-busy={busy === 'inspect'}><NativeDiv className="ei-upload-copy"><NativeP className="iw-eyebrow">Neuer Eingang</NativeP><NativeH2>XML oder PDF mit Rechnungs-XML auswählen</NativeH2><NativeP>Die Vorschau wird zuerst lokal erstellt. Erst „Original importieren“ speichert die Datei im Rechnungseingang Ihres Unternehmens.</NativeP><NativeSmall>XML bis 5 MB · PDF bis 10 MB · Keine automatische Zahlung oder Buchung</NativeSmall></NativeDiv><NativeDiv className="ei-upload-control"><NativeButton type="button" disabled={Boolean(busy)} onClick={() => fileInput.current?.click()}>{busy === 'inspect' ? 'Datei wird gelesen …' : 'Datei auswählen'}</NativeButton><NativeInput ref={fileInput} type="file" hidden accept=".xml,.pdf,application/xml,text/xml,application/pdf" aria-label="Rechnungsdatei auswählen" disabled={Boolean(busy)} onChange={event => void inspect(event.currentTarget.files?.[0])}/></NativeDiv></NativeSection>}
    {pending && <NativeSection ref={detail} tabIndex={-1} className="iw-panel ei-detail" aria-label="Importvorschau"><NativeDiv className="iw-panel-head"><NativeDiv><NativeP className="iw-eyebrow">Noch nicht gespeichert</NativeP><NativeH2>Importvorschau</NativeH2></NativeDiv><NativeDiv className="iw-actions"><NativeButton type="button" disabled={Boolean(busy)} onClick={cancelPending}>Verwerfen</NativeButton>{duplicate ? <NativeButton type="button" className="iw-primary" disabled={Boolean(busy) || listReading} onClick={async () => await openRecord(duplicate)}>Vorhandenen Eintrag öffnen</NativeButton> : <NativeButton type="button" className="iw-primary" disabled={Boolean(busy) || listReading} onClick={() => void importFile()}>{busy === 'import' ? 'Original wird gespeichert …' : 'Original importieren'}</NativeButton>}</NativeDiv></NativeDiv><NativeDiv className="ei-detail-body">{duplicate && <NativeDiv className="iw-notice" data-tone="warning">Diese Originaldatei ist bereits gespeichert. Ein erneuter Import erzeugt keinen zweiten Eintrag.</NativeDiv>}<NativeDiv className="ei-file"><NativeStrong>{pending.originalFileName}</NativeStrong><NativeSmall>{pending.sourceKind === 'hybrid_pdf' ? 'PDF mit Rechnungs-XML' : 'XML-Datei'} · {fileSize(pending.originalBytes.byteLength)}{pending.sourceKind === 'hybrid_pdf' ? ` · Eingebettete Datei: ${pending.xmlFileName}` : ''}</NativeSmall></NativeDiv><FormatCheck message="Die Datei wurde ausgelesen. Nach dem Import können Sie die Formatprüfung für das gespeicherte Original starten. Die Vorschau bestätigt keine Formatkonformität."/><StructuredPreview preview={pending.preview} warnings={pending.warnings}/><NativeP className="iw-footnote">Die Vorschau zeigt ausgelesene Rechnungsdaten. Prüfen Sie Rechnungsempfänger, Leistung und Beträge vor der sachlichen Freigabe.</NativeP></NativeDiv></NativeSection>}
    <NativeDiv className="iw-toolbar"><NativeLabel className="iw-search">Eingänge suchen<NativeInput type="search" maxLength={180} value={search} placeholder="Rechnungsnummer, Lieferant oder Dateiname" onChange={event => updateParams({ search: event.target.value || undefined })}/></NativeLabel><NativeLabel className="iw-period">Rechnungsmonat<NativeInput type="month" value={month} min="2000-01" max="2100-12" onChange={event => updateParams({ month: invoiceMonth(event.target.value) || undefined })}/></NativeLabel><NativeLabel className="iw-status">Sachliche Prüfung<NativeSelect value={review} onChange={event => updateParams({ review: event.target.value || undefined })}><NativeOption value="">Alle Prüfstände</NativeOption>{Object.entries(reviewLabels).map(([value, label]) => <NativeOption key={value} value={value}>{label}</NativeOption>)}</NativeSelect></NativeLabel><NativeLabel className="iw-sort">Sortierung<NativeSelect value={sort} onChange={event => updateParams({ sort: event.target.value === 'received' ? undefined : event.target.value })}><NativeOption value="received">Zuletzt importiert</NativeOption><NativeOption value="date">Neuestes Rechnungsdatum</NativeOption><NativeOption value="seller">Lieferant A–Z</NativeOption><NativeOption value="number">Rechnungsnummer</NativeOption></NativeSelect></NativeLabel></NativeDiv>
    {query.data && <NativeDiv className="iw-filterline"><NativeSpan>{rows.length} von {query.data.length} Eingängen · {(query.data.filter(row => row.reviewStatus === 'unreviewed')).length} sachlich ungeprüft</NativeSpan>{filtered && <NativeButton type="button" className="iw-link" disabled={Boolean(busy)} onClick={() => updateParams({ search: undefined, month: undefined, review: undefined })}>Filter zurücksetzen</NativeButton>}</NativeDiv>}
    <NativeSection className="iw-panel" aria-busy={query.loading || query.refreshing}><NativeDiv className="iw-panel-head"><NativeH2>Gespeicherte Eingänge</NativeH2><NativeSmall>Importübersicht · Details aus dem Original-XML</NativeSmall></NativeDiv>{query.loading && !query.data ? <NativeDiv role="status" aria-label="Rechnungseingang wird geladen"><NativeDiv className="iw-skeleton"/><NativeDiv className="iw-skeleton"/></NativeDiv> : !query.data ? <NativeDiv className="iw-empty"><NativeH3>Rechnungseingang nicht verfügbar</NativeH3><NativeP>Die gespeicherten Eingänge konnten nicht geladen werden.</NativeP></NativeDiv> : !rows.length ? <NativeDiv className="iw-empty"><NativeH3>{filtered ? 'Keine passenden Eingänge' : 'Noch keine Rechnung importiert'}</NativeH3><NativeP>{filtered ? 'Ändern Sie die Suche, den Monat oder den Prüfstand.' : canImport ? 'Wählen Sie eine XML-Rechnung oder eine PDF mit eingebettetem Rechnungs-XML aus. Eine Klientenzuordnung ist nicht erforderlich.' : 'Hier erscheinen die für Ihr Unternehmen importierten Rechnungen.'}</NativeP></NativeDiv> : <><NativeDiv className="iw-table-scroll" role="region" aria-label="Rechnungseingänge, bei Bedarf horizontal scrollbar" tabIndex={0}><NativeTable className="ei-inbox-table"><NativeThead><NativeTr><NativeTh scope="col">Rechnung / Lieferant</NativeTh><NativeTh scope="col">Rechnungsdatum</NativeTh><NativeTh scope="col" className="iw-number">Importierter Zahlbetrag</NativeTh><NativeTh scope="col">Sachliche Prüfung</NativeTh><NativeTh scope="col">Importiert am</NativeTh><NativeTh scope="col">Details</NativeTh></NativeTr></NativeThead><NativeTbody>{rows.slice(0, limit).map(row => <NativeTr key={row.id} data-selected={selectedId === row.id}><NativeTd><NativeDiv className="iw-cellcopy"><NativeButton type="button" className="iw-link" disabled={Boolean(busy) || listReading} onClick={async () => await openRecord(row)}>{row.preview.invoiceNumber || 'Rechnungsnummer fehlt'}</NativeButton><NativeStrong className="ei-seller">{row.preview.seller.name || 'Lieferant fehlt'}</NativeStrong><NativeSmall>{row.originalFileName}</NativeSmall></NativeDiv></NativeTd><NativeTd>{formatInvoiceDate(row.preview.issueDate)}</NativeTd><NativeTd className="iw-number">{documentMoney(row.preview.totals.payable, row.preview.currency)}</NativeTd><NativeTd><NativeSpan className="iw-badge" data-tone={reviewTone[row.reviewStatus]}>{reviewLabels[row.reviewStatus]}</NativeSpan><NativeSmall className="iw-subtle" data-validation-status={row.validationStatus}>{validationBadge(row.validationStatus).label}</NativeSmall></NativeTd><NativeTd>{dateTime(row.createdAt)}</NativeTd><NativeTd><NativeButton type="button" disabled={Boolean(busy) || listReading} aria-label={`Eingang ${row.preview.invoiceNumber || row.originalFileName} öffnen`} onClick={async () => await openRecord(row)}>Öffnen</NativeButton></NativeTd></NativeTr>)}</NativeTbody></NativeTable></NativeDiv><NativeDiv className="iw-pagination"><NativeSpan>{Math.min(limit, rows.length)} von {rows.length} angezeigt</NativeSpan>{limit < rows.length && <NativeButton type="button" disabled={Boolean(busy)} onClick={() => setLimit(value => value + 30)}>Weitere anzeigen</NativeButton>}</NativeDiv></>}</NativeSection>
    {!pending && selected && <NativeSection ref={detail} tabIndex={-1} className="iw-panel ei-detail" aria-label="Rechnungseingang im Detail"><NativeDiv className="iw-panel-head"><NativeDiv><NativeP className="iw-eyebrow">Gespeichertes Original</NativeP><NativeH2>{originalPreview?.invoiceNumber || 'Rechnungsdetails'}</NativeH2></NativeDiv><NativeDiv className="iw-actions"><NativeButton type="button" disabled={Boolean(busy)} onClick={() => void download(selected, 'original')}>{busy === 'download-original' ? 'Wird geladen …' : 'Original herunterladen'}</NativeButton>{selected.sourceKind === 'hybrid_pdf' && <NativeButton type="button" disabled={Boolean(busy)} onClick={() => void download(selected, 'xml')}>{busy === 'download-xml' ? 'Wird geladen …' : 'Eingebettetes XML'}</NativeButton>}</NativeDiv></NativeDiv><NativeDiv className="ei-detail-body"><NativeDiv className="ei-file"><NativeStrong>{selected.originalFileName}</NativeStrong><NativeSmall>{selected.sourceKind === 'hybrid_pdf' ? 'PDF mit Rechnungs-XML' : 'XML-Datei'} · Importiert {dateTime(selected.createdAt)}</NativeSmall></NativeDiv><FormatCheck message={selected.validationMessage} status={selected.validationStatus} findings={selected.validationFindings}/>{canImport && <NativeDiv className="ei-validation-actions"><NativeButton type="button" disabled={Boolean(busy) || reviewDirty || listReading} onClick={() => void validate(selected)}>{busy === 'validate' ? 'Format wird geprüft …' : selected.validationStatus === 'pending_validation' ? 'Format prüfen' : 'Format erneut prüfen'}</NativeButton>{reviewDirty && <NativeSmall>Speichern oder verwerfen Sie zuerst die Änderungen an der sachlichen Prüfung.</NativeSmall>}</NativeDiv>}{originalQuery.loading || originalQuery.refreshing ? <NativeDiv role="status" aria-label="Original-XML wird geladen und ausgelesen"><NativeP className="iw-footnote">Das gespeicherte Original-XML wird geladen und auf unveränderten Inhalt geprüft …</NativeP><NativeDiv className="iw-skeleton"/></NativeDiv> : originalError ? <NativeDiv className="iw-notice" data-tone="error" role="alert">{originalError}<NativeBr /><NativeButton type="button" disabled={Boolean(busy)} onClick={() => void originalQuery.refresh()}>Original erneut laden</NativeButton></NativeDiv> : originalPreview ? <>{metadataDiffers && <NativeDiv className="iw-notice" data-tone="warning">Die Angaben der Importübersicht weichen vom Original-XML ab. Die folgenden Rechnungsdetails wurden neu aus dem unveränderten Original gelesen.</NativeDiv>}<StructuredPreview preview={originalPreview}/><NativeP className="iw-footnote">Diese Details stammen aus der gespeicherten XML-Datei. Ihre Prüfsumme stimmt mit dem ausgewählten Original überein.</NativeP></> : <NativeDiv className="iw-notice" data-tone="warning">Die Rechnungsdetails sind noch nicht aus dem Original verfügbar.</NativeDiv>}<ReviewForm key={`${selected.id}:${selected.updatedAt}:${reviewRevision}`} record={selected} allowed={canReview} busy={Boolean(busy) || listReading} blocked={!originalReady} onDirty={setReviewDirty} onSave={saveReview}/><NativeDetails className="ei-provenance"><NativeSummary>Original und Nachvollziehbarkeit</NativeSummary><NativeDl><NativeDiv><NativeDt>SHA-256 des Originals</NativeDt><NativeDd>{selected.originalSha256}</NativeDd></NativeDiv><NativeDiv><NativeDt>SHA-256 des Rechnungs-XML</NativeDt><NativeDd>{selected.xmlSha256}</NativeDd></NativeDiv><NativeDiv><NativeDt>Zuletzt bearbeitet</NativeDt><NativeDd>{dateTime(selected.updatedAt)}</NativeDd></NativeDiv></NativeDl><NativeP>Beim Herunterladen erhalten Sie die gespeicherten Originaldaten. Die sachliche Prüfung verändert die Datei nicht.</NativeP></NativeDetails></NativeDiv></NativeSection>}
    {!pending && selectedId && !selected && query.data && !query.loading && <NativeDiv className="iw-notice" data-tone="warning" role="status">Der gewählte Eingang ist in diesem Unternehmen nicht verfügbar. Wählen Sie einen Eintrag aus der Liste.</NativeDiv>}
    <NativeP className="iw-footnote">Die Liste enthält die beim Import erfassten Angaben. Zum Prüfen eines Eingangs werden die Details erneut aus dem gespeicherten Original-XML gelesen. Eine erkannte XML-Struktur ist noch kein Nachweis einer gültigen E-Rechnung. Formatkonformität und sachliche Richtigkeit werden getrennt beurteilt.</NativeP>
  </NativeSection>}</NativeWorkspaceStyleScope>;
}
function FormatCheck({ message: text, status = 'pending_validation', findings = [] }: {
    message: string;
    status?: string;
    findings?: string[];
}) {
    const badge = validationBadge(status);
    return <NativeWorkspaceStyleScope css={[eInvoiceInboxCss]}>{<NativeDiv className="ei-format" data-tone={badge.tone} role="status"><NativeSpan className="iw-badge" data-tone={badge.tone}>{badge.label}</NativeSpan><NativeDiv><NativeH3>Datei- und Formatprüfung</NativeH3><NativeP>{text || 'Für dieses Original liegt noch kein vollständiges Prüfergebnis vor.'}</NativeP>{findings.length > 0 && <NativeUl className="ei-findings">{findings.map((finding, index) => <NativeLi key={`${index}:${finding}`}>{finding}</NativeLi>)}</NativeUl>}</NativeDiv></NativeDiv>}</NativeWorkspaceStyleScope>;
}
export function StructuredPreview({ preview, warnings = [] }: {
    preview: OfficeEInvoiceXmlPreview;
    warnings?: string[];
}) {
    const issues = [...new Set([...preview.warnings, ...warnings])];
    return <NativeWorkspaceStyleScope css={[eInvoiceInboxCss]}>{<NativeDiv className="ei-preview">
    <NativeDiv className="ei-preview-title"><NativeDiv><NativeH3>Lesbare Rechnungsdaten</NativeH3><NativeP>Aus dem strukturierten XML übernommen</NativeP></NativeDiv><NativeSpan className="iw-badge" data-tone="blue">{preview.invoiceTypeCode === '381' ? 'Gutschrift · ' : ''}{syntaxLabels[preview.syntax]}</NativeSpan></NativeDiv>
    <NativeDiv className="ei-facts"><Fact label="Rechnungsnummer" value={preview.invoiceNumber}/><Fact label="Rechnungsdatum" value={formatInvoiceDate(preview.issueDate)}/><Fact label="Währung" value={preview.currency}/><Fact label="Deklariertes Profil" value={preview.profileLabel || preview.profileId}/>{preview.dueDate && <Fact label="Fällig am" value={formatInvoiceDate(preview.dueDate)}/>}{preview.buyerReference && <Fact label="Käuferreferenz" value={preview.buyerReference}/>}{preview.paymentReference && <Fact label="Zahlungsreferenz" value={preview.paymentReference}/>}</NativeDiv>
    {preview.profileSupport !== 'supported' && <NativeDiv className="iw-notice" data-tone="warning">{preview.profileSupport === 'excluded' ? 'Das deklarierte Profil erfüllt nicht die hier vorgesehenen Anforderungen an eine vollständige E-Rechnung. Das Original kann dennoch zur weiteren Klärung abgelegt werden.' : 'Das deklarierte Profil konnte nicht eindeutig zugeordnet werden. Aus der Vorschau folgt keine Bestätigung des Rechnungsformats.'}</NativeDiv>}
    {issues.length > 0 && <NativeDiv className="iw-notice" data-tone="warning"><NativeStrong>Hinweise zur ausgelesenen Datei</NativeStrong><NativeUl>{issues.map((issue, index) => <NativeLi key={`${index}:${issue}`}>{issue}</NativeLi>)}</NativeUl></NativeDiv>}
    <NativeDiv className="ei-parties"><Party title="Rechnungssteller" party={preview.seller}/><Party title="Rechnungsempfänger" party={preview.buyer}/></NativeDiv>
    <NativeDiv className="iw-table-scroll ei-lines" role="region" aria-label="Rechnungspositionen aus dem XML, horizontal scrollbar" tabIndex={0}><NativeTable><NativeThead><NativeTr><NativeTh scope="col">Position / Leistung</NativeTh><NativeTh scope="col" className="iw-number">Menge</NativeTh><NativeTh scope="col">Einheit</NativeTh><NativeTh scope="col" className="iw-number">Einzelpreis</NativeTh><NativeTh scope="col">Steuer</NativeTh><NativeTh scope="col" className="iw-number">Positionsbetrag</NativeTh></NativeTr></NativeThead><NativeTbody>{preview.lines.length ? preview.lines.map((line, index) => <NativeTr key={`${line.id}:${index}`}><NativeTd><NativeDiv className="iw-cellcopy"><NativeStrong>{line.name || 'Bezeichnung fehlt'}</NativeStrong><NativeSmall>Position {line.id || index + 1}</NativeSmall></NativeDiv></NativeTd><NativeTd className="iw-number">{line.quantity || '—'}</NativeTd><NativeTd>{line.unitCode || '—'}</NativeTd><NativeTd className="iw-number">{documentMoney(line.unitPrice, preview.currency)}<NativeSmall className="iw-subtle">für {line.priceBaseQuantity || '1'} {line.priceBaseUnitCode || line.unitCode}</NativeSmall></NativeTd><NativeTd>{line.taxRate ? `${line.taxRate} %` : '—'}{line.taxCategory && <NativeSmall className="iw-subtle">Kategorie {line.taxCategory}</NativeSmall>}</NativeTd><NativeTd className="iw-number">{documentMoney(line.lineTotal, preview.currency)}</NativeTd></NativeTr>) : <NativeTr><NativeTd colSpan={6}>In der Datei wurden keine Rechnungspositionen ausgelesen.</NativeTd></NativeTr>}</NativeTbody></NativeTable></NativeDiv>
    <NativeDl className="ei-totals"><NativeDiv><NativeDt>Nettobetrag</NativeDt><NativeDd>{documentMoney(preview.totals.taxExclusive, preview.currency)}</NativeDd></NativeDiv><NativeDiv><NativeDt>Steuerbetrag</NativeDt><NativeDd>{documentMoney(preview.totals.tax, preview.currency)}</NativeDd></NativeDiv><NativeDiv><NativeDt>Bruttobetrag</NativeDt><NativeDd>{documentMoney(preview.totals.taxInclusive, preview.currency)}</NativeDd></NativeDiv><NativeDiv className="ei-payable"><NativeDt>Zahlbetrag laut XML</NativeDt><NativeDd>{documentMoney(preview.totals.payable, preview.currency)}</NativeDd></NativeDiv></NativeDl>
    <NativeP className="iw-footnote">Beträge werden aus der Datei angezeigt. Abschläge, Vorauszahlungen oder Rundungen können den Zahlbetrag beeinflussen; diese Vorschau ersetzt keine vollständige Rechnungsprüfung.</NativeP>
  </NativeDiv>}</NativeWorkspaceStyleScope>;
}
function Fact({ label, value }: {
    label: string;
    value: string;
}) { return <NativeWorkspaceStyleScope css={[eInvoiceInboxCss]}>{<NativeDl><NativeDt>{label}</NativeDt><NativeDd>{value || 'Nicht angegeben'}</NativeDd></NativeDl>}</NativeWorkspaceStyleScope>; }
function Party({ title, party }: {
    title: string;
    party: OfficeEInvoiceXmlPreview['seller'];
}) {
    return <NativeWorkspaceStyleScope css={[eInvoiceInboxCss]}>{<NativeSection className="iw-card ei-party"><NativeH3>{title}</NativeH3><NativeStrong>{party.name || 'Name nicht angegeben'}</NativeStrong><NativeP>{[...party.addressLines, [party.postalCode, party.city].filter(Boolean).join(' '), party.country].filter(Boolean).join('\n') || 'Anschrift nicht angegeben'}</NativeP><NativeDl>{party.taxId && <NativeDiv><NativeDt>Steuernummer</NativeDt><NativeDd>{party.taxId}</NativeDd></NativeDiv>}{party.vatId && <NativeDiv><NativeDt>USt-ID</NativeDt><NativeDd>{party.vatId}</NativeDd></NativeDiv>}{party.endpointId && <NativeDiv><NativeDt>Elektronische Adresse{party.endpointScheme ? ` (${party.endpointScheme})` : ''}</NativeDt><NativeDd>{party.endpointId}</NativeDd></NativeDiv>}</NativeDl></NativeSection>}</NativeWorkspaceStyleScope>;
}
function ReviewForm({ record, allowed, busy, blocked, onDirty, onSave }: {
    record: OfficeEInvoiceInboxRecord;
    allowed: boolean;
    busy: boolean;
    blocked: boolean;
    onDirty: (dirty: boolean) => void;
    onSave: (record: OfficeEInvoiceInboxRecord, status: ReviewStatus, note: string) => Promise<boolean>;
}) {
    const [status, setStatus] = useState<ReviewStatus>(record.reviewStatus);
    const [note, setNote] = useState(record.reviewNote);
    const [attempted, setAttempted] = useState(false);
    const dirty = status !== record.reviewStatus || note !== record.reviewNote;
    const noteRequired = status === 'rejected' && note.trim().length < 5;
    useEffect(() => { onDirty(dirty); }, [dirty, onDirty]);
    return <NativeWorkspaceStyleScope css={[eInvoiceInboxCss]}>{<NativeSection className="ei-review"><NativeDiv className="ei-preview-title"><NativeDiv><NativeH3>Sachliche Prüfung</NativeH3><NativeP>Leistung, Empfänger und Beträge unabhängig vom Dateiformat beurteilen.</NativeP></NativeDiv><NativeSpan className="iw-badge" data-tone={reviewTone[record.reviewStatus]}>{reviewLabels[record.reviewStatus]}</NativeSpan></NativeDiv>{allowed ? <NativeForm onSubmit={event => { event.preventDefault(); setAttempted(true); if (!busy && !blocked && dirty && !noteRequired)
        void onSave(record, status, note); }}><NativeDiv className="ei-review-fields"><NativeLabel>Prüfstand<NativeSelect value={status} disabled={busy || blocked} onChange={event => setStatus(event.target.value as ReviewStatus)}>{Object.entries(reviewLabels).map(([value, label]) => <NativeOption key={value} value={value}>{label}</NativeOption>)}</NativeSelect></NativeLabel><NativeLabel>Prüfvermerk{status === 'rejected' ? ' (erforderlich)' : ' (optional)'}<NativeTextarea value={note} maxLength={2000} rows={3} disabled={busy || blocked} onChange={event => setNote(event.target.value)} placeholder="Zum Beispiel: Leistung abgeglichen, Abweichung oder Rückfrage an den Rechnungssteller" aria-invalid={attempted && noteRequired}/></NativeLabel></NativeDiv>{attempted && noteRequired && <NativeP className="ei-field-error" role="alert">Bitte begründen Sie die Beanstandung mit mindestens 5 Zeichen.</NativeP>}<NativeDiv className="iw-actions"><NativeButton type="submit" className="iw-primary" disabled={busy || blocked || !dirty}>{busy ? 'Bitte warten …' : blocked ? 'Original noch nicht verfügbar' : 'Prüfstand speichern'}</NativeButton>{dirty && <NativeButton type="button" disabled={busy} onClick={() => { setStatus(record.reviewStatus); setNote(record.reviewNote); setAttempted(false); }}>Änderungen verwerfen</NativeButton>}</NativeDiv></NativeForm> : <><NativeP>Zum Ändern des Prüfstands fehlt die Berechtigung.</NativeP>{record.reviewNote && <NativeP className="ei-review-note">{record.reviewNote}</NativeP>}</>}<NativeP className="iw-footnote">„Sachlich geprüft“ bestätigt keine technische Normprüfung und löst keine Zahlung aus.</NativeP></NativeSection>}</NativeWorkspaceStyleScope>;
}
