import { useEffect, useRef, useState } from 'react';
import type { RoleKey } from '@/types';
import type { OfficeInvoice } from '@/lib/office/invoiceWorkspaceTypes.web';
import { downloadOfficeIssuedEInvoice, prepareOfficeEInvoiceDraft } from '@/lib/office/eInvoiceExportService.web';

type PreparedDraft = { xml: string; fileName: string; findings: string[]; sha256: string };
type Props = { tenantId: string; invoice: OfficeInvoice; roleKey: RoleKey; disabled?: boolean };

/** This is an explicitly unissued XML draft. A successful data preparation is not a norm validation. */
export function EInvoiceXmlPreview({ tenantId, invoice, roleKey, disabled = false }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [prepared, setPrepared] = useState<{ key: string; data: PreparedDraft; url: string } | null>(null);
  const key = JSON.stringify([tenantId, invoice.id, invoice.updatedAt, roleKey]);
  const current = useRef(key); current.current = key;
  const mounted = useRef(true); const lock = useRef(false); const urlRef = useRef('');
  const currentPrepared = prepared?.key === key ? prepared : null;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; if (urlRef.current) URL.revokeObjectURL(urlRef.current); }; }, []);
  useEffect(() => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); urlRef.current = ''; setPrepared(null); setError(''); }, [key]);

  async function prepare() {
    if (disabled || lock.current || invoice.status !== 'draft' || invoice.eInvoice?.format !== 'xrechnung') return;
    const revision = key; lock.current = true; setBusy(true); setError('');
    if (urlRef.current) URL.revokeObjectURL(urlRef.current); urlRef.current = ''; setPrepared(null);
    try {
      const result = await prepareOfficeEInvoiceDraft(tenantId, invoice, roleKey);
      if (!mounted.current || current.current !== revision) return;
      if (!result.ok) { setError(result.error); return; }
      if (!result.data.xml || !result.data.fileName) { setError('Der XML-Entwurf wurde nicht vollständig erstellt.'); return; }
      const url = URL.createObjectURL(new Blob([result.data.xml], { type: 'application/xml;charset=utf-8' }));
      urlRef.current = url; setPrepared({ key: revision, data: result.data, url });
    } catch (cause) { if (mounted.current && current.current === revision) setError(cause instanceof Error ? cause.message : 'Der XML-Entwurf konnte nicht erstellt werden.'); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  }

  return <section className="ie-panel" data-testid="einvoice-xml-draft-preview">
    <div className="ie-panel-head"><div><h2>XML-Entwurf</h2><p>Strukturierte Vorschau aus dem gespeicherten Rechnungsstand.</p></div><span className="ie-badge" data-tone="warning">Nicht ausgestellt</span></div>
    <p className="ie-inline-note" style={{ marginBottom: 14 }}>Dieser Entwurf hat keine endgültige Rechnungsnummer und ist nicht als gültige E-Rechnung freigegeben. Die vollständige Normprüfung steht aus.</p>
    {error && <div className="ie-notice" data-tone="error" role="alert">{error}</div>}
    <div className="ie-actions"><button disabled={disabled || busy} onClick={() => void prepare()}>{busy ? 'XML wird erstellt …' : currentPrepared ? 'XML-Entwurf neu erstellen' : 'XML-Entwurf erstellen'}</button>
      {currentPrepared && !disabled && <a className="ie-button" href={currentPrepared.url} download={currentPrepared.data.fileName}>XML-Entwurf herunterladen</a>}
    </div>
    {busy && <p className="ie-inline-note" role="status">Gespeicherten Stand und strukturierte Angaben laden …</p>}
    {currentPrepared && <>
      {currentPrepared.data.findings.length > 0 && <div className="ie-notice" data-tone="warning" style={{ marginTop: 14 }}><strong>Hinweise zum Entwurf</strong><ul>{currentPrepared.data.findings.map((finding, index) => <li key={`${index}:${finding}`}>{finding}</li>)}</ul></div>}
      <details className="ie-einvoice-details"><summary>XML-Inhalt ansehen</summary><pre tabIndex={0} aria-label="XML-Entwurf" style={{ margin: '12px 0 0', maxHeight: 380, overflow: 'auto', padding: 14, border: '1px solid #dce5f0', borderRadius: 10, background: '#f5f8fc', color: '#234266', fontSize: 12, whiteSpace: 'pre', lineHeight: 1.55 }}>{currentPrepared.data.xml}</pre></details>
    </>}
  </section>;
}

export function EInvoiceOriginalDownload({ tenantId, invoice, roleKey, disabled = false }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [original, setOriginal] = useState<{ key: string; fileName: string; validationMessage: string; text: string; url: string } | null>(null);
  const key = JSON.stringify([tenantId, invoice.id, invoice.updatedAt, roleKey]);
  const current = useRef(key); current.current = key;
  const mounted = useRef(true); const lock = useRef(false); const urlRef = useRef('');
  const currentOriginal = original?.key === key ? original : null;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; if (urlRef.current) URL.revokeObjectURL(urlRef.current); }; }, []);
  useEffect(() => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); urlRef.current = ''; setOriginal(null); setError(''); }, [key]);

  async function load() {
    if (disabled || lock.current || invoice.status === 'draft' || invoice.eInvoice?.format !== 'xrechnung') return;
    const revision = key; lock.current = true; setBusy(true); setError('');
    if (urlRef.current) URL.revokeObjectURL(urlRef.current); urlRef.current = ''; setOriginal(null);
    try {
      const result = await downloadOfficeIssuedEInvoice(tenantId, invoice.id, roleKey);
      if (!mounted.current || current.current !== revision) return;
      if (!result.ok) { setError(result.error); return; }
      if (!result.data.bytes.byteLength || !result.data.fileName) { setError('Die gespeicherte XML-Datei ist unvollständig.'); return; }
      const bytes = new Uint8Array(result.data.bytes);
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/xml' }));
      urlRef.current = url; setOriginal({ key: revision, fileName: result.data.fileName, validationMessage: result.data.validationMessage, text: new TextDecoder('utf-8', { fatal: true }).decode(bytes), url });
    } catch (cause) { if (mounted.current && current.current === revision) setError(cause instanceof Error ? cause.message : 'Das XML-Original konnte nicht geladen werden.'); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  }

  return <section className="ie-panel" data-testid="einvoice-issued-original">
    <div className="ie-panel-head"><div><h2>Ausgestellte E-Rechnung</h2><p>Die bei der Freigabe gespeicherte XML-Datei abrufen.</p></div><span className="ie-badge" data-tone="blue">XML-Original</span></div>
    {error && <div className="ie-notice" data-tone="error" role="alert">{error}</div>}
    <div className="ie-actions"><button disabled={disabled || busy} onClick={() => void load()}>{busy ? 'Original wird geladen …' : currentOriginal ? 'XML-Original erneut laden' : 'XML-Original laden'}</button>{currentOriginal && !disabled && <a className="ie-button ie-primary" href={currentOriginal.url} download={currentOriginal.fileName}>XML-Original herunterladen</a>}</div>
    {currentOriginal && <>
      {currentOriginal.validationMessage && <div className="ie-notice" style={{ marginTop: 14 }}>{currentOriginal.validationMessage}</div>}
      <details className="ie-einvoice-details"><summary>Gespeicherten XML-Inhalt ansehen</summary><pre tabIndex={0} aria-label="Ausgestellte XML-Rechnung" style={{ margin: '12px 0 0', maxHeight: 380, overflow: 'auto', padding: 14, border: '1px solid #dce5f0', borderRadius: 10, background: '#f5f8fc', color: '#234266', fontSize: 12, whiteSpace: 'pre', lineHeight: 1.55 }}>{currentOriginal.text}</pre></details>
    </>}
    <p className="ie-inline-note">Für die Weitergabe der E-Rechnung die XML-Datei verwenden. Die PDF daneben ist die lesbare Darstellung.</p>
  </section>;
}
