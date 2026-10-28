// Generated native presentation from src/components/office/invoices/InvoicePdfPreview.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {nativeURL as URL,nativeBlob as Blob} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {NativeSvg,NativeSvgPath} from '@/components/layout/NativeSvgPresentation.native';
import {NativeDiv,NativeStyle,NativeSection,NativeP,NativeH2,NativeBr,NativeButton,NativeLabel,NativeInput,NativeSpan,NativeSmall,NativeIframe,NativeA,NativeStrong,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import { useEffect, useRef, useState } from 'react';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { downloadInvoiceProofAttachment, downloadPreparedInvoicePdf, listInvoiceProofAttachments, officeInvoiceToPdfInvoice, prepareOfficeDraftPdf, prepareOfficeInvoicePdf } from "../../../lib/office/invoicePdfService.native.ts";
import type { InvoiceOfficeDraft, OfficeInvoice } from "../../../lib/office/invoiceWorkspaceService.native.ts";
import type { PreparedInvoicePdf } from "../../../lib/office/invoicePdfService.native.ts";
import type { RoleKey } from '@/types';
import { invoiceEditorCss } from "./invoiceEditorStyles.native.ts";
import { invoiceEditorDate } from "./invoiceEditorModel.native.ts";
type Props = {
    tenantId: string;
    roleKey: RoleKey;
    draft?: InvoiceOfficeDraft;
    invoice?: OfficeInvoice;
    proofIds?: string[];
    onProofIdsChange?: (ids: string[]) => void;
    allowProofSelection?: boolean;
    invalid?: boolean;
    disabled?: boolean;
};
/** Creates an actual invoice PDF without writing an invoice or sending a message. */
export function InvoicePdfPreview({ tenantId, roleKey, draft, invoice, proofIds, onProofIdsChange, allowProofSelection = true, invalid = false, disabled = false }: Props) {
    const source = draft ?? invoice;
    const scope = JSON.stringify([tenantId, roleKey, source?.id, source?.clientId, source?.servicePeriodStart, source?.servicePeriodEnd]);
    return <NativeWorkspaceStyleScope css={[invoiceEditorCss, invoiceEditorCss]}>{<NativeDiv className="ie ie-preview"><NativeStyle>{invoiceEditorCss}</NativeStyle><ScopedInvoicePdfPreview key={scope} {...{ tenantId, roleKey, draft, invoice, proofIds, onProofIdsChange, allowProofSelection, invalid, disabled }}/></NativeDiv>}</NativeWorkspaceStyleScope>;
}
function ScopedInvoicePdfPreview({ tenantId, roleKey, draft, invoice, proofIds, onProofIdsChange, allowProofSelection = true, invalid = false, disabled = false }: Props) {
    const source = draft ?? invoice;
    const generation = JSON.stringify([draft, invoice, proofIds]);
    const generationRef = useRef(generation);
    generationRef.current = generation;
    const [selection, setSelection] = useState<string[] | null>(proofIds ?? source?.selectedProofIds ?? null);
    const [prepared, setPrepared] = useState<PreparedInvoicePdf | null>(null);
    const [url, setUrl] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const mounted = useRef(true);
    const lock = useRef(false);
    const currentUrl = useRef('');
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; if (currentUrl.current)
        URL.revokeObjectURL(currentUrl.current); }; }, []);
    useEffect(() => { setPrepared(null); setError(''); setUrl(''); if (currentUrl.current)
        URL.revokeObjectURL(currentUrl.current); currentUrl.current = ''; setSelection(proofIds ?? source?.selectedProofIds ?? null); }, [generation]);
    const includeProofs = Boolean(source?.includeProofs);
    const clientId = source?.clientId ?? '';
    const periodStart = source?.servicePeriodStart ?? '';
    const periodEnd = source?.servicePeriodEnd ?? '';
    const finalized = Boolean(invoice && invoice.status !== 'draft');
    const proofs = useAsyncQuery(() => listInvoiceProofAttachments(tenantId, clientId, periodStart, periodEnd, roleKey, invoice?.id ?? draft?.id), [tenantId, clientId, periodStart, periodEnd, roleKey, invoice?.id, draft?.id], { enabled: includeProofs && !finalized && Boolean(clientId && periodStart && periodEnd), queryKey: `${tenantId}:${roleKey}:${clientId}:${periodStart}:${periodEnd}`, retryCount: 0 });
    const available = (proofs.data ?? []).filter(item => item.available);
    const linkedIds = new Set((source?.lines ?? []).flatMap(line => line.serviceRecordId ? [`record:${line.serviceRecordId}`] : []));
    const selectedIds = includeProofs ? selection ?? available.filter(item => linkedIds.has(item.id)).map(item => item.id) : [];
    const proofError = proofs.error || proofs.refreshError;
    const unavailableSelected = selectedIds.some(id => !available.some(item => item.id === id));
    const waiting = includeProofs && !finalized && (proofs.loading || proofs.refreshing || !!proofError || unavailableSelected);
    function changeProof(id: string, checked: boolean) {
        const next = checked ? [...new Set([...selectedIds, id])] : selectedIds.filter(value => value !== id);
        setSelection(next);
        onProofIdsChange?.(next);
        setPrepared(null);
        setError('');
        if (currentUrl.current)
            URL.revokeObjectURL(currentUrl.current);
        currentUrl.current = '';
        setUrl('');
    }
    async function prepare() {
        if (disabled || invalid || waiting || lock.current || !source)
            return;
        lock.current = true;
        setBusy(true);
        setError('');
        const started = generation;
        try {
            const result = draft
                ? await prepareOfficeDraftPdf(tenantId, draft, roleKey, { proofIds: selectedIds })
                : await prepareOfficeInvoicePdf(tenantId, officeInvoiceToPdfInvoice(invoice!), roleKey, { proofIds: selectedIds });
            if (!mounted.current || generationRef.current !== started)
                return;
            if (!result.ok) {
                setError(result.error);
                return;
            }
            const nextUrl = URL.createObjectURL(new Blob([new Uint8Array(result.data.bytes)], { type: 'application/pdf' }));
            if (currentUrl.current)
                URL.revokeObjectURL(currentUrl.current);
            currentUrl.current = nextUrl;
            setUrl(nextUrl);
            setPrepared(result.data);
        }
        catch (cause) {
            if (mounted.current && generationRef.current === started)
                setError(cause instanceof Error ? cause.message : 'Die PDF-Vorschau konnte nicht erstellt werden.');
        }
        finally {
            lock.current = false;
            if (mounted.current)
                setBusy(false);
        }
    }
    async function download() {
        if (!prepared || busy || disabled)
            return;
        setError('');
        try {
            await downloadPreparedInvoicePdf(prepared);
        }
        catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Die PDF-Datei konnte nicht heruntergeladen werden.');
        }
    }
    async function downloadOriginal(proofId: string) {
        if (disabled || lock.current || finalized)
            return;
        lock.current = true;
        setBusy(true);
        setError('');
        const started = generation;
        try {
            const result = await downloadInvoiceProofAttachment(tenantId, clientId, periodStart, periodEnd, roleKey, proofId, invoice?.id ?? draft?.id);
            if (!mounted.current || generationRef.current !== started)
                return;
            if (!result.ok) {
                setError(result.error);
                return;
            }
            await downloadPreparedInvoicePdf(result.data);
        }
        catch (cause) {
            if (mounted.current && generationRef.current === started)
                setError(cause instanceof Error ? cause.message : 'Der Originalnachweis konnte nicht heruntergeladen werden.');
        }
        finally {
            lock.current = false;
            if (mounted.current)
                setBusy(false);
        }
    }
    return <NativeWorkspaceStyleScope css={[invoiceEditorCss]}>{<NativeSection aria-label="Rechnungsvorschau" aria-busy={busy}>
    <NativeDiv className="ie-panel-head"><NativeDiv><NativeP className="ie-step">PDF-VORSCHAU</NativeP><NativeH2>{draft || invoice?.status === 'draft' ? 'Entwurf vorab ansehen' : 'Rechnung ansehen'}</NativeH2><NativeP>{includeProofs ? 'Leistungsnachweise als PDF-Kopien. Originale bleiben unverändert.' : 'Rechnung ohne Leistungsnachweise als Anlage.'}</NativeP></NativeDiv></NativeDiv>
    {includeProofs && !finalized && <NativeDiv className="ie-proof-list" aria-label="Leistungsnachweise als Anlagen">
      {proofs.loading && <NativeP className="ie-inline-note" role="status">Verfügbare Leistungsnachweise werden geprüft …</NativeP>}
      {proofError && <NativeDiv className="ie-notice" data-tone="error" role="alert">{proofError}<NativeBr /><NativeButton type="button" onClick={() => void proofs.refresh()}>Erneut prüfen</NativeButton></NativeDiv>}
      {!proofs.loading && !proofError && unavailableSelected && <NativeDiv className="ie-notice" data-tone="warning" role="alert">Mindestens ein ausgewählter Leistungsnachweis ist nicht mehr verfügbar. Bitte die Auswahl prüfen.{allowProofSelection && <><NativeBr /><NativeButton disabled={busy || disabled} onClick={() => { const next = selectedIds.filter(id => available.some(item => item.id === id)); setSelection(next); onProofIdsChange?.(next); }}>Nicht verfügbare Anlagen aus der Auswahl entfernen</NativeButton></>}</NativeDiv>}
      {!proofs.loading && !proofError && !proofs.data?.length && <NativeP className="ie-inline-note">Für diese Auswahl sind keine Leistungsnachweise als PDF verfügbar. Die Rechnung kann ohne Anlage erzeugt werden.</NativeP>}
      {(proofs.data ?? []).map(proof => <NativeDiv key={proof.id}><NativeLabel className="ie-choice"><NativeInput type="checkbox" checked={selectedIds.includes(proof.id)} disabled={busy || disabled || !proof.available || !allowProofSelection} onChange={event => changeProof(proof.id, event.target.checked)}/><NativeSpan>{proof.title}<NativeSmall>{invoiceEditorDate(proof.serviceDate)}{!proof.available ? ` · ${proof.unavailableReason ?? 'PDF noch nicht verfügbar'}` : ''}</NativeSmall></NativeSpan></NativeLabel>{proof.available && <NativeButton className="ie-link" disabled={busy || disabled} onClick={() => void downloadOriginal(proof.id)}>Original herunterladen · {invoiceEditorDate(proof.serviceDate)}</NativeButton>}</NativeDiv>)}
      {!proofs.loading && !proofError && <NativeP className="ie-inline-note">{selectedIds.length} {selectedIds.length === 1 ? 'Anlage ausgewählt' : 'Anlagen ausgewählt'}{available.length ? ` · ${available.length} verfügbar` : ''}</NativeP>}
    </NativeDiv>}
    {error && <NativeDiv className="ie-notice" data-tone="error" role="alert">{error}</NativeDiv>}
    {prepared?.validation.warnings.length ? <NativeDiv className="ie-notice" data-tone="warning" role="status">{prepared.validation.warnings.join('\n')}</NativeDiv> : null}
    <NativeDiv className="ie-preview-toolbar"><NativeButton type="button" className="ie-primary" disabled={busy || disabled || invalid || waiting} onClick={() => void prepare()}>{busy ? 'PDF wird erstellt …' : url ? 'Vorschau aktualisieren' : 'PDF-Vorschau erstellen'}</NativeButton>{prepared && <NativeButton type="button" disabled={busy || disabled || invalid} onClick={() => void download()}>PDF herunterladen</NativeButton>}</NativeDiv>
    {url ? <><NativeIframe title="Rechnungs-PDF Vorschau" src={`${url}#toolbar=1&navpanes=0`}/><NativeP className="ie-preview-note">Falls die Vorschau nicht angezeigt wird: <NativeA href={url} target="_blank" rel="noopener noreferrer">PDF in einem neuen Tab öffnen</NativeA>.</NativeP></> : <NativeDiv className="ie-paper"><NativeSvg viewBox="0 0 48 48" fill="none" aria-hidden="true"><NativeSvgPath d="M12 5h16l9 9v29H12V5Z" stroke="currentColor" strokeWidth="2"/><NativeSvgPath d="M27 5v11h10M18 24h13M18 30h13M18 36h8" stroke="currentColor" strokeWidth="2"/></NativeSvg><NativeStrong>Die Rechnung vor dem Speichern prüfen</NativeStrong><NativeP>Die Vorschau verwendet Ihre Eingaben und die hinterlegten Unternehmensdaten.</NativeP></NativeDiv>}
    <NativeP className="ie-preview-note">{draft || invoice?.status === 'draft' ? 'Entwürfe sind als ENTWURF gekennzeichnet. Eine Vorschau speichert oder versendet keine Rechnung.' : 'Eine Vorschau versendet keine Rechnung.'}</NativeP>
  </NativeSection>}</NativeWorkspaceStyleScope>;
}
