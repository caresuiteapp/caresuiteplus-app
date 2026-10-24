// Generated native presentation from src/components/office/invoices/EInvoiceXmlPreview.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {nativeURL as URL,nativeBlob as Blob} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {NativeSection,NativeDiv,NativeH2,NativeP,NativeSpan,NativeButton,NativeA,NativeStrong,NativeUl,NativeLi,NativeDetails,NativeSummary,NativePre} from '@/components/layout/NativeWorkspaceElements.native';
import { useEffect, useRef, useState } from 'react';
import type { RoleKey } from '@/types';
import type { OfficeInvoice } from "../../../lib/office/invoiceWorkspaceTypes.native.ts";
import { downloadOfficeIssuedEInvoice, prepareOfficeEInvoiceDraft } from "../../../lib/office/eInvoiceExportService.native.ts";
type PreparedDraft = {
    xml: string;
    fileName: string;
    findings: string[];
    sha256: string;
};
type Props = {
    tenantId: string;
    invoice: OfficeInvoice;
    roleKey: RoleKey;
    disabled?: boolean;
};
/** This is an explicitly unissued XML draft. A successful data preparation is not a norm validation. */
export function EInvoiceXmlPreview({ tenantId, invoice, roleKey, disabled = false }: Props) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [prepared, setPrepared] = useState<{
        key: string;
        data: PreparedDraft;
        url: string;
    } | null>(null);
    const key = JSON.stringify([tenantId, invoice.id, invoice.updatedAt, roleKey]);
    const current = useRef(key);
    current.current = key;
    const mounted = useRef(true);
    const lock = useRef(false);
    const urlRef = useRef('');
    const currentPrepared = prepared?.key === key ? prepared : null;
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; if (urlRef.current)
        URL.revokeObjectURL(urlRef.current); }; }, []);
    useEffect(() => { if (urlRef.current)
        URL.revokeObjectURL(urlRef.current); urlRef.current = ''; setPrepared(null); setError(''); }, [key]);
    async function prepare() {
        if (disabled || lock.current || invoice.status !== 'draft' || invoice.eInvoice?.format !== 'xrechnung')
            return;
        const revision = key;
        lock.current = true;
        setBusy(true);
        setError('');
        if (urlRef.current)
            URL.revokeObjectURL(urlRef.current);
        urlRef.current = '';
        setPrepared(null);
        try {
            const result = await prepareOfficeEInvoiceDraft(tenantId, invoice, roleKey);
            if (!mounted.current || current.current !== revision)
                return;
            if (!result.ok) {
                setError(result.error);
                return;
            }
            if (!result.data.xml || !result.data.fileName) {
                setError('Der XML-Entwurf wurde nicht vollständig erstellt.');
                return;
            }
            const url = URL.createObjectURL(new Blob([result.data.xml], { type: 'application/xml;charset=utf-8' }));
            urlRef.current = url;
            setPrepared({ key: revision, data: result.data, url });
        }
        catch (cause) {
            if (mounted.current && current.current === revision)
                setError(cause instanceof Error ? cause.message : 'Der XML-Entwurf konnte nicht erstellt werden.');
        }
        finally {
            lock.current = false;
            if (mounted.current)
                setBusy(false);
        }
    }
    return <NativeSection className="ie-panel" data-testid="einvoice-xml-draft-preview">
    <NativeDiv className="ie-panel-head"><NativeDiv><NativeH2>XML-Entwurf</NativeH2><NativeP>Strukturierte Vorschau aus dem gespeicherten Rechnungsstand.</NativeP></NativeDiv><NativeSpan className="ie-badge" data-tone="warning">Nicht ausgestellt</NativeSpan></NativeDiv>
    <NativeP className="ie-inline-note" style={{ marginBottom: 14 }}>Dieser Entwurf hat keine endgültige Rechnungsnummer und ist nicht als gültige E-Rechnung freigegeben. Die vollständige Normprüfung steht aus.</NativeP>
    {error && <NativeDiv className="ie-notice" data-tone="error" role="alert">{error}</NativeDiv>}
    <NativeDiv className="ie-actions"><NativeButton disabled={disabled || busy} onClick={() => void prepare()}>{busy ? 'XML wird erstellt …' : currentPrepared ? 'XML-Entwurf neu erstellen' : 'XML-Entwurf erstellen'}</NativeButton>
      {currentPrepared && !disabled && <NativeA className="ie-button" href={currentPrepared.url} download={currentPrepared.data.fileName}>XML-Entwurf herunterladen</NativeA>}
    </NativeDiv>
    {busy && <NativeP className="ie-inline-note" role="status">Gespeicherten Stand und strukturierte Angaben laden …</NativeP>}
    {currentPrepared && <>
      {currentPrepared.data.findings.length > 0 && <NativeDiv className="ie-notice" data-tone="warning" style={{ marginTop: 14 }}><NativeStrong>Hinweise zum Entwurf</NativeStrong><NativeUl>{currentPrepared.data.findings.map((finding, index) => <NativeLi key={`${index}:${finding}`}>{finding}</NativeLi>)}</NativeUl></NativeDiv>}
      <NativeDetails className="ie-einvoice-details"><NativeSummary>XML-Inhalt ansehen</NativeSummary><NativePre tabIndex={0} aria-label="XML-Entwurf" style={{ margin: '12px 0 0', maxHeight: 380, overflow: 'auto', padding: 14, border: '1px solid #dce5f0', borderRadius: 10, background: '#f5f8fc', color: '#234266', fontSize: 12, whiteSpace: 'pre', lineHeight: 1.55 }}>{currentPrepared.data.xml}</NativePre></NativeDetails>
    </>}
  </NativeSection>;
}
export function EInvoiceOriginalDownload({ tenantId, invoice, roleKey, disabled = false }: Props) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [original, setOriginal] = useState<{
        key: string;
        fileName: string;
        validationMessage: string;
        text: string;
        url: string;
    } | null>(null);
    const key = JSON.stringify([tenantId, invoice.id, invoice.updatedAt, roleKey]);
    const current = useRef(key);
    current.current = key;
    const mounted = useRef(true);
    const lock = useRef(false);
    const urlRef = useRef('');
    const currentOriginal = original?.key === key ? original : null;
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; if (urlRef.current)
        URL.revokeObjectURL(urlRef.current); }; }, []);
    useEffect(() => { if (urlRef.current)
        URL.revokeObjectURL(urlRef.current); urlRef.current = ''; setOriginal(null); setError(''); }, [key]);
    async function load() {
        if (disabled || lock.current || invoice.status === 'draft' || invoice.eInvoice?.format !== 'xrechnung')
            return;
        const revision = key;
        lock.current = true;
        setBusy(true);
        setError('');
        if (urlRef.current)
            URL.revokeObjectURL(urlRef.current);
        urlRef.current = '';
        setOriginal(null);
        try {
            const result = await downloadOfficeIssuedEInvoice(tenantId, invoice.id, roleKey);
            if (!mounted.current || current.current !== revision)
                return;
            if (!result.ok) {
                setError(result.error);
                return;
            }
            if (!result.data.bytes.byteLength || !result.data.fileName) {
                setError('Die gespeicherte XML-Datei ist unvollständig.');
                return;
            }
            const bytes = new Uint8Array(result.data.bytes);
            const url = URL.createObjectURL(new Blob([bytes], { type: 'application/xml' }));
            urlRef.current = url;
            setOriginal({ key: revision, fileName: result.data.fileName, validationMessage: result.data.validationMessage, text: new TextDecoder('utf-8', { fatal: true }).decode(bytes), url });
        }
        catch (cause) {
            if (mounted.current && current.current === revision)
                setError(cause instanceof Error ? cause.message : 'Das XML-Original konnte nicht geladen werden.');
        }
        finally {
            lock.current = false;
            if (mounted.current)
                setBusy(false);
        }
    }
    return <NativeSection className="ie-panel" data-testid="einvoice-issued-original">
    <NativeDiv className="ie-panel-head"><NativeDiv><NativeH2>Ausgestellte E-Rechnung</NativeH2><NativeP>Die bei der Freigabe gespeicherte XML-Datei abrufen.</NativeP></NativeDiv><NativeSpan className="ie-badge" data-tone="blue">XML-Original</NativeSpan></NativeDiv>
    {error && <NativeDiv className="ie-notice" data-tone="error" role="alert">{error}</NativeDiv>}
    <NativeDiv className="ie-actions"><NativeButton disabled={disabled || busy} onClick={() => void load()}>{busy ? 'Original wird geladen …' : currentOriginal ? 'XML-Original erneut laden' : 'XML-Original laden'}</NativeButton>{currentOriginal && !disabled && <NativeA className="ie-button ie-primary" href={currentOriginal.url} download={currentOriginal.fileName}>XML-Original herunterladen</NativeA>}</NativeDiv>
    {currentOriginal && <>
      {currentOriginal.validationMessage && <NativeDiv className="ie-notice" style={{ marginTop: 14 }}>{currentOriginal.validationMessage}</NativeDiv>}
      <NativeDetails className="ie-einvoice-details"><NativeSummary>Gespeicherten XML-Inhalt ansehen</NativeSummary><NativePre tabIndex={0} aria-label="Ausgestellte XML-Rechnung" style={{ margin: '12px 0 0', maxHeight: 380, overflow: 'auto', padding: 14, border: '1px solid #dce5f0', borderRadius: 10, background: '#f5f8fc', color: '#234266', fontSize: 12, whiteSpace: 'pre', lineHeight: 1.55 }}>{currentOriginal.text}</NativePre></NativeDetails>
    </>}
    <NativeP className="ie-inline-note">Für die Weitergabe der E-Rechnung die XML-Datei verwenden. Die PDF daneben ist die lesbare Darstellung.</NativeP>
  </NativeSection>;
}
