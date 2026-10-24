// Generated native presentation from src/components/inputs/CareIntakeDocumentsStepPanel.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {useNativeWorkflowWindow} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {nativeWindow as window,nativeDocument as document} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {NativeDiv,NativeStrong,NativeUl,NativeLi,NativeStyle,NativeSpan,NativeH3,NativeP,NativeButton,NativeBr,NativeSection,NativeLabel,NativeInput,NativeSmall,NativeHeader,NativeH2,NativeNav,NativeOl,NativeIframe,NativeImg,NativeDetails,NativeSummary,NativeFooter,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import {confirmNativeWorkspaceAction,runNativeWorkspaceEffect} from '@/lib/platform/nativeWorkspaceActions.native';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { CareSignatureModal } from "./CareSignatureModal.native.tsx";
import { IntakePackageCorrections } from "./IntakePackageCorrections.native.tsx";
import { useTenantDisplayMeta } from '@/hooks/useTenantDisplayMeta';
import { getServiceMode } from '@/lib/services/mode';
import type { LlganViewContext } from '@/design/tokens/lightLiquidGlassAuroraNebula';
import type { ClientIntakeErrors, ClientIntakeFormData } from '@/types/forms/clientIntakeForm';
import type { IntakeSectionKey } from '@/lib/clients/clientIntakeFieldRules';
import { listApplicableIntakeTemplates, listAvailableContractTypes, resolveContractTemplateKeys } from '@/features/intakeDocuments/buildIntakeDocumentContext';
import { loadIntakeDocumentTemplates } from '@/features/intakeDocuments/intakeDocumentService';
import { changeIntakeDocumentSelection, INTAKE_SIGNATURE_ROLE_LABELS, prepareIntakeDocumentPackage, signIntakeDocumentPackage, type IntakeDocumentPackage, type PackageIssue } from '@/features/intakeDocuments/intakeDocumentPackage';
import { ASSIGNMENT_TEMPLATE_KEY, INTAKE_CONTRACT_TYPE_LABELS, OPTIONAL_CONSENT_TEMPLATE_KEYS, type IntakeContractTypeKey, type IntakeDocumentSignature, type IntakeDocumentState, type IntakeDocumentTemplate, type IntakeSignatureRole } from '@/features/intakeDocuments/intakeDocumentTypes';
import { escapeIntakeHtml } from '@/features/intakeDocuments/intakeDocumentRenderBinding';
import { INTAKE_DOCUMENT_CSS } from '@/features/intakeDocuments/renderIntakeDocumentPreview';
import { intakeDocumentPackageCss } from "./intakeDocumentPackageCss.native.ts";
import { IntakeLegalDetails2027 } from "./IntakeLegalDetails2027.native.tsx";
import { INTAKE_DOCUMENT_2027_CSS } from '@/features/intakeDocuments/intakeDocument2027Css';
import { INTAKE_2027_VERSION } from '@/features/intakeDocuments/intake2027Fields';
import { hasCollectedIntakeOriginal } from '@/features/intakeDocuments/restartIntakeDocumentReview';
type Props = {
    form: ClientIntakeFormData;
    errors: ClientIntakeErrors;
    tenantId: string | null;
    onChange: (form: ClientIntakeFormData) => void;
    panelViewContext?: LlganViewContext;
    onPersistPackage?: (form: ClientIntakeFormData) => Promise<boolean>;
    onNavigateSection?: (section: IntakeSectionKey) => void;
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
    ${documents.some(document => document.version === INTAKE_2027_VERSION) ? INTAKE_DOCUMENT_2027_CSS : ''}
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
export function CareIntakeDocumentsStepPanel({ form, errors, tenantId, onChange, onPersistPackage, onNavigateSection }: Props) {
    const window = useNativeWorkflowWindow();
    const tenant = useTenantDisplayMeta();
    const titleId = useId();
    const [templates, setTemplates] = useState<IntakeDocumentTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [reload, setReload] = useState(0);
    const [review, setReview] = useState<IntakeDocumentPackage | null>(null);
    const [phase, setPhase] = useState<'preview' | 'corrections' | 'signatures'>('preview');
    const [captures, setCaptures] = useState<Partial<Record<IntakeSignatureRole, IntakeDocumentSignature>>>({});
    const [role, setRole] = useState<IntakeSignatureRole | null>(null);
    const [acknowledged, setAcknowledged] = useState(false);
    const [issues, setIssues] = useState<PackageIssue[]>([]);
    const [busy, setBusy] = useState(false);
    const [saveState, setSaveState] = useState<'none' | 'saved' | 'failed' | 'local'>('none');
    const [pendingSave, setPendingSave] = useState<ClientIntakeFormData | null>(null);
    const current = useRef(form);
    current.current = form;
    const saving = useRef(false);
    const frame = useRef<HTMLIFrameElement>(null);
    const dialog = useRef<HTMLDivElement>(null);
    const scope = JSON.stringify([tenantId, form.intakeWorkflowVersion, form.intakeTemplateEdition, form.careContexts, form.intakeContractType, form.intakeAssignmentEnabled, form.intakeOptionalConsents]);
    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setLoadError(null);
        if (getServiceMode() !== 'supabase') {
            setTemplates(listApplicableIntakeTemplates(current.current));
            setLoading(false);
            return;
        }
        if (!tenantId) {
            setLoadError('Bitte eine aktive Unternehmenssitzung öffnen.');
            setLoading(false);
            return;
        }
        void loadIntakeDocumentTemplates(tenantId, current.current).then(result => {
            if (cancelled)
                return;
            if (result.ok)
                setTemplates(result.data);
            else
                setLoadError(result.error);
        }).catch(() => {
            if (!cancelled)
                setLoadError('Die Dokumentvorlagen konnten nicht geladen werden.');
        })
            .finally(() => {
            if (!cancelled)
                setLoading(false);
        });
        return () => { cancelled = true; };
    }, [scope, tenantId, reload]);
    const selected = listApplicableIntakeTemplates(form, templates);
    const required = selected.filter(template => template.documentType === 'privacy_consent' || template.documentType === 'client_contract');
    const completed = selected.filter(template => form.intakeDocuments.some(document => document.templateKey === template.templateKey && document.status === 'finalized')).length;
    const preview = useMemo(() => review ? buildIntakePackagePreview(review.documents) : '', [review]);
    const close = async () => {
        if (saving.current || role)
            return;
        if (Object.keys(captures).length && !pendingSave && !await confirmNativeWorkspaceAction('Die erfassten Unterschriften wurden noch nicht auf das Paket übernommen. Zeichnungen verwerfen und schließen?'))
            return;
        setReview(null);
        setCaptures({});
        setRole(null);
    };
    const closeRef = useRef(close);
    closeRef.current = close;
    const hasUnsavedCaptures = Object.keys(captures).length > 0 || (saveState === 'failed' && Boolean(pendingSave));
    useEffect(() => {
        if (!hasUnsavedCaptures && !busy)
            return;
        const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
        window.addEventListener('beforeunload', beforeUnload);
        return () => window.removeEventListener('beforeunload', beforeUnload);
    }, [hasUnsavedCaptures, busy]);
    useEffect(() => {
        if (!review || role)
            return;
        const previous = document.activeElement as HTMLElement | null;
        dialog.current?.focus();
        const handleKey = (event: KeyboardEvent) => {
            if (role)
                return;
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                closeRef.current();
            }
            if (event.key !== 'Tab')
                return;
            const focusable = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),iframe,summary,[tabindex="0"]') ?? []);
            const first = focusable[0], last = focusable.at(-1);
            if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) {
                event.preventDefault();
                last?.focus();
            }
            else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first?.focus();
            }
        };
        document.addEventListener('keydown', handleKey, true);
        return () => { document.removeEventListener('keydown', handleKey, true); previous?.focus(); };
    }, [Boolean(review), role, phase]);
    const changeSelection = (selection: Parameters<typeof changeIntakeDocumentSelection>[1]) => {
        try {
            onChange(changeIntakeDocumentSelection(form, selection));
            setIssues([]);
            setSaveState('none');
            setPendingSave(null);
        }
        catch (error) {
            setIssues([{ title: 'Auswahl', message: error instanceof Error ? error.message : 'Die Auswahl konnte nicht geändert werden.' }]);
        }
    };
    const newEdition = async (edition: '2027' | undefined) => {
        const originals = form.intakeDocuments.filter(hasCollectedIntakeOriginal);
        if (originals.length && !await confirmNativeWorkspaceAction('Eine neue Dokumentfassung beginnen? Die bisherigen unterschriebenen Originale bleiben in der Historie. Die neue Fassung muss vollständig geprüft und erneut unterschrieben werden.'))
            return;
        if ((form.intakeDocumentHistory?.length ?? 0) + originals.length > 64) {
            setIssues([{ title: 'Dokumentfassungen', message: 'Bitte die Aufnahme zuerst sichern. Die vorhandene Historie bleibt unverändert.' }]);
            return;
        }
        onChange({ ...form, intakeTemplateEdition: edition, ...(edition ? { intakeWorkflowVersion: 2 as const } : {}), intakeLegalDetails: { ...form.intakeLegalDetails }, intakeDocuments: [],
            intakeDocumentHistory: [...(form.intakeDocumentHistory ?? []), ...originals], consentDatenschutz: false, consentVertrag: false });
        setReview(null);
        setIssues([]);
        setCaptures({});
        setSaveState('none');
    };
    const open = () => {
        const prepared = prepareIntakeDocumentPackage(form, templates, tenant);
        onChange(prepared.form);
        setReview(prepared);
        setPhase('preview');
        setCaptures({});
        setAcknowledged(false);
        setIssues(prepared.issues);
    };
    const applyCorrections = (next: ClientIntakeFormData) => {
        if (current.current.intakeTemplateEdition === '2027')
            next = { ...next, intakeTemplateEdition: '2027', intakeLegalDetails: current.current.intakeLegalDetails };
        const prepared = prepareIntakeDocumentPackage(next, templates, tenant);
        onChange(prepared.form);
        setReview(prepared);
        setIssues(prepared.issues);
        setCaptures({});
        setAcknowledged(false);
        setPhase('preview');
        setSaveState('none');
    };
    const persist = async (next: ClientIntakeFormData) => {
        setPendingSave(next);
        if (!onPersistPackage) {
            onChange(next);
            setSaveState('local');
            setPendingSave(null);
            return;
        }
        const saved = await onPersistPackage(next);
        setSaveState(saved ? (getServiceMode() === 'supabase' ? 'saved' : 'local') : 'failed');
        if (!saved)
            setIssues([{ title: 'Speicherung noch offen', message: 'Das unterzeichnete Paket bleibt erhalten. Bitte erneut sichern; die Unterschriften müssen nicht wiederholt werden.' }]);
        else {
            setIssues([]);
            setPendingSave(null);
        }
    };
    const finish = async () => {
        if (!review || saving.current)
            return;
        saving.current = true;
        setBusy(true);
        try {
            if (pendingSave) {
                await persist(pendingSave);
                return;
            }
            if (!acknowledged)
                return;
            const result = signIntakeDocumentPackage(current.current, templates, review.documents, captures, tenant);
            if (!result.ok) {
                setIssues(result.issues);
                return;
            }
            onChange(result.form);
            setReview(prepareIntakeDocumentPackage(result.form, templates, tenant));
            setCaptures({});
            setPhase('preview');
            await persist(result.form);
        }
        catch {
            setSaveState('failed');
            setIssues([{ title: 'Speicherung noch offen', message: 'Die Speicherung konnte nicht bestätigt werden. Bitte erneut sichern.' }]);
        }
        finally {
            saving.current = false;
            setBusy(false);
        }
    };
    const notice = <>
    {issues.length ? <NativeDiv className="cs-contract-notice is-error" role="alert"><NativeStrong>Bitte prüfen</NativeStrong><NativeUl>{issues.map((issue, index) => <NativeLi key={`${issue.title}-${index}`}><NativeStrong>{issue.title}:</NativeStrong> {issue.message}</NativeLi>)}</NativeUl></NativeDiv> : null}
    {saveState === 'saved' ? <NativeDiv className="cs-contract-notice is-success" role="status">Das unterzeichnete Paket ist im Unternehmen gespeichert. Die Unterschriften sind fest in den Dokumenten platziert. Die Aufnahme schließen Sie anschließend unter „Prüfen & sichern“ ab.</NativeDiv> : null}
    {saveState === 'local' ? <NativeDiv className="cs-contract-notice" role="status">Die unterschriebenen Dokumentfassungen sind vorbereitet. Bitte den Aufnahme- oder Änderungsvorgang abschließen, um sie in der Akte zu speichern.</NativeDiv> : null}
  </>;
    const paperOnly = Boolean(review?.issues.length) && review!.issues.every(issue => issue.kind === 'paper_required');
    const printPackage = () => { frame.current?.contentWindow?.focus(); frame.current?.contentWindow?.print(); };
    const allCaptured = Boolean(review?.roles.length) && review!.roles.every(requiredRole => captures[requiredRole]?.dataUrl);
    return <NativeWorkspaceStyleScope css={[intakeDocumentPackageCss, intakeDocumentPackageCss, intakeDocumentPackageCss]}>{<NativeDiv className="cs-contract-package">
    <NativeStyle>{intakeDocumentPackageCss}</NativeStyle>
    <NativeDiv className="cs-contract-edition"><NativeDiv><NativeSpan className="cs-legal-eyebrow">Verträge & Einwilligungen</NativeSpan><NativeH3>{form.intakeTemplateEdition === '2027' ? 'Ausgabe 2027 · vorbereitet' : 'Bisherige Dokumentfassung'}</NativeH3><NativeP>{form.intakeTemplateEdition === '2027' ? 'Überarbeitete Vorlagen mit individuellen Leistungen, Kosten und freiwilligen Entscheidungen. Bearbeitungsstand: 21.10.2026.' : 'Die bisherigen Originale bleiben erhalten. Für die überarbeiteten Texte und das neue Layout kann eine neue Fassung vorbereitet werden.'}</NativeP></NativeDiv><NativeButton className="cs-contract-button" type="button" disabled={busy || Boolean(pendingSave)} onClick={async () => await newEdition('2027')}>{form.intakeTemplateEdition === '2027' ? 'Neue Fassung beginnen' : 'Ausgabe 2027 vorbereiten'}</NativeButton></NativeDiv>
    {form.intakeWorkflowVersion === 2 ? <NativeDiv className="cs-contract-card"><NativeStrong>Verträge passend zur Auswahl</NativeStrong><NativeP>Alle ausgewählten Leistungsbereiche sind berücksichtigt. Alltagsbegleitung, Betreuung und Begleitung nutzen gemeinsam den Assist-Vertrag.</NativeP><NativeUl>{resolveContractTemplateKeys(form).map(key => <NativeLi key={key}>{selected.find(template => template.templateKey === key)?.title ?? 'Aufnahmevertrag'}</NativeLi>)}</NativeUl>{form.careContexts.includes('academy_prepared') ? <NativeP>Akademie / Schulung bleibt vorgemerkt; es wird kein Schulungsvertrag erstellt.</NativeP> : null}</NativeDiv> : <NativeDiv className="cs-contract-card cs-contract-type"><NativeStrong>Vertragsart</NativeStrong>{listAvailableContractTypes(form.careContexts).map(key => <NativeButton type="button" className="cs-contract-button" key={key} aria-pressed={(form.intakeContractType || listAvailableContractTypes(form.careContexts)[0]) === key} disabled={busy || Boolean(pendingSave)} onClick={() => changeSelection({ intakeContractType: key as IntakeContractTypeKey })}>{INTAKE_CONTRACT_TYPE_LABELS[key]}</NativeButton>)}</NativeDiv>}
    <NativeDiv className="cs-contract-summary"><NativeDiv><NativeH3>{selected.length} Dokumente · ein Paket</NativeH3><NativeP>Alle ausgewählten Unterlagen gemeinsam lesen. Anschließend unterschreiben Klient:in und Mitarbeitende:r jeweils einmal für ihre vorgesehenen Felder.</NativeP></NativeDiv>
      <NativeButton type="button" className="cs-contract-button is-primary" onClick={open} disabled={loading || Boolean(loadError) || busy}>Gesamte Vorschau öffnen <NativeSpan aria-hidden="true">↗</NativeSpan></NativeButton></NativeDiv>
    {loading ? <NativeP className="cs-contract-notice" role="status">Dokumentvorlagen werden geladen …</NativeP> : null}
    {loadError ? <NativeDiv className="cs-contract-notice is-error" role="alert">{loadError}<NativeBr /><NativeButton type="button" className="cs-contract-button" onClick={() => setReload(value => value + 1)}>Erneut laden</NativeButton></NativeDiv> : null}
    <NativeDiv className="cs-contract-columns">
      <NativeSection className="cs-contract-card"><NativeH3>Erforderliche Unterlagen</NativeH3><NativeP>Diese Unterlagen gehören zur Aufnahme.</NativeP><NativeDiv className="cs-contract-list">{required.map(template => <NativeLabel key={template.templateKey} className="cs-contract-choice is-selected"><NativeInput type="checkbox" checked disabled/><NativeSpan><NativeStrong>{template.title}</NativeStrong><NativeSmall>{form.intakeDocuments.some(document => document.templateKey === template.templateKey && document.status === 'finalized') ? 'Unterzeichnet · Fassung gesperrt' : 'Im Paket enthalten'}</NativeSmall></NativeSpan></NativeLabel>)}</NativeDiv>
        <NativeP>{completed ? `${completed} von ${selected.length} Dokumenten unterzeichnet.` : 'Die Unterschriften erfassen Sie nach der gemeinsamen Vorschau.'}</NativeP></NativeSection>
      <NativeSection className="cs-contract-card"><NativeH3>Weitere Vereinbarungen</NativeH3><NativeP>Nur die tatsächlich vereinbarten Unterlagen auswählen.</NativeP><NativeDiv className="cs-contract-tools">{form.intakeTemplateEdition !== '2027' ? <NativeButton type="button" disabled={busy || Boolean(pendingSave)} onClick={() => changeSelection({ intakeAssignmentEnabled: true, intakeOptionalConsents: [...OPTIONAL_CONSENT_TEMPLATE_KEYS] })}>Alle hinzufügen</NativeButton> : null}<NativeButton type="button" disabled={busy || Boolean(pendingSave)} onClick={() => changeSelection({ intakeAssignmentEnabled: false, intakeOptionalConsents: [] })}>Zusatz-Auswahl aufheben</NativeButton></NativeDiv>
        <NativeDiv className="cs-contract-list">{OPTIONAL.map(option => {
            const isAssignment = option.key === ASSIGNMENT_TEMPLATE_KEY;
            const checked = isAssignment ? form.intakeAssignmentEnabled : form.intakeOptionalConsents.includes(option.key);
            return <NativeWorkspaceStyleScope css={[intakeDocumentPackageCss]}>{<NativeLabel key={option.key} className={`cs-contract-choice${checked ? ' is-selected' : ''}`}><NativeInput type="checkbox" checked={checked} disabled={busy || Boolean(pendingSave)} onChange={() => changeSelection(isAssignment ? { intakeAssignmentEnabled: !checked } : { intakeOptionalConsents: checked ? form.intakeOptionalConsents.filter(key => key !== option.key) : [...form.intakeOptionalConsents, option.key] })}/><NativeSpan><NativeStrong>{option.title}</NativeStrong></NativeSpan></NativeLabel>}</NativeWorkspaceStyleScope>;
        })}</NativeDiv></NativeSection>
    </NativeDiv>
    {form.intakeTemplateEdition === '2027' ? <IntakeLegalDetails2027 form={form} templates={selected} onChange={onChange} disabled={busy || Boolean(pendingSave) || loading}/> : null}
    {!review ? notice : null}
    {!review && pendingSave && saveState === 'failed' ? <NativeButton type="button" className="cs-contract-button is-primary" onClick={() => { const prepared = prepareIntakeDocumentPackage(pendingSave, templates, tenant); setReview(prepared); }}>Unterzeichnetes Paket erneut sichern</NativeButton> : null}
    {Object.entries(errors).filter(([key, value]) => key.startsWith('intake') && value).length && !review ? <NativeDiv className="cs-contract-notice is-error">Bitte die gemeinsame Vorschau öffnen und die dort angezeigten Angaben und Unterschriften vervollständigen.</NativeDiv> : null}
    {/* The native-web signature modal has its own portal. Remove this higher layer
                while capturing so neither its backdrop nor its focus trap hides the canvas. */}
    {review && !role && typeof document !== 'undefined' ? <NativeDiv className="cs-contract-backdrop"><NativeStyle>{intakeDocumentPackageCss}</NativeStyle><NativeDiv ref={dialog} tabIndex={-1} className="cs-contract-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <NativeHeader className="cs-contract-dialog-header"><NativeDiv><NativeH2 id={titleId}>{phase === 'signatures' ? 'Dokumentenpaket gemeinsam unterschreiben' : phase === 'corrections' ? 'Angaben für das Dokumentenpaket ergänzen' : 'Ihr vollständiges Dokumentenpaket'}</NativeH2><NativeP>{review.documents.length} Unterlagen für {[form.firstName, form.lastName].filter(Boolean).join(' ')} · {phase === 'signatures' ? '2. Unterschriften erfassen' : '1. Gemeinsam prüfen'}</NativeP></NativeDiv><NativeButton type="button" className="cs-contract-close" aria-label="Paketvorschau schließen" onClick={close} disabled={busy}>×</NativeButton></NativeHeader>
      <NativeDiv className="cs-contract-dialog-body">
        {phase === 'preview' ? <>{issues.length || saveState !== 'none' ? <NativeDiv style={{ marginBottom: 16 }}>{notice}</NativeDiv> : null}<NativeDiv className="cs-contract-review"><NativeNav className="cs-contract-index" aria-label="Unterlagen im Paket"><NativeH3>Im Paket enthalten</NativeH3><NativeOl>{review.documents.map((document, index) => <NativeLi key={document.templateKey}><NativeButton type="button" onClick={() => frame.current?.contentDocument?.getElementById(`package-document-${index}`)?.scrollIntoView({ block: 'start' })}><NativeSpan>{String(index + 1).padStart(2, '0')}</NativeSpan><NativeSpan>{document.title}</NativeSpan></NativeButton></NativeLi>)}</NativeOl></NativeNav><NativeIframe ref={frame} className="cs-contract-preview" title="Gesamte Vertragsvorschau" srcDoc={preview} sandbox="allow-same-origin allow-modals"/></NativeDiv></> :
                phase === 'corrections' ? <>{form.intakeTemplateEdition === '2027' ? <IntakeLegalDetails2027 form={form} templates={selected} onChange={onChange}/> : null}<IntakePackageCorrections formId={`${titleId}-corrections`} form={form} issues={review.issues} tenantId={tenantId} onApply={applyCorrections} onNavigate={onNavigateSection ? section => { setReview(null); onNavigateSection(section); } : undefined}/></> :
                    <NativeDiv className="cs-contract-signing"><NativeP>Die Unterschriften gelten für das soeben geprüfte Paket. Sie werden automatisch in die passenden Felder der jeweiligen Dokumente eingesetzt.</NativeP>{notice}
          <NativeDiv className="cs-contract-signatures">{review.roles.map(requiredRole => <NativeSection key={requiredRole} className={`cs-contract-signature${captures[requiredRole] ? ' is-captured' : ''}`}><NativeH3>{INTAKE_SIGNATURE_ROLE_LABELS[requiredRole]}</NativeH3><NativeP>{captures[requiredRole] ? 'Unterschrift erfasst' : 'Unterschrift erforderlich'}</NativeP><NativeDiv className="cs-contract-signature-image">{captures[requiredRole] ? <NativeImg src={captures[requiredRole]!.dataUrl} alt={`Erfasste Unterschrift ${INTAKE_SIGNATURE_ROLE_LABELS[requiredRole]}`}/> : <NativeSpan>Noch nicht unterschrieben</NativeSpan>}</NativeDiv><NativeButton type="button" className="cs-contract-button" onClick={() => setRole(requiredRole)} disabled={busy}>{captures[requiredRole] ? 'Neu zeichnen' : 'Jetzt unterschreiben'}</NativeButton></NativeSection>)}</NativeDiv>
          <NativeLabel className="cs-contract-acknowledgement"><NativeInput type="checkbox" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} disabled={busy}/><NativeSpan>Die ausgewählten Unterlagen wurden gemeinsam geprüft. Die erfassten Unterschriften sollen in die vorgesehenen Felder übernommen und mit diesen Dokumentfassungen gespeichert werden.</NativeSpan></NativeLabel>
          <NativeDetails className="cs-contract-included"><NativeSummary>Diese {review.documents.length} Dokumente werden unterschrieben</NativeSummary><NativeUl>{review.documents.map(document => <NativeLi key={document.templateKey}>{document.title}{document.status === 'finalized' ? ' · bereits unterzeichnet' : ''}</NativeLi>)}</NativeUl></NativeDetails>
        </NativeDiv>}
      </NativeDiv>
      {/* Remount phase actions: the opening click must not activate the next phase's submit button. */}
      <NativeFooter className="cs-contract-dialog-footer"><NativeP>{busy ? 'Unterzeichnetes Paket wird gesichert …' : phase === 'corrections' || (phase === 'preview' && review.issues.length) ? 'Vor dem Unterschreiben müssen die angezeigten Angaben ergänzt werden.' : phase === 'preview' ? 'Alle Unterlagen sind in einer gemeinsamen Vorschau enthalten.' : 'Nach der Übernahme bleiben die unterschriebenen Fassungen gesperrt.'}</NativeP><NativeDiv key={phase}>
        {phase === 'preview' && !paperOnly ? <NativeButton type="button" className="cs-contract-button" onClick={printPackage}>Paket drucken</NativeButton> : null}
        {phase !== 'preview' ? <NativeButton type="button" className="cs-contract-button" onClick={() => setPhase('preview')} disabled={busy}>{phase === 'corrections' ? 'Abbrechen' : 'Zur Vorschau'}</NativeButton> : null}
        {pendingSave && saveState === 'failed' ? <NativeButton type="button" className="cs-contract-button is-primary" onClick={() => void finish()} disabled={busy}>Erneut sichern</NativeButton> : phase === 'corrections' ? <NativeButton type="submit" form={`${titleId}-corrections`} className="cs-contract-button is-primary" disabled={loading || Boolean(loadError)}>Angaben übernehmen & Vorschau aktualisieren</NativeButton> : phase === 'preview' && paperOnly ? <NativeButton type="button" className="cs-contract-button is-primary" onClick={printPackage}>Papierfassung drucken</NativeButton> : phase === 'preview' && review.issues.length ? <NativeButton type="button" className="cs-contract-button is-primary" onClick={() => setPhase('corrections')} disabled={loading || Boolean(loadError)}>Angaben ergänzen</NativeButton> : phase === 'preview' && review.roles.length ? <NativeButton type="button" className="cs-contract-button is-primary" onClick={() => setPhase('signatures')} disabled={loading || Boolean(loadError)}>Gemeinsam unterschreiben</NativeButton> : phase === 'signatures' ? <NativeButton type="button" className="cs-contract-button is-primary" disabled={!allCaptured || !acknowledged || busy} onClick={() => void finish()}>Unterzeichnetes Paket sichern</NativeButton> : <NativeButton type="button" className="cs-contract-button is-primary" onClick={close} disabled={busy}>Fertig</NativeButton>}
      </NativeDiv></NativeFooter>
    </NativeDiv></NativeDiv> : null}
    {role ? <CareSignatureModal visible key={role} label={`${INTAKE_SIGNATURE_ROLE_LABELS[role]} · ${review?.documents.length ?? 0} Dokumente`} onConfirm={dataUrl => { setCaptures(previous => ({ ...previous, [role]: { role, dataUrl, signedAt: new Date().toISOString(), ...(form.intakeTemplateEdition === '2027' ? { signerName: form.intakeLegalDetails?.[role === 'employee' ? 'employee.name' : 'signer.name']?.trim() } : {}) } })); setRole(null); }} onClose={() => setRole(null)}/> : null}
  </NativeDiv>}</NativeWorkspaceStyleScope>;
}
export { validateIntakeDocumentsStep } from '@/features/intakeDocuments/validateIntakeDocuments';
