import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CareSignatureModal } from './CareSignatureModal';
import { useTenantDisplayMeta } from '@/hooks/useTenantDisplayMeta';
import { getServiceMode } from '@/lib/services/mode';
import type { LlganViewContext } from '@/design/tokens/lightLiquidGlassAuroraNebula';
import type { ClientIntakeErrors, ClientIntakeFormData } from '@/types/forms/clientIntakeForm';
import { listApplicableIntakeTemplates, listAvailableContractTypes } from '@/features/intakeDocuments/buildIntakeDocumentContext';
import { loadIntakeDocumentTemplates } from '@/features/intakeDocuments/intakeDocumentService';
import { changeIntakeDocumentSelection, INTAKE_SIGNATURE_ROLE_LABELS, prepareIntakeDocumentPackage, signIntakeDocumentPackage,
  type IntakeDocumentPackage, type PackageIssue } from '@/features/intakeDocuments/intakeDocumentPackage';
import { ASSIGNMENT_TEMPLATE_KEY, INTAKE_CONTRACT_TYPE_LABELS, OPTIONAL_CONSENT_TEMPLATE_KEYS,
  type IntakeContractTypeKey, type IntakeDocumentSignature, type IntakeDocumentState, type IntakeDocumentTemplate, type IntakeSignatureRole } from '@/features/intakeDocuments/intakeDocumentTypes';
import { escapeIntakeHtml } from '@/features/intakeDocuments/intakeDocumentRenderBinding';
import { INTAKE_DOCUMENT_CSS } from '@/features/intakeDocuments/renderIntakeDocumentPreview';
import { intakeDocumentPackageCss } from './intakeDocumentPackageCss.web';

type Props = {
  form: ClientIntakeFormData; errors: ClientIntakeErrors; tenantId: string | null;
  onChange: (form: ClientIntakeFormData) => void; panelViewContext?: LlganViewContext;
  onPersistPackage?: (form: ClientIntakeFormData) => Promise<boolean>;
};
const OPTIONAL = [
  { key: ASSIGNMENT_TEMPLATE_KEY, title: 'Abtretungserklärung / Direktabrechnung' },
  { key: 'confidentiality_release_default', title: 'Schweigepflichtentbindung' },
  { key: 'communication_consent_default', title: 'Kommunikationseinwilligung' },
  { key: 'photo_media_consent_default', title: 'Foto- und Medien-Einwilligung' },
  { key: 'emergency_contact_consent_default', title: 'Einwilligung Notfallkontakt' },
];

/** Presentation wrapper only; the individual originals remain byte-for-byte unchanged. */
export function buildIntakePackagePreview(documents: IntakeDocumentState[]): string {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ausgewählte Aufnahmeunterlagen</title><style>${INTAKE_DOCUMENT_CSS}
    html{scroll-behavior:smooth}body{background:#eaf0f7}.package-label{max-width:210mm;margin:22px auto 0;padding:0 18px;color:#3f5c7c;font:600 13px Arial,sans-serif}.document-legal{margin-top:10px}
    @media(max-width:620px){.document-legal{padding:22px 18px;min-height:0;margin:10px 8px 22px}.document-parties td{overflow-wrap:anywhere}.document-parties .label{width:100px}.document-signature-block .sig-field{min-width:150px}.document-paragraph{text-align:left}.package-label{font-size:12px}}
    @media print{.package-label{display:none}.document-legal{break-after:page;box-shadow:none;margin:0}.document-legal:last-child{break-after:auto}}
    @media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
    </style></head><body>${documents.map((document, index) => {
      const original = document.finalizedHtml || document.previewHtml || '';
      const body = original.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] || '';
      return `<div class="package-label" id="package-document-${index}">${index + 1} / ${documents.length} · ${escapeIntakeHtml(document.title)}</div>${body}`;
    }).join('\n')}</body></html>`;
}

export function CareIntakeDocumentsStepPanel({ form, errors, tenantId, onChange, onPersistPackage }: Props) {
  const tenant = useTenantDisplayMeta();
  const titleId = useId();
  const [templates, setTemplates] = useState<IntakeDocumentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [review, setReview] = useState<IntakeDocumentPackage | null>(null);
  const [phase, setPhase] = useState<'preview' | 'signatures'>('preview');
  const [captures, setCaptures] = useState<Partial<Record<IntakeSignatureRole, IntakeDocumentSignature>>>({});
  const [role, setRole] = useState<IntakeSignatureRole | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [issues, setIssues] = useState<PackageIssue[]>([]);
  const [busy, setBusy] = useState(false);
  const [saveState, setSaveState] = useState<'none' | 'saved' | 'failed' | 'local'>('none');
  const [pendingSave, setPendingSave] = useState<ClientIntakeFormData | null>(null);
  const current = useRef(form); current.current = form;
  const saving = useRef(false);
  const frame = useRef<HTMLIFrameElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const scope = JSON.stringify([tenantId, form.careContexts, form.intakeContractType, form.intakeAssignmentEnabled, form.intakeOptionalConsents]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setLoadError(null);
    if (getServiceMode() !== 'supabase') {
      setTemplates(listApplicableIntakeTemplates(current.current)); setLoading(false); return;
    }
    if (!tenantId) { setLoadError('Bitte eine aktive Unternehmenssitzung öffnen.'); setLoading(false); return; }
    void loadIntakeDocumentTemplates(tenantId, current.current).then(result => {
      if (cancelled) return;
      if (result.ok) setTemplates(result.data);
      else setLoadError(result.error);
    }).catch(() => { if (!cancelled) setLoadError('Die Dokumentvorlagen konnten nicht geladen werden.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [scope, tenantId, reload]);

  const selected = listApplicableIntakeTemplates(form, templates);
  const required = selected.filter(template => template.documentType === 'privacy_consent' || template.documentType === 'client_contract');
  const completed = selected.filter(template => form.intakeDocuments.some(document => document.templateKey === template.templateKey && document.status === 'finalized')).length;
  const preview = useMemo(() => review ? buildIntakePackagePreview(review.documents) : '', [review]);
  const close = () => {
    if (saving.current || role) return;
    if (Object.keys(captures).length && !pendingSave && !window.confirm('Die erfassten Unterschriften wurden noch nicht auf das Paket übernommen. Zeichnungen verwerfen und schließen?')) return;
    setReview(null); setCaptures({}); setRole(null);
  };
  const closeRef = useRef(close); closeRef.current = close;

  const hasUnsavedCaptures = Object.keys(captures).length > 0 || (saveState === 'failed' && Boolean(pendingSave));
  useEffect(() => {
    if (!hasUnsavedCaptures && !busy) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [hasUnsavedCaptures, busy]);

  useEffect(() => {
    if (!review) return;
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (role) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeRef.current(); }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),iframe,summary,[tabindex="0"]') ?? []);
      const first = focusable[0], last = focusable.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', handleKey, true);
    return () => { document.removeEventListener('keydown', handleKey, true); previous?.focus(); };
  }, [Boolean(review), role]);

  const changeSelection = (selection: Parameters<typeof changeIntakeDocumentSelection>[1]) => {
    try { onChange(changeIntakeDocumentSelection(form, selection)); setIssues([]); setSaveState('none'); setPendingSave(null); }
    catch (error) { setIssues([{ title: 'Auswahl', message: error instanceof Error ? error.message : 'Die Auswahl konnte nicht geändert werden.' }]); }
  };
  const open = () => {
    const prepared = prepareIntakeDocumentPackage(form, templates, tenant);
    onChange(prepared.form); setReview(prepared); setPhase('preview'); setCaptures({}); setAcknowledged(false); setIssues(prepared.issues);
  };
  const persist = async (next: ClientIntakeFormData) => {
    setPendingSave(next);
    if (!onPersistPackage) { onChange(next); setSaveState('local'); setPendingSave(null); return; }
    const saved = await onPersistPackage(next);
    setSaveState(saved ? (getServiceMode() === 'supabase' ? 'saved' : 'local') : 'failed');
    if (!saved) setIssues([{ title: 'Speicherung noch offen', message: 'Das unterzeichnete Paket bleibt erhalten. Bitte erneut sichern; die Unterschriften müssen nicht wiederholt werden.' }]);
    else { setIssues([]); setPendingSave(null); }
  };
  const finish = async () => {
    if (!review || saving.current) return;
    saving.current = true; setBusy(true);
    try {
      if (pendingSave) { await persist(pendingSave); return; }
      if (!acknowledged) return;
      const result = signIntakeDocumentPackage(current.current, templates, review.documents, captures, tenant);
      if (!result.ok) { setIssues(result.issues); return; }
      onChange(result.form);
      setReview(prepareIntakeDocumentPackage(result.form, templates, tenant));
      setCaptures({}); setPhase('preview');
      await persist(result.form);
    } catch { setSaveState('failed'); setIssues([{ title: 'Speicherung noch offen', message: 'Die Speicherung konnte nicht bestätigt werden. Bitte erneut sichern.' }]); }
    finally { saving.current = false; setBusy(false); }
  };
  const notice = <>
    {issues.length ? <div className="cs-contract-notice is-error" role="alert"><strong>Bitte prüfen</strong><ul>{issues.map((issue, index) => <li key={`${issue.title}-${index}`}><strong>{issue.title}:</strong> {issue.message}</li>)}</ul></div> : null}
    {saveState === 'saved' ? <div className="cs-contract-notice is-success" role="status">Das unterzeichnete Paket ist im Unternehmen gespeichert. Die Unterschriften sind fest in den Dokumenten platziert. Die Aufnahme schließen Sie anschließend unter „Prüfen & sichern“ ab.</div> : null}
    {saveState === 'local' ? <div className="cs-contract-notice" role="status">Die unterschriebenen Dokumentfassungen sind vorbereitet. Bitte den Aufnahme- oder Änderungsvorgang abschließen, um sie in der Akte zu speichern.</div> : null}
  </>;
  const allCaptured = Boolean(review?.roles.length) && review!.roles.every(requiredRole => captures[requiredRole]?.dataUrl);

  return <div className="cs-contract-package">
    <style>{intakeDocumentPackageCss}</style>
    <div className="cs-contract-card cs-contract-type"><strong>Vertragsart</strong>{listAvailableContractTypes(form.careContexts).map(key => <button type="button" className="cs-contract-button" key={key}
      aria-pressed={(form.intakeContractType || listAvailableContractTypes(form.careContexts)[0]) === key} disabled={busy || Boolean(pendingSave)}
      onClick={() => changeSelection({ intakeContractType: key as IntakeContractTypeKey })}>{INTAKE_CONTRACT_TYPE_LABELS[key]}</button>)}</div>
    <div className="cs-contract-summary"><div><h3>{selected.length} Dokumente · ein Paket</h3><p>Alle ausgewählten Unterlagen gemeinsam lesen. Anschließend unterschreiben Klient:in und Mitarbeitende:r jeweils einmal für ihre vorgesehenen Felder.</p></div>
      <button type="button" className="cs-contract-button is-primary" onClick={open} disabled={loading || Boolean(loadError) || busy}>Gesamte Vorschau öffnen <span aria-hidden="true">↗</span></button></div>
    {loading ? <p className="cs-contract-notice" role="status">Dokumentvorlagen werden geladen …</p> : null}
    {loadError ? <div className="cs-contract-notice is-error" role="alert">{loadError}<br/><button type="button" className="cs-contract-button" onClick={() => setReload(value => value + 1)}>Erneut laden</button></div> : null}
    <div className="cs-contract-columns">
      <section className="cs-contract-card"><h3>Erforderliche Unterlagen</h3><p>Diese Unterlagen gehören zur Aufnahme.</p><div className="cs-contract-list">{required.map(template => <label key={template.templateKey} className="cs-contract-choice is-selected"><input type="checkbox" checked disabled/><span><strong>{template.title}</strong><small>{form.intakeDocuments.some(document => document.templateKey === template.templateKey && document.status === 'finalized') ? 'Unterzeichnet · Fassung gesperrt' : 'Im Paket enthalten'}</small></span></label>)}</div>
        <p>{completed ? `${completed} von ${selected.length} Dokumenten unterzeichnet.` : 'Die Unterschriften erfassen Sie nach der gemeinsamen Vorschau.'}</p></section>
      <section className="cs-contract-card"><h3>Weitere Vereinbarungen</h3><p>Nur die tatsächlich vereinbarten Unterlagen auswählen.</p><div className="cs-contract-tools"><button type="button" disabled={busy || Boolean(pendingSave)} onClick={() => changeSelection({ intakeAssignmentEnabled: true, intakeOptionalConsents: [...OPTIONAL_CONSENT_TEMPLATE_KEYS] })}>Alle hinzufügen</button><button type="button" disabled={busy || Boolean(pendingSave)} onClick={() => changeSelection({ intakeAssignmentEnabled: false, intakeOptionalConsents: [] })}>Zusatz-Auswahl aufheben</button></div>
        <div className="cs-contract-list">{OPTIONAL.map(option => {
          const isAssignment = option.key === ASSIGNMENT_TEMPLATE_KEY;
          const checked = isAssignment ? form.intakeAssignmentEnabled : form.intakeOptionalConsents.includes(option.key);
          return <label key={option.key} className={`cs-contract-choice${checked ? ' is-selected' : ''}`}><input type="checkbox" checked={checked} disabled={busy || Boolean(pendingSave)} onChange={() => changeSelection(isAssignment ? { intakeAssignmentEnabled: !checked } : { intakeOptionalConsents: checked ? form.intakeOptionalConsents.filter(key => key !== option.key) : [...form.intakeOptionalConsents, option.key] })}/><span><strong>{option.title}</strong></span></label>;
        })}</div></section>
    </div>
    {!review ? notice : null}
    {!review && pendingSave && saveState === 'failed' ? <button type="button" className="cs-contract-button is-primary" onClick={() => { const prepared = prepareIntakeDocumentPackage(pendingSave, templates, tenant); setReview(prepared); }} >Unterzeichnetes Paket erneut sichern</button> : null}
    {Object.entries(errors).filter(([key, value]) => key.startsWith('intake') && value).length && !review ? <div className="cs-contract-notice is-error">Bitte die gemeinsame Vorschau öffnen und die dort angezeigten Angaben und Unterschriften vervollständigen.</div> : null}
    {review && typeof document !== 'undefined' ? createPortal(<div className="cs-contract-backdrop"><style>{intakeDocumentPackageCss}</style><div ref={dialog} tabIndex={-1} className="cs-contract-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <header className="cs-contract-dialog-header"><div><h2 id={titleId}>{phase === 'preview' ? 'Ihr vollständiges Dokumentenpaket' : 'Dokumentenpaket gemeinsam unterschreiben'}</h2><p>{review.documents.length} Unterlagen für {[form.firstName, form.lastName].filter(Boolean).join(' ')} · {phase === 'preview' ? '1. Gemeinsam prüfen' : '2. Unterschriften erfassen'}</p></div><button type="button" className="cs-contract-close" aria-label="Paketvorschau schließen" onClick={close} disabled={busy}>×</button></header>
      <div className="cs-contract-dialog-body">
        {phase === 'preview' ? <>{issues.length || saveState !== 'none' ? <div style={{ marginBottom: 16 }}>{notice}</div> : null}<div className="cs-contract-review"><nav className="cs-contract-index" aria-label="Unterlagen im Paket"><h3>Im Paket enthalten</h3><ol>{review.documents.map((document, index) => <li key={document.templateKey}><button type="button" onClick={() => frame.current?.contentDocument?.getElementById(`package-document-${index}`)?.scrollIntoView({ block: 'start' })}><span>{String(index + 1).padStart(2, '0')}</span><span>{document.title}</span></button></li>)}</ol></nav><iframe ref={frame} className="cs-contract-preview" title="Gesamte Vertragsvorschau" srcDoc={preview} sandbox="allow-same-origin" /></div></> :
        <div className="cs-contract-signing"><p>Die Unterschriften gelten für das soeben geprüfte Paket. Sie werden automatisch in die passenden Felder der jeweiligen Dokumente eingesetzt.</p>{notice}
          <div className="cs-contract-signatures">{review.roles.map(requiredRole => <section key={requiredRole} className={`cs-contract-signature${captures[requiredRole] ? ' is-captured' : ''}`}><h3>{INTAKE_SIGNATURE_ROLE_LABELS[requiredRole]}</h3><p>{captures[requiredRole] ? 'Unterschrift erfasst' : 'Unterschrift erforderlich'}</p><div className="cs-contract-signature-image">{captures[requiredRole] ? <img src={captures[requiredRole]!.dataUrl} alt={`Erfasste Unterschrift ${INTAKE_SIGNATURE_ROLE_LABELS[requiredRole]}`} /> : <span>Noch nicht unterschrieben</span>}</div><button type="button" className="cs-contract-button" onClick={() => setRole(requiredRole)} disabled={busy}>{captures[requiredRole] ? 'Neu zeichnen' : 'Jetzt unterschreiben'}</button></section>)}</div>
          <label className="cs-contract-acknowledgement"><input type="checkbox" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} disabled={busy}/><span>Die ausgewählten Unterlagen wurden gemeinsam geprüft. Die erfassten Unterschriften sollen in die vorgesehenen Felder übernommen und mit diesen Dokumentfassungen gespeichert werden.</span></label>
          <details className="cs-contract-included"><summary>Diese {review.documents.length} Dokumente werden unterschrieben</summary><ul>{review.documents.map(document => <li key={document.templateKey}>{document.title}{document.status === 'finalized' ? ' · bereits unterzeichnet' : ''}</li>)}</ul></details>
        </div>}
      </div>
      <footer className="cs-contract-dialog-footer"><p>{busy ? 'Unterzeichnetes Paket wird gesichert …' : phase === 'preview' ? 'Alle Unterlagen sind in einer gemeinsamen Vorschau enthalten.' : 'Nach der Übernahme bleiben die unterschriebenen Fassungen gesperrt.'}</p><div>
        {phase === 'signatures' ? <button type="button" className="cs-contract-button" onClick={() => setPhase('preview')} disabled={busy}>Zur Vorschau</button> : null}
        {pendingSave && saveState === 'failed' ? <button type="button" className="cs-contract-button is-primary" onClick={() => void finish()} disabled={busy}>Erneut sichern</button> : phase === 'preview' && review.roles.length ? <button type="button" className="cs-contract-button is-primary" onClick={() => setPhase('signatures')} disabled={review.issues.length > 0 || loading || Boolean(loadError)}>Gemeinsam unterschreiben</button> : phase === 'signatures' ? <button type="button" className="cs-contract-button is-primary" disabled={!allCaptured || !acknowledged || busy} onClick={() => void finish()}>Unterzeichnetes Paket sichern</button> : <button type="button" className="cs-contract-button is-primary" onClick={close} disabled={busy}>Fertig</button>}
      </div></footer>
    </div></div>, document.body) : null}
    {role ? <CareSignatureModal visible key={role} label={`${INTAKE_SIGNATURE_ROLE_LABELS[role]} · ${review?.documents.length ?? 0} Dokumente`} onConfirm={dataUrl => { setCaptures(previous => ({ ...previous, [role]: { role, dataUrl, signedAt: new Date().toISOString() } })); setRole(null); }} onClose={() => setRole(null)} /> : null}
  </div>;
}

export { validateIntakeDocumentsStep } from '@/features/intakeDocuments/validateIntakeDocuments';
