// Generated native presentation from src/features/beratung/ConsultationEditor.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {useNativeWorkflowWindow} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {nativeCrypto as crypto,nativeWindow as window,nativeStructuredClone as structuredClone} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {NativeDiv,NativeButton,NativeSpan,NativeStrong,NativeP,NativeAside,NativeH2,NativeDetails,NativeSummary,NativeDl,NativeDt,NativeDd,NativeA,NativeNav,NativeProgress,NativeSection,NativeH3,NativeSmall,NativeFieldset,NativeLegend,NativeLabel,NativeInput,NativeOption,NativeOl,NativeLi,NativeTime,NativePre,NativeForm} from '@/components/layout/NativeWorkspaceElements.native';
import { printConsultationRevision } from '@/lib/beratung/printConsultation.native';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { EVENT_LABELS, consultationIssues, emptyConsultationAnswers, isEncounterEditable, normalizeConsultationAnswers, SECTION_LABELS, TOPICS, LEARNING_LABELS, type ConsultationAnswers, type ConsultationEncounter, type ConsultationMutation, type ConsultationMutationResult, type ConsultationSection, type ConsultationWorkspace } from '../../lib/beratung/workspaceModel';
import { readConsultationDraft, keepConsultationDraft, clearConsultationDraft } from '../../lib/beratung/workspaceDrafts';
import { Dialog, SelectField, SignatureDialog, TextField } from "./ConsultationControls.native.tsx";
import { ConsultationFollowUps } from "./ConsultationFollowUps.native.tsx";
import { ConsultationDocument } from "./ConsultationDocument.native.tsx";
import { MeasurePicker, PreparationPicker, QuickChoices, TrainingPicker } from "./ConsultationTemplates.native.tsx";
import { appendDistinctText, consultationTemplateCatalog, berlinDate, careGradeLabel, dateAfterDays, MATERIAL_OPTIONS, MEASURE_OWNERS, PARTICIPANT_ROLES, qualificationCovers, TEACHING_METHODS } from '../../lib/beratung/workspaceTemplates';
export type MutationResult = ConsultationMutationResult;
export type WorkspaceCommand = (action: ConsultationMutation, data: Record<string, unknown>, encounter?: Pick<ConsultationEncounter, 'id' | 'version'>) => Promise<MutationResult | null>;
const uid = () => crypto.randomUUID();
const formatDate = (value: string | null) => value ? new Date(value).toLocaleString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Noch offen';
export function ConsultationEditor({ encounter: e, workspace, busy, error, onCommand, onBack, onRefresh, draftScope }: {
    draftScope: string;
    encounter: ConsultationEncounter;
    workspace: ConsultationWorkspace;
    busy: boolean;
    error: string | null;
    onCommand: WorkspaceCommand;
    onBack: () => void;
    onRefresh: () => void;
}) {
    const window = useNativeWorkflowWindow();
    const [recovered] = useState(() => readConsultationDraft(draftScope, e.id));
    const [answers, setAnswers] = useState(() => recovered?.answers ?? normalizeConsultationAnswers(e.answers));
    const [dirty, setDirty] = useState(Boolean(recovered));
    const dirtyRef = useRef(Boolean(recovered));
    const [baseVersion, setBaseVersion] = useState(recovered?.version ?? e.version);
    const versionRef = useRef(recovered?.version ?? e.version);
    const base = useRef(recovered?.base ?? normalizeConsultationAnswers(e.answers));
    const [section, setSection] = useState<ConsultationSection>(e.status === 'returned' && e.review_section ? e.review_section : 'preparation');
    const [signatureContent, setSignatureContent] = useState<{
        answers: ConsultationAnswers;
        version: number;
    } | null>(null);
    const [reasonAction, setReasonAction] = useState<'return' | 'cancel' | 'no_show' | null>(null);
    const [reason, setReason] = useState('');
    const [reviewSection, setReviewSection] = useState<ConsultationSection>('situation');
    const [message, setMessage] = useState('');
    const [discardOpen, setDiscardOpen] = useState(false);
    const [mergeOpen, setMergeOpen] = useState(false);
    const [choices, setChoices] = useState<Record<string, 'local' | 'remote'>>({});
    const [revisionId, setRevisionId] = useState<string | null>(null);
    const editable = e.can_execute && isEncounterEditable(e.status);
    const conflict = dirty && baseVersion !== e.version;
    const sections: ConsultationSection[] = e.service_kind === '45' ? ['preparation', 'situation', 'training', 'measures', 'confirmation'] : ['preparation', 'situation', 'measures', 'confirmation'];
    useEffect(() => {
        if (dirty)
            keepConsultationDraft(draftScope, e.id, { answers, base: base.current, version: baseVersion });
    }, [draftScope, e.id, answers, dirty, baseVersion]);
    const issues = consultationIssues(e.service_kind, answers);
    const revisions = workspace.revisions.filter(r => r.encounter_id === e.id);
    const revision = revisions.find(r => r.id === revisionId);
    useLayoutEffect(() => {
        if (!dirtyRef.current) {
            const next = normalizeConsultationAnswers(e.answers);
            setAnswers(next);
            base.current = next;
            versionRef.current = e.version;
            setBaseVersion(e.version);
        }
    }, [e.version, e.answers]);
    useEffect(() => {
        function prevent(event: BeforeUnloadEvent) {
            if (dirtyRef.current) {
                event.preventDefault();
                event.returnValue = '';
            }
        }
        window.addEventListener('beforeunload', prevent);
        return () => window.removeEventListener('beforeunload', prevent);
    }, []);
    function update<K extends keyof ConsultationAnswers>(key: K, value: ConsultationAnswers[K] | ((current: ConsultationAnswers[K]) => ConsultationAnswers[K])) { setAnswers(a => ({ ...a, [key]: typeof value === 'function' ? value(a[key]) : value })); setDirty(true); dirtyRef.current = true; }
    async function run(action: ConsultationMutation, data: Record<string, unknown> = {}, expectedVersion?: number) {
        if (conflict && action !== 'comment')
            return null;
        if (dirtyRef.current && !['save', 'submit'].includes(action)) {
            const saved = await run('save', { answers });
            if (!saved)
                return null;
        }
        const result = await onCommand(action, data, { id: e.id, version: expectedVersion ?? versionRef.current });
        if (result) {
            versionRef.current = result.version;
            setBaseVersion(result.version);
            if (action === 'save' || action === 'submit') {
                dirtyRef.current = false;
                setDirty(false);
                base.current = answers;
                clearConsultationDraft(draftScope, e.id);
            }
        }
        return result;
    }
    const remote = normalizeConsultationAnswers(e.answers);
    const conflicts = (Object.keys(emptyConsultationAnswers()) as (keyof ConsultationAnswers)[]).filter(k => JSON.stringify(answers[k]) !== JSON.stringify(base.current[k]) && JSON.stringify(remote[k]) !== JSON.stringify(base.current[k]) && JSON.stringify(answers[k]) !== JSON.stringify(remote[k]));
    function merge() {
        const merged = { ...remote };
        for (const key of Object.keys(merged) as (keyof ConsultationAnswers)[]) {
            if (JSON.stringify(answers[key]) !== JSON.stringify(base.current[key]) && (!conflicts.includes(key) || choices[key] === 'local'))
                Object.assign(merged, { [key]: answers[key] });
        }
        base.current = remote;
        versionRef.current = e.version;
        setBaseVersion(e.version);
        setAnswers(merged);
        setDirty(true);
        dirtyRef.current = true;
        setMergeOpen(false);
    }
    const prompts: Partial<Record<keyof ConsultationAnswers, string>> = { situation: 'Versorgung im Alltag, vorhandene Unterstützung und Veränderungen seit dem letzten Besuch …', clientPerspective: 'Eigene Wünsche, Sorgen und Ziele; fehlende Beteiligung bitte erläutern …', caregiverPerspective: 'Erfahrungen, Fragen und Wünsche der Pflegeperson …', burden: 'Was belastet? Was gelingt gut? Welche Entlastung wird gewünscht?', guidance: 'Welche Themen wurden konkret besprochen? Welche Hinweise wurden tatsächlich gegeben?', summary: 'Was wurde gemeinsam vereinbart? Welche Fragen bleiben offen?', materials: 'Nur tatsächlich übergebene Materialien und Hilfsmittel erfassen …', followUpNote: 'Was wird beim nächsten Kontakt geklärt und wer übernimmt den Kontakt?' };
    const completedSections = sections.filter(s => !issues.some(i => i.section === s)).length;
    const field = (label: string, key: keyof ConsultationAnswers, multiline = true) => <TextField label={label} value={String(answers[key])} onChange={v => update(key, v as never)} multiline={multiline} placeholder={prompts[key] ?? ''}/>;
    return <>
  <NativeDiv className="cw-detail-toolbar"><NativeButton className="cw-link" onClick={() => dirty ? setDiscardOpen(true) : onBack()}>← Alle Besuche</NativeButton><NativeSpan className="cw-save-state" role="status">{busy ? 'Übertragung läuft …' : dirty ? 'Entwurf noch nicht gespeichert' : `Serverstand · Fassung ${e.version} · ${formatDate(e.updated_at)}`}</NativeSpan><NativeButton className="cw-link" onClick={onRefresh} disabled={busy}>Aktualisieren</NativeButton></NativeDiv>
  {e.status === 'returned' && <NativeDiv className="cw-alert cw-alert-warning"><NativeStrong>Rückfrage zur Dokumentation</NativeStrong><NativeP>{e.review_note}</NativeP><NativeButton className="cw-link" onClick={() => setSection(e.review_section ?? 'situation')}>Betroffenen Abschnitt öffnen →</NativeButton></NativeDiv>}
  {conflict && <NativeDiv role="alert" className="cw-alert cw-alert-warning"><NativeStrong>Es gibt einen neueren Serverstand.</NativeStrong><NativeP>Ihr Entwurf ist weiterhin geöffnet. Vergleichen Sie beide Fassungen, bevor Sie speichern.</NativeP><NativeButton className="cw-button" onClick={() => { setChoices({}); setMergeOpen(true); }}>Änderungen abgleichen</NativeButton></NativeDiv>}
  <NativeDiv className="cw-editor-grid"><NativeAside className="cw-context">
   <NativeDiv className="cw-panel cw-client"><NativeSpan className="cw-avatar">{e.client_snapshot.name.split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('')}</NativeSpan><NativeH2>{e.client_snapshot.name}</NativeH2><NativeP>{e.client_snapshot.address || 'Adresse noch nicht hinterlegt'}</NativeP><NativeDiv className="cw-tags"><NativeSpan className="cw-tag">{careGradeLabel(e.client_snapshot.care_grade)}</NativeSpan><NativeSpan className="cw-tag">{e.service_kind === '45' ? 'Schulung § 45' : 'Beratung § 37.3'}</NativeSpan></NativeDiv>
    <NativeDetails className="cw-client-details"><NativeSummary>Termin & Versorgung</NativeSummary><NativeDl className="cw-facts"><NativeDiv><NativeDt>Beratungsperson</NativeDt><NativeDd>{e.employee_name || 'Noch nicht zugewiesen'}</NativeDd></NativeDiv><NativeDiv><NativeDt>Geplanter Beginn</NativeDt><NativeDd>{formatDate(e.scheduled_start)}</NativeDd></NativeDiv><NativeDiv><NativeDt>Geplantes Ende</NativeDt><NativeDd>{formatDate(e.scheduled_end)}</NativeDd></NativeDiv><NativeDiv><NativeDt>Tatsächlicher Beginn</NativeDt><NativeDd>{formatDate(e.actual_start)}</NativeDd></NativeDiv><NativeDiv><NativeDt>Tatsächliches Ende</NativeDt><NativeDd>{formatDate(e.actual_end)}</NativeDd></NativeDiv><NativeDiv><NativeDt>Pflegekasse</NativeDt><NativeDd>{e.client_snapshot.payer || 'Noch nicht hinterlegt'}</NativeDd></NativeDiv></NativeDl></NativeDetails>
    {e.client_snapshot.phone && <NativeA className="cw-button" href={`tel:${e.client_snapshot.phone.replace(/[^+\d]/g, '')}`}>Telefonieren</NativeA>}
   </NativeDiv>
   <NativeNav className="cw-section-nav" aria-label="Dokumentationsabschnitte">{sections.map((s, i) => <NativeButton key={s} aria-current={section === s ? 'step' : undefined} onClick={() => setSection(s)}><NativeSpan className="cw-step" aria-label={!issues.some(x => x.section === s) ? "Pflichtangaben vollständig" : undefined}>{issues.some(x => x.section === s) ? i + 1 : '✓'}</NativeSpan><NativeSpan>{SECTION_LABELS[s]}</NativeSpan>{issues.some(x => x.section === s) && <NativeSpan className="cw-step-dot" aria-label="Noch zu vervollständigen"/>}</NativeButton>)}</NativeNav>
   <NativeDiv className="cw-panel cw-small"><NativeStrong>{completedSections} von {sections.length} Abschnitten vollständig</NativeStrong><NativeProgress className="cw-completion" max={sections.length} value={completedSections} aria-label="Abschnitte mit vollständigen Pflichtangaben"/><NativeP>Pflichtangaben der Dokumentation. Die fachliche Prüfung erfolgt anschließend.</NativeP></NativeDiv>
  </NativeAside>
  <NativeDiv className="cw-editor-main">
   {workspace.canManage && ['draft', 'scheduled'].includes(e.status) && <Planning encounter={e} workspace={workspace} busy={busy} run={run}/>}
   {!editable && <NativeDiv className="cw-workflow-hint" role="status"><NativeSpan className="cw-step" aria-hidden>→</NativeSpan><NativeDiv><NativeStrong>{e.status === 'draft' ? 'Zuerst den Besuch planen' : e.status === 'scheduled' ? 'Für die Durchführung vorbereitet' : 'Dokumentation in der Ansicht'}</NativeStrong><NativeP>{e.status === 'draft' ? 'Termin und eine freigegebene Beratungsperson zuweisen. Danach steht der Besuch im Mitarbeiterportal bereit.' : e.status === 'scheduled' ? 'Die zugewiesene Beratungsperson bestätigt die Übergabe und beginnt den Besuch. Anschließend sind die Dokumentationsfelder bearbeitbar.' : ['submitted', 'approved'].includes(e.status) ? 'Die eingereichte Fassung bleibt erhalten. Korrekturen erfolgen über eine fachliche Rückfrage.' : 'Die Bearbeitung setzt eine persönliche Zuweisung, eine gültige Freigabe und einen offenen Besuch voraus.'}</NativeP></NativeDiv></NativeDiv>}
   <NativeSection className="cw-panel cw-form-panel"><NativeDiv className="cw-section-heading"><NativeDiv><NativeP className="cw-kicker">{e.service_kind === '45' ? 'Häusliche Schulung' : 'Beratungsbesuch'}</NativeP><NativeH2>{SECTION_LABELS[section]}</NativeH2></NativeDiv><NativeSpan className="cw-tag">{sections.indexOf(section) + 1} / {sections.length}</NativeSpan></NativeDiv>
    {section === 'preparation' && <><NativeDiv className="cw-handover"><NativeH3>Übergabe der Verwaltung</NativeH3><NativeP>{e.preparation || 'Es wurden keine zusätzlichen Hinweise hinterlegt.'}</NativeP>{e.client_snapshot.access_notes && <NativeP><NativeStrong>Zugang:</NativeStrong> {e.client_snapshot.access_notes}</NativeP>}{e.client_snapshot.notes && <NativeP><NativeStrong>Hinweise:</NativeStrong> {e.client_snapshot.notes}</NativeP>}<NativeSmall>{e.last_read_at ? `Gelesen am ${formatDate(e.last_read_at)}` : 'Lesebestätigung ausstehend'}</NativeSmall></NativeDiv>
     {e.can_execute && ['scheduled', 'returned'].includes(e.status) && !e.last_read_at && <NativeButton className="cw-button" disabled={busy} onClick={() => void run('read')}>Übergabe gelesen</NativeButton>}
     {e.can_execute && e.status === 'scheduled' && <NativeDiv className="cw-actions"><NativeButton className="cw-button cw-primary" disabled={busy || !e.last_read_at} onClick={() => void run('start').then(r => {
                    if (r)
                        setSection('preparation');
                })}>Besuch jetzt beginnen</NativeButton><NativeButton className="cw-button" disabled={busy} onClick={() => { setReason(''); setReasonAction('no_show'); }}>Nicht angetroffen</NativeButton></NativeDiv>}
     <NativeH3>Teilnehmende Personen</NativeH3><NativeP className="cw-muted">Erfassen Sie die tatsächlich beteiligten Personen und ihre Rolle im Gespräch.</NativeP><NativeFieldset disabled={!editable || busy} className="cw-reset-fieldset"><NativeDiv className="cw-repeat-list">{answers.participants.map((p, i) => <NativeDiv className="cw-repeat-item" key={p.id}><NativeDiv className="cw-between"><NativeStrong>Person {i + 1}</NativeStrong><NativeButton className="cw-link" onClick={() => update('participants', current => current.filter(x => x.id !== p.id))}>Entfernen</NativeButton></NativeDiv><NativeDiv className="cw-form-grid"><TextField label="Name" value={p.name} onChange={v => update('participants', current => current.map(x => x.id === p.id ? { ...x, name: v } : x))}/><TextField label="Rolle / Beziehung" value={p.role} onChange={v => update('participants', current => current.map(x => x.id === p.id ? { ...x, role: v } : x))}/></NativeDiv><QuickChoices label="Rolle auswählen" options={PARTICIPANT_ROLES} onChoose={role => update('participants', current => current.map(x => x.id === p.id ? { ...x, role } : x))}/><TextField label="Vertretung / Beteiligung, falls relevant" value={p.authority} onChange={v => update('participants', current => current.map(x => x.id === p.id ? { ...x, authority: v } : x))}/></NativeDiv>)}</NativeDiv><NativeButton className="cw-button" onClick={() => update('participants', [...answers.participants, { id: uid(), name: answers.participants.length || e.service_kind === '45' ? '' : e.client_snapshot.name, role: answers.participants.length ? '' : e.service_kind === '45' ? 'Pflegende Person' : 'Pflegebedürftige Person', authority: '' }])}>+ Person ergänzen</NativeButton></NativeFieldset>
    </>}
    {section === 'situation' && <NativeFieldset disabled={!editable || busy} className="cw-reset-fieldset">
     {field('Aktuelle Pflegesituation', 'situation')}{e.service_kind === '37_3' && <NativeDiv className="cw-form-grid">{field('Sicht der pflegebedürftigen Person', 'clientPerspective')}{field('Sicht der Pflegeperson', 'caregiverPerspective')}</NativeDiv>}{field('Belastung, Ressourcen und Entlastungsbedarf', 'burden')}
     <NativeFieldset className="cw-topic-fieldset"><NativeLegend>Besprochene Themen</NativeLegend><NativeP className="cw-muted">Nur die im Besuch tatsächlich behandelten Themen auswählen.</NativeP><NativeDiv className="cw-topic-grid">{TOPICS.map(topic => <NativeLabel key={topic} className="cw-topic"><NativeInput type="checkbox" checked={answers.topics.includes(topic)} onChange={ev => update('topics', ev.target.checked ? [...answers.topics, topic] : answers.topics.filter(t => t !== topic))}/>{topic}</NativeLabel>)}</NativeDiv></NativeFieldset>
     {field('Tatsächlich gegebene Beratung und Hinweise', 'guidance')}
     {e.service_kind === '37_3' && <SelectField label="Ist die Pflege aus fachlicher Sicht sichergestellt?" value={answers.careSecured} onChange={v => update('careSecured', v as ConsultationAnswers['careSecured'])}><NativeOption value="">Bitte einschätzen</NativeOption><NativeOption value="yes">Ja, sichergestellt</NativeOption><NativeOption value="partly">Teilweise sichergestellt</NativeOption><NativeOption value="no">Nicht sichergestellt</NativeOption></SelectField>}
     <SelectField label="Handlungsbedarf" value={answers.risk} onChange={v => update('risk', v as ConsultationAnswers['risk'])}><NativeOption value="">Bitte einschätzen</NativeOption><NativeOption value="none">Kein akuter Handlungsbedarf</NativeOption><NativeOption value="clarify">Klärung erforderlich</NativeOption><NativeOption value="urgent">Dringender Handlungsbedarf</NativeOption></SelectField>
     {answers.risk === 'urgent' && <NativeP className="cw-alert cw-alert-error">Bei einer akuten Gefährdung Hilfe unmittelbar veranlassen. Die Einreichung der Dokumentation ersetzt keine Hilfe vor Ort.</NativeP>}
     {['clarify', 'urgent'].includes(answers.risk) && <>{field('Welche Auffälligkeit wurde festgestellt?', 'riskNotes')}{field('Welche Hilfe wurde veranlasst? Durch wen und wann?', 'riskAction')}</>}
    </NativeFieldset>}
    {section === 'training' && <NativeFieldset disabled={!editable || busy} className="cw-reset-fieldset"><NativeP className="cw-muted">Konkrete Lernziele vereinbaren, Handgriffe anleiten und die Anwendung gemeinsam überprüfen.</NativeP><TrainingPicker templates={consultationTemplateCatalog(workspace.teamTemplates)} goals={answers.goals} onChange={v => update('goals', v)}/><NativeDiv className="cw-repeat-list">{answers.goals.map((g, i) => <NativeSection key={g.id} className="cw-repeat-item"><NativeDiv className="cw-between"><NativeH3>Lernziel {i + 1}</NativeH3><NativeButton className="cw-link" onClick={() => update('goals', current => current.filter(x => x.id !== g.id))}>Entfernen</NativeButton></NativeDiv>{(['title', 'method', 'practice', 'nextStep'] as const).map(k => <TextField key={k} label={{ title: 'Was soll die Pflegeperson danach können?', method: 'Anleitung und verwendete Methode', practice: 'Gemeinsam durchgeführte Übung', nextStep: 'Weiteres Vorgehen / Übungsbedarf' }[k]} value={g[k]} onChange={v => update('goals', current => current.map(x => x.id === g.id ? { ...x, [k]: v } : x))} multiline={k !== 'title'}/>)}<QuickChoices label="Tatsächlich verwendete Methode" options={TEACHING_METHODS} onChoose={v => update('goals', current => current.map(x => x.id === g.id ? { ...x, method: appendDistinctText(x.method, v) } : x))}/><SelectField label="Lernergebnis" value={g.result} onChange={v => update('goals', current => current.map(x => x.id === g.id ? { ...x, result: v as typeof g.result } : x))}>{Object.entries(LEARNING_LABELS).map(([k, l]) => <NativeOption key={k} value={k}>{l}</NativeOption>)}</SelectField></NativeSection>)}</NativeDiv><NativeButton className="cw-button" onClick={() => update('goals', [...answers.goals, { id: uid(), title: '', method: '', practice: '', result: '', nextStep: '' }])}>+ Lernziel hinzufügen</NativeButton>{field('Übergebene Materialien und Hilfsmittel', 'materials')}<QuickChoices label="Tatsächlich übergebene Materialien ergänzen" options={MATERIAL_OPTIONS} onChoose={v => update('materials', current => appendDistinctText(current, v))}/></NativeFieldset>}
    {section === 'measures' && <NativeFieldset disabled={!editable || busy} className="cw-reset-fieldset">{field('Gemeinsames Ergebnis des Besuchs', 'summary')}<NativeH3>Empfehlungen und Verantwortlichkeiten</NativeH3><MeasurePicker measures={answers.measures} onChange={v => update('measures', v)}/><NativeDiv className="cw-repeat-list">{answers.measures.map((m, i) => <NativeDiv key={m.id} className="cw-repeat-item"><NativeDiv className="cw-between"><NativeStrong>Empfehlung {i + 1}</NativeStrong><NativeButton className="cw-link" onClick={() => update('measures', current => current.filter(x => x.id !== m.id))}>Entfernen</NativeButton></NativeDiv><TextField label="Was ist zu tun?" value={m.title} onChange={v => update('measures', current => current.map(x => x.id === m.id ? { ...x, title: v } : x))}/><NativeDiv className="cw-form-grid"><TextField label="Verantwortlich" value={m.owner} onChange={v => update('measures', current => current.map(x => x.id === m.id ? { ...x, owner: v } : x))}/><TextField label="Bis wann?" type="date" value={m.due} onChange={v => update('measures', current => current.map(x => x.id === m.id ? { ...x, due: v } : x))}/></NativeDiv><QuickChoices label="Verantwortung auswählen" options={MEASURE_OWNERS} onChoose={v => update('measures', current => current.map(x => x.id === m.id ? { ...x, owner: v } : x))}/><QuickChoices label="Frist ab heute" options={['In 7 Tagen', 'In 14 Tagen', 'In 4 Wochen']} onChoose={v => update('measures', current => current.map(x => x.id === m.id ? { ...x, due: dateAfterDays(v === 'In 7 Tagen' ? 7 : v === 'In 14 Tagen' ? 14 : 28) } : x))}/><SelectField label="Bearbeitungsstand" value={m.status} onChange={v => update('measures', current => current.map(x => x.id === m.id ? { ...x, status: v as typeof m.status } : x))}><NativeOption value="open">Offen</NativeOption><NativeOption value="done">Erledigt</NativeOption></SelectField><TextField label="Ergebnis / Rückmeldung" value={m.outcome} onChange={v => update('measures', current => current.map(x => x.id === m.id ? { ...x, outcome: v } : x))}/></NativeDiv>)}</NativeDiv><NativeButton className="cw-button" onClick={() => update('measures', [...answers.measures, { id: uid(), title: '', owner: '', due: '', status: 'open', outcome: '' }])}>+ Empfehlung hinzufügen</NativeButton><NativeH3>Wiedervorlage</NativeH3><TextField label="Wiedervorlage am" type="date" value={answers.followUpDate} onChange={v => update('followUpDate', v)}/><QuickChoices label="Wiedervorlage ab heute" options={['In 7 Tagen', 'In 14 Tagen', 'In 4 Wochen']} onChoose={v => update('followUpDate', dateAfterDays(v === 'In 7 Tagen' ? 7 : v === 'In 14 Tagen' ? 14 : 28))}/>{field('Anlass und nächster Kontakt', 'followUpNote')}</NativeFieldset>}
    {section === 'confirmation' && <>
     {e.service_kind === '37_3' && <NativeFieldset disabled={!editable || busy} className="cw-reset-fieldset"><SelectField label="Weitergabe von Erkenntnissen an die Pflegekasse" value={answers.findingsConsent} onChange={v => update('findingsConsent', v as ConsultationAnswers['findingsConsent'])}><NativeOption value="">Entscheidung dokumentieren</NativeOption><NativeOption value="yes">Einwilligung liegt vor</NativeOption><NativeOption value="no">Keine Einwilligung</NativeOption></SelectField><NativeP className="cw-muted">Die Entscheidung betrifft die Weitergabe von Erkenntnissen. Die Besuchsbestätigung wird davon getrennt behandelt. Hier wird noch nichts an die Pflegekasse versendet.</NativeP></NativeFieldset>}
     {issues.length > 0 && <NativeDiv className="cw-checklist"><NativeH3>Noch zu vervollständigen</NativeH3>{issues.map((x, i) => <NativeButton key={i} className="cw-checklist-row" onClick={() => setSection(x.section)}><NativeSpan className="cw-step-dot"/>{x.message}<NativeSpan>→</NativeSpan></NativeButton>)}</NativeDiv>}
     {issues.length === 0 && <NativeP className="cw-alert cw-alert-success">Die erforderlichen Angaben sind vollständig. Bitte den Inhalt gemeinsam prüfen.</NativeP>}
     <NativeDetails className="cw-summary"><NativeSummary>Vollständige Dokumentation ansehen</NativeSummary><ConsultationDocument answers={answers} client={e.client_snapshot} kind={e.service_kind}/></NativeDetails>
     {e.can_execute && e.status === 'in_progress' && <NativeButton className="cw-button cw-primary" disabled={busy || conflict} onClick={() => void run('finish')}>Besuch jetzt beenden</NativeButton>}
     {editable && ['documentation_pending', 'returned'].includes(e.status) && <NativeButton className="cw-button cw-primary" disabled={busy || conflict || issues.length > 0} onClick={() => setSignatureContent({ answers: structuredClone(answers), version: versionRef.current })}>Unterschreiben & einreichen</NativeButton>}
     {['submitted', 'approved'].includes(e.status) && <NativeP className="cw-alert cw-alert-success">{e.status === 'approved' ? 'Die fachliche Prüfung ist abgeschlossen.' : 'Die Dokumentation wurde zur fachlichen Prüfung eingereicht.'}</NativeP>}
     {revisions.length > 0 && <><NativeH3>Bestätigte Fassungen</NativeH3><NativeDiv className="cw-revisions">{revisions.map(r => <NativeButton className="cw-button" key={r.id} onClick={() => setRevisionId(r.id)}>Fassung {r.version} · {formatDate(r.created_at)}</NativeButton>)}</NativeDiv></>}
    </>}
    <NativeDiv className="cw-form-footer"><NativeButton className="cw-button" disabled={sections.indexOf(section) === 0} onClick={() => setSection(sections[sections.indexOf(section) - 1])}>Zurück</NativeButton><NativeDiv className="cw-actions">{editable && <NativeButton className="cw-button" disabled={busy || !dirty || conflict} onClick={() => void run('save', { answers })}>Zwischenspeichern</NativeButton>}{section !== 'confirmation' && <NativeButton className="cw-button cw-primary" onClick={() => setSection(sections[sections.indexOf(section) + 1])}>Weiter →</NativeButton>}</NativeDiv></NativeDiv>
   </NativeSection>
   {workspace.canReview && e.status === 'submitted' && <NativeSection className="cw-panel"><NativeP className="cw-kicker">Fachliche Prüfung</NativeP><NativeH2>Dokumentation beurteilen</NativeH2><NativeP>Die bestätigte Fassung öffnen und auf Vollständigkeit sowie nachvollziehbare Empfehlungen prüfen.</NativeP><NativeDiv className="cw-actions"><NativeButton className="cw-button" onClick={() => setRevisionId(revisions[0]?.id ?? null)} disabled={!revisions.length}>Bestätigte Fassung öffnen</NativeButton><NativeButton className="cw-button" disabled={busy} onClick={() => { setReason(''); setReasonAction('return'); }}>Rückfrage stellen</NativeButton><NativeButton className="cw-button cw-primary" disabled={busy} onClick={() => void run('approve')}>Fachlich freigeben</NativeButton></NativeDiv><NativeP className="cw-muted">Eine fachliche Freigabe ist keine Versand- oder Abrechnungsbestätigung.</NativeP></NativeSection>}
   <ConsultationFollowUps workspace={workspace} encounter={e} busy={busy} error={error} onCommand={onCommand} onReload={onRefresh}/>
   <NativeSection className="cw-panel"><NativeDiv className="cw-between"><NativeH2>Verlauf & Rückfragen</NativeH2>{workspace.canManage && ['draft', 'scheduled'].includes(e.status) && <NativeButton className="cw-link" disabled={busy} onClick={() => { setReason(''); setReasonAction('cancel'); }}>Termin absagen</NativeButton>}</NativeDiv><NativeDiv className="cw-message-form"><TextField label="Nachricht zur Besuchsakte" value={message} onChange={setMessage} multiline/><NativeButton className="cw-button" disabled={busy || !message.trim() || conflict} onClick={() => void run('comment', { note: message }).then(r => {
            if (r)
                setMessage('');
        })}>In der Akte hinterlegen</NativeButton></NativeDiv><NativeOl className="cw-timeline">{workspace.events.filter(x => x.encounter_id === e.id).map(x => <NativeLi key={x.id}><NativeDiv className="cw-between"><NativeStrong>{eventLabel(x.action)}</NativeStrong><NativeTime>{formatDate(x.created_at)}</NativeTime></NativeDiv><NativeSmall>{x.actor_label}</NativeSmall>{x.note && <NativeP>{x.note}</NativeP>}</NativeLi>)}</NativeOl></NativeSection>
  </NativeDiv></NativeDiv>
  {signatureContent && <SignatureDialog key={signatureContent.version} training={e.service_kind === '45'} clientName={e.service_kind === '45' ? (signatureContent.answers.participants[0]?.name ?? '') : e.client_snapshot.name} counselorName={e.employee_name ?? ''} summary={<ConsultationDocument answers={signatureContent.answers} client={e.client_snapshot} kind={e.service_kind}/>} busy={busy} error={error} onClose={() => setSignatureContent(null)} onSubmit={async (signatures) => {
                const result = await onCommand('submit', { answers: signatureContent.answers, signatures }, { id: e.id, version: signatureContent.version });
                if (result) {
                    versionRef.current = result.version;
                    setBaseVersion(result.version);
                    dirtyRef.current = false;
                    setDirty(false);
                    base.current = signatureContent.answers;
                    setAnswers(signatureContent.answers);
                    clearConsultationDraft(draftScope, e.id);
                    setSignatureContent(null);
                }
            }}/>}
  {reasonAction && <Dialog title={reasonAction === 'return' ? 'Gezielte Rückfrage' : reasonAction === 'cancel' ? 'Termin absagen' : 'Nicht angetroffen'} onClose={() => setReasonAction(null)} busy={busy}>{reasonAction === 'return' && <SelectField label="Betroffener Abschnitt" value={reviewSection} onChange={v => setReviewSection(v as ConsultationSection)}>{sections.map(s => <NativeOption value={s} key={s}>{SECTION_LABELS[s]}</NativeOption>)}</SelectField>}<TextField label={reasonAction === 'return' ? 'Was muss ergänzt oder geklärt werden?' : 'Begründung und weiterer Kontakt'} value={reason} onChange={setReason} multiline/>{error && <NativeP className="cw-alert cw-alert-error" role="alert">{error}</NativeP>}<NativeDiv className="cw-actions"><NativeButton className="cw-button" onClick={() => setReasonAction(null)} disabled={busy}>Abbrechen</NativeButton><NativeButton className="cw-button cw-primary" disabled={busy || !reason.trim()} onClick={() => void run(reasonAction, { note: reason, section: reviewSection }).then(r => {
                if (r)
                    setReasonAction(null);
            })}>Bestätigen</NativeButton></NativeDiv></Dialog>}
  {discardOpen && <Dialog title="Entwurf noch nicht gespeichert" onClose={() => setDiscardOpen(false)} busy={busy}><NativeP>Speichern Sie Ihre Änderungen vor dem Verlassen der Besuchsakte.</NativeP><NativeDiv className="cw-actions"><NativeButton className="cw-button" onClick={() => setDiscardOpen(false)}>Weiter bearbeiten</NativeButton><NativeButton className="cw-button cw-primary" disabled={busy || conflict} onClick={() => void run('save', { answers }).then(r => {
                if (r)
                    onBack();
            })}>Speichern & zurück</NativeButton></NativeDiv></Dialog>}
  {mergeOpen && <Dialog title="Änderungen abgleichen" onClose={() => setMergeOpen(false)} wide><NativeP>Unabhängige Änderungen werden zusammengeführt. Bei demselben geänderten Feld wählen Sie den Inhalt aus, der übernommen werden soll.</NativeP>{conflicts.map(k => <NativeDiv className="cw-conflict-field" key={k}><NativeH3>{answerLabel(k)}</NativeH3><NativeDiv className="cw-form-grid">{(['local', 'remote'] as const).map(source => <NativeLabel key={source}><NativeInput type="radio" name={`conflict-${k}`} checked={choices[k] === source} onChange={() => setChoices(c => ({ ...c, [k]: source }))}/>{source === 'local' ? 'Mein Entwurf' : 'Serverstand'}<NativePre>{typeof answers[k] === 'string' ? String((source === 'local' ? answers : remote)[k]) : JSON.stringify((source === 'local' ? answers : remote)[k], null, 2)}</NativePre></NativeLabel>)}</NativeDiv></NativeDiv>)}{conflicts.length === 0 && <NativeP>Es gibt keine widersprüchlichen Feldänderungen.</NativeP>}<NativeButton className="cw-button cw-primary" disabled={conflicts.some(k => !choices[k])} onClick={merge}>Auswahl als Entwurf übernehmen</NativeButton></Dialog>}
  {revision && <Dialog title={`Bestätigte Fassung ${revision.version}`} onClose={() => setRevisionId(null)} wide><ConsultationDocument answers={normalizeConsultationAnswers(revision.snapshot.answers)} client={revision.snapshot.client} kind={revision.snapshot.service_kind} revision={revision}/><NativeP className="cw-muted">Interne Besuchsdokumentation. Der kassenspezifische Nachweis und dessen Übermittlung sind gesondert zu bearbeiten.</NativeP><NativeButton className="cw-button" onClick={() => printConsultationRevision(revision)}>Drucken / als PDF speichern</NativeButton></Dialog>}
 </>;
}
function eventLabel(action: string) { return EVENT_LABELS[action] ?? action; }
function answerLabel(key: string) { return ({ participants: 'Teilnehmende', clientPerspective: 'Sicht der pflegebedürftigen Person', caregiverPerspective: 'Sicht der Pflegeperson', situation: 'Pflegesituation', burden: 'Belastung', topics: 'Themen', guidance: 'Beratung', careSecured: 'Sicherstellung', risk: 'Handlungsbedarf', riskNotes: 'Auffälligkeit', riskAction: 'Veranlasste Hilfe', findingsConsent: 'Weitergabe', goals: 'Lernziele', materials: 'Materialien', measures: 'Empfehlungen', summary: 'Ergebnis', followUpDate: 'Wiedervorlage', followUpNote: 'Anlass' } as Record<string, string>)[key] ?? key; }
function localDate(iso: string | null) {
    if (!iso)
        return '';
    const date = new Date(iso);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
function Planning({ encounter: e, workspace, busy, run }: {
    encounter: ConsultationEncounter;
    workspace: ConsultationWorkspace;
    busy: boolean;
    run: (a: ConsultationMutation, d: Record<string, unknown>, version?: number) => Promise<MutationResult | null>;
}) {
    const [planVersion, setPlanVersion] = useState(e.version);
    const [employee, setEmployee] = useState(e.assigned_employee_id ?? '');
    const [start, setStart] = useState(localDate(e.scheduled_start));
    const [end, setEnd] = useState(localDate(e.scheduled_end));
    const [preparation, setPreparation] = useState(e.preparation);
    const [open, setOpen] = useState(e.status === 'draft');
    const startDate = start ? berlinDate(new Date(start)) : berlinDate();
    const endDate = end ? berlinDate(new Date(end)) : startDate;
    const qualified = (id: string) => workspace.employees.find(p => p.id === id)?.qualifications.some(q => qualificationCovers(q, e.service_kind, startDate, endDate)) ?? false;
    const validRange = Boolean(start && end && new Date(end).getTime() > new Date(start).getTime() && new Date(end).getTime() - new Date(start).getTime() <= 12 * 3600000);
    function duration(minutes: number) { if (start)
        setEnd(localDate(new Date(new Date(start).getTime() + minutes * 60000).toISOString())); }
    return <NativeSection className="cw-panel"><NativeDiv className="cw-between"><NativeH2>Termin & Zuweisung</NativeH2><NativeButton className="cw-link" aria-expanded={open} onClick={() => {
            if (!open) {
                setPlanVersion(e.version);
                setEmployee(e.assigned_employee_id ?? '');
                setStart(localDate(e.scheduled_start));
                setEnd(localDate(e.scheduled_end));
                setPreparation(e.preparation);
            }
            setOpen(v => !v);
        }}>{open ? 'Schließen' : 'Bearbeiten'}</NativeButton></NativeDiv>{open && <NativeForm onSubmit={ev => {
                ev.preventDefault();
                if (!validRange || !qualified(employee))
                    return;
                void run('plan', { employee_id: employee, scheduled_start: new Date(start).toISOString(), scheduled_end: new Date(end).toISOString(), preparation }, planVersion).then(r => {
                    if (r)
                        setOpen(false);
                });
            }}><NativeFieldset disabled={busy} className="cw-reset-fieldset"><SelectField label="Beratungsperson" value={employee} onChange={setEmployee}><NativeOption value="">Bitte auswählen</NativeOption>{workspace.employees.map(s => <NativeOption value={s.id} key={s.id}>{s.name}{qualified(s.id) ? ' · Für den Zeitraum freigegeben' : ' · Gültige Freigabe fehlt'}</NativeOption>)}</SelectField><NativeDiv className="cw-form-grid"><TextField label="Beginn (Ortszeit des Geräts)" type="datetime-local" value={start} onChange={setStart} required/><TextField label="Ende (Ortszeit des Geräts)" type="datetime-local" value={end} onChange={setEnd} required/></NativeDiv><QuickChoices label="Geplante Dauer" options={['30 Minuten', '45 Minuten', '60 Minuten', '90 Minuten']} disabled={!start} onChoose={v => duration(Number.parseInt(v, 10))}/>{start && end && !validRange && <NativeP className="cw-alert cw-alert-warning" role="alert">Das Ende muss nach dem Beginn liegen. Ein Besuch darf höchstens zwölf Stunden dauern.</NativeP>}{employee && !qualified(employee) && <NativeP className="cw-alert cw-alert-warning" role="alert">Für diese Person fehlt eine gültige Freigabe für die Leistungsart und den gewählten Zeitraum. Bitte die Qualifikationsfreigabe prüfen.</NativeP>}<PreparationPicker templates={consultationTemplateCatalog(workspace.teamTemplates)} kind={e.service_kind} value={preparation} onChange={setPreparation}/><TextField label="Vorbereitung und Übergabe" value={preparation} onChange={setPreparation} multiline/><NativeP className="cw-muted">Die gültige Freigabe für diese Leistungsart und Terminüberschneidungen werden beim Speichern geprüft.</NativeP><NativeButton className="cw-button cw-primary" type="submit" disabled={!employee || !validRange || !qualified(employee) || busy}>Termin zuweisen</NativeButton></NativeFieldset></NativeForm>}</NativeSection>;
}
