import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useClientIntakeWizard } from '@/hooks/useClientIntakeWizard';
import { usePermissions } from '@/hooks/usePermissions';
import { useAdaptiveContentStyles } from '@/design/tokens/carelightadaptive';
import { isDemoClientBackend } from '@/lib/clients/clientBackend';
import { clientRecordRoute } from '@/lib/navigation/clientRoutes';
import { hasIntakeDraftContent } from '@/lib/clients/clientIntakeDraftStorage';
import { INTAKE_WEB_SECTIONS, getIntakeWebFeedback, getIntakeWebProgress } from '@/lib/clients/clientIntakeExperience.web';
import type { IntakeSectionKey } from '@/lib/clients/clientIntakeFieldRules';
import { ClientIntakeSectionContent } from './ClientIntakeSections.web';
import { ClientIntakeDossierPreview, ClientIntakeServiceChoice } from './ClientIntakeWelcome.web';
import { clientIntakeExperienceCss } from './clientIntakeExperienceCss.web';
import type { ClientIntakeWizardFormProps as SharedProps } from './clientintakewizardform.tsx';

export { ClientIntakeSectionContent } from './ClientIntakeSections.web';
export type ClientIntakeWizardFormProps = SharedProps & {
  onCloseRequestChange?: (handler: (() => void) | null) => void;
};
type Wizard = ReturnType<typeof useClientIntakeWizard>;

export function ClientIntakeWizardForm(props: ClientIntakeWizardFormProps) {
  const { can } = usePermissions();
  const allowed = can(props.mode === 'edit' ? 'office.clients.edit' : 'office.clients.create');
  if (!allowed) return <div className="ci-state" role="alert"><style>{clientIntakeExperienceCss}</style><h2>Keine Bearbeitungsberechtigung</h2><p>Für diese Aufnahme benötigen Sie die entsprechende Berechtigung in der Klientenverwaltung.</p>{props.onCancel ? <button className="ci-button" type="button" onClick={props.onCancel}>Schließen</button> : null}</div>;
  return <IntakeSession {...props} />;
}

function IntakeSession(props: ClientIntakeWizardFormProps) {
  const wizard = useClientIntakeWizard({ mode: props.mode ?? 'create', clientId: props.clientId, completeSectionFlow: true });
  return <IntakeWorkspace key={wizard.identityKey} {...props} wizard={wizard} />;
}

function IntakeWorkspace({ wizard, clientId, onCancel, onCreated, onUpdated, onCloseRequestChange }: ClientIntakeWizardFormProps & { wizard: Wizard }) {
  const id = useId();
  const contentStyles = useAdaptiveContentStyles();
  const [visited, setVisited] = useState<Set<IntakeSectionKey>>(() => new Set([wizard.currentSection]));
  const [confirmation, setConfirmation] = useState<'close' | 'reset' | null>(null);
  const [action, setAction] = useState<'save' | 'close' | 'reset' | 'submit' | 'reload' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [editBaseline, setEditBaseline] = useState<string | null>(null);
  const main = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const activeStep = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLDivElement>(null);
  const errorSummary = useRef<HTMLDivElement>(null);
  const confirmPanel = useRef<HTMLDivElement>(null);
  const alive = useRef(true);
  const actionLock = useRef(false);
  const lastFocus = useRef<HTMLElement | null>(null);
  const busy = Boolean(action || wizard.submitting || wizard.discardingDraft);
  const snapshot = JSON.stringify(wizard.form);
  const hasContent = hasIntakeDraftContent({ form: wizard.form, stepIndex: wizard.stepIndex });
  const dirty = wizard.isEditMode ? editBaseline !== null && editBaseline !== snapshot : hasContent && !wizard.draftIsSaved;
  const serverMode = !isDemoClientBackend();
  const isReview = wizard.currentSection === 'pruefung' && wizard.steps.length > 1 && wizard.form.careContexts.length > 0;
  const progress = getIntakeWebProgress(wizard.form, wizard.steps, visited);
  const activeMeta = INTAKE_WEB_SECTIONS[wizard.currentSection];
  const errors = [...new Set(Object.values(wizard.errors).filter((value): value is string => Boolean(value)))];
  const lastVisitedIndex = Math.max(wizard.stepIndex, ...wizard.steps.map((section, index) => visited.has(section) ? index : 0));

  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    if (wizard.isEditMode && !wizard.loading && !wizard.loadError && editBaseline === null) setEditBaseline(snapshot);
  }, [wizard.isEditMode, wizard.loading, wizard.loadError, editBaseline, snapshot]);
  useEffect(() => {
    setVisited(previous => new Set([...previous, wizard.currentSection]));
    body.current?.scrollTo?.({ top: 0, behavior: 'instant' });
    main.current?.scrollTo?.({ top: 0, behavior: 'instant' });
    activeStep.current?.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
    heading.current?.focus({ preventScroll: true });
  }, [wizard.currentSection]);
  useEffect(() => { if (showErrors && errors.length) errorSummary.current?.focus(); }, [showErrors, errors.length]);
  useEffect(() => { if (confirmation) confirmPanel.current?.focus(); }, [confirmation]);
  useEffect(() => {
    if (!dirty) return;
    const preventLoss = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', preventLoss);
    return () => window.removeEventListener('beforeunload', preventLoss);
  }, [dirty]);

  const requestClose = useCallback(() => {
    if (actionLock.current || wizard.submitting || wizard.discardingDraft) return;
    if (!onCancel) return;
    if (!dirty) { onCancel(); return; }
    lastFocus.current = document.activeElement as HTMLElement;
    setActionError(null); setConfirmation('close');
  }, [dirty, onCancel, wizard.submitting, wizard.discardingDraft]);
  useEffect(() => { onCloseRequestChange?.(requestClose); return () => onCloseRequestChange?.(null); }, [onCloseRequestChange, requestClose]);

  function dismissConfirmation() {
    setConfirmation(null);
    lastFocus.current?.focus();
  }
  async function save(closeAfter = false) {
    if (actionLock.current || wizard.isEditMode) return;
    actionLock.current = true; setAction(closeAfter ? 'close' : 'save'); setActionError(null);
    try {
      const saved = await wizard.saveDraft();
      if (!alive.current) return;
      if (saved && closeAfter) onCancel?.();
      else if (!saved) setActionError('Die Sicherung ist nicht vollständig bestätigt. Bitte prüfen Sie den Hinweis und lassen Sie die Aufnahme geöffnet.');
    } catch {
      if (alive.current) setActionError('Der Entwurf konnte nicht bestätigt werden. Ihre Eingaben bleiben geöffnet. Bitte erneut speichern.');
    } finally { actionLock.current = false; if (alive.current) setAction(null); }
  }
  async function reset() {
    if (actionLock.current || wizard.isEditMode) return;
    actionLock.current = true; setAction('reset'); setActionError(null);
    try {
      const discarded = await wizard.discardDraft();
      if (!alive.current) return;
      if (!discarded) { setActionError('Der lokale Entwurf konnte nicht entfernt werden. Ihre Angaben bleiben geöffnet.'); return; }
      setConfirmation(null); setVisited(new Set(['leistungsart'])); setShowErrors(false);
      heading.current?.focus();
    } catch { if (alive.current) setActionError('Der Entwurf konnte nicht zurückgesetzt werden. Bitte erneut versuchen.'); }
    finally { actionLock.current = false; if (alive.current) setAction(null); }
  }
  function next() {
    if (busy) return;
    setActionError(null);
    const valid = wizard.nextStep();
    setShowErrors(!valid);
    if (!valid) requestAnimationFrame(() => errorSummary.current?.focus());
  }
  function navigate(section: IntakeSectionKey) {
    const index = wizard.steps.indexOf(section);
    if (busy || index < 0 || index === wizard.stepIndex || index > lastVisitedIndex + 1) return;
    if (index > wizard.stepIndex && !wizard.nextStep()) { setShowErrors(true); requestAnimationFrame(() => errorSummary.current?.focus()); return; }
    setShowErrors(false); setActionError(null); wizard.goToStep(index);
  }
  async function submit() {
    if (actionLock.current || busy || !isReview || wizard.draftConflict) return;
    actionLock.current = true; setAction('submit'); setActionError(null); setShowErrors(true);
    try {
      const result = await wizard.submit();
      if (!alive.current) return;
      if (result) { if (wizard.isEditMode) onUpdated?.(result); else onCreated?.(result); }
      else requestAnimationFrame(() => errorSummary.current?.focus());
    } catch { if (alive.current) setActionError('Die Speicherung konnte nicht bestätigt werden. Bitte prüfen Sie die Angaben und versuchen Sie es erneut.'); }
    finally { actionLock.current = false; if (alive.current) setAction(null); }
  }

  if (wizard.loading) return <div className="ci-state" role="status"><style>{clientIntakeExperienceCss}</style><span className="ci-spinner" /><h2>{wizard.isEditMode ? 'Akte wird geladen' : 'Aufnahme wird vorbereitet'}</h2><p>Gespeicherte Angaben werden geprüft.</p></div>;
  if (wizard.notFound || wizard.loadError) return <div className="ci-state" role="alert"><style>{clientIntakeExperienceCss}</style><h2>Aufnahme nicht verfügbar</h2><p>{wizard.loadError || 'Die angeforderte Klientenakte wurde nicht gefunden.'}</p><div className="ci-state-actions"><button type="button" className="ci-button primary" onClick={wizard.retryLoad}>Erneut laden</button>{clientId ? <a className="ci-button" href={clientRecordRoute(clientId)}>Klientenakte öffnen</a> : null}{onCancel ? <button type="button" className="ci-button" onClick={onCancel}>Schließen</button> : null}</div></div>;
  if (wizard.isSuccess && wizard.createdId) return <div className="ci-state" role="status"><style>{clientIntakeExperienceCss}</style><span className="ci-success-mark" aria-hidden="true">✓</span><h2>{wizard.isEditMode ? 'Änderungen gespeichert' : 'Aufnahme bestätigt'}</h2><p>{[wizard.form.firstName, wizard.form.lastName].filter(Boolean).join(' ')}</p>{onCancel ? <button type="button" className="ci-button" onClick={onCancel}>Schließen</button> : null}</div>;

  return <div className="ci-experience" aria-busy={busy}>
    <style>{clientIntakeExperienceCss}</style>
    <div className="ci-body" ref={body}>
      <aside className="ci-sidebar" aria-label="Aufnahmeübersicht">
        <ClientIntakeDossierPreview form={wizard.form} isEditMode={wizard.isEditMode} />
        <div className="ci-progress"><div><strong>{wizard.form.careContexts.length ? 'Ihre Aufnahme' : 'Der erste Schritt'}</strong><span>{progress.percentage} %</span></div><div className="ci-progress-track" role="progressbar" aria-label="Bearbeitungsfortschritt" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percentage} aria-valuetext={`${progress.completed.length} Abschnitte geprüft; Aufnahme noch nicht abgeschlossen`}><span style={{ width: `${progress.percentage}%` }} /></div><p>{wizard.form.careContexts.length ? `${progress.completed.length} von ${wizard.steps.length - 1} Abschnitten geprüft` : 'Wählen Sie die gewünschte Unterstützung.'}</p></div>
        <nav className="ci-navigation" aria-label="Abschnitte der Aufnahme"><ol>{wizard.steps.map((section, index) => {
          const active = section === wizard.currentSection;
          const complete = progress.completed.includes(section);
          return <li key={section}><button ref={active ? activeStep : undefined} type="button" aria-current={active ? 'step' : undefined} disabled={busy || index > lastVisitedIndex + 1} onClick={() => navigate(section)}><span className={`ci-step-number${complete ? ' complete' : ''}`} aria-hidden="true">{complete && !active ? '✓' : String(index + 1).padStart(2, '0')}</span><span>{INTAKE_WEB_SECTIONS[section].label}<small>{active ? 'Aktueller Abschnitt' : complete ? 'Angaben geprüft' : index > lastVisitedIndex + 1 ? 'Im weiteren Verlauf' : 'Noch zu prüfen'}</small></span>{active ? <span className="ci-step-current" aria-hidden="true">›</span> : null}</button></li>;
        })}</ol></nav>
        {wizard.steps.length === 1 ? <p className="ci-sidebar-hint">Danach folgen persönliche Angaben, Versorgung und die passenden Unterlagen.</p> : null}
      </aside>
      <div className="ci-main" ref={main}>
        <div className="ci-main-inner">
          <div className="ci-section-heading" ref={heading} tabIndex={-1}><span>Abschnitt {String(wizard.stepIndex + 1).padStart(2, '0')}</span><strong>{activeMeta.phase}</strong><span className="ci-save-state" data-state={wizard.draftSaveFeedback?.variant === 'warning' ? 'warning' : wizard.draftIsSaved ? 'saved' : 'pending'} role="status">{wizard.isEditMode ? dirty ? 'Änderungen noch nicht gespeichert' : 'Bestehende Klientenakte' : wizard.draftSaving ? 'Entwurf wird gesichert…' : wizard.draftSaveFeedback?.variant === 'warning' ? 'Sicherung prüfen' : wizard.draftIsSaved ? serverMode ? 'Im Unternehmen gesichert' : 'Auf diesem Gerät gesichert' : 'Noch nicht gesichert'}</span></div>
          {!wizard.isEditMode && serverMode ? <div className="ci-notice compact"><strong>In Ruhe vorbereiten, gemeinsam abschließen</strong><p>Der vollständige Entwurf mit den erfassten Unterschriften wird im Unternehmen gesichert. Erst „Klient:in aufnehmen“ prüft die Unterlagen verbindlich und schließt die Aufnahme ab.</p></div> : null}
          {wizard.draftRestored ? <div className="ci-restored" role="status">Ihr gespeicherter Entwurf wurde geladen. Sie können hier weiterarbeiten.</div> : null}
          {wizard.draftSaveFeedback?.variant === 'warning' ? <div className="ci-notice warning" role="alert"><strong>Entwurfssicherung prüfen</strong><p>{getIntakeWebFeedback(wizard.draftSaveFeedback.message)}</p></div> : null}
          {wizard.draftConflict ? <div className="ci-notice warning" role="alert"><strong>Aktuelle Server- und Aktenangaben prüfen</strong><p>Ihre Änderungen auf diesem Gerät bleiben zunächst erhalten. Die Übernahme lädt den aktuellen Serverentwurf und gleicht seine Grunddaten mit der Klientenakte ab. Die hier noch ungesicherten Änderungen werden dabei verworfen. Vorhandene Unterschriften bleiben erhalten; Unterlagen mit geänderten Angaben müssen erneut geprüft werden.</p><button className="ci-button" type="button" disabled={busy || wizard.draftSaving} onClick={async () => { if (actionLock.current) return; actionLock.current = true; setAction('reload'); setActionError(null); try { await wizard.reloadServerDraft(); } finally { actionLock.current = false; if (alive.current) setAction(null); } }}>Server- und Aktenangaben übernehmen</button>{wizard.draftClientId || clientId ? <a className="ci-button" href={clientRecordRoute(wizard.draftClientId || clientId!)}>Klientenakte öffnen</a> : null}</div> : null}
          {showErrors && errors.length ? <div className="ci-notice error" ref={errorSummary} tabIndex={-1} role="alert"><strong>Bitte ergänzen oder korrigieren</strong><ul>{errors.map(error => <li key={error}>{error}</li>)}</ul></div> : null}
          {actionError || wizard.submitError ? <div className="ci-notice error" role="alert">{getIntakeWebFeedback(actionError || wizard.submitError || '')}</div> : null}
          <fieldset className="ci-fields" disabled={busy} inert={busy} aria-label={activeMeta.label}>
            {wizard.currentSection === 'leistungsart' ? <ClientIntakeServiceChoice wizard={wizard} /> : <ClientIntakeSectionContent section={wizard.currentSection} wizard={wizard} contentStyles={contentStyles} clientId={clientId} onNavigateSection={navigate} />}
          </fieldset>
          <div className="ci-section-note"><span aria-hidden="true">✦</span><p>{wizard.currentSection === 'leistungsart' ? 'Mehrere Unterstützungsarten sind möglich. Die weiteren Abschnitte richten sich nach Ihrer Auswahl.' : 'Mit * markierte Angaben werden für diesen Abschnitt benötigt. Sie können bereits besuchte Abschnitte links erneut öffnen.'}</p></div>
        </div>
      </div>
    </div>
    <div className="ci-action-area">
    {confirmation ? <div className="ci-confirmation" role="alertdialog" aria-modal="false" aria-labelledby={`${id}-confirm-title`} aria-describedby={`${id}-confirm-copy`} ref={confirmPanel} tabIndex={-1}><div><strong id={`${id}-confirm-title`}>{confirmation === 'reset' ? 'Eine neue Aufnahme beginnen?' : 'Aufnahme schließen?'}</strong><p id={`${id}-confirm-copy`}>{confirmation === 'reset' ? 'Die Eingaben und der lokale Entwurf werden zurückgesetzt. Ein bereits auf dem Server angelegter Entwurf wird dadurch nicht gelöscht.' : wizard.isEditMode ? 'Ihre Änderungen wurden noch nicht gespeichert. Möchten Sie sie verwerfen?' : 'Die aktuelle Sicherung ist noch nicht bestätigt. Sichern Sie den Entwurf zuerst. Beim Schließen ohne erneute Sicherung können ungesicherte Änderungen verloren gehen.'}</p></div><div className="ci-confirm-actions">{confirmation === 'close' && !wizard.isEditMode ? <button type="button" className="ci-button danger" disabled={busy} onClick={onCancel}>Ohne erneute Sicherung schließen</button> : null}<button type="button" className="ci-button" disabled={busy} onClick={dismissConfirmation}>Weiter bearbeiten</button><button type="button" className={`ci-button ${confirmation === 'reset' || wizard.isEditMode ? 'danger' : 'primary'}`} disabled={busy} onClick={() => { if (confirmation === 'reset') void reset(); else if (wizard.isEditMode) onCancel?.(); else void save(true); }}>{busy ? 'Bitte warten…' : confirmation === 'reset' ? 'Neu beginnen bestätigen' : wizard.isEditMode ? 'Änderungen verwerfen' : 'Speichern und schließen'}</button></div></div> : null}
    <footer className="ci-footer"><div className="ci-footer-draft">{!wizard.isEditMode ? <><button type="button" className="ci-button subtle" disabled={busy || wizard.draftSaving || !hasContent} onClick={() => void save()}> {action === 'save' ? 'Wird gesichert…' : 'Entwurf sichern'}</button><button type="button" className="ci-button text" disabled={busy || !hasContent} onClick={() => { lastFocus.current = document.activeElement as HTMLElement; setConfirmation('reset'); }}>Neu beginnen</button></> : null}</div><div className="ci-footer-navigation">{onCancel ? <button type="button" className="ci-button text" disabled={busy} onClick={requestClose}>{wizard.isEditMode ? 'Schließen' : 'Später fortsetzen'}</button> : null}{!wizard.isFirstStep ? <button type="button" className="ci-button" disabled={busy} onClick={() => { setShowErrors(false); wizard.prevStep(); }}>← Zurück</button> : null}{isReview ? <button type="button" className="ci-button primary" disabled={busy || wizard.draftConflict} onClick={() => void submit()}>{busy ? 'Wird gespeichert…' : wizard.isEditMode ? 'Änderungen speichern' : 'Klient:in aufnehmen'}</button> : <button type="button" className="ci-button primary" disabled={busy} onClick={next}>{wizard.currentSection === 'leistungsart' ? 'Auswahl übernehmen' : 'Weiter'} <span aria-hidden="true">→</span></button>}</div></footer>
    </div>
  </div>;
}
