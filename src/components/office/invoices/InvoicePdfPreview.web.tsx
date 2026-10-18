import { useEffect, useRef, useState } from 'react';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { downloadInvoiceProofAttachment, downloadPreparedInvoicePdf, listInvoiceProofAttachments, officeInvoiceToPdfInvoice, prepareOfficeDraftPdf, prepareOfficeInvoicePdf } from '@/lib/office/invoicePdfService.web';
import type { InvoiceOfficeDraft, OfficeInvoice } from '@/lib/office/invoiceWorkspaceService.web';
import type { PreparedInvoicePdf } from '@/lib/office/invoicePdfService';
import type { RoleKey } from '@/types';
import { invoiceEditorCss } from './invoiceEditorStyles.web';
import { invoiceEditorDate } from './invoiceEditorModel.web';

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
  return <div className="ie ie-preview"><style>{invoiceEditorCss}</style><ScopedInvoicePdfPreview key={scope} {...{ tenantId, roleKey, draft, invoice, proofIds, onProofIdsChange, allowProofSelection, invalid, disabled }} /></div>;
}

function ScopedInvoicePdfPreview({ tenantId, roleKey, draft, invoice, proofIds, onProofIdsChange, allowProofSelection = true, invalid = false, disabled = false }: Props) {
  const source = draft ?? invoice;
  const generation = JSON.stringify([draft, invoice, proofIds]);
  const generationRef = useRef(generation); generationRef.current = generation;
  const [selection, setSelection] = useState<string[] | null>(proofIds ?? source?.selectedProofIds ?? null);
  const [prepared, setPrepared] = useState<PreparedInvoicePdf | null>(null);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const mounted = useRef(true);
  const lock = useRef(false);
  const currentUrl = useRef('');
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; if (currentUrl.current) URL.revokeObjectURL(currentUrl.current); }; }, []);
  useEffect(() => { setPrepared(null); setError(''); setUrl(''); if (currentUrl.current) URL.revokeObjectURL(currentUrl.current); currentUrl.current = ''; setSelection(proofIds ?? source?.selectedProofIds ?? null); }, [generation]);
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
    setSelection(next); onProofIdsChange?.(next);
    setPrepared(null); setError('');
    if (currentUrl.current) URL.revokeObjectURL(currentUrl.current);
    currentUrl.current = ''; setUrl('');
  }
  async function prepare() {
    if (disabled || invalid || waiting || lock.current || !source) return;
    lock.current = true; setBusy(true); setError('');
    const started = generation;
    try {
      const result = draft
        ? await prepareOfficeDraftPdf(tenantId, draft, roleKey, { proofIds: selectedIds })
        : await prepareOfficeInvoicePdf(tenantId, officeInvoiceToPdfInvoice(invoice!), roleKey, { proofIds: selectedIds });
      if (!mounted.current || generationRef.current !== started) return;
      if (!result.ok) { setError(result.error); return; }
      const nextUrl = URL.createObjectURL(new Blob([new Uint8Array(result.data.bytes)], { type: 'application/pdf' }));
      if (currentUrl.current) URL.revokeObjectURL(currentUrl.current);
      currentUrl.current = nextUrl; setUrl(nextUrl); setPrepared(result.data);
    } catch (cause) { if (mounted.current && generationRef.current === started) setError(cause instanceof Error ? cause.message : 'Die PDF-Vorschau konnte nicht erstellt werden.'); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  }
  async function download() {
    if (!prepared || busy || disabled) return;
    setError('');
    try { await downloadPreparedInvoicePdf(prepared); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Die PDF-Datei konnte nicht heruntergeladen werden.'); }
  }
  async function downloadOriginal(proofId: string) {
    if (disabled || lock.current || finalized) return;
    lock.current = true; setBusy(true); setError(''); const started = generation;
    try {
      const result = await downloadInvoiceProofAttachment(tenantId, clientId, periodStart, periodEnd, roleKey, proofId, invoice?.id ?? draft?.id);
      if (!mounted.current || generationRef.current !== started) return;
      if (!result.ok) { setError(result.error); return; }
      await downloadPreparedInvoicePdf(result.data);
    } catch (cause) { if (mounted.current && generationRef.current === started) setError(cause instanceof Error ? cause.message : 'Der Originalnachweis konnte nicht heruntergeladen werden.'); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  }
  return <section aria-label="Rechnungsvorschau" aria-busy={busy}>
    <div className="ie-panel-head"><div><p className="ie-step">PDF-VORSCHAU</p><h2>{draft || invoice?.status === 'draft' ? 'Entwurf vorab ansehen' : 'Rechnung ansehen'}</h2><p>{includeProofs ? 'Leistungsnachweise als PDF-Kopien. Originale bleiben unverändert.' : 'Rechnung ohne Leistungsnachweise als Anlage.'}</p></div></div>
    {includeProofs && !finalized && <div className="ie-proof-list" aria-label="Leistungsnachweise als Anlagen">
      {proofs.loading && <p className="ie-inline-note" role="status">Verfügbare Leistungsnachweise werden geprüft …</p>}
      {proofError && <div className="ie-notice" data-tone="error" role="alert">{proofError}<br /><button type="button" onClick={() => void proofs.refresh()}>Erneut prüfen</button></div>}
      {!proofs.loading && !proofError && !proofs.data?.length && <p className="ie-inline-note">Für diese Auswahl sind keine Leistungsnachweise als PDF verfügbar. Die Rechnung kann ohne Anlage erzeugt werden.</p>}
      {(proofs.data ?? []).map(proof => <div key={proof.id}><label className="ie-choice"><input type="checkbox" checked={selectedIds.includes(proof.id)} disabled={busy || disabled || !proof.available || !allowProofSelection} onChange={event => changeProof(proof.id, event.target.checked)} /><span>{proof.title}<small>{invoiceEditorDate(proof.serviceDate)}{!proof.available ? ` · ${proof.unavailableReason ?? 'PDF noch nicht verfügbar'}` : ''}</small></span></label>{proof.available && <button className="ie-link" disabled={busy || disabled} onClick={() => void downloadOriginal(proof.id)}>Original herunterladen · {invoiceEditorDate(proof.serviceDate)}</button>}</div>)}
      {!proofs.loading && !proofError && <p className="ie-inline-note">{selectedIds.length} {selectedIds.length === 1 ? 'Anlage ausgewählt' : 'Anlagen ausgewählt'}{available.length ? ` · ${available.length} verfügbar` : ''}</p>}
    </div>}
    {error && <div className="ie-notice" data-tone="error" role="alert">{error}</div>}
    {prepared?.validation.warnings.length ? <div className="ie-notice" data-tone="warning" role="status">{prepared.validation.warnings.join('\n')}</div> : null}
    <div className="ie-preview-toolbar"><button type="button" className="ie-primary" disabled={busy || disabled || invalid || waiting} onClick={() => void prepare()}>{busy ? 'PDF wird erstellt …' : url ? 'Vorschau aktualisieren' : 'PDF-Vorschau erstellen'}</button>{prepared && <button type="button" disabled={busy || disabled || invalid} onClick={() => void download()}>PDF herunterladen</button>}</div>
    {url ? <><iframe title="Rechnungs-PDF Vorschau" src={`${url}#toolbar=1&navpanes=0`} /><p className="ie-preview-note">Falls die Vorschau nicht angezeigt wird: <a href={url} target="_blank" rel="noopener noreferrer">PDF in einem neuen Tab öffnen</a>.</p></> : <div className="ie-paper"><svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M12 5h16l9 9v29H12V5Z" stroke="currentColor" strokeWidth="2" /><path d="M27 5v11h10M18 24h13M18 30h13M18 36h8" stroke="currentColor" strokeWidth="2" /></svg><strong>Die Rechnung vor dem Speichern prüfen</strong><p>Die Vorschau verwendet Ihre Eingaben und die hinterlegten Unternehmensdaten.</p></div>}
    <p className="ie-preview-note">{draft || invoice?.status === 'draft' ? 'Entwürfe sind als ENTWURF gekennzeichnet. Eine Vorschau speichert oder versendet keine Rechnung.' : 'Eine Vorschau versendet keine Rechnung.'}</p>
  </section>;
}
