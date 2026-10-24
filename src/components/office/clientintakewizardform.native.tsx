// Generated native presentation from src/components/office/clientintakewizardform.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {useNativeWorkflowWindow} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {nativeWindow as window,nativeDocument as document} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {NativeDiv,NativeStyle,NativeH2,NativeP,NativeButton,NativeSpan,NativeA,NativeAside,NativeStrong,NativeNav,NativeOl,NativeLi,NativeSmall,NativeUl,NativeFieldset,NativeFooter,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import { ClientFirstContact } from "./ClientFirstContact.native.tsx";
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useClientIntakeWizard } from "../../hooks/useClientIntakeWizard.ts";
import { usePermissions } from '@/hooks/usePermissions';
import { useAdaptiveContentStyles } from '@/design/tokens/carelightadaptive';
import { isDemoClientBackend } from '@/lib/clients/clientBackend';
import { clientRecordRoute } from '@/lib/navigation/clientRoutes';
import { hasIntakeDraftContent } from '@/lib/clients/clientIntakeDraftStorage';
import { INTAKE_WEB_SECTIONS, getIntakeWebFeedback, getIntakeWebProgress } from "../../lib/clients/clientIntakeExperience.native.ts";
import type { IntakeSectionKey } from '@/lib/clients/clientIntakeFieldRules';
import { ClientIntakeSectionContent } from "./ClientIntakeSections.native.tsx";
import { ClientIntakeDossierPreview, ClientIntakeServiceChoice } from "./ClientIntakeWelcome.native.tsx";
import { clientIntakeExperienceCss } from "./clientIntakeExperienceCss.native.ts";
import type { ClientIntakeWizardFormProps as SharedProps } from './clientintakewizardform.tsx';
export { ClientIntakeSectionContent } from "./ClientIntakeSections.native.tsx";
export type ClientIntakeWizardFormProps = SharedProps & {
    onCloseRequestChange?: (handler: (() => void) | null) => void;
};
type Wizard = ReturnType<typeof useClientIntakeWizard>;
export function ClientIntakeWizardForm(props: ClientIntakeWizardFormProps) {
    const { can } = usePermissions();
    const allowed = can(props.mode === 'edit' ? 'office.clients.edit' : 'office.clients.create');
    if (!allowed)
        return <NativeWorkspaceStyleScope css={[clientIntakeExperienceCss, clientIntakeExperienceCss]}>{<NativeDiv className="ci-state" role="alert"><NativeStyle>{clientIntakeExperienceCss}</NativeStyle><NativeH2>Keine Bearbeitungsberechtigung</NativeH2><NativeP>Für diese Aufnahme benötigen Sie die entsprechende Berechtigung in der Klientenverwaltung.</NativeP>{props.onCancel ? <NativeButton className="ci-button" type="button" onClick={props.onCancel}>Schließen</NativeButton> : null}</NativeDiv>}</NativeWorkspaceStyleScope>;
    return <NativeWorkspaceStyleScope css={[clientIntakeExperienceCss]}>{<IntakeSession {...props}/>}</NativeWorkspaceStyleScope>;
}
function IntakeSession(props: ClientIntakeWizardFormProps) {
    const wizard = useClientIntakeWizard({ mode: props.mode ?? 'create', clientId: props.clientId, completeSectionFlow: true });
    return <NativeWorkspaceStyleScope css={[clientIntakeExperienceCss]}>{<IntakeWorkspace key={wizard.identityKey} {...props} wizard={wizard}/>}</NativeWorkspaceStyleScope>;
}
function IntakeWorkspace({ wizard, clientId, onCancel, onCreated, onUpdated, onCloseRequestChange }: ClientIntakeWizardFormProps & {
    wizard: Wizard;
}) {
    const window = useNativeWorkflowWindow();
    const id = useId();
    const { can } = usePermissions();
    const firstContact = !wizard.isEditMode && wizard.form.intakeStage === 'first_contact';
    const canDeleteDraft = can('office.clients.delete');
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
        if (wizard.isEditMode && !wizard.loading && !wizard.loadError && editBaseline === null)
            setEditBaseline(snapshot);
    }, [wizard.isEditMode, wizard.loading, wizard.loadError, editBaseline, snapshot]);
    useEffect(() => {
        setVisited(previous => new Set([...previous, wizard.currentSection]));
        body.current?.scrollTo?.({ top: 0, behavior: 'instant' });
        main.current?.scrollTo?.({ top: 0, behavior: 'instant' });
        activeStep.current?.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
        heading.current?.focus({ preventScroll: true });
    }, [wizard.currentSection]);
    useEffect(() => { if (showErrors && errors.length)
        errorSummary.current?.focus(); }, [showErrors, errors.length]);
    useEffect(() => { if (confirmation)
        confirmPanel.current?.focus(); }, [confirmation]);
    useEffect(() => {
        if (!dirty)
            return;
        const preventLoss = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
        window.addEventListener('beforeunload', preventLoss);
        return () => window.removeEventListener('beforeunload', preventLoss);
    }, [dirty]);
    const requestClose = useCallback(() => {
        if (actionLock.current || wizard.submitting || wizard.discardingDraft)
            return;
        if (!onCancel)
            return;
        if (!dirty) {
            onCancel();
            return;
        }
        lastFocus.current = document.activeElement as HTMLElement;
        setActionError(null);
        setConfirmation('close');
    }, [dirty, onCancel, wizard.submitting, wizard.discardingDraft]);
    useEffect(() => { onCloseRequestChange?.(requestClose); return () => onCloseRequestChange?.(null); }, [onCloseRequestChange, requestClose]);
    function dismissConfirmation() {
        setConfirmation(null);
        lastFocus.current?.focus();
    }
    async function save(closeAfter = false) {
        if (actionLock.current || wizard.isEditMode)
            return;
        actionLock.current = true;
        setAction(closeAfter ? 'close' : 'save');
        setActionError(null);
        try {
            const saved = firstContact ? await wizard.saveFirstContact() : await wizard.saveDraft();
            if (!saved)
                setShowErrors(true);
            if (!alive.current)
                return;
            if (saved && closeAfter)
                onCancel?.();
            else if (!saved)
                setActionError('Die Sicherung ist nicht vollständig bestätigt. Bitte prüfen Sie den Hinweis und lassen Sie die Aufnahme geöffnet.');
        }
        catch {
            if (alive.current)
                setActionError('Der Entwurf konnte nicht bestätigt werden. Ihre Eingaben bleiben geöffnet. Bitte erneut speichern.');
        }
        finally {
            actionLock.current = false;
            if (alive.current)
                setAction(null);
        }
    }
    async function reset() {
        if (actionLock.current || wizard.isEditMode)
            return;
        actionLock.current = true;
        setAction('reset');
        setActionError(null);
        try {
            const discarded = await wizard.discardDraft(true);
            if (!alive.current)
                return;
            if (!discarded) {
                setActionError('Die Löschung ist noch nicht bestätigt. Bitte den Hinweis zur Entwurfssicherung prüfen.');
                return;
            }
            setConfirmation(null);
            setVisited(new Set(['leistungsart']));
            setShowErrors(false);
            if (clientId)
                onCancel?.();
            heading.current?.focus();
        }
        catch {
            if (alive.current)
                setActionError('Der Entwurf konnte nicht zurückgesetzt werden. Bitte erneut versuchen.');
        }
        finally {
            actionLock.current = false;
            if (alive.current)
                setAction(null);
        }
    }
    async function continueIntake() {
        if (actionLock.current || busy)
            return;
        if (firstContact && wizard.form.intakeAppointmentRequested) {
            actionLock.current = true;
            setAction('save');
            setActionError(null);
            try {
                if (!await wizard.saveFirstContact()) {
                    setShowErrors(true);
                    setActionError('Bitte zuerst die Erstkontaktdaten und den Termin prüfen.');
                    return;
                }
                if (!alive.current)
                    return;
            }
            finally {
                actionLock.current = false;
                if (alive.current)
                    setAction(null);
            }
        }
        wizard.updateField('intakeStage', 'full_intake');
        wizard.goToStep(0);
    }
    function next() {
        if (busy)
            return;
        setActionError(null);
        const valid = wizard.nextStep();
        setShowErrors(!valid);
        if (!valid)
            requestAnimationFrame(() => errorSummary.current?.focus());
    }
    function navigate(section: IntakeSectionKey) {
        const index = wizard.steps.indexOf(section);
        if (busy || index < 0 || index === wizard.stepIndex || index > lastVisitedIndex + 1)
            return;
        if (index > wizard.stepIndex && !wizard.nextStep()) {
            setShowErrors(true);
            requestAnimationFrame(() => errorSummary.current?.focus());
            return;
        }
        setShowErrors(false);
        setActionError(null);
        wizard.goToStep(index);
    }
    async function submit() {
        if (actionLock.current || busy || !isReview || wizard.draftConflict)
            return;
        actionLock.current = true;
        setAction('submit');
        setActionError(null);
        setShowErrors(true);
        try {
            const result = await wizard.submit();
            if (!alive.current)
                return;
            if (result) {
                if (wizard.isEditMode)
                    onUpdated?.(result);
                else
                    onCreated?.(result);
            }
            else
                requestAnimationFrame(() => errorSummary.current?.focus());
        }
        catch {
            if (alive.current)
                setActionError('Die Speicherung konnte nicht bestätigt werden. Bitte prüfen Sie die Angaben und versuchen Sie es erneut.');
        }
        finally {
            actionLock.current = false;
            if (alive.current)
                setAction(null);
        }
    }
    if (wizard.loading)
        return <NativeWorkspaceStyleScope css={[clientIntakeExperienceCss, clientIntakeExperienceCss]}>{<NativeDiv className="ci-state" role="status"><NativeStyle>{clientIntakeExperienceCss}</NativeStyle><NativeSpan className="ci-spinner"/><NativeH2>{wizard.isEditMode ? 'Akte wird geladen' : 'Aufnahme wird vorbereitet'}</NativeH2><NativeP>Gespeicherte Angaben werden geprüft.</NativeP></NativeDiv>}</NativeWorkspaceStyleScope>;
    if (wizard.notFound || wizard.loadError)
        return <NativeWorkspaceStyleScope css={[clientIntakeExperienceCss, clientIntakeExperienceCss]}>{<NativeDiv className="ci-state" role="alert"><NativeStyle>{clientIntakeExperienceCss}</NativeStyle><NativeH2>Aufnahme nicht verfügbar</NativeH2><NativeP>{wizard.loadError || 'Die angeforderte Klientenakte wurde nicht gefunden.'}</NativeP><NativeDiv className="ci-state-actions"><NativeButton type="button" className="ci-button primary" onClick={wizard.retryLoad}>Erneut laden</NativeButton>{clientId ? <NativeA className="ci-button" href={clientRecordRoute(clientId)}>Klientenakte öffnen</NativeA> : null}{onCancel ? <NativeButton type="button" className="ci-button" onClick={onCancel}>Schließen</NativeButton> : null}</NativeDiv></NativeDiv>}</NativeWorkspaceStyleScope>;
    if (wizard.isSuccess && wizard.createdId)
        return <NativeWorkspaceStyleScope css={[clientIntakeExperienceCss, clientIntakeExperienceCss]}>{<NativeDiv className="ci-state" role="status"><NativeStyle>{clientIntakeExperienceCss}</NativeStyle><NativeSpan className="ci-success-mark" aria-hidden="true">✓</NativeSpan><NativeH2>{wizard.isEditMode ? 'Änderungen gespeichert' : 'Aufnahme bestätigt'}</NativeH2><NativeA className="ci-button primary" href={clientRecordRoute(wizard.createdId)}>Klientenakte öffnen</NativeA><NativeP>{[wizard.form.firstName, wizard.form.lastName].filter(Boolean).join(' ')}</NativeP>{onCancel ? <NativeButton type="button" className="ci-button" onClick={onCancel}>Schließen</NativeButton> : null}</NativeDiv>}</NativeWorkspaceStyleScope>;
    return <NativeWorkspaceStyleScope css={[clientIntakeExperienceCss, clientIntakeExperienceCss]}>{<NativeDiv className="ci-experience" aria-busy={busy}>
    <NativeStyle>{clientIntakeExperienceCss}</NativeStyle>
    <NativeDiv className="ci-body" ref={body}>
      <NativeAside className="ci-sidebar" aria-label="Aufnahmeübersicht">
        <ClientIntakeDossierPreview form={wizard.form} isEditMode={wizard.isEditMode}/>
        <NativeDiv className="ci-progress"><NativeDiv><NativeStrong>{wizard.form.careContexts.length ? 'Ihre Aufnahme' : 'Der erste Schritt'}</NativeStrong><NativeSpan>{progress.percentage} %</NativeSpan></NativeDiv><NativeDiv className="ci-progress-track" role="progressbar" aria-label="Bearbeitungsfortschritt" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percentage} aria-valuetext={`${progress.completed.length} Abschnitte geprüft; Aufnahme noch nicht abgeschlossen`}><NativeSpan style={{ width: `${progress.percentage}%` }}/></NativeDiv><NativeP>{wizard.form.careContexts.length ? `${progress.completed.length} von ${wizard.steps.length - 1} Abschnitten geprüft` : 'Wählen Sie die gewünschte Unterstützung.'}</NativeP></NativeDiv>
        {!firstContact ? <NativeNav className="ci-navigation" aria-label="Abschnitte der Aufnahme"><NativeOl>{wizard.steps.map((section, index) => {
                const active = section === wizard.currentSection;
                const complete = progress.completed.includes(section);
                return <NativeWorkspaceStyleScope css={[clientIntakeExperienceCss]}>{<NativeLi key={section}><NativeButton ref={active ? activeStep : undefined} type="button" aria-current={active ? 'step' : undefined} disabled={busy || index > lastVisitedIndex + 1} onClick={() => navigate(section)}><NativeSpan className={`ci-step-number${complete ? ' complete' : ''}`} aria-hidden="true">{complete && !active ? '✓' : String(index + 1).padStart(2, '0')}</NativeSpan><NativeSpan>{INTAKE_WEB_SECTIONS[section].label}<NativeSmall>{active ? 'Aktueller Abschnitt' : complete ? 'Angaben geprüft' : index > lastVisitedIndex + 1 ? 'Im weiteren Verlauf' : 'Noch zu prüfen'}</NativeSmall></NativeSpan>{active ? <NativeSpan className="ci-step-current" aria-hidden="true">›</NativeSpan> : null}</NativeButton></NativeLi>}</NativeWorkspaceStyleScope>;
            })}</NativeOl></NativeNav> : <NativeP className="ci-sidebar-hint">Erstkontakt → bei Bedarf Termin → vollständige Aufnahme in derselben Akte.</NativeP>}
        {!firstContact && wizard.steps.length === 1 ? <NativeP className="ci-sidebar-hint">Danach folgen persönliche Angaben, Versorgung und die passenden Unterlagen.</NativeP> : null}
      </NativeAside>
      <NativeDiv className="ci-main" ref={main}>
        <NativeDiv className="ci-main-inner">
          {!wizard.isEditMode ? <NativeDiv className="ci-intake-mode" aria-label="Aufnahmeablauf"><NativeButton type="button" aria-pressed={firstContact} disabled={busy} onClick={() => wizard.updateField('intakeStage', 'first_contact')}><NativeStrong>Erstkontakt / Termin</NativeStrong><NativeSpan>Nur Eckdaten erfassen</NativeSpan></NativeButton><NativeButton type="button" aria-pressed={!firstContact} disabled={busy} onClick={() => void continueIntake()}><NativeStrong>Vollständige Aufnahme</NativeStrong><NativeSpan>Angaben prüfen und Verträge abschließen</NativeSpan></NativeButton></NativeDiv> : null}
          <NativeDiv className="ci-section-heading" ref={heading} tabIndex={-1}><NativeSpan>Abschnitt {String(wizard.stepIndex + 1).padStart(2, '0')}</NativeSpan><NativeStrong>{activeMeta.phase}</NativeStrong><NativeSpan className="ci-save-state" data-state={wizard.draftSaveFeedback?.variant === 'warning' ? 'warning' : wizard.draftIsSaved ? 'saved' : 'pending'} role="status">{wizard.isEditMode ? dirty ? 'Änderungen noch nicht gespeichert' : 'Bestehende Klientenakte' : wizard.draftSaving ? 'Entwurf wird gesichert…' : wizard.draftSaveFeedback?.variant === 'warning' ? 'Sicherung prüfen' : wizard.draftIsSaved ? serverMode ? 'Im Unternehmen gesichert' : 'Auf diesem Gerät gesichert' : 'Noch nicht gesichert'}</NativeSpan></NativeDiv>
          {!wizard.isEditMode && serverMode && !firstContact ? <NativeDiv className="ci-notice compact"><NativeStrong>In Ruhe vorbereiten, gemeinsam abschließen</NativeStrong><NativeP>Der vollständige Entwurf mit den erfassten Unterschriften wird im Unternehmen gesichert. Erst „Klient:in aufnehmen“ prüft die Unterlagen verbindlich und schließt die Aufnahme ab.</NativeP></NativeDiv> : null}
          {wizard.draftRestored ? <NativeDiv className="ci-restored" role="status">Ihr gespeicherter Entwurf wurde geladen. Sie können hier weiterarbeiten.</NativeDiv> : null}
          {firstContact && wizard.draftSaveFeedback?.variant === 'success' ? <NativeDiv className="ci-notice" role="status">{wizard.draftSaveFeedback.message}</NativeDiv> : null}
          {wizard.draftSaveFeedback?.variant === 'warning' ? <NativeDiv className="ci-notice warning" role="alert"><NativeStrong>Entwurfssicherung prüfen</NativeStrong><NativeP>{getIntakeWebFeedback(wizard.draftSaveFeedback.message)}</NativeP></NativeDiv> : null}
          {wizard.draftConflict ? <NativeDiv className="ci-notice warning" role="alert"><NativeStrong>Aktuelle Server- und Aktenangaben prüfen</NativeStrong><NativeP>Ihre Änderungen auf diesem Gerät bleiben zunächst erhalten. Die Übernahme lädt den aktuellen Serverentwurf und gleicht seine Grunddaten mit der Klientenakte ab. Die hier noch ungesicherten Änderungen werden dabei verworfen. Vorhandene Unterschriften bleiben erhalten; Unterlagen mit geänderten Angaben müssen erneut geprüft werden.</NativeP><NativeButton className="ci-button" type="button" disabled={busy || wizard.draftSaving} onClick={async () => { if (actionLock.current)
        return; actionLock.current = true; setAction('reload'); setActionError(null); try {
        await wizard.reloadServerDraft();
    }
    finally {
        actionLock.current = false;
        if (alive.current)
            setAction(null);
    } }}>Server- und Aktenangaben übernehmen</NativeButton>{wizard.draftClientId || clientId ? <NativeA className="ci-button" href={clientRecordRoute(wizard.draftClientId || clientId!)}>Klientenakte öffnen</NativeA> : null}</NativeDiv> : null}
          {showErrors && errors.length ? <NativeDiv className="ci-notice error" ref={errorSummary} tabIndex={-1} role="alert"><NativeStrong>Bitte ergänzen oder korrigieren</NativeStrong><NativeUl>{errors.map(error => <NativeLi key={error}>{error}</NativeLi>)}</NativeUl></NativeDiv> : null}
          {actionError || wizard.submitError ? <NativeDiv className="ci-notice error" role="alert">{getIntakeWebFeedback(actionError || wizard.submitError || '')}</NativeDiv> : null}
          <NativeFieldset className="ci-fields" disabled={busy} inert={busy} aria-label={activeMeta.label}>
            {firstContact ? <><ClientFirstContact wizard={wizard}/><ClientIntakeServiceChoice wizard={wizard}/></> : wizard.currentSection === 'leistungsart' ? <ClientIntakeServiceChoice wizard={wizard}/> : <ClientIntakeSectionContent section={wizard.currentSection} wizard={wizard} contentStyles={contentStyles} clientId={clientId} onNavigateSection={navigate}/>}
          </NativeFieldset>
          <NativeDiv className="ci-section-note"><NativeSpan aria-hidden="true">✦</NativeSpan><NativeP>{wizard.currentSection === 'leistungsart' ? 'Mehrere Unterstützungsarten sind möglich. Die weiteren Abschnitte richten sich nach Ihrer Auswahl.' : 'Mit * markierte Angaben werden für diesen Abschnitt benötigt. Sie können bereits besuchte Abschnitte links erneut öffnen.'}</NativeP></NativeDiv>
        </NativeDiv>
      </NativeDiv>
    </NativeDiv>
    <NativeDiv className="ci-action-area">
    {confirmation ? <NativeDiv className="ci-confirmation" role="alertdialog" aria-modal="false" aria-labelledby={`${id}-confirm-title`} aria-describedby={`${id}-confirm-copy`} ref={confirmPanel} tabIndex={-1}><NativeDiv><NativeStrong id={`${id}-confirm-title`}>{confirmation === 'reset' ? 'Aufnahmeentwurf löschen?' : 'Aufnahme schließen?'}</NativeStrong><NativeP id={`${id}-confirm-copy`}>{confirmation === 'reset' ? 'Der offene Entwurf wird im Unternehmen gelöscht und von diesem Gerät entfernt. Ein zugehöriger Ersttermin wird ebenfalls aus dem Kalender entfernt. Abgeschlossene Klientenakten und ihre Originale werden nicht gelöscht.' : wizard.isEditMode ? 'Ihre Änderungen wurden noch nicht gespeichert. Möchten Sie sie verwerfen?' : 'Die aktuelle Sicherung ist noch nicht bestätigt. Sichern Sie den Entwurf zuerst. Beim Schließen ohne erneute Sicherung können ungesicherte Änderungen verloren gehen.'}</NativeP></NativeDiv><NativeDiv className="ci-confirm-actions">{confirmation === 'close' && !wizard.isEditMode ? <NativeButton type="button" className="ci-button danger" disabled={busy} onClick={onCancel}>Ohne erneute Sicherung schließen</NativeButton> : null}<NativeButton type="button" className="ci-button" disabled={busy} onClick={dismissConfirmation}>Weiter bearbeiten</NativeButton><NativeButton type="button" className={`ci-button ${confirmation === 'reset' || wizard.isEditMode ? 'danger' : 'primary'}`} disabled={busy} onClick={() => { if (confirmation === 'reset')
        void reset();
    else if (wizard.isEditMode)
        onCancel?.();
    else
        void save(true); }}>{busy ? 'Bitte warten…' : confirmation === 'reset' ? 'Entwurf löschen bestätigen' : wizard.isEditMode ? 'Änderungen verwerfen' : 'Speichern und schließen'}</NativeButton></NativeDiv></NativeDiv> : null}
    <NativeFooter className="ci-footer"><NativeDiv className="ci-footer-draft">{!wizard.isEditMode ? <><NativeButton type="button" className="ci-button subtle" disabled={busy || wizard.draftSaving || !hasContent} onClick={() => void save()}> {action === 'save' ? 'Wird gesichert…' : firstContact ? 'Erstkontakt speichern' : 'Entwurf sichern'}</NativeButton><NativeButton type="button" className="ci-button text" disabled={busy || !hasContent || !canDeleteDraft} onClick={() => { lastFocus.current = document.activeElement as HTMLElement; setConfirmation('reset'); }}>Entwurf löschen</NativeButton></> : null}</NativeDiv><NativeDiv className="ci-footer-navigation">{onCancel ? <NativeButton type="button" className="ci-button text" disabled={busy} onClick={requestClose}>{wizard.isEditMode ? 'Schließen' : 'Später fortsetzen'}</NativeButton> : null}{!firstContact && !wizard.isFirstStep ? <NativeButton type="button" className="ci-button" disabled={busy} onClick={() => { setShowErrors(false); wizard.prevStep(); }}>← Zurück</NativeButton> : null}{firstContact ? <NativeButton type="button" className="ci-button primary" disabled={busy} onClick={() => void continueIntake()}>Aufnahme vervollständigen →</NativeButton> : isReview ? <NativeButton type="button" className="ci-button primary" disabled={busy || wizard.draftConflict} onClick={() => void submit()}>{busy ? 'Wird gespeichert…' : wizard.isEditMode ? 'Änderungen speichern' : 'Klient:in aufnehmen'}</NativeButton> : <NativeButton type="button" className="ci-button primary" disabled={busy} onClick={next}>{wizard.currentSection === 'leistungsart' ? 'Auswahl übernehmen' : 'Weiter'} <NativeSpan aria-hidden="true">→</NativeSpan></NativeButton>}</NativeDiv></NativeFooter>
    </NativeDiv>
  </NativeDiv>}</NativeWorkspaceStyleScope>;
}
