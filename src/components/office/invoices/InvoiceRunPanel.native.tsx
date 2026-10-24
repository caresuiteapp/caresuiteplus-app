// Generated native presentation from src/components/office/invoices/InvoiceRunPanel.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {useNativeWorkflowWindow} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {nativeWindow as window} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {NativeDiv,NativeOl,NativeLi,NativeSpan,NativeSection,NativeH2,NativeP,NativeLabel,NativeInput,NativeSelect,NativeOption,NativeSmall,NativeButton,NativeBr,NativeStrong,NativeH3,NativeTable,NativeThead,NativeTr,NativeTh,NativeTbody,NativeTd,NativeUl} from '@/components/layout/NativeWorkspaceElements.native';
import {confirmNativeWorkspaceAction,runNativeWorkspaceEffect} from '@/lib/platform/nativeWorkspaceActions.native';
import { useEffect, useRef, useState } from 'react';
import { useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import { usePreventRemove } from "@/hooks/useNativePreventRemove.native";
import { PlatformModal } from '@/components/layout/platform';
import { loadInvoiceRunPreview, executeInvoiceRun } from "../../../lib/office/invoiceRunService.native.ts";
import type { InvoiceRunGroup, InvoiceRunInput, InvoiceRunPreview } from "../../../lib/office/invoiceRunModel.native.ts";
import { formatInvoiceDate, formatInvoiceMoney, invoiceDay, invoiceMonth, invoiceParam } from "../../../lib/office/invoiceWorkspaceModel.native.ts";
import { InvoicePdfPreview } from "./InvoicePdfPreview.native.tsx";
import type { RoleKey } from '@/types';
type Params = {
    runMonth?: string | string[];
    runDate?: string | string[];
    runDue?: string | string[];
    runProduct?: string | string[];
    runProofs?: string | string[];
    runVat?: string | string[];
};
type RunResult = Extract<Awaited<ReturnType<typeof executeInvoiceRun>>, {
    ok: true;
}>['data'];
type Props = {
    tenantId: string;
    roleKey: RoleKey;
    scopeKey: string;
    onBusyChange: (busy: boolean) => void;
    onCreated: () => void;
    onOpenInvoice: (id: string) => void;
};
const datePattern = /^(20\d{2}|2100)-(0[1-9]|1[0-2])-\d{2}$/;
export function InvoiceRunPanel({ tenantId, roleKey, scopeKey, onBusyChange, onCreated, onOpenInvoice }: Props) {
    const window = useNativeWorkflowWindow();
    const router = useRouter();
    const focused = useIsFocused();
    const params = useLocalSearchParams<Params>();
    const today = invoiceDay();
    const month = invoiceMonth(invoiceParam(params.runMonth)) || today.slice(0, 7);
    const date = invoiceParam(params.runDate);
    const invoiceDate = datePattern.test(date) ? date : today;
    const due = invoiceParam(params.runDue);
    const dueDate = datePattern.test(due) ? due : '';
    const product = invoiceParam(params.runProduct);
    const productKey: InvoiceRunInput['productKey'] = ['assist', 'pflege', 'stationaer', 'beratung'].includes(product) ? product as InvoiceRunInput['productKey'] : 'all';
    const includeProofs = invoiceParam(params.runProofs) !== 'no';
    const vat = invoiceParam(params.runVat);
    const taxRatePercent = ['0', '7', '19'].includes(vat) ? Number(vat) : undefined;
    const [preview, setPreview] = useState<InvoiceRunPreview | null>(null);
    const [selected, setSelected] = useState<string[]>([]);
    const [busy, setBusy] = useState<'preview' | 'create' | ''>('');
    const [error, setError] = useState('');
    const [result, setResult] = useState<RunResult | null>(null);
    const [progress, setProgress] = useState('');
    const [openedGroup, setOpenedGroup] = useState<InvoiceRunGroup | null>(null);
    const lock = useRef(false);
    const scope = useRef<string | null>(scopeKey);
    const formKey = JSON.stringify([month, invoiceDate, dueDate, productKey, includeProofs, taxRatePercent]);
    const currentForm = useRef(formKey);
    currentForm.current = formKey;
    useEffect(() => { scope.current = scopeKey; return () => { scope.current = null; onBusyChange(false); }; }, [scopeKey, onBusyChange]);
    useEffect(() => { setPreview(null); setSelected([]); setError(''); setOpenedGroup(null); }, [formKey]);
    usePreventRemove(busy === 'create', () => { setError('Der Rechnungsdurchlauf wird gerade gespeichert. Bitte warten Sie auf die Rückmeldung.'); });
    useEffect(() => { if (busy !== 'create')
        return; const leave = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; }; window.addEventListener('beforeunload', leave); return () => window.removeEventListener('beforeunload', leave); }, [busy]);
    const selectedGroups = preview?.groups.filter(group => selected.includes(group.id) && group.eligible && group.totalCents !== null) ?? [];
    const selectedTotal = selectedGroups.reduce((sum, group) => sum + (group.totalCents ?? 0), 0);
    const eligible = preview?.groups.filter(group => group.eligible) ?? [];
    function change(values: Record<string, string | undefined>) { if (focused && !lock.current)
        router.setParams(values); }
    function begin(kind: 'preview' | 'create') { if (!focused || lock.current)
        return false; lock.current = true; setBusy(kind); onBusyChange(true); setError(''); return true; }
    function finish() { lock.current = false; if (scope.current !== null) {
        setBusy('');
        setProgress('');
        onBusyChange(false);
    } }
    async function prepare() {
        if (!begin('preview'))
            return;
        const requested = formKey;
        try {
            const response = await loadInvoiceRunPreview(tenantId, { month, productKey, includeProofs, invoiceDate, ...(dueDate ? { dueDate } : {}), ...(taxRatePercent === undefined ? {} : { taxRatePercent }) }, roleKey);
            if (scope.current !== scopeKey || currentForm.current !== requested)
                return;
            if (!response.ok) {
                setError(response.error);
                return;
            }
            setPreview(response.data);
            setSelected(response.data.groups.filter(group => group.eligible).map(group => group.id));
            setResult(null);
        }
        catch (cause) {
            if (scope.current === scopeKey)
                setError(cause instanceof Error ? cause.message : 'Der Rechnungsdurchlauf konnte nicht vorbereitet werden.');
        }
        finally {
            finish();
        }
    }
    async function create() {
        if (!preview || error || !selectedGroups.length || !Number.isSafeInteger(selectedTotal) || !begin('create'))
            return;
        try {
            if (!await confirmNativeWorkspaceAction(`${selectedGroups.length} ${selectedGroups.length === 1 ? 'Rechnungsentwurf' : 'Rechnungsentwürfe'} über insgesamt ${formatInvoiceMoney(selectedTotal)} speichern?\n\nLeistungszeitraum: ${formatInvoiceDate(preview.start)} bis ${formatInvoiceDate(preview.end)}\n${includeProofs ? 'Leistungsnachweise sind als Anlage vorgesehen.' : 'Die Rechnungen werden ohne Nachweisanlage erstellt.'}\n\nDie Entwürfe werden anschließend einzeln geprüft und freigegeben. Es erfolgt kein automatischer Versand.`))
                return;
            setProgress(`0 von ${selectedGroups.length} Rechnungen bearbeitet`);
            const requestedForm = formKey;
            const response = await executeInvoiceRun(tenantId, preview, selectedGroups.map(group => group.id), roleKey, { isActive: () => scope.current === scopeKey && currentForm.current === requestedForm, onProgress: update => { if (scope.current === scopeKey)
                    setProgress(`${update.completed} von ${update.total} Rechnungen bearbeitet`); } });
            if (scope.current !== scopeKey)
                return;
            if (!response.ok) {
                setError(response.error);
                return;
            }
            setError('');
            setResult(response.data);
            const created = new Set(response.data.results.filter(item => item.status === 'created').map(item => item.groupId));
            setSelected(previous => previous.filter(id => !created.has(id)));
            if (response.data.createdCount)
                onCreated();
        }
        catch (cause) {
            if (scope.current === scopeKey)
                setError(cause instanceof Error ? cause.message : 'Der Rechnungsdurchlauf konnte nicht vollständig bestätigt werden. Prüfen Sie die Übersicht vor einem erneuten Versuch.');
        }
        finally {
            finish();
        }
    }
    function toggle(id: string) { if (!lock.current)
        setSelected(previous => previous.includes(id) ? previous.filter(value => value !== id) : [...previous, id]); }
    const createdIds = new Set(result?.results.filter(item => item.status === 'created').map(item => item.groupId) ?? []);
    return <NativeDiv className="iw-stack" data-testid="office-invoice-run">
    <NativeOl className="iw-run-steps" aria-label="Ablauf"><NativeLi aria-current={!preview ? 'step' : undefined}><NativeSpan>1</NativeSpan>Zeitraum festlegen</NativeLi><NativeLi aria-current={preview && !result ? 'step' : undefined}><NativeSpan>2</NativeSpan>Vorschau prüfen</NativeLi><NativeLi aria-current={result ? 'step' : undefined}><NativeSpan>3</NativeSpan>Entwürfe speichern</NativeLi></NativeOl>
    <NativeSection className="iw-card"><NativeDiv className="iw-row-head"><NativeDiv><NativeH2>Monatsrechnungen vorbereiten</NativeH2><NativeP>Freigegebene Leistungen werden je Klient:in zusammengefasst. Bereits abgerechnete Leistungen bleiben ausgeschlossen.</NativeP></NativeDiv></NativeDiv><NativeDiv className="iw-run-options">
      <NativeLabel>Leistungsmonat<NativeInput type="month" min="2000-01" max="2100-12" value={month} disabled={!!busy} onChange={event => { if (invoiceMonth(event.target.value))
        change({ runMonth: event.target.value }); }}/></NativeLabel>
      <NativeLabel>Leistungsbereich<NativeSelect value={productKey} disabled={!!busy} onChange={event => change({ runProduct: event.target.value === 'all' ? undefined : event.target.value })}><NativeOption value="all">Alle Leistungsbereiche</NativeOption><NativeOption value="assist">Assist</NativeOption><NativeOption value="pflege">Pflege</NativeOption><NativeOption value="stationaer">Stationär</NativeOption><NativeOption value="beratung">Beratung</NativeOption></NativeSelect></NativeLabel>
      <NativeLabel>Rechnungsdatum<NativeInput type="date" min="2000-01-01" max="2100-12-31" value={invoiceDate} disabled={!!busy} onChange={event => change({ runDate: event.target.value || undefined })}/></NativeLabel>
      <NativeLabel>Fälligkeit, optional<NativeInput type="date" min={invoiceDate} max="2100-12-31" value={dueDate} disabled={!!busy} onChange={event => change({ runDue: event.target.value || undefined })}/><NativeSmall>Leer: hinterlegtes Zahlungsziel verwenden.</NativeSmall></NativeLabel>
      <NativeLabel>Umsatzsteuer auf Nettobeträge<NativeSelect value={taxRatePercent === undefined ? 'settings' : String(taxRatePercent)} disabled={!!busy} onChange={event => change({ runVat: event.target.value === 'settings' ? undefined : event.target.value })}><NativeOption value="settings">Hinterlegte Einstellung</NativeOption><NativeOption value="0">0 %</NativeOption><NativeOption value="7">7 %</NativeOption><NativeOption value="19">19 %</NativeOption></NativeSelect></NativeLabel>
      <NativeLabel className="iw-check"><NativeInput type="checkbox" checked={includeProofs} disabled={!!busy} onChange={event => change({ runProofs: event.target.checked ? undefined : 'no' })}/>Leistungsnachweise als PDF-Anlage beifügen</NativeLabel>
    </NativeDiv><NativeP className="iw-footnote">Auch ohne PDF-Anlage müssen die zugrunde liegenden Leistungen zur Abrechnung freigegeben sein. Empfänger und Zahlungsziel werden aus den hinterlegten Abrechnungsdaten übernommen.</NativeP><NativeDiv className="iw-actions"><NativeButton type="button" className="iw-primary" disabled={!!busy} onClick={() => void prepare()}>{busy === 'preview' ? 'Leistungen werden geprüft …' : preview ? 'Vorschau aktualisieren' : 'Vorschau erstellen'}</NativeButton></NativeDiv></NativeSection>
    {error && <NativeDiv className="iw-notice" data-tone="error" role="alert">{error}<NativeBr /><NativeButton type="button" disabled={!!busy} onClick={() => void prepare()}>Erneut prüfen</NativeButton></NativeDiv>}
    {progress && <NativeDiv className="iw-notice" role="status" aria-live="polite">{progress}</NativeDiv>}
    {result && <NativeSection className="iw-card" aria-label="Ergebnis des Rechnungsdurchlaufs"><NativeH2>Ergebnis des Durchlaufs</NativeH2><NativeP>{result.createdCount} Entwürfe gespeichert oder bereits vorhanden · {result.failedCount} fehlgeschlagen · {result.skippedCount} übersprungen</NativeP><NativeDiv className="iw-run-results">{result.results.map(item => <NativeDiv className="iw-run-result" key={item.groupId}><NativeDiv><NativeStrong>{item.clientName}</NativeStrong><NativeP>{item.status === 'created' ? 'Entwurf verfügbar. Bitte vor der Freigabe prüfen.' : item.error || (item.status === 'skipped' ? 'Für diesen Durchlauf übersprungen.' : 'Der Entwurf konnte nicht gespeichert werden.')}</NativeP></NativeDiv>{item.invoiceId && <NativeButton type="button" disabled={!!busy} onClick={() => onOpenInvoice(item.invoiceId!)}>Entwurf öffnen</NativeButton>}</NativeDiv>)}</NativeDiv></NativeSection>}
    {preview && <><NativeSection className="iw-run-summary"><NativeDiv><NativeStrong>{selectedGroups.length} ausgewählt · {formatInvoiceMoney(selectedTotal)}</NativeStrong><NativeP>{preview.eligibleCount} Rechnungen vorbereitet · {preview.blockedCount} mit Prüfbedarf · {preview.alreadyBilledCount} Leistungen bereits abgerechnet{preview.excludedCount ? ` · ${preview.excludedCount} ausgeschlossen` : ''}</NativeP></NativeDiv><NativeDiv className="iw-actions"><NativeButton type="button" className="iw-primary" disabled={!!busy || !!error || !selectedGroups.length || !Number.isSafeInteger(selectedTotal)} onClick={() => void create()}>{busy === 'create' ? 'Entwürfe werden gespeichert …' : 'Ausgewählte Entwürfe speichern'}</NativeButton></NativeDiv></NativeSection>
      <NativeSection className="iw-panel"><NativeDiv className="iw-panel-head"><NativeH2>Vorschau des Rechnungsdurchlaufs</NativeH2><NativeSmall>{formatInvoiceDate(preview.start)} – {formatInvoiceDate(preview.end)}</NativeSmall></NativeDiv>{!preview.groups.length ? <NativeDiv className="iw-empty"><NativeH3>Keine offenen Leistungen für diesen Zeitraum</NativeH3><NativeP>Prüfen Sie den Leistungsmonat und den Leistungsbereich. Bereits abgerechnete oder ausgeschlossene Leistungen werden nicht erneut übernommen.</NativeP></NativeDiv> : <NativeDiv className="iw-table-scroll" role="region" aria-label="Rechnungsdurchlauf, bei Bedarf horizontal scrollbar" tabIndex={0}><NativeTable className="iw-run-table"><NativeThead><NativeTr><NativeTh scope="col"><NativeLabel className="iw-check"><NativeInput type="checkbox" aria-label="Alle vorbereiteten Rechnungen auswählen" disabled={!!busy || eligible.every(group => createdIds.has(group.id))} checked={eligible.filter(group => !createdIds.has(group.id)).length > 0 && eligible.filter(group => !createdIds.has(group.id)).every(group => selected.includes(group.id))} onChange={event => setSelected(event.target.checked ? eligible.filter(group => !createdIds.has(group.id)).map(group => group.id) : [])}/></NativeLabel></NativeTh><NativeTh scope="col">Klient:in / Empfänger</NativeTh><NativeTh scope="col">Leistungen</NativeTh><NativeTh scope="col" className="iw-number">Rechnungsbetrag</NativeTh><NativeTh scope="col">Prüfung</NativeTh><NativeTh scope="col">Vorschau</NativeTh></NativeTr></NativeThead><NativeTbody>{preview.groups.map(group => <NativeTr key={group.id} data-selected={selected.includes(group.id)}><NativeTd className="iw-select-cell"><NativeInput type="checkbox" aria-label={`Rechnung für ${group.clientName} auswählen`} checked={selected.includes(group.id)} disabled={!!busy || !group.eligible || createdIds.has(group.id)} onChange={() => toggle(group.id)}/></NativeTd><NativeTd><NativeDiv className="iw-cellcopy"><NativeStrong>{group.clientName}</NativeStrong><NativeSmall>{group.recipientName}</NativeSmall></NativeDiv></NativeTd><NativeTd>{group.sourceCount}</NativeTd><NativeTd className="iw-number"><NativeStrong>{formatInvoiceMoney(group.totalCents)}</NativeStrong></NativeTd><NativeTd>{createdIds.has(group.id) ? <NativeSpan className="iw-badge" data-tone="good">Entwurf gespeichert</NativeSpan> : group.eligible ? <NativeSpan className="iw-badge" data-tone="blue">Vorbereitet</NativeSpan> : <><NativeSpan className="iw-badge" data-tone="warning">Prüfbedarf</NativeSpan><NativeUl className="iw-run-blockers">{group.blockers.map((blocker, index) => <NativeLi key={`${index}:${blocker}`}>{blocker}</NativeLi>)}</NativeUl></>}</NativeTd><NativeTd><NativeButton type="button" disabled={!!busy} onClick={() => setOpenedGroup(group)} aria-label={`Vorschau für ${group.clientName} öffnen`}>Prüfen</NativeButton></NativeTd></NativeTr>)}</NativeTbody></NativeTable></NativeDiv>}</NativeSection><NativeP className="iw-footnote">Gespeicherte Entwürfe können Sie einzeln bearbeiten, ergänzen und mit oder ohne Nachweisanlage freigeben. Dieser Durchlauf versendet keine Rechnungen.</NativeP></>}
    <PlatformModal visible={!!openedGroup} title={openedGroup ? `Rechnungsvorschau · ${openedGroup.clientName}` : 'Rechnungsvorschau'} subtitle="Entwurf aus dem Rechnungsdurchlauf" maxWidth={1140} minWidth={280} maxHeightRatio={0.94} surfaceScope="company" dismissOnBackdrop={false} onClose={() => setOpenedGroup(null)} bodyStyle={{ padding: 16, backgroundColor: '#f3f7fc' }}>{openedGroup && <NativeDiv className="iw iw-stack">{openedGroup.blockers.length > 0 && <NativeDiv className="iw-notice" data-tone="warning"><NativeStrong>Vor dem Speichern zu klären</NativeStrong><NativeUl>{openedGroup.blockers.map((blocker, index) => <NativeLi key={`${index}:${blocker}`}>{blocker}</NativeLi>)}</NativeUl></NativeDiv>}<NativeDiv className="iw-card"><NativeH3>{openedGroup.recipientName}</NativeH3><NativeP>{openedGroup.draft.recipient.street} {openedGroup.draft.recipient.houseNumber}<NativeBr />{openedGroup.draft.recipient.postalCode} {openedGroup.draft.recipient.city}</NativeP><NativeP>Fällig am {formatInvoiceDate(openedGroup.draft.dueDate)} · {formatInvoiceMoney(openedGroup.totalCents)}</NativeP></NativeDiv><NativeDiv className="iw-panel iw-table-scroll"><NativeTable className="iw-run-table"><NativeThead><NativeTr><NativeTh scope="col">Leistung</NativeTh><NativeTh scope="col">Datum</NativeTh><NativeTh scope="col" className="iw-number">Menge</NativeTh><NativeTh scope="col" className="iw-number">Einzelpreis netto</NativeTh><NativeTh scope="col" className="iw-number">USt.</NativeTh></NativeTr></NativeThead><NativeTbody>{openedGroup.draft.lines.map((line, index) => <NativeTr key={`${line.serviceRecordId ?? index}`}><NativeTd>{line.description}</NativeTd><NativeTd>{formatInvoiceDate(line.serviceDate ?? null)}</NativeTd><NativeTd className="iw-number">{line.quantity.toLocaleString('de-DE', { maximumFractionDigits: 4 })} {line.unit}</NativeTd><NativeTd className="iw-number">{formatInvoiceMoney(line.unitPriceCents)}</NativeTd><NativeTd className="iw-number">{line.taxRatePercent} %</NativeTd></NativeTr>)}</NativeTbody></NativeTable></NativeDiv><InvoicePdfPreview tenantId={tenantId} roleKey={roleKey} draft={openedGroup.draft} proofIds={openedGroup.proofIds} allowProofSelection={false} invalid={!openedGroup.eligible} disabled={!!busy}/><NativeDiv className="iw-actions"><NativeButton type="button" onClick={() => setOpenedGroup(null)}>Vorschau schließen</NativeButton></NativeDiv></NativeDiv>}</PlatformModal>
  </NativeDiv>;
}
