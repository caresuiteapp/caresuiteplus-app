import { useMemo, useRef, useState } from 'react';
import { DocumentHtmlPreview } from '@/components/office/DocumentHtmlPreview';
import { CsDocumentClientRecipientPicker, CsDocumentEmployeeRecipientPicker } from './CsDocumentRecipientPicker.web';
import { useAuth } from '@/lib/auth/context';
import { previewCsDocumentSend } from '@/lib/documents/csTemplates';
import { validateRecipients } from '@/lib/documents/csTemplates/csTemplateValidation';
import type { CsDocumentTemplate, CsRecipientScope, CsTemplateSignatureField } from '@/types/documents/csTemplateDatabase';
import type { CsDocumentClientRecipient, CsDocumentEmployeeRecipient } from '@/types/documents/csDocumentRecipients';
import { SIGNER_LABELS } from './signatureWorkspaceModel.web';

type Props = { tenantId: string; templates: CsDocumentTemplate[]; officeUserName?: string | null; onClose: () => void; onBusyChange?: (busy: boolean) => void; onSend: (input: { templateKey: string; recipientScope: CsRecipientScope; employeeId?: string; clientId?: string }) => Promise<{ ok: boolean; error?: string }> };

export function CsDocumentSendWizard({ tenantId, templates, officeUserName, onSend, onClose, onBusyChange }: Props) {
  const { profile } = useAuth();
  const [step, setStep] = useState(0);
  const [search, setSearch] = useState('');
  const [templateKey, setTemplateKey] = useState('');
  const [scope, setScope] = useState<CsRecipientScope>('client');
  const [employee, setEmployee] = useState<CsDocumentEmployeeRecipient | null>(null);
  const [client, setClient] = useState<CsDocumentClientRecipient | null>(null);
  const [preview, setPreview] = useState<{ renderedHtml: string; signatureFields: CsTemplateSignatureField[]; issues: string[] } | null>(null);
  const [working, setWorking] = useState(false);
  const operation = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const selected = templates.find((template) => template.templateKey === templateKey);
  const options = templates.filter((template) => ['client', 'employee', 'both'].includes(template.recipientScope));
  const filtered = options.filter((template) => [template.title, template.shortDescription, ...template.tags].join(' ').toLocaleLowerCase('de-DE').includes(search.trim().toLocaleLowerCase('de-DE')));
  const selectedEmployeeId = scope === 'employee' || scope === 'both' ? employee?.id : undefined;
  const selectedClientId = scope === 'client' || scope === 'both' ? client?.id : undefined;
  const issues = useMemo(() => validateRecipients({ recipientScope: scope, employeeId: selectedEmployeeId, clientId: selectedClientId }).map((issue) => issue.message), [scope, selectedEmployeeId, selectedClientId]);
  const allowedScopes: CsRecipientScope[] = selected?.recipientScope === 'both' ? ['client', 'employee', 'both'] : selected?.recipientScope === 'employee' ? ['employee', 'both'] : ['client', 'both'];
  const employeeSigningBlocked = preview?.signatureFields.some((field) => field.required && field.signerRole === 'employee') ?? false;

  async function loadPreview() {
    if (operation.current || !selected || issues.length) return;
    operation.current = true; setWorking(true); onBusyChange?.(true); setError(null); setPreview(null);
    try {
      const result = await previewCsDocumentSend({ tenantId, templateKey, recipientScope: scope, employeeId: selectedEmployeeId ?? null, clientId: selectedClientId ?? null, actorRoleKey: profile?.roleKey, officeUser: { name: officeUserName } });
      if (!result.ok) { setError(result.error); return; }
      setPreview(result.data); setStep(2);
    } catch { setError('Die Vorschau konnte nicht geladen werden. Bitte erneut versuchen.'); }
    finally { operation.current = false; setWorking(false); onBusyChange?.(false); }
  }
  async function send() {
    if (operation.current || !selected || !preview || preview.issues.length || issues.length || employeeSigningBlocked) return;
    operation.current = true; setWorking(true); onBusyChange?.(true); setError(null);
    try {
      const result = await onSend({ templateKey, recipientScope: scope, employeeId: selectedEmployeeId, clientId: selectedClientId });
      if (!result.ok) setError(result.error ?? 'Das Dokument konnte nicht gesendet werden.');
      else onClose();
    } catch { setError('Der Versand konnte nicht bestätigt werden. Bitte zuerst die Liste aktualisieren, um einen doppelten Versand zu vermeiden.'); }
    finally { operation.current = false; setWorking(false); onBusyChange?.(false); }
  }
  return <fieldset className="ds-form" disabled={working} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
    <ol className="ds-steps">{['Vorlage', 'Empfänger', 'Prüfen und senden'].map((label, index) => <li key={label} aria-current={step === index ? 'step' : undefined}>{index + 1}. {label}</li>)}</ol>
    {step === 0 ? <section><h3>Bestehende Signaturvorlage wählen</h3><p className="ds-muted">Diese Vorlagen gehören zu den bestehenden Unterschriftsabläufen. Die 450 Dokumentvorlagen finden Sie im zentralen Dokumentenkatalog.</p><label>Vorlage suchen<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Titel oder Suchbegriff" /></label><div className="ds-picker-list">{filtered.map((template) => <button type="button" key={template.id} className="ds-picker-option" aria-pressed={templateKey === template.templateKey} onClick={() => { setTemplateKey(template.templateKey); setScope(template.recipientScope); setPreview(null); setError(null); }}><strong>{template.title}</strong><small>{template.shortDescription ?? `Für ${SIGNER_LABELS[template.recipientScope]}`}</small></button>)}</div>{!filtered.length ? <div className="ds-empty">{options.length ? 'Keine Vorlage zur Suche gefunden.' : 'Zurzeit ist keine versendbare Signaturvorlage verfügbar.'}</div> : null}</section> : null}
    {step === 1 ? <section><h3>{selected?.title}</h3><label>Empfängergruppe<select disabled={working} value={scope} onChange={(event) => { setScope(event.target.value as CsRecipientScope); setPreview(null); }}>{allowedScopes.map((value) => <option value={value} key={value}>{SIGNER_LABELS[value]}</option>)}</select></label>
      {(scope === 'employee' || scope === 'both') ? <><CsDocumentEmployeeRecipientPicker tenantId={tenantId} actorRoleKey={profile?.roleKey} selectedId={employee?.id ?? null} onSelect={(value) => { setEmployee(value); setPreview(null); }} />{employee ? <p className="ds-muted">Ausgewählt: <strong>{employee.fullName}</strong></p> : null}</> : null}
      {(scope === 'client' || scope === 'both') ? <><CsDocumentClientRecipientPicker tenantId={tenantId} actorRoleKey={profile?.roleKey} selectedId={client?.id ?? null} onSelect={(value) => { setClient(value); setPreview(null); }} />{client ? <p className="ds-muted">Ausgewählt: <strong>{client.fullName}</strong></p> : null}</> : null}
      {issues.length ? <p className="ds-muted">{issues.join(' ')}</p> : null}
    </section> : null}
    {step === 2 && preview ? <section><h3>Dokument und Empfänger prüfen</h3><p>{[selectedEmployeeId ? employee?.fullName : null, selectedClientId ? client?.fullName : null].filter(Boolean).join(' · ')}</p>{preview.issues.length ? <div role="alert" className="ds-notice ds-notice--error">{preview.issues.join(' ')}</div> : <p className="ds-muted">Die erforderlichen Angaben sind vollständig.</p>}<DocumentHtmlPreview title={selected?.title ?? 'Vorschau'} previewHtml={preview.renderedHtml} /><div className="ds-tags">{preview.signatureFields.map((field) => <span className="ds-tag" key={field.id}>{SIGNER_LABELS[field.signerRole]}: {field.label}</span>)}</div></section> : null}
    {error ? <div role="alert" className="ds-notice ds-notice--error">{error}</div> : null}
    {employeeSigningBlocked ? <div role="alert" className="ds-notice ds-notice--error">Die Mitarbeiter-Unterschrift ist für diese bestehenden Signaturvorlagen vorübergehend gesperrt. Bitte verwenden Sie für neue Mitarbeiterdokumente den Versand „Schreiben / PDF“.</div> : null}
    <div className="ds-actions"><button type="button" className="ds-button" disabled={working} onClick={step === 0 ? onClose : () => { setStep(step - 1); setError(null); }}>{step === 0 ? 'Abbrechen' : 'Zurück'}</button>{step === 0 ? <button type="button" className="ds-button ds-button--primary" disabled={!selected} onClick={() => setStep(1)}>Empfänger wählen</button> : step === 1 ? <button type="button" className="ds-button ds-button--primary" disabled={working || issues.length > 0} onClick={() => void loadPreview()}>{working ? 'Vorschau wird geladen…' : 'Vorschau prüfen'}</button> : <button type="button" className="ds-button ds-button--primary" disabled={working || !preview || preview.issues.length > 0 || employeeSigningBlocked} onClick={() => void send()}>{working ? 'Wird gesendet…' : 'Dokument senden'}</button>}</div>
  </fieldset>;
}
