import { useMemo, useRef, useState } from 'react';
import { DocumentHtmlPreview } from '@/components/office/DocumentHtmlPreview';
import { CsDocumentClientRecipientPicker, CsDocumentEmployeeRecipientPicker } from './documentSignatures/CsDocumentRecipientPicker.web';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { insertSignatureFieldIntoHtml, wrapSignatureDocumentPreviewHtml } from '@/lib/portal/portalSignatureFieldParser';
import type { ComposeOfficeSignatureDocumentInput } from '@/lib/portal/officeSignatureDocumentComposerService';
import type { CsDocumentClientRecipient, CsDocumentEmployeeRecipient } from '@/types/documents/csDocumentRecipients';
import { PORTAL_SIGNATURE_DOCUMENT_TYPE_LABELS, PORTAL_SIGNATURE_PRIORITY_LABELS, type PortalSignatureDocumentType, type PortalSignaturePriority, type PortalSignatureRequirement } from '@/types/portal/documentSignatures';

type Props = { accentColor: string; onCancel: () => void; onBusyChange?: (busy: boolean) => void; onSubmit: (input: Omit<ComposeOfficeSignatureDocumentInput, 'tenantId' | 'creatorName' | 'creatorProfileId'>) => Promise<{ ok: boolean; error?: string }> };
const HTML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character] ?? character);

export function OfficeSignatureDocumentComposer({ onCancel, onSubmit, onBusyChange }: Props) {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const [source, setSource] = useState<'office_write' | 'pdf_upload'>('office_write');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [documentType, setDocumentType] = useState<PortalSignatureDocumentType>('sonstiges');
  const [employee, setEmployee] = useState<CsDocumentEmployeeRecipient | null>(null);
  const [client, setClient] = useState<CsDocumentClientRecipient | null>(null);
  const [requirement, setRequirement] = useState<PortalSignatureRequirement>('employee');
  const [priority, setPriority] = useState<PortalSignaturePriority>('normal');
  const [dueDate, setDueDate] = useState('');
  const [required, setRequired] = useState(false);
  const [pdf, setPdf] = useState<{ name: string; base64: string } | null>(null);
  const [reading, setReading] = useState(false);
  const [working, setWorking] = useState(false);
  const sending = useRef(false);
  const fileGeneration = useRef(0);
  const [reviewed, setReviewed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const needsClient = requirement !== 'employee';
  const html = useMemo(() => {
    let content = `<h1>${escapeHtml(title || 'Dokument')}</h1>`;
    content += source === 'office_write'
      ? body.split(/\n\s*\n/).map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br/>')}</p>`).join('')
      : '<p>Die Unterschriften gehören zu der beigefügten PDF-Datei.</p>';
    if (requirement !== 'client') content = insertSignatureFieldIntoHtml(content, 'employee');
    if (needsClient) content = insertSignatureFieldIntoHtml(content, 'client');
    return content;
  }, [title, body, source, requirement, needsClient]);

  async function readPdf(file: File | undefined) {
    const generation = ++fileGeneration.current;
    setPdf(null); setError(null); setReviewed(false);
    if (!file) { setReading(false); return; }
    if (!/\.pdf$/i.test(file.name) || file.size === 0 || file.size > 20 * 1024 * 1024) {
      setError('Bitte eine PDF-Datei mit höchstens 20 MB wählen.'); setReading(false); return;
    }
    setReading(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (String.fromCharCode(...bytes.slice(0, 5)) !== '%PDF-') throw new Error('invalid');
      let binary = '';
      for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
      if (generation !== fileGeneration.current) return;
      setPdf({ name: file.name, base64: btoa(binary) });
      if (!title.trim()) setTitle(file.name.replace(/\.pdf$/i, ''));
    } catch { if (generation === fileGeneration.current) setError('Die ausgewählte Datei ist keine lesbare PDF-Datei.'); }
    finally { if (generation === fileGeneration.current) setReading(false); }
  }

  async function submit() {
    if (sending.current) return;
    setError(null);
    if (!title.trim() || !employee || (needsClient && !client) || (source === 'office_write' && !body.trim()) || (source === 'pdf_upload' && !pdf)) {
      setError('Bitte Titel, Dokumentinhalt und alle benötigten Personen ergänzen.'); return;
    }
    if (!reviewed) { setError('Bitte Dokument und Empfänger vor dem Versand prüfen und bestätigen.'); return; }
    if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) { setError('Bitte ein gültiges Fälligkeitsdatum wählen.'); return; }
    const parsedDue = dueDate ? new Date(`${dueDate}T12:00:00`) : null;
    if (parsedDue && Number.isNaN(parsedDue.getTime())) { setError('Bitte ein gültiges Fälligkeitsdatum wählen.'); return; }
    sending.current = true; setWorking(true); onBusyChange?.(true);
    try {
      const result = await onSubmit({ title: title.trim(), documentType, sourceType: source,
        employeeId: employee.id, recipientType: needsClient ? 'client' : 'employee',
        clientId: needsClient ? client!.id : null, clientName: needsClient ? client!.fullName : null,
        signatureRequirement: requirement, dueDate: parsedDue?.toISOString() ?? null, priority,
        requiredBeforeAssignment: required, allowDownload: true, htmlContent: html,
        pdfBase64: source === 'pdf_upload' ? pdf!.base64 : null, pdfFileName: source === 'pdf_upload' ? pdf!.name : null,
      });
      if (!result.ok) setError(result.error ?? 'Das Dokument konnte nicht gesendet werden.');
    } catch { setError('Der Versand konnte nicht bestätigt werden. Bitte die Liste aktualisieren, bevor Sie erneut senden.'); }
    finally { sending.current = false; setWorking(false); onBusyChange?.(false); }
  }

  return <form onSubmit={(event) => { event.preventDefault(); void submit(); }} onChange={() => setReviewed(false)}><fieldset className="ds-form" disabled={working} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
    <div className="ds-notice">Zustellung an das Mitarbeiterportal. Eine Unterschrift der Klientin oder des Klienten wird dort gemeinsam mit der gewählten Mitarbeiterin oder dem gewählten Mitarbeiter erfasst.</div>
    <section><h3>Dokument vorbereiten</h3><div className="ds-tabs"><button type="button" aria-pressed={source === 'office_write'} onClick={() => { setSource('office_write'); setReviewed(false); }}>Schreiben</button><button type="button" aria-pressed={source === 'pdf_upload'} onClick={() => { setSource('pdf_upload'); setReviewed(false); }}>PDF hochladen</button></div>
      <div className="ds-form-grid"><label>Titel<input required value={title} onChange={(event) => setTitle(event.target.value)} maxLength={240} /></label><label>Dokumentart<select value={documentType} onChange={(event) => setDocumentType(event.target.value as PortalSignatureDocumentType)}>{Object.entries(PORTAL_SIGNATURE_DOCUMENT_TYPE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label></div>
      {source === 'office_write' ? <label>Text des Schreibens<textarea required value={body} onChange={(event) => setBody(event.target.value)} placeholder="Schreiben Sie den vollständigen Dokumenttext. Die Unterschriftsfelder werden unten ergänzt." /></label> : <label>PDF-Datei<input type="file" accept="application/pdf,.pdf" onChange={(event) => void readPdf(event.target.files?.[0])} />{reading ? 'Datei wird gelesen…' : pdf?.name ?? 'Maximal 20 MB'}</label>}
    </section>
    <section><h3>Empfänger und Unterschriften</h3><label>Wer unterschreibt?<select value={requirement} onChange={(event) => setRequirement(event.target.value as PortalSignatureRequirement)}><option value="employee">Mitarbeiter:in</option><option value="client">Klient:in im begleiteten Ablauf</option><option value="both_sequential">Erst Mitarbeiter:in, dann Klient:in</option></select></label>
      <CsDocumentEmployeeRecipientPicker tenantId={tenantId ?? ''} actorRoleKey={profile?.roleKey} selectedId={employee?.id ?? null} onSelect={(value) => { setEmployee(value); setReviewed(false); }} />
      {employee ? <p className="ds-muted">Zustellung an: <strong>{employee.fullName}</strong>{!employee.portalActive ? ' · Der Portalzugang muss vor der Unterschrift aktiviert sein.' : ''}</p> : null}
      {needsClient ? <><CsDocumentClientRecipientPicker tenantId={tenantId ?? ''} actorRoleKey={profile?.roleKey} selectedId={client?.id ?? null} onSelect={(value) => { setClient(value); setReviewed(false); }} />{client ? <p className="ds-muted">Klient:in: <strong>{client.fullName}</strong></p> : null}</> : null}
    </section>
    <section><h3>Frist und Priorität</h3><div className="ds-form-grid"><label>Fällig am, optional<input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label><label>Priorität<select value={priority} onChange={(event) => setPriority(event.target.value as PortalSignaturePriority)}>{Object.entries(PORTAL_SIGNATURE_PRIORITY_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label></div><label className="ds-check"><input type="checkbox" checked={required} onChange={(event) => setRequired(event.target.checked)} />Vor dem zugehörigen Einsatz erforderlich</label></section>
    <section><h3>Vor dem Senden prüfen</h3>{source === 'pdf_upload' && pdf ? <iframe className="ds-pdf" title={`PDF-Vorschau: ${pdf.name}`} src={`data:application/pdf;base64,${pdf.base64}`} /> : null}<DocumentHtmlPreview title={title || 'Dokumentvorschau'} previewHtml={wrapSignatureDocumentPreviewHtml(html)} /><p className="ds-muted">{employee ? `Zustellung an ${employee.fullName}.` : 'Noch kein Mitarbeiterportal ausgewählt.'}{needsClient && client ? ` Klient:in: ${client.fullName}.` : ''}</p>
      <label className="ds-check" onChange={(event) => event.stopPropagation()}><input type="checkbox" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} />Dokumentinhalt und Empfänger sind geprüft.</label>
    </section>
    {error ? <div role="alert" className="ds-notice ds-notice--error">{error}</div> : null}
    <div className="ds-actions"><button type="button" className="ds-button" disabled={working} onClick={onCancel}>Abbrechen</button><button className="ds-button ds-button--primary" type="submit" disabled={working || reading || !reviewed}>{working ? 'Wird gesendet…' : 'An Mitarbeiterportal senden'}</button></div>
  </fieldset></form>;
}
